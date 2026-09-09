import type { Metadata } from 'next'
import Image from 'next/image'
import { getSiteData } from '@/lib/data'
import Calculator from '@/components/Calculator'
import Nav from '@/components/Nav'
import { FaqSchema, OrganizationSchema } from '@/components/Schema.tsx'
import Branches from '@/components/Branches'
import Social from '@/components/Social'
import '@/components/Calculator.css'
import '@/components/Branches.css'
import '@/components/Booking.css'

// Сторінка складалась наново на кожен запит і щоразу ходила в базу — перший байт
// приходив за півтори секунди. Тепер готова сторінка живе хвилину: правки з
// адмінки з'являються за той самий час, а відвідувач отримує її одразу.
export const revalidate = 60

/** Питання йдуть у розмітку: пошуковик показує їх прямо у результатах. */
const HOME_FAQ = [
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
]


export const metadata: Metadata = {
  title: 'Ломбард «Імперіал» — найвища оцінка золота, ставка від 0,39% на день',
  description:
    'Мережа ломбардів «Імперіал» з 2008 року. Оцінка до 80% ринкової вартості, '
    + 'ставка від 0,39% на день, оформлення за 6 хвилин. Розрахунок онлайн без реєстрації.',
}

const SITUATIONS = [
  ['Терміновий ремонт авто', 'Машина потрібна завтра, а не післязавтра'],
  ['Лікування', 'Коли гроші потрібні сьогодні, а не після оформлення'],
  ['Оплата навчання', 'Семестр, курси, репетитор — до дедлайну'],
  ['Спадщина та подарунки', 'Золото лежить у шкатулці 20 років. Хай попрацює'],
  ['Касовий розрив', 'Товар треба викупити, а оплата — за тиждень'],
  ['Весілля та великі події', 'Одна подія — одна позика, річ повертається'],
  ['Ремонт житла', 'Матеріали подорожчають, поки чекаєте зарплату'],
  ['Вигідна можливість', 'Ціна діє три дні — встигніть'],
]

/**
 * Картка каже, що станеться після натискання, і як саме рахується сума.
 * [назва, підпис, дія, спосіб оцінки, посилання]
 */
const CATEGORIES: [string, string, string, string, string][] = [
  ['Золото', 'Ланцюжки, каблучки, брухт', 'Порахувати суму', 'одразу на сайті', '#calc'],
  ['Срібло', 'Столове, ювелірне, брухт', 'Порахувати суму', 'одразу на сайті', '#calc'],
  ['Годинники', 'Швейцарська механіка, вінтаж', 'Надіслати на оцінку', 'фахівець, протягом дня', '/zastava/hodynnyky'],
  ['Цифрова техніка', 'Телефони, ноутбуки, фото', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/tekhnika'],
  ['Побутова техніка', 'Холодильники, пральні', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/pobutova-tekhnika'],
  ['Інструмент', 'Перфоратори, бензопили', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/instrument'],
  ['Спорт і відпочинок', 'Велосипеди, тренажери', 'Оцінити за фото', 'фахівець, протягом дня', '/zastava/sport'],
]

const TRUST = [
  ['Опис при вас', 'Стан речі фіксуємо в договорі разом із вами — до найдрібнішої подряпини.'],
  ['Окреме сховище', 'Сейф під охороною. Річ не потрапляє у продаж, доки діє договір.'],
  ['Страхування', 'Майно застраховане на повну суму оцінки на весь строк застави.'],
  ['Ліцензія НБУ', 'Діяльність під наглядом Національного банку України з 2008 року.'],
]

export default async function Home() {
  const { tariffs, rateTiers, loyaltyTiers, branches, settings } = await getSiteData()
  const s = settings as Record<string, string | number | boolean | undefined>

  const hotline = String(s.hotline || '0 800 30 85 00')
  const minDays = Number(s.minTermDays ?? 5)
  const maxDays = Number(s.maxTermDays ?? 30)
  const share = Number(s.valuationShare ?? 80)
  const minutes = Number(s.processingMinutes ?? 6)
  const years = new Date().getFullYear() - 2008

  // мінімальна ставка на сайті: найменша за сумою мінус найбільша знижка статусу
  const lowestRate = rateTiers.filter((r) => r.unit === 'percent').reduce(
    (min, r) => Math.min(min, r.rate), Infinity,
  )
  const maxDiscount = loyaltyTiers.reduce((max, t) => Math.max(max, t.discount), 0)
  const bestRate = Number.isFinite(lowestRate)
    ? (lowestRate * (1 - maxDiscount / 100)).toFixed(2).replace('.', ',')
    : '0,39'
  const bestTier = loyaltyTiers.find((t) => t.discount === maxDiscount)
  const bestFrom = rateTiers.find((r) => r.rate === lowestRate)?.amountFrom

  return (
    <>
      <OrganizationSchema branches={branches} hotline={hotline} minRate={bestRate} />
      <FaqSchema items={HOME_FAQ} />
      <header className="wrap top">
        <a className="brand" href="/">
          <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
          <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
        </a>
        <Nav
          hotline={hotline}
          items={[
            { href: '#cats', label: 'Що приймаємо' },
            { href: '/calc', label: 'Оцінка' },
            { href: '/zastava/hodynnyky', label: 'Годинники' },
            { href: '/novyny', label: 'Новини' },
            { href: '/viddilennya', label: 'Відділення' },
          ]}
        />
        <a className="tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
          <b>{hotline}</b><span>Цілодобово · безкоштовно</span>
        </a>
      </header>

      <main>
        <section className="start center">
          {/* анімація появи — лише на вміст: підказку внизу вона зсувала б за край екрана */}
          <div className="wrap start__in" data-reveal-group>
          <p className="eyebrow">Мережа ломбардів з 2008 року</p>
          <h1>Найвища оцінка<br />вашого золота</h1>
          <div className="goldline" />
          <p className="lede">
            До {share}% ринкової вартості. Річ залишається вашою — ви забираєте її,
            коли повернете позику.
          </p>

          <a className="rate-link" href="#terms">
            {`від ${bestRate}%`}<sup>*</sup>{' на день — найнижча ставка серед мереж України ›'}
          </a>
          <p className="rate-note">
            <sup>*</sup> Ставка залежить від суми позики
            {Number.isFinite(lowestRate) && bestFrom
              ? `: від ${lowestRate}% на день при позиці понад ${bestFrom.toLocaleString('uk-UA')} грн`
              : ''}
            {bestTier ? `. ${bestRate}% — з урахуванням знижки ${maxDiscount}% для статусу «${bestTier.name}»` : ''}.
          </p>

          <div className="facts">
            <div className="fact"><b><span data-count={minutes}>{minutes}</span> хв</b><span>оформлення</span></div>
            <div className="fact">
              <b><span data-count={branches.length || 50}>{branches.length || 50}</span>+</b>
              <span>відділень</span>
            </div>
            <div className="fact"><b><span data-count={years}>{years}</span> років</b><span>на ринку</span></div>
          </div>

          <a className="pill start__go" href="#calc">Порахувати суму →</a>
          </div>

          {/* перший екран займає всю висоту, тож потрібен знак, що сторінка триває */}
          <div className="start__hint" aria-hidden="true">
            <span>Калькулятор нижче</span>
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
          />
        </section>

        <section className="sec sec--gray" id="cats">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>Що ми приймаємо</h2>
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

        <section className="sec" id="sits">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>Коли по гроші приходять до нас</h2>
              <p>Гроші не закінчилися — вони просто лежать у незручній формі.</p>
            </div>
            <div className="grid grid--4" data-reveal-group>
              {SITUATIONS.map(([name, sub]) => (
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
                <h2>Що частіше користуєтесь — то дешевше</h2>
                <p>
                Статус зростає від суми сплачених відсотків і одразу впливає на оцінку.
                Якщо заставу не викупили — статус знижується.
              </p>
              </div>
              <div className="grid grid--4" data-reveal-group>
                {loyaltyTiers.map((t) => (
                  <div className="card card--lift" key={t.name}>
                    <h3 style={{ fontSize: 'var(--s1)', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                      <i style={{
                        width: 10, height: 10, transform: 'rotate(45deg)',
                        background: t.color || '#9AA0A6', display: 'inline-block',
                      }} />
                      {t.name}
                    </h3>
                    <dl className="tiercard">
                      <div><dt>Надбавка до оцінки</dt><dd>+{t.metalBonus}%</dd></div>
                      <div><dt>Знижка на відсотки</dt><dd>{t.discount}%</dd></div>
                      <div><dt>Кешбек</dt><dd>{t.cashback}%</dd></div>
                      <div><dt>За техніку</dt><dd>{t.techBonus ? `+${t.techBonus}%` : '—'}</dd></div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <Branches branches={branches} />

        <section className="sec sec--dark">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>Що відбувається з вашим майном</h2>
              <div className="goldline" />
            </div>
            <div className="grid grid--4" data-reveal-group>
              {TRUST.map(([name, text]) => (
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
              <a className="brand" href="/">
                <Image className="brand__mark" src="/logo.png" alt="" width={56} height={56} />
                <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
              </a>
              <p style={{ color: 'var(--dim)', fontSize: 'var(--s-1)', marginTop: '.6rem' }}>
                Гаряча лінія <a href={`tel:${hotline.replace(/\s/g, '')}`} style={{ color: 'var(--brand)' }}>{hotline}</a>
                <br />{String(s.email || 'support@imperial24.com.ua')}
              </p>
              <Social settings={s} />
            </div>
            <div>
              <h4>Послуги</h4>
              <ul>
                <li><a href="/calc">Кредит під заставу</a></li>
                <li><a href="/calc">Онлайн-оцінка</a></li>
                <li><a href="#cats">Що приймаємо</a></li>
                <li><a href="/viddilennya">Відділення</a></li>
                <li><a href="/novyny">Новини та акції</a></li>
              </ul>
            </div>
            <div>
              <h4>Компанія</h4>
              <ul>
                <li><a href="#sits">Життєві ситуації</a></li>
                <li><a href="/viddilennya">Контакти</a></li>
                <li><a href="/admin">Вхід для співробітників</a></li>
              </ul>
            </div>
          </div>
          <p className="foot__legal">
            Максимальна річна ставка — до {String(s.maxAnnualRate ?? 146)}% річних з урахуванням усіх
            обов&apos;язкових платежів. Строк застави — від {minDays} до {maxDays} днів; далі річ
            перезакладається: клієнт сплачує відсотки, і договір продовжується.
            Розрахунок у калькуляторі є попереднім: остаточну суму визначає оцінювач після огляду виробу.
            {s.license ? ` ${s.license}` : ''}
          </p>
        </div>
      </footer>
    </>
  )
}
