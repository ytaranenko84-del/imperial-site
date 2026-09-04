import { getPayload } from 'payload'
import config from '@payload-config'
import { timingSafeEqual } from 'node:crypto'
import { esc, normalizePhone, send, sumFromText, token } from '@/lib/telegram.ts'

/**
 * Приймання подій від Telegram.
 *
 * Що вміє:
 *   • «Почати» — вітання; за посиланням із міткою заявки прив'язує клієнта;
 *   • «Поділитися номером» — звіряє номер із відділеннями й отримувачами
 *     й запам'ятовує чат;
 *   • відповідь на картку заявки — пересилає її клієнтові та зберігає
 *     листування в адмінці.
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

type TgMessage = {
  message_id: number
  chat: { id: number; type: string }
  from?: TgUser
  text?: string
  contact?: { phone_number: string; user_id?: number }
  migrate_to_chat_id?: number
  reply_to_message?: { message_id: number; text?: string }
  message_thread_id?: number
}

const CONTACT_KEYBOARD = {
  keyboard: [[{ text: '📱 Поділитися номером', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
}

const HELLO = [
  'Вітаємо в «Імперіалі» 👋',
  '',
  'Якщо ви <b>співробітник</b> — натисніть кнопку внизу, і я звірю номер із робочим.',
  'Після цього сюди надходитимуть заявки вашого відділення чи напрямку.',
  '',
  'Якщо ви <b>клієнт</b> — просто напишіть нам, і оцінювач відповість тут.',
].join('\n')

/** Номер заявки з картки: «Заявка №148» або «Бронь №12». */
function requestIdFrom(text?: string) {
  const m = /(?:Заявка|Бронь)\s*№(\d+)/i.exec(text || '')
  return m ? Number(m[1]) : null
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

    // ── поділився номером: шукаємо, хто це ──
    if (msg.contact) {
      await linkByPhone(payload, chatKey, msg.contact.phone_number, msg.from)
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
          })
        } else {
          await send({ chat: chatKey, text: 'Посилання застаріло. Зателефонуйте нам, будь ласка.' })
        }
        return Response.json({ ok: true })
      }

      await send({ chat: chatKey, text: HELLO, replyMarkup: CONTACT_KEYBOARD })
      return Response.json({ ok: true })
    }

    // ── відповідь на картку заявки → клієнтові ──
    if (msg.reply_to_message && msg.text) {
      await relayAnswer(payload, msg, chatKey)
      return Response.json({ ok: true })
    }

    // ── звичайне повідомлення від клієнта ──
    if (msg.chat.type === 'private' && msg.text) {
      await noteClientMessage(payload, msg)
    }
  } catch (e) {
    payload.logger.error({ err: e }, 'telegram webhook')
  }

  return Response.json({ ok: true })
}

/** Звіряємо номер із відділеннями й отримувачами заявок. */
async function linkByPhone(
  payload: Awaited<ReturnType<typeof getPayload>>,
  chat: string,
  phone: string,
  from?: TgUser,
) {
  const digits = normalizePhone(phone)
  const who = [from?.first_name, from?.username ? `@${from.username}` : ''].filter(Boolean).join(' ')

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

  await send({
    chat,
    text: 'Цього номера немає серед робочих. Якщо ви клієнт — просто напишіть нам, '
      + 'і оцінювач відповість тут.',
  })
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

/** Відповідь співробітника на картку заявки пересилаємо клієнтові. */
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

  const who = [msg.from?.first_name, msg.from?.username ? `@${msg.from.username}` : '']
    .filter(Boolean).join(' ') || 'оцінювач'
  const text = String(msg.text || '')
  const clientChat = String((doc as { clientChat?: string }).clientChat || '')
  const answeredBy = String((doc as { answeredBy?: string }).answeredBy || '')

  if (answeredBy && answeredBy !== who) {
    await send({ chat, text: `На цю заявку вже відповів ${esc(answeredBy)}. Ваше повідомлення теж надіслано.` })
  }

  if (clientChat) {
    await send({ chat: clientChat, text: `<b>Ломбард «Імперіал»</b>\n${esc(text)}` })
    await send({ chat, text: '✓ Надіслано клієнту' })
  } else {
    await send({
      chat,
      text: `Клієнт не підключений до бота. Телефон: ${esc((doc as { phone?: string }).phone)}`,
    })
  }

  const thread = ((doc as { thread?: unknown[] }).thread || []) as unknown[]

  // Сума з відповіді — щоб не вписувати її ще раз руками в адмінці.
  // Числа самої заявки не рахуємо: модель годинника теж складається з цифр.
  const already = Number((doc as { estimate?: number }).estimate || 0)
  const own = [doc.brand, doc.model, doc.year].filter(Boolean).join(' ')
  const sum = already > 0 ? null : sumFromText(text, own)

  await payload.update({
    collection: 'eval-requests', id, overrideAccess: true,
    data: {
      status: 'work',
      answeredBy: who,
      answeredAt: new Date().toISOString(),
      ...(sum ? { estimate: sum } : {}),
      thread: [...thread, { from: who, text, at: new Date().toISOString() }],
    },
  })

  if (sum) await send({ chat, text: `Записав оцінку: <b>${sum.toLocaleString('uk-UA')} грн</b>` })
}

/** Повідомлення клієнта повертаємо в чат оцінювача й пишемо в заявку. */
async function noteClientMessage(
  payload: Awaited<ReturnType<typeof getPayload>>,
  msg: TgMessage,
) {
  const chat = String(msg.chat.id)
  const { docs } = await payload.find({
    collection: 'eval-requests',
    limit: 1,
    depth: 0,
    overrideAccess: true,
    sort: '-createdAt',
    where: { clientChat: { equals: chat } },
  })
  const doc = docs[0]
  if (!doc) return

  const text = String(msg.text || '')
  const thread = ((doc as { thread?: unknown[] }).thread || []) as unknown[]
  await payload.update({
    collection: 'eval-requests', id: doc.id, overrideAccess: true,
    data: { thread: [...thread, { from: 'клієнт', text, at: new Date().toISOString() }] },
  })

  const { recipientsFor } = await import('@/lib/telegram.ts')
  const chats = await recipientsFor(payload, String((doc as { category?: string }).category || ''))
  for (const target of chats.keys()) {
    await send({
      chat: target,
      text: `<b>Заявка №${doc.id}</b> · клієнт відповів:\n${esc(text)}`,
    }).catch(() => {})
  }
}
