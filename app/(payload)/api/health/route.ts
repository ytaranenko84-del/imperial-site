/**
 * Діагностика середовища: до якої бази підключений сайт, чи створені таблиці.
 *
 * Подробиці показуються лише співробітнику, який увійшов в адмінку.
 * Стороннім — самий факт, що застосунок відповідає: вузол бази, назва схеми
 * й тексти помилок підказують зловмиснику, куди дивитися.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const report: Record<string, unknown> = { ok: true }

  let user: unknown = null
  let payload: Awaited<ReturnType<typeof import('payload')['getPayload']>> | null = null

  try {
    const [{ getPayload }, config] = await Promise.all([
      import('payload'),
      import('@payload-config').then((m) => m.default),
    ])
    payload = await getPayload({ config })
    user = (await payload.auth({ headers: req.headers })).user
  } catch {
    // не змогли навіть підняти застосунок — стороннім про це знати не треба
    return Response.json({ ok: false }, { status: 500 })
  }

  if (!user) return Response.json(report)

  report.node = process.version
  report.hasPayloadSecret = Boolean(process.env.PAYLOAD_SECRET)
  report.serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || null

  // куди насправді ходить сайт: пароль не показуємо, лише вузол і схему
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || ''
  report.database = !url
    ? 'DATABASE_URL не задано'
    : (() => {
        try {
          return new URL(url).host + ' · схема ' + (process.env.DATABASE_SCHEMA || 'public')
        } catch {
          return 'адреса непридатна для розбору'
        }
      })()

  try {
    const users = await payload.count({ collection: 'users', overrideAccess: true })
    report.users = users.totalDocs
    report.tables = 'створені'
  } catch (e) {
    report.ok = false
    report.tables = 'помилка запиту: ' + (e as Error).message.slice(0, 300)
  }

  return Response.json(report)
}
