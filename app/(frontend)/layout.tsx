import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import Motion from '@/components/Motion'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://imperial-lombard-ua.netlify.app'),
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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="uk" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: MOTION_ON }} /></head>
      <body>
        {children}
        <Motion />
      </body>
    </html>
  )
}
