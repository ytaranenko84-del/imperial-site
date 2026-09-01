import type { CollectionConfig } from 'payload'

export const Cities: CollectionConfig = {
  slug: 'cities',
  labels: { singular: 'Місто', plural: 'Міста' },
  admin: { group: 'Відділення', useAsTitle: 'name', defaultColumns: ['name', 'slug', 'order'] },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', label: 'Назва', required: true, localized: true },
    { name: 'slug', type: 'text', label: 'Адреса сторінки', required: true, unique: true,
      admin: { description: 'Латиницею: dnipro, odesa. Формує /viddilennya/<slug>/' } },
    { name: 'order', type: 'number', label: 'Порядок', defaultValue: 0 },
    { name: 'seoTitle', type: 'text', label: 'Заголовок сторінки міста', localized: true },
    { name: 'seoText', type: 'textarea', label: 'Текст сторінки міста', localized: true },
  ],
}
