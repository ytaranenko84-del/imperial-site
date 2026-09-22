import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getSettings } from '@/lib/data'
import { getLocale } from '@/lib/locale.ts'
import { CATEGORIES, byCategorySlug } from '@/lib/categories'
import EvalForm from '@/components/EvalForm'
import Nav from '@/components/Nav'
import LangSwitch from '@/components/LangSwitch'
import { BreadcrumbSchema } from '@/components/Schema.tsx'
import '@/components/EvalForm.css'

export const revalidate = 600

type L = 'uk' | 'ru'

const T = {
  uk: {
    home: 'Головна',
    metaTitle: (name: string) => `${name} під заставу — ломбард «Імперіал»`,
    metaDesc: (lead: string) => `${lead} Оцінка за фото: надішліть знімки — фахівець відповість протягом дня.`,
    catalog: 'Що приймаємо', calc: 'Оцінка', watches: 'Годинники', news: 'Новини', branches: 'Відділення',
    roundClock: 'Цілодобово · безкоштовно',
    eyebrow: 'Що приймаємо',
    cta: 'Оцінити за фото',
    rateNote: 'Безкоштовно · відповідь протягом робочого дня · нічого везти не треба. '
      + 'Оцінка за фото попередня: остаточну суму визначає фахівець після огляду речі.',
    takeH2: 'Що саме беремо',
    evalH2: 'Оцінка за фото', evalLede: 'Заповніть коротку форму — фахівець відповість протягом робочого дня.',
    otherH2: 'Інші напрямки',
    goldTitle: 'Золото і срібло', goldSub: 'Калькулятор рахує суму одразу', goldAct: 'Порахувати суму',
    watchesTitle: 'Годинники', watchesSub: 'Швейцарська механіка, вінтаж', watchesAct: 'Надіслати на оцінку',
    photoAct: 'Оцінити за фото',
    hotlineLbl: 'Гаряча лінія', toHome: 'на головну',
    photoAlt: (name: string) => `${name} під заставу в ломбарді «Імперіал»`,
  },
  ru: {
    home: 'Главная',
    metaTitle: (name: string) => `${name} под залог — ломбард «Империал»`,
    metaDesc: (lead: string) => `${lead} Оценка по фото: пришлите снимки — специалист ответит в течение дня.`,
    catalog: 'Что принимаем', calc: 'Оценка', watches: 'Часы', news: 'Новости', branches: 'Отделения',
    roundClock: 'Круглосуточно · бесплатно',
    eyebrow: 'Что принимаем',
    cta: 'Оценить по фото',
    rateNote: 'Бесплатно · ответ в течение рабочего дня · ничего везти не нужно. '
      + 'Оценка по фото предварительная: окончательную сумму определяет специалист после осмотра вещи.',
    takeH2: 'Что именно берём',
    evalH2: 'Оценка по фото', evalLede: 'Заполните короткую форму — специалист ответит в течение рабочего дня.',
    otherH2: 'Другие направления',
    goldTitle: 'Золото и серебро', goldSub: 'Калькулятор считает сумму сразу', goldAct: 'Посчитать сумму',
    watchesTitle: 'Часы', watchesSub: 'Швейцарская механика, винтаж', watchesAct: 'Отправить на оценку',
    photoAct: 'Оценить по фото',
    hotlineLbl: 'Горячая линия', toHome: 'на главную',
    photoAlt: (name: string) => `${name} под залог в ломбарде «Империал»`,
  },
} satisfies Record<L, unknown>

/** Сторінки категорій відомі наперед, тож адреси беруться зі списку. */
export function generateStaticParams() {
  return CATEGORIES.uk.map((c) => ({ category: c.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> },
): Promise<Metadata> {
  const { category } = await params
  const locale = await getLocale()
  const t = T[locale]
  const c = byCategorySlug(category, locale)
  if (!c) return {}
  return {
    title: t.metaTitle(c.name),
    description: t.metaDesc(c.lead),
    // Без цього рядка сторінка успадкує canonical головної з кореневого layout
    // і пошуковик визнає її дублем — категорії зникнуть із видачі.
    alternates: {
      canonical: locale === 'ru' ? `/ru/zastava/${c.slug}` : `/zastava/${c.slug}`,
      languages: {
        'uk-UA': `/zastava/${c.slug}`, 'ru-UA': `/ru/zastava/${c.slug}`, 'x-default': `/zastava/${c.slug}`,
      },
    },
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const locale = await getLocale()
  const t = T[locale]
  const c = byCategorySlug(category, locale)
  if (!c) notFound()

  const settings = await getSettings(locale)
  const s = settings as Record<string, string | number | boolean | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')

  return (
    <>
      <BreadcrumbSchema items={[
        { name: t.home, href: '/' },
        { name: c.name, href: `/zastava/${c.slug}` },
      ]} />
      <header className="wrap top">
        <a className="brand" href="/">
          <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
          <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
        </a>
        <Nav
          hotline={hotline}
          locale={locale}
          items={[
            { href: '/zastava', label: t.catalog },
            { href: '/calc', label: t.calc },
            { href: '/zastava/hodynnyky', label: t.watches },
            { href: '/novyny', label: t.news },
            { href: '/viddilennya', label: t.branches },
          ]}
        />
        <LangSwitch locale={locale} />
        <a className="tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
          <b>{hotline}</b><span>{t.roundClock}</span>
        </a>
      </header>

      <main>
        <section className="wrap hero center">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{c.name}</h1>
          <div className="goldline" />
          <p className="lede">{c.lead}</p>
          <a className="pill" href="#zayavka">{t.cta}</a>
          <p className="rate-note">{t.rateNote}</p>
        </section>

        <section className="sec">
          <div className="wrap split">
            <div data-reveal>
              <h2>{t.takeH2}</h2>
              <div className="goldline goldline--left" />
              <ul className="take">
                {c.take.map((tk) => <li key={tk}>{tk}</li>)}
              </ul>
              <p className="cnote">{c.note}</p>
            </div>
            <div className="cshot">
              <Image src={c.photo} alt={t.photoAlt(c.name)} fill sizes="(min-width: 900px) 46vw, 100vw" />
            </div>
          </div>
        </section>

        <section className="sec sec--gray" id="zayavka">
          <div className="wrap">
            <div className="shead" data-reveal>
              <h2>{t.evalH2}</h2>
              <div className="goldline goldline--left" />
              <p>{t.evalLede}</p>
            </div>
            <EvalForm category={c.key} shots={c.shots} example={c.example} locale={locale} />
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>{t.otherH2}</h2>
            </div>
            <div className="grid grid--4" data-reveal-group>
              <a className="card card--link" href="/calc">
                <h3 style={{ fontSize: 'var(--s1)' }}>{t.goldTitle}</h3>
                <p>{t.goldSub}</p>
                <span className="card__act">{t.goldAct}<i>→</i></span>
              </a>
              <a className="card card--link" href="/zastava/hodynnyky">
                <h3 style={{ fontSize: 'var(--s1)' }}>{t.watchesTitle}</h3>
                <p>{t.watchesSub}</p>
                <span className="card__act">{t.watchesAct}<i>→</i></span>
              </a>
              {CATEGORIES[locale].filter((x) => x.slug !== c.slug).slice(0, 2).map((x) => (
                <a className="card card--link" key={x.slug} href={`/zastava/${x.slug}`}>
                  <h3 style={{ fontSize: 'var(--s1)' }}>{x.name}</h3>
                  <p>{x.take[0]}</p>
                  <span className="card__act">{t.photoAct}<i>→</i></span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <p style={{ margin: 0, fontSize: 'var(--s-1)' }}>
            {t.hotlineLbl} <a href={`tel:${hotline.replace(/\s/g, '')}`} style={{ color: 'var(--brand)' }}>{hotline}</a>
            {' · '}{String(s.email || 'support@imperial24.com.ua')}
            {' · '}<a href="/">{t.toHome}</a>
          </p>
        </div>
      </footer>
    </>
  )
}
