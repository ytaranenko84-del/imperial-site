import type { CollectionConfig } from 'payload'

/**
 * Новини та акції.
 *
 * Текст лежить звичайним текстом, а не в редакторі з розміткою: співробітник
 * пише як у листі, порожній рядок розділяє абзаци, рядок із «•» стає пунктом
 * списку. Так матеріал може додати будь-хто, не розбираючись у редакторі.
 */
export const News: CollectionConfig = {
  slug: 'news',
  labels: { singular: 'Новина або акція', plural: 'Новини та акції' },
  admin: {
    group: 'Контент',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'publishedAt', 'archived'],
  },
  access: { read: () => true },
  hooks: {
    /**
     * Медіа за замовчуванням приватне (там і фото клієнтів на оцінку) —
     * а обкладинка новини чи акції має бути видна всім відвідувачам сайту.
     * Тому щойно картинку обрали обкладинкою, позначаємо її публічною сама.
     */
    afterChange: [
      async ({ doc, req }) => {
        const coverId = typeof doc.cover === 'object' ? doc.cover?.id : doc.cover
        if (!coverId) return
        try {
          const media = await req.payload.findByID({ collection: 'media', id: coverId, overrideAccess: true, depth: 0 })
          if (!media?.public) {
            await req.payload.update({
              collection: 'media', id: coverId, data: { public: true }, overrideAccess: true,
            })
          }
        } catch {
          // Файл міг видалитися між збереженнями — нічого критичного
        }
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', label: 'Заголовок', required: true, localized: true },
    {
      name: 'slug', type: 'text', label: 'Адреса сторінки', required: true, unique: true,
      admin: { description: 'Латиницею: novorichna-lotereya. Формує /novyny/<адреса>' },
    },
    {
      name: 'kind', type: 'select', label: 'Тип', required: true, defaultValue: 'news',
      options: [{ label: 'Новина', value: 'news' }, { label: 'Акція', value: 'promo' }],
    },
    { name: 'publishedAt', type: 'date', label: 'Дата', required: true },
    {
      name: 'term', type: 'text', label: 'Строк дії', localized: true,
      admin: { description: 'Для акцій: «На постійній основі», «Діє до 31 грудня». Для новин можна лишити порожнім' },
    },
    {
      name: 'lead', type: 'textarea', label: 'Короткий опис', localized: true,
      admin: { description: 'Один-два рядки. Показується в переліку й у пошуковій видачі' },
    },
    {
      name: 'body', type: 'textarea', label: 'Текст', required: true, localized: true,
      admin: { description: 'Порожній рядок — новий абзац. Рядок, що починається з «•» — пункт списку' },
    },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Зображення' },
    {
      name: 'archived', type: 'checkbox', label: 'В архіві', defaultValue: false,
      admin: { description: 'Акція завершилась або новина застаріла: матеріал лишається за своєю адресою, '
        + 'але йде в кінець переліку, окремим блоком' },
    },
    {
      name: 'pinnedOnHome', type: 'checkbox', label: 'Показувати стрічкою на сайті', defaultValue: false,
      admin: {
        condition: (_, sibling) => sibling?.kind === 'promo',
        description: 'Вузька стрічка з’явиться над шапкою на кожній сторінці сайту, поки акція не в архіві. '
          + 'Якщо позначено кілька акцій — показується найновіша з них.',
      },
    },
    {
      name: 'oldPath', type: 'text', label: 'Адреса на старому сайті',
      admin: { readOnly: true, position: 'sidebar', description: 'Для довідки: звідки перенесено' },
    },
  ],
}
