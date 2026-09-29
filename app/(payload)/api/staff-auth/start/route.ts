import { getPayload } from 'payload'
import config from '@payload-config'
import { randomBytes } from 'node:crypto'
import { clientIp, recordHit, tooManyRequests } from '@/lib/ratelimit.ts'

/**
 * Початок входу на робочий стіл: створює одноразовий токен і посилання
 * на бота. Сторінка після цього опитує /status, поки хтось не підтвердить
 * вхід кнопкою в Telegram.
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const ip = clientIp(req)
  const tooMany = await tooManyRequests(payload, 'staff-login', { ip }, { perIp: 20, perSite: 200 })
  if (tooMany) return Response.json({ error: tooMany }, { status: 429 })
  await recordHit(payload, 'staff-login', { ip })

  const tokenValue = randomBytes(16).toString('hex')
  await payload.create({
    collection: 'staff-logins', overrideAccess: true,
    data: { token: tokenValue, status: 'pending' },
  })

  const bot = await payload
    .findGlobal({ slug: 'settings', overrideAccess: true })
    .then((s) => String((s as { botUsername?: string }).botUsername || ''))
    .catch(() => '')

  return Response.json({
    token: tokenValue,
    botLink: bot ? `https://t.me/${bot}?start=login_${tokenValue}` : null,
  })
}
