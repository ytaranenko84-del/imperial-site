import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { transferConversation, type Dept } from '@/lib/transfer.ts'

/**
 * «Передати в…»: звернення йде в інший відділ (оцінка / гаряча лінія /
 * відгуки). Передати може будь-який співробітник — див. lib/transfer.ts.
 */

const DEPTS: Dept[] = ['eval', 'hotline', 'review']

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { key?: unknown; to?: unknown; note?: unknown }
  const key = typeof body.key === 'string' ? body.key.slice(0, 40) : ''
  const to = DEPTS.find((d) => d === body.to)
  if (!/^(eval|hotline):[\w-]+$/.test(key) || !to) return Response.json({ error: 'Некоректні дані' }, { status: 422 })
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''

  try {
    const res = await transferConversation(payload, { key, to, note, by: String(me.title || 'співробітник') })
    return Response.json({ ok: true, ...res })
  } catch (e) {
    return Response.json({ error: (e as Error).message || 'Не вдалося передати' }, { status: 409 })
  }
}
