import type { Metadata } from 'next'

import { getSettings } from '@/lib/data.ts'
import { withLocale } from '@/lib/locale-utils.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { BreadcrumbSchema } from '@/components/Schema.tsx'

export const revalidate = 600

type L = 'uk' | 'ru'

const T = {
  uk: {
    title: 'Що приймаємо в заставу — ломбард «Імперіал»',
    description: 'Золото, срібло, годинники, техніка, інструмент і спортивний інвентар. '
      + 'Метали рахує калькулятор миттєво, решту оцінює фахівець за фото.',
    home: 'Головна', crumb: 'Що приймаємо',
    h1: 'Що приймаємо в заставу',
    lede: 'Золото і срібло рахує калькулятор одразу. Решту оцінює фахівець за фото.',
  },
  ru: {
    title: 'Что принимаем в залог — ломбард «Империал»',
    description: 'Золото, серебро, часы, техника, инструмент и спортивный инвентарь. '
      + 'Металлы считает калькулятор мгновенно, остальное оценивает специалист по фото.',
    home: 'Главная', crumb: 'Что принимаем',
    h1: 'Что принимаем в залог',
    lede: 'Золото и серебро считает калькулятор сразу. Остальное оценивает специалист по фото.',
  },
} satisfies Record<L, unknown>

/** [назва, підпис, дія, спосіб оцінки, посилання] — той самий перелік, що на головній. */
const CATEGORIES: Record<L, [string, string, string, string, string][]> = {
  uk: [
    ['Золото', 'Ланцюжки, каблучки, брухт', 'Порахувати суму', 'одразу на сайті', '/calc'],
    ['Срібло', 'Столове, ювелірне, брухт', 'Порахувати суму', 'одразу на сайті', '/calc'],
    ['Годинники', 'Швейцарська механіка, вінтаж', 'Надіслати на оцінку', 'фахівець, протягом дня', '/zastava/hodynnyky'],
    ['Цифрова техніка', 'Телефони, ноутбуки, фото', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/tekhnika'],
    ['Побутова техніка', 'Холодильники, пральні', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/pobutova-tekhnika'],
    ['Інструмент', 'Перфоратори, бензопили', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/instrument'],
    ['Спорт і відпочинок', 'Велосипеди, тренажери', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/sport'],
  ],
  ru: [
    ['Золото', 'Цепочки, кольца, лом', 'Посчитать сумму', 'сразу на сайте', '/calc'],
    ['Серебро', 'Столовое, ювелирное, лом', 'Посчитать сумму', 'сразу на сайте', '/calc'],
    ['Часы', 'Швейцарская механика, винтаж', 'Отправить на оценку', 'специалист, в течение дня', '/zastava/hodynnyky'],
    ['Цифровая техника', 'Телефоны, ноутбуки, фото', 'Оценить по фото', 'специалист, в течение дня', '/zastava/tekhnika'],
    ['Бытовая техника', 'Холодильники, стиральные машины', 'Оценить по фото', 'специалист, в течение дня', '/zastava/pobutova-tekhnika'],
    ['Инструмент', 'Перфораторы, бензопилы', 'Оценить по фото', 'специалист, в течение дня', '/zastava/instrument'],
    ['Спорт и отдых', 'Велосипеды, тренажёры', 'Оценить по фото', 'специалист, в течение дня', '/zastava/sport'],
  ],
}

export async function zastavaMetadata(locale: L): Promise<Metadata> {
  const t = T[locale]
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: locale === 'ru' ? '/ru/zastava' : '/zastava',
      languages: { 'uk-UA': '/zastava', 'ru-UA': '/ru/zastava', 'x-default': '/zastava' },
    },
  }
}

export async function ZastavaContent({ locale }: { locale: L }) {
  const t = T[locale]
  const settings = await getSettings(locale)
  const hotline = String(settings.hotline || '0 800 30 85 00')

  return (
    <>
      <BreadcrumbSchema items={[
        { name: t.home, href: withLocale('/', locale) },
        { name: t.crumb, href: withLocale('/zastava', locale) },
      ]} />
      <SiteHeader hotline={hotline} locale={locale} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label={locale === 'ru' ? 'Путь' : 'Шлях'}>
              <a href={withLocale('/', locale)}>{t.home}</a><span aria-hidden="true">/</span><span>{t.crumb}</span>
            </nav>
            <div className="shead bhead">
              <h1>{t.h1}</h1>
              <p>{t.lede}</p>
            </div>

            <div className="grid grid--3" data-reveal-group>
              {CATEGORIES[locale].map(([name, sub, action, how, href]) => (
                <a className="card card--link" key={name} href={withLocale(href, locale)}>
                  <h3 style={{ fontSize: 'var(--s1)' }}>{name}</h3>
                  <p>{sub}</p>
                  <span className="card__act">{action}<i>→</i></span>
                  <span className="card__how">{how}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} locale={locale} />
    </>
  )
}

export default async function ZastavaPage() {
  return await ZastavaContent({ locale: 'uk' })
}

export async function generateMetadata(): Promise<Metadata> {
  return zastavaMetadata('uk')
}
