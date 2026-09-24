import type { Metadata } from 'next'

import { getSiteData } from '@/lib/data.ts'
import { withLocale } from '@/lib/locale-utils.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import Branches from '@/components/Branches'
import { BreadcrumbSchema, OrganizationSchema } from '@/components/Schema.tsx'
import '@/components/Branches.css'

// Дані змінюються рідко — сторінка живе десять хвилин і не ходить у базу на кожен показ
export const revalidate = 600

type L = 'uk' | 'ru'

const T = {
  uk: {
    title: 'Відділення ломбарду «Імперіал» у Дніпрі — адреси, графік, телефони',
    description: 'Усі відділення ломбарду «Імперіал» у Дніпрі на карті: адреси, '
      + 'години роботи, маршрут у навігаторі. Пошук за вулицею та «найближче до мене».',
    home: 'Головна', crumb: 'Відділення',
    h1: 'Відділення у Дніпрі',
    lede: (n: number, hotline: string) => (
      <>
        {n} відділень на карті міста. Оцінка однакова в кожному —
        прайс спільний для мережі. Гаряча лінія{' '}
        <a href={`tel:${hotline.replace(/\s/g, '')}`}>{hotline}</a> працює цілодобово.
      </>
    ),
    factBranches: 'Відділень', factOnMap: 'На карті', factRoundClock: 'Цілодобово', factCity: 'Місто', city: 'Дніпро',
    h2: 'Як обрати відділення',
    p1: 'Сума не залежить від відділення: прайс за грам однаковий у всій мережі, '
      + 'як і ставка за сумою позики. Тому обирайте найближче — кнопка '
      + '«Найближче до мене» визначить його за вашим місцем.',
    p2: 'Частину відділень у місті досі знають за старими назвами вулиць. Пошук '
      + 'вище розуміє і їх: наберіть «Косіора» чи «Правди» — знайде потрібне. '
      + 'Якщо в одному будинку два відділення, під адресою стоїть орієнтир.',
    p3: (
      <>
        Не впевнені, чи приймуть вашу річ, — зателефонуйте на гарячу лінію
        перед виїздом. Оцінку можна порахувати заздалегідь у{' '}
        <a href="/calc">калькуляторі</a> й забронювати суму: вона тримається
        24 години, але не довше, ніж до закриття відділення.
      </>
    ),
  },
  ru: {
    title: 'Отделения ломбарда «Империал» в Днепре — адреса, график, телефоны',
    description: 'Все отделения ломбарда «Империал» в Днепре на карте: адреса, '
      + 'часы работы, маршрут в навигаторе. Поиск по улице и «ближайшее ко мне».',
    home: 'Главная', crumb: 'Отделения',
    h1: 'Отделения в Днепре',
    lede: (n: number, hotline: string) => (
      <>
        {n} отделений на карте города. Оценка одинаковая в каждом —
        прайс общий для сети. Горячая линия{' '}
        <a href={`tel:${hotline.replace(/\s/g, '')}`}>{hotline}</a> работает круглосуточно.
      </>
    ),
    factBranches: 'Отделений', factOnMap: 'На карте', factRoundClock: 'Круглосуточно', factCity: 'Город', city: 'Днепр',
    h2: 'Как выбрать отделение',
    p1: 'Сумма не зависит от отделения: прайс за грамм одинаковый по всей сети, '
      + 'как и ставка по сумме займа. Поэтому выбирайте ближайшее — кнопка '
      + '«Ближайшее ко мне» определит его по вашему месту.',
    p2: 'Часть отделений в городе до сих пор знают по старым названиям улиц. Поиск '
      + 'выше понимает и их: наберите «Косиора» или «Правды» — найдёт нужное. '
      + 'Если в одном доме два отделения, под адресом стоит ориентир.',
    p3: (
      <>
        Не уверены, примут ли вашу вещь, — позвоните на горячую линию
        перед выездом. Оценку можно посчитать заранее в{' '}
        <a href="/ru/calc">калькуляторе</a> и забронировать сумму: она держится
        24 часа, но не дольше, чем до закрытия отделения.
      </>
    ),
  },
} satisfies Record<L, unknown>

export async function viddilennyaMetadata(locale: L): Promise<Metadata> {
  const t = T[locale]
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: locale === 'ru' ? '/ru/viddilennya' : '/viddilennya',
      languages: { 'uk-UA': '/viddilennya', 'ru-UA': '/ru/viddilennya', 'x-default': '/viddilennya' },
    },
  }
}

export async function ViddilennyaContent({ locale }: { locale: L }) {
  const t = T[locale]
  const { branches, settings } = await getSiteData(locale)
  const s = settings as Record<string, string | number | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')

  const roundClock = branches.filter((b) => b.roundClock).length
  const onMap = branches.filter((b) => b.lat != null && b.lng != null).length

  return (
    <>
      <OrganizationSchema branches={branches} hotline={hotline} minRate="0,39" locale={locale} includeBranches />
      <BreadcrumbSchema items={[
        { name: t.home, href: withLocale('/', locale) },
        { name: t.crumb, href: withLocale('/viddilennya', locale) },
      ]} />

      <SiteHeader hotline={hotline} locale={locale} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label={locale === 'ru' ? 'Путь' : 'Шлях'}>
              <a href={withLocale('/', locale)}>{t.home}</a>
              <span aria-hidden="true">/</span>
              <span>{t.crumb}</span>
            </nav>

            <div className="shead bhead">
              <h1>{t.h1}</h1>
              <p>{t.lede(branches.length, hotline)}</p>
            </div>

            <dl className="bfacts">
              <div><dt>{t.factBranches}</dt><dd>{branches.length}</dd></div>
              <div><dt>{t.factOnMap}</dt><dd>{onMap}</dd></div>
              {roundClock > 0 && <div><dt>{t.factRoundClock}</dt><dd>{roundClock}</dd></div>}
              <div><dt>{t.factCity}</dt><dd>{t.city}</dd></div>
            </dl>
          </div>
        </section>

        <Branches
          branches={branches}
          heading={null}
          lead={null}
          locale={locale}
        />

        <section className="sec">
          <div className="wrap bnote">
            <h2>{t.h2}</h2>
            <p>{t.p1}</p>
            <p>{t.p2}</p>
            <p>{t.p3}</p>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} locale={locale} />
    </>
  )
}

export default async function BranchesPage() {
  return await ViddilennyaContent({ locale: 'uk' })
}

export async function generateMetadata(): Promise<Metadata> {
  return viddilennyaMetadata('uk')
}
