'use client'
import React, { useMemo, useState } from 'react'
import type { Branch } from '@/lib/data'

/** Межі карти-підкладки. Проєкція Web Mercator — та сама, що в OpenStreetMap. */
const MAP = { west: 34.8046875, east: 35.15625, north: 48.57478991092886, south: 48.341646172374595 }
const merc = (lat: number) => {
  const r = (lat * Math.PI) / 180
  return Math.log(Math.tan(r) + 1 / Math.cos(r))
}
function project(lat: number, lng: number) {
  const yN = merc(MAP.north)
  const yS = merc(MAP.south)
  return {
    x: ((lng - MAP.west) / (MAP.east - MAP.west)) * 100,
    y: ((yN - merc(lat)) / (yN - yS)) * 100,
  }
}

const routeUrl = (b: Branch) =>
  b.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address + ', Дніпро')}`

const hours = (b: Branch) =>
  b.roundClock ? 'цілодобово' : `${b.openTime || '09:00'}–${b.closeTime || '20:00'}`

export default function Branches({ branches }: { branches: Branch[] }) {
  const withCoords = useMemo(() => branches.findIndex((b) => b.lat != null), [branches])
  const [active, setActive] = useState(withCoords < 0 ? 0 : withCoords)

  if (!branches.length) return null
  const cur = branches[active]

  return (
    <section className="sec" id="branches">
      <div className="wrap">
        <div className="shead center">
          <h2>Знайдіть найближче</h2>
          <p>Натисніть на відділення — воно з&apos;явиться на карті. Кнопка «Маршрут» відкриє навігатор.</p>
        </div>

        <div className="brwrap">
          <div className="brlist">
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
                  <b>{b.displayAddress || b.address}</b>
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
              <b>{cur.displayAddress || cur.address}</b>
              <a className="mapbox__route" href={routeUrl(cur)} target="_blank" rel="noopener">
                Прокласти маршрут →
              </a>
            </div>
            <div className="mapbox__area">
              {branches.map((b, i) =>
                b.lat == null ? null : (
                  <button
                    key={b.address}
                    type="button"
                    className={`pin${i === active ? ' pin--on' : ''}`}
                    style={{ left: `${project(b.lat, b.lng!).x}%`, top: `${project(b.lat, b.lng!).y}%` }}
                    title={b.displayAddress || b.address}
                    aria-label={b.displayAddress || b.address}
                    onClick={() => setActive(i)}
                  />
                ),
              )}
              <a
                className="mapbox__attr" href="https://www.openstreetmap.org/copyright"
                target="_blank" rel="noopener"
              >
                © OpenStreetMap
              </a>
            </div>
            <p className="mapbox__note">
              На робочому сайті карта буде інтерактивною: масштабування, пошук
              і кнопка «показати найближче до мене».
            </p>
          </div>
        </div>

        <p className="brm">
          У місті <b>Дніпро</b> — <b>{branches.length}</b> відділень.
        </p>
      </div>
    </section>
  )
}
