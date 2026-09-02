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

export async function sendPhotos(chat: string, urls: string[]) {
  const t = token()
  if (!t || !urls.length) return
  const [chatId, threadId] = String(chat).split(':')

  // до десяти світлин одним альбомом — інакше чат засипає окремими фото
  const media = urls.slice(0, 10).map((url) => ({ type: 'photo', media: url }))
  await fetch(`${API}${t}/sendMediaGroup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      media,
      ...(threadId ? { message_thread_id: Number(threadId) } : {}),
    }),
  }).catch(() => {})
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
    const wanted = kind === 'admin' || !cats.length || cats.includes(category)
    if (wanted) chats.set(chat, String((r as { title?: string }).title || ''))
  }
  return chats
}
