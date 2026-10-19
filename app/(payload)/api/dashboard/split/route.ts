import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'

/**
 * «Виділити в нову заявку»: клієнт заговорив про іншу річ у старій розмові.
 * Позначені повідомлення (разом із їхніми фото) й окремо позначені фото з
 * блоку згори переїжджають у нову заявку того самого клієнта.
 */

type Row = { from?: string; text?: string; at?: string; photo?: number | null; mergedFrom?: number | null }

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return Response.json({ error: 'Не вдалося прочитати запит' }, { status: 400 }) }

  const id = String(body.id ?? '').slice(0, 40)
  const entryIdx = new Set((Array.isArray(body.entries) ? body.entries : []).map(Number).filter(Number.isInteger))
  const photoUrls = new Set((Array.isArray(body.photoUrls) ? body.photoUrls : []).map(String))
  if (!id || (!entryIdx.size && !photoUrls.size)) return Response.json({ error: 'Нічого не вибрано' }, { status: 422 })

  const doc = await payload.findByID({ collection: 'eval-requests', id, depth: 0, overrideAccess: true }).catch(() => null) as
    (Record<string, unknown> & { id: number; thread?: Row[]; photos?: (number | string)[] }) | null
  if (!doc) return Response.json({ error: 'Заявку не знайдено' }, { status: 404 })

  const thread = doc.thread || []
  const photos = (doc.photos || []).map(Number)

  // Фото з блоку згори приходять адресами — зіставляємо з id через медіатеку.
  let pickedTopPhotos: number[] = []
  if (photoUrls.size && photos.length) {
    const { mediaUrl } = await import('@/lib/telegram.ts')
    const media = await payload.find({
      collection: 'media', where: { id: { in: photos } }, limit: photos.length, depth: 0, overrideAccess: true, pagination: false,
    })
    pickedTopPhotos = media.docs
      .filter((m) => photoUrls.has(mediaUrl(String((m as unknown as { filename?: string }).filename || ''))))
      .map((m) => Number(m.id))
  }

  const moved = thread.filter((_, i) => entryIdx.has(i))
  const kept = thread.filter((_, i) => !entryIdx.has(i))
  const movedPhotoIds = new Set([...pickedTopPhotos, ...moved.map((r) => r.photo).filter((p): p is number => p != null).map(Number)])
  if (!moved.length && !movedPhotoIds.size) return Response.json({ error: 'Нічого не вибрано' }, { status: 422 })

  const created = await payload.create({
    collection: 'eval-requests', overrideAccess: true,
    data: {
      category: 'other',
      source: doc.source || 'bot',
      clientChat: doc.clientChat || '',
      name: doc.name || 'клієнт',
      phone: doc.phone || '',
      status: 'new',
      comment: '',
      photos: Array.from(movedPhotoIds),
      thread: moved.map((r) => ({ from: r.from, text: r.text, at: r.at, ...(r.photo != null ? { photo: r.photo } : {}) })),
    },
  })

  await payload.update({
    collection: 'eval-requests', id: doc.id, overrideAccess: true, context: { skipGroupCard: true },
    data: {
      thread: kept.map((r) => ({
        from: r.from, text: r.text, at: r.at,
        ...(r.photo != null ? { photo: r.photo } : {}),
        ...(r.mergedFrom != null ? { mergedFrom: r.mergedFrom } : {}),
      })),
      photos: photos.filter((p) => !movedPhotoIds.has(p)),
    },
  })

  return Response.json({ ok: true, key: `eval:${created.id}`, id: created.id })
}
