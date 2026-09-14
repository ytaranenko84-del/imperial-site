import type { Metadata } from 'next'

import { getSettings } from '@/lib/data.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { BreadcrumbSchema } from '@/components/Schema.tsx'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Що приймаємо в заставу — ломбард «Імперіал»',
  description: 'Золото, срібло, годинники, техніка, інструмент і спортивний інвентар. '
    + 'Метали рахує калькулятор миттєво, решту оцінює фахівець за фото.',
  alternates: { canonical: '/zastava' },
}

/** [назва, підпис, дія, спосіб оцінки, посилання] — той самий перелік, що на головній. */
const CATEGORIES: [string, string, string, string, string][] = [
  ['Золото', 'Ланцюжки, каблучки, брухт', 'Порахувати суму', 'одразу на сайті', '/calc'],
  ['Срібло', 'Столове, ювелірне, брухт', 'Порахувати суму', 'одразу на сайті', '/calc'],
  ['Годинники', 'Швейцарська механіка, вінтаж', 'Надіслати на оцінку', 'фахівець, протягом дня', '/zastava/hodynnyky'],
  ['Цифрова техніка', 'Телефони, ноутбуки, фото', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/tekhnika'],
  ['Побутова техніка', 'Холодильники, пральні', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/pobutova-tekhnika'],
  ['Інструмент', 'Перфоратори, бензопили', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/instrument'],
  ['Спорт і відпочинок', 'Велосипеди, тренажери', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/sport'],
]

export default async function ZastavaPage() {
  const settings = await getSettings()
  const hotline = String(settings.hotline || '0 800 30 85 00')

  return (
    <>
      <BreadcrumbSchema items={[
        { name: 'Головна', href: '/' },
        { name: 'Що приймаємо', href: '/zastava' },
      ]} />
      <SiteHeader hotline={hotline} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label="Шлях">
              <a href="/">Головна</a><span aria-hidden="true">/</span><span>Що приймаємо</span>
            </nav>
            <div className="shead bhead">
              <h1>Що приймаємо в заставу</h1>
              <p>Золото і срібло рахує калькулятор одразу. Решту оцінює фахівець за фото.</p>
            </div>

            <div className="grid grid--3" data-reveal-group>
              {CATEGORIES.map(([name, sub, action, how, href]) => (
                <a className="card card--link" key={name} href={href}>
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

      <SiteFooter settings={settings} />
    </>
  )
}
