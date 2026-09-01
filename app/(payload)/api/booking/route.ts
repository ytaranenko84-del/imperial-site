import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Бронь суми: POST JSON із вікна на головній.
 *
 * Заявка завжди зберігається в адмінці. Якщо задано токен бота
 * (змінна TELEGRAM_BOT_TOKEN) — додатково йде у чат відділення, а коли той
 * не заданий — у загальний чат із налаштувань. Немає токена — просто
 * зберігаємо: жодна заявка не губиться через мессенджер.
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

async function notify(token: string, chat: string, message: string) {
  const [chatId, threadId] = chat.split(':')
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
    }),
  })
  if (!res.ok) throw new Error(`telegram ${res.status}`)
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати заявку' }, { status: 400 })
  }

  // приманка для роботів
  if (text(body.company)) return Response.json({ ok: true })

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

    // ── повідомлення у чат ──
    const token = process.env.TELEGRAM_BOT_TOKEN
    let sent = 'вимкнено: немає токена бота'
    if (token) {
      const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true })
      const chat = String((branch as { telegramChat?: string }).telegramChat
        || (settings as { telegramChatDefault?: string }).telegramChatDefault || '')

      if (!chat) {
        sent = 'чат не заданий'
      } else {
        const till = expiresAt.toLocaleString('uk-UA', {
          day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
        })
        const message = [
          `<b>Бронь №${doc.id}</b>`,
          `Сума: <b>${amount.toLocaleString('uk-UA')} грн</b>${purity ? ` · ${purity}` : ''}`
            + `${weight ? `, ${weight} г` : ''}${days ? `, ${days} дн.` : ''}`,
          tier ? `Статус: ${tier}` : '',
          `Клієнт: ${name}, ${phone}`,
          `Відділення: ${String(branch.address ?? '')}`,
          `Діє до: ${till}`,
        ].filter(Boolean).join('\n')

        try {
          await notify(token, chat, message)
          sent = `надіслано ${new Date().toLocaleString('uk-UA')}`
        } catch (e) {
          // заявка вже збережена — мессенджер не має ламати бронь
          payload.logger.error({ err: e }, 'booking telegram failed')
          sent = 'помилка надсилання, дивіться заявку в адмінці'
        }
      }
      await payload.update({ collection: 'bookings', id: doc.id, data: { sent }, overrideAccess: true })
    }

    return Response.json({ ok: true, id: doc.id, expiresAt: expiresAt.toISOString() })
  } catch (e) {
    payload.logger.error({ err: e }, 'booking failed')
    return Response.json({ error: 'Не вдалося зберегти бронь. Зателефонуйте нам, будь ласка.' }, { status: 500 })
  }
}
