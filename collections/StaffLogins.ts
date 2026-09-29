import type { CollectionConfig } from 'payload'

/**
 * Одноразові токени входу на робочий стіл через бота: браузер створює
 * запис і чекає, поки співробітник підтвердить вхід кнопкою в Telegram.
 * Короткоживуча службова таблиця — адмінка сюди не заглядає.
 */
export const StaffLogins: CollectionConfig = {
  slug: 'staff-logins',
  labels: { singular: 'Вхід на робочий стіл', plural: 'Входи на робочий стіл' },
  admin: { group: 'Система', hidden: true },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'token', type: 'text', required: true, unique: true, index: true },
    { name: 'status', type: 'select', defaultValue: 'pending',
      options: [
        { label: 'Очікує', value: 'pending' },
        { label: 'Підтверджено', value: 'confirmed' },
      ] },
    { name: 'recipient', type: 'relationship', relationTo: 'recipients' },
  ],
}
