import { getPayload } from 'payload'
import config from '@payload-config'
import { clientIp, recordHit, tooManyRequests } from '@/lib/ratelimit.ts'

const text = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

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

  const notifyToken = text(body.token, 64)
  const sub = (body.subscription || {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  const endpoint = text(sub.endpoint, 500)
  const p256dh = text(sub.keys?.p256dh, 200)
  const auth = text(sub.keys?.auth, 200)
  const userAgent = text(body.userAgent, 200)

  if (!notifyToken || !endpoint || !p256dh || !auth) {
    return Response.json({ error: 'Некоректні дані підписки' }, { status: 422 })
  }

  const payload = await getPayload({ config })
  const ip = clientIp(req)
  const tooMany = await tooManyRequests(payload, 'push-subscribe', { ip }, { perIp: 10, perSite: 50 })
  if (tooMany) return Response.json({ error: tooMany }, { status: 429 })

  try {
    const { docs } = await payload.find({
      collection: 'recipients', limit: 1, depth: 0, overrideAccess: true,
      where: { notifyToken: { equals: notifyToken }, active: { equals: true } },
    })
    const recipient = docs[0]
    if (!recipient) return Response.json({ error: 'Посилання недійсне' }, { status: 404 })

    await recordHit(payload, 'push-subscribe', { ip })

    const data = { recipient: recipient.id, endpoint, p256dh, auth, userAgent }

    const existing = await payload.find({
      collection: 'push-subscriptions', limit: 1, depth: 0, overrideAccess: true,
      where: { endpoint: { equals: endpoint } },
    })

    if (existing.docs[0]) {
      await payload.update({ collection: 'push-subscriptions', id: existing.docs[0].id, data, overrideAccess: true })
    } else {
      await payload.create({ collection: 'push-subscriptions', data, overrideAccess: true })
    }

    return Response.json({ ok: true })
  } catch (e) {
    payload.logger.error({ err: e }, 'push subscribe failed')
    return Response.json({ error: 'Не вдалося зберегти підписку' }, { status: 500 })
  }
}
