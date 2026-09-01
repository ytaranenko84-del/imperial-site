import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { uk } from '@payloadcms/translations/languages/uk'
import { ru } from '@payloadcms/translations/languages/ru'

import { Tariffs } from './collections/Tariffs'
import { RateTiers } from './collections/RateTiers'
import { LoyaltyTiers } from './collections/LoyaltyTiers'
import { Cities } from './collections/Cities'
import { Branches } from './collections/Branches'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { Settings } from './collections/Settings'

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
  },
  collections: [Tariffs, RateTiers, LoyaltyTiers, Cities, Branches, Media, Users],
  globals: [Settings],
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
  db: databaseURL
    ? postgresAdapter({
        pool: { connectionString: databaseURL },
        // Схема потрібна лише тоді, коли база спільна з іншими сервісами.
        // Для власної бази Netlify залишається public.
        ...(process.env.DATABASE_SCHEMA ? { schemaName: process.env.DATABASE_SCHEMA } : {}),
        push: true,
      })
    : sqliteAdapter({
        client: { url: process.env.DATABASE_URI || 'file:./imperial.db' },
      }),
  sharp: (await import('sharp')).default,
})
