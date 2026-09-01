import type { CollectionConfig } from 'payload'

/**
 * Заявки на оцінку годинника. Створюються з сайту через `/api/watch-request`
 * (сам роут перевіряє розміри й типи файлів), читає й змінює — адмінка.
 *
 * Персональні дані: ім'я й телефон. Строк зберігання — розділ 19 ТЗ;
 * оброблені заявки прибирає адміністратор.
 */
export const WatchRequests: CollectionConfig = {
  slug: 'watch-requests',
  labels: { singular: 'Заявка на годинник', plural: 'Заявки: годинники' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'title',
    defaultColumns: ['title', 'phone', 'status', 'createdAt'],
  },
  access: {
    // створює лише сервер від імені заявника; читає — співробітник
    create: () => false,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'title', type: 'text', label: 'Годинник', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
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
        { name: 'brand', type: 'text', label: 'Марка', required: true },
        { name: 'model', type: 'text', label: 'Модель або референс', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'year', type: 'text', label: 'Рік придбання' },
        { name: 'condition', type: 'text', label: 'Стан зі слів клієнта' },
      ],
    },
    { name: 'comment', type: 'textarea', label: 'Що ще варто знати' },
    { name: 'photos', type: 'upload', relationTo: 'media', hasMany: true, label: 'Фотографії' },
    { name: 'note', type: 'textarea', label: 'Нотатка оцінювача' },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => ({ ...data, title: [data.brand, data.model].filter(Boolean).join(' ') || 'Без назви' }),
    ],
  },
}
