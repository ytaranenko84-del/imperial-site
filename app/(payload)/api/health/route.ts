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
  }

  try {
    const { getConnectionString } = await import('@netlify/database')
    const url = getConnectionString()
    report.netlifyDatabase = url ? 'підключення отримано' : 'пакет є, підключення порожнє'
  } catch (e) {
    report.netlifyDatabase = 'помилка: ' + (e as Error).message
  }

  try {
    const [{ getPayload }, config] = await Promise.all([
      import('payload'),
      import('@payload-config').then((m) => m.default),
    ])
    const payload = await getPayload({ config })
    report.payload = 'ініціалізовано'

    // Чи створені таблиці й чи є користувачі — саме тут ламається перший вхід
    try {
      const users = await payload.count({ collection: 'users', overrideAccess: true })
      report.users = users.totalDocs
      report.tables = 'створені'
    } catch (e) {
      report.ok = false
      report.tables = 'помилка запиту: ' + (e as Error).message.slice(0, 300)
    }
  } catch (e) {
    report.ok = false
    report.payload = 'помилка: ' + (e as Error).message.slice(0, 300)
  }

  return Response.json(report, { status: report.ok ? 200 : 500 })
}
