/**
 * Первинне наповнення бази.
 * Запуск:  node scripts/seed.mjs <адреса сайту> <email> <пароль>
 * Приклад: node scripts/seed.mjs https://imperial-site.netlify.app admin@imperial24.com.ua Pass123
 *
 * Скрипт безпечний для повторного запуску: він оновлює наявні записи,
 * а не створює дублікати.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '')
const EMAIL = process.argv[3] || 'admin@imperial24.com.ua'
const PASS = process.argv[4] || 'Imperial2026!'

const data = JSON.parse(fs.readFileSync(path.join(dir, 'seed-data.json'), 'utf8'))

async function login() {
  // перший запуск — користувача ще немає
  const first = await fetch(`${BASE}/api/users/first-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, name: 'Адміністратор', role: 'admin' }),
  })
  if (first.ok) console.log('створено адміністратора:', EMAIL)

  const r = await fetch(`${BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })
  if (!r.ok) throw new Error('не вдалося увійти: ' + r.status)
  const token = (await r.json()).token
  return { Cookie: `payload-token=${token}`, 'Content-Type': 'application/json' }
}

const api = (h) => ({
  async find(coll) {
    const r = await fetch(`${BASE}/api/${coll}?limit=200&locale=uk&depth=0`, { headers: h })
    return r.ok ? (await r.json()).docs : []
  },
  async create(coll, body) {
    const r = await fetch(`${BASE}/api/${coll}?locale=uk`, { method: 'POST', headers: h, body: JSON.stringify(body) })
    if (!r.ok) console.log('  ✗', coll, r.status, (await r.text()).slice(0, 120))
    return r.ok ? (await r.json()).doc : null
  },
  async update(coll, id, body) {
    const r = await fetch(`${BASE}/api/${coll}/${id}?locale=uk`, { method: 'PATCH', headers: h, body: JSON.stringify(body) })
    return r.ok
  },
  async global(slug, body) {
    const r = await fetch(`${BASE}/api/globals/${slug}?locale=uk`, { method: 'POST', headers: h, body: JSON.stringify(body) })
    return r.ok
  },
})

/** Оновлює за ключем або створює новий запис. */
async function upsert(a, coll, items, keyOf) {
  const existing = await a.find(coll)
  const byKey = new Map(existing.map((d) => [keyOf(d), d.id]))
  let created = 0, updated = 0
  const ids = []
  for (const item of items) {
    const id = byKey.get(keyOf(item))
    if (id) { await a.update(coll, id, item); updated++; ids.push(id) }
    else { const doc = await a.create(coll, item); if (doc) { created++; ids.push(doc.id) } }
  }
  console.log(`  ${coll}: створено ${created}, оновлено ${updated}`)
  return ids
}

const h = await login()
const a = api(h)

await upsert(a, 'tariffs', data.tariffs, (d) => `${d.metal}|${d.purityLabel}`)
await upsert(a, 'rate-tiers', data.rateTiers, (d) => String(d.amountFrom))
await upsert(a, 'loyalty-tiers', data.loyaltyTiers, (d) => d.name)

const [cityId] = await upsert(a, 'cities', data.cities, (d) => d.slug)
await upsert(a, 'branches', data.branches.map((b) => ({ ...b, city: cityId })), (d) => d.slug)

await a.global('settings', data.settings)
console.log('  settings: оновлено')
console.log('\nготово')
