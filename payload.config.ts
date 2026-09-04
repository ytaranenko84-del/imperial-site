import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { uk } from '@payloadcms/translations/languages/uk'
import { ru } from '@payloadcms/translations/languages/ru'
import sharp from 'sharp'

import { Tariffs } from './collections/Tariffs.ts'
import { RateTiers } from './collections/RateTiers.ts'
import { LoyaltyTiers } from './collections/LoyaltyTiers.ts'
import { Cities } from './collections/Cities.ts'
import { Branches } from './collections/Branches.ts'
import { EvalRequests } from './collections/EvalRequests.ts'
import { Bookings } from './collections/Bookings.ts'
import { Recipients } from './collections/Recipients.ts'
import { News } from './collections/News.ts'
import { Media } from './collections/Media.ts'
import { Users } from './collections/Users.ts'
import { Settings } from './collections/Settings.ts'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Вибір бази за середовищем:
 *   заданий DATABASE_URL → він (свій сервер, Supabase тощо)
 *   платформа віддає підключення → воно
 *   інакше → локальний файл SQLite, без жодних установок
 *
 * Логіка навмисно тут, а не в окремому модулі: конфіг вантажиться і збірником,
 * і чистим Node у скриптах, а вони по-різному шукають файли без розширення.
 */
async function resolveDatabaseUrl(): Promise<string | null> {
  const manual =
    process.env.DATABASE_URL ||
    // те саме під іншою звичною назвою: щоб не ловити годину через одну літеру
    (process.env.DATABASE_URI?.startsWith('postgres') ? process.env.DATABASE_URI : '') ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED
  if (manual) return manual

  try {
    const { getConnectionString } = await import('@netlify/database')
    const url = getConnectionString()
    if (url) return url
  } catch {
    // платформи немає — працюємо на SQLite
  }
  return null
}

const databaseURL = await resolveDatabaseUrl()

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · Імперіал' },
    components: {
      // подвійний клац по рядку відкриває запис
      providers: ['/components/admin/RowEdit#default'],
      // сторінка зміни пароля схована під аватаром — виносимо в меню
      afterNavLinks: ['/components/admin/AccountLink#default'],
    },
  },
  collections: [Tariffs, RateTiers, LoyaltyTiers, Cities, Branches, Bookings, EvalRequests, Recipients, News, Media, Users],
  globals: [Settings],
  // GraphQL сайт не використовує, а відкритий /api/graphql видає стороннім
  // повну схему даних. Вимикаємо разом з нею.
  graphQL: { disable: true },
  // Українська — основна мова (розділ 18 ТЗ)
  localization: {
    locales: [
      { label: 'Українська', code: 'uk' },
      { label: 'Русский', code: 'ru' },
    ],
    defaultLocale: 'uk',
    fallback: true,
  },
  // Інтерфейс адмінпанелі лише українською та російською (розділ 22 ТЗ).
  // Без обмеження списку браузер може попросити англійську.
  i18n: {
    fallbackLanguage: 'uk',
    supportedLanguages: { uk, ru },
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  /**
   * Світлини із заявок зберігаються в сховищі Supabase, а не на диску:
   * сайт працює функціями, і файлова система в них лише для читання —
   * саме тому заявка з фото падала на бойовому сервері.
   *
   * Без ключів плагін не вмикається, і на своєму комп'ютері файли, як
   * і раніше, лягають у public/media.
   */
  plugins: process.env.S3_ACCESS_KEY_ID
    ? [
        s3Storage({
          collections: { media: true },
          bucket: process.env.S3_BUCKET || 'site-media',
          config: {
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION || 'eu-west-1',
            forcePathStyle: true,
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
            },
          },
        }),
      ]
    : [],
  db: databaseURL
    ? postgresAdapter({
        /**
         * Кожен запит сайту виконує окрема функція, і кожна тримає своє
         * підключення. Сесійний пул Supabase дає лише 15 — вони закінчувались,
         * і сайт падав із «max clients reached». Тому: транзакційний пул
         * (порт 6543) у DATABASE_URL і не більш як одне підключення на
         * примірник; після запиту воно швидко звільняється.
         */
        pool: {
          connectionString: databaseURL,
          // Сторінка робить кілька запитів одночасно, тож одного підключення
          // мало: вони стають у чергу й не дочікуються. П'ять вистачає
          // сторінці й лишає запас транзакційному пулу.
          max: 5,
          idleTimeoutMillis: 20_000,
          connectionTimeoutMillis: 15_000,
        },
        // Схема потрібна лише тоді, коли база спільна з іншими сервісами.
        // Для власної бази Netlify залишається public.
        ...(process.env.DATABASE_SCHEMA ? { schemaName: process.env.DATABASE_SCHEMA } : {}),
        push: true,
      })
    : sqliteAdapter({
        client: { url: process.env.DATABASE_URI || 'file:./imperial.db' },
      }),
  sharp,
})
