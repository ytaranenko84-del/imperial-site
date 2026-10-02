import type { CollectionConfig } from 'payload'

/**
 * Службовий журнал дій у Telegram-боті — окремо від реальних заявок, щоб
 * бачити воронку «натиснув старт → вибрав пункт меню → поділився номером →
 * довів до кінця», навіть для тих, хто ніколи не дійшов до номера й раніше
 * взагалі не лишав жодного сліду в базі. Рядки самі стають непотрібні за
 * пару місяців; прибирати вручну не обов'язково.
 */
export const BotEvents: CollectionConfig = {
  slug: 'bot-events',
  labels: { singular: 'Подія бота', plural: 'Дії в боті (службове)' },
  admin: { group: 'Заявки', useAsTitle: 'eventType', hidden: true },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'chatId', type: 'text', required: true, admin: { description: 'Telegram-чат, що викликав подію' } },
    { name: 'eventType', type: 'text', required: true,
      admin: { description: 'start, menu_click, contact_shared, form_completed' } },
    { name: 'payload', type: 'text', admin: { description: 'Деталі: який пункт меню, який напрямок тощо' } },
  ],
}
