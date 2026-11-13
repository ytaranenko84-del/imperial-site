import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { esc } from './telegram.ts'
import { NEW_ITEM_HINT } from './evalFlow.ts'

/**
 * «Змінити» й «Видалити» своє повідомлення клієнту з робочого столу.
 *
 * Щоб знайти повідомлення в Telegram, при відправці запам'ятовуємо його
 * номер у клієнта й номери копій у колег (поле tg у рядку переписки).
 * Повідомлення, надіслані до цього, такого номера не мають — їх змінити
 * не можна. Telegram дозволяє боту видаляти повідомлення лише 48 годин,
 * тож і змінювати після цього не даємо — правило одне.
 */

export const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000

export type TgCopy = { chat: string; msgId: number }
export type TgRef = {
  /** чат і номер повідомлення в клієнта (немає — пішло SMS чи не дійшло) */
  chat?: string
  msg?: number
  /** як дійшло: Telegram, SMS чи ніяк — для ✓ / ✗ на робочому столі */
  via?: 'telegram' | 'sms' | 'none'
  /** чому не дійшло: «Forbidden: bot was blocked by the user», «клієнта немає в боті» */
  error?: string
  /** копії у колег («Гаряча лінія №60 · Оксана відповів: …») */
  copies?: TgCopy[]
  /** до тексту дописано підказку «Хочете оцінити іншу річ…» — при зміні дописуємо так само */
  hint?: boolean
  /** «Заявка» / «Гаряча лінія» / «Відгук» — підпис копії */
  label?: string
}

export type ThreadEntry = {
  id?: string
  from?: string
  text?: string
  at?: string
  photo?: number | null
  mergedFrom?: number | null
  authorId?: string | null
  tg?: TgRef | null
  editedAt?: string | null
  history?: { text?: string; at?: string; by?: string }[] | null
}

export type RemovedEntry = ThreadEntry & { type: 'message' | 'note'; deletedAt: string; deletedBy: string }

/** Id рядка масиву в Payload — 24 hex-символи, як генерує він сам. */
export function newEntryId(): string {
  return randomBytes(12).toString('hex')
}

/** Текст повідомлення клієнту — той самий вигляд, що й при відправці. */
export function clientBody(text: string, hint?: boolean): string {
  return `<b>Ломбард «Імперіал»</b>\n${esc(hint ? `${text}\n\n${NEW_ITEM_HINT}` : text)}`
}

/** Текст копії колегам. */
export function copyBody(label: string, id: string | number, who: string, text: string, edited = false): string {
  return `<b>${esc(label)} №${id}</b> · ${esc(who)} ${edited ? 'змінив(ла) відповідь' : 'відповів'}:\n${esc(text)}`
}

export function withinEditWindow(at: unknown): boolean {
  const t = new Date(String(at || 0)).getTime()
  return Number.isFinite(t) && t > 0 && Date.now() - t < EDIT_WINDOW_MS
}

/**
 * Дописує копії колег у вже збережений рядок переписки — точково, одним
 * UPDATE рядка, а не перезаписом усього масиву: копії розсилаються вже
 * після відповіді співробітнику, і за цей час у переписку могло прийти
 * нове повідомлення клієнта.
 */
export async function saveTgCopies(
  payload: Payload, collection: 'eval-requests' | 'hotline-chats', entryId: string, tg: TgRef,
): Promise<void> {
  const db = payload.db as unknown as { name?: string; drizzle?: { execute: (q: unknown) => Promise<unknown> }; schemaName?: string }
  const table = collection === 'eval-requests' ? 'eval_requests_thread' : 'hotline_chats_thread'
  if (db.name === 'postgres' && db.drizzle) {
    await db.drizzle.execute(
      sql`update ${sql.identifier(db.schemaName || 'public')}.${sql.identifier(table)} set tg = ${JSON.stringify(tg)}::jsonb where id = ${entryId}`,
    )
  }
}
