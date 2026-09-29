import { getPayload } from 'payload'
import config from '@payload-config'
import { bookingCard, send, token as botToken } from '@/lib/telegram.ts'
import { clientIp, recordHit, tooManyRequests } from '@/lib/ratelimit.ts'

/**
 * Бронь суми: POST JSON із вікна на головній.
 *
 * Заявка завжди зберігається в адмінці. Якщо задано токен бота
 * (змінна TELEGRAM_BOT_TOKEN) — додатково йде і в чат відділення (якщо
 * підключений), і в загальний чат із налаштувань — одночасно, не одне
 * замість іншого: керівник бачить усі брони, навіть коли відділення вже
 * підключило власний номер. Немає токена — просто зберігаємо: жодна заявка
 * не губиться через мессенджер.
 */

const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const clean = (v: unknown, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0
}

/** Бронь діє добу, але не довше, ніж до закриття відділення того дня. */
function expiry(closeTime?: string | null, roundClock?: boolean): Date {
  const till = new Date(Date.now() + 24 * 3600_000)
  if (roundClock || !closeTime) return till
  const [h, m] = closeTime.split(':').map(Number)
  if (!Number.isFinite(h)) return till
  const end = new Date(till)
  end.setHours(h, m || 0, 0, 0)
  return end < till ? end : till
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати заявку' }, { status: 400 })
  }

  // приманка для роботів: лишаємо слід у логах, щоб не сплутати з тихо
  // втраченою справжньою заявкою (автозаповнення браузера теж сюди пише)
  if (text(body.company)) {
    console.warn('booking honeypot triggered', { hasName: Boolean(body.name), hasPhone: Boolean(body.phone) })
    return Response.json({ ok: true })
  }

  const name = text(body.name, 120)
  const phone = text(body.phone, 40)
  const branchId = text(body.branch, 40)

  if (!name || !phone) {
    return Response.json({ error: 'Заповніть ім’я і телефон' }, { status: 422 })
  }
  if (phone.replace(/\D/g, '').length < 9) {
    return Response.json({ error: 'Перевірте номер телефону' }, { status: 422 })
  }
  if (!branchId) {
    return Response.json({ error: 'Оберіть відділення' }, { status: 422 })
  }

  const payload = await getPayload({ config })
  const ip = clientIp(req)
  const tooMany = await tooManyRequests(payload, 'bookings', { phone, ip }, { perPhone: 5, perIp: 10, perSite: 30 })
  if (tooMany) return Response.json({ error: tooMany }, { status: 429 })
  await recordHit(payload, 'bookings', { phone, ip })

  try {
    const branch = await payload.findByID({
      collection: 'branches', id: branchId, depth: 0, overrideAccess: true,
    }).catch(() => null)

    if (!branch) return Response.json({ error: 'Відділення не знайдено' }, { status: 422 })

    const schedule = (branch.schedule || {}) as { closeTime?: string; roundClock?: boolean }
    const expiresAt = expiry(schedule.closeTime, schedule.roundClock)

    const amount = clean(body.amount, 10_000_000)
    const weight = clean(body.weight, 5000)
    const days = clean(body.days, 365)
    const purity = text(body.purity, 40)
    const tier = text(body.tier, 60)

    const doc = await payload.create({
      collection: 'bookings',
      overrideAccess: true,
      data: {
        name, phone, branch: branch.id, amount, weight, days, purity, tier,
        status: 'new', expiresAt: expiresAt.toISOString(),
      },
    })

    // ── повідомлення у чат(и): відділення й загальний — обидва, якщо задані ──
    let sent = 'вимкнено: немає токена бота'
    if (botToken()) {
      const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true })
      const branchChat = String((branch as { telegramChat?: string }).telegramChat || '')
      const defaultChat = String((settings as { telegramChatDefault?: string }).telegramChatDefault || '')
      const chats = [...new Set([branchChat, defaultChat].filter(Boolean))]

      if (!chats.length) {
        sent = 'чат не заданий'
      } else {
        const till = expiresAt.toLocaleString('uk-UA', {
          day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        })
        const message = bookingCard(
          { id: doc.id, amount, purity, weight, days, tier, name, phone },
          String(branch.address ?? ''),
          till,
        )

        const results = await Promise.all(chats.map(async (chat) => {
          try {
            await send({ chat, text: message })
            return true
          } catch (e) {
            // заявка вже збережена — мессенджер не має ламати бронь
            payload.logger.error({ err: e, chat }, 'booking telegram failed')
            return false
          }
        }))
        const ok = results.filter(Boolean).length
        sent = ok === chats.length
          ? `надіслано ${new Date().toLocaleString('uk-UA')}`
          : ok > 0
            ? `надіслано частково (${ok} з ${chats.length}), дивіться заявку в адмінці`
            : 'помилка надсилання, дивіться заявку в адмінці'
      }
      await payload.update({ collection: 'bookings', id: doc.id, data: { sent }, overrideAccess: true })
    }

    return Response.json({ ok: true, id: doc.id, expiresAt: expiresAt.toISOString() })
  } catch (e) {
    payload.logger.error({ err: e }, 'booking failed')
    return Response.json({ error: 'Не вдалося зберегти бронь. Зателефонуйте нам, будь ласка.' }, { status: 500 })
  }
}
