import { getPayload } from 'payload'
import config from '@payload-config'
import { normalizePhone, send, token } from '@/lib/telegram.ts'

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
type TgMessage = {
  message_id: number
  chat: { id: number; type: string }
  from?: TgUser
  text?: string
  contact?: { phone_number: string; user_id?: number }
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

export async function POST(req: Request) {
  if (!token()) return Response.json({ ok: true })

  let update: { message?: TgMessage }
  try {
    update = await req.json()
  } catch {
    return Response.json({ ok: true })
  }

  const msg = update.message
  if (!msg) return Response.json({ ok: true })

  const payload = await getPayload({ config })
  const chatKey = msg.message_thread_id ? `${msg.chat.id}:${msg.message_thread_id}` : String(msg.chat.id)

  try {
    // ── поділився номером: шукаємо, хто це ──
    if (msg.contact) {
      await linkByPhone(payload, chatKey, msg.contact.phone_number, msg.from)
      return Response.json({ ok: true })
    }

    // ── «Почати», можливо з міткою заявки ──
    if (msg.text?.startsWith('/start')) {
      const arg = msg.text.split(' ')[1] || ''
      const id = /^eval_(\d+)$/.exec(arg)?.[1]

      if (id) {
        await payload.update({
          collection: 'eval-requests', id, overrideAccess: true,
          data: { clientChat: String(msg.chat.id) },
        }).catch(() => null)
        await send({
          chat: chatKey,
          text: `Ваша заявка №${id} прийнята. Відповідь оцінювача прийде сюди.`,
        })
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
      text: `Готово. Броні відділення <b>${String(branch.address ?? '')}</b> надходитимуть сюди.`,
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
      text: `Готово, <b>${String((person as { title?: string }).title ?? '')}</b>. Заявки надходитимуть сюди.`,
    })
    return
  }

  await send({
    chat,
    text: 'Цього номера немає серед робочих. Якщо ви клієнт — просто напишіть нам, '
      + 'і оцінювач відповість тут.',
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
    await send({ chat, text: `На цю заявку вже відповів ${answeredBy}. Ваше повідомлення теж надіслано.` })
  }

  if (clientChat) {
    await send({ chat: clientChat, text: `<b>Ломбард «Імперіал»</b>\n${text}` })
    await send({ chat, text: '✓ Надіслано клієнту' })
  } else {
    await send({
      chat,
      text: `Клієнт не підключений до бота. Телефон: ${String((doc as { phone?: string }).phone ?? '')}`,
    })
  }

  const thread = ((doc as { thread?: unknown[] }).thread || []) as unknown[]
  await payload.update({
    collection: 'eval-requests', id, overrideAccess: true,
    data: {
      status: 'work',
      answeredBy: who,
      answeredAt: new Date().toISOString(),
      thread: [...thread, { from: who, text, at: new Date().toISOString() }],
    },
  })
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
      text: `<b>Заявка №${doc.id}</b> · клієнт відповів:\n${text}`,
    }).catch(() => {})
  }
}
