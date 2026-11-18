import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Дві мережі на одному робочому столі: «Імперіал» і «ТОП».
 *
 * У кожної свій бот для клієнтів (@imperialzajavka_bot і @topzajavka_bot),
 * але співробітники одні й ті самі, і картки їм завжди йдуть через бот
 * Імперіалу — другого бота їм підключати не треба. Клієнту ж відповідь має
 * прийти тим ботом, якому він писав, з підписом своєї мережі.
 *
 * Мережа заявки — поле `network` (за замовчуванням «imperial»: усі старі
 * записи — Імперіал). Мережа поточної події від Telegram — botContext.
 */

export type Network = 'imperial' | 'top'

export const NETWORK_OPTIONS = [
  { label: 'Імперіал', value: 'imperial' },
  { label: 'ТОП', value: 'top' },
]

export const asNetwork = (v: unknown): Network => (v === 'top' ? 'top' : 'imperial')

/** Поле «Мережа» для заявок, звернень, броней і клієнтів бота. */
export const networkField = {
  name: 'network',
  type: 'select' as const,
  label: 'Мережа',
  defaultValue: 'imperial',
  index: true,
  options: NETWORK_OPTIONS,
  admin: { position: 'sidebar' as const },
}

type NetInfo = {
  label: string
  /** Підпис відповіді клієнту */
  brand: string
  tokenEnv: string
  secretEnv: string
  defaultBot: string
}

export const NETWORK: Record<Network, NetInfo> = {
  imperial: {
    label: 'Імперіал',
    brand: 'Ломбард «Імперіал»',
    tokenEnv: 'TELEGRAM_BOT_TOKEN',
    secretEnv: 'TELEGRAM_WEBHOOK_SECRET',
    defaultBot: 'imperialzajavka_bot',
  },
  top: {
    label: 'ТОП',
    brand: 'Ломбард «ТОП»',
    tokenEnv: 'TOP_TELEGRAM_BOT_TOKEN',
    secretEnv: 'TOP_TELEGRAM_WEBHOOK_SECRET',
    defaultBot: 'topzajavka_bot',
  },
}

export const botTokenFor = (n: Network) => process.env[NETWORK[n].tokenEnv] || ''
export const webhookSecretFor = (n: Network) => process.env[NETWORK[n].secretEnv] || ''

/** Ім'я бота ТОП для посилань t.me/… (Імперіал бере своє з налаштувань сайту). */
export const topBotUsername = () => process.env.TOP_BOT_USERNAME || NETWORK.top.defaultBot

/** Ім'я відправника SMS. «TOP Lombard» зареєстроване в тому самому акаунті TurboSMS. */
export function smsSenderFor(n: Network): string {
  return n === 'top'
    ? process.env.TOP_TURBOSMS_SENDER || 'TOP Lombard'
    : process.env.TURBOSMS_SENDER || 'Imperial24'
}

/** Сайт ТОП для клієнтів (посилання в текстах) і для даних (відділення, тарифи). */
export const topPublicUrl = () => (process.env.TOP_PUBLIC_URL || 'https://top-lombard.com').replace(/\/$/, '')
export const topDataUrl = () => (process.env.TOP_SITE_URL || process.env.TOP_PUBLIC_URL || '').replace(/\/$/, '')

/** Позначка мережі в картці співробітнику: картки ТОП видно одразу, Імперіал — як було. */
export const cardTag = (n: Network) => (n === 'top' ? '🟦 ТОП · ' : '')

/** Умова пошуку за мережею для payload.find. */
export const netWhere = (n: Network) => ({ network: { equals: n } })

/**
 * Мережа бота, від якого прийшла поточна подія Telegram. Усі «клієнтські»
 * функції бота (меню, тексти, пошук заявок за чатом) беруть мережу звідси —
 * без протягування параметра через пів файлу.
 */
export const botContext = new AsyncLocalStorage<Network>()
export const currentNet = (): Network => botContext.getStore() ?? 'imperial'

/**
 * Секрет, яким сайт ТОП підписує заявки й броні, що пересилає сюди.
 * Без нього будь-хто міг би видати заявку за «ТОП».
 */
export const networkKey = () => process.env.NETWORK_INTAKE_KEY || ''

/**
 * Мережа заявки з сайту. Сайт ТОП пересилає свої форми сюди із заголовками
 * x-network: top і x-network-key. Без правильного ключа — помилка, а не
 * тиха «заявка Імперіалу»: так підробку видно відразу.
 */
export function requestNetwork(req: Request): Network | 'forbidden' {
  if (req.headers.get('x-network') !== 'top') return 'imperial'
  const key = networkKey()
  const given = req.headers.get('x-network-key') || ''
  if (!key || given.length !== key.length) return 'forbidden'
  let diff = 0
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0 ? 'top' : 'forbidden'
}
