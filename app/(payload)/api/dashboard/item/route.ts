import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { mediaUrl } from '@/lib/telegram.ts'

const text = (v: unknown, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const url = new URL(req.url)
  const kind = text(url.searchParams.get('kind'), 20)
  const id = text(url.searchParams.get('id'), 40)
  if (!id || (kind !== 'eval' && kind !== 'hotline')) {
    return Response.json({ error: 'Некоректні дані' }, { status: 422 })
  }

  const collection = kind === 'eval' ? 'eval-requests' : 'hotline-chats'
  const doc = await payload.findByID({ collection, id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!doc) return Response.json({ error: 'Не знайдено' }, { status: 404 })

  const d = doc as Record<string, unknown>
  const assigned = d.assignedTo as { id?: unknown; title?: string } | null | undefined
  const photos = kind === 'eval'
    ? ((d.photos as { filename?: string }[] | undefined) || [])
        .map((p) => (p?.filename ? mediaUrl(p.filename) : null))
        .filter(Boolean)
    : []

  return Response.json({
    key: `${kind}:${id}`,
    kind,
    id,
    title: String(d.title || d.name || ''),
    name: String(d.name || ''),
    phone: String(d.phone || ''),
    status: String(d.status || 'new'),
    clientChat: String(d.clientChat || ''),
    category: kind === 'eval' ? String(d.category || '') : String(d.kind || ''),
    brand: kind === 'eval' ? String(d.brand || '') : undefined,
    model: kind === 'eval' ? String(d.model || '') : undefined,
    comment: kind === 'eval' ? String(d.comment || '') : undefined,
    estimate: kind === 'eval' ? Number(d.estimate || 0) : undefined,
    photos,
    assignedTo: (assigned?.id as string | number | undefined) ?? null,
    assignedToName: assigned?.title || '',
    answeredBy: String(d.answeredBy || ''),
    thread: (d.thread as { from?: string; text?: string; at?: string }[] | undefined) || [],
  })
}
