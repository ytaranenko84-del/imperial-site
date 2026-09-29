'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LMap, Marker as LMarker } from 'leaflet'
import type { Branch } from '@/lib/data'

/**
 * Джерело підкладки. Тайли OpenStreetMap безкоштовні й без ключа, але мають
 * ліміти чесного використання. Коли трафік виросте — міняється лише цей об'єкт
 * (MapTiler, Stadia тощо), сама карта не переробляється.
 */
const TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}

const routeUrl = (b: Branch) =>
  b.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address + ', ' + b.city.name)}`

const hours = (b: Branch, locale: 'uk' | 'ru') =>
  b.roundClock ? (locale === 'ru' ? 'круглосуточно' : 'цілодобово') : `${b.openTime || '09:00'}–${b.closeTime || '20:00'}`

const label = (b: Branch) => b.displayAddress || b.address

const T = {
  uk: {
    heading: 'Знайдіть найближче',
    lead: 'Натисніть на відділення — карта підведе до нього. Кнопка «Маршрут» відкриє навігатор.',
    searchLbl: 'Пошук за адресою',
    searchPh: 'Вулиця, орієнтир або колишня назва',
    of: 'із',
    none: 'Нічого не знайшлось. Спробуйте назву вулиці без номера будинку.',
    route: 'Маршрут →',
    routeFull: 'Прокласти маршрут →',
    locating: 'Визначаємо…',
    nearest: 'Найближче до мене',
    showAll: 'Показати всі',
    geoDeny: 'Місце не визначилось — оберіть відділення зі списку',
    city: (name: string, n: number) => <>У місті <b>{name}</b> — <b>{n}</b> відділень.</>,
  },
  ru: {
    heading: 'Найдите ближайшее',
    lead: 'Нажмите на отделение — карта подведёт к нему. Кнопка «Маршрут» откроет навигатор.',
    searchLbl: 'Поиск по адресу',
    searchPh: 'Улица, ориентир или прежнее название',
    of: 'из',
    none: 'Ничего не нашлось. Попробуйте название улицы без номера дома.',
    route: 'Маршрут →',
    routeFull: 'Проложить маршрут →',
    locating: 'Определяем…',
    nearest: 'Ближайшее ко мне',
    showAll: 'Показать все',
    geoDeny: 'Место не определилось — выберите отделение из списка',
    city: (name: string, n: number) => <>В городе <b>{name}</b> — <b>{n}</b> отделений.</>,
  },
} satisfies Record<'uk' | 'ru', unknown>

/** Відстань по прямій, км. Для «найближчого до мене» цього достатньо. */
function distance(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const escape = (t: string) => t.replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

function popupHtml(b: Branch, locale: 'uk' | 'ru') {
  const t = T[locale]
  const near = b.transport ? `<i class="pop__near">${escape(b.transport)}</i>` : ''
  return `<b class="pop__addr">${escape(label(b))}</b>${near}`
    + `<span class="pop__row">${escape(hours(b, locale))}</span>`
    + (b.phone ? `<a class="pop__row" href="tel:${b.phone.replace(/[^\d+]/g, '')}">${escape(b.phone)}</a>` : '')
    + `<a class="pop__route" href="${routeUrl(b)}" target="_blank" rel="noopener">${escape(t.routeFull)}</a>`
}

export default function Branches(
  { branches, heading, lead, locale = 'uk' }:
  { branches: Branch[]; heading?: string | null; lead?: string | null; locale?: 'uk' | 'ru' },
) {
  const t = T[locale]
  const shownHeading = heading === null ? null : (heading ?? t.heading)
  const shownLead = lead === null ? null : (lead ?? t.lead)

  /** Міста, де є хоч одне відділення, відсортовані так само, як в адмінці. */
  const cities = useMemo(() => {
    const bySlug = new Map<string, { slug: string; name: string; order: number; count: number }>()
    for (const b of branches) {
      if (!b.city?.slug) continue
      const cur = bySlug.get(b.city.slug)
      if (cur) cur.count += 1
      else bySlug.set(b.city.slug, { slug: b.city.slug, name: b.city.name, order: b.city.order, count: 1 })
    }
    return [...bySlug.values()].sort((a, b) => a.order - b.order)
  }, [branches])

  const [selectedCity, setSelectedCity] = useState(() => cities[0]?.slug ?? '')
  const selectedCityInfo = cities.find((c) => c.slug === selectedCity)

  const cityBranches = useMemo(
    () => branches.filter((b) => b.city?.slug === selectedCity),
    [branches, selectedCity],
  )

  const mapped = useMemo(() => {
    const seen = new Map<string, number>()
    return cityBranches
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.lat != null && b.lng != null)
      .map(({ b, i }) => {
        // Два відділення в одному будинку дали б одну мітку на двох, і нижнє
        // не натиснути. Тому другу й наступні відводимо вбік. Двадцять метрів —
        // менше не має сенсу: на робочому масштабі карти це частка пікселя,
        // а більше вже вивело б мітку за межі будинку.
        const key = `${(b.lat as number).toFixed(5)},${(b.lng as number).toFixed(5)}`
        const n = seen.get(key) ?? 0
        seen.set(key, n + 1)
        const angle = (n * 2 * Math.PI) / 3
        const shift = n ? 0.0002 : 0
        const pos: [number, number] = [
          (b.lat as number) + shift * Math.cos(angle),
          (b.lng as number) + shift * Math.sin(angle) * 1.5,
        ]
        return { b, i, pos }
      })
  }, [cityBranches])
  const firstOnMap = mapped.length ? mapped[0].i : 0


  const [active, setActive] = useState(firstOnMap)
  const [geo, setGeo] = useState<'idle' | 'wait' | 'deny'>('idle')
  const [query, setQuery] = useState('')

  /**
   * Відділень 28 — очима шукати довго. Пошук веде і за колишньою назвою
   * вулиці, і за орієнтиром: люди частіше пам'ятають «Косіора», ніж
   * «Петра Калнишевського».
   */
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = cityBranches.map((b, i) => ({ b, i }))
    if (!q) return all
    return all.filter(({ b }) => [b.displayAddress, b.address, b.formerName, b.transport]
      .filter(Boolean).join(' ').toLowerCase().includes(q))
  }, [cityBranches, query])
  const activeRef = useRef(active)
  activeRef.current = active

  const boxRef = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const mapRef = useRef<LMap | null>(null)
  const markersRef = useRef<Map<number, LMarker>>(new Map())
  const listRef = useRef<HTMLDivElement>(null)

  const fitAll = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapped.length) return
    map.fitBounds(mapped.map(({ pos }) => pos), { padding: [36, 36] })
  }, [mapped])

  const selectCity = useCallback((slug: string) => {
    setSelectedCity((cur) => {
      if (slug === cur) return cur
      // місто змінюється — карта сама стане на нові межі (fitBounds нижче),
      // тож не треба ще й летіти до першого відділення поверх цього
      first.current = true
      setQuery('')
      return slug
    })
  }, [])

  // ─── при зміні міста список починається з його першого відділення ───
  useEffect(() => {
    setActive(firstOnMap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity])

  // ─── карта вантажиться, лише коли блок наближається до екрана ───
  // Leaflet і тайли важать помітно: на головній цей блок — шостий за
  // порядком, і немає сенсу качати карту тим, хто його ще не прогорнув.
  const [mapVisible, setMapVisible] = useState(false)
  useEffect(() => {
    if (!boxRef.current) return
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { setMapVisible(true); io.disconnect() } },
      { rootMargin: '600px 0px' },
    )
    io.observe(boxRef.current)
    return () => io.disconnect()
  }, [])

  // ─── створення самої карти: один раз, коли блок став видимим ───
  const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    if (!boxRef.current || mapRef.current || !mapVisible) return
    let cancelled = false

    import('leaflet').then((L) => {
      if (cancelled || !boxRef.current) return
      const map = L.map(boxRef.current, { scrollWheelZoom: true, zoomControl: true })
      L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: TILES.maxZoom }).addTo(map)
      mapRef.current = map
      setMapReady(true)
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [mapVisible])

  // ─── мітки: перебудовуються щоразу, як міняється місто (інший набір відділень) ───
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let cancelled = false

    import('leaflet').then((L) => {
      if (cancelled) return

      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()

      // власна мітка замість стандартної: картинки Leaflet ламаються збіркою,
      // та й вигляд має збігатися з рештою сайту
      const icon = L.divIcon({ className: 'pinwrap', html: '<i class="pin"></i>', iconSize: [16, 16] })

      mapped.forEach(({ b, i, pos }) => {
        const m = L.marker(pos, { icon, title: label(b), keyboard: true })
          .addTo(map)
          .bindPopup(popupHtml(b, locale), { closeButton: true, className: 'pop' })
        m.on('click', () => setActive(i))
        markersRef.current.set(i, m)
      })

      if (mapped.length) map.fitBounds(mapped.map(({ pos }) => pos), { padding: [36, 36] })
      markersRef.current.get(activeRef.current)?.getElement()?.classList.add('pinwrap--on')
    })

    return () => {
      cancelled = true
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
    }
  }, [mapped, mapReady, locale])

  // ─── вибране відділення: підсвітити мітку, підвести карту, догорнути список ───
  useEffect(() => {
    markersRef.current.forEach((m, i) => {
      m.getElement()?.classList.toggle('pinwrap--on', i === active)
      m.setZIndexOffset(i === active ? 1000 : 0)
    })

    // на завантаженні карта показує все місто й нікуди не веде:
    // інакше сторінка сама поїхала б до списку відділень
    if (first.current) { first.current = false; return }

    const map = mapRef.current
    const m = markersRef.current.get(active)
    if (map && m) {
      map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 14), { duration: 0.6 })
      m.openPopup()
    }

    // гортаємо лише сам список, не сторінку
    const list = listRef.current
    const row = list?.querySelector<HTMLElement>('.br--on')
    if (list && row) {
      // рахуємо від самого списку, а не від offsetParent: він може бути іншим
      const shift = row.getBoundingClientRect().top - list.getBoundingClientRect().top
      const top = list.scrollTop + shift - (list.clientHeight - row.clientHeight) / 2
      list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
  }, [active])

  const findNearest = useCallback(() => {
    if (!navigator.geolocation || !mapped.length) { setGeo('deny'); return }
    setGeo('wait')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        let best = mapped[0].i
        let min = Infinity
        for (const { b, i } of mapped) {
          const d = distance(coords.latitude, coords.longitude, b.lat as number, b.lng as number)
          if (d < min) { min = d; best = i }
        }
        setGeo('idle')
        setActive(best)
      },
      () => setGeo('deny'),
      { timeout: 8000, maximumAge: 300000 },
    )
  }, [mapped])

  if (!cityBranches.length) return null
  // На один кадр між зміною міста й спрацюванням ефекту нижче active ще
  // вказує на індекс у попередньому місті — тут це підстраховка від виходу за межі.
  const cur = cityBranches[active] ?? cityBranches[0]

  return (
    <section className={`sec${shownHeading ? '' : ' sec--tight'}`} id="branches">
      <div className="wrap">
        {shownHeading && (
          <div className="shead center" data-reveal>
            <h2>{shownHeading}</h2>
            {shownLead && <p>{shownLead}</p>}
          </div>
        )}

        {cities.length > 1 && (
          <div className="cities">
            {cities.map((c) => (
              <button
                key={c.slug}
                type="button"
                className={`city-tab${c.slug === selectedCity ? ' city-tab--on' : ''}`}
                onClick={() => selectCity(c.slug)}
              >
                {c.name} <span className="city-tab__n">{c.count}</span>
              </button>
            ))}
          </div>
        )}

        <label className="brfind">
          <span className="brfind__lab">{t.searchLbl}</span>
          <input
            type="search"
            className="brfind__in"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPh}
            autoComplete="off"
          />
          {query && <span className="brfind__n">{shown.length} {t.of} {cityBranches.length}</span>}
        </label>

        <div className="brwrap">
          <div className="brlist" ref={listRef}>
            {shown.length === 0 && (
              <p className="brfind__none">{t.none}</p>
            )}
            {shown.map(({ b, i }) => (
              <div
                key={b.id}
                className={`br${i === active ? ' br--on' : ''}`}
                onClick={() => setActive(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i) } }}
              >
                <div>
                  <b>{label(b)}</b>
                  {b.transport && <i className="br__near">{b.transport}</i>}
                  <span>{b.phone}</span>
                </div>
                <div className="br__act">
                  <span className="br__hrs">{hours(b, locale)}</span>
                  <a
                    className="br__route" href={routeUrl(b)} target="_blank" rel="noopener"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t.route}
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mapbox">
            <div className="mapbox__head">
              <b>{label(cur)}{cur.transport ? <i className="mapbox__near">{cur.transport}</i> : null}</b>
              <a className="mapbox__route" href={routeUrl(cur)} target="_blank" rel="noopener">
                {t.routeFull}
              </a>
            </div>

            <div className="mapbox__area" ref={boxRef} />

            <div className="mapbox__bar">
              <button type="button" className="mapbtn" onClick={findNearest} disabled={geo === 'wait'}>
                {geo === 'wait' ? t.locating : t.nearest}
              </button>
              <button type="button" className="mapbtn mapbtn--ghost" onClick={fitAll}>
                {t.showAll}
              </button>
              {geo === 'deny' && (
                <span className="mapbox__geo">
                  {t.geoDeny}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="brm">
          {t.city(selectedCityInfo?.name || cur.city.name, cityBranches.length)}
        </p>
      </div>
    </section>
  )
}
