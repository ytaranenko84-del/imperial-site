import type { CollectionConfig } from 'payload'

/** Напрямки оцінки. Ключ визначає, кому бот надішле заявку. */
export const EVAL_CATEGORIES = [
  { label: 'Годинники', value: 'watches' },
  { label: 'Цифрова техніка', value: 'digital' },
  { label: 'Побутова техніка', value: 'home' },
  { label: 'Інструмент', value: 'tools' },
  { label: 'Спорт і відпочинок', value: 'sport' },
] as const

/**
 * Заявки на оцінку за фото — з усіх сторінок категорій і зі сторінки
 * годинників. Створює сайт через `/api/eval-request`; читає й веде адмінка.
 *
 * Одна колекція на всі напрямки: інакше пошук і звіти довелося б збирати
 * з п'яти однакових таблиць, а бот — знати про кожну окремо.
 */
export const EvalRequests: CollectionConfig = {
  slug: 'eval-requests',
  labels: { singular: 'Заявка на оцінку', plural: 'Заявки: оцінка за фото' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'phone', 'status', 'createdAt'],
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const sum = Number(data.estimate ?? originalDoc?.estimate ?? 0)
        const alreadySent = Boolean(originalDoc?.groupSentAt)
        return {
          ...data,
          title: [data.brand, data.model].filter(Boolean).join(' ') || 'Без назви',
          // Позначку про спільну групу ставимо тут, у тому самому збереженні.
          // Окремим записом із afterChange не виходить: він потрапляє в ту саму
          // транзакцію й перезаписує заявку недописаними даними.
          ...(sum > 0 && !alreadySent ? { groupSentAt: new Date().toISOString() } : {}),
        }
      },
    ],

    /**
     * Копія оціненої заявки у спільну групу відділень.
     *
     * Гейт — не «groupSentAt», а сама зміна суми: спрацьовує і коли сума
     * зʼявилась вперше (повна картка й фото), і коли оцінювач пізніше в
     * переписці чи прямо в адмінці її виправив (коротке уточнення, без
     * повторних фото). Без телефона й імені: групу бачать усі відділення,
     * а імʼя разом із фото речі вже дозволяє впізнати людину.
     */
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        const estimate = Number(doc.estimate || 0)
        const prevEstimate = Number(previousDoc?.estimate || 0)
        if (estimate <= 0 || estimate === prevEstimate) return doc

        try {
          const { groupCard, mediaUrl, send, sendPhotos, token } = await import('../lib/telegram.ts')
          if (!token()) return doc

          const settings = await req.payload.findGlobal({ slug: 'settings', overrideAccess: true }) as Record<string, unknown>
          const chat = String(settings.reviewChat || '')
          if (!chat) return doc

          if (prevEstimate > 0) {
            await send({
              chat,
              text: `<b>Заявка №${doc.id}</b> · сума уточнена: ${prevEstimate.toLocaleString('uk-UA')} → `
                + `<b>${estimate.toLocaleString('uk-UA')} грн</b>`,
            })
            return doc
          }

          await send({ chat, text: groupCard(doc as Record<string, unknown>) })

          const ids = (doc.photos || []) as unknown[]
          if (ids.length) {
            const urls: string[] = []
            for (const it of ids) {
              const id = typeof it === 'object' && it ? (it as { id?: unknown }).id : it
              const m = await req.payload.findByID({ collection: 'media', id: String(id), depth: 0, overrideAccess: true })
                .catch(() => null) as { filename?: string } | null
              if (m?.filename) urls.push(mediaUrl(m.filename))
            }
            if (urls.length) await sendPhotos(chat, urls)
          }
        } catch (e) {
          // Група — допоміжна копія: заявка збережена в будь-якому разі
          console.error('картка в групу не пішла:', e)
        }
        return doc
      },
    ],
  },

  access: {
    create: () => false,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'title', type: 'text', label: 'Річ', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'category', type: 'select', label: 'Напрямок', required: true,
          options: EVAL_CATEGORIES.map((c) => ({ label: c.label, value: c.value })) },
        { name: 'status', type: 'select', label: 'Стан заявки', defaultValue: 'new',
          options: [
            { label: 'Нова', value: 'new' },
            { label: 'В роботі', value: 'work' },
            { label: 'Оцінено', value: 'done' },
            { label: 'Відмова', value: 'reject' },
          ] },
        { name: 'estimate', type: 'number', label: 'Попередня оцінка, грн' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', label: 'Ім’я', required: true },
        { name: 'phone', type: 'text', label: 'Телефон', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'brand', type: 'text', label: 'Марка' },
        { name: 'model', type: 'text', label: 'Модель' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'year', type: 'text', label: 'Рік' },
        { name: 'condition', type: 'text', label: 'Стан зі слів клієнта' },
      ],
    },
    { name: 'comment', type: 'textarea', label: 'Що ще варто знати' },
    { name: 'photos', type: 'upload', relationTo: 'media', hasMany: true, label: 'Фотографії' },
    { name: 'sent', type: 'text', label: 'Надіслано в чат', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'clientChat', type: 'text', label: 'Клієнт у боті', admin: { readOnly: true,
          description: 'Порожньо — відповідь лише дзвінком або SMS' } },
        // Таємне слово в посиланні: без нього чужу заявку не «привласнити»
        { name: 'clientKey', type: 'text', label: 'Ключ посилання', admin: { hidden: true } },
        { name: 'answeredBy', type: 'text', label: 'Відповів', admin: { readOnly: true } },
        { name: 'groupSentAt', type: 'date', label: 'У групу надіслано', admin: { readOnly: true,
          date: { pickerAppearance: 'dayAndTime' },
          description: 'Копія пішла у спільну групу відділень. Заповнюється само' } },
        { name: 'answeredAt', type: 'date', label: 'Коли', admin: { readOnly: true,
          date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      name: 'thread',
      type: 'array',
      label: 'Листування',
      admin: { readOnly: true, description: 'Повна історія: що написали ми і що відповів клієнт' },
      fields: [
        { name: 'from', type: 'text', label: 'Хто' },
        { name: 'text', type: 'textarea', label: 'Повідомлення' },
        { name: 'at', type: 'date', label: 'Коли', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    { name: 'note', type: 'textarea', label: 'Нотатка оцінювача' },
  ],
}
