import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { esc, hotlineRecipients, recipientsFor, resolveTemplate, send, sumFromText } from '@/lib/telegram.ts'
import { sendSms } from '@/lib/sms.ts'

/**
 * Відповідь клієнту з веб-робочого столу — той самий канал доставки
 * (Telegram чи SMS-резерв), що й відповідь із самого бота, просто інша
 * «дверцята» для введення тексту. Логіка шаблону й розпізнавання суми —
 * спільна функція з lib/telegram.ts, щоб не розходитись поведінкою.
 */

const text = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати запит' }, { status: 400 })
  }

  const kind = text(body.kind, 20)
  const id = text(body.id, 40)
  const raw = text(body.text, 4000)
  if (!id || (kind !== 'eval' && kind !== 'hotline') || !raw) {
    return Response.json({ error: 'Некоректні дані' }, { status: 422 })
  }

  const collection = kind === 'eval' ? 'eval-requests' : 'hotline-chats'
  const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!doc) return Response.json({ error: 'Заявку не знайдено' }, { status: 404 })

  const resolved = await resolveTemplate(payload, raw)
  if ('warn' in resolved) return Response.json({ warn: resolved.warn })
  const replyText = resolved.text

  const clientChat = String((doc as { clientChat?: string }).clientChat || '')
  const phone = String((doc as { phone?: string }).phone || '')
  const thread = ((doc as { thread?: unknown[] }).thread || []) as unknown[]
  const who = `${me.title} (робочий стіл)`

  let deliveredVia: 'telegram' | 'sms' | 'none' = 'none'
  let deliveryNote = ''

  if (clientChat) {
    await send({ chat: clientChat, text: `<b>Ломбард «Імперіал»</b>\n${esc(replyText)}` })
    deliveredVia = 'telegram'
  } else if (kind === 'eval' && phone) {
    // SMS-резерв поки лише для заявок на оцінку — так само, як і в боті.
    try {
      await sendSms(phone, replyText)
      deliveredVia = 'sms'
    } catch (e) {
      deliveryNote = (e as Error).message || 'помилка SMS'
    }
  }

  const now = new Date().toISOString()
  const data: Record<string, unknown> = {
    status: 'work',
    answeredBy: who,
    answeredAt: now,
    // Хто відповідає — той і бачив заявку, тож заразом знімаємо «непрочитане».
    lastViewedAt: now,
    thread: [...thread, { from: who, text: replyText, at: now }],
  }

  if (kind === 'eval') {
    const already = Number((doc as { estimate?: number }).estimate || 0)
    const own = [doc.brand, doc.model, doc.year].filter(Boolean).join(' ')
    const sum = sumFromText(replyText, own, { requireCurrency: already > 0 })
    if (sum != null && sum !== already) data.estimate = sum
  }

  await payload.update({ collection, id, overrideAccess: true, data })

  // Копія іншим отримувачам заявки — щоб і в Telegram було видно, що вже відповіли.
  const others = kind === 'eval'
    ? await recipientsFor(payload, String((doc as { category?: string }).category || ''))
    : await hotlineRecipients(payload)
  for (const chat of others.keys()) {
    await send({
      chat,
      text: `<b>Заявка №${id}</b> · ${esc(who)} відповів:\n${esc(replyText)}`,
    }).catch(() => {})
  }

  return Response.json({ ok: true, deliveredVia, deliveryNote, text: replyText })
}
