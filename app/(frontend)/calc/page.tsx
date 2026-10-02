import type { Metadata } from 'next'

import { getSiteData } from '@/lib/data.ts'
import { withLocale } from '@/lib/locale-utils.ts'
import { CATEGORIES } from '@/lib/categories.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import Calculator from '@/components/Calculator'
import TrackedLink from '@/components/TrackedLink.tsx'
import { BreadcrumbSchema, FaqSchema } from '@/components/Schema.tsx'
import '@/components/Calculator.css'
import '@/components/Branches.css'
import '@/components/Booking.css'

// Дані змінюються рідко — сторінка живе хвилину, як і головна
export const revalidate = 60

type L = 'uk' | 'ru'

/**
 * Питання йдуть і в розмітку для пошуку, і в саму сторінку — розділ 6 з чек-листа.
 * Перші чотири — ті самі, що на головній: рахунок один, дублювати відповіді
 * в різних місцях сенсу нема.
 */
const CALC_FAQ: Record<L, { q: string; a: string }[]> = {
  uk: [
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
  ],
  ru: [
    {
      q: 'Действительно ли дадут на месте столько, сколько показал сайт?',
      a: 'Да: гарантированный минимум — именно та сумма из расчёта. В отделении могут дать '
        + 'и больше, если состояние изделия лучше заявленного.',
    },
    {
      q: 'Нужно ли регистрироваться, чтобы посчитать сумму?',
      a: 'Нет. Расчёт открыт для всех, телефон понадобится только если захотите '
        + 'забронировать сумму в отделении.',
    },
    {
      q: 'Нужен ли паспорт?',
      a: 'Да. Договор оформляется на паспорт или ID-карту — это требование закона, '
        + 'одинаковое для всех ломбардов Украины.',
    },
    {
      q: 'Сколько времени занимает оценка?',
      a: 'Золото и серебро — около шести минут вместе с оформлением договора '
        + 'и выдачей наличных. Технику смотрит оценщик, это дольше.',
    },
  ],
}

const STEPS: Record<L, [string, string][]> = {
  uk: [
    ['Порахували суму', 'Тут, на сайті. Без телефону й реєстрації.'],
    ['Забронювали, якщо треба', 'Сума тримається 24 години в обраному відділенні.'],
    ['Приїхали з паспортом', 'Оцінювач зважить і перевірить пробу на місці.'],
    ['Підтвердили суму', 'Не нижче онлайн-розрахунку — це гарантія мережі.'],
    ['Отримали готівку', 'Одразу, без переказів і очікування.'],
  ],
  ru: [
    ['Посчитали сумму', 'Здесь, на сайте. Без телефона и регистрации.'],
    ['Забронировали, если нужно', 'Сумма держится 24 часа в выбранном отделении.'],
    ['Приехали с паспортом', 'Оценщик взвесит и проверит пробу на месте.'],
    ['Подтвердили сумму', 'Не ниже онлайн-расчёта — это гарантия сети.'],
    ['Получили наличные', 'Сразу, без переводов и ожидания.'],
  ],
}

const T = {
  uk: {
    title: 'Онлайн-оцінка золота, срібла й техніки — ломбард «Імперіал»',
    description: 'Порахуйте суму під заставу миттєво: вкажіть пробу й вагу — сума на руки '
      + 'і ставка на день з’являться одразу, без телефону й реєстрації.',
    home: 'Головна', crumb: 'Онлайн-оцінка',
    h1: 'Онлайн-оцінка золота, срібла й техніки',
    lede: 'Вкажіть пробу й вагу — сума на руки й ставка на день з’являться миттєво, без телефону і реєстрації.',
    stepsTag: '5 кроків', stepsH2: 'Як проходить оцінка',
    stepsLead: 'Від розрахунку на сайті до готівки на руках — без черг і зайвих дзвінків.',
    techTag: 'Оцінка за фото',
    techH2: 'Техніка, годинники та інше',
    techLead: 'Золото й срібло калькулятор рахує миттєво. Для решти — надішліть фото, '
      + 'фахівець відповість протягом робочого дня.',
    watchesName: 'Годинники', watchesSub: 'Швейцарська механіка, вінтаж',
    techAct: 'Оцінити за фото',
    faqH2: 'Питання про онлайн-оцінку',
  },
  ru: {
    title: 'Онлайн-оценка золота, серебра и техники — ломбард «Империал»',
    description: 'Посчитайте сумму под залог мгновенно: укажите пробу и вес — сумма на руки '
      + 'и ставка в день появятся сразу, без телефона и регистрации.',
    home: 'Главная', crumb: 'Онлайн-оценка',
    h1: 'Онлайн-оценка золота, серебра и техники',
    lede: 'Укажите пробу и вес — сумма на руки и ставка в день появятся мгновенно, без телефона и регистрации.',
    stepsTag: '5 шагов', stepsH2: 'Как проходит оценка',
    stepsLead: 'От расчёта на сайте до наличных на руках — без очередей и лишних звонков.',
    techTag: 'Оценка по фото',
    techH2: 'Техника, часы и другое',
    techLead: 'Золото и серебро калькулятор считает мгновенно. Для остального — пришлите фото, '
      + 'специалист ответит в течение рабочего дня.',
    watchesName: 'Часы', watchesSub: 'Швейцарская механика, винтаж',
    techAct: 'Оценить по фото',
    faqH2: 'Вопросы об онлайн-оценке',
  },
} satisfies Record<L, unknown>

export async function calcMetadata(locale: L): Promise<Metadata> {
  const t = T[locale]
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: locale === 'ru' ? '/ru/calc' : '/calc',
      languages: { 'uk-UA': '/calc', 'ru-UA': '/ru/calc', 'x-default': '/calc' },
    },
  }
}

export async function CalcContent({ locale }: { locale: L }) {
  const t = T[locale]
  const { tariffs, rateTiers, loyaltyTiers, branches, settings } = await getSiteData(locale)
  const s = settings as Record<string, string | number | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')
  const minDays = Number(s.minTermDays ?? 5)
  const maxDays = Number(s.maxTermDays ?? 30)

  return (
    <>
      <FaqSchema items={CALC_FAQ[locale]} />
      <BreadcrumbSchema items={[
        { name: t.home, href: withLocale('/', locale) },
        { name: t.crumb, href: withLocale('/calc', locale) },
      ]} />
      <SiteHeader hotline={hotline} locale={locale} />

      <main>
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label={locale === 'ru' ? 'Путь' : 'Шлях'}>
              <a href={withLocale('/', locale)}>{t.home}</a><span aria-hidden="true">/</span><span>{t.crumb}</span>
            </nav>
            <div className="shead" style={{ textAlign: 'center', margin: '0 auto 2rem', maxWidth: '46ch' }}>
              <h1>{t.h1}</h1>
              <p>{t.lede}</p>
            </div>
          </div>
        </section>

        {/* Без анімації появи: калькулятор — головний вміст сторінки й лежить
            прямо під коротким заголовком, тобто в першому екрані. */}
        <section className="wrap" style={{ paddingTop: 0, paddingBottom: 'clamp(3.6rem,7vw,6.4rem)' }}>
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
            locale={locale}
          />
        </section>

        <section className="sec sec--gray">
          <div className="wrap">
            <span className="tag">{t.techTag}</span>
            <h2>{t.techH2}</h2>
            <p className="lead">{t.techLead}</p>
            <div className="grid grid--4" data-reveal-group>
              <TrackedLink location="calc_card_hodynnyky" className="card card--link" href={withLocale('/zastava/hodynnyky', locale)}>
                <h3 style={{ fontSize: 'var(--s1)' }}>{t.watchesName}</h3>
                <p>{t.watchesSub}</p>
                <span className="card__act">{t.techAct}<i>→</i></span>
              </TrackedLink>
              {CATEGORIES[locale].map((c) => (
                <TrackedLink location={`calc_card_${c.slug}`} className="card card--link" key={c.slug} href={withLocale(`/zastava/${c.slug}`, locale)}>
                  <h3 style={{ fontSize: 'var(--s1)' }}>{c.name}</h3>
                  <p>{c.take[0]}</p>
                  <span className="card__act">{t.techAct}<i>→</i></span>
                </TrackedLink>
              ))}
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <span className="tag">{t.stepsTag}</span>
            <h2>{t.stepsH2}</h2>
            <p className="lead">{t.stepsLead}</p>
            <div className="steps">
              {STEPS[locale].map(([title, text], i) => (
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
            <h2>{t.faqH2}</h2>
            <div className="faq">
              {CALC_FAQ[locale].map(({ q, a }) => (
                <details className="q" key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} locale={locale} />
    </>
  )
}

export default async function CalcPage() {
  return await CalcContent({ locale: 'uk' })
}

export async function generateMetadata(): Promise<Metadata> {
  return calcMetadata('uk')
}
