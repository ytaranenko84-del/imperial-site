import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { normalizePhone } from '@/lib/telegram.ts'

/**
 * «Приєднати сюди»: дубль тієї самої людини переноситься в основну заявку —
 * переписка за часом із позначкою «із заявки №…», фото, нотатки. Сам дубль
 * лишається як був, лише позначається mergedInto і зникає зі списку.
 */

const text = (v: unknown, max = 40) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, max) : '')
const COLLECTION: Record<string, 'eval-requests' | 'hotline-chats'> = { eval: 'eval-requests', hotline: 'hotline-chats' }

type Row = { from?: string; text?: string; at?: string; photo?: number | null; mergedFrom?: number | null }
type Note = { from?: string; text?: string; mentions?: string; at?: string }
type Doc = Record<string, unknown> & { id: number | string; thread?: Row[]; notes?: Note[] }

const byTime = <T extends { at?: string }>(a: T, b: T) => String(a.at || '').localeCompare(String(b.at || ''))
const clean = (r: Row): Row => ({
  from: r.from, text: r.text, at: r.at,
  ...(r.photo != null ? { photo: r.photo } : {}),
  ...(r.mergedFrom != null ? { mergedFrom: r.mergedFrom } : {}),
})
const empty = (v: unknown) => v == null || v === '' || v === 0

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Не вдалося прочитати запит' }, { status: 400 }) }

  const kind = text(body.kind, 20)
  const collection = COLLECTION[kind]
  const targetId = text(body.targetId)
  const sourceId = text(body.sourceId)
  if (!collection || !targetId || !sourceId || targetId === sourceId) {
    return Response.json({ error: 'Некоректні дані' }, { status: 422 })
  }

  const [target, source] = await Promise.all([
    payload.findByID({ collection, id: targetId, depth: 0, overrideAccess: true }).catch(() => null) as Promise<Doc | null>,
    payload.findByID({ collection, id: sourceId, depth: 0, overrideAccess: true }).catch(() => null) as Promise<Doc | null>,
  ])
  if (!target || !source) return Response.json({ error: 'Заявку не знайдено' }, { status: 404 })
  if (source.mergedInto != null) return Response.json({ error: `№${source.id} уже приєднана до №${source.mergedInto}` }, { status: 409 })
  if (target.mergedInto != null) return Response.json({ error: `№${target.id} сама приєднана до №${target.mergedInto}` }, { status: 409 })

  // Лише та сама людина: той самий номер або той самий Telegram-чат.
  const samePhone = normalizePhone(String(target.phone || '')) && normalizePhone(String(target.phone || '')) === normalizePhone(String(source.phone || ''))
  const sameChat = target.clientChat && target.clientChat === source.clientChat
  if (!samePhone && !sameChat) return Response.json({ error: 'Це заявки різних клієнтів' }, { status: 422 })

  const fromSource = (source.thread || []).map((r) => ({ ...clean(r), mergedFrom: Number(source.id) }))
  // Опис дубля — як перше слово клієнта в ньому, якщо в основній опис уже є.
  const sourceComment = String(source.comment || '').trim()
  if (kind === 'eval' && sourceComment && String(target.comment || '').trim()) {
    fromSource.unshift({ from: 'клієнт', text: sourceComment, at: String(source.createdAt || ''), mergedFrom: Number(source.id) })
  }
  const thread = [...(target.thread || []).map(clean), ...fromSource].sort(byTime)
  const notes = [...(target.notes || []), ...(source.notes || [])]
    .map((n) => ({ from: n.from, text: n.text, mentions: n.mentions, at: n.at }))
    .sort(byTime)

  const closed = (s: unknown) => s === 'done' || s === 'reject'
  const data: Record<string, unknown> = { thread, notes }
  if (closed(target.status) && !closed(source.status)) data.status = 'work'
  if (empty(target.assignedTo) && !empty(source.assignedTo)) data.assignedTo = source.assignedTo
  if (empty(target.clientChat) && !empty(source.clientChat)) data.clientChat = source.clientChat

  let movedPhotos = 0
  if (kind === 'eval') {
    const tPhotos = ((target.photos as (number | string)[] | undefined) || []).map(Number)
    const sPhotos = ((source.photos as (number | string)[] | undefined) || []).map(Number)
    const photos = Array.from(new Set([...tPhotos, ...sPhotos]))
    movedPhotos = photos.length - tPhotos.length
    data.photos = photos
    if (!String(target.comment || '').trim() && sourceComment) data.comment = sourceComment
    if (empty(target.estimate) && !empty(source.estimate)) data.estimate = source.estimate
    for (const f of ['brand', 'model', 'year']) if (empty(target[f]) && !empty(source[f])) data[f] = source[f]
    if ((target.category === 'other' || empty(target.category)) && !empty(source.category) && source.category !== 'other') {
      data.category = source.category
    }
  }

  await payload.update({ collection, id: target.id, overrideAccess: true, data, context: { skipGroupCard: true } })
  await payload.update({ collection, id: source.id, overrideAccess: true, data: { mergedInto: Number(target.id) }, context: { skipGroupCard: true } })

  return Response.json({
    ok: true,
    moved: { messages: fromSource.length, photos: movedPhotos, notes: (source.notes || []).length },
  })
}
