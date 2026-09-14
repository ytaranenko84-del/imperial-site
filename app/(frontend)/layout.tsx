import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Motion from '@/components/Motion'
import MobileActionBar from '@/components/MobileActionBar'
import Analytics from '@/components/Analytics'
import { getSettings } from '@/lib/data.ts'
import { getLocale } from '@/lib/locale.ts'
import { siteUrl } from '@/lib/site.ts'

/**
 * Запасна гарнітура для Windows та Android — розділ 15 ТЗ.
 *
 * На macOS та iOS шрифт беруть із системи: у стеку першим стоїть SF Pro, і до
 * Inter черга не доходить. Тому `preload: false` — на техніці Apple файл не
 * качається зовсім, а там, де SF Pro немає, браузер візьме його сам.
 *
 * Кирилиця обов'язкова: без неї підставився б Arial, а це в ТЗ прямо названо
 * ознакою дешевого сайту.
 */
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: '/' },
  title: 'Ломбард «Імперіал»',
  description: 'Мережа ломбардів «Імперіал». Найвища оцінка золота, ставка від 0,39% на день.',
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    siteName: 'Ломбард «Імперіал»',
  },
}

/**
 * Клас .motion ставимо до першої відмальовки, інакше блоки встигли б
 * блимнути перед тим, як сховатись. Без JavaScript класу немає — і сторінка
 * лишається повністю читабельною.
 */
const MOTION_ON = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)`
  + `document.documentElement.classList.add('motion')}catch(e){}`

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Одне місце для всього сайту: панель дій знає гарячу лінію й посилання на
  // Telegram незалежно від того, яка сторінка її показує.
  const locale = await getLocale()
  const settings = await getSettings(locale)
  const hotline = String(settings.hotline || '0 800 30 85 00')
  const telegram = (settings.telegram as string) || null
  const gaId = (settings.gaMeasurementId as string) || null

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: MOTION_ON }} /></head>
      <body>
        {gaId && <Analytics measurementId={gaId} />}
        {children}
        <MobileActionBar hotline={hotline} telegram={telegram} locale={locale} />
        <Motion />
      </body>
    </html>
  )
}
