import type { CollectionConfig } from 'payload'
import { EVAL_CATEGORIES } from './EvalRequests.ts'

/**
 * Кому надсилати заявки. Один запис — одна людина або чат.
 *
 * Прив'язка йде за номером: співробітник відкриває бота, тисне «Поділитися
 * номером», і Telegram сам передає номер свого облікового запису. Підробити
 * його не можна, тож достатньо звірити з цим переліком.
 */
export const Recipients: CollectionConfig = {
  slug: 'recipients',
  labels: { singular: 'Отримувач заявок', plural: 'Куди надсилати заявки' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'phone', 'linked'],
    description: 'Хто отримує заявки в Telegram. Прив’язка — за робочим номером.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'title', type: 'text', label: 'Хто це', required: true,
      admin: { description: 'Для себе: «Оцінювач годинників», «Юрій, керівник»' } },
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', label: 'Роль', required: true, defaultValue: 'expert',
          options: [
            { label: 'Оцінювач напрямку', value: 'expert' },
            { label: 'Адміністратор — копії всіх заявок', value: 'admin' },
          ] },
        { name: 'phone', type: 'text', label: 'Робочий номер', required: true,
          admin: { description: 'Будь-який формат: звіряємо за останніми дев’ятьма цифрами' } },
        { name: 'active', type: 'checkbox', label: 'Активний', defaultValue: true },
      ],
    },
    {
      name: 'categories',
      type: 'select',
      label: 'Напрямки',
      hasMany: true,
      options: EVAL_CATEGORIES.map((c) => ({ label: c.label, value: c.value })),
      admin: {
        condition: (_, sibling) => sibling?.kind === 'expert',
        description: 'Які заявки надсилати. Порожньо — усі напрямки',
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'chatId', type: 'text', label: 'Telegram-чат', admin: { readOnly: true,
          description: 'Заповнюється сам після «Поділитися номером»' } },
        { name: 'linked', type: 'date', label: 'Прив’язано', admin: { readOnly: true,
          date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'tgName', type: 'text', label: 'Обліковий запис', admin: { readOnly: true } },
      ],
    },
  ],
}
