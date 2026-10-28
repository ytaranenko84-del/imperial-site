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
 * Порожнє звернення гарячої лінії / відгуку — клієнт натиснув кнопку, але не
 * написав ні слова (часто просто гортає меню). Запис потрібен, щоб зловити
 * перше повідомлення, але команді його не показуємо — так само, як чернетки оцінки.
 */
export function isEmptyHotline(d: { thread?: unknown; transfers?: unknown }): boolean {
  const thread = Array.isArray(d.thread) ? (d.thread as { from?: unknown }[]) : []
  const transfers = Array.isArray(d.transfers) ? d.transfers : []
  return !transfers.length && !thread.some((t) => t.from === 'клієнт')
}

/**
 * Коротка ввічливість після оцінки: «дякую», «ок», 👍, «ні, спасибі»,
 * «вам також гарного вечора» — не привід знову вважати розмову невідповіданою.
 * Питання, цифри, «мало», «дорого» — уже розмова, на яку треба відповісти.
 */
const COURTESY = new Set([
  'дякую', 'дякуємо', 'дяк', 'спасибі', 'спасибо', 'спс', 'благодарю', 'вдячний', 'вдячна',
  'ок', 'окей', 'ok', 'okay', 'добре', 'гаразд', 'зрозумів', 'зрозуміла', 'зрозуміло', 'понял', 'поняла', 'понятно',
  'ясно', 'чудово', 'супер', 'отлично', 'відмінно', 'хорошо', 'принято', 'прийнято', 'домовились', 'договорились',
  'принял', 'приняла', 'прийняв', 'прийняла', 'подумаю', 'подумаем', 'подумаємо',
  // прощання й відповідь на побажання
  'навзаєм', 'взаємно', 'взаимно', 'гарного', 'хорошего', 'побачення', 'свидания', 'бувайте', 'пока',
])
const FILLER = new Set([
  'і', 'и', 'та', 'а', 'вам', 'вас', 'дуже', 'велике', 'большое', 'огромное', 'за', 'оцінку', 'оценку', 'інформацію', 'информацию',
  'до', 'всього', 'доброго', 'дня', 'вечора', 'вечера', 'ночі', 'ночи', 'вихідних', 'выходных', 'тижня', 'недели',
  'також', 'тоже', 'теж', 'тож', 'відповідь', 'ответ', 'я', 'ще', 'еще', 'ещё',
  // ввічлива відмова: «ні, дякую», «не треба, спасибі», «не актуально»
  'ні', 'нет', 'не', 'треба', 'надо', 'потрібно', 'нужно', 'актуально', 'поки', 'що', 'что',
])
// Відмова без «дякую» теж закриває розмову
const REFUSALS = ['не актуально', 'неактуально', 'не треба', 'не надо', 'не потрібно', 'не нужно']
// Те, на що відповідь потрібна завжди: питання, суми, торг, нові фото
const NEEDS_ANSWER = /\?|\d|мало|дорог|дешев|\[фото\]/i

export function isCourtesy(text: string | undefined | null): boolean {
  const raw = String(text || '').trim()
  if (!raw || raw.length > 80 || NEEDS_ANSWER.test(raw)) return false
  const words = raw.toLowerCase()
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/).filter(Boolean)
  // лише емодзі (👍, 🙏, 🙂) — теж ввічливість
  if (!words.length) return /\p{Extended_Pictographic}/u.test(raw)
  const joined = words.join(' ')
  return words.length <= 8
    && (words.some((w) => COURTESY.has(w)) || REFUSALS.some((r) => joined.includes(r)))
    && words.every((w) => COURTESY.has(w) || FILLER.has(w))
}

type TailEntry = { from?: string; text?: string; photo?: unknown }

/**
 * Чи не потребує відповіді те, що клієнт написав після останньої відповіді
 * команди. Дивимось на все це разом, а не лише на останнє: «А можна 3000? /
 * Дякую» — питання лишається питанням. Не потребує, якщо останнє — подяка чи
 * прощання, а ніде в цьому немає питання, сум, торгу чи нових фото.
 * Команда ще не відповідала зовсім — це нове звернення, відповідь потрібна.
 */
export function clientClosedConversation(thread: unknown): boolean {
  const arr = Array.isArray(thread) ? (thread as TailEntry[]) : []
  let i = arr.length
  while (i > 0 && arr[i - 1].from === 'клієнт') i--
  if (i === 0 || i === arr.length) return false
  const tail = arr.slice(i)
  if (!isCourtesy(tail[tail.length - 1].text)) return false
  return tail.every((t) => t.photo == null && !NEEDS_ANSWER.test(String(t.text || '')))
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
 * не приєднана до іншої й не передана в інший відділ. Статус не важливий — «Оцінено» вчора теж та сама розмова.
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
      // передана в інший відділ — розмова вже там
      { transferredTo: { exists: false } },
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
