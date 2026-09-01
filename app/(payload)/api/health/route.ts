/**
 * Діагностика середовища. Показує, що бачить застосунок на сервері,
 * не розкриваючи самих значень. Потрібно, щоб не гадати про причину помилок.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const report: Record<string, unknown> = {
    ok: true,
    node: process.version,
    hasPayloadSecret: Boolean(process.env.PAYLOAD_SECRET),
    serverUrl: process.env.NEXT_PUBLIC_SERVER_URL || null,
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      NETLIFY_DATABASE_URL: Boolean(process.env.NETLIFY_DATABASE_URL),
      NETLIFY_DATABASE_URL_UNPOOLED: Boolean(process.env.NETLIFY_DATABASE_URL_UNPOOLED),
      NETLIFY: process.env.NETLIFY || null,
      CONTEXT: process.env.CONTEXT || null,
    },
  }

  // чи віддає платформа підключення до бази
  try {
    const { getConnectionString } = await import('@netlify/database')
    const url = getConnectionString()
    report.netlifyDatabase = url ? 'підключення отримано' : 'пакет є, підключення порожнє'
    report.driver = url ? new URL(url).protocol.replace(':', '') : null
  } catch (e) {
    report.netlifyDatabase = 'помилка: ' + (e as Error).message
  }

  // чи стартує Payload
  try {
    const [{ getPayload }, config] = await Promise.all([
      import('payload'),
      import('@payload-config').then((m) => m.default),
    ])
    const payload = await getPayload({ config })
    report.payload = 'ініціалізовано'
    report.collections = Object.keys(payload.collections)
  } catch (e) {
    report.ok = false
    report.payload = 'помилка: ' + (e as Error).message
  }

  return Response.json(report, { status: report.ok ? 200 : 500 })
}
