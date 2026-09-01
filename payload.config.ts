import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { uk } from '@payloadcms/translations/languages/uk'
import { ru } from '@payloadcms/translations/languages/ru'

import { resolveDatabaseUrl } from './lib/db'
import { Tariffs } from './collections/Tariffs'
import { RateTiers } from './collections/RateTiers'
import { LoyaltyTiers } from './collections/LoyaltyTiers'
import { Cities } from './collections/Cities'
import { Branches } from './collections/Branches'
import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { Settings } from './collections/Settings'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// На Netlify база підключається сама, локально — файл SQLite (див. lib/db.ts)
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
