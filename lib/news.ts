import { getPayload } from 'payload'
import config from '@payload-config'

export type NewsItem = {
  id: string
  title: string
  slug: string
  kind: 'news' | 'promo'
  publishedAt: string
  term?: string | null
  lead?: string | null
  body: string
  archived: boolean
}

const map = (d: Record<string, unknown>): NewsItem => ({
  id: String(d.id),
  title: String(d.title),
  slug: String(d.slug),
  kind: (d.kind as 'news' | 'promo') || 'news',
  publishedAt: String(d.publishedAt),
  term: (d.term as string) ?? null,
  lead: (d.lead as string) ?? null,
  body: String(d.body || ''),
  archived: Boolean(d.archived),
})

export async function getNews(): Promise<NewsItem[]> {
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'news', limit: 200, sort: '-publishedAt',
      locale: 'uk', depth: 0, overrideAccess: true,
    })
    return res.docs.map((d) => map(d as Record<string, unknown>))
  } catch {
    return []
  }
}

export async function getNewsItem(slug: string): Promise<NewsItem | null> {
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'news', where: { slug: { equals: slug } }, limit: 1,
      locale: 'uk', depth: 0, overrideAccess: true,
    })
    const d = res.docs[0]
    return d ? map(d as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Дата словами: «13 травня 2020». */
const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня']

export function dateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
