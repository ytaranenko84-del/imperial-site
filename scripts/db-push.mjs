/**
 * Синхронізація схеми бази під поточні колекції.
 *
 * ЗАПУСКАЄТЬСЯ ВРУЧНУ, не під час збірки:
 *
 *     DATABASE_URL=... DATABASE_SCHEMA=site npm run db:push
 *
 * Причина: коли з'являється нова таблиця, колонка чи тип, синхронізація
 * питає в консолі, чи це перейменування старої. Питання читає клавіатуру
 * напряму, тож ні перенаправлення, ні `yes` його не проходять — на сервері
 * збірки процес просто зависає, а деплой мовчки лишається на старій версії.
 * Саме через це чотири сторінки категорій не виїжджали на сайт.
 *
 * Порядок при зміні колекцій: спершу прогнати цей скрипт на бойовій базі
 * з відповідями, і лише потім відправляти код.
 */
/**
 * Створює структуру таблиць у базі під час збірки.
 *
 * Payload синхронізує схему через drizzle-kit — пакет із залежностей для
 * розробки, якого немає в серверній збірці. Тому робимо це на етапі збірки.
 *
 * Запускається звичайним Node: він читає TypeScript напряму, а імпорти
 * в конфізі вказані з розширеннями, щоб резолвились без збірника.
 *
 * Звіт пишеться у public/build-report.json — логи збірки ззовні недоступні.
 */
import fs from 'fs'
import path from 'path'

process.env.NODE_ENV = 'development' // інакше Payload пропускає синхронізацію схеми

const report = { at: new Date().toISOString(), step: 'початок', ok: false }
const save = () => {
  try {
    fs.mkdirSync('public', { recursive: true })
    fs.writeFileSync(path.join('public', 'build-report.json'), JSON.stringify(report, null, 1))
  } catch { /* не привід зупиняти збірку */ }
}

try {
  report.step = 'завантаження конфігу'
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config.ts')).default

  report.step = 'ініціалізація Payload'
  const payload = await getPayload({ config })

  report.step = 'перевірка таблиць'
  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
  report.users = totalDocs
  report.step = 'готово'
  report.ok = true
  console.log(`· схема готова, користувачів у базі: ${totalDocs}`)
} catch (e) {
  report.error = (e?.message || String(e)).slice(0, 400)
  console.error('· не вдалося синхронізувати схему:', report.error)
}

save()
process.exit(0)
