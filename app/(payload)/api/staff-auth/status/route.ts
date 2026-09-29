import { getPayload } from 'payload'
import config from '@payload-config'
import {
  createSessionToken, readCookie, sessionCookieHeader, VERIFIER_COOKIE, verifierMatches,
} from '@/lib/staffAuth.ts'

const TTL_MS = 10 * 60 * 1000

/** Сторінка входу опитує це кожні кілька секунд, поки хтось не натисне кнопку в боті. */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати запит' }, { status: 400 })
  }
  const tokenValue = typeof body.token === 'string' ? body.token.trim() : ''
  if (!tokenValue) return Response.json({ error: 'Немає токена' }, { status: 400 })

  const verifier = readCookie(req.headers.get('cookie'), VERIFIER_COOKIE)

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'staff-logins', limit: 1, depth: 1, overrideAccess: true,
    where: { token: { equals: tokenValue } },
  })
  const login = docs[0] as {
    id: string | number
    status?: string
    recipient?: { id?: unknown; title?: string } | number
    verifier?: string
    createdAt?: string
  } | undefined

  if (!login) return Response.json({ error: 'Посилання недійсне' }, { status: 404 })
  if (!verifierMatches(login.verifier, verifier)) {
    return Response.json({ error: 'Сесію запитано з іншого браузера' }, { status: 403 })
  }
  if (Date.now() - new Date(login.createdAt || 0).getTime() > TTL_MS) {
    return Response.json({ error: 'Посилання застаріле' }, { status: 410 })
  }
  if (login.status !== 'confirmed' || !login.recipient) return Response.json({ pending: true })

  const recipientId = typeof login.recipient === 'object' ? String(login.recipient.id) : String(login.recipient)
  const title = typeof login.recipient === 'object' ? String(login.recipient.title || '') : ''

  // Одноразово: щойно сесію видано, той самий токен більше нічого не відкриває.
  await payload.update({ collection: 'staff-logins', id: login.id, overrideAccess: true, data: { status: 'used' } })

  return Response.json({ ok: true, title }, {
    headers: { 'set-cookie': sessionCookieHeader(createSessionToken(recipientId)) },
  })
}
