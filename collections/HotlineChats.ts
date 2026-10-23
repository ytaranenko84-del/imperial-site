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
    { name: 'assignedTo', type: 'relationship', relationTo: 'recipients', label: 'Призначено',
      admin: { position: 'sidebar' } },
    { name: 'lastReply', type: 'json', label: 'Останнє надіслане (службове)', admin: { readOnly: true, hidden: true } },
    { name: 'answeredBy', type: 'text', label: 'Відповів', admin: { readOnly: true } },
    { name: 'lastViewedAt', type: 'date', label: 'Востаннє переглянуто', admin: { readOnly: true, hidden: true,
      date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'answeredAt', type: 'date', label: 'Коли', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'mergedInto', type: 'number', label: 'Об’єднано в звернення №', admin: { readOnly: true } },
    { name: 'noReplyAt', type: 'date', label: 'Позначено «не потребує відповіді»', admin: { readOnly: true, hidden: true } },
    // Передача між відділами з робочого столу: журнал переходів і куди передано (див. lib/transfer.ts)
    { name: 'transfers', type: 'json', label: 'Передачі між відділами (службове)', admin: { readOnly: true, hidden: true } },
    { name: 'transferredTo', type: 'text', label: 'Передано в (службове)', admin: { readOnly: true, hidden: true } },
    {
      name: 'thread',
      type: 'array',
      label: 'Переписка',
      admin: { readOnly: true, description: 'Повна історія: що написав клієнт і що відповів оператор' },
      fields: [
        { name: 'from', type: 'text', label: 'Хто' },
        { name: 'text', type: 'textarea', label: 'Повідомлення' },
        { name: 'at', type: 'date', label: 'Коли', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        // id фото з медіатеки — щоб фото клієнта не губились, зокрема при передачі в оцінку
        { name: 'photo', type: 'number', label: 'Фото (службове)', admin: { hidden: true } },
        { name: 'mergedFrom', type: 'number', label: 'Із звернення №', admin: { hidden: true } },
      ],
    },
    {
      name: 'notes',
      type: 'array',
      label: 'Нотатки команди',
      admin: { readOnly: true, hidden: true, description: 'Внутрішнє обговорення — клієнт цього не бачить' },
      fields: [
        { name: 'from', type: 'text', label: 'Хто' },
        { name: 'text', type: 'textarea', label: 'Текст' },
        { name: 'mentions', type: 'text', label: 'Згадані (службове)' },
        { name: 'at', type: 'date', label: 'Коли', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
  ],
}
