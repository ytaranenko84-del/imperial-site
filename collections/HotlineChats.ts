import type { CollectionConfig } from 'payload'

/**
 * Звернення на гарячу лінію через бота. Окремо від «Заявки: оцінка» —
 * це не оцінка речі, а будь-яке інше питання клієнта до оператора.
 */
export const HotlineChats: CollectionConfig = {
  slug: 'hotline-chats',
  labels: { singular: 'Звернення на гарячу лінію', plural: 'Гаряча лінія' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'title',
    defaultColumns: ['title', 'phone', 'status', 'createdAt'],
  },
  access: {
    create: () => false,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [
      ({ data }) => ({ ...data, title: data.name ? String(data.name) : 'Гаряча лінія' }),
    ],
  },
  fields: [
    { name: 'title', type: 'text', label: 'Звернення', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'status', type: 'select', label: 'Стан', defaultValue: 'new',
          options: [
            { label: 'Нове', value: 'new' },
            { label: 'В роботі', value: 'work' },
            { label: 'Закрито', value: 'done' },
          ] },
        { name: 'name', type: 'text', label: 'Ім’я в Telegram', admin: { readOnly: true } },
        { name: 'phone', type: 'text', label: 'Телефон', admin: { readOnly: true } },
      ],
    },
    { name: 'clientChat', type: 'text', label: 'Telegram-чат клієнта', admin: { readOnly: true, hidden: true } },
    { name: 'answeredBy', type: 'text', label: 'Відповів', admin: { readOnly: true } },
    { name: 'answeredAt', type: 'date', label: 'Коли', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'thread',
      type: 'array',
      label: 'Переписка',
      admin: { readOnly: true, description: 'Повна історія: що написав клієнт і що відповів оператор' },
      fields: [
        { name: 'from', type: 'text', label: 'Хто' },
        { name: 'text', type: 'textarea', label: 'Повідомлення' },
        { name: 'at', type: 'date', label: 'Коли', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
  ],
}
