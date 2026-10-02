import type { getPayload } from 'payload'

/**
 * Воронка бота: раніше нічого не писалось, поки людина не поділиться
 * номером — натиснув «Старт», подивився меню й пішов лишало нуль слідів.
 * Пишемо кожну дію в окремий журнал — так само, як лічильник rate-limit.
 */
export async function logBotEvent(
  payload: Awaited<ReturnType<typeof getPayload>>,
  chatId: string,
  eventType: 'start' | 'menu_click' | 'contact_shared' | 'form_completed',
  detail?: string,
) {
  try {
    await payload.create({
      collection: 'bot-events',
      overrideAccess: true,
      data: { chatId, eventType, ...(detail ? { payload: detail } : {}) },
    })
  } catch {
    // Подія не критична — головне, щоб сам бот не постраждав
  }
}
