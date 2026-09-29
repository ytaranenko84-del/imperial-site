import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Зберігає push-підписку телефону зі сторінки /notify/<токен>.
 * Токен звіряється з recipients.notifyToken — без нього чужий телефон
 * не зміг би підписатись на чиїсь заявки.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати запит' }, { status: 400 })
  }

  const notifyToken = typeof body.token === 'string' ? body.token : ''
  const sub = body.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined
  const userAgent = typeof body.userAgent === 'string' ? body.userAgent.slice(0, 200) : ''

  if (!notifyToken || !sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return Response.json({ error: 'Некоректні дані підписки' }, { status: 422 })
  }

  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'recipients', limit: 1, depth: 0, overrideAccess: true,
    where: { notifyToken: { equals: notifyToken }, active: { equals: true } },
  })
  const recipient = docs[0]
  if (!recipient) return Response.json({ error: 'Посилання недійсне' }, { status: 404 })

  const data = {
    recipient: recipient.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    userAgent,
  }

  const existing = await payload.find({
    collection: 'push-subscriptions', limit: 1, depth: 0, overrideAccess: true,
    where: { endpoint: { equals: sub.endpoint } },
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'push-subscriptions', id: existing.docs[0].id, data, overrideAccess: true,
    })
  } else {
    await payload.create({ collection: 'push-subscriptions', data, overrideAccess: true })
  }

  return Response.json({ ok: true })
}
