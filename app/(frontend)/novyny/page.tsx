import type { Metadata } from 'next'

import { getSettings } from '@/lib/data.ts'
import { dateLabel, getNews } from '@/lib/news.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { BreadcrumbSchema } from '@/components/Schema.tsx'
import '@/components/News.css'

export const revalidate = 600

type L = 'uk' | 'ru'

const T = {
  uk: {
    title: 'Новини та акції ломбарду «Імперіал»',
    description: 'Акції, бонусні програми та новини мережі ломбардів «Імперіал» у Дніпрі.',
    home: 'Головна', crumb: 'Новини та акції',
    h1: 'Новини та акції', lede: 'Що діє зараз у мережі та що вже завершилось.',
    promo: 'Акція', news: 'Новина',
    none: 'Зараз діючих акцій немає.',
    archived: 'Завершені',
  },
  ru: {
    title: 'Новости и акции ломбарда «Империал»',
    description: 'Акции, бонусные программы и новости сети ломбардов «Империал» в Днепре.',
    home: 'Главная', crumb: 'Новости и акции',
    h1: 'Новости и акции', lede: 'Что действует сейчас в сети и что уже завершилось.',
    promo: 'Акция', news: 'Новость',
    none: 'Сейчас действующих акций нет.',
    archived: 'Завершённые',
  },
} satisfies Record<L, unknown>

export async function novynyMetadata(locale: L): Promise<Metadata> {
  const t = T[locale]
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: locale === 'ru' ? '/ru/novyny' : '/novyny',
      languages: { 'uk-UA': '/novyny', 'ru-UA': '/ru/novyny', 'x-default': '/novyny' },
    },
  }
}

export async function NovynyContent({ locale }: { locale: L }) {
  const t = T[locale]
  const settings = await getSettings(locale)
  const hotline = String(settings.hotline || '0 800 30 85 00')
  const all = await getNews(locale)
  const live = all.filter((n) => !n.archived)
  const archived = all.filter((n) => n.archived)

  const card = (n: (typeof all)[number]) => (
    <a className="ncard" key={n.id} href={`/novyny/${n.slug}`}>
      <span className={`ncard__kind${n.kind === 'promo' ? ' ncard__kind--promo' : ''}`}>
        {n.kind === 'promo' ? t.promo : t.news}
      </span>
      <b>{n.title}</b>
      {n.lead && <span className="ncard__lead">{n.lead}</span>}
      <span className="ncard__meta">
        {dateLabel(n.publishedAt, locale)}
        {n.term ? ` · ${n.term}` : ''}
      </span>
    </a>
  )

  return (
    <>
      <BreadcrumbSchema items={[
        { name: t.home, href: '/' },
        { name: t.crumb, href: '/novyny' },
      ]} />
      <SiteHeader hotline={hotline} locale={locale} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label={locale === 'ru' ? 'Путь' : 'Шлях'}>
              <a href="/">{t.home}</a><span aria-hidden="true">/</span><span>{t.crumb}</span>
            </nav>
            <div className="shead bhead">
              <h1>{t.h1}</h1>
              <p>{t.lede}</p>
            </div>

            {live.length > 0 && <div className="nlist">{live.map(card)}</div>}
            {live.length === 0 && <p className="ndim">{t.none}</p>}

            {archived.length > 0 && (
              <>
                <h2 className="narch">{t.archived}</h2>
                <div className="nlist nlist--arch">{archived.map(card)}</div>
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} locale={locale} />
    </>
  )
}

export default async function NewsList() {
  return await NovynyContent({ locale: 'uk' })
}

export async function generateMetadata(): Promise<Metadata> {
  return novynyMetadata('uk')
}
