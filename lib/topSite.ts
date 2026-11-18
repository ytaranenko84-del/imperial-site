import { topDataUrl, topPublicUrl } from './network.ts'

/**
 * Дані сайту ТОП для бота ТОП: відділення й умови беремо з його адмінки
 * (публічне API сайту ТОП), щоб не дублювати їх у базі Імперіалу.
 * Кеш на 10 хвилин: бот не має смикати сайт ТОП на кожне натискання.
 */

const TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; data: unknown }>()

async function getJson<T>(path: string): Promise<T> {
  const base = topDataUrl()
  if (!base) throw new Error('не задано адресу сайту ТОП (TOP_SITE_URL)')
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`сайт ТОП: ${res.status}`)
  const data = await res.json() as T
  cache.set(path, { at: Date.now(), data })
  return data
}

export type TopBranch = {
  id: string
  address: string
  displayAddress?: string
  phone?: string
  paused?: boolean
  pauseReason?: string
  coords?: { lat?: number; lng?: number }
  schedule?: { roundClock?: boolean; openTime?: string; closeTime?: string }
}

/** Активні відділення ТОП: «№2, Кривий Ріг, вул. …» — у тому ж вигляді, що й відділення Імперіалу для бота. */
export async function topBranches(): Promise<TopBranch[]> {
  const { docs } = await getJson<{ docs: Record<string, unknown>[] }>(
    '/api/branches?limit=200&depth=1&where%5Bactive%5D%5Bequals%5D=true',
  )
  return docs.map((d) => {
    const city = (d.city && typeof d.city === 'object' ? (d.city as { name?: string }).name : '') || ''
    const addr = String(d.displayAddress || d.address || '')
    const label = [d.number != null ? `№${d.number}` : '', city, addr].filter(Boolean).join(', ')
    return {
      id: String(d.id),
      address: label,
      displayAddress: label,
      phone: (d.phone as string) || undefined,
      paused: Boolean(d.paused),
      pauseReason: (d.pauseReason as string) || undefined,
      coords: (d.coords as TopBranch['coords']) || undefined,
      schedule: (d.schedule as TopBranch['schedule']) || undefined,
    }
  })
}

/** Відділення ТОП за id — для броні з сайту ТОП. */
export async function topBranchById(id: string): Promise<TopBranch | null> {
  return (await topBranches()).find((b) => b.id === String(id)) ?? null
}

const pct = (n: number) => String(+n.toFixed(3)).replace('.', ',')
const grn = (n: number) => Math.round(n).toLocaleString('uk-UA')

/**
 * Відповідь на «💰 Умови» в боті ТОП: ставка «від», найнижча зі статусом,
 * строк і ціни за грам — ті самі цифри, що на сайті ТОП.
 */
export async function topConditionsText(): Promise<string> {
  const [rates, tiers, tariffs] = await Promise.all([
    getJson<{ docs: { rate: number; unit?: string }[] }>('/api/rate-tiers?limit=50&depth=0'),
    getJson<{ docs: { discount?: number; publicName?: boolean }[] }>('/api/loyalty-tiers?limit=50&depth=0'),
    getJson<{ docs: { metal: string; purityLabel: string; basePrice: number; active?: boolean }[] }>(
      '/api/tariffs?limit=100&depth=0&sort=order',
    ),
  ])
  const percent = rates.docs.filter((r) => (r.unit || 'percent') === 'percent').map((r) => Number(r.rate))
  const from = percent.length ? Math.min(...percent) : null
  const maxDiscount = Math.max(0, ...tiers.docs.filter((t) => t.publicName !== false).map((t) => Number(t.discount || 0)))
  const active = tariffs.docs.filter((t) => t.active !== false)
  const gold = active.filter((t) => t.metal === 'gold')
  const silver = active.filter((t) => t.metal === 'silver')

  const lines = ['<b>Умови застави в ломбарді «ТОП»</b>', '']
  if (from != null) {
    lines.push(`Ставка — від <b>${pct(from)}%</b> на день`
      + (maxDiscount > 0 ? `, зі статусом — від <b>${pct(from * (1 - maxDiscount / 100))}%</b>.` : '.'))
  }
  lines.push('Строк — від 5 до 30 днів.')
  if (gold.length) {
    lines.push('', '<b>Золото</b>, ціна за грам під заставу:')
    for (const t of gold) lines.push(`${t.purityLabel} проба — ${grn(t.basePrice)} грн`)
  }
  if (silver.length) {
    const prices = [...new Set(silver.map((t) => t.basePrice))]
    lines.push('', prices.length === 1
      ? `<b>Срібло</b> — ${grn(prices[0])} грн за грам.`
      : `<b>Срібло</b>: ${silver.map((t) => `${t.purityLabel} — ${grn(t.basePrice)} грн`).join(', ')}.`)
  }
  lines.push('', 'Зі статусом ціна за грам вища. Точну суму порахує калькулятор:')
  lines.push(`<a href="${topPublicUrl()}/zoloto">Калькулятор застави →</a>`)
  return lines.join('\n')
}
