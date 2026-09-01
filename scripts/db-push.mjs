/**
 * Створює структуру таблиць у базі під час збірки.
 *
 * Payload вміє синхронізувати схему сам, але робить це через drizzle-kit —
 * пакет із залежностей для розробки, якого немає в серверній збірці.
 * Тому схему створюємо на етапі збірки, коли всі пакети ще доступні.
 *
 * Скрипт не падає, якщо бази немає: локальна збірка має проходити
 * без жодних налаштувань.
 */
process.env.NODE_ENV = 'development' // інакше Payload пропускає синхронізацію схеми

const { resolveDatabaseUrl } = await import('../lib/db.ts').catch(() => ({ resolveDatabaseUrl: null }))

async function main() {
  let url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL
  if (!url) {
    try {
      const { getConnectionString } = await import('@netlify/database')
      url = getConnectionString()
    } catch {
      /* платформи немає — працюємо локально */
    }
  }

  if (!url) {
    console.log('· бази немає, синхронізацію схеми пропущено (локальна збірка)')
    return
  }

  process.env.DATABASE_URL = url

  const { getPayload } = await import('payload')
  const config = (await import('../payload.config.ts')).default

  console.log('· синхронізую схему бази…')
  const payload = await getPayload({ config })

  // перевіряємо, що таблиці справді створені
  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
  console.log(`· схема готова, користувачів у базі: ${totalDocs}`)

  if (typeof payload.db?.destroy === 'function') await payload.db.destroy()
}

main().catch((e) => {
  console.error('· не вдалося синхронізувати схему:', e.message)
  // Збірку не зупиняємо: сайт має зібратися навіть без бази,
  // інакше помилка підключення заблокує будь-який деплой.
  process.exit(0)
})
