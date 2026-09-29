import { getPayload } from 'payload'
import config from '@payload-config'
import { randomBytes, randomInt } from 'node:crypto'
import { clientIp, recordHit, tooManyRequests } from '@/lib/ratelimit.ts'
import { verifierCookieHeader } from '@/lib/staffAuth.ts'

/**
 * Початок входу на робочий стіл: створює одноразовий токен, код підтвердження
 * і посилання на бота. Код (не сам токен) — те, що зупиняє фішинг: сторінка
 * показує його тут, бот — у своєму повідомленні, і підтверджувати можна лише
 * коли вони збігаються. Verifier у cookie додатково прив'язує сесію саме до
 * цього браузера, а не до будь-кого, хто підгледів токен із посилання.
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const ip = clientIp(req)
  const tooMany = await tooManyRequests(payload, 'staff-login', { ip }, { perIp: 20, perSite: 200 })
  if (tooMany) return Response.json({ error: tooMany }, { status: 429 })
  await recordHit(payload, 'staff-login', { ip })

  const tokenValue = randomBytes(16).toString('hex')
  const verifier = randomBytes(16).toString('hex')
  const code = String(randomInt(0, 10000)).padStart(4, '0')

  await payload.create({
    collection: 'staff-logins', overrideAccess: true,
    data: {
      token: tokenValue, status: 'pending', code, verifier,
      ip, userAgent: (req.headers.get('user-agent') || '').slice(0, 200),
    },
  })

  const bot = await payload
    .findGlobal({ slug: 'settings', overrideAccess: true })
    .then((s) => String((s as { botUsername?: string }).botUsername || ''))
    .catch(() => '')

  return Response.json(
    {
      token: tokenValue,
      code,
      botLink: bot ? `https://t.me/${bot}?start=login_${tokenValue}` : null,
    },
    { headers: { 'set-cookie': verifierCookieHeader(verifier) } },
  )
}
