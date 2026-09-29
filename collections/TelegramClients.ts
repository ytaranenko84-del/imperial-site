import type { CollectionConfig } from 'payload'

/**
 * Пам'ять бота про клієнта: номер телефону, який він одного разу вже
 * надіслав. Без цього довелось би питати номер заново в кожному сценарії
 * («Мої броні», «Гаряча лінія», оцінка) — людина ділиться контактом раз,
 * і бот більше про це не питає.
 */
export const TelegramClients: CollectionConfig = {
  slug: 'telegram-clients',
  labels: { singular: 'Клієнт бота', plural: 'Клієнти бота' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'phone',
    defaultColumns: ['phone', 'name', 'linkedAt'],
    description: 'Технічна таблиця: telegram-чат ↔ номер телефону. Заповнюється сама.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'chatId', type: 'text', label: 'Telegram-чат', required: true, unique: true,
      admin: { readOnly: true } },
    { name: 'phone', type: 'text', label: 'Телефон', admin: { readOnly: true } },
    { name: 'name', type: 'text', label: 'Ім’я в Telegram', admin: { readOnly: true } },
    { name: 'linkedAt', type: 'date', label: 'Поділився номером',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'pendingIntent', type: 'text', label: 'Очікує після номера',
      admin: { readOnly: true, hidden: true } },
    { name: 'pendingLogin', type: 'text', label: 'Очікує токен входу',
      admin: { readOnly: true, hidden: true } },
  ],
}
