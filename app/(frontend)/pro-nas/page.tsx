import type { Metadata } from 'next'

import { getSiteData } from '@/lib/data.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { BreadcrumbSchema } from '@/components/Schema.tsx'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Про ломбард «Імперіал» — мережа з 2008 року',
  description: 'Мережа ломбардів «Імперіал» у Дніпрі: 28 відділень, ліцензія НБУ, '
    + 'ставка від 0,39% на день. Історія мережі та принципи роботи.',
  alternates: { canonical: '/pro-nas' },
}

export default async function AboutPage() {
  const { branches, settings } = await getSiteData()
  const s = settings as Record<string, string | number | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')
  const years = new Date().getFullYear() - 2008

  return (
    <>
      <BreadcrumbSchema items={[
        { name: 'Головна', href: '/' },
        { name: 'Про ломбард', href: '/pro-nas' },
      ]} />
      <SiteHeader hotline={hotline} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label="Шлях">
              <a href="/">Головна</a><span aria-hidden="true">/</span><span>Про ломбард</span>
            </nav>
            <div className="shead bhead">
              <h1>Про ломбард «Імперіал»</h1>
              <p>
                Мережа ломбардів у Дніпрі: {branches.length} відділень, {years} років на ринку,
                ліцензована діяльність під наглядом Національного банку України.
              </p>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap bnote">
            <h2>Хто ми</h2>
            <p>
              «Імперіал» працює з 2008 року — приймаємо під заставу золото, срібло, техніку,
              інструмент і спортивний інвентар. Оцінюємо на місці або за фото, видаємо готівку
              одразу після оформлення договору.
            </p>
            <p>
              Річ, яку ви залишаєте під заставу, лишається вашою: вона зберігається в сейфі
              відділення під охороною і не потрапляє у продаж, доки діє договір. Стан речі
              фіксуємо в договорі разом із вами — до найдрібнішої подряпини, а майно
              застраховане на повну суму оцінки на весь строк застави.
            </p>
            <p>
              Ставка — від 0,39% на день, точний розмір залежить від суми позики й статусу
              в програмі лояльності. Порахувати суму під ваш виріб можна заздалегідь —{' '}
              <a href="/calc">калькулятор</a> показує результат миттєво, без реєстрації.
            </p>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <h2>Де знайти відділення</h2>
            <p className="lead">
              {branches.length} відділень у Дніпрі — адреси, графік роботи й маршрут
              до кожного на окремій сторінці.
            </p>
            <a className="pill" href="/viddilennya">Усі відділення →</a>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </>
  )
}
