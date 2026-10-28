import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { normalizePhone } from '@/lib/telegram.ts'
import { clientClosedConversation, isEmptyEval, isEmptyHotline } from '@/lib/evalFlow.ts'
import { onixClientsByPhones, phone9, type TierKey } from '@/lib/onix.ts'
import { DEPT_FROM, deptOf, lastTransferInto, transfersOf } from '@/lib/transfer.ts'

/** Єдина стрічка для робочого столу: оцінка + гаряча лінія + відгуки + бронь. */

const EVAL_STATUS: Record<string, string> = { new: 'Новий', work: 'В роботі', done: 'Оцінено', reject: 'Відмова' }
const HOTLINE_STATUS: Record<string, string> = { new: 'Нове', work: 'В роботі', done: 'Закрито' }
const BOOKING_STATUS: Record<string, string> = {
  new: 'Новий', came: 'Клієнт прийшов', done: 'Оформлено', missed: 'Не прийшов',
}

type Channel = 'eval' | 'hotline' | 'review' | 'booking'

type Item = {
  key: string
  kind: 'eval' | 'hotline' | 'booking'
  channel: Channel
  id: string | number
  title: string
  /** Звідки передали в цей відділ (порожньо — не передавали) і скільки передач усього. */
  transferredFrom?: string
  transferCount?: number
  phone: string
  status: string
  statusLabel: string
  snippet: string
  /** Ще ніхто з команди не відкривав цю заявку в робочому столі відтоді, як там щось змінилось. */
  unread: boolean
  /** Хтось відкривав, але останнє слово — за клієнтом: відповіді ще не було. */
  unanswered: boolean
  /** Відколи чекає на відповідь — для таймера прострочення. null, якщо вже відповіли. */
  waitingSince: string | null
  /** Перша відповідь команди — так само, як рахує звіт (dashboard/report). */
  firstReplyAt: string | null
  /** Після оцінки чи відмови клієнт лише подякував — заявка лишається закритою. */
  thanked: boolean
  /** Клієнт відповів на вже надану оцінку («мало», питання, фото) — це торг, а не новий клієнт. */
  replyToEstimate: boolean
  /** Позначено «Не потребує відповіді» після останнього слова клієнта. */
  noReply: boolean
  /** Клієнт в Ониксі за телефоном: найкращий статус і мережі. null — немає в базі. */
  /** Статус і ПІБ головного запису в Ониксі; networks — головна база першою, далі та сама людина деінде. */
  client?: { tier: TierKey; tierLabel: string; discount: number | null; fullName: string; people: number; networks: string[] } | null
  assignedTo: string | number | null
  assignedToName: string
  updatedAt: string
  createdAt: string
}

function lastThreadText(thread: unknown): string {
  const arr = Array.isArray(thread) ? thread : []
  const last = arr[arr.length - 1] as { text?: string } | undefined
  return String(last?.text || '').slice(0, 160)
}

function lastThreadAt(thread: unknown, fallback: unknown): number {
  const arr = Array.isArray(thread) ? thread : []
  const last = arr[arr.length - 1] as { at?: string } | undefined
  const t = new Date(String(last?.at || fallback || 0)).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * «Не відповідані» — останнє слово за клієнтом (чи переписки ще нема).
 * Закрите статусом («Оцінено», «Відмова») не висить як невідповідане: рішення
 * вже прийняте; якщо клієнт напише щось по суті — бот сам знову відкриє заявку.
 * «Не потребує відповіді» знімає позначку до наступного слова клієнта.
 */
function isUnanswered(thread: unknown, status: unknown, noReplyAt: unknown, createdAt: unknown, transferAt?: string | null): boolean {
  if (status === 'done' || status === 'reject') return false
  // Щойно передане з іншого відділу: «без відповіді», поки цей відділ не напише сам
  if (transferAt && !staffSince(thread, transferAt)) {
    const marked = noReplyAt ? new Date(String(noReplyAt)).getTime() : 0
    return !(marked && marked >= new Date(transferAt).getTime())
  }
  const arr = Array.isArray(thread) ? (thread as { from?: string }[]) : []
  const clientLast = !arr.length || arr[arr.length - 1]?.from === 'клієнт'
  if (!clientLast) return false
  // «Дякую», «ні, спасибі», «гарного вечора» після відповіді команди — відповідати нема на що
  if (clientClosedConversation(thread)) return false
  const marked = noReplyAt ? new Date(String(noReplyAt)).getTime() : 0
  return !(marked && marked >= lastThreadAt(thread, createdAt))
}

/** Чи писав хтось із співробітників після цієї миті (відповіді попереднього відділу не рахуються). */
function staffSince(thread: unknown, sinceIso: string): boolean {
  const since = new Date(sinceIso).getTime()
  const arr = Array.isArray(thread) ? (thread as { from?: string; at?: string }[]) : []
  return arr.some((t) => t.from && t.from !== 'клієнт' && new Date(String(t.at || 0)).getTime() >= since)
}

function noReplyMarked(thread: unknown, noReplyAt: unknown, createdAt: unknown): boolean {
  if (!noReplyAt) return false
  const t = new Date(String(noReplyAt)).getTime()
  return Number.isFinite(t) && t >= lastThreadAt(thread, createdAt)
}

/** Мить, відколи «тікає» таймер очікування — час останнього слова клієнта (чи створення, якщо переписки ще нема). */
function waitingSinceOf(thread: unknown, createdAt: unknown, unanswered: boolean, transferAt?: string | null): string | null {
  if (!unanswered) return null
  // після передачі «чекає» рахуємо від передачі — скільки чекають саме цей відділ
  if (transferAt && !staffSince(thread, transferAt)) return transferAt
  const t = lastThreadAt(thread, createdAt)
  return t ? new Date(t).toISOString() : null
}

function firstReplyAtOf(thread: unknown, sinceIso?: string | null): string | null {
  const arr = Array.isArray(thread) ? (thread as { from?: string; at?: string }[]) : []
  const since = sinceIso ? new Date(sinceIso).getTime() : 0
  return arr.find((t) => t.from && t.from !== 'клієнт' && t.at && new Date(t.at).getTime() >= since)?.at || null
}

/** «Непрочитане» — окреме від «не відповідано»: ніхто не відкривав відтоді, як з'явилось останнє повідомлення. */
function isUnread(lastViewedAt: unknown, thread: unknown, createdAt: unknown, transferAt?: string | null): boolean {
  const viewed = new Date(String(lastViewedAt || 0)).getTime()
  if (!lastViewedAt || !Number.isFinite(viewed)) return true
  if (transferAt && viewed < new Date(transferAt).getTime()) return true
  return viewed < lastThreadAt(thread, createdAt)
}

/** Позначки передачі для списку: звідки щойно передали й скільки разів передавали взагалі. */
function transferFields(d: Record<string, unknown>, kind: 'eval' | 'hotline') {
  const last = lastTransferInto(d, deptOf(kind, d))
  return {
    transferredFrom: last ? DEPT_FROM[last.from] : '',
    transferCount: transfersOf(d).length,
  }
}

/*
 * depth:0 нижче навмисно: за замовчуванням Payload на depth:1 підтягував
 * би не лише assignedTo, а й повний масив photos з усіма даними кожного
 * файлу — на кожен запис, на кожному з опитувань раз на 8 секунд, хоча
 * список фото тут узагалі ніде не показується. Ім'я виконавця натомість
 * береться з однієї дешевої мапи — замість вбудованого розгортання
 * зв'язку на кожному окремому записі.
 */
function assignedFields(
  d: Record<string, unknown>, names: Map<string, string>,
): { assignedTo: string | number | null; assignedToName: string } {
  const a = d.assignedTo as number | string | null | undefined
  if (a == null) return { assignedTo: null, assignedToName: '' }
  return { assignedTo: a, assignedToName: names.get(String(a)) || '' }
}

/*
 * Короткий кеш навколо найважчої частини відповіді: q — лише фільтр по вже
 * завантажених даних (нижче), а не параметр SQL-запиту, тож сам набір
 * items однаковий для будь-якого q і його можна ділити між усіма вкладками
 * й усіма співробітниками, які зараз дивляться робочий стіл. Без цього
 * кожна відкрита вкладка на кожному тику опитування била прямо в базу
 * своїм окремим запитом по п'яти колекціях одразу.
 */
let itemsCache: { items: Item[]; ts: number } | null = null
const ITEMS_CACHE_TTL_MS = 8000

async function loadAllItems(payload: Awaited<ReturnType<typeof getPayload>>): Promise<Item[]> {
  if (itemsCache && Date.now() - itemsCache.ts < ITEMS_CACHE_TTL_MS) return itemsCache.items

  const [evalRes, hotlineRes, bookingRes, recipientsRes, branchesRes] = await Promise.all([
    payload.find({ collection: 'eval-requests', limit: 200, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
    payload.find({ collection: 'hotline-chats', limit: 200, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
    payload.find({ collection: 'bookings', limit: 200, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
    payload.find({ collection: 'recipients', limit: 200, depth: 0, overrideAccess: true, pagination: false }),
    // branches.address — локалізоване поле; без явного locale Payload не гарантує, яку мову підставить.
    payload.find({ collection: 'branches', limit: 200, depth: 0, locale: 'uk', overrideAccess: true, pagination: false }),
  ])
  const names = new Map(
    recipientsRes.docs.map((r) => [String((r as { id: unknown }).id), String((r as { title?: string }).title || '')]),
  )
  const branchAddr = new Map(
    branchesRes.docs.map((b) => [String((b as { id: unknown }).id), String((b as { address?: string }).address || '')]),
  )

  const items: Item[] = []

  for (const raw of evalRes.docs) {
    const d = raw as Record<string, unknown>
    // Порожні чернетки з бота й приєднані дублі команді не показуємо зовсім.
    if (isEmptyEval(d) || d.mergedInto != null || d.transferredTo) continue
    const tAt = lastTransferInto(d, 'eval')?.at || null
    const unanswered = isUnanswered(d.thread, d.status, d.noReplyAt, d.createdAt, tAt)
    items.push({
      key: `eval:${d.id}`,
      kind: 'eval',
      channel: 'eval',
      id: d.id as string | number,
      title: String((d.title && d.title !== 'Без назви' ? d.title : '') || d.name || 'Заявка'),
      phone: String(d.phone || ''),
      status: String(d.status || 'new'),
      statusLabel: EVAL_STATUS[String(d.status)] || String(d.status || ''),
      snippet: lastThreadText(d.thread) || String(d.comment || [d.brand, d.model].filter(Boolean).join(' ')) || 'Заявка на оцінку',
      unread: isUnread(d.lastViewedAt, d.thread, d.createdAt, tAt),
      unanswered,
      waitingSince: waitingSinceOf(d.thread, d.createdAt, unanswered, tAt),
      firstReplyAt: firstReplyAtOf(d.thread, tAt),
      thanked: clientClosedConversation(d.thread),
      replyToEstimate: unanswered && !tAt && Number(d.estimate || 0) > 0 && Boolean(firstReplyAtOf(d.thread)),
      noReply: noReplyMarked(d.thread, d.noReplyAt, d.createdAt),
      updatedAt: String(d.updatedAt || d.createdAt || ''),
      createdAt: String(d.createdAt || ''),
      ...assignedFields(d, names),
      ...transferFields(d, 'eval'),
    })
  }

  for (const raw of hotlineRes.docs) {
    const d = raw as Record<string, unknown>
    // Натиснув «Гаряча лінія»/«Відгук», але нічого не написав — команді не показуємо.
    if (isEmptyHotline(d) || d.mergedInto != null || d.transferredTo) continue
    const isReview = d.kind === 'review'
    const tAt = lastTransferInto(d, isReview ? 'review' : 'hotline')?.at || null
    const unanswered = isUnanswered(d.thread, d.status, d.noReplyAt, d.createdAt, tAt)
    items.push({
      key: `hotline:${d.id}`,
      kind: 'hotline',
      channel: isReview ? 'review' : 'hotline',
      id: d.id as string | number,
      title: String(d.name || (isReview ? 'Відгук' : 'Гаряча лінія')),
      phone: String(d.phone || ''),
      status: String(d.status || 'new'),
      statusLabel: HOTLINE_STATUS[String(d.status)] || String(d.status || ''),
      snippet: lastThreadText(d.thread) || (isReview ? 'Відгук / скарга' : 'Гаряча лінія'),
      unread: isUnread(d.lastViewedAt, d.thread, d.createdAt, tAt),
      unanswered,
      waitingSince: waitingSinceOf(d.thread, d.createdAt, unanswered, tAt),
      firstReplyAt: firstReplyAtOf(d.thread, tAt),
      thanked: clientClosedConversation(d.thread),
      replyToEstimate: false,
      noReply: noReplyMarked(d.thread, d.noReplyAt, d.createdAt),
      updatedAt: String(d.updatedAt || d.createdAt || ''),
      createdAt: String(d.createdAt || ''),
      ...assignedFields(d, names),
      ...transferFields(d, 'hotline'),
    })
  }

  for (const raw of bookingRes.docs) {
    const d = raw as Record<string, unknown>
    const branchAddress = d.branch != null ? branchAddr.get(String(d.branch)) : ''
    const amount = Number(d.amount || 0).toLocaleString('uk-UA')
    items.push({
      key: `booking:${d.id}`,
      kind: 'booking',
      channel: 'booking',
      id: d.id as string | number,
      title: String(d.name || 'Бронь'),
      phone: String(d.phone || ''),
      status: String(d.status || 'new'),
      statusLabel: BOOKING_STATUS[String(d.status)] || String(d.status || ''),
      snippet: `Бронь ${amount} ₴${branchAddress ? ` · ${branchAddress}` : ''}`,
      // Бронь — не переписка: немає answeredBy/thread, тож ці позначки тут не застосовні.
      unread: false,
      unanswered: false,
      waitingSince: null,
      firstReplyAt: null,
      thanked: false,
      replyToEstimate: false,
      noReply: false,
      updatedAt: String(d.updatedAt || d.createdAt || ''),
      createdAt: String(d.createdAt || ''),
      ...assignedFields(d, names),
    })
  }

  // Сортуємо за тим, коли заявка надійшла, а не коли її востаннє
  // переглядали чи відповідали — інакше список стрибав би від власних дій.
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  // Статус з Оникса — одним запитом до нічного довідника на весь список, Оникс не чіпаємо.
  const clients = await onixClientsByPhones(payload, items.map((it) => it.phone))
  for (const it of items) {
    const c = clients.get(phone9(it.phone))
    it.client = c
      ? {
        tier: c.tier, tierLabel: c.tierLabel, discount: c.discount, fullName: c.fullName, people: c.people,
        networks: Array.from(new Set([c.primary, ...c.also].map((n) => n.networkLabel))),
      }
      : null
  }

  itemsCache = { items, ts: Date.now() }
  return items
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()

  const items = await loadAllItems(payload)

  /*
   * Телефон шукаємо за останніми дев'ятьма цифрами (як і всюди в проєкті,
   * див. normalizePhone) — інакше "0770770997" не знайшов би той самий
   * номер, збережений як "+380 77 077 09 97": з кодом країни рядок довший,
   * і жоден з них не є підрядком іншого при порівнянні «як є».
   */
  const qDigits = normalizePhone(q)
  const filtered = q
    ? items.filter((it) =>
        `${it.title} ${it.client?.fullName || ''} ${it.phone} ${it.snippet}`.toLowerCase().includes(q)
        || (qDigits.length >= 3 && normalizePhone(it.phone).includes(qDigits)))
    : items

  return Response.json({ me: { id: me.id, title: me.title }, items: filtered, version: process.env.BUILD_ID || '' })
}
