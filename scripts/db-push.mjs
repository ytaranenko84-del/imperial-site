/**
 * Створює структуру таблиць у базі під час збірки.
 *
 * Payload синхронізує схему через drizzle-kit — пакет із залежностей для
 * розробки, якого немає в серверній збірці. Тому робимо це на етапі збірки,
 * коли всі пакети ще доступні.
 *
 * Результат пишеться у public/build-report.json, щоб причину збою було видно
 * без доступу до логів збірки.
 */
import fs from 'fs'
import path from 'path'

process.env.NODE_ENV = 'development' // інакше Payload пропускає синхронізацію схеми

const report = { at: new Date().toISOString(), step: 'початок', ok: false }

function save() {
  try {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync(path.join('public', 'build-report.json'), JSON.stringify(report, null, 1))
  } catch {
    /* якщо не вдалося записати — не привід зупиняти збірку */
  }
}

try {
  let url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL
  report.envUrl = Boolean(url)

  if (!url) {
    report.step = 'запит підключення у платформи'
    try {
      const { getConnectionString } = await import('@netlify/database')
      url = getConnectionString()
      report.platformUrl = Boolean(url)
    } catch (e) {
      report.platformError = e.message.slice(0, 200)
    }
  }

  if (!url) {
    report.step = 'бази немає — синхронізацію пропущено'
    report.ok = true
    console.log('· бази немає, синхронізацію схеми пропущено (локальна збірка)')
    save()
  } else {
    process.env.DATABASE_URL = url
    report.step = 'ініціалізація Payload'
    console.log('· синхронізую схему бази…')

    const { getPayload } = await import('payload')
    const config = (await import('../payload.config.ts')).default
    const payload = await getPayload({ config })

    report.step = 'перевірка таблиць'
    const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })

    report.users = totalDocs
    report.step = 'готово'
    report.ok = true
    console.log(`· схема готова, користувачів у базі: ${totalDocs}`)
    save()

    if (typeof payload.db?.destroy === 'function') await payload.db.destroy()
  }
} catch (e) {
  report.error = (e?.message || String(e)).slice(0, 500)
  report.stack = (e?.stack || '').split('\n').slice(0, 4).join(' | ').slice(0, 400)
  console.error('· не вдалося синхронізувати схему:', report.error)
  save()
}

// Збірку не зупиняємо: сайт має зібратися навіть без бази,
// інакше помилка підключення заблокує будь-який деплой.
process.exit(0)
