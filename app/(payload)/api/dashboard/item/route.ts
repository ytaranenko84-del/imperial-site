import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { mediaUrl, normalizePhone } from '@/lib/telegram.ts'
import { isEmptyEval } from '@/lib/evalFlow.ts'
import { onixClientWithLive } from '@/lib/onixHistory.ts'

const text = (v: unknown, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

type Related = { key: string; channel: string; title: string; createdAt: string; mergedInto?: number | null; transferredTo?: string }

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

  // Шукаємо за останніми 9 цифрами прямо в базі (contains), а не вичитуємо
  // по 300 рядків із трьох колекцій і фільтруємо в пам'яті на кожен клік —
  // це й було справжньою причиною затримки при відкритті картки.
  const where = { phone: { contains: digits } }
  const [evalRes, hotlineRes, bookingRes] = await Promise.all([
    payload.find({ collection: 'eval-requests', where, limit: 20, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
    payload.find({ collection: 'hotline-chats', where, limit: 20, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
    payload.find({ collection: 'bookings', where, limit: 20, depth: 0, overrideAccess: true, sort: '-createdAt', pagination: false }),
  ])

  const related: Related[] = []

  for (const raw of evalRes.docs) {
    const d = raw as Record<string, unknown>
    const key = `eval:${d.id}`
    if (key === excludeKey || normalizePhone(d.phone) !== digits || isEmptyEval(d)) continue
    related.push({
      key, channel: 'eval',
      title: [d.brand, d.model].filter(Boolean).join(' ') || (d.title && d.title !== 'Без назви' ? String(d.title) : 'Оцінка'),
      createdAt: String(d.createdAt || ''),
      mergedInto: (d.mergedInto as number | null | undefined) ?? null,
      transferredTo: String(d.transferredTo || ''),
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
      transferredTo: String(d.transferredTo || ''),
      mergedInto: (d.mergedInto as number | null | undefined) ?? null,
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

/*
 * «Прочитано» — одне поле. payload.update заради нього в транзакції видаляв і
 * заново вставляв усю переписку, нотатки й фото-зв'язки заявки: ~9 запитів
 * поспіль, кожен — рейс через Атлантику (функції в Огайо, база в Європі), тобто
 * ~0.8 с на кожне відкриття. До того ж перезапис переписки з прочитаної копії
 * міг загубити повідомлення клієнта, що прийшло в ту саму мить.
 * На Postgres — один прямий UPDATE; на локальній SQLite — як раніше.
 */
async function markViewed(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: 'eval-requests' | 'hotline-chats',
  id: string,
): Promise<void> {
  const db = payload.db as unknown as {
    name?: string
    schemaName?: string
    drizzle?: { execute: (query: unknown) => Promise<unknown> }
  }
  const numId = Number(id)
  if (db.name === 'postgres' && db.drizzle && Number.isInteger(numId)) {
    const table = collection === 'eval-requests' ? 'eval_requests' : 'hotline_chats'
    await db.drizzle.execute(
      sql`update ${sql.identifier(db.schemaName || 'public')}.${sql.identifier(table)} set last_viewed_at = now() where id = ${numId}`,
    )
    return
  }
  await payload.update({ collection, id, depth: 0, overrideAccess: true, data: { lastViewedAt: new Date().toISOString() } })
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
      client: await onixClientWithLive(payload, d.phone).catch(() => null),
    })
  }

  const collection = kind === 'eval' ? 'eval-requests' : 'hotline-chats'
  const key = `${kind}:${id}`
  // peek=1 — попереднє завантаження при наведенні: дані потрібні, а «прочитано» ще ні.
  const peek = url.searchParams.get('peek') === '1'

  // depth:0 — фото не розгортаються повними документами медіатеки (див. нижче).
  const [doc] = await Promise.all([
    payload.findByID({ collection, id, depth: 0, overrideAccess: true }).catch(() => null),
    peek ? null : markViewed(payload, collection, id).catch((e) => console.error('markViewed', e)),
  ])
  if (!doc) return Response.json({ error: 'Не знайдено' }, { status: 404 })

  const d = doc as Record<string, unknown>
  type ThreadRow = { from?: string; text?: string; at?: string; photo?: number | null; mergedFrom?: number | null }
  const threadRows = ((d.thread as ThreadRow[] | undefined) || [])
  // Фото, надіслані повідомленнями, показуємо в стрічці на своєму місці; решта — блоком згори.
  const inThread = new Set(threadRows.map((t) => t.photo).filter((x) => x != null).map(String))
  const photoIds = kind === 'eval'
    ? Array.from(new Set([...(((d.photos as (string | number)[] | undefined) || []).map(String)), ...inThread]))
    : Array.from(inThread)

  const [assignedToName, photoUrls, related, client] = await Promise.all([
    d.assignedTo != null
      ? payload.findByID({ collection: 'recipients', id: d.assignedTo as string | number, depth: 0, overrideAccess: true })
        .then((r) => (r as { title?: string }).title || '')
        .catch(() => '')
      : '',
    photoIds.length
      ? payload.find({
        collection: 'media', where: { id: { in: photoIds.map((x) => (/^\d+$/.test(x) ? Number(x) : x)) } }, limit: photoIds.length, depth: 0, overrideAccess: true, pagination: false,
      }).then((res) => new Map(res.docs
        .filter((m) => (m as unknown as { filename?: string }).filename)
        .map((m) => [String(m.id), mediaUrl(String((m as unknown as { filename?: string }).filename))])))
      : new Map<string, string>(),
    relatedByPhone(payload, String(d.phone || ''), key),
    onixClientWithLive(payload, d.phone).catch(() => null),
  ])

  return Response.json({
    key,
    kind,
    id,
    title: String(d.title || d.name || ''),
    name: String(d.name || ''),
    phone: String(d.phone || ''),
    status: String(d.status || 'new'),
    createdAt: String(d.createdAt || ''),
    clientChat: String(d.clientChat || ''),
    category: kind === 'eval' ? String(d.category || '') : String(d.kind || ''),
    brand: kind === 'eval' ? String(d.brand || '') : undefined,
    model: kind === 'eval' ? String(d.model || '') : undefined,
    comment: kind === 'eval' ? String(d.comment || '') : undefined,
    estimate: kind === 'eval' ? Number(d.estimate || 0) : undefined,
    photos: photoIds.filter((pid) => !inThread.has(pid)).map((pid) => photoUrls.get(pid)).filter(Boolean),
    assignedTo: (d.assignedTo as string | number | undefined) ?? null,
    assignedToName,
    answeredBy: String(d.answeredBy || ''),
    mergedInto: (d.mergedInto as number | null | undefined) ?? null,
    // журнал передач між відділами й куди передано (якщо це вже закрите «джерело»)
    transfers: Array.isArray(d.transfers) ? d.transfers : [],
    transferredTo: String(d.transferredTo || ''),
    thread: threadRows.map((t) => ({
      from: t.from, text: t.text, at: t.at,
      ...(t.photo != null && photoUrls.get(String(t.photo)) ? { photo: photoUrls.get(String(t.photo)) } : {}),
      ...(t.mergedFrom != null ? { mergedFrom: t.mergedFrom } : {}),
    })),
    notes: ((d.notes as { from?: string; text?: string; mentions?: string; at?: string }[] | undefined) || [])
      .map((n) => ({
        from: n.from, text: n.text, at: n.at,
        mentions: (() => { try { return JSON.parse(n.mentions || '[]') as string[] } catch { return [] } })(),
      })),
    related,
    client,
  })
}
