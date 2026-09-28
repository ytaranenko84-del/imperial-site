import Image from 'next/image'

import Nav from '@/components/Nav'
import LangSwitch from '@/components/LangSwitch'
import PromoRibbon from '@/components/PromoRibbon'

const NAV_LABELS = {
  uk: { catalog: 'Що приймаємо', calc: 'Оцінка', watches: 'Годинники', news: 'Новини та акції', branches: 'Відділення', roundClock: 'Цілодобово · безкоштовно' },
  ru: { catalog: 'Что принимаем', calc: 'Оценка', watches: 'Часы', news: 'Новости и акции', branches: 'Отделения', roundClock: 'Круглосуточно · бесплатно' },
} satisfies Record<'uk' | 'ru', unknown>

/** Шапка внутрішніх сторінок. Одна на всіх, щоб меню не розповзалося по копіях. */
export default function SiteHeader({ hotline, locale = 'uk' }: { hotline: string; locale?: 'uk' | 'ru' }) {
  const n = NAV_LABELS[locale]
  return (
    <>
    <PromoRibbon locale={locale} />
    <header className="wrap top">
      <a className="brand" href="/">
        <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
        <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
      </a>
      <Nav
        hotline={hotline}
        locale={locale}
        items={[
          { href: '/zastava', label: n.catalog },
          { href: '/calc', label: n.calc },
          { href: '/zastava/hodynnyky', label: n.watches },
          { href: '/novyny', label: n.news },
          { href: '/viddilennya', label: n.branches },
        ]}
      />
      <LangSwitch locale={locale} />
      <a className="tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
        <b>{hotline}</b><span>{n.roundClock}</span>
      </a>
    </header>
    </>
  )
}
