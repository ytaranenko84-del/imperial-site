import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * Заголовки безпеки. Задаються тут, а не в netlify.toml: правила хостингу
   * діють на статику, а сторінки віддає Next — на бойовому їх не було видно.
   *
   * X-Frame-Options: без нього адмінку можна показати в невидимому вікні
   * поверх чужої сторінки й ловити натискання.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), geolocation=(self)' },
        ],
      },
    ]
  },

  // Редиректи зі старих адрес — розділ «Карта редиректів» у routes.md
  async redirects() {
    return [
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
      // Гола /ua потрапляла під узагальнене правило з порожнім хвостом і
      // віддавала перенаправлення в порожнє місце — 12,3 % переглядів старого
      // сайту крутились у нікуди. Окреме правило мусить стояти перед ним.
      { source: '/ua', destination: '/', permanent: true },
      { source: '/ua/:path*', destination: '/:path*', permanent: true },
      { source: '/news-shares/:path*', destination: '/novyny', permanent: true },
      // На старому сайті /contacts був переліком адрес відділень — ведемо туди ж
      { source: '/contacts', destination: '/viddilennya', permanent: true },
      // Золото й срібло оцінює калькулятор, а не сторінка категорії з фото —
      // /zastava/zoloto ніколи не існувало.
      { source: '/loans/yuvelirnye-izdeliya/:path*', destination: '/calc', permanent: true },
      // Старий лендинг калькулятора золота — за Search Console, 88 кліків і
      // 3784 покази за 3 місяці, реальний трафік, без правила йшов би в 404.
      { source: '/imperial-landing/calculator_zoloto/:path*', destination: '/calc', permanent: true },
      { source: '/loans/tsifrovaya-tekhnika/:path*', destination: '/zastava/tekhnika', permanent: true },
      { source: '/loans/bytovaya-tekhnika/:path*', destination: '/zastava/pobutova-tekhnika', permanent: true },
      { source: '/loans/instrumenty-i-oborudovanie/:path*', destination: '/zastava/instrument', permanent: true },
      { source: '/loans/tovary-dlya-otdykha-i-sporta/:path*', destination: '/zastava/sport', permanent: true },
      { source: '/about', destination: '/pro-nas', permanent: true },
      /*
       * /bonus не отримує окремої сторінки: точні відсотки знижок, кешбеку й
       * надбавок за статусами вже відкрито показані в калькуляторі при кожному
       * розрахунку — на головній і на /calc. Окрема сторінка нічого додатково
       * не приховала б і не розкрила б: цих цифр і так не сховати, calculator
       * саме так і задумано — усі статуси видно одразу.
       */
      { source: '/bonus', destination: '/calc', permanent: true },
      { source: '/loans', destination: '/zastava', permanent: true },
      /*
       * Тут навмисно немає правил для /reviews, /vacancy і /redemption.
       * Сторінок, на які вони вели, не існує, а постійне перенаправлення на 404
       * пошуковик читає як видалення сторінки й знімає її з позицій разом із
       * накопиченою вагою. Чесна 404 відновлюється легше.
       * Правила повертаються разом зі сторінками — черга в tz-pereizd-404.md.
       */
      { source: '/thanks.php', destination: '/dyakuyemo', permanent: true },
      { source: '/index.php', destination: '/', permanent: true },
      // Правил під адреси зі скісною рискою тут немає: Next прибирає її сам,
      // до того як дивиться на правила, тож такі правила не спрацьовували б.
      // Старий лінк іде у два переходи, і це нормально.
    ]
  },
}

export default withPayload(nextConfig)
