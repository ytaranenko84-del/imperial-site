import type { Metadata } from 'next'

import { getSiteData } from '@/lib/data.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import Calculator from '@/components/Calculator'
import { BreadcrumbSchema, FaqSchema } from '@/components/Schema.tsx'
import '@/components/Calculator.css'
import '@/components/Branches.css'
import '@/components/Booking.css'

// Дані змінюються рідко — сторінка живе хвилину, як і головна
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Онлайн-оцінка золота, срібла й техніки — ломбард «Імперіал»',
  description: 'Порахуйте суму під заставу миттєво: вкажіть пробу й вагу — сума на руки '
    + 'і ставка на день з’являться одразу, без телефону й реєстрації.',
  alternates: { canonical: '/calc' },
}

/**
 * Питання йдуть і в розмітку для пошуку, і в саму сторінку — розділ 6 з чек-листа.
 * Перші чотири — ті самі, що на головній: рахунок один, дублювати відповіді
 * в різних місцях сенсу нема.
 */
const CALC_FAQ = [
  {
    q: 'Чи справді дадуть на місці стільки, скільки показав сайт?',
    a: 'Так: гарантований мінімум — саме та сума з розрахунку. У відділенні можуть дати '
      + 'й більше, якщо стан виробу кращий за заявлений.',
  },
  {
    q: 'Чи потрібно реєструватись, щоб порахувати суму?',
    a: 'Ні. Розрахунок відкритий для всіх, телефон знадобиться лише якщо захочете '
      + 'забронювати суму у відділенні.',
  },
  {
    q: 'Чи потрібен паспорт?',
    a: 'Так. Договір оформлюється на паспорт або ID-картку — це вимога закону, '
      + 'однакова для всіх ломбардів України.',
  },
  {
    q: 'Скільки часу займає оцінка?',
    a: 'Золото й срібло — близько шести хвилин разом з оформленням договору '
      + 'і видачею готівки. Техніку дивиться оцінювач, це довше.',
  },
]

const STEPS: [string, string][] = [
  ['Порахували суму', 'Тут, на сайті. Без телефону й реєстрації.'],
  ['Забронювали, якщо треба', 'Сума тримається 24 години в обраному відділенні.'],
  ['Приїхали з паспортом', 'Оцінювач зважить і перевірить пробу на місці.'],
  ['Підтвердили суму', 'Не нижче онлайн-розрахунку — це гарантія мережі.'],
  ['Отримали готівку', 'Одразу, без переказів і очікування.'],
]

export default async function CalcPage() {
  const { tariffs, rateTiers, loyaltyTiers, branches, settings } = await getSiteData()
  const s = settings as Record<string, string | number | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')
  const minDays = Number(s.minTermDays ?? 5)
  const maxDays = Number(s.maxTermDays ?? 30)

  return (
    <>
      <FaqSchema items={CALC_FAQ} />
      <BreadcrumbSchema items={[
        { name: 'Головна', href: '/' },
        { name: 'Онлайн-оцінка', href: '/calc' },
      ]} />
      <SiteHeader hotline={hotline} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label="Шлях">
              <a href="/">Головна</a><span aria-hidden="true">/</span><span>Онлайн-оцінка</span>
            </nav>
            <div className="shead" style={{ textAlign: 'center', margin: '0 auto 2rem', maxWidth: '46ch' }}>
              <h1>Онлайн-оцінка золота, срібла й техніки</h1>
              <p>
                Вкажіть пробу й вагу — сума на руки й ставка на день з&apos;являться миттєво,
                без телефону і реєстрації.
              </p>
            </div>
          </div>
        </section>

        <section className="wrap" style={{ paddingTop: 0, paddingBottom: 'clamp(3.6rem,7vw,6.4rem)' }} data-reveal>
          <Calculator
            tariffs={tariffs}
            rateTiers={rateTiers}
            loyaltyTiers={loyaltyTiers}
            minDays={minDays}
            maxDays={maxDays}
            guaranteeText={s.guaranteeOn ? String(s.guaranteeText || '') : null}
            branches={branches}
            bonusWeightLimit={Number(s.bonusWeightLimit ?? 0)}
            bonusWeightPurity={Number(s.bonusWeightPurity ?? 585)}
          />
        </section>

        <section className="sec">
          <div className="wrap">
            <span className="tag">5 кроків</span>
            <h2>Як проходить оцінка</h2>
            <p className="lead">Від розрахунку на сайті до готівки на руках — без черг і зайвих дзвінків.</p>
            <div className="steps">
              {STEPS.map(([title, text], i) => (
                <div className="step" key={title}>
                  <b className="step__n">{i + 1}</b>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <h2>Питання про онлайн-оцінку</h2>
            <div className="faq">
              {CALC_FAQ.map(({ q, a }) => (
                <details className="q" key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </>
  )
}
