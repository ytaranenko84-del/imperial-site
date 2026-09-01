import { getPayload } from 'payload'
import config from '@payload-config'
import { parsePriceFile } from '@/lib/parsePrice'

/**
 * Завантаження прайсу: POST multipart/form-data, поле «file».
 * Тарифи оновлюються за парою метал+назва проби, зайві позначаються неактивними.
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })

  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return Response.json({ error: 'Потрібна авторизація' }, { status: 401 })
  if (!['admin', 'rates'].includes(String((user as { role?: string }).role))) {
    return Response.json({ error: 'Недостатньо прав: потрібна роль адміністратора або оператора тарифів' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'Файл не надіслано' }, { status: 400 })

  let parsed
  try {
    parsed = parsePriceFile(Buffer.from(await file.arrayBuffer()))
  } catch (e) {
    return Response.json({ error: 'Не вдалося прочитати файл: ' + (e as Error).message }, { status: 422 })
  }
  if (!parsed.tariffs.length) {
    return Response.json({ error: 'У файлі не знайдено тарифів', warnings: parsed.warnings }, { status: 422 })
  }

  const existing = await payload.find({ collection: 'tariffs', limit: 500, depth: 0 })
  const byKey = new Map(existing.docs.map((d) => [`${d.metal}|${d.purityLabel}`, d.id]))
  const seen = new Set<string>()
  let created = 0, updated = 0

  for (const t of parsed.tariffs) {
    const key = `${t.metal}|${t.purityLabel}`
    seen.add(key)
    const data = {
      metal: t.metal,
      purity: t.purity,
      purityLabel: t.purityLabel,
      purchasePrice: t.purchasePrice,
      basePrice: Math.round(t.basePrice),
      order: t.order,
      active: true,
      approvedAt: parsed.approvedAt,
      note: parsed.notes.length && t.metal === 'silver' ? parsed.notes.join('\n') : undefined,
    }
    const id = byKey.get(key)
    if (id) { await payload.update({ collection: 'tariffs', id, data }); updated++ }
    else { await payload.create({ collection: 'tariffs', data }); created++ }
  }

  // позиції, яких у новому прайсі немає, ховаємо, але не видаляємо
  let hidden = 0
  for (const [key, id] of byKey) {
    if (!seen.has(key)) { await payload.update({ collection: 'tariffs', id, data: { active: false } }); hidden++ }
  }

  return Response.json({
    ok: true,
    approvedAt: parsed.approvedAt,
    created, updated, hidden,
    notes: parsed.notes,
    warnings: parsed.warnings,
  })
}
