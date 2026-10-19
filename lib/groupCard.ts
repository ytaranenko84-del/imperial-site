import type { Payload } from 'payload'
import { groupCard, mediaUrl, send, sendPhotos, token } from './telegram.ts'

/**
 * Копія оціненої заявки в спільну групу відділень (див. хук EvalRequests).
 * Перша сума — повна картка з фото; виправлена сума — короткий рядок.
 */
export async function postEstimateToGroup(payload: Payload, doc: Record<string, unknown>, prevEstimate: number) {
  if (!token()) return
  const estimate = Number(doc.estimate || 0)
  const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true }) as Record<string, unknown>
  const chat = String(settings.reviewChat || '')
  if (!chat) return

  if (prevEstimate > 0) {
    await send({
      chat,
      text: `<b>Заявка №${doc.id}</b> · сума уточнена: ${prevEstimate.toLocaleString('uk-UA')} → `
        + `<b>${estimate.toLocaleString('uk-UA')} грн</b>`,
    })
    return
  }

  await send({ chat, text: groupCard(doc) })

  const ids = ((doc.photos || []) as unknown[])
    .map((it) => (typeof it === 'object' && it ? (it as { id?: unknown }).id : it))
    .filter((id) => id != null) as (string | number)[]
  if (!ids.length) return
  const media = await payload.find({
    collection: 'media', where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true, pagination: false,
  })
  const urls = media.docs
    .map((m) => String((m as unknown as { filename?: string }).filename || ''))
    .filter(Boolean)
    .map((filename) => mediaUrl(filename))
  if (urls.length) await sendPhotos(chat, urls)
}

/**
 * Запустити після відповіді на запит (next/server `after`), а поза запитом
 * (скрипти, тести) — одразу. Telegram і завантаження фото не мають тримати
 * збереження заявки: на Netlify функцію обривають за лімітом часу, і тоді
 * незавершене збереження відкочується разом із відповіддю співробітника.
 */
export async function runAfterResponse(job: () => Promise<void>, label: string) {
  const safe = () => job().catch((e) => console.error(`${label}:`, e))
  try {
    const { after } = await import('next/server')
    after(safe)
  } catch {
    await safe()
  }
}
