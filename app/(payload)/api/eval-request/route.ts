import { getPayload } from 'payload'
import config from '@payload-config'
import { EVAL_CATEGORIES } from '@/collections/EvalRequests.ts'
import { randomBytes } from 'node:crypto'
import { evalCard, mediaUrl, recipientsFor, send, sendPhotos, token } from '@/lib/telegram.ts'
import { clientIp, recordHit, tooManyRequests } from '@/lib/ratelimit.ts'
import { notifyRecipients } from '@/lib/push.ts'
import convertHeic from 'heic-convert'
import libheif from 'libheif-js/wasm-bundle'

/**
 * Заявка на оцінку за фото: POST multipart/form-data зі сторінок категорій
 * і зі сторінки годинників. Роут публічний, тож усі перевірки — тут.
 */

const MAX_FILES = 6
const MAX_FILE_BYTES = 10 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
const HEIC_TYPES = new Set(['image/heic', 'image/heif'])
// з запасом понад 48-Мп режим iPhone Pro — розпакований HEIC декодується у
// сирий RGBA-буфер width*height*4 байт ще до будь-якої перевірки розміру
// файлу, тож саме кількість пікселів, а не байти, обмежує пам'ять на декодер
const MAX_HEIC_PIXELS = 40_000_000
const KEYS = EVAL_CATEGORIES.map((c) => c.value) as string[]

const text = (v: FormDataEntryValue | null, max = 200) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

/** Дивимось на розмір картинки заздалегідь (дешево — лише заголовки контейнера), не чіпаючи важкий HEVC-декод пікселів. */
async function assertSafeHeicDimensions(buffer: Buffer): Promise<void> {
  await libheif.ready
  const decoder = new libheif.HeifDecoder()
  const images = decoder.decode(buffer)
  try {
    if (!images.length) throw new Error('HEIF: зображення не знайдено')
    const w = images[0].get_width()
    const h = images[0].get_height()
    if (w * h > MAX_HEIC_PIXELS) throw new Error(`HEIF завеликий: ${w}x${h}`)
  } finally {
    for (const image of images) image.free()
    decoder.decoder.delete()
  }
}

/**
 * Safari сам перетворює HEIC на JPEG ще до відправки — але не завжди
 * (напр. файл обрано через «Файли», а не звичайний фотопікер, або старий
 * iOS). Медіатека не приймає heic/heif, тож конвертуємо тут заздалегідь:
 * до payload.create долітає вже звичайний JPEG.
 */
async function toUploadable(f: File): Promise<{ buffer: Buffer; name: string; mimetype: string }> {
  const buffer = Buffer.from(await f.arrayBuffer())
  if (!HEIC_TYPES.has(f.type)) return { buffer, name: f.name, mimetype: f.type }
  await assertSafeHeicDimensions(buffer)
  const jpeg = await convertHeic({ buffer, format: 'JPEG', quality: 0.9 })
  const name = (f.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg'
  return { buffer: Buffer.from(jpeg), name, mimetype: 'image/jpeg' }
}

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати форму' }, { status: 400 })
  }

  // приманка для роботів: люди цього поля не бачать. Лишаємо слід у логах —
  // інакше живий клієнт, якому автозаповнення браузера випадково підставило
  // сюди щось, отримає "успіх", а заявка мовчки зникне без жодного сліду.
  if (text(form.get('company'))) {
    console.warn('eval-request honeypot triggered', { hasName: Boolean(form.get('name')), hasPhone: Boolean(form.get('phone')) })
    return Response.json({ ok: true })
  }

  const category = text(form.get('category'), 20)
  const name = text(form.get('name'), 120)
  const phone = text(form.get('phone'), 40)
  const brand = text(form.get('brand'), 80)
  const model = text(form.get('model'), 120)

  if (!KEYS.includes(category)) {
    return Response.json({ error: 'Невідомий напрямок оцінки' }, { status: 422 })
  }
  if (!name || !phone) {
    return Response.json({ error: 'Заповніть ім’я і телефон' }, { status: 422 })
  }
  if (phone.replace(/\D/g, '').length < 9) {
    return Response.json({ error: 'Перевірте номер телефону' }, { status: 422 })
  }
  if (!brand && !model) {
    return Response.json({ error: 'Напишіть марку або модель' }, { status: 422 })
  }

  const payload = await getPayload({ config })
  const ip = clientIp(req)
  const tooMany = await tooManyRequests(payload, 'eval-requests', { phone, ip }, { perPhone: 5, perIp: 10, perSite: 30 })
  if (tooMany) return Response.json({ error: tooMany }, { status: 429 })
  await recordHit(payload, 'eval-requests', { phone, ip })

  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length > MAX_FILES) {
    return Response.json({ error: `Не більше ${MAX_FILES} фотографій` }, { status: 422 })
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return Response.json({ error: `Файл «${f.name}» більший за 10 МБ` }, { status: 413 })
    }
    if (!TYPES.includes(f.type)) {
      return Response.json({ error: `Формат «${f.type || 'невідомий'}» не підтримується` }, { status: 415 })
    }
  }

  try {
    const photos: (string | number)[] = []
    const urls: string[] = []
    for (const [i, f] of files.entries()) {
      let upload: { buffer: Buffer; name: string; mimetype: string }
      try {
        upload = await toUploadable(f)
      } catch (e) {
        payload.logger.error({ err: e, name: f.name }, 'eval-request heic convert')
        return Response.json({ error: 'Не вдалося обробити фото. Спробуйте інший формат.' }, { status: 422 })
      }
      const doc = await payload.create({
        collection: 'media',
        overrideAccess: true,
        data: { alt: `Заявка: ${[brand, model].filter(Boolean).join(' ')}, фото ${i + 1}` },
        file: {
          data: upload.buffer,
          name: upload.name || `photo-${i + 1}.jpg`,
          mimetype: upload.mimetype,
          size: upload.buffer.length,
        },
      })
      photos.push(doc.id)
      if (doc.filename) urls.push(mediaUrl(String(doc.filename)))
    }

    const doc = await payload.create({
      collection: 'eval-requests',
      overrideAccess: true,
      data: {
        category: category as 'watches',
        name, phone, brand, model,
        year: text(form.get('year'), 20),
        condition: text(form.get('condition'), 80),
        comment: text(form.get('comment'), 2000),
        status: 'new',
        photos,
        // ключ для посилання в Telegram: без нього чужу заявку не привласнити
        clientKey: randomBytes(16).toString('hex'),
      },
    })

    // ── надсилання в Telegram ──
    let sent = 'вимкнено: немає токена бота'
    if (token()) {
      const chats = await recipientsFor(payload, category)
      if (!chats.size) {
        sent = 'отримувачів не задано'
      } else {
        const card = evalCard({ ...doc, id: doc.id }, { clientInBot: false })
        const okTo: string[] = []
        const problems: string[] = []
        for (const [chat, info] of chats) {
          try {
            await send({ chat, text: card })
            okTo.push(info.title || chat)
          } catch (e) {
            payload.logger.error({ err: e, chat }, 'eval-request telegram')
            problems.push(`${info.title || chat}: ${(e as Error).message}`)
            continue
          }
          // світлини окремо: якщо альбом не пройшов, картка все одно дійшла
          try {
            await sendPhotos(chat, urls)
          } catch (e) {
            payload.logger.error({ err: e, chat }, 'eval-request photos')
            problems.push(`${info.title || chat}: ${(e as Error).message}`)
          }
        }
        sent = [
          okTo.length ? `надіслано: ${okTo.join(', ')}` : 'не вдалося надіслати, заявка збережена',
          problems.length ? `· проблеми — ${problems.join('; ')}` : '',
        ].filter(Boolean).join(' ')
        await notifyRecipients(payload, chats, {
          title: 'Нова заявка на оцінку',
          body: [brand, model].filter(Boolean).join(' ') || 'Заявка з сайту',
        })
      }
      await payload.update({ collection: 'eval-requests', id: doc.id, data: { sent }, overrideAccess: true })
    }

    const bot = await payload
      .findGlobal({ slug: 'settings', overrideAccess: true })
      .then((s) => String((s as { botUsername?: string }).botUsername || ''))
      .catch(() => '')

    return Response.json({
      ok: true,
      id: doc.id,
      // посилання, за яким клієнт вмикає відповіді в Telegram
      botLink: bot
        ? `https://t.me/${bot}?start=eval_${doc.id}_${String((doc as { clientKey?: string }).clientKey || '')}`
        : null,
    })
  } catch (e) {
    payload.logger.error({ err: e }, 'eval-request failed')
    return Response.json({ error: 'Не вдалося зберегти заявку. Зателефонуйте нам, будь ласка.' }, { status: 500 })
  }
}
