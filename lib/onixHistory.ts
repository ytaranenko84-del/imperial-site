import mysql from 'mysql2/promise'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import {
  NETWORKS, clientFromRecords, onixClientByPhone, phone9, recordFromRow,
  type Network, type OnixClient, type OnixRow,
} from './onix.ts'

/**
 * Історія клієнта з самого Оникса — лише на натискання й лише читання.
 * Доступи — у змінній ONIX_DBS (JSON {"dnepr":{"host","user","password","database"},…}),
 * користувачі Оникса «лише читання». Немає змінної — історія просто недоступна.
 */

type Conf = { host: string; port?: number; user: string; password: string; database: string }

let confs: Partial<Record<Network, Conf>> | null = null
const pools = new Map<Network, mysql.Pool>()

function conf(network: Network): Conf | null {
  if (confs == null) {
    try { confs = JSON.parse(process.env.ONIX_DBS || '{}') } catch { confs = {} }
  }
  return confs?.[network] || null
}

export const onixHistoryEnabled = () => Boolean(process.env.ONIX_DBS)

function pool(network: Network): mysql.Pool | null {
  const c = conf(network)
  if (!c) return null
  let p = pools.get(network)
  if (!p) {
    p = mysql.createPool({
      host: c.host, port: c.port || 3306, user: c.user, password: c.password, database: c.database,
      connectionLimit: 2, connectTimeout: 6000, dateStrings: true, idleTimeout: 60_000,
    })
    pools.set(network, p)
  }
  return p
}

const BAIL_STATUS: Record<number, { label: string; kind: 'active' | 'redeemed' | 'overdue' | 'sold' | 'other' }> = {
  0: { label: 'активна', kind: 'active' },
  3: { label: 'викуплено', kind: 'redeemed' },
  13: { label: 'викуплено', kind: 'redeemed' },
  4: { label: 'прострочено', kind: 'overdue' },
  9: { label: 'на стягненні', kind: 'overdue' },
  2: { label: 'продано', kind: 'sold' },
  7: { label: 'продано', kind: 'sold' },
  5: { label: 'в магазині', kind: 'sold' },
  6: { label: 'в магазині', kind: 'sold' },
  11: { label: 'в магазині', kind: 'sold' },
  12: { label: 'перенесено', kind: 'other' },
}

export type HistoryBail = {
  network: Network
  networkLabel: string
  id: number
  createdAt: string
  loan: number
  product: string
  statusLabel: string
  statusKind: 'active' | 'redeemed' | 'overdue' | 'sold' | 'other'
  branch: string
}

export async function onixCustomerName(network: Network, customerId: number): Promise<string> {
  const p = pool(network)
  if (!p) return ''
  const [rows] = await p.query(
    'SELECT firstName, lastName, surName FROM customer WHERE id = ? LIMIT 1', [customerId],
  ) as unknown as [{ firstName?: string; lastName?: string; surName?: string }[]]
  const r = rows[0]
  return r ? [r.lastName, r.firstName, r.surName].filter(Boolean).join(' ').trim() : ''
}

/** Останні застави клієнта в одній мережі: по `limit` штук, найновіші спершу. */
export async function onixBails(network: Network, customerId: number, limit: number): Promise<HistoryBail[]> {
  const p = pool(network)
  if (!p) return []
  const [rows] = await p.query(
    `SELECT b.id, DATE_FORMAT(b.createdOn, '%Y-%m-%d %H:%i') created, b.loan, b.productName, b.manualStatus, p.name branch
     FROM bail b LEFT JOIN pawnshop p ON p.id = b.PAWNSHOP_ID
     WHERE b.CUSTOMER_ID = ? AND b.manualStatus <> 8
     ORDER BY b.id DESC LIMIT ?`,
    [customerId, limit],
  ) as unknown as [{ id: number; created: string; loan: number; productName: string; manualStatus: number; branch: string }[]]
  return rows.map((r) => {
    const st = BAIL_STATUS[Number(r.manualStatus)] || { label: 'інше', kind: 'other' as const }
    return {
      network,
      networkLabel: NETWORKS[network].label,
      id: Number(r.id),
      createdAt: r.created,
      loan: Number(r.loan || 0),
      product: String(r.productName || '').trim(),
      statusLabel: st.label,
      statusKind: st.kind,
      branch: String(r.branch || ''),
    }
  })
}

/*
 * Клієнт, якого завели в Ониксі сьогодні, у нічному довіднику ще відсутній.
 * Коли співробітник відкриває переписку з таким номером, один раз шукаємо
 * його в усіх п'яти базах напряму й дописуємо в довідник — далі він видний
 * усюди одразу, а вночі вивантаження все одно перезапише рядок.
 * «Не знайдено» пам'ятаємо 10 хвилин, щоб не смикати Оникс на кожне відкриття.
 */
const missCache = new Map<string, number>()
const MISS_TTL_MS = 10 * 60 * 1000

const LIVE_QUERY = `SELECT c.id, IFNULL(d.statusName,'') status, d.discount, IFNULL(c.totalBails,0) tb, IFNULL(c.activeBails,0) ab,
  IFNULL(c.boughtBails,0) bb, IFNULL(c.soldBails,0) sb, IFNULL(c.fineBails,0) fb,
  DATE_FORMAT(c.createdOn,'%Y-%m-%d') since, DATE_FORMAT(lb.createdOn,'%Y-%m-%d %H:%i:%s') last_at, p.name branch,
  TRIM(CONCAT_WS(' ', c.lastName, c.firstName, c.surName)) full_name
FROM customer c
LEFT JOIN discountrate d ON d.id = c.DISCOUNT_RATE_ID
LEFT JOIN bail lb ON lb.id = (SELECT MAX(b.id) FROM bail b WHERE b.CUSTOMER_ID = c.id AND b.manualStatus <> 8)
LEFT JOIN pawnshop p ON p.id = lb.PAWNSHOP_ID
WHERE c.phone IN (?) OR c.phone1 IN (?)`

type LiveRow = {
  id: number; status: string; discount: string | number | null; tb: number; ab: number; bb: number; sb: number; fb: number
  since: string | null; last_at: string | null; branch: string | null; full_name: string | null
}

async function liveRows(p9: string): Promise<OnixRow[]> {
  // Номери в Ониксі переважно «+380…», але трапляються й інші записи
  const variants = [`+380${p9}`, `380${p9}`, `0${p9}`, p9, `+38 0${p9}`]
  const nets = (Object.keys(NETWORKS) as Network[]).filter((n) => pool(n))
  const perNet = await Promise.all(nets.map(async (network) => {
    const [rows] = await pool(network)!.query({ sql: LIVE_QUERY, timeout: 4000 }, [variants, variants]) as unknown as [LiveRow[]]
    return rows.map((r): OnixRow => ({
      phone9: p9, network, customer_id: Number(r.id), status: r.status || null,
      discount: r.discount != null && /^-?\d+$/.test(String(r.discount)) ? Number(r.discount) : null,
      total_bails: Number(r.tb), active_bails: Number(r.ab), bought_bails: Number(r.bb), sold_bails: Number(r.sb), fine_bails: Number(r.fb),
      client_since: r.since, last_bail_at: r.last_at, last_branch: r.branch, full_name: r.full_name,
    }))
  }))
  return perNet.flat()
}

/** Клієнт за номером: з довідника, а якщо там немає — напряму з Оникса (див. вище). */
export async function onixClientWithLive(payload: Payload, phone: unknown): Promise<OnixClient | null> {
  const cached = await onixClientByPhone(payload, phone).catch(() => null)
  const p9 = phone9(phone)
  if (cached || !p9 || !onixHistoryEnabled()) return cached
  const missAt = missCache.get(p9)
  if (missAt && Date.now() - missAt < MISS_TTL_MS) return null
  let rows: OnixRow[] = []
  try {
    rows = await liveRows(p9)
  } catch (e) {
    console.error('onix live lookup', (e as Error).message)
    return null
  }
  if (!rows.length) {
    missCache.set(p9, Date.now())
    if (missCache.size > 5000) missCache.clear()
    return null
  }
  const db = payload.db as unknown as { drizzle?: { execute: (q: unknown) => Promise<unknown> } }
  for (const r of rows) {
    await db.drizzle?.execute(sql`
      insert into onix.clients (phone9, network, customer_id, status, discount, total_bails, active_bails, bought_bails,
        sold_bails, fine_bails, client_since, last_bail_at, last_branch, full_name)
      values (${r.phone9}, ${r.network}, ${r.customer_id}, ${r.status}, ${r.discount}, ${r.total_bails}, ${r.active_bails},
        ${r.bought_bails}, ${r.sold_bails}, ${r.fine_bails}, ${r.client_since}, ${r.last_bail_at}, ${r.last_branch}, ${r.full_name})
      on conflict (network, customer_id, phone9) do nothing`).catch((e: Error) => console.error('onix live upsert', e.message))
  }
  return clientFromRecords(rows.map(recordFromRow))
}
