import type { CollectionConfig } from 'payload'

/**
 * Звернення через бота, окремо від «Заявки: оцінка» — не оцінка речі,
 * а розмова з людиною. Два різновиди в одній сутності, бо структура
 * однакова (переписка, Reply-відповідь, отримувачі): гаряча лінія й
 * відгук/скарга різняться лише текстом привітання від бота — обидва
 * йдуть оператору гарячої лінії й адміністратору, керівництво має
 * бачити кожне звернення.
 */
export const HotlineChats: CollectionConfig = {
  slug: 'hotline-chats',
  labels: { singular: 'Звернення', plural: 'Гаряча лінія та відгуки' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'phone', 'status', 'createdAt'],
  },
  access: {
    create: () => false,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [
      ({ data }) => ({ ...data, title: data.name ? String(data.name) : 'Звернення' }),
    ],
  },
  fields: [
    { name: 'title', type: 'text', label: 'Звернення', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', label: 'Тип', defaultValue: 'hotline',
          options: [
            { label: 'Гаряча лінія', value: 'hotline' },
            { label: 'Відгук / скарга', value: 'review' },
          ], admin: { readOnly: true } },
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
