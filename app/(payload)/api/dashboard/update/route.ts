import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { tokenFromCookieHeader } from '@/lib/staffAuth.ts'

const text = (v: unknown, max = 40) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const EVAL_STATUSES = new Set(['new', 'work', 'done', 'reject'])
const HOTLINE_STATUSES = new Set(['new', 'work', 'done'])

/** Призначення «на себе» / зняття призначення і зміна статусу — без відповіді клієнту. */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, tokenFromCookieHeader(req.headers.get('cookie')))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати запит' }, { status: 400 })
  }

  const kind = text(body.kind, 20)
  const id = text(body.id, 40)
  if (!id || (kind !== 'eval' && kind !== 'hotline')) {
    return Response.json({ error: 'Некоректні дані' }, { status: 422 })
  }
  const collection = kind === 'eval' ? 'eval-requests' : 'hotline-chats'

  const data: Record<string, unknown> = {}

  if (body.assignedTo === 'me') data.assignedTo = me.id
  else if (body.assignedTo === 'none') data.assignedTo = null

  if (typeof body.status === 'string') {
    const allowed = kind === 'eval' ? EVAL_STATUSES : HOTLINE_STATUSES
    if (!allowed.has(body.status)) return Response.json({ error: 'Невірний статус' }, { status: 422 })
    data.status = body.status
  }

  if (!Object.keys(data).length) return Response.json({ error: 'Нема що змінювати' }, { status: 422 })

  const doc = await payload.update({ collection, id, overrideAccess: true, data }).catch(() => null)
  if (!doc) return Response.json({ error: 'Не знайдено' }, { status: 404 })

  return Response.json({ ok: true })
}
