import type { Metadata } from 'next'

import { getSiteData } from '@/lib/data.ts'
import { getLocale } from '@/lib/locale.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { BreadcrumbSchema } from '@/components/Schema.tsx'

export const revalidate = 600

type L = 'uk' | 'ru'

const T = {
  uk: {
    title: 'Про ломбард «Імперіал» — мережа з 2008 року',
    description: 'Мережа ломбардів «Імперіал» у Дніпрі: 28 відділень, ліцензія НБУ, '
      + 'ставка від 0,39% на день. Історія мережі та принципи роботи.',
    home: 'Головна', crumb: 'Про ломбард',
    h1: 'Про ломбард «Імперіал»',
    lede: (n: number, years: number) =>
      `Мережа ломбардів у Дніпрі: ${n} відділень, ${years} років на ринку, `
      + 'ліцензована діяльність під наглядом Національного банку України.',
    whoH2: 'Хто ми',
    p1: '«Імперіал» працює з 2008 року — приймаємо під заставу золото, срібло, техніку, '
      + 'інструмент і спортивний інвентар. Оцінюємо на місці або за фото, видаємо готівку '
      + 'одразу після оформлення договору.',
    p2: 'Річ, яку ви залишаєте під заставу, лишається вашою: вона зберігається в сейфі '
      + 'відділення під охороною і не потрапляє у продаж, доки діє договір. Стан речі '
      + 'фіксуємо в договорі разом із вами — до найдрібнішої подряпини, а майно '
      + 'застраховане на повну суму оцінки на весь строк застави.',
    p3pre: 'Ставка — від 0,39% на день, точний розмір залежить від суми позики й статусу '
      + 'в програмі лояльності. Порахувати суму під ваш виріб можна заздалегідь —',
    p3link: 'калькулятор', p3post: 'показує результат миттєво, без реєстрації.',
    findH2: 'Де знайти відділення',
    findLede: (n: number) => `${n} відділень у Дніпрі — адреси, графік роботи й маршрут до кожного на окремій сторінці.`,
    findCta: 'Усі відділення →',
  },
  ru: {
    title: 'О ломбарде «Империал» — сеть с 2008 года',
    description: 'Сеть ломбардов «Империал» в Днепре: 28 отделений, лицензия НБУ, '
      + 'ставка от 0,39% в день. История сети и принципы работы.',
    home: 'Главная', crumb: 'О ломбарде',
    h1: 'О ломбарде «Империал»',
    lede: (n: number, years: number) =>
      `Сеть ломбардов в Днепре: ${n} отделений, ${years} лет на рынке, `
      + 'лицензированная деятельность под надзором Национального банка Украины.',
    whoH2: 'Кто мы',
    p1: '«Империал» работает с 2008 года — принимаем под залог золото, серебро, технику, '
      + 'инструмент и спортивный инвентарь. Оцениваем на месте или по фото, выдаём наличные '
      + 'сразу после оформления договора.',
    p2: 'Вещь, которую вы оставляете под залог, остаётся вашей: она хранится в сейфе '
      + 'отделения под охраной и не попадает в продажу, пока действует договор. Состояние вещи '
      + 'фиксируем в договоре вместе с вами — до мельчайшей царапины, а имущество '
      + 'застраховано на полную сумму оценки на весь срок залога.',
    p3pre: 'Ставка — от 0,39% в день, точный размер зависит от суммы займа и статуса '
      + 'в программе лояльности. Посчитать сумму под ваше изделие можно заранее —',
    p3link: 'калькулятор', p3post: 'показывает результат мгновенно, без регистрации.',
    findH2: 'Где найти отделение',
    findLede: (n: number) => `${n} отделений в Днепре — адреса, график работы и маршрут до каждого на отдельной странице.`,
    findCta: 'Все отделения →',
  },
} satisfies Record<L, unknown>

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = T[locale]
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: locale === 'ru' ? '/ru/pro-nas' : '/pro-nas',
      languages: { 'uk-UA': '/pro-nas', 'ru-UA': '/ru/pro-nas', 'x-default': '/pro-nas' },
    },
  }
}

export default async function AboutPage() {
  const locale = await getLocale()
  const t = T[locale]
  const { branches, settings } = await getSiteData(locale)
  const s = settings as Record<string, string | number | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')
  const years = new Date().getFullYear() - 2008

  return (
    <>
      <BreadcrumbSchema items={[
        { name: t.home, href: '/' },
        { name: t.crumb, href: '/pro-nas' },
      ]} />
      <SiteHeader hotline={hotline} locale={locale} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label={locale === 'ru' ? 'Путь' : 'Шлях'}>
              <a href="/">{t.home}</a><span aria-hidden="true">/</span><span>{t.crumb}</span>
            </nav>
            <div className="shead bhead">
              <h1>{t.h1}</h1>
              <p>{t.lede(branches.length, years)}</p>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap bnote">
            <h2>{t.whoH2}</h2>
            <p>{t.p1}</p>
            <p>{t.p2}</p>
            <p>
              {t.p3pre}{' '}
              <a href="/calc">{t.p3link}</a> {t.p3post}
            </p>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <h2>{t.findH2}</h2>
            <p className="lead">{t.findLede(branches.length)}</p>
            <a className="pill" href="/viddilennya">{t.findCta}</a>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} locale={locale} />
    </>
  )
}
