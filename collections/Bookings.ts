import type { CollectionConfig } from 'payload'

/**
 * Бронь суми з калькулятора. Створює сайт через `/api/booking`.
 * Бронь фіксує оцінку на добу, а не готівку в касі — так і написано клієнту.
 */
export const Bookings: CollectionConfig = {
  slug: 'bookings',
  labels: { singular: 'Бронь суми', plural: 'Заявки: бронь' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'title',
    defaultColumns: ['title', 'phone', 'branch', 'status', 'expiresAt'],
  },
  access: {
    create: () => false,
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'title', type: 'text', label: 'Бронь', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'status', type: 'select', label: 'Стан', defaultValue: 'new',
          options: [
            { label: 'Нова', value: 'new' },
            { label: 'Клієнт прийшов', value: 'came' },
            { label: 'Оформлено', value: 'done' },
            { label: 'Не прийшов', value: 'missed' },
          ] },
        { name: 'expiresAt', type: 'date', label: 'Діє до',
          admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'name', type: 'text', label: 'Ім’я', required: true },
        { name: 'phone', type: 'text', label: 'Телефон', required: true },
      ],
    },
    { name: 'branch', type: 'relationship', relationTo: 'branches', label: 'Відділення' },
    {
      type: 'row',
      fields: [
        { name: 'amount', type: 'number', label: 'Сума, грн' },
        { name: 'purity', type: 'text', label: 'Проба' },
        { name: 'weight', type: 'number', label: 'Вага, г' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'days', type: 'number', label: 'Строк, днів' },
        { name: 'tier', type: 'text', label: 'Статус лояльності' },
      ],
    },
    { name: 'sent', type: 'text', label: 'Надіслано в чат', admin: { readOnly: true } },
    { name: 'note', type: 'textarea', label: 'Нотатка' },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => ({
        ...data,
        title: [data.amount ? `${Number(data.amount).toLocaleString('uk-UA')} грн` : null, data.name]
          .filter(Boolean).join(' · ') || 'Бронь',
      }),
    ],
  },
}
