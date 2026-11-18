import type { Metadata } from 'next'

import { getSiteData, type LoyaltyTier, type RateTier, type Tariff } from '@/lib/data.ts'
import { withLocale } from '@/lib/locale-utils.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import Calculator from '@/components/Calculator'
import TrackedLink from '@/components/TrackedLink.tsx'
import { BreadcrumbSchema, FaqSchema } from '@/components/Schema.tsx'
import '@/components/Calculator.css'
import '@/components/Branches.css'
import '@/components/Booking.css'
import '@/components/GoldPrice.css'

/**
 * «Ціна золота в ломбарді» — відповідь на пошукові запити про ціну за грам
 * («ціна золота в ломбарді», «грам золота 585», «7 грам золота ціна»).
 * За Search Console таких запитів сотні, а окремої сторінки не було — ми
 * стояли на 10–30 місці. Ескіз погоджено 18.11.2026 (imperial-tsina-zolota-eskiz-v2).
 *
 * Жодної цифри тут не вписано руками: усе рахується з прайсу («Тарифи за
 * грам»), статусів і ставок в адмінці. Змінили прайс — змінились і заголовок
 * у Google, і таблиці, і приклади.
 */

export const revalidate = 60

type L = 'uk' | 'ru'

const T = {
  uk: {
    home: 'Головна', crumb: 'Ціна золота',
    title: (p: string) => `Ціна золота в ломбарді за грам — 585 проба до ${p} грн | «Імперіал»`,
    description: (max: string, buy: string) => `Ціна золота за грам: 585 проба — до ${max} грн під заставу, скупка ${buy} грн. `
      + 'Усі проби від 333 до 999, лом за тим самим прайсом. Порахуйте суму онлайн без реєстрації.',
    h1: 'Ціна золота за грам у ломбарді «Імперіал»',
    lede: 'Скільки дамо за грам під заставу і скільки заплатимо, якщо продаєте назавжди. '
      + 'Ціна однакова в усіх відділеннях і змінюється разом із ціною золота на світовій біржі.',
    priceFrom: (d: string) => `Прайс від ${d}`,
    heroLbl: '585 проба · під заставу',
    upTo: 'до',
    perGram: 'грн/г',
    heroSub: (tier: string, base: string, buy: string) => <>зі статусом «{tier}» · за прайсом <b>{base}</b> · скупка <b>{buy} грн/г</b></>,
    ctaCalc: 'Порахувати мою суму',
    ctaBranches: 'Найближче відділення',
    thPurity: 'Проба', thBase: 'Під заставу', thNew: (b: number) => `Новому клієнту +${b}%`,
    thMax: 'Максимум зі статусом', thBuy: 'Скупка', thPledge: 'Застава',
    silver: 'Срібло',
    tableNote: (limits: string) => `Ціни в гривнях за 1 грам. Надбавка статусу діє на вироби до ${limits}.`,
    shortNote: (tier: string) => `«До» — зі статусом «${tier}». Свою суму — у калькуляторі нижче.`,
    weightH2: 'Скільки дадуть за вашу прикрасу',
    weightLead: 'Під заставу, за прайсом без надбавок. Обручка — зазвичай 2–4 г, ланцюжок — 5–15 г.',
    thWeight: 'Вага', g: 'г', probaCol: (p: string) => `${p} проба`,
    calcH2: 'Порахуйте точно',
    calcLead: 'Вкажіть пробу, вагу й свій статус — сума з’явиться одразу. Тут же можна забронювати її у відділенні.',
    vsH2: 'Застава чи скупка — що вибрати',
    pledgeH: 'Застава', pledgeSub: 'Прикраса повертається вам.',
    pledgeText: (w: string, days: number, total: string) => <>за {w} г 585-ї. Через {days} днів повертаєте <b>{total} грн</b> і забираєте прикрасу.</>,
    buyH: 'Скупка', buySub: 'Гроші назавжди, повертати нічого.',
    buyText: (w: string) => <>за {w} г 585-ї. Прикраса залишається в ломбарді.</>,
    probaH2: 'Як перерахувати пробу',
    probaText: (a: string, b: string) => `Проба — це скільки чистого золота в 1000 частинах: 585 проба — це 58,5% золота. `
      + `Тому 10 г 999-ї проби за ціною — як ${a} г 585-ї, а 10 г 375-ї — як ${b} г 585-ї. `
      + 'Наш прайс рахується саме так: ціна за грам пропорційна вмісту золота.',
    faqH2: 'Питання про ціну золота',
    citiesH2: 'Де здати золото',
    citiesLead: (n: number, c: number) => `${n} відділень у ${c} містах. Ціна однакова скрізь.`,
  },
  ru: {
    home: 'Главная', crumb: 'Цена золота',
    title: (p: string) => `Цена золота в ломбарде за грамм — 585 проба до ${p} грн | «Империал»`,
    description: (max: string, buy: string) => `Цена золота за грамм: 585 проба — до ${max} грн под залог, скупка ${buy} грн. `
      + 'Все пробы от 333 до 999, лом по тому же прайсу. Посчитайте сумму онлайн без регистрации.',
    h1: 'Цена золота за грамм в ломбарде «Империал»',
    lede: 'Сколько дадим за грамм под залог и сколько заплатим, если продаёте навсегда. '
      + 'Цена одинакова во всех отделениях и меняется вместе с ценой золота на мировой бирже.',
    priceFrom: (d: string) => `Прайс от ${d}`,
    heroLbl: '585 проба · под залог',
    upTo: 'до',
    perGram: 'грн/г',
    heroSub: (tier: string, base: string, buy: string) => <>со статусом «{tier}» · по прайсу <b>{base}</b> · скупка <b>{buy} грн/г</b></>,
    ctaCalc: 'Посчитать мою сумму',
    ctaBranches: 'Ближайшее отделение',
    thPurity: 'Проба', thBase: 'Под залог', thNew: (b: number) => `Новому клиенту +${b}%`,
    thMax: 'Максимум со статусом', thBuy: 'Скупка', thPledge: 'Залог',
    silver: 'Серебро',
    tableNote: (limits: string) => `Цены в гривнах за 1 грамм. Надбавка статуса действует на изделия до ${limits}.`,
    shortNote: (tier: string) => `«До» — со статусом «${tier}». Свою сумму — в калькуляторе ниже.`,
    weightH2: 'Сколько дадут за ваше украшение',
    weightLead: 'Под залог, по прайсу без надбавок. Обручальное кольцо — обычно 2–4 г, цепочка — 5–15 г.',
    thWeight: 'Вес', g: 'г', probaCol: (p: string) => `${p} проба`,
    calcH2: 'Посчитайте точно',
    calcLead: 'Укажите пробу, вес и свой статус — сумма появится сразу. Здесь же можно забронировать её в отделении.',
    vsH2: 'Залог или скупка — что выбрать',
    pledgeH: 'Залог', pledgeSub: 'Украшение возвращается к вам.',
    pledgeText: (w: string, days: number, total: string) => <>за {w} г 585-й. Через {days} дней возвращаете <b>{total} грн</b> и забираете украшение.</>,
    buyH: 'Скупка', buySub: 'Деньги навсегда, возвращать ничего не нужно.',
    buyText: (w: string) => <>за {w} г 585-й. Украшение остаётся в ломбарде.</>,
    probaH2: 'Как пересчитать пробу',
    probaText: (a: string, b: string) => `Проба — это сколько чистого золота в 1000 частях: 585 проба — это 58,5% золота. `
      + `Поэтому 10 г 999-й пробы по цене — как ${a} г 585-й, а 10 г 375-й — как ${b} г 585-й. `
      + 'Наш прайс считается именно так: цена за грамм пропорциональна содержанию золота.',
    faqH2: 'Вопросы о цене золота',
    citiesH2: 'Где сдать золото',
    citiesLead: (n: number, c: number) => `${n} отделений в ${c} городах. Цена одинакова везде.`,
  },
} satisfies Record<L, unknown>

const grn = (n: number) => Math.round(n).toLocaleString('uk-UA')
const dec = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')
const pct = (n: number) => String(+n.toFixed(2)).replace('.', ',')

/** Ціна за грам зі статусом — так само, як рахує калькулятор: база × (1 + надбавка). */
const perGram = (t: Tariff, bonus: number) => Math.round(t.basePrice * (1 + bonus / 100))

function rateFor(tiers: RateTier[], amount: number): RateTier | null {
  if (!tiers.length) return null
  return tiers.find((t) => amount >= t.amountFrom && (t.amountTo == null || amount <= t.amountTo)) ?? tiers[tiers.length - 1]
}

function priceDate(tariffs: Tariff[], locale: L): string | null {
  const ms = tariffs.map((t) => (t.approvedAt ? new Date(t.approvedAt).getTime() : 0)).filter((n) => n > 0)
  if (!ms.length) return null
  return new Date(Math.max(...ms))
    .toLocaleDateString(locale === 'ru' ? 'ru-UA' : 'uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' })
    .replace(/\s*(р|г)\.$/, '')
}

/** Усе, що сторінка рахує з прайсу, — в одному місці: і для метаданих, і для самої сторінки. */
function compute(tariffs: Tariff[], loyaltyTiers: LoyaltyTier[], rateTiers: RateTier[], settings: Record<string, unknown>) {
  const gold = tariffs.filter((t) => t.metal === 'gold')
  const silver = tariffs.filter((t) => t.metal === 'silver')
  const t585 = gold.find((t) => t.purityLabel.startsWith('585')) ?? gold[0]
  const maxTier = loyaltyTiers.reduce<LoyaltyTier | null>((m, t) => (!m || t.metalBonus > m.metalBonus ? t : m), null)
  const newTier = loyaltyTiers[0] ?? null
  const limit = Number(settings.bonusWeightLimit ?? 0)
  const limitPurity = Number(settings.bonusWeightPurity ?? 585)
  const limitFor = (t: Tariff) => (limit && t.purity ? (limit * limitPurity) / t.purity : 0)
  return { gold, silver, t585, maxTier, newTier, limit, limitPurity, limitFor }
}

export async function goldMetadata(locale: L): Promise<Metadata> {
  const t = T[locale]
  const { tariffs, loyaltyTiers, rateTiers, settings } = await getSiteData(locale)
  const { t585, maxTier } = compute(tariffs, loyaltyTiers, rateTiers, settings)
  const max = t585 ? grn(perGram(t585, maxTier?.metalBonus ?? 0)) : ''
  const buy = t585 ? grn(t585.purchasePrice ?? t585.basePrice) : ''
  return {
    title: t585 ? t.title(max) : t.h1,
    description: t585 ? t.description(max, buy) : t.lede,
    alternates: {
      canonical: locale === 'ru' ? '/ru/tsina-zolota' : '/tsina-zolota',
      languages: { 'uk-UA': '/tsina-zolota', 'ru-UA': '/ru/tsina-zolota', 'x-default': '/tsina-zolota' },
    },
  }
}

export async function GoldContent({ locale }: { locale: L }) {
  const t = T[locale]
  const { tariffs, rateTiers, loyaltyTiers, branches, settings } = await getSiteData(locale)
  const s = settings as Record<string, string | number | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')
  const telegram = (s.telegram as string) || null
  const minDays = Number(s.minTermDays ?? 5)
  const maxDays = Number(s.maxTermDays ?? 30)

  const { gold, silver, t585, maxTier, newTier, limit, limitFor } = compute(tariffs, loyaltyTiers, rateTiers, settings)
  const maxBonus = maxTier?.metalBonus ?? 0
  const newBonus = newTier?.metalBonus ?? 0
  const date = priceDate(tariffs, locale)

  // Межа надбавки: «20 г 585-ї проби (999 — до 11,7 г, 750 — до 15,6 г, 375 — до 31,2 г)»
  const limitOthers = gold
    .filter((g) => g !== t585 && g.purity && ((g.purity > 990) || [750, 375].includes(Math.round(g.purity))))
    .map((g) => `${g.purityLabel.split('.')[0]} — до ${dec(limitFor(g))} г`)
  const limitText = limit && t585
    ? `${dec(limitFor(t585))} г ${locale === 'ru' ? '585-й пробы' : '585-ї проби'}${limitOthers.length ? ` (${limitOthers.join(', ')})` : ''}`
    : ''

  // Готові суми за вагою — три найпоширеніші проби
  const weightCols = ['585', '750', '375']
    .map((p) => gold.find((g) => g.purityLabel.startsWith(p)))
    .filter((g): g is Tariff => Boolean(g))
  const WEIGHTS = [1, 2, 3, 5, 7, 10, 15, 20]

  // Застава чи скупка: 5 г 585-ї на 14 днів
  const exW = 5
  const exDays = Math.min(14, maxDays)
  const exLoan = t585 ? t585.basePrice * exW : 0
  const exRate = rateFor(rateTiers, exLoan)
  const exInterest = exRate ? (exRate.unit === 'uah' ? exRate.rate * exDays : exLoan * (exRate.rate / 100) * exDays) : 0
  const exBuy = t585 ? (t585.purchasePrice ?? t585.basePrice) * exW : 0

  // Перерахунок проб: 10 г 999-ї та 375-ї в «грамах 585-ї»
  const p999 = gold.find((g) => (g.purity ?? 0) > 990)
  const p375 = gold.find((g) => g.purityLabel.startsWith('375'))
  const as585 = (g?: Tariff) => (g?.purity && t585?.purity ? dec((10 * g.purity) / t585.purity) : '')

  // Ставки для відповіді в питаннях: лише відсоткові, від меншої суми до більшої
  const pctTiers = rateTiers.filter((r) => r.unit === 'percent')
  const maxDiscount = loyaltyTiers.reduce((m, x) => Math.max(m, x.discount), 0)
  const minRate = pctTiers.length ? Math.min(...pctTiers.map((r) => r.rate)) * (1 - maxDiscount / 100) : 0
  const rateText = pctTiers.map((r, i) => (i === 0
    ? `${locale === 'ru' ? 'до' : 'до'} ${grn((pctTiers[1]?.amountFrom ?? r.amountTo ?? 0))} грн — ${pct(r.rate)}% ${locale === 'ru' ? 'в день' : 'на день'}`
    : `${locale === 'ru' ? 'от' : 'від'} ${grn(r.amountFrom)} — ${pct(r.rate)}%`)).join(', ')

  const maxName = maxTier?.name ?? ''
  const faq = locale === 'ru'
    ? [
        { q: 'Как часто меняется цена?', a: 'Цена меняется вместе с ценой золота на мировой бирже. Актуальный прайс и дата его обновления — вверху страницы.' },
        { q: 'Одинакова ли цена во всех отделениях?', a: 'Да. Цена за грамм одинакова во всех отделениях «Империала».' },
        { q: 'Учитывается ли вес камней и вставок?', a: 'Да. Вес камней и вставок вычитается из веса изделия — оцениваем золото.' },
        { q: 'Принимаете ли лом и сломанные украшения?', a: 'Да, по тому же прайсу, что и целые изделия — и порванные цепочки, и одну серёжку без пары.' },
        { q: 'Что нужно, чтобы сдать золото?', a: 'Паспорт или ID-карта — договор оформляется на документ, это требование закона. Оценщик взвесит изделие и проверит пробу на месте, вместе с оформлением — около шести минут.' },
        { q: 'Какая ставка под залог золота?', a: `Зависит от суммы: ${rateText}. Постоянным клиентам скидка на проценты до ${maxDiscount}% — ставка от ${pct(minRate)}% в день.` },
        ...(t585 && maxTier ? [{ q: `Что значит «до ${grn(perGram(t585, maxBonus))} грн»?`, a: `Это цена для клиентов со статусом «${maxName}» (+${maxBonus}% к оценке). По базовому прайсу 585 проба — ${grn(t585.basePrice)} грн/г, новому клиенту — ${grn(perGram(t585, newBonus))}. Надбавка статуса действует на изделия до ${dec(limitFor(t585))} г 585-й пробы. Свою сумму посчитайте в калькуляторе выше.` }] : []),
      ]
    : [
        { q: 'Як часто змінюється ціна?', a: 'Ціна змінюється разом із ціною золота на світовій біржі. Актуальний прайс і дата його оновлення — вгорі сторінки.' },
        { q: 'Чи однакова ціна в усіх відділеннях?', a: 'Так. Ціна за грам однакова в усіх відділеннях «Імперіалу».' },
        { q: 'Чи враховується вага каменів і вставок?', a: 'Так. Вага каменів і вставок віднімається від ваги виробу — оцінюємо золото.' },
        { q: 'Чи приймаєте лом і зламані прикраси?', a: 'Так, за тим самим прайсом, що й цілі вироби — і порвані ланцюжки, і одна сережка без пари.' },
        { q: 'Що потрібно, щоб здати золото?', a: 'Паспорт або ID-картка — договір оформлюється на документ, це вимога закону. Оцінювач зважить виріб і перевірить пробу на місці, разом з оформленням — близько шести хвилин.' },
        { q: 'Яка ставка під заставу золота?', a: `Залежить від суми: ${rateText}. Постійним клієнтам знижка на відсотки до ${maxDiscount}% — ставка від ${pct(minRate)}% на день.` },
        ...(t585 && maxTier ? [{ q: `Що означає «до ${grn(perGram(t585, maxBonus))} грн»?`, a: `Це ціна для клієнтів зі статусом «${maxName}» (+${maxBonus}% до оцінки). За базовим прайсом 585 проба — ${grn(t585.basePrice)} грн/г, новому клієнту — ${grn(perGram(t585, newBonus))}. Надбавка статусу діє на вироби до ${dec(limitFor(t585))} г 585-ї проби. Свою суму порахуйте в калькуляторі вище.` }] : []),
      ]

  // Міста з кількістю відділень — у порядку, заданому в адмінці
  const cityMap = new Map<string, { name: string; order: number; n: number }>()
  for (const b of branches) {
    if (!b.city?.slug) continue
    const c = cityMap.get(b.city.slug)
    if (c) c.n++
    else cityMap.set(b.city.slug, { name: b.city.name, order: b.city.order, n: 1 })
  }
  const cities = [...cityMap.values()].sort((a, b) => a.order - b.order || b.n - a.n)

  return (
    <>
      <FaqSchema items={faq} />
      <BreadcrumbSchema items={[
        { name: t.home, href: withLocale('/', locale) },
        { name: t.crumb, href: withLocale('/tsina-zolota', locale) },
      ]} />
      <SiteHeader hotline={hotline} telegram={telegram} locale={locale} />

      <main className="gp">
        <section className="sec">
          <div className="wrap">
            <nav className="crumbs" aria-label={locale === 'ru' ? 'Путь' : 'Шлях'}>
              <a href={withLocale('/', locale)}>{t.home}</a><span aria-hidden="true">/</span><span>{t.crumb}</span>
            </nav>
            <h1 className="gp__h1">{t.h1}</h1>
            <p className="gp__lede">{t.lede}</p>
            {date && <span className="gp__date">{t.priceFrom(date)}</span>}

            {t585 && (
              <div className="gp__hero">
                <div className="gp__big">
                  <span className="gp__big-lbl">{t.heroLbl}</span>
                  <div className="gp__big-v"><small>{t.upTo}</small> {grn(perGram(t585, maxBonus))} <small>{t.perGram}</small></div>
                  <p className="gp__big-sub">{t.heroSub(maxName, grn(t585.basePrice), grn(t585.purchasePrice ?? t585.basePrice))}</p>
                </div>
                <div className="gp__cta">
                  <TrackedLink location="gold_hero_calc" className="pill" href="#calc">{t.ctaCalc}</TrackedLink>
                  <a className="pill gp__ghost" href={withLocale('/viddilennya', locale)}>{t.ctaBranches}</a>
                </div>
              </div>
            )}

            {/* Повна таблиця — на комп’ютері */}
            <div className="gp__scroll gp__full">
              <table className="gp__t">
                <thead>
                  <tr>
                    <th>{t.thPurity}</th><th>{t.thBase}</th>
                    {newTier && <th>{t.thNew(newBonus)}</th>}
                    {maxTier && <th>{t.thMax}</th>}
                    <th>{t.thBuy}</th>
                  </tr>
                </thead>
                <tbody>
                  {gold.map((g) => (
                    <tr key={g.purityLabel} className={g === t585 ? 'is-main' : undefined}>
                      <td>{g.purityLabel.replace('.', ',')}</td>
                      <td>{grn(g.basePrice)}</td>
                      {newTier && <td>{grn(perGram(g, newBonus))}</td>}
                      {maxTier && <td className="gp__gold">{grn(perGram(g, maxBonus))}</td>}
                      <td>{grn(g.purchasePrice ?? g.basePrice)}</td>
                    </tr>
                  ))}
                  {silver.length > 0 && (
                    <tr className="is-silver">
                      <td>{t.silver} {silver.map((x) => x.purityLabel.replace('.', ',')).join(' / ')}</td>
                      <td>{grn(silver[0].basePrice)}</td>
                      {newTier && <td>—</td>}
                      {maxTier && <td>—</td>}
                      <td>{grn(silver[0].purchasePrice ?? silver[0].basePrice)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {limitText && <p className="gp__note">{t.tableNote(limitText)}</p>}
            </div>

            {/* Коротка таблиця — на телефоні: застава «до», як у пошуку */}
            <div className="gp__short">
              <table className="gp__t">
                <thead><tr><th>{t.thPurity}</th><th>{t.thPledge}</th><th>{t.thBuy}</th></tr></thead>
                <tbody>
                  {gold.map((g) => (
                    <tr key={g.purityLabel} className={g === t585 ? 'is-main' : undefined}>
                      <td>{g.purityLabel.replace('.', ',')}</td>
                      <td>{t.upTo} {grn(perGram(g, maxBonus))}</td>
                      <td>{grn(g.purchasePrice ?? g.basePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {maxTier && <p className="gp__note">{t.shortNote(maxName)}</p>}
            </div>
          </div>
        </section>

        <section className="sec sec--gray">
          <div className="wrap">
            <h2 className="gp__h2">{t.weightH2}</h2>
            <p className="gp__sub">{t.weightLead}</p>
            <div className="gp__scroll">
              <table className="gp__t gp__t--plain">
                <thead><tr><th>{t.thWeight}</th>{weightCols.map((g) => <th key={g.purityLabel}>{t.probaCol(g.purityLabel)}</th>)}</tr></thead>
                <tbody>
                  {WEIGHTS.map((w) => (
                    <tr key={w}>
                      <td>{w} {t.g}</td>
                      {weightCols.map((g) => <td key={g.purityLabel}>{grn(g.basePrice * w)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="sec" id="calc">
          <div className="wrap">
            <h2 className="gp__h2">{t.calcH2}</h2>
            <p className="gp__sub">{t.calcLead}</p>
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
          </div>
        </section>

        {t585 && (
          <section className="sec sec--gray">
            <div className="wrap">
              <h2 className="gp__h2">{t.vsH2}</h2>
              <div className="gp__vs">
                <div className="gp__card">
                  <h3>{t.pledgeH}</h3>
                  <p>{t.pledgeSub}</p>
                  <div className="gp__card-v">{grn(exLoan)} грн</div>
                  <p>{t.pledgeText(String(exW), exDays, grn(exLoan + exInterest))}</p>
                </div>
                <div className="gp__card">
                  <h3>{t.buyH}</h3>
                  <p>{t.buySub}</p>
                  <div className="gp__card-v">{grn(exBuy)} грн</div>
                  <p>{t.buyText(String(exW))}</p>
                </div>
              </div>

              {p999 && p375 && (
                <>
                  <h2 className="gp__h2" style={{ marginTop: 'clamp(2.4rem,5vw,3.6rem)' }}>{t.probaH2}</h2>
                  <p className="gp__text">{t.probaText(as585(p999), as585(p375))}</p>
                </>
              )}
            </div>
          </section>
        )}

        <section className="sec">
          <div className="wrap">
            <h2 className="gp__h2">{t.faqH2}</h2>
            <div className="faq">
              {faq.map(({ q, a }) => (
                <details className="q" key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>

            {cities.length > 0 && (
              <>
                <h2 className="gp__h2" style={{ marginTop: 'clamp(2.4rem,5vw,3.6rem)' }}>{t.citiesH2}</h2>
                <p className="gp__sub">{t.citiesLead(branches.length, cities.length)}</p>
                <div className="gp__cities">
                  {cities.map((c) => (
                    <a key={c.name} href={withLocale('/viddilennya', locale)}>{c.name}{c.n > 1 ? <i> · {c.n}</i> : null}</a>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} locale={locale} />
    </>
  )
}

export default async function GoldPage() {
  return await GoldContent({ locale: 'uk' })
}

export async function generateMetadata(): Promise<Metadata> {
  return goldMetadata('uk')
}
