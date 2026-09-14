import Image from 'next/image'

import Social from '@/components/Social'

/** Підвал внутрішніх сторінок. */
export default function SiteFooter({ settings, locale = 'uk' }: { settings: Record<string, unknown>; locale?: 'uk' | 'ru' }) {
  return (
    <footer className="foot">
      <div className="wrap foot__in">
        <a className="brand" href="/">
          <Image className="brand__mark" src="/logo.png" alt="" width={32} height={32} />
          <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
        </a>
        <Social settings={settings} locale={locale} />
      </div>
    </footer>
  )
}
