/**
 * Координати з посилання Google Maps.
 *
 * У адмінці ніхто не має шукати широту й довготу вручну: співробітник відкриває
 * точку в картах, тисне «Поділитися → Копіювати посилання» і вставляє його сюди.
 */

export type LatLng = { lat: number; lng: number }

const UA = 'ImperialLombardSite/1.0 (+https://imperial24.com.ua)'

const ok = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0)

/** Дістає пару координат із тексту: посилання будь-якого виду або просто «49.44, 32.05». */
export function parseCoords(input: string): LatLng | null {
  let s = (input || '').trim()
  if (!s) return null
  try { s = decodeURIComponent(s) } catch { /* лишаємо як є */ }

  const patterns = [
    // сама точка місця — найточніше, ховається в хвості довгого посилання
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    // центр карти: .../@49.4443,32.0598,17z
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    // ?q=49.44,32.05 та родичі
    /[?&](?:q|query|ll|sll|destination|daddr)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    // вставили самі координати
    /^(-?\d+(?:\.\d+)?)[,;\s]+(-?\d+(?:\.\d+)?)$/,
  ]

  for (const re of patterns) {
    const m = s.match(re)
    if (!m) continue
    const lat = Number(m[1]), lng = Number(m[2])
    if (ok(lat, lng)) return { lat, lng }
  }
  return null
}

/** Лише картографічні домени Google: інакше поле в адмінці стає засобом ходити на будь-яку адресу. */
function allowedHost(u: URL): boolean {
  const h = u.hostname.toLowerCase()
  return h === 'maps.app.goo.gl' || h === 'goo.gl' || h === 'g.co'
    || /^(www\.)?google\.[a-z.]+$/.test(h)
    || /^maps\.google\.[a-z.]+$/.test(h)
}

/**
 * Розкриває коротке посилання (maps.app.goo.gl) до повного.
 *
 * Важливо: саме з «неброузерним» User-Agent Google віддає чесний 302 на карту.
 * Броузерам він показує сторінку-заглушку, де адреса підставляється вже скриптом,
 * і на сервері дістати з неї нічого не вийде.
 */
async function expand(url: string): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, 'accept-language': 'uk,en;q=0.8' },
    })
    return res.url || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Координати з того, що вставили в поле: посилання, коротке посилання або самі числа. */
export async function resolveCoords(input: string): Promise<LatLng | null> {
  const raw = (input || '').trim()
  if (!raw) return null

  const direct = parseCoords(raw)
  if (direct) return direct
  if (!/^https?:\/\//i.test(raw)) return null

  let u: URL
  try { u = new URL(raw) } catch { return null }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (!allowedHost(u)) return null

  const full = await expand(u.toString())
  if (!full) return null

  return parseCoords(full)
}
