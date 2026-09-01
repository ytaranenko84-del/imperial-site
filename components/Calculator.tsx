'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { LoyaltyTier, RateTier, Tariff } from '@/lib/data'

type Props = {
  tariffs: Tariff[]
  rateTiers: RateTier[]
  loyaltyTiers: LoyaltyTier[]
  minDays: number
  maxDays: number
  guaranteeText?: string | null
}

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
  tariffs, rateTiers, loyaltyTiers, minDays, maxDays, guaranteeText,
}: Props) {
  const gold = useMemo(() => tariffs.filter((t) => t.metal === 'gold'), [tariffs])
  const list = gold.length ? gold : tariffs

  const [purity, setPurity] = useState(
    () => list.find((t) => t.purityLabel.startsWith('585'))?.purityLabel ?? list[0]?.purityLabel ?? '',
  )
  const [weight, setWeight] = useState(5)
  const [days, setDays] = useState(Math.min(14, maxDays))
  const [tierIdx, setTierIdx] = useState(0)

  // Поле не переписуємо під час набору: інакше «13» після очищення встигало б
  // стати «1» → 5 → «53» → 30. Виправляємо лише коли пішли з поля.
  const [weightText, setWeightText] = useState('5')
  const [daysText, setDaysText] = useState(String(Math.min(14, maxDays)))

  const tariff = list.find((t) => t.purityLabel === purity) ?? list[0]
  const tier = loyaltyTiers[tierIdx]

  const base = (tariff?.basePrice ?? 0) * weight
  const total = Math.round(base * (1 + (tier?.metalBonus ?? 0) / 100))
  const buyout = Math.round(weight * (tariff?.purchasePrice ?? tariff?.basePrice ?? 0))

  const r = rateFor(rateTiers, total)
  const effRate = r ? r.rate * (1 - (tier?.discount ?? 0) / 100) : 0
  const interest = r ? (r.unit === 'uah' ? effRate * days : total * (effRate / 100) * days) : 0

  const shownTotal = useCountUp(total)
  const shownBuyout = useCountUp(buyout)

  const clampW = (v: number) => Math.max(0.1, Math.min(500, v))
  const clampD = (v: number) => Math.max(minDays, Math.min(maxDays, Math.round(v)))

  const setW = (v: number, syncField: boolean) => {
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
        <h2>Скільки дадуть за вашу річ</h2>
        <span className="calc__live">Онлайн</span>
      </div>

      <div className="calc__grid">
        <div>
          <span className="lbl" id="lp">Проба</span>
          <div className="chips" role="group" aria-labelledby="lp">
            {list.map((t) => (
              <button
                key={t.purityLabel} type="button" className="chip"
                aria-pressed={t.purityLabel === purity}
                onClick={() => setPurity(t.purityLabel)}
              >
                {t.purityLabel}
              </button>
            ))}
          </div>

          <label className="lbl" htmlFor="w">Вага виробу</label>
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
            <span className="unit">г</span>
            <input
              className="rng" type="range" min={0.5} max={100} step={0.1}
              value={Math.min(weight, 100)} aria-label="Вага"
              onChange={(e) => setW(parseFloat(e.target.value), true)}
            />
          </div>
          <div className="chips chips--tight">
            {WEIGHTS.map((g) => (
              <button key={g} type="button" className="chip chip--sm"
                aria-pressed={weight === g} onClick={() => setW(g, true)}>
                {g} г
              </button>
            ))}
          </div>

          <label className="lbl" htmlFor="d">Строк застави</label>
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
            <span className="unit">днів</span>
            <input
              className="rng" type="range" min={minDays} max={maxDays} step={1}
              value={days} aria-label="Строк застави"
              onChange={(e) => setD(parseInt(e.target.value, 10), true)}
            />
          </div>
          <p className="hint">
            Від {minDays} до {maxDays} днів. Далі — перезастава: сплачуєте відсотки, і договір продовжується.
          </p>

          {loyaltyTiers.length > 0 && (
            <>
              <span className="lbl" id="lt">Ваш статус у програмі лояльності</span>
              <div className="tiers" role="group" aria-labelledby="lt">
                {loyaltyTiers.map((t, i) => (
                  <button key={t.name} type="button" className="tier"
                    aria-pressed={i === tierIdx} onClick={() => setTierIdx(i)}>
                    <b>
                      {t.name}
                      <em>
                        +{t.metalBonus}% до оцінки
                        {t.discount ? ` · −${t.discount}% на відсотки` : ''}
                      </em>
                    </b>
                    <s>{grn(base * (1 + t.metalBonus / 100))} грн</s>
                  </button>
                ))}
              </div>
              <p className="hint">
                Статус зростає від суми сплачених відсотків. Вище — оцінка тієї самої речі.
              </p>
            </>
          )}
        </div>

        <div className="side">
          <div className="res">
            <span className="res__lbl">Сума позики</span>
            <div className="sum">{grn(shownTotal)}<small>грн</small></div>
            <p className="res__base">
              Базова оцінка <b>{grn(base)} грн</b> · тариф <b>{grn(tariff.basePrice)} грн/г</b>
            </p>

            <dl className="dl">
              {r && (
                <div>
                  <dt>Ставка на день{tier?.discount ? ` · знижка ${tier.discount}%` : ''}</dt>
                  <dd className="b">
                    {r.unit === 'uah' ? `${num(+effRate.toFixed(2))} грн` : `${num(+effRate.toFixed(2))}%`}
                  </dd>
                </div>
              )}
              <div><dt>Відсотки за {days} днів</dt><dd>{grn(interest)} грн</dd></div>
              <div><dt>Разом повернете</dt><dd>{grn(total + interest)} грн</dd></div>
            </dl>

            {guaranteeText && <p className="res__guar">◆&nbsp;<span>{guaranteeText}</span></p>}

            <button className="pill res__cta" type="button">Забронювати суму на 24 години</button>
            <p className="fine">Телефон знадобиться лише для броні. Розрахунок — без реєстрації.</p>
          </div>

          <div className="buy">
            <div>
              <span className="buy__lbl">Скупка — річ залишається в нас</span>
              <p className="buy__note">
                Гроші відразу й назавжди, повертати нічого не треба.
                За скупкою тариф вищий, ніж під заставу.
              </p>
            </div>
            <div className="buy__sum">{grn(shownBuyout)}<small>грн</small></div>
          </div>
        </div>
      </div>
    </div>
  )
}
