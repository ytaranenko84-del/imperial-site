import type { MetadataRoute } from 'next'

import { CATEGORIES } from '@/lib/categories.ts'
import { getNews } from '@/lib/news.ts'
import { siteUrl } from '@/lib/site.ts'

/**
 * Карта сайту збирається сама. Додали сторінку чи відділення в адмінці —
 * воно тут з'явиться; вручну такий файл ніхто не підтримує, він протухає.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const now = new Date()
  const news = await getNews()

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/calc`, lastModified: now, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${base}/pro-nas`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/zastava`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/viddilennya`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/zastava/hodynnyky`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/novyny`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 },
    ...news.map((n) => ({
      url: `${base}/novyny/${n.slug}`,
      lastModified: new Date(n.publishedAt),
      changeFrequency: 'yearly' as const,
      priority: n.archived ? 0.2 : 0.5,
    })),
    ...CATEGORIES.map((c) => ({
      url: `${base}/zastava/${c.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
