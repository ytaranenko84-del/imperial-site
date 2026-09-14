import type { MetadataRoute } from 'next'

import { CATEGORIES } from '@/lib/categories.ts'
import { getNews } from '@/lib/news.ts'
import { siteUrl } from '@/lib/site.ts'

/**
 * Карта сайту збирається сама. Додали сторінку чи відділення в адмінці —
 * воно тут з'явиться; вручну такий файл ніхто не підтримує, він протухає.
 */
export const revalidate = 3600

/** Кожна адреса виходить у двох мовних варіантах: без префіксу (uk) і з /ru. */
function withLocales(
  path: string, lastModified: Date, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'], priority: number,
): MetadataRoute.Sitemap {
  const base = siteUrl()
  const clean = path === '/' ? '' : path
  return [
    { url: `${base}${path}`, lastModified, changeFrequency, priority },
    { url: `${base}/ru${clean || ''}`, lastModified, changeFrequency, priority: priority * 0.9 },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const news = await getNews()

  return [
    ...withLocales('/', now, 'daily', 1),
    ...withLocales('/calc', now, 'weekly', 0.95),
    ...withLocales('/pro-nas', now, 'monthly', 0.4),
    ...withLocales('/zastava', now, 'monthly', 0.7),
    ...withLocales('/viddilennya', now, 'weekly', 0.9),
    ...withLocales('/zastava/hodynnyky', now, 'monthly', 0.8),
    ...withLocales('/novyny', now, 'weekly', 0.6),
    ...news.flatMap((n) => withLocales(
      `/novyny/${n.slug}`, new Date(n.publishedAt), 'yearly', n.archived ? 0.2 : 0.5,
    )),
    ...CATEGORIES.uk.flatMap((c) => withLocales(`/zastava/${c.slug}`, now, 'monthly', 0.7)),
  ]
}
