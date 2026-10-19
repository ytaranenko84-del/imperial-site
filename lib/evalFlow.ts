import type { Payload } from 'payload'

/**
 * Правила «одна річ — одна заявка» спільні для бота, робочого столу й сайту.
 */

/** Скільки після останнього руху заявка ще вважається тією самою розмовою. */
export const SAME_CONVERSATION_MS = 3 * 24 * 60 * 60 * 1000

type ThreadEntry = { from?: string; text?: string; at?: string; photo?: number | null; mergedFrom?: number | null }

export type EvalDoc = {
  id: string | number
  clientChat?: string
  category?: string
  brand?: string
  model?: string
  year?: string
  title?: string
  comment?: string
  photos?: (string | number | { id?: string | number })[]
  name?: string
  phone?: string
  status?: string
  estimate?: number | null
  source?: string
  mergedInto?: number | null
  updatedAt?: string
  thread?: ThreadEntry[]
}

/** Порожня — клієнт натиснув «Оцінка», але ще нічого не надіслав. У робочому столі таких не показуємо. */
export function isEmptyEval(d: { comment?: unknown; photos?: unknown; thread?: unknown }): boolean {
  const photos = Array.isArray(d.photos) ? d.photos : []
  const thread = Array.isArray(d.thread) ? d.thread : []
  return !String(d.comment || '').trim() && !photos.length && !thread.length
}

/**
 * Коротка ввічливість після оцінки: «дякую», «ок», 👍 — не привід знову
 * вважати заявку невідповіданою. Усе довше чи з іншими словами («мало»,
 * питання) — уже розмова, на яку треба відповісти.
 */
const COURTESY = new Set([
  'дякую', 'дякуємо', 'дяк', 'спасибі', 'спасибо', 'спс', 'благодарю', 'вдячний', 'вдячна',
  'ок', 'окей', 'ok', 'okay', 'добре', 'гаразд', 'зрозумів', 'зрозуміла', 'зрозуміло', 'понял', 'поняла', 'понятно',
  'ясно', 'чудово', 'супер', 'отлично', 'відмінно', 'хорошо', 'принято', 'прийнято', 'домовились', 'договорились',
])
const FILLER = new Set([
  'і', 'и', 'та', 'вам', 'вас', 'дуже', 'велике', 'большое', 'огромное', 'за', 'оцінку', 'оценку', 'інформацію', 'информацию',
  'до', 'побачення', 'свидания', 'всього', 'доброго', 'гарного', 'хорошего', 'дня', 'вечора', 'вечера',
])

export function isCourtesy(text: string | undefined | null): boolean {
  const raw = String(text || '').trim()
  if (!raw || raw.length > 60) return false
  const words = raw.toLowerCase()
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/).filter(Boolean)
  // лише емодзі (👍, 🙏, 🙂) — теж ввічливість
  if (!words.length) return /\p{Extended_Pictographic}/u.test(raw)
  return words.length <= 6
    && words.some((w) => COURTESY.has(w))
    && words.every((w) => COURTESY.has(w) || FILLER.has(w))
}

/** Статус після відповіді співробітника: сума — «Оцінено», відмова — «Відмова», решта — «В роботі». */
export function statusAfterStaffReply(opts: { templateTitle?: string; hasAmount?: boolean; sumDetected?: boolean }): 'done' | 'reject' | 'work' {
  const title = (opts.templateTitle || '').toLowerCase()
  if (/відмов|військ/.test(title)) return 'reject'
  if (opts.hasAmount || opts.sumDetected) return 'done'
  return 'work'
}

/** Рядок, що дописуємо до оцінки клієнту: як почати нову річ, а не писати про неї в старій заявці. */
export const NEW_ITEM_HINT = 'Хочете оцінити іншу річ — натисніть «📸 Оцінка речі».'

/**
 * Поточна заявка на оцінку цього чату: остання, з рухом за останні 3 дні,
 * не приєднана до іншої. Статус не важливий — «Оцінено» вчора теж та сама розмова.
 */
export async function currentEvalFor(payload: Payload, chat: string): Promise<EvalDoc | null> {
  const since = new Date(Date.now() - SAME_CONVERSATION_MS).toISOString()
  const { docs } = await payload.find({
    collection: 'eval-requests', limit: 1, depth: 0, overrideAccess: true, pagination: false,
    sort: '-updatedAt',
    where: { and: [
      { clientChat: { equals: chat } },
      { updatedAt: { greater_than: since } },
      { mergedInto: { exists: false } },
    ] },
  })
  return (docs[0] as unknown as EvalDoc) || null
}

/** Що написати про річ клієнту: «iPhone 13 Pro» або початок опису. */
export function itemLabel(d: EvalDoc): string {
  const named = [d.brand, d.model].filter(Boolean).join(' ')
  if (named) return named
  const fromComment = String(d.comment || '').split('\n')[0].trim()
  if (fromComment) return fromComment.length > 40 ? `${fromComment.slice(0, 40)}…` : fromComment
  return String(d.title && d.title !== 'Без назви' ? d.title : 'ваша річ')
}
