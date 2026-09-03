import type { Metadata } from 'next'

import { getSettings } from '@/lib/data.ts'
import { dateLabel, getNews } from '@/lib/news.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { BreadcrumbSchema } from '@/components/Schema.tsx'
import '@/components/News.css'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Новини та акції ломбарду «Імперіал»',
  description: 'Акції, бонусні програми та новини мережі ломбардів «Імперіал» у Дніпрі.',
  alternates: { canonical: '/novyny' },
}

export default async function NewsList() {
  const settings = await getSettings()
  const hotline = String(settings.hotline || '0 800 30 85 00')
  const all = await getNews()
  const live = all.filter((n) => !n.archived)
  const archived = all.filter((n) => n.archived)

  const card = (n: (typeof all)[number]) => (
    <a className="ncard" key={n.id} href={`/novyny/${n.slug}`}>
      <span className={`ncard__kind${n.kind === 'promo' ? ' ncard__kind--promo' : ''}`}>
        {n.kind === 'promo' ? 'Акція' : 'Новина'}
      </span>
      <b>{n.title}</b>
      {n.lead && <span className="ncard__lead">{n.lead}</span>}
      <span className="ncard__meta">
        {dateLabel(n.publishedAt)}
        {n.term ? ` · ${n.term}` : ''}
      </span>
    </a>
  )

  return (
    <>
      <BreadcrumbSchema items={[
        { name: 'Головна', href: '/' },
        { name: 'Новини та акції', href: '/novyny' },
      ]} />
      <SiteHeader hotline={hotline} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label="Шлях">
              <a href="/">Головна</a><span aria-hidden="true">/</span><span>Новини та акції</span>
            </nav>
            <div className="shead bhead">
              <h1>Новини та акції</h1>
              <p>Що діє зараз у мережі та що вже завершилось.</p>
            </div>

            {live.length > 0 && <div className="nlist">{live.map(card)}</div>}
            {live.length === 0 && <p className="ndim">Зараз діючих акцій немає.</p>}

            {archived.length > 0 && (
              <>
                <h2 className="narch">Завершені</h2>
                <div className="nlist nlist--arch">{archived.map(card)}</div>
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </>
  )
}
