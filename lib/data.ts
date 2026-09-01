import { getPayload } from 'payload'
import config from '@payload-config'

/** Дані для сайту беруться з адмінки. Змінили прайс — змінилось на сторінці. */
export type Tariff = {
  metal: 'gold' | 'silver'
  purity: number | null
  purityLabel: string
  basePrice: number
  purchasePrice: number | null
  note?: string | null
}

export type RateTier = {
  amountFrom: number
  amountTo: number | null
  rate: number
  unit: 'percent' | 'uah'
}

export type LoyaltyTier = {
  name: string
  color?: string | null
  metalBonus: number
  techBonus: number
  discount: number
  cashback: number
  amountFrom: number
  amountTo?: number | null
}

export type Branch = {
  address: string
  displayAddress?: string | null
  formerName?: string | null
  phone?: string | null
  lat?: number | null
  lng?: number | null
  roundClock: boolean
  openTime?: string | null
  closeTime?: string | null
}

export type SiteData = {
  tariffs: Tariff[]
  rateTiers: RateTier[]
  loyaltyTiers: LoyaltyTier[]
  branches: Branch[]
  settings: Record<string, unknown>
}

/** Порожні дані, якщо база недоступна: сторінка має відкриватись у будь-якому разі. */
const EMPTY: SiteData = { tariffs: [], rateTiers: [], loyaltyTiers: [], branches: [], settings: {} }

export async function getSiteData(): Promise<SiteData> {
  try {
    const payload = await getPayload({ config })
    const opts = { locale: 'uk' as const, depth: 0, overrideAccess: true }

    const [tariffs, rateTiers, loyaltyTiers, branches, settings] = await Promise.all([
      payload.find({ collection: 'tariffs', limit: 100, sort: 'order', where: { active: { equals: true } }, ...opts }),
      payload.find({ collection: 'rate-tiers', limit: 50, sort: 'order', ...opts }),
      payload.find({ collection: 'loyalty-tiers', limit: 50, sort: 'order', ...opts }),
      payload.find({ collection: 'branches', limit: 200, sort: 'slug', where: { active: { equals: true } }, ...opts }),
      payload.findGlobal({ slug: 'settings', ...opts }),
    ])

    return {
      tariffs: tariffs.docs.map((d) => ({
        metal: d.metal as 'gold' | 'silver',
        purity: d.purity ?? null,
        purityLabel: String(d.purityLabel),
        basePrice: Number(d.basePrice),
        purchasePrice: d.purchasePrice != null ? Number(d.purchasePrice) : null,
        note: d.note ?? null,
      })),
      rateTiers: rateTiers.docs.map((d) => ({
        amountFrom: Number(d.amountFrom),
        amountTo: d.amountTo != null ? Number(d.amountTo) : null,
        rate: Number(d.rate),
        unit: (d.unit as 'percent' | 'uah') || 'percent',
      })),
      loyaltyTiers: loyaltyTiers.docs.map((d) => ({
        name: String(d.name),
        color: d.color ?? null,
        metalBonus: Number(d.metalBonus ?? 0),
        techBonus: Number(d.techBonus ?? 0),
        discount: Number(d.discount ?? 0),
        cashback: Number(d.cashback ?? 0),
        amountFrom: Number(d.amountFrom ?? 0),
        amountTo: d.amountTo != null ? Number(d.amountTo) : null,
      })),
      branches: branches.docs.map((d) => {
        const s = (d.schedule || {}) as Record<string, unknown>
        const c = (d.coords || {}) as Record<string, unknown>
        return {
          address: String(d.address),
          displayAddress: (d.displayAddress as string) ?? null,
          formerName: (d.formerName as string) ?? null,
          phone: (d.phone as string) ?? null,
          lat: c.lat != null ? Number(c.lat) : null,
          lng: c.lng != null ? Number(c.lng) : null,
          roundClock: Boolean(s.roundClock),
          openTime: (s.openTime as string) ?? null,
          closeTime: (s.closeTime as string) ?? null,
        }
      }),
      settings: settings as Record<string, unknown>,
    }
  } catch {
    // База недоступна — віддаємо порожні дані замість помилки 500
    return EMPTY
  }
}
