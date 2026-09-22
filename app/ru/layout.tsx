import type { Metadata } from 'next'
import '../(frontend)/globals.css'
import Motion from '@/components/Motion'
import MobileActionBar from '@/components/MobileActionBar'
import Analytics from '@/components/Analytics'
import { getSettings } from '@/lib/data.ts'
import { inter } from '@/lib/fonts.ts'
import { siteUrl } from '@/lib/site.ts'

/**
 * Окремий кореневий layout для російської версії (/ru/*) — власний
 * <html>/<body>, locale='ru' літералом. Дзеркало app/(frontend)/layout.tsx.
 * Дублювання свідоме: інакше єдиний спільний layout мусив би читати
 * заголовок запиту через headers(), а це вимикає кешування для всього сайту.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: '/ru' },
  title: 'Ломбард «Империал»',
  description: 'Сеть ломбардов «Империал». Самая высокая оценка золота, ставка от 0,39% в день.',
  openGraph: {
    type: 'website',
    locale: 'ru_UA',
    siteName: 'Ломбард «Империал»',
  },
}

const MOTION_ON = `try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)`
  + `document.documentElement.classList.add('motion')}catch(e){}`

export default async function RuRootLayout({ children }: LayoutProps<'/ru'>) {
  const settings = await getSettings('ru')
  const hotline = String(settings.hotline || '0 800 30 85 00')
  const telegram = (settings.telegram as string) || null
  const gaId = (settings.gaMeasurementId as string) || null

  return (
    <html lang="ru" suppressHydrationWarning className={inter.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: MOTION_ON }} /></head>
      <body>
        {gaId && <Analytics measurementId={gaId} />}
        {children}
        <MobileActionBar hotline={hotline} telegram={telegram} locale="ru" />
        <Motion />
      </body>
    </html>
  )
}
