import type { Metadata } from 'next'
import Image from 'next/image'
import { getSiteData } from '@/lib/data'
import Calculator from '@/components/Calculator'
import Branches from '@/components/Branches'
import Social from '@/components/Social'
import '@/components/Calculator.css'
import '@/components/Branches.css'

export const dynamic = 'force-dynamic'

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

const CATEGORIES = [
  ['Золото', 'Ланцюжки, каблучки, брухт', 'онлайн'],
  ['Срібло', 'Столове, ювелірне, брухт', 'онлайн'],
  ['Цифрова техніка', 'Телефони, ноутбуки, фото', 'за фото'],
  ['Побутова техніка', 'Холодильники, пральні', 'за фото'],
  ['Інструмент', 'Перфоратори, бензопили', 'за фото'],
  ['Спорт і відпочинок', 'Велосипеди, тренажери', 'за фото'],
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
      <header className="wrap top">
        <a className="brand" href="/">
          <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
          <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
        </a>
        <nav className="nav">
          <a href="#cats">Що приймаємо</a>
          <a href="#calc">Оцінка</a>
          <a href="#sits">Ситуації</a>
          <a href="#branches">Відділення</a>
        </nav>
        <a className="tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
          <b>{hotline}</b><span>Цілодобово · безкоштовно</span>
        </a>
      </header>

      <main>
        <section className="wrap hero center" id="calc" data-reveal-group>
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
        </section>

        <section className="wrap" style={{ paddingBottom: 'clamp(3.6rem,7vw,6.4rem)' }} data-reveal>
          <Calculator
            tariffs={tariffs}
            rateTiers={rateTiers}
            loyaltyTiers={loyaltyTiers}
            minDays={minDays}
            maxDays={maxDays}
            guaranteeText={s.guaranteeOn ? String(s.guaranteeText || '') : null}
            bonusWeightLimit={Number(s.bonusWeightLimit ?? 0)}
            bonusWeightPurity={Number(s.bonusWeightPurity ?? 585)}
          />
        </section>

        <section className="sec sec--gray" id="cats">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>Що ми приймаємо</h2>
              <p>Ювелірні вироби оцінюємо онлайн — сума одразу. Техніку оцінює фахівець за фото.</p>
            </div>
            <div className="grid grid--3" data-reveal-group>
              {CATEGORIES.map(([name, sub, how]) => (
                <a className="card card--link" key={name} href="#calc">
                  <h3 style={{ fontSize: 'var(--s1)' }}>{name}</h3>
                  <p>{sub}</p>
                  <p style={{ color: 'var(--brand)', marginTop: '.6rem' }}>{how} ›</p>
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
                <li><a href="#calc">Кредит під заставу</a></li>
                <li><a href="#calc">Онлайн-оцінка</a></li>
                <li><a href="#cats">Що приймаємо</a></li>
                <li><a href="#branches">Відділення</a></li>
              </ul>
            </div>
            <div>
              <h4>Компанія</h4>
              <ul>
                <li><a href="#sits">Життєві ситуації</a></li>
                <li><a href="#branches">Контакти</a></li>
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
