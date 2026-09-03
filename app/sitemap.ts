import type { MetadataRoute } from 'next'

import { CATEGORIES } from '@/lib/categories.ts'
import { siteUrl } from '@/lib/site.ts'

/**
 * Карта сайту збирається сама. Додали сторінку чи відділення в адмінці —
 * воно тут з'явиться; вручну такий файл ніхто не підтримує, він протухає.
 */
export const revalidate = 3600

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  const now = new Date()

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/zastava/hodynnyky`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...CATEGORIES.map((c) => ({
      url: `${base}/zastava/${c.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
