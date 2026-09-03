import type { CollectionConfig } from 'payload'
import sharp from 'sharp'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Зображення', plural: 'Медіа' },
  admin: { group: 'Контент' },
  access: { read: () => true },
  hooks: {
    /**
     * Знімок із телефона несе в собі координати місця зйомки — тобто домівку
     * клієнта, який фотографує річ на оцінку. Зменшені копії метаданих не
     * мають, але оригінал раніше лягав у сховище байт у байт, разом із GPS,
     * і був доступний за прямим посиланням.
     *
     * Тому оригінал перезбирається: sharp за замовчуванням метадані не
     * переносить. rotate() без аргументів застосовує поворот із EXIF до того,
     * як той зникне, — інакше вертикальні фото лягали б набік.
     */
    beforeOperation: [
      async ({ req, operation }) => {
        if (operation !== 'create' && operation !== 'update') return
        const file = req.file
        if (!file?.data || !file.mimetype?.startsWith('image/')) return
        try {
          const clean = await sharp(file.data).rotate().toBuffer()
          file.data = clean
          file.size = clean.length
        } catch {
          // Не картинка або пошкоджений файл — хай далі розбирається Payload
        }
      },
    ],
  },
  upload: {
    staticDir: 'public/media',
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
