import type { getPayload } from 'payload'

/**
 * Воронка бота: раніше нічого не писалось, поки людина не поділиться
 * номером — натиснув «Старт», подивився меню й пішов лишало нуль слідів.
 * Пишемо кожну дію в окремий журнал — так само, як лічильник rate-limit.
 */
export async function logBotEvent(
  payload: Awaited<ReturnType<typeof getPayload>>,
  chatId: string,
  eventType: 'start' | 'menu_click' | 'contact_shared' | 'form_completed' | 'item_question',
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

/**
 * Клієнт щось зробив у боті (написав, натиснув кнопку, поділився номером) —
 * запам'ятовуємо час. Так робочий стіл ставить ✓✓ «прочитано» під нашою
 * відповіддю: Telegram сам ботам про прочитання не каже, а після будь-якої
 * дії клієнта в чаті він нашу відповідь точно бачив.
 * Один точковий UPDATE без читання; рядка немає (номером не ділився) — нічого.
 */
export async function touchClient(payload: Awaited<ReturnType<typeof getPayload>>, chatId: string) {
  const db = payload.db as unknown as { name?: string; drizzle?: { execute: (q: unknown) => Promise<unknown> }; schemaName?: string }
  if (db.name !== 'postgres' || !db.drizzle || !chatId) return
  try {
    const { sql } = await import('@payloadcms/db-postgres')
    await db.drizzle.execute(
      sql`update ${sql.identifier(db.schemaName || 'public')}.telegram_clients set last_action_at = now() where chat_id = ${chatId}`,
    )
  } catch {
    // не критично для самого бота
  }
}
