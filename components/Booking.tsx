'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { trackLead } from '@/lib/analytics.ts'
import { createPortal } from 'react-dom'
import 'leaflet/dist/leaflet.css'
import type { Map as LMap, Marker as LMarker } from 'leaflet'
import type { Branch } from '@/lib/data'

const TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}

type Calc = {
  amount: number
  purity: string
  weight: number
  days: number
  tier: string
}

const grn = (n: number) => Math.round(n).toLocaleString('uk-UA')
const label = (b: Branch) => b.displayAddress || b.address
const hours = (b: Branch, locale: 'uk' | 'ru') =>
  b.roundClock ? (locale === 'ru' ? 'круглосуточно' : 'цілодобово') : `${b.openTime || '09:00'}–${b.closeTime || '20:00'}`

const BT = {
  uk: {
    cta: 'Забронювати суму на 24 години',
    modalTitle: 'Забронювати суму',
    modalSub: 'Зафіксуємо оцінку на 24 години. Приходьте у зручний час — телефонувати не будемо.',
    close: 'Закрити',
    calcNote: 'розрахунок додається до заявки',
    name: 'Ім’я', phone: 'Телефон', namePh: 'Як до вас звертатися',
    branchLbl: 'Відділення',
    locating: 'Визначаємо…', nearest: 'Найближче до мене',
    byList: 'Списком', byMap: 'На карті',
    searchPh: 'Пошук за адресою', searchAria: 'Пошук відділення',
    choose: 'обрати', empty: 'Нічого не знайшли — спробуйте іншу вулицю',
    geoDeny: 'Місце не визначилось — оберіть відділення зі списку',
    chosenNote: 'сюди прийде ваша заявка',
    agree: 'Погоджуюсь на обробку персональних даних. Бронь фіксує оцінку, а не готівку: остаточна сума визначається після огляду виробу.',
    sending: 'Надсилаємо…', send: 'Надіслати заявку',
    fine: 'Сума тримається 24 години. Заявка одразу з’явиться у відділенні.',
    errFallback: 'Не вдалося надіслати заявку',
    doneTitle: 'Суму заброньовано на 24 години',
    doneText: (amount: string, till: string | null) =>
      <>Оцінка <b>{amount} грн</b>{till ? <> зафіксована до <b>{till}</b></> : null}. Приходьте у зручний час — телефонувати не будемо, хіба що знадобиться уточнення.</>,
    doneBranch: 'Відділення',
    doneRoute: 'Маршрут →',
    doneFine: 'Візьміть паспорт і сам виріб. Договір оформлюється на місці за 6 хвилин.',
    doneOk: 'Зрозуміло',
    till: (d: Date) => d.toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
  },
  ru: {
    cta: 'Забронировать сумму на 24 часа',
    modalTitle: 'Забронировать сумму',
    modalSub: 'Зафиксируем оценку на 24 часа. Приходите в удобное время — звонить не будем.',
    close: 'Закрыть',
    calcNote: 'расчёт прилагается к заявке',
    name: 'Имя', phone: 'Телефон', namePh: 'Как к вам обращаться',
    branchLbl: 'Отделение',
    locating: 'Определяем…', nearest: 'Ближайшее ко мне',
    byList: 'Списком', byMap: 'На карте',
    searchPh: 'Поиск по адресу', searchAria: 'Поиск отделения',
    choose: 'выбрать', empty: 'Ничего не нашли — попробуйте другую улицу',
    geoDeny: 'Место не определилось — выберите отделение из списка',
    chosenNote: 'сюда придёт ваша заявка',
    agree: 'Соглашаюсь на обработку персональных данных. Бронь фиксирует оценку, а не наличные: окончательная сумма определяется после осмотра изделия.',
    sending: 'Отправляем…', send: 'Отправить заявку',
    fine: 'Сумма держится 24 часа. Заявка сразу появится в отделении.',
    errFallback: 'Не удалось отправить заявку',
    doneTitle: 'Сумма забронирована на 24 часа',
    doneText: (amount: string, till: string | null) =>
      <>Оценка <b>{amount} грн</b>{till ? <> зафиксирована до <b>{till}</b></> : null}. Приходите в удобное время — звонить не будем, разве что понадобится уточнение.</>,
    doneBranch: 'Отделение',
    doneRoute: 'Маршрут →',
    doneFine: 'Возьмите паспорт и само изделие. Договор оформляется на месте за 6 минут.',
    doneOk: 'Понятно',
    till: (d: Date) => d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
  },
} satisfies Record<'uk' | 'ru', unknown>

const routeUrl = (b: Branch) =>
  b.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address + ', Дніпро')}`

function distance(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export default function Booking({ branches, calc, locale = 'uk' }: { branches: Branch[]; calc: Calc; locale?: 'uk' | 'ru' }) {
  const bt = BT[locale]
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [sel, setSel] = useState(0)
  const [tab, setTab] = useState<'list' | 'map'>('list')
  const [query, setQuery] = useState('')
  const [geo, setGeo] = useState<'idle' | 'wait' | 'deny'>('idle')
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form')
  const [error, setError] = useState<string | null>(null)
  const [till, setTill] = useState<string>('')

  const nameRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LMap | null>(null)
  const markersRef = useRef<Map<number, LMarker>>(new Map())
  const selRef = useRef(sel)
  selRef.current = sel

  const mapped = useMemo(
    () => branches.map((b, i) => ({ b, i })).filter(({ b }) => b.lat != null && b.lng != null),
    [branches],
  )
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return branches.map((b, i) => ({ b, i })).filter(({ b }) => !q || label(b).toLowerCase().includes(q))
  }, [branches, query])

  const cur = branches[sel]

  // ── тіло не гортається за вікном; Escape закриває ──
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    nameRef.current?.focus()
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // ── карта створюється лише коли її показали ──
  useEffect(() => {
    if (!open || tab !== 'map' || !boxRef.current || !mapped.length) return
    let cancelled = false

    if (mapRef.current) { mapRef.current.invalidateSize(); return }

    import('leaflet').then((L) => {
      if (cancelled || !boxRef.current) return
      const map = L.map(boxRef.current, { scrollWheelZoom: false, zoomControl: true })
      L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: TILES.maxZoom }).addTo(map)
      const icon = L.divIcon({ className: 'pinwrap', html: '<i class="pin"></i>', iconSize: [16, 16] })

      mapped.forEach(({ b, i }) => {
        const m = L.marker([b.lat as number, b.lng as number], { icon, title: label(b) })
          .addTo(map).on('click', () => setSel(i))
        markersRef.current.set(i, m)
      })
      map.fitBounds(mapped.map(({ b }) => [b.lat as number, b.lng as number]), { padding: [30, 30] })
      markersRef.current.get(selRef.current)?.getElement()?.classList.add('pinwrap--on')
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 50)
    })

    return () => { cancelled = true }
  }, [open, tab, mapped])

  // карту прибираємо разом із вікном, інакше вона лишиться на прихованому вузлі
  useEffect(() => {
    if (open) return
    mapRef.current?.remove()
    mapRef.current = null
    markersRef.current.clear()
  }, [open])

  useEffect(() => {
    markersRef.current.forEach((m, i) => {
      m.getElement()?.classList.toggle('pinwrap--on', i === sel)
      m.setZIndexOffset(i === sel ? 1000 : 0)
    })
    const m = markersRef.current.get(sel)
    if (mapRef.current && m) mapRef.current.panTo(m.getLatLng(), { animate: true })
  }, [sel])

  const findNearest = useCallback(() => {
    if (!navigator.geolocation || !mapped.length) { setGeo('deny'); return }
    setGeo('wait')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        let best = mapped[0].i, min = Infinity
        for (const { b, i } of mapped) {
          const d = distance(coords.latitude, coords.longitude, b.lat as number, b.lng as number)
          if (d < min) { min = d; best = i }
        }
        setGeo('idle')
        setSel(best)
      },
      () => setGeo('deny'),
      { timeout: 8000, maximumAge: 300000 },
    )
  }, [mapped])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    setState('sending')
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'), phone: form.get('phone'), company: form.get('company'),
          branch: String(cur?.id ?? ''), ...calc,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || bt.errFallback)
      setTill(json.expiresAt ? bt.till(new Date(json.expiresAt)) : '')
      trackLead('booking')
      setState('done')
    } catch (err) {
      setState('form')
      setError((err as Error).message)
    }
  }

  if (!branches.length) return null

  return (
    <>
      <button className="pill res__cta" type="button" onClick={() => { setOpen(true); setState('form') }}>
        {bt.cta}
      </button>

      {/* Вікно виносимо в кінець сторінки: секція калькулятора анімується при
          появі, а такий блок стає точкою відліку для position: fixed — вікно
          їхало б разом зі сторінкою замість того, щоб стояти по центру екрана. */}
      {open && mounted && createPortal(
        <div className="veil" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={bt.modalTitle}>

            {state !== 'done' ? (
              <form onSubmit={submit}>
                <div className="modal__head">
                  <div>
                    <h2>{bt.modalTitle}</h2>
                    <p>{bt.modalSub}</p>
                  </div>
                  <button className="x" type="button" onClick={() => setOpen(false)} aria-label={bt.close}>✕</button>
                </div>

                <div className="modal__body">
                  <div className="amount">
                    <div>
                      <b>{grn(calc.amount)} грн</b>
                      <span>
                        {calc.purity}{calc.weight ? ` · ${String(calc.weight).replace('.', ',')} г` : ''}
                        {calc.days ? ` · ${locale === 'ru' ? 'срок' : 'строк'} ${calc.days} дн.` : ''}{calc.tier ? ` · «${calc.tier}»` : ''}
                      </span>
                    </div>
                    <span className="amount__note">{bt.calcNote}</span>
                  </div>

                  <div className="g2">
                    <p>
                      <label htmlFor="bk-name">{bt.name} <span className="req">*</span></label>
                      <input ref={nameRef} id="bk-name" name="name" type="text" required maxLength={120}
                        placeholder={bt.namePh} autoComplete="name" />
                    </p>
                    <p>
                      <label htmlFor="bk-phone">{bt.phone} <span className="req">*</span></label>
                      <input id="bk-phone" name="phone" type="tel" required maxLength={40}
                        placeholder="+380" autoComplete="tel" />
                    </p>
                  </div>

                  <div className="pickhead">
                    <span className="lbl">{bt.branchLbl} <span className="req">*</span></span>
                    <div className="pickhead__act">
                      <button type="button" className="near" onClick={findNearest} disabled={geo === 'wait'}>
                        {geo === 'wait' ? bt.locating : bt.nearest}
                      </button>
                      <div className="tabs">
                        <button type="button" aria-pressed={tab === 'list'} onClick={() => setTab('list')}>{bt.byList}</button>
                        <button type="button" aria-pressed={tab === 'map'} onClick={() => setTab('map')}>{bt.byMap}</button>
                      </div>
                    </div>
                  </div>

                  {tab === 'list' ? (
                    <>
                      <input className="search" type="text" value={query} placeholder={bt.searchPh}
                        onChange={(e) => setQuery(e.target.value)} aria-label={bt.searchAria} />
                      <div className="blist">
                        {shown.map(({ b, i }) => (
                          <button key={b.address} type="button" className="bitem"
                            aria-pressed={i === sel} onClick={() => setSel(i)}>
                            <span><b>{label(b)}</b><span>{hours(b, locale)}</span></span>
                            <i>{bt.choose}</i>
                          </button>
                        ))}
                        {!shown.length && <p className="empty">{bt.empty}</p>}
                      </div>
                    </>
                  ) : (
                    <div className="bmap" ref={boxRef} />
                  )}

                  {geo === 'deny' && <p className="empty">{bt.geoDeny}</p>}

                  {cur && (
                    <div className="chosen">
                      <b>{label(cur)}</b>
                      <span>{hours(cur, locale)} · {bt.chosenNote}</span>
                    </div>
                  )}

                  <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="wtrap" />

                  <label className="agree">
                    <input type="checkbox" required />
                    <span>{bt.agree}</span>
                  </label>

                  {error && <p className="werr">{error}</p>}

                  <button className="pill send" type="submit" disabled={state === 'sending'}>
                    {state === 'sending' ? bt.sending : bt.send}
                  </button>
                  <p className="fine">{bt.fine}</p>
                </div>
              </form>
            ) : (
              <div className="done">
                <div className="tick">✓</div>
                <h2>{bt.doneTitle}</h2>
                <p>{bt.doneText(grn(calc.amount), till || null)}</p>

                {cur && (
                  <div className="where">
                    <div>
                      <span className="where__lbl">{bt.doneBranch}</span>
                      <b>{label(cur)}</b>
                      <span>{hours(cur, locale)}</span>
                    </div>
                    <a className="route" href={routeUrl(cur)} target="_blank" rel="noopener">{bt.doneRoute}</a>
                  </div>
                )}

                <p className="fine">{bt.doneFine}</p>
                <button className="pill" type="button" onClick={() => setOpen(false)}>{bt.doneOk}</button>
              </div>
            )}

          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
