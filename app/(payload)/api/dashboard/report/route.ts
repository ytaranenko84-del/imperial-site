import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'

/**
 * Звіт «середній час відповіді / обʼєм по співробітниках» — лише для
 * адміністратора. Бронь сюди не входить: немає переписки й відповіді, тож
 * метрика відповіді до неї не застосовна.
 */

type ThreadEntry = { from?: string; at?: string }

function periodSince(period: string): string | null {
  if (period === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }
  if (period === 'week') return new Date(Date.now() - 7 * 24 * 3600_000).toISOString()
  if (period === 'month') return new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
  return null
}

/**
 * Той самий співробітник рахується по-різному залежно від каналу: з
 * робочого стола пишеться «Ім’я (робочий стіл)», з бота — telegram-ім’я.
 * Прибираємо хоча б цей суфікс, щоб відповіді з веба не плодили другий рядок.
 */
function normalizeStaffName(answeredBy: string): string {
  return answeredBy.replace(/\s*\(робочий стіл\)\s*$/i, '').trim() || answeredBy
}

function firstReplyMs(thread: unknown, createdAt: string): number | null {
  const arr = Array.isArray(thread) ? (thread as ThreadEntry[]) : []
  const firstStaff = arr.find((t) => t.from && t.from !== 'клієнт')
  if (!firstStaff?.at) return null
  const ms = new Date(firstStaff.at).getTime() - new Date(createdAt).getTime()
  return ms > 0 ? ms : null
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })
  if (me.kind !== 'admin') return Response.json({ error: 'Доступно лише адміністратору' }, { status: 403 })

  const url = new URL(req.url)
  const period = url.searchParams.get('period') || 'all'
  const since = periodSince(period)
  const where: Where = since ? { createdAt: { greater_than: since } } : {}

  const [evalRes, hotlineRes] = await Promise.all([
    payload.find({ collection: 'eval-requests', where, limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'hotline-chats', where, limit: 2000, depth: 0, overrideAccess: true }),
  ])
  const docs = [...evalRes.docs, ...hotlineRes.docs] as Record<string, unknown>[]

  let totalReplyMs = 0
  let totalReplied = 0
  const byStaff = new Map<string, { count: number; totalMs: number; withMs: number }>()

  for (const d of docs) {
    const answeredBy = String(d.answeredBy || '')
    if (!answeredBy) continue
    const key = normalizeStaffName(answeredBy)
    const entry = byStaff.get(key) || { count: 0, totalMs: 0, withMs: 0 }
    entry.count += 1
    const ms = firstReplyMs(d.thread, String(d.createdAt || ''))
    if (ms != null) {
      entry.totalMs += ms
      entry.withMs += 1
      totalReplyMs += ms
      totalReplied += 1
    }
    byStaff.set(key, entry)
  }

  const staff = [...byStaff.entries()]
    .map(([name, v]) => ({ name, count: v.count, avgReplyMs: v.withMs ? Math.round(v.totalMs / v.withMs) : null }))
    .sort((a, b) => b.count - a.count)

  return Response.json({
    total: docs.length,
    answered: docs.filter((d) => d.answeredBy).length,
    avgReplyMs: totalReplied ? Math.round(totalReplyMs / totalReplied) : null,
    staff,
  })
}
