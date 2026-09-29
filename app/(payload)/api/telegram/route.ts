import { getPayload } from 'payload'
import config from '@payload-config'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { answerCallback, esc, normalizePhone, send, sumFromText, token } from '@/lib/telegram.ts'
import { distanceKm } from '@/lib/geo.ts'
import { notifyRecipients } from '@/lib/push.ts'

/**
 * Приймання подій від Telegram.
 *
 * Що вміє:
 *   • «Почати» — вітання, за посиланням із міткою заявки прив'язує клієнта;
 *   • кнопки меню — гаряча лінія, оцінка товару, брони, найближче відділення;
 *   • «Поділитися номером» — звіряє з робочими, або запам'ятовує клієнта
 *     (один раз назавжди — далі номер не перепитуємо);
 *   • відповідь на картку (Reply) — пересилає клієнтові й зберігає листування.
 *
 * Адреса приймання одна на бота, тож цей бот обслуговує лише сайт.
 */

export const dynamic = 'force-dynamic'

type TgUser = { id: number; first_name?: string; username?: string }
type TgChatMember = {
  chat: { id: number; title?: string; type: string }
  from?: { id: number; first_name?: string; username?: string }
  new_chat_member?: { status: string }
}
type TgPhotoSize = { file_id: string; file_size?: number; width: number; height: number }

type TgMessage = {
  message_id: number
  chat: { id: number; type: string }
  from?: TgUser
  text?: string
  caption?: string
  photo?: TgPhotoSize[]
  contact?: { phone_number: string; user_id?: number }
  location?: { latitude: number; longitude: number }
  migrate_to_chat_id?: number
  reply_to_message?: { message_id: number; text?: string }
  message_thread_id?: number
}

/** Натискання інлайн-кнопки під повідомленням (наприклад, у «Історії»). */
type TgCallbackQuery = {
  id: string
  from?: TgUser
  message?: TgMessage
  data?: string
}

/** «-1001234:12» — чат і гілка теми, якщо чат є форумом. Той самий формат, що й в `send()`. */
function chatKeyOf(msg: Pick<TgMessage, 'chat' | 'message_thread_id'>): string {
  return msg.message_thread_id ? `${msg.chat.id}:${msg.message_thread_id}` : String(msg.chat.id)
}

const CONTACT_KEYBOARD = {
  keyboard: [[{ text: '📱 Поділитися номером', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

const LOCATION_KEYBOARD = {
  keyboard: [[{ text: '📍 Надіслати геолокацію', request_location: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

/** Кнопки постійного меню замість слеш-команд: клієнту нема чого набирати. */
const BTN = {
  hotline: '☎️ Гаряча лінія',
  otsinka: '📸 Оцінка речі',
  bron: '📋 Мої броні',
  viddilennya: '📍 Найближче відділення',
  umovy: '💰 Умови',
  review: '💬 Відгуки та побажання',
  goldPrice: '🪙 Ціна на золото',
  history: '📊 Історія',
  historyEval: '📸 Історія оцінок',
  historyHotline: '☎️ Історія гарячої лінії',
  historyReview: '💬 Історія відгуків',
  historyBooking: '📋 Всі брони',
  back: '⬅️ Назад',
} as const
type Intent = keyof typeof BTN

const MENU_KEYBOARD = {
  keyboard: [
    [{ text: BTN.hotline }, { text: BTN.review }],
    [{ text: BTN.otsinka }, { text: BTN.bron }],
    [{ text: BTN.viddilennya }, { text: BTN.umovy }],
  ],
  resize_keyboard: true,
}

/** Те саме меню, плюс службові кнопки — бачить лише зареєстрований адміністратор. */
const ADMIN_MENU_KEYBOARD = {
  keyboard: [...MENU_KEYBOARD.keyboard, [{ text: BTN.goldPrice }, { text: BTN.history }]],
  resize_keyboard: true,
}

/** Підменю «Історія»: чотири звіти й повернення до основного меню. */
const HISTORY_KEYBOARD = {
  keyboard: [
    [{ text: BTN.historyEval }, { text: BTN.historyHotline }],
    [{ text: BTN.historyReview }, { text: BTN.historyBooking }],
    [{ text: BTN.back }],
  ],
  resize_keyboard: true,
}

const HISTORY_LIMIT = 12

/** Гранична вилка ціни за грам — щоб зайвий нуль у введенні не пройшов непоміченим. */
const GOLD_PRICE_MIN = 500
const GOLD_PRICE_MAX = 15000
/** Проби, де скупка дорівнює заставі — без надбавки, на відміну від решти проб. */
const NO_BUYOUT_MARKUP_PURITIES = [375, 333]
/** Проба, від якої рахується решта прайсу золота. */
const ANCHOR_PURITY = 585
const ANCHOR_BUYOUT_MARKUP = 50

const REVIEW_GREETING = [
  'Дякуємо, що хочете поділитися враженням!',
  '',
  'Напишіть відгук, побажання або скаргу — усе, що вважаєте за потрібне нам сказати. '
    + 'Байдуже, гарний був досвід чи ні: нам важливо знати і те, і інше.',
  '',
  'Кожне повідомлення читає особисто керівництво мережі — жодне не залишиться непоміченим.',
].join('\n')

const OTSINKA_GUIDE = [
  'Ви звернулися для оцінки товару.',
  '',
  'Напишіть, будь ласка:',
  '• предмет застави (наприклад: мобільний телефон, ноутбук, планшет, годинник, перфоратор, пральна машина, велосипед тощо)',
  '• повну модель',
  '• стан речі, комплектація (коробка, зарядка, документи — якщо є)',
  '',
  'Також надішліть фото самого предмета та фото дефектів, якщо вони є.',
  '',
  'Чим детальніше опишете річ і більше фото надішлете — тим точніше ми оцінимо. '
    + 'Втім, кінцева сума завжди визначається у відділенні: дистанційно неможливо '
    + 'побачити повний технічний стан речі.',
].join('\n')

const HELLO_NEW = [
  'Вітаємо в «Імперіалі» 👋',
  '',
  'Якщо ви <b>співробітник</b> — натисніть кнопку нижче, і я звірю номер із робочим.',
  '',
  'Якщо ви <b>клієнт</b> — поділіться номером: запам’ятаю його один раз і більше не питатиму.',
].join('\n')

const HELLO_KNOWN = 'Раді бачити знову! Оберіть, будь ласка, що вас цікавить 👇'

/** Текст повідомлення незалежно від того, підпис це під фото чи звичайний текст. */
function textOf(msg: TgMessage): string {
  return String(msg.text || msg.caption || '').trim()
}

/** Фото середнього розміру: найбільше вантажиться довше, а тут важлива швидкість. */
function pickPhoto(msg: TgMessage): string | null {
  const sizes = msg.photo
  if (!sizes?.length) return null
  return sizes[Math.max(0, sizes.length - 2)].file_id
}

function displayName(from?: TgUser, fallback = 'клієнт') {
  return [from?.first_name, from?.username ? `@${from.username}` : ''].filter(Boolean).join(' ') || fallback
}

/** Команда з тексту: у групах Telegram дописує «@ім'я_бота»; лишаємо для сумісності зі старим меню. */
function commandFrom(text?: string): string | null {
  const m = /^\/([a-z_]+)(?:@\w+)?(?:\s|$)/i.exec(text || '')
  return m ? m[1].toLowerCase() : null
}

/** Кнопка меню з тексту повідомлення: або натиснута кнопка, або стара слеш-команда. */
function matchIntent(text?: string): Intent | null {
  const t = (text || '').trim()
  for (const [key, label] of Object.entries(BTN)) {
    if (t === label) return key as Intent
  }
  const cmd = commandFrom(text)
  if (cmd === 'bron') return 'bron'
  if (cmd === 'viddilennya') return 'viddilennya'
  if (cmd === 'otsinka') return 'otsinka'
  if (cmd === 'umovy') return 'umovy'
  if (cmd === 'liniya' || cmd === 'operator' || cmd === 'hotline') return 'hotline'
  if (cmd === 'vidhuky' || cmd === 'review') return 'review'
  return null
}

/** Номер заявки з картки: «Заявка №148» або «Бронь №12». */
function requestIdFrom(text?: string) {
  const m = /(?:Заявка|Бронь)\s*№(\d+)/i.exec(text || '')
  return m ? Number(m[1]) : null
}

/** Номер звернення з картки гарячої лінії чи відгуку: «Гаряча лінія №42» / «Відгук №42». */
function hotlineIdFrom(text?: string) {
  const m = /(?:Гаряча лінія|Відгук)\s*№(\d+)/i.exec(text || '')
  return m ? Number(m[1]) : null
}

/** Проба й нова ціна з тексту адміна: «585 3200» або «585 3200,50». */
function goldPriceInputFrom(text?: string): { purity: number; price: number } | null {
  const m = /^(\d{3}(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$/.exec((text || '').trim())
  if (!m) return null
  const purity = Number(m[1].replace(',', '.'))
  const price = Number(m[2].replace(',', '.'))
  if (!Number.isFinite(purity) || !Number.isFinite(price)) return null
  return { purity, price }
}

/** Пропозиція зміни ціни з першого рядка картки-підтвердження: «Зміна ціни на золото 585° → 3200 грн». */
function goldPriceProposalFrom(text?: string): number | null {
  const m = /Зміна ціни на золото 585°\s*→\s*(\d+(?:[.,]\d+)?)\s*грн/.exec(text || '')
  if (!m) return null
  const price = Number(m[1].replace(',', '.'))
  return Number.isFinite(price) ? price : null
}

/** Підтверджувальні слова в тексті — і «так», і випадкове «Так, підтверджую» підходять. */
function isConfirmWord(text?: string): boolean {
  return /^(так|да|ок|окей|підтвер|confirm|yes)/i.test((text || '').trim())
}

function hotlineLabel(kind?: string) {
  return kind === 'review' ? 'Відгук' : 'Гаряча лінія'
}

async function hotlineRecipientsFor(payload: Awaited<ReturnType<typeof getPayload>>) {
  const { hotlineRecipients } = await import('@/lib/telegram.ts')
  return hotlineRecipients(payload)
}

/**
 * «2. 1200-1400грн» → бере шаблон з кодом «2», підставляє «1200-1400грн»
 * замість {сума}. Код без крапки (гола цифра, що збігається з реальним
 * шаблоном) — попередження співробітнику замість тексту клієнту: інакше
 * недописане повідомлення («2», ще не встиг дописати суму) пішло б як є.
 */
async function resolveTemplate(
  payload: Awaited<ReturnType<typeof getPayload>>,
  raw: string,
): Promise<{ text: string } | { warn: string }> {
  const trimmed = (raw || '').trim()

  const withDot = trimmed.match(/^(\d+)\.\s*([\s\S]*)$/)
  if (withDot) {
    const [, code, rest] = withDot
    const { docs } = await payload.find({
      collection: 'reply-templates', limit: 1, depth: 0, overrideAccess: true,
      where: { code: { equals: code } },
    })
    const tpl = docs[0] as { text?: string } | undefined
    if (tpl?.text) {
      /*
       * Без «грн» сума в готовому тексті («…становитиме 1200-1500. Чекаємо…
       * imperial24.com.ua») губиться серед інших цифр повідомлення (домен
       * теж містить «24») — розбір суми з відповіді її просто не знаходить.
       * Дописуємо валюту тут, а не покладаємось, що оцінювач сам її набере.
       */
      const rawRest = rest.trim()
      const amount = rawRest && !/грн|₴|гривень|грв/i.test(rawRest) ? `${rawRest} грн` : rawRest
      const text = tpl.text.includes('{сума}') ? tpl.text.split('{сума}').join(amount) : tpl.text
      return { text }
    }
    return { text: trimmed }
  }

  if (/^\d+$/.test(trimmed)) {
    const { docs } = await payload.find({
      collection: 'reply-templates', limit: 1, depth: 0, overrideAccess: true,
      where: { code: { equals: trimmed } },
    })
    if (docs.length) {
      return { warn: `Здається, ви хочете використати шаблон — не забудьте крапку після номера, `
        + `наприклад «${esc(trimmed)}. текст».` }
    }
  }

  return { text: raw }
}

/** Команда /шаблони — шпаргалка з кодами, щоб не тримати їх у голові. */
async function sendTemplatesList(payload: Awaited<ReturnType<typeof getPayload>>, chat: string) {
  const { docs } = await payload.find({
    collection: 'reply-templates', limit: 50, depth: 0, overrideAccess: true, sort: 'order',
  })
  if (!docs.length) {
    await send({ chat, text: 'Шаблонів ще немає — додайте їх в адмінці.' })
    return
  }
  const lines = docs.map((d) => `<b>${esc(String(d.code))}.</b> ${esc(String(d.title))}\n<i>${esc(String(d.text))}</i>`)
  await send({ chat, text: `<b>Шаблони відповідей</b>\n(у Reply пишіть «код. текст», напр. «2. 1200-1400грн»)\n\n${lines.join('\n\n')}` })
}

/**
 * Закриває чуже відкрите звернення (гаряча лінія чи відгук) того самого чату.
 * Без цього стара розмова й далі «перехоплювала» б повідомлення клієнта,
 * призначені вже для нового контексту (заявки на оцінку абощо).
 */
async function closeOpenHotline(payload: Awaited<ReturnType<typeof getPayload>>, chat: string) {
  const { docs } = await payload.find({
    collection: 'hotline-chats', limit: 5, depth: 0, overrideAccess: true,
    where: { clientChat: { equals: chat }, status: { not_equals: 'done' } },
  })
  for (const d of docs) {
    await payload.update({
      collection: 'hotline-chats', id: d.id, overrideAccess: true, data: { status: 'done' },
    }).catch(() => {})
  }
}

/** Чи це чат зареєстрованого співробітника (адмін, оцінювач, гаряча лінія). */
async function isRecipientChat(payload: Awaited<ReturnType<typeof getPayload>>, chat: string): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'recipients', limit: 1, depth: 0, overrideAccess: true,
    where: { chatId: { equals: chat }, active: { equals: true } },
  })
  return docs.length > 0
}

/** Чи це чат саме адміністратора — керування ціною на золото бачить лише він. */
async function isAdminChat(payload: Awaited<ReturnType<typeof getPayload>>, chat: string): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'recipients', limit: 1, depth: 0, overrideAccess: true,
    where: { chatId: { equals: chat }, active: { equals: true }, kind: { equals: 'admin' } },
  })
  return docs.length > 0
}

type GoldRow = {
  id: string | number; purity: number; purityLabel: string
  oldBase: number; newBase: number; oldBuyout: number; newBuyout: number
}

/**
 * Прайс золота від однієї опорної проби (585): решта проб рахується за вмістом
 * золота (лінійно від 585), скупка — так само, але від «585-скупки»
 * (585-заства + 50 грн). 375 і 333 проба — виняток: скупка там дорівнює
 * заставі, без додаткової націнки. Перевірено на бойовому прайсі — цифри
 * збігаються день у день.
 */
async function computeGoldPrices(
  payload: Awaited<ReturnType<typeof getPayload>>,
  newAnchorBase: number,
): Promise<GoldRow[] | null> {
  const { docs } = await payload.find({
    collection: 'tariffs', limit: 100, depth: 0, overrideAccess: true,
    where: { metal: { equals: 'gold' } },
  })
  const anchor = docs.find((d) => Number(d.purity) === ANCHOR_PURITY)
  if (!anchor) return null

  const newAnchorBuyout = newAnchorBase + ANCHOR_BUYOUT_MARKUP
  const rows: GoldRow[] = []
  for (const d of docs) {
    const purity = Number(d.purity)
    if (!Number.isFinite(purity)) continue
    const oldBase = Number(d.basePrice || 0)
    const oldBuyout = Number(d.purchasePrice || oldBase)
    const noMarkup = NO_BUYOUT_MARKUP_PURITIES.includes(purity)

    const newBase = purity === ANCHOR_PURITY
      ? newAnchorBase
      : Math.round(newAnchorBase * (purity / ANCHOR_PURITY))
    const newBuyout = purity === ANCHOR_PURITY
      ? newAnchorBuyout
      : noMarkup ? newBase : Math.round(newAnchorBuyout * (purity / ANCHOR_PURITY))

    rows.push({
      id: d.id, purity, purityLabel: String(d.purityLabel || purity),
      oldBase, newBase, oldBuyout, newBuyout,
    })
  }
  return rows.sort((a, b) => b.purity - a.purity)
}

function goldRowLine(r: GoldRow): string {
  const buyout = r.oldBuyout === r.oldBase && r.newBuyout === r.newBase
    ? 'скупка = застава'
    : `скупка ${r.oldBuyout} → ${r.newBuyout}`
  return `${esc(r.purityLabel)}°: ${r.oldBase} → <b>${r.newBase}</b> грн (${buyout})`
}

/** Адмін ввів пробу й ціну — рахуємо весь перерахунок і показуємо на підтвердження. */
async function proposeGoldPrice(
  payload: Awaited<ReturnType<typeof getPayload>>,
  chat: string,
  purity: number,
  price: number,
) {
  if (purity !== ANCHOR_PURITY) {
    await send({
      chat,
      text: `Наразі можна змінювати ціну лише через пробу ${ANCHOR_PURITY}° — решта проб перераховується від неї автоматично.`,
    })
    return
  }
  if (price < GOLD_PRICE_MIN || price > GOLD_PRICE_MAX) {
    await send({
      chat,
      text: `Перевірте число — ${price} грн за грам виглядає як помилка (очікую від ${GOLD_PRICE_MIN} до ${GOLD_PRICE_MAX}).`,
    })
    return
  }

  const rows = await computeGoldPrices(payload, price)
  if (!rows) {
    await send({ chat, text: `У прайсі не знайшлась проба ${ANCHOR_PURITY}° — перевірте таблицю тарифів в адмінці.` })
    return
  }

  const lines = rows.map(goldRowLine)
  await send({
    chat,
    text: `Зміна ціни на золото 585° → ${price} грн (скупка ${price + ANCHOR_BUYOUT_MARKUP} грн)\n\n`
      + `Буде перераховано:\n${lines.join('\n')}\n\n`
      + 'Підтвердіть — Reply "так" на це повідомлення, щоб застосувати.',
  })
}

/** Підтвердження отримано (Reply на пропозицію) — застосовуємо перерахунок насправді. */
async function confirmGoldPrice(
  payload: Awaited<ReturnType<typeof getPayload>>,
  msg: TgMessage,
  chat: string,
  newAnchorBase: number,
) {
  if (!(await isAdminChat(payload, chat))) return

  if (!isConfirmWord(textOf(msg))) {
    await send({ chat, text: 'Скасовано, нічого не змінено. Напишіть пробу і ціну ще раз, якщо потрібно.' })
    return
  }

  const rows = await computeGoldPrices(payload, newAnchorBase)
  if (!rows) {
    await send({ chat, text: `У прайсі не знайшлась проба ${ANCHOR_PURITY}° — перевірте таблицю тарифів в адмінці.` })
    return
  }

  for (const r of rows) {
    await payload.update({
      collection: 'tariffs', id: r.id, overrideAccess: true,
      data: { basePrice: r.newBase, purchasePrice: r.newBuyout },
    }).catch(() => {})
  }

  const lines = rows.map((r) => `${esc(r.purityLabel)}°: <b>${r.newBase}</b> грн (скупка ${r.newBuyout})`)
  await send({
    chat,
    text: `Готово, прайс на золото оновлено:\n\n${lines.join('\n')}`,
    replyMarkup: ADMIN_MENU_KEYBOARD,
  })
}

// ────────────────────────── історія для адміна ──────────────────────────

/** Дата й час коротко: «27.09 14:30». */
function shortWhen(iso: unknown): string {
  const d = new Date(String(iso || ''))
  if (Number.isNaN(d.getTime())) return ''
  const k = new Date(d.getTime() + 3 * 60 * 60 * 1000) // київський час
  const dd = String(k.getUTCDate()).padStart(2, '0')
  const mm = String(k.getUTCMonth() + 1).padStart(2, '0')
  const hh = String(k.getUTCHours()).padStart(2, '0')
  const mi = String(k.getUTCMinutes()).padStart(2, '0')
  return `${dd}.${mm} ${hh}:${mi}`
}

const EVAL_CATEGORY_LABEL: Record<string, string> = {
  watches: 'Годинники', digital: 'Цифрова техніка', home: 'Побутова техніка',
  tools: 'Інструмент', sport: 'Спорт і відпочинок', other: 'Інше',
}
const EVAL_STATUS_LABEL: Record<string, string> = {
  new: 'нова', work: 'в роботі', done: 'оцінено', reject: 'відмова',
}
const HOTLINE_STATUS_LABEL: Record<string, string> = {
  new: 'нове', work: 'в роботі', done: 'закрито',
}
const BOOKING_STATUS_LABEL: Record<string, string> = {
  new: 'нова', came: 'клієнт прийшов', done: 'оформлено', missed: 'не прийшов',
}

/** Список + кнопки під ним («№148», «№149» …) — по одній на кожен рядок списку. */
type HistoryReport = { text: string; buttons: { id: string | number; label: string }[] }

/** Інлайн-кнопки під списком «Історії»: по три в ряд, callback_data виду «hev:148». */
function historyInlineKeyboard(prefix: string, buttons: HistoryReport['buttons']) {
  if (!buttons.length) return undefined
  const rows: { text: string; callback_data: string }[][] = []
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3).map((b) => ({ text: b.label, callback_data: `${prefix}:${b.id}` })))
  }
  return { inline_keyboard: rows }
}

async function historyEvalText(payload: Awaited<ReturnType<typeof getPayload>>): Promise<HistoryReport> {
  const { docs } = await payload.find({
    collection: 'eval-requests', limit: HISTORY_LIMIT, depth: 0, overrideAccess: true, sort: '-createdAt',
  })
  if (!docs.length) return { text: 'Заявок на оцінку ще немає.', buttons: [] }
  const lines = docs.map((d) => {
    const cat = EVAL_CATEGORY_LABEL[String(d.category)] || String(d.category || '')
    const status = EVAL_STATUS_LABEL[String(d.status)] || String(d.status || '')
    const sum = Number(d.estimate || 0)
    return `№${d.id} · ${shortWhen(d.createdAt)} · ${esc(cat)} · ${esc(d.name || '')} · ${status}`
      + (sum > 0 ? ` · ${sum.toLocaleString('uk-UA')} грн` : '')
  })
  return {
    text: `<b>Останні заявки на оцінку:</b>\n\n${lines.join('\n')}\n\nПовна переписка — за кнопкою нижче:`,
    buttons: docs.map((d) => ({ id: d.id, label: `№${d.id}` })),
  }
}

async function hotlineHistoryText(
  payload: Awaited<ReturnType<typeof getPayload>>,
  kind: 'hotline' | 'review',
  title: string,
  emptyText: string,
): Promise<HistoryReport> {
  const { docs } = await payload.find({
    collection: 'hotline-chats', limit: HISTORY_LIMIT, depth: 0, overrideAccess: true, sort: '-createdAt',
    where: { kind: { equals: kind } },
  })
  if (!docs.length) return { text: emptyText, buttons: [] }
  const lines = docs.map((d) => {
    const status = HOTLINE_STATUS_LABEL[String(d.status)] || String(d.status || '')
    return `№${d.id} · ${shortWhen(d.createdAt)} · ${esc(d.name || '')} · ${status}`
  })
  return {
    text: `<b>${esc(title)}:</b>\n\n${lines.join('\n')}\n\nПовна переписка — за кнопкою нижче:`,
    buttons: docs.map((d) => ({ id: d.id, label: `№${d.id}` })),
  }
}

async function historyHotlineText(payload: Awaited<ReturnType<typeof getPayload>>): Promise<HistoryReport> {
  return hotlineHistoryText(payload, 'hotline', 'Останні звернення на гарячу лінію', 'Звернень на гарячу лінію ще немає.')
}

async function historyReviewText(payload: Awaited<ReturnType<typeof getPayload>>): Promise<HistoryReport> {
  return hotlineHistoryText(payload, 'review', 'Останні відгуки та скарги', 'Відгуків і скарг ще немає.')
}

/** Повний текст, урізаний до безпечної довжини для одного повідомлення Telegram (ліміт — 4096). */
function trimThread(text: string): string {
  const LIMIT = 3500
  if (text.length <= LIMIT) return text
  return `…показано останні повідомлення…\n${text.slice(text.length - LIMIT)}`
}

/** Повна переписка по заявці на оцінку: опис клієнта (до першої відповіді) + вся гілка після. */
function evalThreadText(doc: Record<string, unknown>): string {
  const cat = EVAL_CATEGORY_LABEL[String(doc.category)] || String(doc.category || '')
  const status = EVAL_STATUS_LABEL[String(doc.status)] || String(doc.status || '')
  const sum = Number(doc.estimate || 0)
  const parts = [
    `<b>Заявка №${doc.id}</b> · ${esc(cat)} · ${esc(doc.name || '')}, ${esc(doc.phone || '')} · ${status}`
      + (sum > 0 ? ` · ${sum.toLocaleString('uk-UA')} грн` : ''),
  ]
  if (doc.comment) parts.push('', `<b>Клієнт (опис)</b>:\n${esc(String(doc.comment))}`)
  const thread = (doc.thread || []) as { from: string; text: string; at: string }[]
  if (thread.length) {
    parts.push('')
    for (const t of thread) parts.push(`<b>${esc(t.from)}</b> (${shortWhen(t.at)}): ${esc(t.text)}`)
  }
  if (!doc.comment && !thread.length) parts.push('', '(переписки ще немає)')
  return trimThread(parts.join('\n'))
}

/** Повна переписка по зверненню на гарячу лінію чи відгуку: вся гілка від першого повідомлення. */
function hotlineThreadText(doc: Record<string, unknown>): string {
  const label = hotlineLabel(String(doc.kind))
  const status = HOTLINE_STATUS_LABEL[String(doc.status)] || String(doc.status || '')
  const parts = [`<b>${esc(label)} №${doc.id}</b> · ${esc(doc.name || '')}, ${esc(doc.phone || '')} · ${status}`, '']
  const thread = (doc.thread || []) as { from: string; text: string; at: string }[]
  if (thread.length) {
    for (const t of thread) parts.push(`<b>${esc(t.from)}</b> (${shortWhen(t.at)}): ${esc(t.text)}`)
  } else {
    parts.push('(переписки ще немає)')
  }
  return trimThread(parts.join('\n'))
}

/** Натиснута кнопка «№…» під списком «Історії» — показує повну переписку саме цієї заявки. */
async function handleHistoryCallback(
  payload: Awaited<ReturnType<typeof getPayload>>,
  cq: TgCallbackQuery,
) {
  const msg = cq.message
  if (!msg) return
  const chat = chatKeyOf(msg)

  if (!(await isAdminChat(payload, chat))) {
    await answerCallback(cq.id, 'Лише для адміністратора')
    return
  }

  const [kind, idStr] = (cq.data || '').split(':')
  const id = Number(idStr)
  if (!id) {
    await answerCallback(cq.id)
    return
  }

  if (kind === 'hev') {
    const doc = await payload.findByID({ collection: 'eval-requests', id, depth: 0, overrideAccess: true }).catch(() => null)
    await answerCallback(cq.id)
    await send({ chat, text: doc ? evalThreadText(doc) : `Заявку №${id} не знайдено — можливо, видалена.` })
    return
  }

  if (kind === 'hho') {
    const doc = await payload.findByID({ collection: 'hotline-chats', id, depth: 0, overrideAccess: true }).catch(() => null)
    await answerCallback(cq.id)
    await send({ chat, text: doc ? hotlineThreadText(doc) : `Звернення №${id} не знайдено — можливо, видалене.` })
    return
  }

  await answerCallback(cq.id)
}

/** Кнопка «🗑 Видалити» під підтвердженням відповіді: callback_data виду «del:eval:128». */
async function handleDeleteCallback(
  payload: Awaited<ReturnType<typeof getPayload>>,
  cq: TgCallbackQuery,
) {
  const msg = cq.message
  if (!msg) return
  const chat = chatKeyOf(msg)

  if (!(await isRecipientChat(payload, chat))) {
    await answerCallback(cq.id, 'Недоступно')
    return
  }

  const [, kind, idStr, key] = (cq.data || '').split(':')
  const id = Number(idStr)
  if (!id) { await answerCallback(cq.id); return }

  const collection = kind === 'hotline' ? 'hotline-chats' : 'eval-requests'
  const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true }).catch(() => null)
  const lastReply = (doc as {
    lastReply?: {
      clientChat?: string; clientMsgId?: number; staffCopies?: { chat: string; msgId: number }[]; key?: string
    } | null
  } | null)?.lastReply

  if (!lastReply?.clientMsgId) {
    await answerCallback(cq.id, 'Вже видалено або застаріло')
    return
  }
  /*
   * Хтось відповів на цю саму заявку пізніше — lastReply вже про ІНШУ
   * відповідь. Без цієї звірки стара кнопка видалила б чужий, новіший лист,
   * а не той, під яким її натиснули.
   */
  if (lastReply.key !== key) {
    await answerCallback(cq.id, 'Ця кнопка застаріла — з’явилася новіша відповідь')
    return
  }

  const { deleteMessage } = await import('@/lib/telegram.ts')
  if (lastReply.clientChat) {
    await deleteMessage(lastReply.clientChat, lastReply.clientMsgId).catch(() => {})
  }
  for (const c of lastReply.staffCopies || []) {
    await deleteMessage(c.chat, c.msgId).catch(() => {})
  }

  await payload.update({ collection, id, overrideAccess: true, data: { lastReply: null } })
  await answerCallback(cq.id, '✓ Видалено у клієнта й колег')
}

async function historyBookingText(payload: Awaited<ReturnType<typeof getPayload>>): Promise<string> {
  const { docs } = await payload.find({
    collection: 'bookings', limit: HISTORY_LIMIT, depth: 1, overrideAccess: true, sort: '-createdAt',
  })
  if (!docs.length) return 'Броней ще немає.'
  const lines = docs.map((d) => {
    const status = BOOKING_STATUS_LABEL[String(d.status)] || String(d.status || '')
    const br = d.branch as { displayAddress?: string; address?: string } | null
    const addr = br?.displayAddress || br?.address || ''
    const sum = Number(d.amount || 0)
    return `№${d.id} · ${shortWhen(d.createdAt)} · ${sum.toLocaleString('uk-UA')} грн`
      + (addr ? ` · ${esc(addr)}` : '') + ` · ${status}`
  })
  return `<b>Останні брони:</b>\n\n${lines.join('\n')}`
}

/**
 * Порівняння без підказки за часом: інакше ключ можна підібрати,
 * вимірюючи, як швидко приходить відмова.
 */
function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function POST(req: Request) {
  if (!token()) return Response.json({ ok: true })

  /**
   * Адреса приймання відкрита всьому інтернету, тож без перевірки будь-хто
   * міг би надіслути підроблену подію: прив'язати свій чат до відділення
   * або змусити бота написати клієнтові. Telegram додає до кожного запиту
   * умовне слово, яке ми задали разом із адресою.
   */
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  const given = req.headers.get('x-telegram-bot-api-secret-token') || ''
  if (!expected || !sameSecret(given, expected)) {
    return Response.json({ ok: false }, { status: 401 })
  }

  let update: { message?: TgMessage; my_chat_member?: TgChatMember; callback_query?: TgCallbackQuery }
  try {
    update = await req.json()
  } catch {
    return Response.json({ ok: true })
  }

  const payload = await getPayload({ config })

  // ── бота додали в групу або прибрали з неї ──
  if (update.my_chat_member) {
    try {
      await handleGroupMembership(payload, update.my_chat_member)
    } catch (e) {
      console.error('group membership', e)
    }
    return Response.json({ ok: true })
  }

  // ── натиснута інлайн-кнопка («Історія», «Видалити») ──
  if (update.callback_query) {
    try {
      if ((update.callback_query.data || '').startsWith('del:')) {
        await handleDeleteCallback(payload, update.callback_query)
      } else {
        await handleHistoryCallback(payload, update.callback_query)
      }
    } catch (e) {
      console.error('callback_query', e)
    }
    return Response.json({ ok: true })
  }

  const msg = update.message
  if (!msg) return Response.json({ ok: true })
  const chatKey = chatKeyOf(msg)

  try {
    /*
     * Група стала супергрупою — Telegram видає їй новий номер, а старий
     * перестає існувати. Без цього картки просто перестали б приходити,
     * і виглядало б це як «бот зламався».
     */
    if (msg.migrate_to_chat_id) {
      const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true }) as Record<string, unknown>
      if (String(settings.reviewChat || '') === String(msg.chat.id)) {
        await payload.updateGlobal({
          slug: 'settings', overrideAccess: true,
          data: { reviewChat: String(msg.migrate_to_chat_id) },
        })
      }
      return Response.json({ ok: true })
    }

    // ── поділився номером ──
    if (msg.contact) {
      /*
       * Telegram дозволяє вручну вписати «контакт» із будь-яким чужим номером
       * і надіслати його боту — це не те саме, що поділитися СВОЇМ номером.
       * У другому випадку (кнопка «Поділитися номером» чи власний контакт із
       * телефонної книги) Telegram сам проставляє user_id, що збігається
       * з відправником. Без цієї звірки хтось, хто просто знає чужий робочий
       * чи особистий номер, міг би «перехопити» чуже відділення чи роль.
       */
      if (msg.contact.user_id && msg.contact.user_id === msg.from?.id) {
        await handleContact(payload, chatKey, msg.contact.phone_number, msg.from)
      } else {
        await send({
          chat: chatKey,
          text: 'Це виглядає як чужий контакт, а не ваш власний номер. '
            + 'Натисніть кнопку «📱 Поділитися номером» — вона підтвердить саме ваш номер.',
          replyMarkup: CONTACT_KEYBOARD,
        })
      }
      return Response.json({ ok: true })
    }

    // ── поділився геолокацією: підказуємо найближче відділення ──
    if (msg.location) {
      await nearestBranch(payload, msg.location, chatKey)
      return Response.json({ ok: true })
    }

    // ── адмін ввів пробу і ціну на золото («585 3200») ──
    if (msg.chat.type === 'private' && msg.text) {
      const priceInput = goldPriceInputFrom(msg.text)
      if (priceInput && (await isAdminChat(payload, chatKey))) {
        await proposeGoldPrice(payload, chatKey, priceInput.purity, priceInput.price)
        return Response.json({ ok: true })
      }
    }

    // ── «Почати», можливо з міткою заявки ──
    if (msg.text?.startsWith('/start')) {
      const arg = msg.text.split(' ')[1] || ''
      const m = /^eval_(\d+)_([A-Za-z0-9]{16,})$/.exec(arg)

      if (m) {
        const [, id, key] = m
        const doc = await payload.findByID({
          collection: 'eval-requests', id, depth: 0, overrideAccess: true,
        }).catch(() => null)

        // ключ із посилання має збігтися, і заявку ще не мають бути прив'язані
        const stored = String((doc as { clientKey?: string } | null)?.clientKey || '')
        const bound = String((doc as { clientChat?: string } | null)?.clientChat || '')
        const mine = bound === String(msg.chat.id)

        if (doc && stored && sameSecret(key, stored) && (!bound || mine)) {
          if (!bound) {
            await payload.update({
              collection: 'eval-requests', id, overrideAccess: true,
              data: { clientChat: String(msg.chat.id) },
            })
            // Старе відкрите звернення того самого чату більше не актуальне:
            // інакше воно й далі перехоплювало б повідомлення клієнта.
            await closeOpenHotline(payload, chatKey)

            /*
             * Картка вже пішла оцінювачу зі значком «клієнт не в боті» — його
             * не виправити заднім числом (Telegram не дає редагувати чужі
             * повідомлення). Тому шлемо коротке окреме уточнення.
             */
            const { recipientsFor } = await import('@/lib/telegram.ts')
            const chats = await recipientsFor(payload, String((doc as { category?: string }).category || ''))
            for (const target of chats.keys()) {
              await send({
                chat: target,
                text: `<b>Заявка №${id}</b> · клієнт приєднався до бота. Тепер можна відповідати тут напряму.`,
              }).catch(() => {})
            }
          }
          await send({
            chat: chatKey,
            text: `Ваша заявка №${id} прийнята. Відповідь оцінювача прийде сюди.`,
            replyMarkup: MENU_KEYBOARD,
          })
        } else {
          await send({ chat: chatKey, text: 'Посилання застаріло. Зателефонуйте нам, будь ласка.', replyMarkup: MENU_KEYBOARD })
        }
        return Response.json({ ok: true })
      }

      const known = await getKnownPhone(payload, chatKey)
      const menu = (await isAdminChat(payload, chatKey)) ? ADMIN_MENU_KEYBOARD : MENU_KEYBOARD
      if (known) {
        await send({ chat: chatKey, text: HELLO_KNOWN, replyMarkup: menu })
      } else {
        await send({ chat: chatKey, text: HELLO_NEW, replyMarkup: CONTACT_KEYBOARD })
      }
      return Response.json({ ok: true })
    }

    // ── шпаргалка з шаблонами відповідей ──
    if (msg.text?.trim() === '/шаблони' && (await isRecipientChat(payload, chatKey))) {
      await sendTemplatesList(payload, chatKey)
      return Response.json({ ok: true })
    }

    // ── кнопка меню (або стара слеш-команда) ──
    const intent = matchIntent(msg.text)
    if (intent) {
      await handleIntent(payload, chatKey, msg.from, intent)
      return Response.json({ ok: true })
    }

    // ── відповідь на картку (Reply) → клієнтові ──
    if (msg.reply_to_message && (msg.text || msg.caption || msg.photo)) {
      const goldProposal = goldPriceProposalFrom(msg.reply_to_message.text)
      if (goldProposal != null) {
        await confirmGoldPrice(payload, msg, chatKey, goldProposal)
      } else if (hotlineIdFrom(msg.reply_to_message.text) != null) {
        await relayHotlineAnswer(payload, msg, chatKey)
      } else {
        await relayAnswer(payload, msg, chatKey)
      }
      return Response.json({ ok: true })
    }

    // ── звичайне повідомлення без Reply: текст і/або фото ──
    if (msg.chat.type === 'private' && (msg.text || msg.caption || msg.photo)) {
      /*
       * Співробітник написав напряму, не через Reply на конкретне повідомлення
       * клієнта, — бот не вгадає, кому це адресовано. Раніше таке повідомлення
       * мовчки йшло в обробку «від клієнта» і губилось.
       */
      if (await isRecipientChat(payload, chatKey)) {
        await send({
          chat: chatKey,
          text: 'Повідомлення не надіслано клієнту. Щоб відповісти — натисніть на його повідомлення → Reply, і напишіть текст.',
        })
      } else {
        await dispatchClientMessage(payload, msg, chatKey)
      }
    }
  } catch (e) {
    payload.logger.error({ err: e }, 'telegram webhook')
  }

  return Response.json({ ok: true })
}

// ────────────────────────── пам'ять про номер клієнта ──────────────────────────

async function findTelegramClient(payload: Awaited<ReturnType<typeof getPayload>>, chat: string) {
  const { docs } = await payload.find({
    collection: 'telegram-clients', limit: 1, depth: 0, overrideAccess: true,
    where: { chatId: { equals: chat } },
  })
  return docs[0] as { id: string | number; phone?: string; pendingIntent?: string } | undefined
}

async function getKnownPhone(payload: Awaited<ReturnType<typeof getPayload>>, chat: string): Promise<string | null> {
  const doc = await findTelegramClient(payload, chat)
  return doc?.phone ? String(doc.phone) : null
}

async function saveKnownPhone(
  payload: Awaited<ReturnType<typeof getPayload>>,
  chat: string,
  phone: string,
  name: string,
) {
  const doc = await findTelegramClient(payload, chat)
  const data = { chatId: chat, phone, name, linkedAt: new Date().toISOString() }
  if (doc) {
    await payload.update({ collection: 'telegram-clients', id: doc.id, overrideAccess: true, data })
  } else {
    await payload.create({ collection: 'telegram-clients', overrideAccess: true, data })
  }
}

async function setPendingIntent(payload: Awaited<ReturnType<typeof getPayload>>, chat: string, intent: Intent) {
  const doc = await findTelegramClient(payload, chat)
  if (doc) {
    await payload.update({ collection: 'telegram-clients', id: doc.id, overrideAccess: true, data: { pendingIntent: intent } })
  } else {
    await payload.create({ collection: 'telegram-clients', overrideAccess: true, data: { chatId: chat, pendingIntent: intent } })
  }
}

/** Читає й одразу очищує намір: щоб той самий намір не «спрацював» повторно. */
async function takePendingIntent(payload: Awaited<ReturnType<typeof getPayload>>, chat: string): Promise<Intent | null> {
  const doc = await findTelegramClient(payload, chat)
  if (!doc?.pendingIntent) return null
  await payload.update({ collection: 'telegram-clients', id: doc.id, overrideAccess: true, data: { pendingIntent: null } })
  return doc.pendingIntent as Intent
}

// ────────────────────────── кнопки меню ──────────────────────────

const PHONE_PROMPT: Record<Intent, string> = {
  hotline: 'Добрий день! Це гаряча лінія ломбарду «Імперіал». Щоб оператор зміг вам відповісти, '
    + 'поділіться, будь ласка, номером телефону:',
  otsinka: 'Щоб оформити заявку на оцінку, спершу поділіться, будь ласка, номером телефону:',
  bron: 'Щоб показати ваші активні брони, поділіться, будь ласка, номером телефону:',
  review: 'Щоб ми могли зв’язатися з вами за потреби, поділіться, будь ласка, номером телефону:',
  viddilennya: '', // геолокація, телефон не потрібен
  umovy: '', // без телефону
  goldPrice: '', // лише для адміна, номер уже прив'язаний
  history: '', // лише для адміна, без телефону
  historyEval: '', // лише для адміна, без телефону
  historyHotline: '', // лише для адміна, без телефону
  historyReview: '', // лише для адміна, без телефону
  historyBooking: '', // лише для адміна, без телефону
  back: '', // лише для адміна, без телефону
}

async function handleIntent(
  payload: Awaited<ReturnType<typeof getPayload>>,
  chat: string,
  from: TgUser | undefined,
  intent: Intent,
) {
  if (intent === 'viddilennya') {
    await send({
      chat,
      text: 'Надішліть геолокацію — підкажу найближче відділення й маршрут до нього:',
      replyMarkup: LOCATION_KEYBOARD,
    })
    return
  }

  if (intent === 'umovy') {
    await send({
      chat,
      text: 'Ця функція ще готується. Актуальні умови — на сайті або запитайте на гарячій лінії ☎️',
      replyMarkup: MENU_KEYBOARD,
    })
    return
  }

  if (intent === 'goldPrice') {
    if (!(await isAdminChat(payload, chat))) return
    await send({
      chat,
      text: `Напишіть пробу і нову базову ціну через пробіл, наприклад: «${ANCHOR_PURITY} 3200». `
        + 'Решта проб золота перерахується автоматично, я покажу перелік на підтвердження перед тим, як застосувати.',
      replyMarkup: ADMIN_MENU_KEYBOARD,
    })
    return
  }

  if (intent === 'history') {
    if (!(await isAdminChat(payload, chat))) return
    await send({ chat, text: 'Що показати?', replyMarkup: HISTORY_KEYBOARD })
    return
  }

  if (intent === 'historyEval') {
    if (!(await isAdminChat(payload, chat))) return
    const { text, buttons } = await historyEvalText(payload)
    await send({ chat, text, replyMarkup: historyInlineKeyboard('hev', buttons) })
    return
  }

  if (intent === 'historyHotline') {
    if (!(await isAdminChat(payload, chat))) return
    const { text, buttons } = await historyHotlineText(payload)
    await send({ chat, text, replyMarkup: historyInlineKeyboard('hho', buttons) })
    return
  }

  if (intent === 'historyReview') {
    if (!(await isAdminChat(payload, chat))) return
    const { text, buttons } = await historyReviewText(payload)
    await send({ chat, text, replyMarkup: historyInlineKeyboard('hho', buttons) })
    return
  }

  if (intent === 'historyBooking') {
    if (!(await isAdminChat(payload, chat))) return
    await send({ chat, text: await historyBookingText(payload), replyMarkup: HISTORY_KEYBOARD })
    return
  }

  if (intent === 'back') {
    if (!(await isAdminChat(payload, chat))) return
    await send({ chat, text: 'Головне меню:', replyMarkup: ADMIN_MENU_KEYBOARD })
    return
  }

  const known = await getKnownPhone(payload, chat)
  if (!known) {
    await setPendingIntent(payload, chat, intent)
    await send({ chat, text: PHONE_PROMPT[intent], replyMarkup: CONTACT_KEYBOARD })
    return
  }

  await startIntent(payload, chat, from, intent, known)
}

async function startIntent(
  payload: Awaited<ReturnType<typeof getPayload>>,
  chat: string,
  from: TgUser | undefined,
  intent: Intent,
  phone: string,
) {
  if (intent === 'bron') {
    await showBookings(payload, chat, phone)
    return
  }
  if (intent === 'hotline') {
    await payload.create({
      collection: 'hotline-chats', overrideAccess: true,
      data: { clientChat: chat, name: displayName(from), phone, status: 'new', kind: 'hotline' },
    })
    await send({ chat, text: 'Добрий день! Це гаряча лінія ломбарду «Імперіал». Чим можемо допомогти?', replyMarkup: MENU_KEYBOARD })
    return
  }
  if (intent === 'review') {
    await payload.create({
      collection: 'hotline-chats', overrideAccess: true,
      data: { clientChat: chat, name: displayName(from), phone, status: 'new', kind: 'review' },
    })
    await send({ chat, text: REVIEW_GREETING, replyMarkup: MENU_KEYBOARD })
    return
  }
  if (intent === 'otsinka') {
    // Клієнт явно переходить в інший сценарій — старе звернення більше не має «перехоплювати» його повідомлення
    await closeOpenHotline(payload, chat)
    await payload.create({
      collection: 'eval-requests', overrideAccess: true,
      data: {
        category: 'other', source: 'bot', clientChat: chat,
        name: displayName(from), phone, status: 'new', comment: '', photos: [],
      },
    })
    await send({ chat, text: OTSINKA_GUIDE, replyMarkup: MENU_KEYBOARD })
  }
}

async function showBookings(payload: Awaited<ReturnType<typeof getPayload>>, chat: string, phone: string) {
  const digits = normalizePhone(phone)
  const { docs: bookings } = await payload.find({
    collection: 'bookings', limit: 200, depth: 1, overrideAccess: true, sort: '-createdAt',
  })
  const now = Date.now()
  const mine = bookings.filter((b) => {
    const bb = b as { phone?: string; expiresAt?: string }
    return normalizePhone(bb.phone) === digits && new Date(String(bb.expiresAt || 0)).getTime() > now
  })

  if (!mine.length) {
    await send({ chat, text: 'Активних бронь на цей номер не знайшли.', replyMarkup: MENU_KEYBOARD })
    return
  }

  const lines = mine.slice(0, 5).map((b) => {
    const bb = b as { amount?: number; expiresAt?: string; branch?: unknown }
    const br = bb.branch as { displayAddress?: string; address?: string } | null
    const addr = br?.displayAddress || br?.address || ''
    const till = bb.expiresAt
      ? new Date(bb.expiresAt).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      : ''
    return `• <b>${Number(bb.amount || 0).toLocaleString('uk-UA')} грн</b>${addr ? ` · ${esc(addr)}` : ''}`
      + `${till ? `\n  діє до ${till}` : ''}`
  })
  await send({ chat, text: `<b>Ваші активні брони:</b>\n\n${lines.join('\n\n')}`, replyMarkup: MENU_KEYBOARD })
}

/** Найближче активне відділення за геолокацією клієнта, з маршрутом. */
async function nearestBranch(
  payload: Awaited<ReturnType<typeof getPayload>>,
  loc: { latitude: number; longitude: number },
  chat: string,
) {
  const { docs } = await payload.find({
    collection: 'branches', limit: 300, depth: 0, overrideAccess: true,
    where: { active: { equals: true } },
  })
  type B = { id: string; address: string; displayAddress?: string; phone?: string; paused?: boolean
    pauseReason?: string; coords?: { lat?: number; lng?: number }
    schedule?: { roundClock?: boolean; openTime?: string; closeTime?: string } }
  const withCoords = (docs as B[]).filter(
    (b) => typeof b.coords?.lat === 'number' && typeof b.coords?.lng === 'number',
  )

  if (!withCoords.length) {
    await send({ chat, text: 'Не вдалось підібрати відділення. Зателефонуйте нам, будь ласка.', replyMarkup: MENU_KEYBOARD })
    return
  }

  let best = withCoords[0]
  let min = Infinity
  for (const b of withCoords) {
    const d = distanceKm({ lat: loc.latitude, lng: loc.longitude }, { lat: b.coords!.lat as number, lng: b.coords!.lng as number })
    if (d < min) { min = d; best = b }
  }

  const hours = best.schedule?.roundClock
    ? 'цілодобово'
    : `${best.schedule?.openTime || '09:00'}–${best.schedule?.closeTime || '20:00'}`
  const pausedNote = best.paused
    ? `\n⚠️ Тимчасово не працює${best.pauseReason ? `: ${esc(best.pauseReason)}` : ''}`
    : ''
  const route = `https://www.google.com/maps/dir/?api=1&destination=${best.coords!.lat},${best.coords!.lng}`

  await send({
    chat,
    text: `Найближче відділення (${min < 1 ? Math.round(min * 1000) + ' м' : min.toFixed(1) + ' км'}):\n`
      + `<b>${esc(best.displayAddress || best.address)}</b>\n`
      + `Графік: ${esc(hours)}${best.phone ? `\nТелефон: ${esc(best.phone)}` : ''}${pausedNote}\n\n`
      + `<a href="${esc(route)}">Маршрут →</a>`,
    replyMarkup: MENU_KEYBOARD,
  })
}

/** Рядок «яка роль» — щоб співробітник одразу бачив, у якій якості прив'язався. */
function recipientRoleLine(person: { kind?: string; categories?: string[] }): string {
  if (person.kind === 'admin') return 'Роль: <b>адміністратор</b> — бачите копії всіх заявок і звернень.'
  if (person.kind === 'hotline') return 'Роль: <b>оператор гарячої лінії</b>.'
  const cats = person.categories || []
  const catsLabel = cats.length ? cats.map((c) => EVAL_CATEGORY_LABEL[c] || c).join(', ') : 'усі напрямки'
  return `Роль: <b>оцінювач</b> (${esc(catsLabel)}).`
}

/** Поділився номером: спершу перевіряємо, чи це співробітник, потім — намір клієнта. */
async function handleContact(
  payload: Awaited<ReturnType<typeof getPayload>>,
  chat: string,
  phone: string,
  from?: TgUser,
) {
  const digits = normalizePhone(phone)
  const who = displayName(from, '')

  await saveKnownPhone(payload, chat, phone, who)

  const branches = await payload.find({
    collection: 'branches', limit: 300, depth: 0, overrideAccess: true,
    where: { active: { equals: true } },
  })
  const branch = branches.docs.find(
    (b) => normalizePhone((b as { workPhone?: string }).workPhone) === digits,
  )

  if (branch) {
    await payload.update({
      collection: 'branches', id: branch.id, overrideAccess: true,
      data: { telegramChat: chat },
    })
    await send({
      chat,
      text: `Готово. Броні відділення <b>${esc(branch.address)}</b> надходитимуть сюди.`,
    })
    return
  }

  const recipients = await payload.find({
    collection: 'recipients', limit: 200, depth: 0, overrideAccess: true,
    where: { active: { equals: true } },
  })
  const person = recipients.docs.find(
    (r) => normalizePhone((r as { phone?: string }).phone) === digits,
  )

  if (person) {
    await payload.update({
      collection: 'recipients', id: person.id, overrideAccess: true,
      data: { chatId: chat, linked: new Date().toISOString(), tgName: who },
    })
    await send({
      chat,
      text: `Готово, <b>${esc((person as { title?: string }).title)}</b>. Заявки надходитимуть сюди.\n`
        + recipientRoleLine(person as { kind?: string; categories?: string[] }),
    })
    return
  }

  const intent = await takePendingIntent(payload, chat)
  if (intent) {
    await startIntent(payload, chat, from, intent, phone)
    return
  }

  await send({ chat, text: 'Дякуємо! Ось що я вмію:', replyMarkup: MENU_KEYBOARD })
}

/**
 * Бота додали в групу — запамʼятовуємо її як спільну групу оцінок.
 *
 * Привʼязати може лише той, хто вже підтвердив себе робочим номером: інакше
 * будь-хто додав би бота у свою групу й отримував копії заявок.
 */
async function handleGroupMembership(
  payload: Awaited<ReturnType<typeof getPayload>>,
  ev: TgChatMember,
) {
  const status = ev.new_chat_member?.status || ''
  const chat = String(ev.chat.id)
  const isGroup = ev.chat.type === 'group' || ev.chat.type === 'supergroup'
  if (!isGroup) return

  const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true }) as Record<string, unknown>

  // Прибрали з групи — забуваємо її
  if (status === 'left' || status === 'kicked') {
    if (String(settings.reviewChat || '') === chat) {
      await payload.updateGlobal({
        slug: 'settings', overrideAccess: true,
        data: { reviewChat: '', reviewChatTitle: '' },
      })
    }
    return
  }

  if (status !== 'member' && status !== 'administrator') return

  const addedBy = String(ev.from?.id || '')
  const { docs } = await payload.find({
    collection: 'recipients', limit: 1, depth: 0, overrideAccess: true,
    where: { chatId: { equals: addedBy } },
  })
  if (!docs.length) {
    await send({
      chat,
      text: 'Щоб ця група отримувала оцінки, додати бота має співробітник, '
        + 'який уже підтвердив свій робочий номер у боті.',
    })
    return
  }

  await payload.updateGlobal({
    slug: 'settings', overrideAccess: true,
    data: { reviewChat: chat, reviewChatTitle: ev.chat.title || '' },
  })
  await send({
    chat,
    text: '<b>Групу підключено.</b>\nСюди приходитиме кожна оцінена заявка з сайту: '
      + 'річ, фото, сума й час оцінки. Телефон і імʼя клієнта не показуються. '
      + 'Відповіді в цій групі клієнту не йдуть.',
  })
}

/** Відповідь співробітника на картку заявки на оцінку пересилаємо клієнтові. */
async function relayAnswer(
  payload: Awaited<ReturnType<typeof getPayload>>,
  msg: TgMessage,
  chat: string,
) {
  const id = requestIdFrom(msg.reply_to_message?.text)
  if (!id) return

  const doc = await payload.findByID({
    collection: 'eval-requests', id, depth: 0, overrideAccess: true,
  }).catch(() => null)
  if (!doc) return

  const who = displayName(msg.from, 'оцінювач')
  const rawText = textOf(msg)
  const resolved = await resolveTemplate(payload, rawText)
  if ('warn' in resolved) {
    await send({ chat, text: resolved.warn })
    return
  }
  const text = resolved.text
  const clientChat = String((doc as { clientChat?: string }).clientChat || '')
  const answeredBy = String((doc as { answeredBy?: string }).answeredBy || '')

  if (answeredBy && answeredBy !== who) {
    await send({ chat, text: `На цю заявку вже відповів ${esc(answeredBy)}. Ваше повідомлення теж надіслано.` })
  }

  let clientMsgId: number | undefined
  const replyKey = randomBytes(4).toString('hex')
  if (clientChat) {
    if (text) {
      const r = await send({ chat: clientChat, text: `<b>Ломбард «Імперіал»</b>\n${esc(text)}`, replyMarkup: MENU_KEYBOARD })
      clientMsgId = r.message_id
    }
    const delKeyboard = clientMsgId
      ? { inline_keyboard: [[{ text: '🗑 Видалити', callback_data: `del:eval:${id}:${replyKey}` }]] }
      : undefined
    await send({ chat, text: '✓ Надіслано клієнту', replyMarkup: delKeyboard })
  } else {
    const phone = String((doc as { phone?: string }).phone || '')
    if (text) {
      try {
        const { sendSms } = await import('@/lib/sms.ts')
        await sendSms(phone, text)
        await send({ chat, text: `✓ Клієнт не в боті — надіслано SMS на ${esc(phone)}` })
      } catch (e) {
        payload.logger.error({ err: e, phone }, 'sms fallback failed')
        // Причина — короткий код від TurboSMS (наприклад REQUIRED_BALANCE), не секрет:
        // показуємо прямо тут, щоб не лізти за нею окремо в логи чи базу.
        const reason = (e as Error).message || 'невідома помилка'
        await send({
          chat,
          text: `Клієнт не підключений до бота, і SMS не надіслалось (${esc(reason)}). Зателефонуйте: ${esc(phone)}`,
        })
      }
    } else {
      await send({ chat, text: `Клієнт не підключений до бота. Телефон: ${esc(phone)}` })
    }
  }

  /*
   * Копія відповіді решті отримувачів заявки: адміну й оцінювачу напрямку.
   * Без цього кожен відповідає наосліп і не бачить, що заявку вже взяли —
   * звідси дублі й суперечливі відповіді клієнту.
   */
  const { recipientsFor } = await import('@/lib/telegram.ts')
  const others = await recipientsFor(payload, String((doc as { category?: string }).category || ''))
  const staffCopies: { chat: string; msgId: number }[] = []
  for (const target of others.keys()) {
    if (target === chat) continue
    try {
      const r = await send({
        chat: target,
        text: `<b>Заявка №${id}</b> · ${esc(who)} відповів:\n${esc(text)}`,
      })
      staffCopies.push({ chat: target, msgId: r.message_id })
    } catch { /* копія не критична — головне, щоб дійшло клієнту */ }
  }

  const lastReply = clientMsgId ? { clientChat, clientMsgId, staffCopies, key: replyKey } : null
  const thread = ((doc as { thread?: unknown[] }).thread || []) as unknown[]

  /*
   * Сума з відповіді — щоб не вписувати її ще раз руками в адмінці. Числа
   * самої заявки не рахуємо: модель годинника теж складається з цифр.
   * Коли сума вже була, виправлення ловимо лише з явною валютою («12000
   * грн») — інакше випадкове число в подальшій переписці тихо переписало б
   * правильну оцінку.
   */
  const already = Number((doc as { estimate?: number }).estimate || 0)
  const own = [doc.brand, doc.model, doc.year].filter(Boolean).join(' ')
  const sum = sumFromText(text, own, { requireCurrency: already > 0 })
  const changed = sum != null && sum !== already

  await payload.update({
    collection: 'eval-requests', id, overrideAccess: true,
    data: {
      status: 'work',
      answeredBy: who,
      answeredAt: new Date().toISOString(),
      lastReply,
      ...(changed ? { estimate: sum } : {}),
      thread: [...thread, { from: who, text, at: new Date().toISOString() }],
    },
  })

  if (changed) {
    const label = already > 0 ? 'Виправив оцінку' : 'Записав оцінку'
    await send({ chat, text: `${label}: <b>${sum.toLocaleString('uk-UA')} грн</b>` })
  }
}

/** Відповідь оператора на картку гарячої лінії пересилаємо клієнтові. */
async function relayHotlineAnswer(
  payload: Awaited<ReturnType<typeof getPayload>>,
  msg: TgMessage,
  chat: string,
) {
  const id = hotlineIdFrom(msg.reply_to_message?.text)
  if (!id) return

  const doc = await payload.findByID({
    collection: 'hotline-chats', id, depth: 0, overrideAccess: true,
  }).catch(() => null)
  if (!doc) return

  const who = displayName(msg.from, 'оператор')
  const rawText = textOf(msg)
  const resolved = await resolveTemplate(payload, rawText)
  if ('warn' in resolved) {
    await send({ chat, text: resolved.warn })
    return
  }
  const text = resolved.text
  const photo = pickPhoto(msg)
  const clientChat = String((doc as { clientChat?: string }).clientChat || '')
  const answeredBy = String((doc as { answeredBy?: string }).answeredBy || '')
  const kind = String((doc as { kind?: string }).kind || 'hotline')
  const label = hotlineLabel(kind)

  if (answeredBy && answeredBy !== who) {
    await send({ chat, text: `На це звернення вже відповів ${esc(answeredBy)}. Ваше повідомлення теж надіслано.` })
  }

  let clientMsgId: number | undefined
  const replyKey = randomBytes(4).toString('hex')
  if (clientChat) {
    const { sendPhoto } = await import('@/lib/telegram.ts')
    if (text) {
      const r = await send({ chat: clientChat, text: `<b>Ломбард «Імперіал»</b>\n${esc(text)}`, replyMarkup: MENU_KEYBOARD })
      clientMsgId = r.message_id
    }
    if (photo) await sendPhoto(clientChat, photo).catch(() => {})
    const delKeyboard = clientMsgId
      ? { inline_keyboard: [[{ text: '🗑 Видалити', callback_data: `del:hotline:${id}:${replyKey}` }]] }
      : undefined
    await send({ chat, text: '✓ Надіслано клієнту', replyMarkup: delKeyboard })
  } else {
    await send({
      chat,
      text: `Клієнт не підключений до бота. Телефон: ${esc((doc as { phone?: string }).phone)}`,
    })
  }

  const others = await hotlineRecipientsFor(payload)
  const staffCopies: { chat: string; msgId: number }[] = []
  for (const target of others.keys()) {
    if (target === chat) continue
    try {
      const r = await send({
        chat: target,
        text: `<b>${esc(label)} №${id}</b> · ${esc(who)} відповів:\n${esc(text || '[фото]')}`,
      })
      staffCopies.push({ chat: target, msgId: r.message_id })
    } catch { /* копія не критична — головне, щоб дійшло клієнту */ }
  }

  const lastReply = clientMsgId ? { clientChat, clientMsgId, staffCopies, key: replyKey } : null
  const thread = ((doc as { thread?: unknown[] }).thread || []) as unknown[]
  await payload.update({
    collection: 'hotline-chats', id, overrideAccess: true,
    data: {
      status: 'work',
      answeredBy: who,
      answeredAt: new Date().toISOString(),
      lastReply,
      thread: [...thread, { from: who, text: text || '[фото]', at: new Date().toISOString() }],
    },
  })
}

/**
 * Звичайне повідомлення клієнта (без Reply): розбираємось, куди воно —
 * у відкрите звернення на гарячу лінію, у чернетку оцінки з бота, у вже
 * привʼязану заявку із сайту, чи це взагалі щось нове без вибраного пункту.
 */
async function dispatchClientMessage(
  payload: Awaited<ReturnType<typeof getPayload>>,
  msg: TgMessage,
  chat: string,
) {
  /*
   * Той самий клієнт міг за час тестів лишити відкритими одразу кілька
   * «гілок» — чернетку оцінки з бота, звернення на гарячу лінію, заявку
   * з сайту. Раніше кожен варіант перевірявся окремо й безумовно (перший-
   * знайдений вигравав), тому давно покинута чернетка назавжди «забирала
   * собі» повідомлення клієнта, навіть коли реальна розмова точилась зовсім
   * в іншій заявці. Тепер порівнюємо всі відкриті варіанти за часом
   * останньої активності — хто оновлювався останнім (відповідь оцінювача,
   * будь-яка зміна), той і виграє.
   */
  const [hotlineRes, draftRes, linkedRes] = await Promise.all([
    payload.find({
      collection: 'hotline-chats', limit: 1, depth: 0, overrideAccess: true,
      sort: '-updatedAt', where: { clientChat: { equals: chat }, status: { not_equals: 'done' } },
    }),
    payload.find({
      collection: 'eval-requests', limit: 1, depth: 0, overrideAccess: true,
      sort: '-updatedAt', where: { clientChat: { equals: chat }, source: { equals: 'bot' }, status: { equals: 'new' } },
    }),
    payload.find({
      collection: 'eval-requests', limit: 1, depth: 0, overrideAccess: true,
      sort: '-updatedAt', where: { clientChat: { equals: chat } },
    }),
  ])

  type Candidate = { updatedAt?: string } & Record<string, unknown>
  const at = (d?: Candidate) => (d?.updatedAt ? new Date(d.updatedAt).getTime() : -1)
  const candidates: { doc: Candidate; run: () => Promise<void> }[] = []
  if (hotlineRes.docs[0]) {
    candidates.push({ doc: hotlineRes.docs[0], run: () => appendHotline(payload, hotlineRes.docs[0] as HotlineDoc, msg) })
  }
  if (draftRes.docs[0]) {
    candidates.push({ doc: draftRes.docs[0], run: () => appendOtsinka(payload, draftRes.docs[0] as EvalDraft, msg) })
  }
  if (linkedRes.docs[0]) {
    candidates.push({ doc: linkedRes.docs[0], run: () => noteClientMessage(payload, msg, linkedRes.docs[0] as EvalDraft) })
  }

  if (candidates.length) {
    candidates.sort((a, b) => at(b.doc) - at(a.doc))
    await candidates[0].run()
    return
  }

  await send({
    chat,
    text: 'Будь ласка, оберіть один із пунктів нижче — так я зможу допомогти швидше 👇',
    replyMarkup: MENU_KEYBOARD,
  })
}

type HotlineDoc = { id: string | number; clientChat?: string; name?: string; phone?: string
  status?: string; kind?: string; thread?: { from: string; text: string; at: string }[] }

const FIRST_ACK: Record<string, string> = {
  hotline: 'Дякуємо за звернення! Передаю оператору — він ознайомиться і незабаром напише вам особисто.',
  review: 'Дякуємо! Ваше повідомлення передано і обов’язково буде розглянуте.',
}

/** Додає повідомлення клієнта у відкрите звернення (гаряча лінія або відгук). */
async function appendHotline(
  payload: Awaited<ReturnType<typeof getPayload>>,
  doc: HotlineDoc,
  msg: TgMessage,
) {
  const text = textOf(msg)
  const photo = pickPhoto(msg)
  const entryText = photo ? (text ? `${text} [фото]` : '[фото]') : text
  const isFirst = !(doc.thread || []).length
  const kind = doc.kind || 'hotline'
  const label = hotlineLabel(kind)

  const thread = [...(doc.thread || []), { from: 'клієнт', text: entryText, at: new Date().toISOString() }]
  await payload.update({ collection: 'hotline-chats', id: doc.id, overrideAccess: true, data: { thread } })

  const { hotlineCard, sendPhoto } = await import('@/lib/telegram.ts')
  const chats = await hotlineRecipientsFor(payload)

  for (const target of chats.keys()) {
    const text2 = isFirst
      ? hotlineCard({ id: doc.id, name: doc.name, phone: doc.phone }, text, label)
      : `<b>${esc(label)} №${doc.id}</b> · клієнт додав:\n${esc(entryText)}`
    await send({ chat: target, text: text2 }).catch(() => {})
    if (photo) await sendPhoto(target, photo).catch(() => {})
  }
  if (isFirst) {
    await notifyRecipients(payload, chats, { title: `Нове звернення: ${label}`, body: entryText || doc.name || '' })
  }

  if ((doc.status || 'new') === 'new') {
    await send({
      chat: String(doc.clientChat),
      text: FIRST_ACK[kind] || FIRST_ACK.hotline,
      replyMarkup: MENU_KEYBOARD,
    })
  }
}

type EvalDraft = { id: string | number; clientChat?: string; category?: string; brand?: string
  model?: string; year?: string; comment?: string; photos?: (string | number)[]; name?: string
  phone?: string; status?: string; thread?: { from: string; text: string; at: string }[] }

/** Додає текст і/або фото до чернетки заявки на оцінку, створеної з бота. */
async function appendOtsinka(
  payload: Awaited<ReturnType<typeof getPayload>>,
  doc: EvalDraft,
  msg: TgMessage,
) {
  const text = textOf(msg)
  const photoId = pickPhoto(msg)
  const isFirst = !doc.comment && !(doc.photos || []).length

  let mediaId: string | number | null = null
  if (photoId) {
    const { downloadTelegramFile } = await import('@/lib/telegram.ts')
    const file = await downloadTelegramFile(photoId)
    if (file) {
      const created = await payload.create({
        collection: 'media', overrideAccess: true,
        data: { alt: `Заявка з бота: фото ${(doc.photos || []).length + 1}` },
        file: { data: file.data, name: file.name, mimetype: 'image/jpeg', size: file.data.length },
      }).catch(() => null)
      if (created) mediaId = created.id
    }
  }

  const comment = [doc.comment, text].filter(Boolean).join('\n')
  const photos = [...(doc.photos || []), ...(mediaId != null ? [mediaId] : [])]

  await payload.update({
    collection: 'eval-requests', id: doc.id, overrideAccess: true,
    data: { comment, photos },
  })

  const { recipientsFor, evalCard, mediaUrl, sendPhotos } = await import('@/lib/telegram.ts')
  const chats = await recipientsFor(payload, 'other')

  for (const target of chats.keys()) {
    const cardText = isFirst
      ? evalCard({ ...doc, comment, photos }, { clientInBot: true })
      : `<b>Заявка №${doc.id}</b> · клієнт додав:\n${esc(text || '[фото]')}`
    await send({ chat: target, text: cardText }).catch(() => {})
  }
  if (isFirst) {
    await notifyRecipients(payload, chats, { title: 'Нова заявка на оцінку', body: comment || 'Заявка з бота' })
  }

  if (mediaId != null) {
    const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true }).catch(() => null)
    const filename = (media as { filename?: string } | null)?.filename
    if (filename) {
      const url = mediaUrl(filename)
      for (const target of chats.keys()) {
        await sendPhotos(target, [url]).catch(() => {})
      }
    }
  }
}

/** Повідомлення клієнта у вже привʼязаній заявці — звичайне продовження переписки. */
async function noteClientMessage(
  payload: Awaited<ReturnType<typeof getPayload>>,
  msg: TgMessage,
  doc: EvalDraft,
) {
  const text = textOf(msg)
  const photo = pickPhoto(msg)
  const entryText = photo ? (text ? `${text} [фото]` : '[фото]') : text
  const thread = [...(doc.thread || []), { from: 'клієнт', text: entryText, at: new Date().toISOString() }]

  await payload.update({
    collection: 'eval-requests', id: doc.id, overrideAccess: true,
    data: { thread },
  })

  const { recipientsFor, sendPhoto } = await import('@/lib/telegram.ts')
  const chats = await recipientsFor(payload, String(doc.category || ''))
  for (const target of chats.keys()) {
    await send({
      chat: target,
      text: `<b>Заявка №${doc.id}</b> · клієнт відповів:\n${esc(entryText)}`,
    }).catch(() => {})
    if (photo) await sendPhoto(target, photo).catch(() => {})
  }
}
