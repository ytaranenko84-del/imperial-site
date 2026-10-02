import type { Metadata } from 'next'
import Image from 'next/image'
import { getSiteData } from '@/lib/data'
import { withLocale } from '@/lib/locale-utils.ts'
import Calculator from '@/components/Calculator'
import Nav from '@/components/Nav'
import LangSwitch from '@/components/LangSwitch'
import { FaqSchema, OrganizationSchema } from '@/components/Schema.tsx'
import Branches from '@/components/Branches'
import Social from '@/components/Social'
import PromoRibbon from '@/components/PromoRibbon'
import TrackedLink from '@/components/TrackedLink.tsx'
import '@/components/Calculator.css'
import '@/components/Branches.css'
import '@/components/Booking.css'

// Сторінка складалась наново на кожен запит і щоразу ходила в базу — перший байт
// приходив за півтори секунди. Тепер готова сторінка живе хвилину: правки з
// адмінки з'являються за той самий час, а відвідувач отримує її одразу.
//
// Локаль — не з headers(), а літерал 'uk': сторінка лишається статичною й
// кешованою. Російська версія — app/ru/page.tsx, той самий рендер із locale='ru'.
export const revalidate = 60

type L = 'uk' | 'ru'

/** Питання йдуть у розмітку: пошуковик показує їх прямо у результатах. */
const HOME_FAQ: Record<L, { q: string; a: string }[]> = {
  uk: [
    {
      q: 'Скільки дають за грам золота 585 проби?',
      a: 'За чинним прайсом — 3 100 грн за грам під заставу і 3 150 грн при викупі. '
        + 'Ціни оновлюються за курсом металу, точну суму рахує калькулятор на сайті.',
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
    {
      q: 'Що буде з річчю, поки діє позика?',
      a: 'Річ зберігається в сейфі відділення й лишається вашою. Ви забираєте її, '
        + 'коли повертаєте позику з відсотками.',
    },
  ],
  ru: [
    {
      q: 'Сколько дают за грамм золота 585 пробы?',
      a: 'По действующему прайсу — 3 100 грн за грамм под залог и 3 150 грн при выкупе. '
        + 'Цены обновляются по курсу металла, точную сумму считает калькулятор на сайте.',
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
    {
      q: 'Что будет с вещью, пока действует заём?',
      a: 'Вещь хранится в сейфе отделения и остаётся вашей. Вы забираете её, '
        + 'когда возвращаете заём с процентами.',
    },
  ],
}

export async function homeMetadata(locale: L): Promise<Metadata> {
  const title = locale === 'ru'
    ? 'Ломбард «Империал» — самая высокая оценка золота, ставка от 0,39% в день'
    : 'Ломбард «Імперіал» — найвища оцінка золота, ставка від 0,39% на день'
  const description = locale === 'ru'
    ? 'Сеть ломбардов «Империал» с 2008 года. Оценка до 80% рыночной стоимости, '
      + 'ставка от 0,39% в день, оформление за 6 минут. Расчёт онлайн без регистрации.'
    : 'Мережа ломбардів «Імперіал» з 2008 року. Оцінка до 80% ринкової вартості, '
      + 'ставка від 0,39% на день, оформлення за 6 хвилин. Розрахунок онлайн без реєстрації.'

  return {
    title,
    description,
    alternates: {
      canonical: locale === 'ru' ? '/ru' : '/',
      languages: { 'uk-UA': '/', 'ru-UA': '/ru', 'x-default': '/' },
    },
  }
}

const SITUATIONS: Record<L, [string, string][]> = {
  uk: [
    ['Терміновий ремонт авто', 'Машина потрібна завтра, а не післязавтра'],
    ['Лікування', 'Коли гроші потрібні сьогодні, а не після оформлення'],
    ['Оплата навчання', 'Семестр, курси, репетитор — до дедлайну'],
    ['Спадщина та подарунки', 'Золото лежить у шкатулці 20 років. Хай попрацює'],
    ['Касовий розрив', 'Товар треба викупити, а оплата — за тиждень'],
    ['Весілля та великі події', 'Одна подія — одна позика, річ повертається'],
    ['Ремонт житла', 'Матеріали подорожчають, поки чекаєте зарплату'],
    ['Вигідна можливість', 'Ціна діє три дні — встигніть'],
  ],
  ru: [
    ['Срочный ремонт авто', 'Машина нужна завтра, а не послезавтра'],
    ['Лечение', 'Когда деньги нужны сегодня, а не после оформления'],
    ['Оплата обучения', 'Семестр, курсы, репетитор — к дедлайну'],
    ['Наследство и подарки', 'Золото лежит в шкатулке 20 лет. Пусть поработает'],
    ['Кассовый разрыв', 'Товар нужно выкупить, а оплата — через неделю'],
    ['Свадьба и большие события', 'Одно событие — один заём, вещь возвращается'],
    ['Ремонт жилья', 'Материалы подорожают, пока ждёте зарплату'],
    ['Выгодная возможность', 'Цена действует три дня — успейте'],
  ],
}

/**
 * Картка каже, що станеться після натискання, і як саме рахується сума.
 * [назва, підпис, дія, спосіб оцінки, посилання]
 */
const CATEGORIES: Record<L, [string, string, string, string, string][]> = {
  uk: [
    ['Золото', 'Ланцюжки, каблучки, брухт', 'Порахувати суму', 'одразу на сайті', '#calc'],
    ['Срібло', 'Столове, ювелірне, брухт', 'Порахувати суму', 'одразу на сайті', '#calc'],
    ['Годинники', 'Швейцарська механіка, вінтаж', 'Надіслати на оцінку', 'фахівець, протягом дня', '/zastava/hodynnyky'],
    ['Цифрова техніка', 'Телефони, ноутбуки, фото', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/tekhnika'],
    ['Побутова техніка', 'Холодильники, пральні', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/pobutova-tekhnika'],
    ['Інструмент', 'Перфоратори, бензопили', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/instrument'],
    ['Спорт і відпочинок', 'Велосипеди, тренажери', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/sport'],
  ],
  ru: [
    ['Золото', 'Цепочки, кольца, лом', 'Посчитать сумму', 'сразу на сайте', '#calc'],
    ['Серебро', 'Столовое, ювелирное, лом', 'Посчитать сумму', 'сразу на сайте', '#calc'],
    ['Часы', 'Швейцарская механика, винтаж', 'Отправить на оценку', 'специалист, в течение дня', '/zastava/hodynnyky'],
    ['Цифровая техника', 'Телефоны, ноутбуки, фото', 'Оценить по фото', 'специалист, в течение дня', '/zastava/tekhnika'],
    ['Бытовая техника', 'Холодильники, стиральные машины', 'Оценить по фото', 'специалист, в течение дня', '/zastava/pobutova-tekhnika'],
    ['Инструмент', 'Перфораторы, бензопилы', 'Оценить по фото', 'специалист, в течение дня', '/zastava/instrument'],
    ['Спорт и отдых', 'Велосипеды, тренажёры', 'Оценить по фото', 'специалист, в течение дня', '/zastava/sport'],
  ],
}

const TRUST: Record<L, [string, string][]> = {
  uk: [
    ['Опис при вас', 'Стан речі фіксуємо в договорі разом із вами — до найдрібнішої подряпини.'],
    ['Окреме сховище', 'Сейф під охороною. Річ не потрапляє у продаж, доки діє договір.'],
    ['Страхування', 'Майно застраховане на повну суму оцінки на весь строк застави.'],
    ['Ліцензія НБУ', 'Діяльність під наглядом Національного банку України з 2008 року.'],
  ],
  ru: [
    ['Описание при вас', 'Состояние вещи фиксируем в договоре вместе с вами — до мельчайшей царапины.'],
    ['Отдельное хранилище', 'Сейф под охраной. Вещь не попадает в продажу, пока действует договор.'],
    ['Страхование', 'Имущество застраховано на полную сумму оценки на весь срок залога.'],
    ['Лицензия НБУ', 'Деятельность под надзором Национального банка Украины с 2008 года.'],
  ],
}

const NAV_LABELS: Record<L, { catalog: string; calc: string; watches: string; news: string; branches: string }> = {
  uk: { catalog: 'Що приймаємо', calc: 'Оцінка', watches: 'Годинники', news: 'Новини та акції', branches: 'Відділення' },
  ru: { catalog: 'Что принимаем', calc: 'Оценка', watches: 'Часы', news: 'Новости и акции', branches: 'Отделения' },
}

const T = {
  uk: {
    roundClock: 'Цілодобово · безкоштовно',
    eyebrow: 'Мережа ломбардів з 2008 року',
    h1a: 'Найвища оцінка', h1b: 'вашого золота',
    lede: (share: number) => `До ${share}% ринкової вартості. Річ залишається вашою — ви забираєте її, коли повернете позику.`,
    rateLinkFrom: 'від', rateLinkTail: ' на день — найнижча ставка серед мереж України ›',
    rateNoteBase: 'Ставка залежить від суми позики',
    rateNoteFrom: (rate: number, from: number) => `: від ${rate}% на день при позиці понад ${from.toLocaleString('uk-UA')} грн`,
    rateNoteTier: (rate: string, discount: number, name: string) => `. ${rate}% — з урахуванням знижки ${discount}% для статусу «${name}»`,
    factMin: 'хв', factReg: 'оформлення', factBranches: 'відділень', factYears: 'років', factMarket: 'на ринку',
    ctaCalc: 'Порахувати суму →',
    hint: 'Калькулятор нижче',
    catsH2: 'Що ми приймаємо', catsP: 'Золото і срібло рахує калькулятор одразу. Решту оцінює фахівець за фото.',
    sitsH2: 'Коли по гроші приходять до нас', sitsP: 'Гроші не закінчилися — вони просто лежать у незручній формі.',
    loyaltyH2: 'Що частіше користуєтесь — то дешевше',
    loyaltyP: 'Статус зростає від суми сплачених відсотків і одразу впливає на оцінку. Якщо заставу не викупили — статус знижується.',
    tierBonus: 'Надбавка до оцінки', tierDiscount: 'Знижка на відсотки', tierCashback: 'Кешбек', tierTech: 'За техніку',
    trustH2: 'Що відбувається з вашим майном',
    hotlineLbl: 'Гаряча лінія',
    footServices: 'Послуги', footLoan: 'Кредит під заставу', footOnline: 'Онлайн-оцінка',
    footCompany: 'Компанія', footAbout: 'Про ломбард', footSituations: 'Життєві ситуації',
    footContacts: 'Контакти', footStaff: 'Вхід для співробітників', footNews: 'Новини та акції',
    legal: (max: number, minDays: number, maxDays: number) =>
      `Максимальна річна ставка — до ${max}% річних з урахуванням усіх обов'язкових платежів. Строк застави — від ${minDays} до ${maxDays} днів; далі річ перезакладається: клієнт сплачує відсотки, і договір продовжується. Розрахунок у калькуляторі є попереднім: остаточну суму визначає оцінювач після огляду виробу.`,
  },
  ru: {
    roundClock: 'Круглосуточно · бесплатно',
    eyebrow: 'Сеть ломбардов с 2008 года',
    h1a: 'Самая высокая оценка', h1b: 'вашего золота',
    lede: (share: number) => `До ${share}% рыночной стоимости. Вещь остаётся вашей — вы забираете её, когда вернёте заём.`,
    rateLinkFrom: 'от', rateLinkTail: ' в день — самая низкая ставка среди сетей Украины ›',
    rateNoteBase: 'Ставка зависит от суммы займа',
    rateNoteFrom: (rate: number, from: number) => `: от ${rate}% в день при займе свыше ${from.toLocaleString('uk-UA')} грн`,
    rateNoteTier: (rate: string, discount: number, name: string) => `. ${rate}% — с учётом скидки ${discount}% для статуса «${name}»`,
    factMin: 'мин', factReg: 'оформление', factBranches: 'отделений', factYears: 'лет', factMarket: 'на рынке',
    ctaCalc: 'Посчитать сумму →',
    hint: 'Калькулятор ниже',
    catsH2: 'Что мы принимаем', catsP: 'Золото и серебро считает калькулятор сразу. Остальное оценивает специалист по фото.',
    sitsH2: 'Когда за деньгами приходят к нам', sitsP: 'Деньги не закончились — они просто лежат в неудобной форме.',
    loyaltyH2: 'Чем чаще пользуетесь — тем дешевле',
    loyaltyP: 'Статус растёт от суммы уплаченных процентов и сразу влияет на оценку. Если залог не выкупили — статус снижается.',
    tierBonus: 'Надбавка к оценке', tierDiscount: 'Скидка на проценты', tierCashback: 'Кэшбек', tierTech: 'За технику',
    trustH2: 'Что происходит с вашим имуществом',
    hotlineLbl: 'Горячая линия',
    footServices: 'Услуги', footLoan: 'Кредит под залог', footOnline: 'Онлайн-оценка',
    footCompany: 'Компания', footAbout: 'О ломбарде', footSituations: 'Жизненные ситуации',
    footContacts: 'Контакты', footStaff: 'Вход для сотрудников', footNews: 'Новости и акции',
    legal: (max: number, minDays: number, maxDays: number) =>
      `Максимальная годовая ставка — до ${max}% годовых с учётом всех обязательных платежей. Срок залога — от ${minDays} до ${maxDays} дней; далее вещь перезакладывается: клиент оплачивает проценты, и договор продлевается. Расчёт в калькуляторе является предварительным: окончательную сумму определяет оценщик после осмотра изделия.`,
  },
} satisfies Record<L, unknown>

export async function HomePage({ locale }: { locale: L }) {
  const t = T[locale]
  const { tariffs, rateTiers, loyaltyTiers, branches, settings } = await getSiteData(locale)
  const s = settings as Record<string, string | number | boolean | undefined>

  const hotline = String(s.hotline || '0 800 30 85 00')
  const telegram = (s.telegram as string) || null
  const minDays = Number(s.minTermDays ?? 5)
  const maxDays = Number(s.maxTermDays ?? 30)
  const share = Number(s.valuationShare ?? 80)
  const minutes = Number(s.processingMinutes ?? 6)
  const years = new Date().getFullYear() - 2008

  // мінімальна ставка на сайті: найменша за сумою мінус найбільша знижка статусу
  const lowestRate = rateTiers.filter((r) => r.unit === 'percent').reduce(
    (min, r) => Math.min(min, r.rate), Infinity,
  )
  const maxDiscount = loyaltyTiers.reduce((max, t2) => Math.max(max, t2.discount), 0)
  const bestRate = Number.isFinite(lowestRate)
    ? (lowestRate * (1 - maxDiscount / 100)).toFixed(2).replace('.', ',')
    : '0,39'
  const bestTier = loyaltyTiers.find((tier) => tier.discount === maxDiscount)
  const bestFrom = rateTiers.find((r) => r.rate === lowestRate)?.amountFrom

  return (
    <>
      <OrganizationSchema branches={branches} hotline={hotline} minRate={bestRate} locale={locale} />
      <FaqSchema items={HOME_FAQ[locale]} />
      <PromoRibbon locale={locale} />
      <header className="wrap top">
        <a className="brand" href={withLocale('/', locale)}>
          <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
          <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
        </a>
        <Nav
          hotline={hotline}
          locale={locale}
          items={[
            { href: '/zastava', label: NAV_LABELS[locale].catalog },
            { href: '/calc', label: NAV_LABELS[locale].calc },
            { href: '/zastava/hodynnyky', label: NAV_LABELS[locale].watches },
            { href: '/novyny', label: NAV_LABELS[locale].news },
            { href: '/viddilennya', label: NAV_LABELS[locale].branches },
          ]}
        />
        <LangSwitch locale={locale} />
        <div className="top__contact">
          {telegram && (
            <TrackedLink location="header_telegram" className="top__tg" href={telegram} target="_blank" rel="noopener"
              aria-label="Telegram" title="Telegram">
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M21.94 4.9 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.15c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.13 12.4 2.55 10.97c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.28 2.31Z" />
              </svg>
            </TrackedLink>
          )}
          <a className="tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
            <b>{hotline}</b><span>{t.roundClock}</span>
          </a>
        </div>
      </header>

      <main>
        <section className="start center">
          {/* Без анімації появи: це перший екран, тут немає чого «розкривати»
              прокручуванням — а очікування на IntersectionObserver після
              гідратації віддаляло LCP на мобільних на секунди. */}
          <div className="wrap start__in">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.h1a}<br />{t.h1b}</h1>
          <div className="goldline" />
          <p className="lede">{t.lede(share)}</p>

          <a className="rate-link" href="#terms">
            {`${t.rateLinkFrom} ${bestRate}%`}<sup>*</sup>{t.rateLinkTail}
          </a>
          <p className="rate-note">
            <sup>*</sup> {t.rateNoteBase}
            {Number.isFinite(lowestRate) && bestFrom ? t.rateNoteFrom(lowestRate, bestFrom) : ''}
            {bestTier ? t.rateNoteTier(bestRate, maxDiscount, bestTier.name) : ''}.
          </p>

          <div className="facts">
            <div className="fact"><b><span data-count={minutes}>{minutes}</span> {t.factMin}</b><span>{t.factReg}</span></div>
            <div className="fact">
              <b><span data-count={branches.length || 50}>{branches.length || 50}</span>+</b>
              <span>{t.factBranches}</span>
            </div>
            <div className="fact"><b><span data-count={years}>{years}</span> {t.factYears}</b><span>{t.factMarket}</span></div>
          </div>

          <TrackedLink location="home_hero" className="pill start__go" href="#calc">{t.ctaCalc}</TrackedLink>
          </div>

          {/* перший екран займає всю висоту, тож потрібен знак, що сторінка триває */}
          <div className="start__hint" aria-hidden="true">
            <span>{t.hint}</span>
            <span className="start__arrow">↓</span>
          </div>
        </section>

        <section className="wrap" id="calc" style={{ paddingBottom: 'clamp(3.6rem,7vw,6.4rem)' }} data-reveal>
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

        <section className="sec sec--gray" id="cats">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>{t.catsH2}</h2>
              <p>{t.catsP}</p>
            </div>
            <div className="grid grid--3" data-reveal-group>
              {CATEGORIES[locale].map(([name, sub, action, how, href]) => (
                <TrackedLink
                  location={`home_card_${href.replace(/[/#]/g, '_')}`}
                  className="card card--link" key={name}
                  href={href.startsWith('#') ? href : withLocale(href, locale)}
                >
                  <h3 style={{ fontSize: 'var(--s1)' }}>{name}</h3>
                  <p>{sub}</p>
                  <span className="card__act">{action}<i>→</i></span>
                  <span className="card__how">{how}</span>
                </TrackedLink>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" id="sits">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>{t.sitsH2}</h2>
              <p>{t.sitsP}</p>
            </div>
            <div className="grid grid--4" data-reveal-group>
              {SITUATIONS[locale].map(([name, sub]) => (
                <a className="card card--link" key={name} href="#calc">
                  <h3 style={{ fontSize: 'var(--s0)' }}>{name}</h3>
                  <p>{sub}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {loyaltyTiers.length > 0 && (
          <section className="sec sec--gray">
            <div className="wrap">
              <div className="shead center" data-reveal>
                <h2>{t.loyaltyH2}</h2>
                <p>{t.loyaltyP}</p>
              </div>
              <div className="grid grid--4" data-reveal-group>
                {loyaltyTiers.map((tier) => (
                  <div className="card card--lift" key={tier.name}>
                    <h3 style={{ fontSize: 'var(--s1)', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <i style={{
                        width: 10, height: 10, transform: 'rotate(45deg)',
                        background: tier.color || '#9AA0A6', display: 'inline-block',
                      }} />
                      {tier.name}
                    </h3>
                    <dl className="tiercard">
                      <div><dt>{t.tierBonus}</dt><dd>+{tier.metalBonus}%</dd></div>
                      <div><dt>{t.tierDiscount}</dt><dd>{tier.discount}%</dd></div>
                      <div><dt>{t.tierCashback}</dt><dd>{tier.cashback}%</dd></div>
                      <div><dt>{t.tierTech}</dt><dd>{tier.techBonus ? `+${tier.techBonus}%` : '—'}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <Branches branches={branches} locale={locale} />

        <section className="sec sec--dark">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>{t.trustH2}</h2>
              <div className="goldline" />
            </div>
            <div className="grid grid--4" data-reveal-group>
              {TRUST[locale].map(([name, text]) => (
                <div className="dcard" key={name}>
                  <h3>{name}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="foot" id="terms">
        <div className="wrap">
          <div className="foot__grid">
            <div>
              <a className="brand" href={withLocale('/', locale)}>
                <Image className="brand__mark" src="/logo.png" alt="" width={56} height={56} />
                <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
              </a>
              <p style={{ color: 'var(--dim)', fontSize: 'var(--s-1)', marginTop: '.6rem' }}>
                {t.hotlineLbl} <a href={`tel:${hotline.replace(/\s/g, '')}`} style={{ color: 'var(--brand)' }}>{hotline}</a>
                <br />{String(s.email || 'support@imperial24.com.ua')}
              </p>
              <Social settings={s} locale={locale} />
            </div>
            <div>
              <h4>{t.footServices}</h4>
              <ul>
                <li><a href={withLocale('/calc', locale)}>{t.footLoan}</a></li>
                <li><a href={withLocale('/calc', locale)}>{t.footOnline}</a></li>
                <li><a href={withLocale('/zastava', locale)}>{NAV_LABELS[locale].catalog}</a></li>
                <li><a href={withLocale('/viddilennya', locale)}>{NAV_LABELS[locale].branches}</a></li>
                <li><a href={withLocale('/novyny', locale)}>{t.footNews}</a></li>
              </ul>
            </div>
            <div>
              <h4>{t.footCompany}</h4>
              <ul>
                <li><a href={withLocale('/pro-nas', locale)}>{t.footAbout}</a></li>
                <li><a href="#sits">{t.footSituations}</a></li>
                <li><a href={withLocale('/viddilennya', locale)}>{t.footContacts}</a></li>
                <li><a href="/admin">{t.footStaff}</a></li>
              </ul>
            </div>
          </div>
          <p className="foot__legal">
            {t.legal(Number(s.maxAnnualRate ?? 146), minDays, maxDays)}
            {s.license ? ` ${s.license}` : ''}
          </p>
        </div>
      </footer>
    </>
  )
}

export default async function Home() {
  return await HomePage({ locale: 'uk' })
}

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata('uk')
}
