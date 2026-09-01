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
 * База обирається автоматично.
 * Є DATABASE_URL (Netlify, бойовий сервер) — PostgreSQL.
 * Немає — локальний файл SQLite, щоб розробка не потребувала жодних установок.
 */
const databaseURL = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL

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
        push: process.env.NODE_ENV !== 'production',
      })
    : sqliteAdapter({
        client: { url: process.env.DATABASE_URI || 'file:./imperial.db' },
      }),
  sharp: (await import('sharp')).default,
})
