import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { mediaUrl, normalizePhone } from '@/lib/telegram.ts'

const text = (v: unknown, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

type Related = { key: string; channel: string; title: string; createdAt: string }

/**
 * Інші заявки того самого клієнта за номером телефону — щоб оцінювач бачив,
 * що людина вже зверталась, і не оцінював той самий товар вдруге наосліп.
 * Записи лишаються окремими (різні товари не змішуються в одну переписку) —
 * це просто підказка-посилання.
 */
async function relatedByPhone(
  payload: Awaited<ReturnType<typeof getPayload>>,
  phone: string,
  excludeKey: string,
): Promise<Related[]> {
  const digits = normalizePhone(phone)
  if (!digits) return []

  const [evalRes, hotlineRes, bookingRes] = await Promise.all([
    payload.find({ collection: 'eval-requests', limit: 300, depth: 0, overrideAccess: true, sort: '-createdAt' }),
    payload.find({ collection: 'hotline-chats', limit: 300, depth: 0, overrideAccess: true, sort: '-createdAt' }),
    payload.find({ collection: 'bookings', limit: 300, depth: 0, overrideAccess: true, sort: '-createdAt' }),
  ])

  const related: Related[] = []

  for (const raw of evalRes.docs) {
    const d = raw as Record<string, unknown>
    const key = `eval:${d.id}`
    if (key === excludeKey || normalizePhone(d.phone) !== digits) continue
    related.push({
      key, channel: 'eval',
      title: [d.brand, d.model].filter(Boolean).join(' ') || String(d.title || 'Заявка'),
      createdAt: String(d.createdAt || ''),
    })
  }

  for (const raw of hotlineRes.docs) {
    const d = raw as Record<string, unknown>
    const key = `hotline:${d.id}`
    if (key === excludeKey || normalizePhone(d.phone) !== digits) continue
    const isReview = d.kind === 'review'
    related.push({
      key, channel: isReview ? 'review' : 'hotline',
      title: isReview ? 'Відгук' : 'Гаряча лінія',
      createdAt: String(d.createdAt || ''),
    })
  }

  for (const raw of bookingRes.docs) {
    const d = raw as Record<string, unknown>
    const key = `booking:${d.id}`
    if (key === excludeKey || normalizePhone(d.phone) !== digits) continue
    const amount = Number(d.amount || 0).toLocaleString('uk-UA')
    related.push({ key, channel: 'booking', title: `Бронь ${amount} ₴`, createdAt: String(d.createdAt || '') })
  }

  related.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return related.slice(0, 10)
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const url = new URL(req.url)
  const kind = text(url.searchParams.get('kind'), 20)
  const id = text(url.searchParams.get('id'), 40)
  if (!id || !['eval', 'hotline', 'booking'].includes(kind)) {
    return Response.json({ error: 'Некоректні дані' }, { status: 422 })
  }

  if (kind === 'booking') {
    const doc = await payload.findByID({ collection: 'bookings', id, depth: 1, overrideAccess: true }).catch(() => null)
    if (!doc) return Response.json({ error: 'Не знайдено' }, { status: 404 })
    const d = doc as Record<string, unknown>
    const assigned = d.assignedTo as { id?: unknown; title?: string } | null | undefined
    const branch = d.branch as { address?: string } | null | undefined
    const key = `booking:${id}`
    return Response.json({
      key,
      kind: 'booking',
      id,
      title: String(d.title || d.name || ''),
      name: String(d.name || ''),
      phone: String(d.phone || ''),
      status: String(d.status || 'new'),
      amount: Number(d.amount || 0),
      purity: String(d.purity || ''),
      weight: Number(d.weight || 0),
      days: Number(d.days || 0),
      tier: String(d.tier || ''),
      branchName: branch?.address || '',
      expiresAt: String(d.expiresAt || ''),
      note: String(d.note || ''),
      assignedTo: (assigned?.id as string | number | undefined) ?? null,
      assignedToName: assigned?.title || '',
      related: await relatedByPhone(payload, String(d.phone || ''), key),
    })
  }

  const collection = kind === 'eval' ? 'eval-requests' : 'hotline-chats'
  const doc = await payload.findByID({ collection, id, depth: 1, overrideAccess: true }).catch(() => null)
  if (!doc) return Response.json({ error: 'Не знайдено' }, { status: 404 })

  // Відкрили картку — значить, хтось із команди її побачив: знімаємо «непрочитане».
  await payload.update({
    collection, id, overrideAccess: true, data: { lastViewedAt: new Date().toISOString() },
  }).catch(() => {})

  const d = doc as Record<string, unknown>
  const assigned = d.assignedTo as { id?: unknown; title?: string } | null | undefined
  const photos = kind === 'eval'
    ? ((d.photos as { filename?: string }[] | undefined) || [])
        .map((p) => (p?.filename ? mediaUrl(p.filename) : null))
        .filter(Boolean)
    : []
  const key = `${kind}:${id}`

  return Response.json({
    key,
    kind,
    id,
    title: String(d.title || d.name || ''),
    name: String(d.name || ''),
    phone: String(d.phone || ''),
    status: String(d.status || 'new'),
    clientChat: String(d.clientChat || ''),
    category: kind === 'eval' ? String(d.category || '') : String(d.kind || ''),
    brand: kind === 'eval' ? String(d.brand || '') : undefined,
    model: kind === 'eval' ? String(d.model || '') : undefined,
    comment: kind === 'eval' ? String(d.comment || '') : undefined,
    estimate: kind === 'eval' ? Number(d.estimate || 0) : undefined,
    photos,
    assignedTo: (assigned?.id as string | number | undefined) ?? null,
    assignedToName: assigned?.title || '',
    answeredBy: String(d.answeredBy || ''),
    thread: (d.thread as { from?: string; text?: string; at?: string }[] | undefined) || [],
    notes: ((d.notes as { from?: string; text?: string; mentions?: string; at?: string }[] | undefined) || [])
      .map((n) => ({
        from: n.from, text: n.text, at: n.at,
        mentions: (() => { try { return JSON.parse(n.mentions || '[]') as string[] } catch { return [] } })(),
      })),
    related: await relatedByPhone(payload, String(d.phone || ''), key),
  })
}
