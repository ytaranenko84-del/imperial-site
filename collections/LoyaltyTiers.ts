import type { CollectionConfig } from 'payload'

/** Статуси лояльності. Дані з таблиці програми лояльності.
 *  Надбавка до металу застосовується до базової ціни в калькуляторі. */
export const LoyaltyTiers: CollectionConfig = {
  slug: 'loyalty-tiers',
  labels: { singular: 'Статус лояльності', plural: 'Програма лояльності' },
  admin: {
    group: 'Оцінка',
    defaultColumns: ['name', 'amountFrom', 'amountTo', 'metalBonus', 'techBonus', 'discount'],
    useAsTitle: 'name',
    description: 'Надбавки застосовуються до базової ціни з розділу «Тарифи за грам».',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', label: 'Назва статусу', required: true, localized: true },
    { name: 'color', type: 'text', label: 'Колір позначки', defaultValue: '#3E9C74',
      admin: { description: 'HEX для мітки в калькуляторі' } },
    {
      type: 'row',
      fields: [
        { name: 'amountFrom', type: 'number', label: 'Від, грн', required: true, defaultValue: 0,
          admin: { width: '50%', description: 'Сума сплачених відсотків' } },
        { name: 'amountTo', type: 'number', label: 'До, грн', admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'metalBonus', type: 'number', label: 'Надбавка до драгметалу, %', required: true,
          defaultValue: 0, admin: { width: '50%' } },
        { name: 'techBonus', type: 'number', label: 'Надбавка до техніки, %', defaultValue: 0,
          admin: { width: '50%' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'discount', type: 'number', label: 'Знижка на відсотки, %', defaultValue: 0,
          admin: { width: '50%' } },
        { name: 'cashback', type: 'number', label: 'На бонусний рахунок, %', defaultValue: 0,
          admin: { width: '50%' } },
      ],
    },
    {
      name: 'silverBonus',
      type: 'number',
      label: 'Надбавка до срібла, %',
      admin: {
        description: 'Заповнювати, лише якщо для срібла відсоток інший, ніж для золота. '
          + 'У прайсі 24.08.2026 Рубіновий по сріблу дає +5%, а не +10% — потребує підтвердження.',
      },
    },
    { name: 'order', type: 'number', label: 'Порядок', defaultValue: 0 },
    { name: 'publicName', type: 'checkbox', label: 'Показувати на сайті', defaultValue: true },
  ],
}
