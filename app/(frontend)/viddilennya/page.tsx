import type { Metadata } from 'next'

import { getSiteData } from '@/lib/data.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import Branches from '@/components/Branches'
import { BreadcrumbSchema, OrganizationSchema } from '@/components/Schema.tsx'
import '@/components/Branches.css'

// Дані змінюються рідко — сторінка живе десять хвилин і не ходить у базу на кожен показ
export const revalidate = 600

export const metadata: Metadata = {
  title: 'Відділення ломбарду «Імперіал» у Дніпрі — адреси, графік, телефони',
  description: 'Усі відділення ломбарду «Імперіал» у Дніпрі на карті: адреси, '
    + 'години роботи, маршрут у навігаторі. Пошук за вулицею та «найближче до мене».',
  alternates: { canonical: '/viddilennya' },
}

export default async function BranchesPage() {
  const { branches, settings } = await getSiteData()
  const s = settings as Record<string, string | number | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')

  const roundClock = branches.filter((b) => b.roundClock).length
  const onMap = branches.filter((b) => b.lat != null && b.lng != null).length

  return (
    <>
      <OrganizationSchema branches={branches} hotline={hotline} minRate="0,39" />
      <BreadcrumbSchema items={[
        { name: 'Головна', href: '/' },
        { name: 'Відділення', href: '/viddilennya' },
      ]} />

      <SiteHeader hotline={hotline} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label="Шлях">
              <a href="/">Головна</a>
              <span aria-hidden="true">/</span>
              <span>Відділення</span>
            </nav>

            <div className="shead bhead">
              <h1>Відділення у Дніпрі</h1>
              <p>
                {branches.length} відділень на карті міста. Оцінка однакова в кожному —
                прайс спільний для мережі. Гаряча лінія{' '}
                <a href={`tel:${hotline.replace(/\s/g, '')}`}>{hotline}</a> працює цілодобово.
              </p>
            </div>

            <dl className="bfacts">
              <div><dt>Відділень</dt><dd>{branches.length}</dd></div>
              <div><dt>На карті</dt><dd>{onMap}</dd></div>
              {roundClock > 0 && <div><dt>Цілодобово</dt><dd>{roundClock}</dd></div>}
              <div><dt>Місто</dt><dd>Дніпро</dd></div>
            </dl>
          </div>
        </section>

        <Branches
          branches={branches}
          heading={null}
          lead={null}
        />

        <section className="sec">
          <div className="wrap bnote">
            <h2>Як обрати відділення</h2>
            <p>
              Сума не залежить від відділення: прайс за грам однаковий у всій мережі,
              як і ставка за сумою позики. Тому обирайте найближче — кнопка
              «Найближче до мене» визначить його за вашим місцем.
            </p>
            <p>
              Частину відділень у місті досі знають за старими назвами вулиць. Пошук
              вище розуміє і їх: наберіть «Косіора» чи «Правди» — знайде потрібне.
              Якщо в одному будинку два відділення, під адресою стоїть орієнтир.
            </p>
            <p>
              Не впевнені, чи приймуть вашу річ, — зателефонуйте на гарячу лінію
              перед виїздом. Оцінку можна порахувати заздалегідь у{' '}
              <a href="/#calc">калькуляторі</a> й забронювати суму: вона тримається
              24 години, але не довше, ніж до закриття відділення.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </>
  )
}
