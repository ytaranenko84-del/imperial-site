import { getPayload } from 'payload'
import config from '@payload-config'
import { createSessionToken, sessionCookieHeader } from '@/lib/staffAuth.ts'

/** Сторінка входу опитує це кожні кілька секунд, поки хтось не натисне кнопку в боті. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const tokenValue = (url.searchParams.get('token') || '').trim()
  if (!tokenValue) return Response.json({ error: 'Немає токена' }, { status: 400 })

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'staff-logins', limit: 1, depth: 1, overrideAccess: true,
    where: { token: { equals: tokenValue } },
  })
  const login = docs[0] as { status?: string; recipient?: { id?: unknown; title?: string } | number } | undefined

  if (!login) return Response.json({ error: 'Посилання недійсне' }, { status: 404 })
  if (login.status !== 'confirmed' || !login.recipient) return Response.json({ pending: true })

  const recipientId = typeof login.recipient === 'object' ? String(login.recipient.id) : String(login.recipient)
  const title = typeof login.recipient === 'object' ? String(login.recipient.title || '') : ''

  return Response.json({ ok: true, title }, {
    headers: { 'set-cookie': sessionCookieHeader(createSessionToken(recipientId)) },
  })
}
