'use client'
import React, { useMemo, useState } from 'react'
import type { LoyaltyTier, RateTier, Tariff } from '@/lib/data'

type Props = {
  tariffs: Tariff[]
  rateTiers: RateTier[]
  loyaltyTiers: LoyaltyTier[]
  minDays: number
  maxDays: number
  guaranteeText?: string | null
}

const grn = (n: number) => Math.round(n).toLocaleString('uk-UA').replace(/ /g, ' ')
const num = (n: number) => String(n).replace('.', ',')

/** Ставка залежить від суми позики: що більша сума — то менший відсоток. */
function rateFor(tiers: RateTier[], amount: number): RateTier | null {
  if (!tiers.length) return null
  return (
    tiers.find((t) => amount >= t.amountFrom && (t.amountTo == null || amount <= t.amountTo)) ??
    tiers[tiers.length - 1]
  )
}

export default function Calculator({
  tariffs, rateTiers, loyaltyTiers, minDays, maxDays, guaranteeText,
}: Props) {
  const gold = useMemo(() => tariffs.filter((t) => t.metal === 'gold'), [tariffs])
  const list = gold.length ? gold : tariffs

  const [purity, setPurity] = useState(() => {
    const found = list.find((t) => t.purityLabel === '585')
    return found?.purityLabel ?? list[0]?.purityLabel ?? ''
  })
  const [weight, setWeight] = useState(8.4)
  const [days, setDays] = useState(maxDays)
  const [tierIdx, setTierIdx] = useState(0)

  const tariff = list.find((t) => t.purityLabel === purity) ?? list[0]
  const tier = loyaltyTiers[tierIdx]

  const base = (tariff?.basePrice ?? 0) * weight
  const total = Math.round(base * (1 + (tier?.metalBonus ?? 0) / 100))
  const buyout = Math.round(weight * (tariff?.purchasePrice ?? tariff?.basePrice ?? 0))

  const r = rateFor(rateTiers, total)
  const effRate = r ? r.rate * (1 - (tier?.discount ?? 0) / 100) : 0
  const interest = r ? (r.unit === 'uah' ? effRate * days : total * (effRate / 100) * days) : 0

  if (!tariff) return null

  return (
    <div className="calc">
      <div className="calc__head">
        <h2>Скільки дадуть за вашу річ</h2>
        <span className="calc__live">Онлайн</span>
      </div>

      <div className="calc__body">
        <div>
          <span className="lbl" id="lp">Проба</span>
          <div className="stamps" role="group" aria-labelledby="lp">
            {list.map((t) => (
              <button
                key={t.purityLabel}
                type="button"
                className="stamp"
                aria-pressed={t.purityLabel === purity}
                onClick={() => setPurity(t.purityLabel)}
              >
                {t.purityLabel}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="lbl" htmlFor="w">Вага виробу</label>
          <div className="row">
            <input
              className="num" id="w" type="number" min={0.1} max={500} step={0.1}
              value={weight} inputMode="decimal"
              onChange={(e) => setWeight(Math.max(0, parseFloat(e.target.value) || 0))}
            />
            <span className="unit">г</span>
            <input
              className="range" type="range" min={0.5} max={100} step={0.1}
              value={Math.min(weight, 100)} aria-label="Вага"
              onChange={(e) => setWeight(parseFloat(e.target.value))}
            />
          </div>
          <div className="presets">
            {[1, 2, 3, 5, 10, 15, 25, 50].map((g) => (
              <button key={g} type="button" className="preset" onClick={() => setWeight(g)}>{g} г</button>
            ))}
          </div>
        </div>

        <div>
          <label className="lbl" htmlFor="d">Строк застави</label>
          <div className="row">
            <input
              className="num" id="d" type="number" min={minDays} max={maxDays} step={1}
              value={days} inputMode="numeric"
              onChange={(e) => {
                const v = Math.round(parseFloat(e.target.value) || maxDays)
                setDays(Math.min(maxDays, Math.max(minDays, v)))
              }}
            />
            <span className="unit">днів</span>
            <input
              className="range" type="range" min={minDays} max={maxDays} step={1}
              value={days} aria-label="Строк застави"
              onChange={(e) => setDays(parseInt(e.target.value, 10))}
            />
          </div>
          <p className="hint">
            Від {minDays} до {maxDays} днів. Далі — перезастава: сплачуєте відсотки, і договір продовжується.
          </p>
        </div>

        {loyaltyTiers.length > 0 && (
          <div>
            <span className="lbl" id="lt">Ваш статус у програмі лояльності</span>
            <div className="tiers" role="group" aria-labelledby="lt">
              {loyaltyTiers.map((t, i) => (
                <button
                  key={t.name}
                  type="button"
                  aria-pressed={i === tierIdx}
                  onClick={() => setTierIdx(i)}
                >
                  <i style={{ background: t.color || '#9AA0A6' }} />
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
            <p className="hint">Статус зростає від суми сплачених відсотків. Вище — оцінка тієї самої речі.</p>
          </div>
        )}

        <div className="res">
          <span className="res__lbl">Ваша сума</span>
          <div className="res__sum">{grn(total)}<span>грн</span></div>
          <p className="res__note">
            Базова оцінка <b>{grn(base)} грн</b> · тариф <b>{grn(tariff.basePrice)} грн/г</b>
          </p>

          {r && (
            <div className="res__row">
              <span>
                Ставка {r.unit === 'uah' ? `${num(+effRate.toFixed(2))} грн` : `${num(+effRate.toFixed(2))}%`} на день
                {tier?.discount ? ` · зі знижкою ${tier.discount}%` : ''}
              </span>
              <b>{grn(interest)} грн</b>
            </div>
          )}
          <div className="res__row"><span>Разом повернете за {days} днів</span><b>{grn(total + interest)} грн</b></div>
          <div className="res__row res__row--dim"><span>Або продамо назавжди — скупка</span><b>{grn(buyout)} грн</b></div>

          {guaranteeText && <p className="res__guar">◆&nbsp;<span>{guaranteeText}</span></p>}

          <button className="pill res__cta" type="button">Забронювати суму на 24 години</button>
          <p className="res__fine">Телефон знадобиться лише для броні. Розрахунок — без реєстрації.</p>
        </div>
      </div>
    </div>
  )
}
