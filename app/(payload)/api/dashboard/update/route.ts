import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'

const text = (v: unknown, max = 40) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const STATUSES: Record<string, Set<string>> = {
  eval: new Set(['new', 'work', 'done', 'reject']),
  hotline: new Set(['new', 'work', 'done']),
  booking: new Set(['new', 'came', 'done', 'missed']),
}
const COLLECTION: Record<string, string> = { eval: 'eval-requests', hotline: 'hotline-chats', booking: 'bookings' }

/** Призначення «на себе» / зняття призначення і зміна статусу — без відповіді клієнту. */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати запит' }, { status: 400 })
  }

  const kind = text(body.kind, 20)
  const id = text(body.id, 40)
  if (!id || !COLLECTION[kind]) {
    return Response.json({ error: 'Некоректні дані' }, { status: 422 })
  }
  const collection = COLLECTION[kind]

  const data: Record<string, unknown> = {}

  if (body.assignedTo === 'me') data.assignedTo = me.id
  else if (body.assignedTo === 'none') data.assignedTo = null

  if (typeof body.status === 'string') {
    if (!STATUSES[kind].has(body.status)) return Response.json({ error: 'Невірний статус' }, { status: 422 })
    data.status = body.status
  }

  if (!Object.keys(data).length) return Response.json({ error: 'Нема що змінювати' }, { status: 422 })

  const doc = await payload.update({ collection, id, overrideAccess: true, data }).catch(() => null)
  if (!doc) return Response.json({ error: 'Не знайдено' }, { status: 404 })

  return Response.json({ ok: true })
}
