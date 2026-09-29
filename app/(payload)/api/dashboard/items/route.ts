import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { tokenFromCookieHeader } from '@/lib/staffAuth.ts'

/** Єдина стрічка для робочого столу: заявки на оцінку + гаряча лінія в одному списку. */

const EVAL_STATUS: Record<string, string> = { new: 'Новий', work: 'В роботі', done: 'Оцінено', reject: 'Відмова' }
const HOTLINE_STATUS: Record<string, string> = { new: 'Нове', work: 'В роботі', done: 'Закрито' }

type Item = {
  key: string
  kind: 'eval' | 'hotline'
  id: string | number
  title: string
  phone: string
  status: string
  statusLabel: string
  snippet: string
  assignedTo: string | number | null
  assignedToName: string
  updatedAt: string
  createdAt: string
}

function lastThreadText(thread: unknown): string {
  const arr = Array.isArray(thread) ? thread : []
  const last = arr[arr.length - 1] as { text?: string } | undefined
  return String(last?.text || '').slice(0, 160)
}

function assignedFields(d: Record<string, unknown>): { assignedTo: string | number | null; assignedToName: string } {
  const a = d.assignedTo as { id?: unknown; title?: string } | number | string | null | undefined
  if (a && typeof a === 'object') return { assignedTo: (a.id as string | number) ?? null, assignedToName: a.title || '' }
  return { assignedTo: (a as string | number) ?? null, assignedToName: '' }
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, tokenFromCookieHeader(req.headers.get('cookie')))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()

  const [evalRes, hotlineRes] = await Promise.all([
    payload.find({ collection: 'eval-requests', limit: 200, depth: 1, overrideAccess: true, sort: '-updatedAt' }),
    payload.find({ collection: 'hotline-chats', limit: 200, depth: 1, overrideAccess: true, sort: '-updatedAt' }),
  ])

  const items: Item[] = []

  for (const raw of evalRes.docs) {
    const d = raw as Record<string, unknown>
    items.push({
      key: `eval:${d.id}`,
      kind: 'eval',
      id: d.id as string | number,
      title: String(d.title || d.name || 'Заявка'),
      phone: String(d.phone || ''),
      status: String(d.status || 'new'),
      statusLabel: EVAL_STATUS[String(d.status)] || String(d.status || ''),
      snippet: lastThreadText(d.thread) || String(d.comment || [d.brand, d.model].filter(Boolean).join(' ')) || 'Заявка на оцінку',
      updatedAt: String(d.updatedAt || d.createdAt || ''),
      createdAt: String(d.createdAt || ''),
      ...assignedFields(d),
    })
  }

  for (const raw of hotlineRes.docs) {
    const d = raw as Record<string, unknown>
    items.push({
      key: `hotline:${d.id}`,
      kind: 'hotline',
      id: d.id as string | number,
      title: String(d.name || (d.kind === 'review' ? 'Відгук' : 'Гаряча лінія')),
      phone: String(d.phone || ''),
      status: String(d.status || 'new'),
      statusLabel: HOTLINE_STATUS[String(d.status)] || String(d.status || ''),
      snippet: lastThreadText(d.thread) || (d.kind === 'review' ? 'Відгук / скарга' : 'Гаряча лінія'),
      updatedAt: String(d.updatedAt || d.createdAt || ''),
      createdAt: String(d.createdAt || ''),
      ...assignedFields(d),
    })
  }

  const filtered = q
    ? items.filter((it) => `${it.title} ${it.phone} ${it.snippet}`.toLowerCase().includes(q))
    : items

  filtered.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

  return Response.json({ me: { id: me.id, title: me.title }, items: filtered })
}
