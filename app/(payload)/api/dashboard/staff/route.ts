import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'

/** Список співробітників для позначки «@Ім'я» в нотатках. */
export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const { docs } = await payload.find({
    collection: 'recipients', limit: 200, depth: 0, overrideAccess: true,
    where: { active: { equals: true } }, sort: 'title',
  })

  return Response.json({
    staff: docs.map((d) => ({ id: String(d.id), title: String((d as { title?: string }).title || '') })),
  })
}
