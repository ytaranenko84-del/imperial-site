import { getPayload } from 'payload'
import config from '@payload-config'
import { recipientFromToken } from '@/lib/dashboardSession.ts'
import { readCookie, SESSION_COOKIE } from '@/lib/staffAuth.ts'
import { deleteMessage, editMessageText, sumFromText } from '@/lib/telegram.ts'
import { runAfterResponse } from '@/lib/groupCard.ts'
import { clientBody, copyBody, withinEditWindow, type RemovedEntry, type ThreadEntry } from '@/lib/threadEdit.ts'

/**
 * «Змінити» / «Видалити» повідомлення з робочого столу.
 *
 * Відповідь клієнту: змінюємо чи видаляємо і в клієнта в Telegram, і копії
 * в колег. Можна лише автору (адміністратору — будь-яку), лише 48 годин
 * і лише ті, що надіслані після появи цієї можливості (є номер у Telegram).
 * Нотатка команді: автору чи адміністратору, без обмеження в часі.
 *
 * Старий текст не губиться: при зміні — в історію правок, при видаленні —
 * у поле removed. У переписці лишається слід «хто й коли».
 */

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const fail = (error: string, status = 409) => Response.json({ error }, { status })

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const me = await recipientFromToken(payload, readCookie(req.headers.get('cookie'), SESSION_COOKIE))
  if (!me) return fail('Потрібен вхід', 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('Не вдалося прочитати запит', 400)
  }

  const kind = str(body.kind, 20)
  const id = str(body.id, 40)
  const entryId = str(body.entry, 64)
  const target = str(body.target, 10) === 'note' ? 'note' : 'thread'
  const action = str(body.action, 10)
  const newText = str(body.text, target === 'note' ? 2000 : 4000)
  if (!id || !entryId || (kind !== 'eval' && kind !== 'hotline') || (action !== 'edit' && action !== 'delete')) {
    return fail('Некоректні дані', 422)
  }
  if (action === 'edit' && !newText) return fail('Порожній текст — щоб прибрати повідомлення, натисніть «Видалити»', 422)

  const collection = kind === 'eval' ? 'eval-requests' : 'hotline-chats'
  const doc = await payload.findByID({ collection, id, depth: 0, overrideAccess: true }).catch(() => null) as Record<string, unknown> | null
  if (!doc) return fail('Заявку не знайдено', 404)

  const field = target === 'note' ? 'notes' : 'thread'
  const list = ((doc[field] as ThreadEntry[] | undefined) || [])
  const entry = list.find((e) => String(e.id) === entryId)
  if (!entry) return fail('Повідомлення вже немає — оновіть переписку', 404)

  const isAdmin = me.kind === 'admin'
  // Старі нотатки без автора — звіряємо за підписом
  const mine = entry.authorId ? String(entry.authorId) === String(me.id) : (target === 'note' && entry.from === me.title)
  if (!mine && !isAdmin) return fail('Змінювати й видаляти можна лише свої повідомлення', 403)

  const now = new Date().toISOString()
  const oldText = String(entry.text || '')

  if (target === 'thread') {
    if (!entry.from || entry.from === 'клієнт') return fail('Повідомлення клієнта змінювати не можна', 403)
    const tg = entry.tg
    if (!tg?.chat || !tg.msg) return fail('Це повідомлення надіслане до оновлення (або SMS) — змінити чи видалити його не можна')
    if (!withinEditWindow(entry.at)) return fail('Минуло понад 48 годин — Telegram уже не дає змінити чи видалити це повідомлення')

    if (action === 'edit') {
      if (newText === oldText) return Response.json({ ok: true })
      try {
        await editMessageText(tg.chat, tg.msg, clientBody(newText, tg.hint))
      } catch (e) {
        return fail(`Telegram не дав змінити: ${(e as Error).message}`, 502)
      }

      const data: Record<string, unknown> = {
        thread: list.map((e) => (e === entry
          ? { ...e, text: newText, editedAt: now, history: [...(e.history || []), { text: oldText, at: now, by: me.title }] }
          : e)),
      }
      // Виправили суму в оцінці — оновлюємо й суму заявки (у групу відділень піде нова)
      let sumNote = ''
      if (kind === 'eval') {
        const own = [doc.brand, doc.model, doc.year].filter(Boolean).join(' ')
        const current = Number(doc.estimate || 0)
        const before = sumFromText(oldText, own)
        const after = sumFromText(newText, own)
        if (before != null && before === current && after != null && after !== current) {
          data.estimate = after
          sumNote = `Сума оцінки в заявці теж змінена: ${after.toLocaleString('uk-UA')} грн`
        }
      }
      await payload.update({ collection, id, overrideAccess: true, data })

      const who = String(entry.from || me.title)
      await runAfterResponse(async () => {
        for (const c of tg.copies || []) {
          await editMessageText(c.chat, c.msgId, copyBody(tg.label || 'Заявка', id, who, newText, true)).catch(() => {})
        }
      }, 'копії зміненої відповіді не оновились')
      return Response.json({ ok: true, note: sumNote })
    }

    // delete
    try {
      await deleteMessage(tg.chat, tg.msg)
    } catch (e) {
      const why = (e as Error).message
      // клієнт сам видалив чат чи повідомлення — у нього його вже немає, це не завада
      if (!/not found/i.test(why)) return fail(`Telegram не дав видалити: ${why}`, 502)
    }
    const lastReply = doc.lastReply as { clientMsgId?: number } | null | undefined
    await payload.update({
      collection, id, overrideAccess: true,
      data: {
        thread: list.filter((e) => e !== entry),
        removed: [...((doc.removed as RemovedEntry[] | undefined) || []), { ...entry, type: 'message', deletedAt: now, deletedBy: me.title }],
        // кнопка «🗑 Видалити» в Telegram під цією відповіддю вже не потрібна
        ...(lastReply?.clientMsgId === tg.msg ? { lastReply: null } : {}),
      },
    })
    await runAfterResponse(async () => {
      for (const c of tg.copies || []) await deleteMessage(c.chat, c.msgId).catch(() => {})
    }, 'копії видаленої відповіді не прибрались')
    return Response.json({ ok: true })
  }

  // Нотатка команді — клієнту не йде, Telegram не чіпаємо
  if (action === 'edit') {
    if (newText === oldText) return Response.json({ ok: true })
    await payload.update({
      collection, id, overrideAccess: true,
      data: {
        notes: list.map((e) => (e === entry
          ? { ...e, text: newText, editedAt: now, history: [...(e.history || []), { text: oldText, at: now, by: me.title }] }
          : e)),
      },
    })
    return Response.json({ ok: true })
  }
  await payload.update({
    collection, id, overrideAccess: true,
    data: {
      notes: list.filter((e) => e !== entry),
      removed: [...((doc.removed as RemovedEntry[] | undefined) || []), { ...entry, type: 'note', deletedAt: now, deletedBy: me.title }],
    },
  })
  return Response.json({ ok: true })
}
