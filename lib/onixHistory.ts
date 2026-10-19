import mysql from 'mysql2/promise'
import { NETWORKS, type Network } from './onix.ts'

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
