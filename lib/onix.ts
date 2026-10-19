import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'

/**
 * Клієнт в Ониксі за номером телефону. Довідник onix.clients щоночі збирає
 * VPS (/opt/onix-sync/sync.sh) з п'яти баз Оникса — вдень Оникс не чіпаємо.
 * Імен у довіднику немає: їх показує лише історія, з самого Оникса.
 */

export type Network = 'dnepr' | 'krivoy' | 'dnz' | 'nikopol' | 'poltava'

export const NETWORKS: Record<Network, { label: string; web: string }> = {
  dnepr: { label: 'Дніпро', web: 'dp' },
  dnz: { label: 'Кам’янське', web: 'dnz' },
  krivoy: { label: 'Кривий Ріг', web: 'kr' },
  nikopol: { label: 'Нікополь', web: 'np' },
  poltava: { label: 'Полтава', web: 'pl' },
}

export function onixCustomerUrl(network: string, customerId: number | string): string {
  const n = NETWORKS[network as Network]
  return n ? `https://${n.web}.gopawnshop.com/secure/customer.htm?id=${customerId}` : ''
}

export type TierKey = 'diamond' | 'ruby' | 'emerald' | 'new' | 'plain'
const TIERS: Record<TierKey, { label: string; emoji: string; level: number }> = {
  diamond: { label: 'Діамантовий', emoji: '💎', level: 4 },
  ruby: { label: 'Рубіновий', emoji: '❤️', level: 3 },
  emerald: { label: 'Смарагдовий', emoji: '♦️', level: 2 },
  new: { label: 'Новий клієнт', emoji: '', level: 1 },
  // є в базі, але статус в Ониксі не задано
  plain: { label: 'Клієнт', emoji: '', level: 0 },
}

/** Назва статусу в Ониксі (російською, різним регістром) → наш рівень. */
export function tierOf(status: string | null | undefined): TierKey {
  const s = String(status || '').toLowerCase()
  if (s.includes('бриллиант') || s.includes('діамант')) return 'diamond'
  if (s.includes('рубин') || s.includes('рубін')) return 'ruby'
  if (s.includes('изумруд') || s.includes('смарагд')) return 'emerald'
  if (s.includes('нов')) return 'new'
  return 'plain'
}
export const tierLabel = (t: TierKey) => TIERS[t].label
export const tierEmoji = (t: TierKey) => TIERS[t].emoji

export type OnixNetworkRecord = {
  network: Network
  networkLabel: string
  customerId: number
  url: string
  tier: TierKey
  tierLabel: string
  discount: number | null
  totalBails: number
  activeBails: number
  boughtBails: number
  soldBails: number
  fineBails: number
  clientSince: string | null
  lastBailAt: string | null
  lastBranch: string | null
}

export type OnixClient = {
  /** Найкращий статус серед усіх мереж — головний на значку. */
  tier: TierKey
  tierLabel: string
  discount: number | null
  networks: OnixNetworkRecord[]
}

export function phone9(raw: unknown): string {
  const d = String(raw || '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : ''
}

type Row = {
  phone9: string; network: Network; customer_id: number; status: string | null; discount: number | null
  total_bails: number; active_bails: number; bought_bails: number; sold_bails: number; fine_bails: number
  client_since: string | Date | null; last_bail_at: string | Date | null; last_branch: string | null
}

const iso = (v: string | Date | null) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v))

/** Кілька телефонів за один запит. На локальній SQLite довідника немає — повертаємо порожньо. */
export async function onixClientsByPhones(payload: Payload, phones: unknown[]): Promise<Map<string, OnixClient>> {
  const out = new Map<string, OnixClient>()
  const list = Array.from(new Set(phones.map(phone9).filter(Boolean)))
  const db = payload.db as unknown as { name?: string; drizzle?: { execute: (q: unknown) => Promise<{ rows?: Row[] } | Row[]> } }
  if (!list.length || db.name !== 'postgres' || !db.drizzle) return out
  let rows: Row[] = []
  try {
    const res = await db.drizzle.execute(sql`
      select phone9, network, customer_id, status, discount, total_bails, active_bails, bought_bails,
             sold_bails, fine_bails, client_since, last_bail_at, last_branch
      from onix.clients where phone9 in ${list}`)
    rows = (Array.isArray(res) ? res : res.rows) || []
  } catch (e) {
    // довідник ще не створено чи тимчасово недоступний — заявки показуємо й без статусу
    console.error('onix lookup', (e as Error).message)
    return out
  }
  for (const r of rows) {
    const t = tierOf(r.status)
    const rec: OnixNetworkRecord = {
      network: r.network,
      networkLabel: NETWORKS[r.network]?.label || r.network,
      customerId: Number(r.customer_id),
      url: onixCustomerUrl(r.network, r.customer_id),
      tier: t,
      tierLabel: tierLabel(t),
      discount: r.discount == null ? null : Number(r.discount),
      totalBails: Number(r.total_bails || 0),
      activeBails: Number(r.active_bails || 0),
      boughtBails: Number(r.bought_bails || 0),
      soldBails: Number(r.sold_bails || 0),
      fineBails: Number(r.fine_bails || 0),
      clientSince: iso(r.client_since),
      lastBailAt: iso(r.last_bail_at),
      lastBranch: r.last_branch,
    }
    const cur = out.get(r.phone9) || { tier: 'plain' as TierKey, tierLabel: '', discount: null, networks: [] }
    cur.networks.push(rec)
    out.set(r.phone9, cur)
  }
  for (const c of out.values()) {
    // кращий статус, за рівних — де більше застав
    c.networks.sort((a, b) => TIERS[b.tier].level - TIERS[a.tier].level || b.totalBails - a.totalBails)
    const best = c.networks[0]
    c.tier = best.tier
    c.tierLabel = best.tierLabel
    c.discount = best.discount
  }
  return out
}

export async function onixClientByPhone(payload: Payload, phone: unknown): Promise<OnixClient | null> {
  const p = phone9(phone)
  if (!p) return null
  return (await onixClientsByPhones(payload, [p])).get(p) || null
}

/** Рядок для карток у Telegram: «💎 Діамантовий · Дніпро · 342 застави · востаннє 17.10». */
export async function onixClientLine(payload: Payload, phone: unknown): Promise<string> {
  const c = await onixClientByPhone(payload, phone).catch(() => null)
  if (!c) return 'В Ониксі: немає в базі'
  const best = c.networks[0]
  const last = best.lastBailAt ? new Date(best.lastBailAt) : null
  const lastTxt = last && !Number.isNaN(last.getTime())
    ? ` · востаннє ${String(last.getDate()).padStart(2, '0')}.${String(last.getMonth() + 1).padStart(2, '0')}${best.lastBranch ? `, ${best.lastBranch}` : ''}`
    : ''
  const others = c.networks.slice(1).map((n) => n.networkLabel)
  const lastTxtSafe = lastTxt.replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch] as string))
  return `${tierEmoji(c.tier)} <b>${tierLabel(c.tier)}</b>${c.discount ? ` ${c.discount}%` : ''} · ${best.networkLabel}`
    + ` · ${best.totalBails} застав${lastTxtSafe}${others.length ? ` · також ${others.join(', ')}` : ''}`
}
