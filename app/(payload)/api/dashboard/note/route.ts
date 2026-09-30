import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { esc, send } from '@/lib/telegram.ts'

const text = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const COLLECTION: Record<string, string> = { eval: 'eval-requests', hotline: 'hotline-chats' }
const LABEL: Record<string, string> = { eval: 'Оцінка', hotline: 'Гаряча лінія' }

/**
 * Нотатка команді — окремий канал від відповіді клієнту: інше поле бази,
 * інший маршрут на сервері. Технічно немає шляху, яким цей текст міг би
 * піти клієнту. Згаданих (mentions) сповіщаємо прямо в Telegram — це вже
 * перевірений, завжди робочий канал, на відміну від push.
 */
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
  const noteText = text(body.text, 2000)
  const mentionIds = Array.isArray(body.mentions) ? body.mentions.map((m) => String(m)).slice(0, 10) : []
  if (!id || !COLLECTION[kind] || !noteText) return Response.json({ error: 'Некоректні дані' }, { status: 422 })

  const collection = COLLECTION[kind]
  const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!doc) return Response.json({ error: 'Заявку не знайдено' }, { status: 404 })

  const notes = ((doc as { notes?: unknown[] }).notes || []) as unknown[]
  await payload.update({
    collection, id, overrideAccess: true,
    data: {
      notes: [...notes, { from: me.title, text: noteText, mentions: JSON.stringify(mentionIds), at: new Date().toISOString() }],
    },
  })

  if (mentionIds.length) {
    const { docs: mentioned } = await payload.find({
      collection: 'recipients', limit: 10, depth: 0, overrideAccess: true,
      where: { id: { in: mentionIds }, active: { equals: true } },
    })
    const msg = `🔔 <b>${esc(me.title)}</b> згадав(ла) вас у заявці №${id} (${esc(LABEL[kind])}):\n«${esc(noteText)}»`
    for (const r of mentioned) {
      const chat = String((r as { chatId?: string }).chatId || '')
      if (chat) await send({ chat, text: msg }).catch(() => {})
    }
  }

  return Response.json({ ok: true })
}
