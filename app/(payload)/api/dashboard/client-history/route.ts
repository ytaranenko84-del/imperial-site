import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { normalizePhone } from '@/lib/telegram.ts'
import { isEmptyEval } from '@/lib/evalFlow.ts'
import { onixClientByPhone } from '@/lib/onix.ts'
import { onixBails, onixCustomerName, onixHistoryEnabled, type HistoryBail } from '@/lib/onixHistory.ts'

/**
 * Історія клієнта для вікна «по натисканню на ім’я»: статус і мережі з нічного
 * довідника, останні застави — наживо з Оникса (лише читання, по 20), і всі
 * звернення до нас за цим номером. Бачать усі співробітники робочого столу.
 */

const PAGE = 20

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const url = new URL(req.url)
  const phone = String(url.searchParams.get('phone') || '').slice(0, 30)
  const offset = Math.max(0, Math.min(5000, Number(url.searchParams.get('offset')) || 0))
  const digits = normalizePhone(phone)
  if (!digits) return Response.json({ error: 'Немає телефону' }, { status: 422 })

  const client = await onixClientByPhone(payload, phone).catch(() => null)

  // Застави з усіх мереж клієнта, разом за датою; беремо з кожної стільки, щоб вистачило на сторінку.
  let bails: HistoryBail[] = []
  let name = ''
  let onixError = ''
  if (client && onixHistoryEnabled()) {
    try {
      const perNet = await Promise.all(client.networks.map((n) => onixBails(n.network, n.customerId, offset + PAGE + 1)))
      bails = perNet.flat().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      if (offset === 0) name = await onixCustomerName(client.networks[0].network, client.networks[0].customerId)
    } catch (e) {
      onixError = 'Оникс зараз не відповідає — спробуйте ще раз за хвилину'
      console.error('onix history', (e as Error).message)
    }
  }
  const page = bails.slice(offset, offset + PAGE)
  const hasMore = bails.length > offset + PAGE

  // Наші звернення за цим номером — лише на першій сторінці.
  type Ours = { key: string; channel: string; title: string; createdAt: string; status: string }
  const ours: Ours[] = []
  if (offset === 0) {
    const where = { phone: { contains: digits } }
    const [ev, ho, bo] = await Promise.all([
      payload.find({ collection: 'eval-requests', where, limit: 50, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
      payload.find({ collection: 'hotline-chats', where, limit: 50, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
      payload.find({ collection: 'bookings', where, limit: 50, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
    ])
    for (const r of ev.docs as Record<string, unknown>[]) {
      if (normalizePhone(r.phone) !== digits || isEmptyEval(r) || r.mergedInto != null) continue
      ours.push({ key: `eval:${r.id}`, channel: 'eval', title: [r.brand, r.model].filter(Boolean).join(' ') || String(r.title || 'Оцінка'), createdAt: String(r.createdAt || ''), status: String(r.status || '') })
    }
    for (const r of ho.docs as Record<string, unknown>[]) {
      if (normalizePhone(r.phone) !== digits || r.mergedInto != null) continue
      const review = r.kind === 'review'
      ours.push({ key: `hotline:${r.id}`, channel: review ? 'review' : 'hotline', title: review ? 'Відгук' : 'Гаряча лінія', createdAt: String(r.createdAt || ''), status: String(r.status || '') })
    }
    for (const r of bo.docs as Record<string, unknown>[]) {
      if (normalizePhone(r.phone) !== digits) continue
      ours.push({ key: `booking:${r.id}`, channel: 'booking', title: `Бронь ${Number(r.amount || 0).toLocaleString('uk-UA')} ₴`, createdAt: String(r.createdAt || ''), status: String(r.status || '') })
    }
    ours.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  return Response.json({
    phone,
    name,
    client,
    historyEnabled: onixHistoryEnabled(),
    onixError,
    bails: page,
    hasMore,
    nextOffset: offset + page.length,
    ours,
  })
}
