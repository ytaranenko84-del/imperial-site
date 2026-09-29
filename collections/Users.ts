import type { CollectionConfig } from 'payload'

/** Ролі за розділом 19 ТЗ: адміністратор, контент-менеджер, оператор тарифів. */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Користувач', plural: 'Користувачі' },
  admin: { group: 'Система', useAsTitle: 'email', defaultColumns: ['email', 'name', 'role'] },
  // secure лише в проді: бойовий сайт завжди на HTTPS, а локальний `npm run dev`
  // піднімається на звичайному http://localhost — Secure-кука туди просто не долетить.
  auth: { cookies: { secure: process.env.NODE_ENV === 'production' } },
  fields: [
    { name: 'name', type: 'text', label: 'Ім’я' },
    {
      name: 'role',
      type: 'select',
      label: 'Роль',
      required: true,
      defaultValue: 'content',
      options: [
        { label: 'Адміністратор — усе', value: 'admin' },
        { label: 'Контент-менеджер — тексти, акції, фото', value: 'content' },
        { label: 'Оператор тарифів — лише тарифи та ставки', value: 'rates' },
      ],
    },
  ],
}
