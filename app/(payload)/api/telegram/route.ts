import { getPayload } from 'payload'
import config from '@payload-config'
import { timingSafeEqual } from 'node:crypto'
import { esc, normalizePhone, send, sumFromText, token } from '@/lib/telegram.ts'
import { distanceKm } from '@/lib/geo.ts'

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

function hotlineLabel(kind?: string) {
  return kind === 'review' ? 'Відгук' : 'Гаряча лінія'
}

async function hotlineRecipientsFor(payload: Awaited<ReturnType<typeof getPayload>>, kind?: string) {
  const { hotlineRecipients, reviewRecipients } = await import('@/lib/telegram.ts')
  return kind === 'review' ? reviewRecipients(payload) : hotlineRecipients(payload)
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

  let update: { message?: TgMessage; my_chat_member?: TgChatMember }
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

  const msg = update.message
  if (!msg) return Response.json({ ok: true })
  const chatKey = msg.message_thread_id ? `${msg.chat.id}:${msg.message_thread_id}` : String(msg.chat.id)

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
      await handleContact(payload, chatKey, msg.contact.phone_number, msg.from)
      return Response.json({ ok: true })
    }

    // ── поділився геолокацією: підказуємо найближче відділення ──
    if (msg.location) {
      await nearestBranch(payload, msg.location, chatKey)
      return Response.json({ ok: true })
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
      if (known) {
        await send({ chat: chatKey, text: HELLO_KNOWN, replyMarkup: MENU_KEYBOARD })
      } else {
        await send({ chat: chatKey, text: HELLO_NEW, replyMarkup: CONTACT_KEYBOARD })
      }
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
      if (hotlineIdFrom(msg.reply_to_message.text) != null) {
        await relayHotlineAnswer(payload, msg, chatKey)
      } else {
        await relayAnswer(payload, msg, chatKey)
      }
      return Response.json({ ok: true })
    }

    // ── звичайне повідомлення від клієнта: текст і/або фото, без Reply ──
    if (msg.chat.type === 'private' && (msg.text || msg.caption || msg.photo)) {
      await dispatchClientMessage(payload, msg, chatKey)
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
      text: `Готово, <b>${esc((person as { title?: string }).title)}</b>. Заявки надходитимуть сюди.`,
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
  const text = textOf(msg)
  const clientChat = String((doc as { clientChat?: string }).clientChat || '')
  const answeredBy = String((doc as { answeredBy?: string }).answeredBy || '')

  if (answeredBy && answeredBy !== who) {
    await send({ chat, text: `На цю заявку вже відповів ${esc(answeredBy)}. Ваше повідомлення теж надіслано.` })
  }

  if (clientChat) {
    if (text) await send({ chat: clientChat, text: `<b>Ломбард «Імперіал»</b>\n${esc(text)}`, replyMarkup: MENU_KEYBOARD })
    await send({ chat, text: '✓ Надіслано клієнту' })
  } else {
    await send({
      chat,
      text: `Клієнт не підключений до бота. Телефон: ${esc((doc as { phone?: string }).phone)}`,
    })
  }

  /*
   * Копія відповіді решті отримувачів заявки: адміну й оцінювачу напрямку.
   * Без цього кожен відповідає наосліп і не бачить, що заявку вже взяли —
   * звідси дублі й суперечливі відповіді клієнту.
   */
  const { recipientsFor } = await import('@/lib/telegram.ts')
  const others = await recipientsFor(payload, String((doc as { category?: string }).category || ''))
  for (const target of others.keys()) {
    if (target === chat) continue
    await send({
      chat: target,
      text: `<b>Заявка №${id}</b> · ${esc(who)} відповів:\n${esc(text)}`,
    }).catch(() => {})
  }

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
  const text = textOf(msg)
  const photo = pickPhoto(msg)
  const clientChat = String((doc as { clientChat?: string }).clientChat || '')
  const answeredBy = String((doc as { answeredBy?: string }).answeredBy || '')
  const kind = String((doc as { kind?: string }).kind || 'hotline')
  const label = hotlineLabel(kind)

  if (answeredBy && answeredBy !== who) {
    await send({ chat, text: `На це звернення вже відповів ${esc(answeredBy)}. Ваше повідомлення теж надіслано.` })
  }

  if (clientChat) {
    const { sendPhoto } = await import('@/lib/telegram.ts')
    if (text) await send({ chat: clientChat, text: `<b>Ломбард «Імперіал»</b>\n${esc(text)}`, replyMarkup: MENU_KEYBOARD })
    if (photo) await sendPhoto(clientChat, photo).catch(() => {})
    await send({ chat, text: '✓ Надіслано клієнту' })
  } else {
    await send({
      chat,
      text: `Клієнт не підключений до бота. Телефон: ${esc((doc as { phone?: string }).phone)}`,
    })
  }

  const others = await hotlineRecipientsFor(payload, kind)
  for (const target of others.keys()) {
    if (target === chat) continue
    await send({
      chat: target,
      text: `<b>${esc(label)} №${id}</b> · ${esc(who)} відповів:\n${esc(text || '[фото]')}`,
    }).catch(() => {})
  }

  const thread = ((doc as { thread?: unknown[] }).thread || []) as unknown[]
  await payload.update({
    collection: 'hotline-chats', id, overrideAccess: true,
    data: {
      status: 'work',
      answeredBy: who,
      answeredAt: new Date().toISOString(),
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
  const { docs: hotlineDocs } = await payload.find({
    collection: 'hotline-chats', limit: 1, depth: 0, overrideAccess: true,
    sort: '-createdAt',
    where: { clientChat: { equals: chat }, status: { not_equals: 'done' } },
  })
  if (hotlineDocs[0]) {
    await appendHotline(payload, hotlineDocs[0] as HotlineDoc, msg)
    return
  }

  const { docs: draftDocs } = await payload.find({
    collection: 'eval-requests', limit: 1, depth: 0, overrideAccess: true,
    sort: '-createdAt',
    where: { clientChat: { equals: chat }, source: { equals: 'bot' }, status: { equals: 'new' } },
  })
  if (draftDocs[0]) {
    await appendOtsinka(payload, draftDocs[0] as EvalDraft, msg)
    return
  }

  const { docs: linkedDocs } = await payload.find({
    collection: 'eval-requests', limit: 1, depth: 0, overrideAccess: true,
    sort: '-createdAt',
    where: { clientChat: { equals: chat } },
  })
  if (linkedDocs[0]) {
    await noteClientMessage(payload, msg, linkedDocs[0] as EvalDraft)
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
  const chats = await hotlineRecipientsFor(payload, kind)

  for (const target of chats.keys()) {
    const text2 = isFirst
      ? hotlineCard({ id: doc.id, name: doc.name, phone: doc.phone }, text, label)
      : `<b>${esc(label)} №${doc.id}</b> · клієнт додав:\n${esc(entryText)}`
    await send({ chat: target, text: text2 }).catch(() => {})
    if (photo) await sendPhoto(target, photo).catch(() => {})
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
