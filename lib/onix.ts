import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'

/**
 * Клієнт в Ониксі за номером телефону. Довідник onix.clients щоночі збирає
 * VPS (/opt/onix-sync/sync.sh) з п'яти баз Оникса — вдень Оникс не чіпаємо.
 * ПІБ теж із довідника (нічне вивантаження), тож показується без звернень до Оникса.
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
  fullName: string
}

export type OnixClient = {
  /** Статус, знижка й ПІБ головного запису (див. pickPrimary). */
  tier: TierKey
  tierLabel: string
  discount: number | null
  fullName: string
  /** Головний запис: де більше активних застав. */
  primary: OnixNetworkRecord
  /** Та сама людина в інших базах (або другою карткою) — з посиланнями. */
  also: OnixNetworkRecord[]
  /** Скільки різних людей записано на цей номер. */
  people: number
  /** Усі записи: головний, далі та сама людина, далі інші люди на номері. */
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
  full_name: string | null
}

const iso = (v: string | Date | null) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v))

export type OnixRow = Row

/*
 * Одна й та сама людина в різних базах записана по-різному: «Артём/Артем»,
 * «Андрій/Андрей», «Олександр/Александр», зайві пробіли, подвоєні літери.
 * Тому порівнюємо «кістяк»: укр/рос літери зведені докупи, перші 4 літери
 * прізвища + перші 3 імені. Різні люди на номері — зазвичай родина: прізвище
 * те саме, ім'я інше, — їх це правило розрізняє.
 */
const FIRST_CANON: [string, string][] = [
  ['олекс', 'алекс'], ['олен', 'елен'], ['гана', 'ана'], ['микол', 'никол'], ['микит', 'никит'],
  ['володим', 'владим'], ['тетян', 'татян'], ['свит', 'свет'], ['екат', 'кат'], ['вира', 'вера'],
]
const skeleton = (s: string) => s.toLowerCase()
  .replace(/[ёєэ]/g, 'е').replace(/[їіыйи]/g, 'и').replace(/ґ/g, 'г')
  .replace(/[ьъ'ʼ’`]/g, '').replace(/[^а-яa-z ]/g, '').replace(/(.)\1+/g, '$1')
  .replace(/\s+/g, ' ').trim()
function personKey(r: OnixNetworkRecord): string {
  if (!r.fullName) return ''
  const [sur = '', first = ''] = skeleton(r.fullName).split(' ')
  let f = first
  for (const [from, to] of FIRST_CANON) if (f.startsWith(from)) { f = to + f.slice(from.length); break }
  return `${sur.slice(0, 4)}|${f.slice(0, 3)}`
}
/** Номер-заглушка (на ньому в Ониксі десятки різних людей) — за ним клієнта не впізнаємо. */
const MAX_PEOPLE_ON_PHONE = 5
const ts = (v: string | null) => (v ? new Date(v).getTime() || 0 : 0)

/**
 * Хто головний серед записів на номері: де більше активних застав; рівно —
 * де остання застава свіжіша; далі — де більше застав загалом. Так і для
 * однієї людини в кількох базах, і для двох людей на одному номері.
 */
function byPrimary(a: OnixNetworkRecord, b: OnixNetworkRecord): number {
  return b.activeBails - a.activeBails || ts(b.lastBailAt) - ts(a.lastBailAt) || b.totalBails - a.totalBails
}

export function recordFromRow(r: Row): OnixNetworkRecord {
  const t = tierOf(r.status)
  return {
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
    fullName: String(r.full_name || '').replace(/\s+/g, ' ').trim(),
  }
}

/** Записи одного номера → клієнт: головний запис, та сама людина деінде, скільки людей. */
export function clientFromRecords(records: OnixNetworkRecord[]): OnixClient | null {
  if (!records.length) return null
  const sorted = [...records].sort(byPrimary)
  const primary = sorted[0]
  const key = personKey(primary)
  // Без ПІБ (ще не вивантажене) вважаємо записи однією людиною — як було раніше.
  const samePerson = (r: OnixNetworkRecord) => !key || !personKey(r) || personKey(r) === key
  const also = sorted.slice(1).filter(samePerson)
  const others = sorted.slice(1).filter((r) => !samePerson(r))
  const people = new Set(sorted.map(personKey).filter(Boolean)).size || 1
  if (people > MAX_PEOPLE_ON_PHONE) return null
  return {
    tier: primary.tier,
    tierLabel: primary.tierLabel,
    discount: primary.discount,
    fullName: primary.fullName,
    primary,
    also,
    people,
    networks: [primary, ...also, ...others],
  }
}

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
             sold_bails, fine_bails, client_since, last_bail_at, last_branch, full_name
      from onix.clients where phone9 in ${list}`)
    rows = (Array.isArray(res) ? res : res.rows) || []
  } catch (e) {
    // довідник ще не створено чи тимчасово недоступний — заявки показуємо й без статусу
    console.error('onix lookup', (e as Error).message)
    return out
  }
  const byPhone = new Map<string, OnixNetworkRecord[]>()
  for (const r of rows) {
    const list = byPhone.get(r.phone9) || []
    list.push(recordFromRow(r))
    byPhone.set(r.phone9, list)
  }
  for (const [p, list] of byPhone) {
    const c = clientFromRecords(list)
    if (c) out.set(p, c)
  }
  return out
}

export async function onixClientByPhone(payload: Payload, phone: unknown): Promise<OnixClient | null> {
  const p = phone9(phone)
  if (!p) return null
  return (await onixClientsByPhones(payload, [p])).get(p) || null
}

const escHtml = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch] as string))

/**
 * Для карток у Telegram: ПІБ (замість ніка) і рядки про клієнта —
 * «💎 Діамантовий 22% · Дніпро · активних 4 · картка в Ониксі», нижче
 * «також є в: Кривий Ріг · картка». Немає в базі — ПІБ порожнє.
 */
export async function onixClientInfo(payload: Payload, phone: unknown): Promise<{ fullName: string; line: string }> {
  const c = await onixClientByPhone(payload, phone).catch(() => null)
  if (!c) return { fullName: '', line: 'В Ониксі: немає в базі' }
  const p = c.primary
  const lines = [
    `${tierEmoji(c.tier) ? tierEmoji(c.tier) + ' ' : ''}<b>${tierLabel(c.tier)}</b>${c.discount ? ` ${c.discount}%` : ''}`
      + ` · ${escHtml(p.networkLabel)} · активних ${p.activeBails} · <a href="${escHtml(p.url)}">картка в Ониксі</a>`,
  ]
  if (c.also.length) {
    lines.push('також є в: ' + c.also.map((n) => `${escHtml(n.networkLabel)} · <a href="${escHtml(n.url)}">картка</a>`).join(', '))
  }
  if (c.people > 1) lines.push(`⚠️ На цьому номері ${c.people} клієнти — показано того, в кого активні застави`)
  return { fullName: c.fullName, line: lines.join('\n') }
}

/** Лише рядки про клієнта (без ПІБ) — для старих викликів. */
export async function onixClientLine(payload: Payload, phone: unknown): Promise<string> {
  return (await onixClientInfo(payload, phone)).line
}
