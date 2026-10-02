import Image from 'next/image'

import Nav from '@/components/Nav'
import LangSwitch from '@/components/LangSwitch'
import PromoRibbon from '@/components/PromoRibbon'
import TrackedLink from '@/components/TrackedLink.tsx'

const NAV_LABELS = {
  uk: { catalog: 'Що приймаємо', calc: 'Оцінка', watches: 'Годинники', news: 'Новини та акції', branches: 'Відділення', roundClock: 'Цілодобово · безкоштовно' },
  ru: { catalog: 'Что принимаем', calc: 'Оценка', watches: 'Часы', news: 'Новости и акции', branches: 'Отделения', roundClock: 'Круглосуточно · бесплатно' },
} satisfies Record<'uk' | 'ru', unknown>

/** Шапка внутрішніх сторінок. Одна на всіх, щоб меню не розповзалося по копіях. */
export default function SiteHeader({
  hotline, telegram, locale = 'uk',
}: { hotline: string; telegram?: string | null; locale?: 'uk' | 'ru' }) {
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
      <div className="top__contact">
        {telegram && (
          <TrackedLink location="header_telegram" className="top__tg" href={telegram} target="_blank" rel="noopener"
            aria-label="Telegram" title="Telegram">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M21.94 4.9 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.15c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.13 12.4 2.55 10.97c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.28 2.31Z" />
            </svg>
          </TrackedLink>
        )}
        <a className="tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
          <b>{hotline}</b><span>{n.roundClock}</span>
        </a>
      </div>
    </header>
    </>
  )
}
