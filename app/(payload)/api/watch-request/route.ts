import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Заявка на оцінку годинника: POST multipart/form-data з формою на сторінці
 * /zastava/hodynnyky. Роут публічний, тож усі обмеження — тут:
 * розмір і тип файлів, їх кількість, довжина полів.
 *
 * Записує заявку в колекцію watch-requests, звідки її бачить оцінювач
 * в адмінці. Пошта чи месенджер додаються пізніше, коли замовник скаже,
 * куди саме мають падати заявки.
 */

const MAX_FILES = 6
const MAX_FILE_BYTES = 10 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']

const text = (v: FormDataEntryValue | null, max = 200) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: 'Не вдалося прочитати форму' }, { status: 400 })
  }

  // приманка для роботів: люди це поле не бачать і не заповнюють
  if (text(form.get('company'))) return Response.json({ ok: true })

  const name = text(form.get('name'), 120)
  const phone = text(form.get('phone'), 40)
  const brand = text(form.get('brand'), 80)
  const model = text(form.get('model'), 120)

  if (!name || !phone || !brand || !model) {
    return Response.json({ error: 'Заповніть ім’я, телефон, марку й модель' }, { status: 422 })
  }
  if (phone.replace(/\D/g, '').length < 9) {
    return Response.json({ error: 'Перевірте номер телефону' }, { status: 422 })
  }

  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) {
    return Response.json({ error: 'Додайте хоча б одне фото годинника' }, { status: 422 })
  }
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

  const payload = await getPayload({ config })

  try {
    const photos: (string | number)[] = []
    for (const [i, f] of files.entries()) {
      const doc = await payload.create({
        collection: 'media',
        overrideAccess: true,
        data: { alt: `Заявка: ${brand} ${model}, фото ${i + 1}` },
        file: {
          data: Buffer.from(await f.arrayBuffer()),
          name: f.name || `photo-${i + 1}.jpg`,
          mimetype: f.type,
          size: f.size,
        },
      })
      photos.push(doc.id)
    }

    await payload.create({
      collection: 'watch-requests',
      overrideAccess: true,
      data: {
        name, phone, brand, model,
        year: text(form.get('year'), 20),
        condition: text(form.get('condition'), 80),
        comment: text(form.get('comment'), 2000),
        status: 'new',
        photos,
      },
    })

    return Response.json({ ok: true })
  } catch (e) {
    // клієнту — коротко; подробиці лишаються в журналі сервера
    payload.logger.error({ err: e }, 'watch-request failed')
    return Response.json({ error: 'Не вдалося зберегти заявку. Зателефонуйте нам, будь ласка.' }, { status: 500 })
  }
}
