import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { tokenFromCookieHeader } from '@/lib/staffAuth.ts'

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, tokenFromCookieHeader(req.headers.get('cookie')))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const { docs } = await payload.find({
    collection: 'reply-templates', limit: 100, depth: 0, overrideAccess: true, sort: 'order',
  })

  return Response.json({
    templates: docs.map((d) => ({
      code: String((d as { code?: string }).code || ''),
      title: String((d as { title?: string }).title || ''),
      text: String((d as { text?: string }).text || ''),
    })),
  })
}
