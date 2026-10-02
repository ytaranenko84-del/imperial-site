'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Branch, LoyaltyTier, RateTier, Tariff } from '@/lib/data'
import Booking from './Booking'
import { trackCalcUsed } from '@/lib/analytics.ts'

type Props = {
  tariffs: Tariff[]
  rateTiers: RateTier[]
  loyaltyTiers: LoyaltyTier[]
  minDays: number
  maxDays: number
  guaranteeText?: string | null
  branches?: Branch[]
  /** Надбавка статусу діє до цієї ваги; 0 або відсутнє — без обмеження. */
  bonusWeightLimit?: number
  /** Проба, для якої задано межу: для інших вона перераховується. */
  bonusWeightPurity?: number
  locale?: 'uk' | 'ru'
}

const CT = {
  uk: {
    title: 'Скільки дадуть за вашу річ', live: 'Онлайн',
    metalLbl: 'Метал', gold: 'Золото', silver: 'Срібло',
    purity: 'Проба', weight: 'Вага виробу', weightAria: 'Вага', gram: 'г',
    term: 'Строк застави', days: 'днів', termAria: 'Строк застави',
    hint: (min: number, max: number) => `Від ${min} до ${max} днів. Далі — перезастава: сплачуєте відсотки, і договір продовжується.`,
    yourStatus: 'Ваш статус у програмі лояльності',
    baseNoBonus: 'ціна за прайсом, без надбавок',
    bonusLine: (bonus: number, discount: number) => `+${bonus}% до оцінки${discount ? ` · −${discount}% на відсотки` : ''}`,
    statusHint: 'Статус зростає від суми сплачених відсотків і знижується, якщо заставу не викупили.',
    limitNote: (limit: string, extra: string) => <> Надбавка діє на вироби до <b>{limit} г</b> обраної проби{extra}.</>,
    sum: 'Сума позики',
    baseNote: (base: string, price: string) => <>Базова оцінка <b>{base} грн</b> · тариф <b>{price} грн/г</b></>,
    overLimit: (limit: string) => `Вага понад ${limit} г для цієї проби — надбавка статусу не діє, оцінка за прайсом. Знижка на відсотки лишається.`,
    rateLbl: (discount: number) => `Ставка на день${discount ? ` · знижка ${discount}%` : ''}`,
    interestLbl: (days: number) => `Відсотки за ${days} днів`,
    totalLbl: 'Разом повернете',
    fine: 'Телефон знадобиться лише для броні. Розрахунок — без реєстрації.',
    buyLbl: 'Скупка — річ залишається в нас',
    buyNote: 'Гроші відразу й назавжди, повертати нічого не треба. За скупкою тариф вищий, ніж під заставу.',
  },
  ru: {
    title: 'Сколько дадут за вашу вещь', live: 'Онлайн',
    metalLbl: 'Металл', gold: 'Золото', silver: 'Серебро',
    purity: 'Проба', weight: 'Вес изделия', weightAria: 'Вес', gram: 'г',
    term: 'Срок залога', days: 'дней', termAria: 'Срок залога',
    hint: (min: number, max: number) => `От ${min} до ${max} дней. Далее — перезалог: оплачиваете проценты, и договор продлевается.`,
    yourStatus: 'Ваш статус в программе лояльности',
    baseNoBonus: 'цена по прайсу, без надбавок',
    bonusLine: (bonus: number, discount: number) => `+${bonus}% к оценке${discount ? ` · −${discount}% на проценты` : ''}`,
    statusHint: 'Статус растёт от суммы уплаченных процентов и снижается, если залог не выкупили.',
    limitNote: (limit: string, extra: string) => <> Надбавка действует на изделия до <b>{limit} г</b> выбранной пробы{extra}.</>,
    sum: 'Сумма займа',
    baseNote: (base: string, price: string) => <>Базовая оценка <b>{base} грн</b> · тариф <b>{price} грн/г</b></>,
    overLimit: (limit: string) => `Вес свыше ${limit} г для этой пробы — надбавка статуса не действует, оценка по прайсу. Скидка на проценты остаётся.`,
    rateLbl: (discount: number) => `Ставка в день${discount ? ` · скидка ${discount}%` : ''}`,
    interestLbl: (days: number) => `Проценты за ${days} дней`,
    totalLbl: 'Итого вернёте',
    fine: 'Телефон понадобится только для брони. Расчёт — без регистрации.',
    buyLbl: 'Скупка — вещь остаётся у нас',
    buyNote: 'Деньги сразу и навсегда, возвращать ничего не нужно. По скупке тариф выше, чем под залог.',
  },
} satisfies Record<'uk' | 'ru', unknown>

/** Статус, якого ще немає: ціна рівно за прайсом. Стоїть першим і обраний
 *  за замовчуванням, щоб людина бачила чесну базу, а не суму з надбавкою. */
const NO_TIER: LoyaltyTier = {
  name: 'Без статусу', color: null, metalBonus: 0, techBonus: 0,
  discount: 0, cashback: 0, amountFrom: 0, amountTo: null,
}

const gramm = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

const WEIGHTS = [1, 2, 3, 5, 10, 15, 25, 50]

const grn = (n: number) => Math.round(n).toLocaleString('uk-UA')
const num = (n: number) => String(n).replace('.', ',')

/** Кома як роздільник: на українській розкладці крапки під рукою немає. */
function parseNum(value: string): number | null {
  const n = parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Ставка залежить від суми позики: що більша сума — то менший відсоток. */
function rateFor(tiers: RateTier[], amount: number): RateTier | null {
  if (!tiers.length) return null
  return (
    tiers.find((t) => amount >= t.amountFrom && (t.amountTo == null || amount <= t.amountTo))
    ?? tiers[tiers.length - 1]
  )
}

/**
 * Сума не перескакує, а добігає до нового значення: калькулятор відчувається
 * приладом. За настройкою «зменшити рух» показуємо одразу.
 */
function useCountUp(target: number) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = target
      setShown(target)
      return
    }
    const start = from.current
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 420)
      const v = start + (target - start) * (1 - Math.pow(1 - p, 3))
      setShown(v)
      from.current = v
      if (p < 1) raf.current = requestAnimationFrame(step)
      else from.current = target
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target])

  return shown
}

export default function Calculator({
  tariffs, rateTiers, loyaltyTiers, minDays, maxDays, guaranteeText, branches = [],
  bonusWeightLimit = 0, bonusWeightPurity = 585, locale = 'uk',
}: Props) {
  const ct = CT[locale]
  const hasGold = useMemo(() => tariffs.some((t) => t.metal === 'gold'), [tariffs])
  const hasSilver = useMemo(() => tariffs.some((t) => t.metal === 'silver'), [tariffs])
  const [metal, setMetal] = useState<'gold' | 'silver'>(hasGold ? 'gold' : 'silver')
  const list = useMemo(() => tariffs.filter((t) => t.metal === metal), [tariffs, metal])
  const tiers = useMemo(() => [NO_TIER, ...loyaltyTiers], [loyaltyTiers])

  const [purity, setPurity] = useState(
    () => list.find((t) => t.purityLabel.startsWith('585'))?.purityLabel ?? list[0]?.purityLabel ?? '',
  )
  const selectMetal = (m: 'gold' | 'silver') => {
    markUsed()
    setMetal(m)
    const l = tariffs.filter((t) => t.metal === m)
    setPurity(l.find((t) => t.purityLabel.startsWith('585'))?.purityLabel ?? l[0]?.purityLabel ?? '')
  }
  const [weight, setWeight] = useState(5)
  const [days, setDays] = useState(Math.min(14, maxDays))
  const [tierIdx, setTierIdx] = useState(0)

  // Поле не переписуємо під час набору: інакше «13» після очищення встигало б
  // стати «1» → 5 → «53» → 30. Виправляємо лише коли пішли з поля.
  const [weightText, setWeightText] = useState('5')
  const [daysText, setDaysText] = useState(String(Math.min(14, maxDays)))

  const tariff = list.find((t) => t.purityLabel === purity) ?? list[0]
  const tier = tiers[tierIdx]

  /**
   * Межу задано для однієї проби — для решти вона перераховується за вмістом
   * золота, як і весь прайс. 20 г 585-ї = 11,7 г 999-ї = 31,2 г 375-ї.
   * Понад межу надбавка статусу не діє на весь виріб; знижка на відсотки —
   * діє завжди, бо рахується від суми позики.
   */
  const limitFor = (t?: Tariff) =>
    !bonusWeightLimit || t?.metal !== 'gold' || !t?.purity
      ? 0
      : (bonusWeightLimit * bonusWeightPurity) / t.purity

  const limit = limitFor(tariff)
  const overLimit = limit > 0 && weight > limit
  const bonus = overLimit ? 0 : (tier?.metalBonus ?? 0)

  const base = (tariff?.basePrice ?? 0) * weight
  const total = Math.round(base * (1 + bonus / 100))
  const buyout = Math.round(weight * (tariff?.purchasePrice ?? tariff?.basePrice ?? 0))

  const r = rateFor(rateTiers, total)
  const effRate = r ? r.rate * (1 - (tier?.discount ?? 0) / 100) : 0
  const interest = r ? (r.unit === 'uah' ? effRate * days : total * (effRate / 100) * days) : 0

  // перелік меж для решти проб: числа рахуються, тож зміна в адмінці
  // одразу міняє і текст
  const goldLimits = useMemo(
    () => list
      .filter((t) => t.metal === 'gold' && t.purity && t.purityLabel !== tariff?.purityLabel)
      .map((t) => `${t.purityLabel}° — ${gramm(limitFor(t))} г`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list, tariff?.purityLabel, bonusWeightLimit, bonusWeightPurity],
  )

  const shownTotal = useCountUp(total)
  const shownBuyout = useCountUp(buyout)

  const clampW = (v: number) => Math.max(0.1, Math.min(500, v))
  const clampD = (v: number) => Math.max(minDays, Math.min(maxDays, Math.round(v)))

  // Вага за умовчанням уже ненульова — сама наявність суми на екрані ще не
  // означає, що людина рахувала. Лічимо «використав», тільки коли щось
  // реально зміняли: вагу, пробу чи метал.
  const usedRef = useRef(false)
  const markUsed = () => { if (!usedRef.current) { usedRef.current = true; trackCalcUsed() } }

  const setW = (v: number, syncField: boolean) => {
    markUsed()
    const w = clampW(v)
    setWeight(w)
    if (syncField) setWeightText(num(w))
  }
  const setD = (v: number, syncField: boolean) => {
    const d = clampD(v)
    setDays(d)
    if (syncField) setDaysText(String(d))
  }

  if (!tariff) return null

  return (
    <div className="calc">
      <div className="calc__head">
        <h2>{ct.title}</h2>
        <span className="calc__live">{ct.live}</span>
      </div>

      <div className="calc__grid">
        <div>
          {hasGold && hasSilver && (
            <>
              <span className="lbl" id="lm">{ct.metalLbl}</span>
              <div className="chips" role="group" aria-labelledby="lm">
                <button type="button" className="chip" aria-pressed={metal === 'gold'} onClick={() => selectMetal('gold')}>
                  {ct.gold}
                </button>
                <button type="button" className="chip" aria-pressed={metal === 'silver'} onClick={() => selectMetal('silver')}>
                  {ct.silver}
                </button>
              </div>
            </>
          )}

          <span className="lbl" id="lp">{ct.purity}</span>
          <div className="chips" role="group" aria-labelledby="lp">
            {list.map((t) => (
              <button
                key={t.purityLabel} type="button" className="chip"
                aria-pressed={t.purityLabel === purity}
                onClick={() => { markUsed(); setPurity(t.purityLabel) }}
              >
                {t.purityLabel}
              </button>
            ))}
          </div>

          <label className="lbl" htmlFor="w">{ct.weight}</label>
          <div className="fld">
            <input
              className="num" id="w" type="text" inputMode="decimal" value={weightText}
              onChange={(e) => {
                setWeightText(e.target.value)
                const v = parseNum(e.target.value)
                if (v !== null) setW(v, false)
              }}
              onBlur={() => setWeightText(num(weight))}
            />
            <span className="unit">{ct.gram}</span>
            <input
              className="rng" type="range" min={0.5} max={100} step={0.1}
              value={Math.min(weight, 100)} aria-label={ct.weightAria}
              onChange={(e) => setW(parseFloat(e.target.value), true)}
            />
          </div>
          <div className="chips chips--tight">
            {WEIGHTS.map((g) => (
              <button key={g} type="button" className="chip chip--sm"
                aria-pressed={weight === g} onClick={() => setW(g, true)}>
                {g} {ct.gram}
              </button>
            ))}
          </div>

          <label className="lbl" htmlFor="d">{ct.term}</label>
          <div className="fld">
            <input
              className="num" id="d" type="text" inputMode="numeric" value={daysText}
              onChange={(e) => {
                setDaysText(e.target.value)
                const v = parseNum(e.target.value)
                if (v !== null) setD(v, false)
              }}
              onBlur={() => setDaysText(String(days))}
            />
            <span className="unit">{ct.days}</span>
            <input
              className="rng" type="range" min={minDays} max={maxDays} step={1}
              value={days} aria-label={ct.termAria}
              onChange={(e) => setD(parseInt(e.target.value, 10), true)}
            />
          </div>
          <p className="hint">{ct.hint(minDays, maxDays)}</p>

          {loyaltyTiers.length > 0 && (
            <>
              <span className="lbl" id="lt">{ct.yourStatus}</span>
              <div className={`tiers${overLimit ? ' tiers--off' : ''}`} role="group" aria-labelledby="lt">
                {tiers.map((t, i) => (
                  <button key={t.name} type="button" className={`tier${i === 0 ? ' tier--base' : ''}`}
                    aria-pressed={i === tierIdx} onClick={() => setTierIdx(i)}>
                    <b>
                      {t.name}
                      <em>{i === 0 ? ct.baseNoBonus : ct.bonusLine(t.metalBonus, t.discount)}</em>
                    </b>
                    <s>{grn(base * (1 + (overLimit ? 0 : t.metalBonus) / 100))} грн</s>
                  </button>
                ))}
              </div>
              <p className="hint">
                {ct.statusHint}
                {limit > 0 && ct.limitNote(gramm(limit), goldLimits.length > 1 ? ` (${goldLimits.join(', ')})` : '')}
              </p>
            </>
          )}
        </div>

        <div className="side">
          <div className="res">
            <span className="res__lbl">{ct.sum}</span>
            <div className="sum">{grn(shownTotal)}<small>грн</small></div>
            <p className="res__base">{ct.baseNote(grn(base), grn(tariff.basePrice))}</p>

            {overLimit && (
              <p className="warn">{ct.overLimit(gramm(limit))}</p>
            )}

            <dl className="dl">
              {r && (
                <div>
                  <dt>{ct.rateLbl(tier?.discount ?? 0)}</dt>
                  <dd className="b">
                    {r.unit === 'uah' ? `${num(+effRate.toFixed(2))} грн` : `${num(+effRate.toFixed(2))}%`}
                  </dd>
                </div>
              )}
              <div><dt>{ct.interestLbl(days)}</dt><dd>{grn(interest)} грн</dd></div>
              <div><dt>{ct.totalLbl}</dt><dd>{grn(total + interest)} грн</dd></div>
            </dl>

            {guaranteeText && <p className="res__guar">◆&nbsp;<span>{guaranteeText}</span></p>}

            <Booking
              branches={branches}
              locale={locale}
              calc={{
                amount: total,
                purity: `${tariff.purityLabel}°`,
                weight,
                days,
                tier: tier?.name ?? '',
              }}
            />
            <p className="fine">{ct.fine}</p>
          </div>

          <div className="buy">
            <div>
              <span className="buy__lbl">{ct.buyLbl}</span>
              <p className="buy__note">{ct.buyNote}</p>
            </div>
            <div className="buy__sum">{grn(shownBuyout)}<small>грн</small></div>
          </div>
        </div>
      </div>
    </div>
  )
}
