import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'

import { getSettings } from '@/lib/data.ts'
import { withLocale } from '@/lib/locale-utils.ts'
import { dateLabel, getNews, getNewsItem } from '@/lib/news.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import NewsBody from '@/components/NewsBody'
import { BreadcrumbSchema } from '@/components/Schema.tsx'
import '@/components/News.css'

export const revalidate = 600

type L = 'uk' | 'ru'

const T = {
  uk: {
    home: 'Головна', crumb: 'Новини та акції',
    promo: 'Акція', news: 'Новина', done: 'завершено',
    archNote: 'Матеріал в архіві: акція вже не діє. Що діє зараз — на',
    archLink: 'сторінці новин',
    others: 'Інші матеріали',
    metaSuffix: 'ломбард «Імперіал»',
  },
  ru: {
    home: 'Главная', crumb: 'Новости и акции',
    promo: 'Акция', news: 'Новость', done: 'завершено',
    archNote: 'Материал в архиве: акция уже не действует. Что действует сейчас — на',
    archLink: 'странице новостей',
    others: 'Другие материалы',
    metaSuffix: 'ломбард «Империал»',
  },
} satisfies Record<L, unknown>

export async function generateStaticParams() {
  return (await getNews()).map((n) => ({ slug: n.slug }))
}

export async function novynyItemMetadata(slug: string, locale: L): Promise<Metadata> {
  const t = T[locale]
  const n = await getNewsItem(slug, locale)
  if (!n) return {}
  return {
    title: `${n.title} — ${t.metaSuffix}`,
    description: n.lead || n.body.slice(0, 160),
    alternates: {
      canonical: locale === 'ru' ? `/ru/novyny/${n.slug}` : `/novyny/${n.slug}`,
      languages: { 'uk-UA': `/novyny/${n.slug}`, 'ru-UA': `/ru/novyny/${n.slug}`, 'x-default': `/novyny/${n.slug}` },
    },
    openGraph: { type: 'article', publishedTime: n.publishedAt },
  }
}

export async function NovynyItemContent({ slug, locale }: { slug: string; locale: L }) {
  const t = T[locale]
  const [n, settings] = await Promise.all([getNewsItem(slug, locale), getSettings(locale)])
  if (!n) notFound()
  const hotline = String(settings.hotline || '0 800 30 85 00')

  // Спершу діючі: пропонувати завершені акції — марно витрачати увагу
  const others = (await getNews(locale))
    .filter((o) => o.slug !== n.slug)
    .sort((a, b) => Number(a.archived) - Number(b.archived))
    .slice(0, 3)

  return (
    <>
      <BreadcrumbSchema items={[
        { name: t.home, href: withLocale('/', locale) },
        { name: t.crumb, href: withLocale('/novyny', locale) },
        { name: n.title, href: withLocale(`/novyny/${n.slug}`, locale) },
      ]} />
      <SiteHeader hotline={hotline} locale={locale} />

      <main>
        <article className="sec">
          <div className="wrap nart">
            <nav className="crumbs" aria-label={locale === 'ru' ? 'Путь' : 'Шлях'}>
              <a href={withLocale('/', locale)}>{t.home}</a><span aria-hidden="true">/</span>
              <a href={withLocale('/novyny', locale)}>{t.crumb}</a><span aria-hidden="true">/</span>
              <span>{n.title}</span>
            </nav>

            {n.cover && (
              <Image className="nart__cover" src={n.cover.url} alt={n.cover.alt || n.title}
                width={n.cover.width} height={n.cover.height} priority sizes="(min-width: 900px) 68ch, 100vw" />
            )}

            <span className={`ncard__kind${n.kind === 'promo' ? ' ncard__kind--promo' : ''}`}>
              {n.kind === 'promo' ? t.promo : t.news}
            </span>
            <h1>{n.title}</h1>
            <p className="nmeta">
              {dateLabel(n.publishedAt, locale)}
              {n.term ? ` · ${n.term}` : ''}
              {n.archived ? ` · ${t.done}` : ''}
            </p>

            {n.archived && (
              <p className="nold">
                {t.archNote}{' '}
                <a href={withLocale('/novyny', locale)}>{t.archLink}</a>.
              </p>
            )}

            <NewsBody body={n.body} />
          </div>
        </article>

        {others.length > 0 && (
          <section className="sec sec--tight">
            <div className="wrap">
              <h2 className="narch">{t.others}</h2>
              <div className="nlist">
                {others.map((o) => (
                  <a className="ncard" key={o.id} href={withLocale(`/novyny/${o.slug}`, locale)}>
                    <span className={`ncard__kind${o.kind === 'promo' ? ' ncard__kind--promo' : ''}`}>
                      {o.kind === 'promo' ? t.promo : t.news}
                    </span>
                    <b>{o.title}</b>
                    <span className="ncard__meta">{dateLabel(o.publishedAt, locale)}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter settings={settings} locale={locale} />
    </>
  )
}

export default async function NewsItemPage({ params }: PageProps<'/novyny/[slug]'>) {
  const { slug } = await params
  return await NovynyItemContent({ slug, locale: 'uk' })
}

export async function generateMetadata({ params }: PageProps<'/novyny/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  return novynyItemMetadata(slug, 'uk')
}
