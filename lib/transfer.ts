import type { Payload } from 'payload'
import { evalCard, esc, hotlineCard, hotlineRecipients, recipientsFor, send } from './telegram.ts'
import { notifyRecipients } from './push.ts'
import { onixClientInfo } from './onix.ts'

/**
 * Передача звернення між відділами: оцінка ↔ гаряча лінія ↔ відгуки.
 *
 * Клієнт написав «не туди» (у боті натиснув не ту кнопку чи на сайті обрав не
 * ту форму) — співробітник з робочого столу передає звернення потрібному
 * відділу. Для нового відділу воно виглядає як щойно отримане: нове,
 * непрочитане, без виконавця й без відповіді, але з усією перепискою й фото.
 *
 * Гаряча лінія ↔ відгуки — та сама таблиця, тож міняється лише відділ (номер
 * лишається). Оцінка — окрема таблиця з іншими полями, тож там створюється
 * нова заявка з повною перепискою, а стара закривається з посиланням на неї
 * (transferredTo) і зникає зі списків. Клієнту бот сам пише, куди передали.
 */

export type Dept = 'eval' | 'hotline' | 'review'

export const DEPT_LABEL: Record<Dept, string> = { eval: 'Оцінка', hotline: 'Гаряча лінія', review: 'Відгуки' }
export const DEPT_FROM: Record<Dept, string> = { eval: 'з оцінки', hotline: 'з гарячої лінії', review: 'з відгуків' }

/** Що бот пише клієнту одразу після передачі. */
export const CLIENT_NOTICE: Record<Dept, string> = {
  eval: 'Ваше питання передали оцінювачу — він відповість тут, у цьому чаті. Нічого повторювати не потрібно 🙂',
  hotline: 'Ваше питання передали на гарячу лінію — колеги відповідять тут, у цьому чаті. Нічого повторювати не потрібно 🙂',
  review: 'Ваше повідомлення передали відповідальним за відгуки та скарги — вам відповідять тут, у цьому чаті. Нічого повторювати не потрібно 🙂',
}

export type TransferEntry = { from: Dept; to: Dept; by: string; note: string; at: string; fromKey: string }

type Entry = { from?: string; text?: string; at?: string; photo?: number | null; mergedFrom?: number | null }
type Doc = Record<string, unknown> & { id: number | string }

export function transfersOf(d: Record<string, unknown>): TransferEntry[] {
  return Array.isArray(d.transfers) ? (d.transfers as TransferEntry[]) : []
}

/** Остання передача саме в цей відділ — від неї рахуємо «непрочитане/без відповіді» нового відділу. */
export function lastTransferInto(d: Record<string, unknown>, dept: Dept): TransferEntry | null {
  const list = transfersOf(d)
  const last = list[list.length - 1]
  return last && last.to === dept ? last : null
}

export function deptOf(kind: 'eval' | 'hotline', d: Record<string, unknown>): Dept {
  if (kind === 'eval') return 'eval'
  return d.kind === 'review' ? 'review' : 'hotline'
}

const keyOf = (dept: Dept, id: number | string) => `${dept === 'eval' ? 'eval' : 'hotline'}:${id}`

function cleanEntry(t: Entry): Entry {
  return {
    from: t.from, text: t.text, at: t.at,
    ...(t.photo != null ? { photo: Number(t.photo) } : {}),
    ...(t.mergedFrom != null ? { mergedFrom: Number(t.mergedFrom) } : {}),
  }
}

/**
 * Переписка для нової заявки. З оцінки беремо ще й опис та фото, які клієнт
 * додав формою (вони не в переписці) — інакше гаряча лінія їх би не побачила.
 */
function threadForTarget(src: Doc, fromDept: Dept): Entry[] {
  const thread = ((src.thread as Entry[] | undefined) || []).map(cleanEntry)
  if (fromDept !== 'eval') return thread
  const created = String(src.createdAt || new Date().toISOString())
  const extra: Entry[] = []
  const item = [src.brand, src.model, src.year, src.condition].filter(Boolean).join(', ')
  const comment = String(src.comment || '').trim()
  const desc = [item, comment].filter(Boolean).join('\n')
  if (desc && !thread.some((t) => t.from === 'клієнт' && String(t.text || '').trim() === comment)) {
    extra.push({ from: 'клієнт', text: desc, at: created })
  }
  const inThread = new Set(thread.map((t) => t.photo).filter((p) => p != null).map(String))
  for (const p of ((src.photos as (number | string)[] | undefined) || [])) {
    const id = typeof p === 'object' && p ? Number((p as { id?: unknown }).id) : Number(p)
    if (Number.isFinite(id) && !inThread.has(String(id))) extra.push({ from: 'клієнт', text: '📷 фото', at: created, photo: id })
  }
  return [...extra, ...thread].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
}

/** Текст клієнта для картки новому відділу: останні його повідомлення. */
function clientTextFor(thread: Entry[]): string {
  const own = thread.filter((t) => t.from === 'клієнт' && t.text && t.text !== '📷 фото').map((t) => String(t.text))
  const text = own.slice(-3).join('\n')
  return text.length > 700 ? `${text.slice(0, 700)}…` : text
}

export type TransferResult = { key: string; clientNotified: boolean; clientInBot: boolean }

export async function transferConversation(
  payload: Payload,
  opts: { key: string; to: Dept; note: string; by: string },
): Promise<TransferResult> {
  const [kind, rawId] = opts.key.split(':')
  if ((kind !== 'eval' && kind !== 'hotline') || !rawId) throw new Error('Некоректне звернення')
  const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId
  const collection = kind === 'eval' ? 'eval-requests' : 'hotline-chats'
  const src = await payload.findByID({ collection, id, depth: 0, overrideAccess: true }).catch(() => null) as Doc | null
  if (!src) throw new Error('Звернення не знайдено')
  if (src.transferredTo) throw new Error('Це звернення вже передано')
  if (src.mergedInto != null) throw new Error('Звернення приєднане до іншого — передавайте те, куди його приєднали')

  const from = deptOf(kind, src)
  const to = opts.to
  if (from === to) throw new Error('Звернення вже в цьому відділі')

  const now = new Date().toISOString()
  const entry: TransferEntry = { from, to, by: opts.by, note: opts.note.slice(0, 300), at: now, fromKey: opts.key }
  const transfers = [...transfersOf(src), entry]
  const clientChat = String(src.clientChat || '')
  // Для нового відділу — як щойно отримане: нове, нічиє, непрочитане
  const fresh = { status: 'new', assignedTo: null, lastViewedAt: null, noReplyAt: null }

  let target: Doc
  if (from !== 'eval' && to !== 'eval') {
    // Гаряча лінія ↔ відгуки: той самий запис, міняється лише відділ
    target = await payload.update({
      collection: 'hotline-chats', id: src.id, overrideAccess: true,
      data: { kind: to, ...fresh, transfers },
    }) as unknown as Doc
  } else {
    const thread = threadForTarget(src, from)
    if (to === 'eval') {
      target = await payload.create({
        collection: 'eval-requests', overrideAccess: true, context: { skipGroupCard: true },
        data: {
          // «Інше» — бачать усі оцінювачі
          category: 'other',
          source: clientChat ? 'bot' : 'site',
          name: String(src.name || '').trim() || 'Клієнт',
          phone: String(src.phone || '').trim() || '—',
          ...(clientChat ? { clientChat } : {}),
          status: 'new',
          thread,
          photos: thread.map((t) => t.photo).filter((p): p is number => p != null),
          notes: (src.notes as unknown[] | undefined) || [],
          transfers,
        } as never,
      }) as unknown as Doc
    } else {
      target = await payload.create({
        collection: 'hotline-chats', overrideAccess: true,
        data: {
          kind: to,
          status: 'new',
          name: String(src.name || ''),
          phone: String(src.phone || ''),
          ...(clientChat ? { clientChat } : {}),
          thread,
          notes: (src.notes as unknown[] | undefined) || [],
          transfers,
        } as never,
      }) as unknown as Doc
    }
    const targetKey = keyOf(to, target.id)
    await payload.update({
      collection, id: src.id, overrideAccess: true, context: { skipGroupCard: true },
      // Гаряча лінія закривається («Закрито»). Статус оцінки не чіпаємо — «Оцінено» було б неправдою;
      // з маршрутизації бота й зі списків її прибирає transferredTo.
      data: { ...(kind === 'hotline' ? { status: 'done' } : {}), transferredTo: targetKey, transfers } as never,
    })
  }

  const newKey = keyOf(to, target.id)

  // Новому відділу — картка в Telegram і push, як на нове звернення
  const thread = ((target.thread as Entry[] | undefined) || [])
  const onix = await onixClientInfo(payload, target.phone).catch(() => ({ fullName: '', line: '' }))
  const head = `📨 <b>Передано ${DEPT_FROM[from]}</b> · ${esc(opts.by)}${entry.note ? `\n«${esc(entry.note)}»` : ''}\n\n`
  const photos = thread.filter((t) => t.photo != null).length
  const tail = photos ? `\n📷 Фото: ${photos} — у робочому столі` : ''
  const name = onix.fullName || String(target.name || '')
  const chats = to === 'eval' ? await recipientsFor(payload, 'other') : await hotlineRecipients(payload)
  const card = to === 'eval'
    ? evalCard({ ...target, name, comment: clientTextFor(thread) }, { clientInBot: Boolean(clientChat), clientLine: onix.line })
    : hotlineCard({ id: target.id, name, phone: target.phone }, clientTextFor(thread), to === 'review' ? 'Відгук' : 'Гаряча лінія', onix.line)
  for (const chat of chats.keys()) await send({ chat, text: head + card + tail }).catch(() => {})
  await notifyRecipients(payload, chats, {
    title: `Передано: ${DEPT_LABEL[from]} → ${DEPT_LABEL[to]}`,
    body: entry.note || clientTextFor(thread).slice(0, 120) || name,
  }).catch(() => {})

  let clientNotified = false
  if (clientChat) {
    clientNotified = await send({ chat: clientChat, text: CLIENT_NOTICE[to] }).then(() => true).catch(() => false)
  }
  return { key: newKey, clientNotified, clientInBot: Boolean(clientChat) }
}

/**
 * Відповідь Reply на стару картку вже переданого звернення: куди воно поїхало.
 * Іде ланцюжком (могли передати кілька разів), не далі 5 кроків.
 */
export async function followTransfer(payload: Payload, kind: 'eval' | 'hotline', id: number): Promise<{ kind: 'eval' | 'hotline'; id: number; dept: Dept } | null> {
  let cur: { kind: 'eval' | 'hotline'; id: number } = { kind, id }
  let moved = false
  for (let i = 0; i < 5; i++) {
    const d = await payload.findByID({
      collection: cur.kind === 'eval' ? 'eval-requests' : 'hotline-chats', id: cur.id, depth: 0, overrideAccess: true,
    }).catch(() => null) as Doc | null
    if (!d) return null
    const next = String(d.transferredTo || '')
    if (!next) return moved ? { ...cur, dept: deptOf(cur.kind, d) } : null
    const [k, n] = next.split(':')
    cur = { kind: k === 'eval' ? 'eval' : 'hotline', id: Number(n) }
    moved = true
  }
  return null
}
