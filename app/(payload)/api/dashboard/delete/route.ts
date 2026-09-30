import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'

const text = (v: unknown, max = 40) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const COLLECTION: Record<string, string> = { eval: 'eval-requests', hotline: 'hotline-chats', booking: 'bookings' }

/**
 * Остаточне видалення заявки — лише для адміністратора. Перевірка ролі тут,
 * на сервері, а не тільки приховуванням кнопки: інакше будь-хто, знаючи
 * адресу запиту, міг би видалити заявку в обхід інтерфейсу.
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })
  if (me.kind !== 'admin') return Response.json({ error: 'Лише адміністратор може видаляти заявки' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати запит' }, { status: 400 })
  }

  const kind = text(body.kind, 20)
  const id = text(body.id, 40)
  if (!id || !COLLECTION[kind]) return Response.json({ error: 'Некоректні дані' }, { status: 422 })

  await payload.delete({ collection: COLLECTION[kind], id, overrideAccess: true }).catch(() => null)
  return Response.json({ ok: true })
}
