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
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address + ', Дніпро')}`

const hours = (b: Branch) =>
  b.roundClock ? 'цілодобово' : `${b.openTime || '09:00'}–${b.closeTime || '20:00'}`

const label = (b: Branch) => b.displayAddress || b.address

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

function popupHtml(b: Branch) {
  return `<b class="pop__addr">${escape(label(b))}</b>`
    + `<span class="pop__row">${escape(hours(b))}</span>`
    + (b.phone ? `<a class="pop__row" href="tel:${b.phone.replace(/[^\d+]/g, '')}">${escape(b.phone)}</a>` : '')
    + `<a class="pop__route" href="${routeUrl(b)}" target="_blank" rel="noopener">Прокласти маршрут →</a>`
}

export default function Branches({ branches }: { branches: Branch[] }) {
  const mapped = useMemo(
    () => branches.map((b, i) => ({ b, i })).filter(({ b }) => b.lat != null && b.lng != null),
    [branches],
  )
  const firstOnMap = mapped.length ? mapped[0].i : 0

  const [active, setActive] = useState(firstOnMap)
  const [geo, setGeo] = useState<'idle' | 'wait' | 'deny'>('idle')
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
    map.fitBounds(mapped.map(({ b }) => [b.lat as number, b.lng as number]), { padding: [36, 36] })
  }, [mapped])

  // ─── створення карти ───
  useEffect(() => {
    if (!boxRef.current || !mapped.length || mapRef.current) return
    let cancelled = false

    import('leaflet').then((L) => {
      if (cancelled || !boxRef.current) return

      const map = L.map(boxRef.current, { scrollWheelZoom: true, zoomControl: true })
      L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: TILES.maxZoom }).addTo(map)

      // власна мітка замість стандартної: картинки Leaflet ламаються збіркою,
      // та й вигляд має збігатися з рештою сайту
      const icon = L.divIcon({ className: 'pinwrap', html: '<i class="pin"></i>', iconSize: [16, 16] })

      mapped.forEach(({ b, i }) => {
        const m = L.marker([b.lat as number, b.lng as number], { icon, title: label(b), keyboard: true })
          .addTo(map)
          .bindPopup(popupHtml(b), { closeButton: true, className: 'pop' })
        m.on('click', () => setActive(i))
        markersRef.current.set(i, m)
      })

      map.fitBounds(mapped.map(({ b }) => [b.lat as number, b.lng as number]), { padding: [36, 36] })
      markersRef.current.get(activeRef.current)?.getElement()?.classList.add('pinwrap--on')
      mapRef.current = map
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [mapped])

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

  if (!branches.length) return null
  const cur = branches[active]

  return (
    <section className="sec" id="branches">
      <div className="wrap">
        <div className="shead center" data-reveal>
          <h2>Знайдіть найближче</h2>
          <p>Натисніть на відділення — карта підведе до нього. Кнопка «Маршрут» відкриє навігатор.</p>
        </div>

        <div className="brwrap">
          <div className="brlist" ref={listRef}>
            {branches.map((b, i) => (
              <div
                key={b.address}
                className={`br${i === active ? ' br--on' : ''}`}
                onClick={() => setActive(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i) } }}
              >
                <div>
                  <b>{label(b)}</b>
                  <span>{b.phone}</span>
                </div>
                <div className="br__act">
                  <span className="br__hrs">{hours(b)}</span>
                  <a
                    className="br__route" href={routeUrl(b)} target="_blank" rel="noopener"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Маршрут →
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mapbox">
            <div className="mapbox__head">
              <b>{label(cur)}</b>
              <a className="mapbox__route" href={routeUrl(cur)} target="_blank" rel="noopener">
                Прокласти маршрут →
              </a>
            </div>

            <div className="mapbox__area" ref={boxRef} />

            <div className="mapbox__bar">
              <button type="button" className="mapbtn" onClick={findNearest} disabled={geo === 'wait'}>
                {geo === 'wait' ? 'Визначаємо…' : 'Найближче до мене'}
              </button>
              <button type="button" className="mapbtn mapbtn--ghost" onClick={fitAll}>
                Показати всі
              </button>
              {geo === 'deny' && (
                <span className="mapbox__geo">
                  Місце не визначилось — оберіть відділення зі списку
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="brm">
          У місті <b>Дніпро</b> — <b>{branches.length}</b> відділень.
        </p>
      </div>
    </section>
  )
}
