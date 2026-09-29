import type { CollectionConfig } from 'payload'

/**
 * Службовий журнал для захисту публічних форм від напливу — окремо від самих
 * заявок, щоб рахувати і по IP, і по формі, яка взагалі нічого не зберігає
 * (наприклад /api/push/subscribe). Рядки самі стають непотрібні за годину;
 * прибирати їх вручну не обов'язково, вони не важать для роботи сайту.
 */
export const RateLimitHits: CollectionConfig = {
  slug: 'rate-limit-hits',
  labels: { singular: 'Хіт ліміту запитів', plural: 'Ліміти запитів (службове)' },
  admin: { group: 'Заявки', useAsTitle: 'scope', hidden: true },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'scope', type: 'text', required: true, admin: { description: 'Яка форма: eval-requests, bookings, push-subscribe' } },
    { name: 'ip', type: 'text' },
    { name: 'phone', type: 'text' },
  ],
}
