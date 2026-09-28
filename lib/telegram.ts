import type { Payload } from 'payload'

/**
 * Робота з Telegram: надсилання заявок і відповідей.
 *
 * Бот не може написати першим тому, хто сам не почав із ним розмову, — тому
 * і співробітники, і клієнти спершу тиснуть «Почати». Співробітник після
 * цього ділиться номером, і ми звіряємо його з переліком отримувачів.
 */

const API = 'https://api.telegram.org/bot'

export const token = () => process.env.TELEGRAM_BOT_TOKEN || ''

/** Останні дев'ять цифр: люди пишуть номер у десятку різних форматів. */
export const normalizePhone = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-9)

type SendOptions = {
  /** «-1001234:12» — чат і гілка теми, якщо чат є форумом */
  chat: string
  text: string
  replyMarkup?: unknown
}

export async function send({ chat, text, replyMarkup }: SendOptions) {
  const t = token()
  if (!t) throw new Error('немає токена бота')

  const [chatId, threadId] = String(chat).split(':')
  const res = await fetch(`${API}${t}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.description || `telegram ${res.status}`)
  return json.result as { message_id: number; chat: { id: number } }
}

/**
 * Прибирає «годинник завантаження» з інлайн-кнопки. Без цього виклику
 * Telegram сам зніме його за кілька секунд, але кнопка виглядає завислою.
 * Best-effort: неполадка тут не має ламати основну дію кнопки.
 */
export async function answerCallback(callbackQueryId: string, text?: string) {
  const t = token()
  if (!t) return
  await fetch(`${API}${t}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
  }).catch(() => {})
}

/**
 * Світлини йдуть альбомом: Telegram забирає їх за посиланням сам.
 * Помилку не глушимо — інакше «фото не прийшли» неможливо пояснити.
 */
export async function sendPhotos(chat: string, urls: string[]) {
  const t = token()
  if (!t || !urls.length) return
  const [chatId, threadId] = String(chat).split(':')

  // до десяти світлин одним альбомом — інакше чат засипає окремими фото
  const media = urls.slice(0, 10).map((url) => ({ type: 'photo', media: url }))
  const res = await fetch(`${API}${t}/sendMediaGroup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      media,
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!json.ok) throw new Error(`фото: ${json.description || res.status}`)
}

/**
 * Одне фото за file_id — для живої пересилки в гарячій лінії, без збереження
 * в медіатеці сайту (на відміну від фото оцінки, які лишаються назавжди).
 */
export async function sendPhoto(chat: string, fileId: string, caption?: string) {
  const t = token()
  if (!t) return
  const [chatId, threadId] = String(chat).split(':')
  const res = await fetch(`${API}${t}/sendPhoto`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: fileId,
      ...(caption ? { caption, parse_mode: 'HTML' } : {}),
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!json.ok) throw new Error(`фото: ${json.description || res.status}`)
}

/** Завантажує байти фото з Telegram за file_id — щоб покласти в медіатеку сайту. */
export async function downloadTelegramFile(fileId: string): Promise<{ data: Buffer; name: string } | null> {
  const t = token()
  if (!t) return null
  try {
    const infoRes = await fetch(`${API}${t}/getFile?file_id=${encodeURIComponent(fileId)}`)
    const info = await infoRes.json().catch(() => null)
    const path = info?.result?.file_path as string | undefined
    if (!path) return null
    const fileRes = await fetch(`https://api.telegram.org/file/bot${t}/${path}`)
    if (!fileRes.ok) return null
    const data = Buffer.from(await fileRes.arrayBuffer())
    const name = path.split('/').pop() || `telegram-${Date.now()}.jpg`
    return { data, name }
  } catch {
    return null
  }
}

/** Екранування для parse_mode=HTML: текст людей не має ставати розміткою. */
export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))

const CATEGORY_LABEL: Record<string, string> = {
  watches: 'Годинники',
  digital: 'Цифрова техніка',
  home: 'Побутова техніка',
  tools: 'Інструмент',
  sport: 'Спорт і відпочинок',
  other: 'Інше (з бота)',
}

/** Картка заявки на оцінку — те, що бачить оцінювач у чаті. */
export function evalCard(doc: Record<string, unknown>, opts: { clientInBot: boolean }) {
  const lines = [
    `<b>Заявка №${doc.id}</b> · ${esc(CATEGORY_LABEL[String(doc.category)] || doc.category)}`,
    esc([doc.brand, doc.model].filter(Boolean).join(' ')),
    doc.year || doc.condition
      ? `${doc.year ? esc(doc.year) + ', ' : ''}${esc(doc.condition || '')}`.replace(/, $/, '')
      : '',
    doc.comment ? `\n${esc(doc.comment)}` : '',
    `\nКлієнт: ${esc(doc.name)}, ${esc(doc.phone)}`,
    opts.clientInBot
      ? 'Клієнт у боті: ✅ можна відповідати тут'
      : 'Клієнт у боті: ❌ відповідь лише дзвінком або SMS',
  ]
  return lines.filter(Boolean).join('\n')
}

/** Картка звернення (гаряча лінія чи відгук) — те, що бачить отримувач у чаті. */
export function hotlineCard(doc: Record<string, unknown>, text: string, label = 'Гаряча лінія') {
  return [
    `<b>${esc(label)} №${doc.id}</b>`,
    `Клієнт: ${esc(doc.name)}, ${esc(doc.phone)}`,
    text ? `\n${esc(text)}` : '',
    '\nЩоб відповісти — натисніть на це повідомлення → Reply',
  ].filter(Boolean).join('\n')
}

/** Дата й час словами: «4 вересня, 12:40». */
const MONTHS_UA = ['січня','лютого','березня','квітня','травня','червня',
  'липня','серпня','вересня','жовтня','листопада','грудня']

export function whenLabel(iso: unknown): string {
  const d = new Date(String(iso || ''))
  if (Number.isNaN(d.getTime())) return ''
  // Час київський: сервер працює в UTC, різниця влітку три години
  const k = new Date(d.getTime() + 3 * 60 * 60 * 1000)
  const hh = String(k.getUTCHours()).padStart(2, '0')
  const mm = String(k.getUTCMinutes()).padStart(2, '0')
  return `${k.getUTCDate()} ${MONTHS_UA[k.getUTCMonth()]}, ${hh}:${mm}`
}

/**
 * Картка для спільної групи відділень.
 *
 * Без телефона й імені: групу бачать усі відділення, а імʼя разом із фото речі
 * та сумою вже дозволяє впізнати людину. Для звʼязку лишається номер заявки —
 * за ним усе видно в адмінці.
 */
export function groupCard(doc: Record<string, unknown>) {
  const sum = Number(doc.estimate || 0)
  return [
    `<b>Заявка №${doc.id}</b> · ${esc(CATEGORY_LABEL[String(doc.category)] || doc.category)}`,
    esc([doc.brand, doc.model].filter(Boolean).join(' ')),
    doc.year || doc.condition
      ? `${doc.year ? esc(doc.year) + ', ' : ''}${esc(doc.condition || '')}`.replace(/, $/, '')
      : '',
    doc.comment ? `\n${esc(doc.comment)}` : '',
    sum > 0 ? `\n<b>Оцінка: ${sum.toLocaleString('uk-UA')} грн</b>` : '',
    `\nНадійшла: ${whenLabel(doc.createdAt)}`,
    doc.answeredAt
      ? `Оцінено: ${whenLabel(doc.answeredAt)}${doc.answeredBy ? ` · ${esc(doc.answeredBy)}` : ''}`
      : '',
  ].filter(Boolean).join('\n')
}

/**
 * Сума з відповіді оцінювача.
 *
 * Спершу число поруч зі знаком гривні. Якщо його немає — єдине число в тексті,
 * і тільки якщо воно не зустрічається в самій заявці: інакше відповідь
 * «Rolex Datejust 126334 — гарний стан» дала б оцінку 126 334 грн.
 */
export function sumFromText(
  text: string,
  ownNumbers = '',
  opts: { requireCurrency?: boolean } = {},
): number | null {
  const t = String(text || '').replace(/\u00a0/g, ' ')
  const pick = (raw: string) => {
    const n = Number(raw.replace(/\s/g, ''))
    return Number.isFinite(n) && n >= 100 && n <= 10_000_000 ? n : null
  }
  const withCurrency = t.match(/(\d[\d\s]{2,})\s*(?:грн|₴|гривень|грв)/i)
  if (withCurrency) return pick(withCurrency[1])
  // Виправлення суми ловимо лише з явною валютою: без цього одне випадкове
  // число в подальшій переписці (серійник, дата) тихо переписало б оцінку.
  if (opts.requireCurrency) return null

  const own = new Set((String(ownNumbers).match(/\d+/g) || []))
  const numbers = (t.match(/\d[\d\s]*\d|\d+/g) || []).filter((n) => !own.has(n.replace(/\s/g, '')))
  if (numbers.length !== 1) return null
  return pick(numbers[0])
}

/** Картка броні — те, що бачить відділення. */
export function bookingCard(doc: Record<string, unknown>, branchName: string, till: string) {
  const amount = Number(doc.amount || 0).toLocaleString('uk-UA')
  const parts = [String(doc.purity || ''), doc.weight ? `${doc.weight} г` : '', doc.days ? `${doc.days} дн.` : '']
    .filter(Boolean).join(', ')
  return [
    `<b>Бронь №${doc.id}</b>`,
    `Сума: <b>${amount} грн</b>${parts ? ` · ${esc(parts)}` : ''}`,
    doc.tier ? `Статус: ${esc(doc.tier)}` : '',
    `Клієнт: ${esc(doc.name)}, ${esc(doc.phone)}`,
    `Відділення: ${esc(branchName)}`,
    `Діє до: ${esc(till)}`,
  ].filter(Boolean).join('\n')
}

/**
 * Кому надсилати заявку напрямку: профільні оцінювачі плюс усі адміністратори.
 * Один і той самий чат не отримає заявку двічі.
 *
 * «Гаряча лінія» — окрема черга (див. hotlineRecipients): без явного винятку
 * такий отримувач із порожніми напрямками потрапив би сюди як «хоче все».
 */
export async function recipientsFor(payload: Payload, category: string) {
  const { docs } = await payload.find({
    collection: 'recipients',
    limit: 100,
    depth: 0,
    overrideAccess: true,
    where: { active: { equals: true } },
  })

  const chats = new Map<string, string>()
  for (const r of docs) {
    const chat = String((r as { chatId?: string }).chatId || '')
    if (!chat) continue
    const kind = String((r as { kind?: string }).kind)
    const cats = ((r as { categories?: string[] }).categories || []) as string[]
    /*
     * «Інше» — синтетична категорія вільних заявок із бота (клієнт описує
     * річ текстом, без вибору напрямку): жоден оцінювач її свідомо не обирав
     * у своєму профілі, тож без явного винятку такі заявки бачив би лише
     * адміністратор — жоден профільний оцінювач не отримав би їх узагалі.
     */
    const wanted = kind === 'admin'
      || (kind === 'expert' && (category === 'other' || !cats.length || cats.includes(category)))
    if (wanted) chats.set(chat, String((r as { title?: string }).title || ''))
  }
  return chats
}

/**
 * Хто отримує звернення на гарячу лінію й відгуки — окрема від оцінки черга:
 * оператор гарячої лінії плюс адміністратори, керівництво має бачити кожне.
 */
export async function hotlineRecipients(payload: Payload) {
  const { docs } = await payload.find({
    collection: 'recipients',
    limit: 100,
    depth: 0,
    overrideAccess: true,
    where: { active: { equals: true } },
  })
  const chats = new Map<string, string>()
  for (const r of docs) {
    const chat = String((r as { chatId?: string }).chatId || '')
    const kind = String((r as { kind?: string }).kind)
    if (chat && (kind === 'admin' || kind === 'hotline')) chats.set(chat, String((r as { title?: string }).title || ''))
  }
  return chats
}

/**
 * Пряме посилання на файл у сховищі.
 *
 * Telegram завантажує фото сам, і йому краще давати статичний файл, а не
 * адресу сайту: дорога через функцію хостингу довша, і на холодному старті
 * Telegram відповідає «WEBPAGE_CURL_FAILED». Якщо сховище не налаштоване
 * (розробка на своєму компʼютері) — лишається адреса сайту.
 */
export function mediaUrl(filename: string): string {
  const name = encodeURIComponent(filename)
  const endpoint = process.env.S3_ENDPOINT || ''
  const bucket = process.env.S3_BUCKET || ''
  const host = endpoint.match(/^https:\/\/([^.]+)\.storage\.supabase\.co/)?.[1]
  if (host && bucket) {
    return `https://${host}.supabase.co/storage/v1/object/public/${bucket}/${name}`
  }
  const base = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/$/, '')
  return `${base}/api/media/file/${name}`
}
