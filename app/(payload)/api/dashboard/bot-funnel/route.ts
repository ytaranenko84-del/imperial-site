import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'

/**
 * Воронка бота — лише для адміністратора. На відміну від заявок, тут
 * рахуємо не документи, а унікальних співрозмовників (chatId) на кожному
 * кроці: старт → пункт меню → номер телефону → доведено до кінця.
 */

function periodSince(period: string): string | null {
  if (period === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (period === 'week') return new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
  if (period === 'month') return new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
  return null
}

type Event = { chatId?: string; eventType?: string; payload?: string }

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })
  if (me.kind !== 'admin') return Response.json({ error: 'Доступно лише адміністратору' }, { status: 403 })

  const url = new URL(req.url)
  const period = url.searchParams.get('period') || 'week'
  const since = periodSince(period)

  // Співробітники теж тицяють кнопки меню в цьому самому боті — виключаємо
  // їхні чати зі статистики клієнтської воронки.
  const staffRes = await payload.find({
    collection: 'recipients', limit: 500, depth: 0, overrideAccess: true,
    where: { chatId: { exists: true } },
  })
  const staffChatIds = new Set(
    staffRes.docs.map((d) => String((d as { chatId?: string }).chatId || '')).filter(Boolean),
  )

  const where: Where = since ? { createdAt: { greater_than: since } } : {}
  const { docs } = await payload.find({
    collection: 'bot-events', where, limit: 20000, depth: 0, overrideAccess: true, sort: '-createdAt',
  })

  const events = (docs as Event[]).filter((d) => d.chatId && !staffChatIds.has(d.chatId))

  const distinctByType = (type: string) =>
    new Set(events.filter((d) => d.eventType === type).map((d) => d.chatId)).size

  const menuBreakdown = new Map<string, Set<string>>()
  for (const d of events) {
    if (d.eventType !== 'menu_click' || !d.payload || !d.chatId) continue
    if (!menuBreakdown.has(d.payload)) menuBreakdown.set(d.payload, new Set())
    menuBreakdown.get(d.payload)!.add(d.chatId)
  }
  const byMenu = [...menuBreakdown.entries()]
    .map(([intent, chats]) => ({ intent, count: chats.size }))
    .sort((a, b) => b.count - a.count)

  // «Отримав персональне посилання після заявки з сайту, але не почав діалог
  // у боті» — видно вже з наявних даних, без жодної нової події.
  const evalWhere: Where = since
    ? { and: [{ source: { not_equals: 'bot' } }, { createdAt: { greater_than: since } }] }
    : { source: { not_equals: 'bot' } }
  const evalRes = await payload.find({
    collection: 'eval-requests', where: evalWhere, limit: 5000, depth: 0, overrideAccess: true,
  })
  const gotLinkNotStarted = (evalRes.docs as { clientKey?: string; clientChat?: string }[])
    .filter((d) => d.clientKey && !d.clientChat).length

  return Response.json({
    start: distinctByType('start'),
    menuClick: distinctByType('menu_click'),
    contactShared: distinctByType('contact_shared'),
    formCompleted: distinctByType('form_completed'),
    byMenu,
    gotLinkNotStarted,
  })
}
