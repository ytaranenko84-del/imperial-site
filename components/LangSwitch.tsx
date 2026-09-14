'use client'

import { usePathname } from 'next/navigation'

import { localePair } from '@/lib/locale-utils.ts'

/**
 * UK / RU у шапці. Веде на ту саму сторінку іншою мовою: адреса без
 * префіксу — українською, з /ru — російською. Поточний шлях беремо з
 * pathname, тому перемикач працює на будь-якій сторінці однаково.
 */
export default function LangSwitch({ locale }: { locale: 'uk' | 'ru' }) {
  const pathname = usePathname()
  const { uk, ru } = localePair(pathname, locale)

  return (
    <div className="lang" role="group" aria-label={locale === 'ru' ? 'Язык страницы' : 'Мова сторінки'}>
      <a href={uk} aria-current={locale === 'uk' ? 'true' : undefined}>UA</a>
      <a href={ru} aria-current={locale === 'ru' ? 'true' : undefined}>RU</a>
    </div>
  )
}
