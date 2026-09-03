import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getSettings } from '@/lib/data.ts'
import { dateLabel, getNews, getNewsItem } from '@/lib/news.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import NewsBody from '@/components/NewsBody'
import { BreadcrumbSchema } from '@/components/Schema.tsx'
import '@/components/News.css'

export const revalidate = 600

export async function generateStaticParams() {
  return (await getNews()).map((n) => ({ slug: n.slug }))
}

export async function generateMetadata({ params }: PageProps<'/novyny/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const n = await getNewsItem(slug)
  if (!n) return {}
  return {
    title: `${n.title} — ломбард «Імперіал»`,
    description: n.lead || n.body.slice(0, 160),
    alternates: { canonical: `/novyny/${n.slug}` },
    openGraph: { type: 'article', publishedTime: n.publishedAt },
  }
}

export default async function NewsItemPage({ params }: PageProps<'/novyny/[slug]'>) {
  const { slug } = await params
  const [n, settings] = await Promise.all([getNewsItem(slug), getSettings()])
  if (!n) notFound()
  const hotline = String(settings.hotline || '0 800 30 85 00')

  // Спершу діючі: пропонувати завершені акції — марно витрачати увагу
  const others = (await getNews())
    .filter((o) => o.slug !== n.slug)
    .sort((a, b) => Number(a.archived) - Number(b.archived))
    .slice(0, 3)

  return (
    <>
      <BreadcrumbSchema items={[
        { name: 'Головна', href: '/' },
        { name: 'Новини та акції', href: '/novyny' },
        { name: n.title, href: `/novyny/${n.slug}` },
      ]} />
      <SiteHeader hotline={hotline} />

      <main>
        <article className="sec">
          <div className="wrap nart">
            <nav className="crumbs" aria-label="Шлях">
              <a href="/">Головна</a><span aria-hidden="true">/</span>
              <a href="/novyny">Новини та акції</a><span aria-hidden="true">/</span>
              <span>{n.title}</span>
            </nav>

            <span className={`ncard__kind${n.kind === 'promo' ? ' ncard__kind--promo' : ''}`}>
              {n.kind === 'promo' ? 'Акція' : 'Новина'}
            </span>
            <h1>{n.title}</h1>
            <p className="nmeta">
              {dateLabel(n.publishedAt)}
              {n.term ? ` · ${n.term}` : ''}
              {n.archived ? ' · завершено' : ''}
            </p>

            {n.archived && (
              <p className="nold">
                Матеріал в архіві: акція вже не діє. Що діє зараз — на{' '}
                <a href="/novyny">сторінці новин</a>.
              </p>
            )}

            <NewsBody body={n.body} />
          </div>
        </article>

        {others.length > 0 && (
          <section className="sec sec--tight">
            <div className="wrap">
              <h2 className="narch">Інші матеріали</h2>
              <div className="nlist">
                {others.map((o) => (
                  <a className="ncard" key={o.id} href={`/novyny/${o.slug}`}>
                    <span className={`ncard__kind${o.kind === 'promo' ? ' ncard__kind--promo' : ''}`}>
                      {o.kind === 'promo' ? 'Акція' : 'Новина'}
                    </span>
                    <b>{o.title}</b>
                    <span className="ncard__meta">{dateLabel(o.publishedAt)}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter settings={settings} />
    </>
  )
}
