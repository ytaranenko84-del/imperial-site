import type { MetadataRoute } from 'next'

import { siteUrl } from '@/lib/site.ts'

/**
 * Що можна обходити роботам. Адмінка й службові адреси закриті — інакше
 * пошуковик витрачає обхід на сторінки входу замість сторінок для клієнтів.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  }
}
