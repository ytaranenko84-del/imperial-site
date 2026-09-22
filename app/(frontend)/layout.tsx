import type { Metadata } from 'next'
import './globals.css'
import Motion from '@/components/Motion'
import MobileActionBar from '@/components/MobileActionBar'
import Analytics from '@/components/Analytics'
import { getSettings } from '@/lib/data.ts'
import { inter } from '@/lib/fonts.ts'
import { siteUrl } from '@/lib/site.ts'

/**
 * Кореневий layout української версії (адреси без префіксу). Локаль — літерал
 * 'uk', а не читання заголовка: так сторінка лишається статичною й кешованою.
 * Дзеркало для російської — app/ru/layout.tsx, з окремим <html>/<body>: два
 * кореневих layout'и на одну версію мови, той самий підхід, що вже розділяє
 * (frontend) і (payload).
 */
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
  const settings = await getSettings('uk')
  const hotline = String(settings.hotline || '0 800 30 85 00')
  const telegram = (settings.telegram as string) || null
  const gaId = (settings.gaMeasurementId as string) || null

  return (
    <html lang="uk" suppressHydrationWarning className={inter.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: MOTION_ON }} /></head>
      <body>
        {gaId && <Analytics measurementId={gaId} />}
        {children}
        <MobileActionBar hotline={hotline} telegram={telegram} locale="uk" />
        <Motion />
      </body>
    </html>
  )
}
