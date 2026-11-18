import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { templateText } from '@/lib/telegram.ts'

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return Response.json({ error: 'Потрібен вхід' }, { status: 401 })

  const { docs } = await payload.find({
    collection: 'reply-templates', limit: 100, depth: 0, overrideAccess: true, sort: 'order',
  })

  return Response.json({
    templates: docs.map((d) => ({
      code: String((d as { code?: string }).code || ''),
      title: String((d as { title?: string }).title || ''),
      text: String((d as { text?: string }).text || ''),
      // Готовий текст для заявки ТОП і для якої мережі шаблон — робочий стіл показує потрібний
      textTop: templateText(d as { text?: string; textTop?: string }, 'top'),
      networks: String((d as { networks?: string }).networks || 'all'),
    })),
  })
}
