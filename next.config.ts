import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Редиректи зі старих адрес — розділ «Карта редиректів» у routes.md
  async redirects() {
    return [
      { source: '/calc', destination: '/otsinka', permanent: true },
      { source: '/bonus', destination: '/bonusy', permanent: true },
      { source: '/about', destination: '/pro-nas', permanent: true },
      { source: '/redemption', destination: '/vykup-avto', permanent: true },
      // Кожен матеріал зі старого сайту веде на свою нову адресу. Загальне
      // правило нижче ловить решту — переліки й те, чого вже немає.
      // Спершу конкретні адреси, і лише потім загальне правило /ua/* — інакше
      // воно зрізає /ua раніше, і український матеріал не знаходить свою пару:
      // /ua/news-shares/qr-kod ставало /news-shares/qr-kod, чого не існує.
      { source: '/news-shares/diskontnaya_programma_dlya_postoyannykh_klientov', destination: '/novyny/dyskontna-prohrama', permanent: true },
      { source: '/ua/news-shares/diskontna_motivatsiyna_programa_dlya_postiynikh_kli-ntiv', destination: '/novyny/dyskontna-prohrama', permanent: true },
      { source: '/news-shares/news4', destination: '/novyny/vysoka-otsinka', permanent: true },
      { source: '/ua/news-shares/visoka_otsinka_dlya_nashikh_kli-ntiv', destination: '/novyny/vysoka-otsinka', permanent: true },
      { source: '/news-shares/qr-kod_dlya_otzyvov_i_predlozheniy', destination: '/novyny/qr-kod-vidhuky', permanent: true },
      { source: '/ua/news-shares/qr-kod', destination: '/novyny/qr-kod-vidhuky', permanent: true },
      { source: '/news-shares/lichnyy_kabinet', destination: '/novyny/kabinet-u-telehram', permanent: true },
      { source: '/ua/news-shares/osobystyy_kabinet', destination: '/novyny/kabinet-u-telehram', permanent: true },
      { source: '/news-shares/apple-leto', destination: '/novyny/apple-lito-2020', permanent: true },
      { source: '/news-shares/obsluzhivanie_klientov_vo_vremya_karantina', destination: '/novyny/robota-pid-chas-karantynu', permanent: true },
      { source: '/ua/news-shares/novorichna_lotereya', destination: '/novyny/novorichna-lotereya-2024', permanent: true },
      { source: '/ua/news-shares/svyatkovyy_rozigrash_podarunkiv', destination: '/novyny/svyatkovyi-rozihrash', permanent: true },
      { source: '/ua/:path*', destination: '/:path*', permanent: true },
      { source: '/news-shares/:path*', destination: '/novyny', permanent: true },
      { source: '/reviews', destination: '/vidhuky', permanent: true },
      { source: '/vacancy', destination: '/vakansiyi', permanent: true },
      // На старому сайті /contacts був переліком адрес відділень — ведемо туди ж
      { source: '/contacts', destination: '/viddilennya', permanent: true },
      { source: '/loans', destination: '/zastava', permanent: true },
      { source: '/loans/yuvelirnye-izdeliya/:path*', destination: '/zastava/zoloto', permanent: true },
      { source: '/loans/tsifrovaya-tekhnika/:path*', destination: '/zastava/tekhnika', permanent: true },
      { source: '/loans/bytovaya-tekhnika/:path*', destination: '/zastava/pobutova-tekhnika', permanent: true },
      { source: '/loans/instrumenty-i-oborudovanie/:path*', destination: '/zastava/instrument', permanent: true },
      { source: '/loans/tovary-dlya-otdykha-i-sporta/:path*', destination: '/zastava/sport', permanent: true },
      { source: '/index.php', destination: '/', permanent: true },
      // Правил під адреси зі скісною рискою тут немає: Next прибирає її сам,
      // до того як дивиться на правила, тож такі правила не спрацьовували б.
      // Старий лінк іде у два переходи, і це нормально.
    ]
  },
}

export default withPayload(nextConfig)
