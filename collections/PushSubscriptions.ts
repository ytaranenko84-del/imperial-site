import type { CollectionConfig } from 'payload'

/**
 * Пристрої (телефони), що отримують push-сповіщення про нові заявки.
 * Заповнюється зі сторінки /notify/<токен> — не через адмінку.
 */
export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  labels: { singular: 'Push-підписка', plural: 'Push-підписки' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'endpoint',
    defaultColumns: ['recipient', 'userAgent', 'createdAt'],
    description: 'Хто і на якому пристрої увімкнув push-сповіщення. Заповнюється саме зі сторінки /notify.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'recipient', type: 'relationship', relationTo: 'recipients', label: 'Отримувач', required: true },
    { name: 'endpoint', type: 'text', label: 'Endpoint', required: true, unique: true, admin: { readOnly: true } },
    { name: 'p256dh', type: 'text', label: 'Ключ p256dh', required: true, admin: { readOnly: true } },
    { name: 'auth', type: 'text', label: 'Ключ auth', required: true, admin: { readOnly: true } },
    { name: 'userAgent', type: 'text', label: 'Пристрій', admin: { readOnly: true } },
  ],
}
