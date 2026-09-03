import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Редиректи зі старих адрес — розділ «Карта редиректів» у routes.md
  async redirects() {
    return [
      { source: '/ua/:path*', destination: '/:path*', permanent: true },
      { source: '/calc', destination: '/otsinka', permanent: true },
      { source: '/bonus', destination: '/bonusy', permanent: true },
      { source: '/about', destination: '/pro-nas', permanent: true },
      { source: '/redemption', destination: '/vykup-avto', permanent: true },
      { source: '/news-shares/:path*', destination: '/novyny/:path*', permanent: true },
      { source: '/reviews', destination: '/vidhuky', permanent: true },
      { source: '/vacancy', destination: '/vakansiyi', permanent: true },
      { source: '/contacts', destination: '/kontakty', permanent: true },
      { source: '/loans', destination: '/zastava', permanent: true },
      { source: '/loans/yuvelirnye-izdeliya/:path*', destination: '/zastava/zoloto', permanent: true },
      { source: '/loans/tsifrovaya-tekhnika/:path*', destination: '/zastava/tekhnika', permanent: true },
      { source: '/loans/bytovaya-tekhnika/:path*', destination: '/zastava/pobutova-tekhnika', permanent: true },
      { source: '/loans/instrumenty-i-oborudovanie/:path*', destination: '/zastava/instrument', permanent: true },
      { source: '/loans/tovary-dlya-otdykha-i-sporta/:path*', destination: '/zastava/sport', permanent: true },
      { source: '/index.php', destination: '/', permanent: true },
      // Усі адреси старого сайту закінчуються скісною рискою. Next спершу її
      // прибирає, і без цих правил кожен старий лінк ішов би у два переходи,
      // втрачаючи частину ваги посилання.
      { source: '/loans/yuvelirnye-izdeliya/', destination: '/zastava/zoloto', permanent: true },
      { source: '/loans/tsifrovaya-tekhnika/', destination: '/zastava/tekhnika', permanent: true },
      { source: '/loans/bytovaya-tekhnika/', destination: '/zastava/pobutova-tekhnika', permanent: true },
      { source: '/loans/instrumenty-i-oborudovanie/', destination: '/zastava/instrument', permanent: true },
      { source: '/loans/tovary-dlya-otdykha-i-sporta/', destination: '/zastava/sport', permanent: true },
    ]
  },
}

export default withPayload(nextConfig)
