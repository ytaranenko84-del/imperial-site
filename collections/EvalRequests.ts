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
  hooks: {
    beforeChange: [
      ({ data }) => ({
        ...data,
        title: [data.brand, data.model].filter(Boolean).join(' ') || 'Без назви',
      }),
    ],
  },
}
