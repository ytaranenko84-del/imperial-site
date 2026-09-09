import Image from 'next/image'

import Nav from '@/components/Nav'

/** Шапка внутрішніх сторінок. Одна на всіх, щоб меню не розповзалося по копіях. */
export default function SiteHeader({ hotline }: { hotline: string }) {
  return (
    <header className="wrap top">
      <a className="brand" href="/">
        <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
        <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
      </a>
      <Nav
        hotline={hotline}
        items={[
          { href: '/#cats', label: 'Що приймаємо' },
          { href: '/calc', label: 'Оцінка' },
          { href: '/zastava/hodynnyky', label: 'Годинники' },
          { href: '/novyny', label: 'Новини' },
          { href: '/viddilennya', label: 'Відділення' },
        ]}
      />
      <a className="tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
        <b>{hotline}</b><span>Цілодобово · безкоштовно</span>
      </a>
    </header>
  )
}
