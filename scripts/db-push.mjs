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
 *
 * Синхронізація вміє мовчки нічого не зробити — так було з колонкою
 * coords_maps_url: скрипт відзвітував про успіх, а колонки в базі не з'явилось,
 * і бойовий сайт перестав читати відділення. Тому в кінці скрипт читає по
 * запису з кожної колекції: не збіглося — скаже одразу. Якщо синхронізація
 * знову нічого не зробить, колонку додають руками:
 *
 *     alter table site.branches add column if not exists coords_maps_url varchar;
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

// Куди саме йдемо. Без цього рядка легко прогнати синхронізацію по локальному
// файлу sqlite із .env, вирішити, що бойова база оновлена, — і зламати сайт.
const target = process.env.DATABASE_URL || process.env.DATABASE_URI || process.env.NETLIFY_DATABASE_URL || ''
const where = target.startsWith('postgres')
  ? `${target.replace(/\/\/[^@]*@/, '//***@').split('?')[0]}${process.env.DATABASE_SCHEMA ? ` · схема ${process.env.DATABASE_SCHEMA}` : ''}`
  : (target || 'локальна sqlite')
report.target = where
console.log(`· база: ${where}`)

try {
  report.step = 'завантаження конфігу'
  const { getPayload } = await import('payload')
  const config = (await import('../payload.config.ts')).default

  report.step = 'ініціалізація Payload'
  const payload = await getPayload({ config })

  report.step = 'перевірка таблиць'
  const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
  report.users = totalDocs

  // Синхронізація вміє мовчки нічого не зробити, і тоді код чекає на колонку,
  // якої в базі немає: вибірка падає вже на бойовому сайті. Тому одразу читаємо
  // по одному запису з кожної колекції — бракує колонки, побачимо це тут.
  report.step = 'читання колекцій'
  const broken = []
  for (const c of payload.config.collections || []) {
    try {
      await payload.find({ collection: c.slug, limit: 1, depth: 0, overrideAccess: true })
    } catch (e) {
      broken.push(`${c.slug}: ${(e?.message || String(e)).slice(0, 160)}`)
    }
  }
  if (broken.length) {
    report.broken = broken
    console.error('· схема НЕ збіглася з кодом:')
    for (const b of broken) console.error('   ', b)
    throw new Error(`колекції не читаються: ${broken.length}`)
  }

  report.step = 'готово'
  report.ok = true
  console.log(`· схема готова, колекцій перевірено: ${(payload.config.collections || []).length}, користувачів у базі: ${totalDocs}`)
} catch (e) {
  report.error = (e?.message || String(e)).slice(0, 400)
  console.error('· не вдалося синхронізувати схему:', report.error)
}

save()
process.exit(0)
