import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { normalizePhone } from '@/lib/telegram.ts'

/** Єдина стрічка для робочого столу: оцінка + гаряча лінія + відгуки + бронь. */

const EVAL_STATUS: Record<string, string> = { new: 'Новий', work: 'В роботі', done: 'Оцінено', reject: 'Відмова' }
const HOTLINE_STATUS: Record<string, string> = { new: 'Нове', work: 'В роботі', done: 'Закрито' }
const BOOKING_STATUS: Record<string, string> = {
  new: 'Новий', came: 'Клієнт прийшов', done: 'Оформлено', missed: 'Не прийшов',
}

type Channel = 'eval' | 'hotline' | 'review' | 'booking' | 'incomplete'

/**
 * Клієнт натиснув «Оцінка» в боті, отримав інструкцію — і на цьому зупинився,
 * нічого не написавши. Записи не порожні в базі, але надсилати їх у Telegram
 * нема чого: recipientsFor тут ніколи не викликався. Показувати їх поруч зі
 * справжніми заявками на оцінку тільки заплутає — ховаємо в окремий розділ,
 * доки клієнт не допише опис чи не надішле фото (тоді сама впаде в «Оцінка»).
 */
function isIncompleteDraft(d: Record<string, unknown>): boolean {
  const photos = d.photos as unknown[] | undefined
  return d.source === 'bot' && d.category === 'other' && !d.comment && !(photos && photos.length)
}

type Item = {
  key: string
  kind: 'eval' | 'hotline' | 'booking'
  channel: Channel
  id: string | number
  title: string
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
 * «Не відповідані» — без окремого поля: останній запис у переписці не
 * належить тому, хто востаннє відповідав, тобто останнє слово за клієнтом.
 * Закрите чи відхилене вручну (без жодної відповіді — сміття, дублі тощо)
 * не має вічно висіти як «не відповідано»: рішення вже прийняте статусом.
 */
function isUnanswered(thread: unknown, answeredBy: unknown, status: unknown): boolean {
  if (status === 'done' || status === 'reject') return false
  const arr = Array.isArray(thread) ? thread : []
  if (!arr.length) return true
  const last = arr[arr.length - 1] as { from?: string }
  return String(last?.from || '') !== String(answeredBy || '')
}

/** Мить, відколи «тікає» таймер очікування — час останнього слова клієнта (чи створення, якщо переписки ще нема). */
function waitingSinceOf(thread: unknown, createdAt: unknown, unanswered: boolean): string | null {
  if (!unanswered) return null
  const t = lastThreadAt(thread, createdAt)
  return t ? new Date(t).toISOString() : null
}

/** «Непрочитане» — окреме від «не відповідано»: ніхто не відкривав відтоді, як з'явилось останнє повідомлення. */
function isUnread(lastViewedAt: unknown, thread: unknown, createdAt: unknown): boolean {
  const viewed = new Date(String(lastViewedAt || 0)).getTime()
  if (!lastViewedAt || !Number.isFinite(viewed)) return true
  return viewed < lastThreadAt(thread, createdAt)
}

function assignedFields(d: Record<string, unknown>): { assignedTo: string | number | null; assignedToName: string } {
  const a = d.assignedTo as { id?: unknown; title?: string } | number | string | null | undefined
  if (a && typeof a === 'object') return { assignedTo: (a.id as string | number) ?? null, assignedToName: a.title || '' }
  return { assignedTo: (a as string | number) ?? null, assignedToName: '' }
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()

  const [evalRes, hotlineRes, bookingRes] = await Promise.all([
    payload.find({ collection: 'eval-requests', limit: 200, depth: 1, overrideAccess: true, sort: '-createdAt' }),
    payload.find({ collection: 'hotline-chats', limit: 200, depth: 1, overrideAccess: true, sort: '-createdAt' }),
    payload.find({ collection: 'bookings', limit: 200, depth: 1, overrideAccess: true, sort: '-createdAt' }),
  ])

  const items: Item[] = []

  for (const raw of evalRes.docs) {
    const d = raw as Record<string, unknown>
    items.push({
      key: `eval:${d.id}`,
      kind: 'eval',
      channel: isIncompleteDraft(d) ? 'incomplete' : 'eval',
      id: d.id as string | number,
      title: String(d.title || d.name || 'Заявка'),
      phone: String(d.phone || ''),
      status: String(d.status || 'new'),
      statusLabel: EVAL_STATUS[String(d.status)] || String(d.status || ''),
      snippet: isIncompleteDraft(d)
        ? 'Клієнт ще не написав опис товару'
        : lastThreadText(d.thread) || String(d.comment || [d.brand, d.model].filter(Boolean).join(' ')) || 'Заявка на оцінку',
      // Незавершений чернетковий запис — нема чого «відповідати» чи «читати», доки клієнт нічого не написав.
      unread: isIncompleteDraft(d) ? false : isUnread(d.lastViewedAt, d.thread, d.createdAt),
      unanswered: isIncompleteDraft(d) ? false : isUnanswered(d.thread, d.answeredBy, d.status),
      waitingSince: isIncompleteDraft(d) ? null : waitingSinceOf(d.thread, d.createdAt, isUnanswered(d.thread, d.answeredBy, d.status)),
      updatedAt: String(d.updatedAt || d.createdAt || ''),
      createdAt: String(d.createdAt || ''),
      ...assignedFields(d),
    })
  }

  for (const raw of hotlineRes.docs) {
    const d = raw as Record<string, unknown>
    const isReview = d.kind === 'review'
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
      unread: isUnread(d.lastViewedAt, d.thread, d.createdAt),
      unanswered: isUnanswered(d.thread, d.answeredBy, d.status),
      waitingSince: waitingSinceOf(d.thread, d.createdAt, isUnanswered(d.thread, d.answeredBy, d.status)),
      updatedAt: String(d.updatedAt || d.createdAt || ''),
      createdAt: String(d.createdAt || ''),
      ...assignedFields(d),
    })
  }

  for (const raw of bookingRes.docs) {
    const d = raw as Record<string, unknown>
    const branch = d.branch as { address?: string } | null
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
      snippet: `Бронь ${amount} ₴${branch?.address ? ` · ${branch.address}` : ''}`,
      // Бронь — не переписка: немає answeredBy/thread, тож ці позначки тут не застосовні.
      unread: false,
      unanswered: false,
      waitingSince: null,
      updatedAt: String(d.updatedAt || d.createdAt || ''),
      createdAt: String(d.createdAt || ''),
      ...assignedFields(d),
    })
  }

  /*
   * Телефон шукаємо за останніми дев'ятьма цифрами (як і всюди в проєкті,
   * див. normalizePhone) — інакше "0770770997" не знайшов би той самий
   * номер, збережений як "+380 77 077 09 97": з кодом країни рядок довший,
   * і жоден з них не є підрядком іншого при порівнянні «як є».
   */
  const qDigits = normalizePhone(q)
  const filtered = q
    ? items.filter((it) =>
        `${it.title} ${it.phone} ${it.snippet}`.toLowerCase().includes(q)
        || (qDigits.length >= 3 && normalizePhone(it.phone).includes(qDigits)))
    : items

  // Сортуємо за тим, коли заявка надійшла, а не коли її востаннє
  // переглядали чи відповідали — інакше список стрибав би від власних дій.
  filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return Response.json({ me: { id: me.id, title: me.title }, items: filtered, version: process.env.BUILD_ID || '' })
}
