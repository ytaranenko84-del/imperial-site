import type { CollectionConfig } from 'payload'
import sharp from 'sharp'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Зображення', plural: 'Медіа' },
  admin: { group: 'Контент' },
  /*
   * За замовчуванням файл приватний: у цій колекції лежать фотографії речей,
   * які клієнти надсилають на оцінку, і будь-хто не повинен їх бачити чи
   * перелічувати. Але сюди ж завантажують обкладинки новин та акцій —
   * а вони мають бути видні всім відвідувачам сайту. Прапорець `public`
   * розділяє ці два випадки; News.ts сам ставить його, коли файл обирають
   * обкладинкою, — вручну чіпати це поле не потрібно.
   */
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return { public: { equals: true } }
    },
  },
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
          // Ім'я файла стає випадковим: сховище віддає файли за прямим
          // посиланням, і «photo-1.jpg» підбирається з першої спроби.
          const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg').toLowerCase()
          file.name = `${crypto.randomUUID().replace(/-/g, '')}${ext}`
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
    {
      name: 'public', type: 'checkbox', label: 'Публічне зображення', defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Вмикається сам, коли файл обирають обкладинкою новини чи акції. '
          + 'Вручну вмикайте, лише якщо картинка повинна бути видна на сайті без публікації через новини.',
      },
    },
  ],
}
