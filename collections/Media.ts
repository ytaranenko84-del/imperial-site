import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Зображення', plural: 'Медіа' },
  admin: { group: 'Контент' },
  access: { read: () => true },
  upload: {
    staticDir: 'public/media',
    // EXIF видаляється автоматично: sharp не переносить метадані (розділ 19 ТЗ)
    imageSizes: [
      { name: 'thumb', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 800 },
      { name: 'hero', width: 1600 },
    ],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  },
  fields: [
    { name: 'alt', type: 'text', label: 'Опис зображення', required: true, localized: true,
      admin: { description: 'Потрібен для доступності та пошуку' } },
  ],
}
