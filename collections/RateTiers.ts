import type { CollectionConfig } from 'payload'

/** Ставка залежить від суми позики: що більша сума — то менший відсоток.
 *  Дані з внутрішньої таблиці тарифів. Пеня зберігається довідково
 *  і в розрахунках на сайті не бере участі. */
export const RateTiers: CollectionConfig = {
  slug: 'rate-tiers',
  labels: { singular: 'Ставка за сумою', plural: 'Ставки за сумою позики' },
  admin: {
    group: 'Оцінка',
    useAsTitle: 'label',
    defaultColumns: ['label', 'amountFrom', 'amountTo', 'rate', 'unit'],
    description:
      'Базова ставка до застосування знижки за статусом лояльності. '
      + 'Мінімальна ставка на сайті рахується як найменша тут мінус найбільша знижка статусу.',
  },
  access: { read: () => true },
  fields: [
    {
      name: 'label',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
      hooks: {
        beforeChange: [({ siblingData: d }) => {
          const to = d?.amountTo ? `–${d.amountTo}` : '+'
          const u = d?.unit === 'uah' ? 'грн/день' : '%/день'
          return `${d?.amountFrom ?? 0}${to} грн · ${d?.rate ?? 0} ${u}`
        }],
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'amountFrom', type: 'number', label: 'Сума позики від, грн',
          required: true, defaultValue: 0, admin: { width: '50%' },
        },
        {
          name: 'amountTo', type: 'number', label: 'до, грн',
          admin: { width: '50%', description: 'Порожньо — без верхньої межі' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'rate', type: 'number', label: 'Ставка', required: true,
          admin: { width: '50%', step: 0.01 },
        },
        {
          name: 'unit',
          type: 'select',
          label: 'Одиниця',
          required: true,
          defaultValue: 'percent',
          options: [
            { label: '% на день', value: 'percent' },
            { label: 'грн на день (фіксована)', value: 'uah' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'penalty',
      type: 'number',
      label: 'Пеня',
      admin: {
        description: 'Довідково. У розрахунку на сайті не використовується.',
        step: 0.01,
      },
    },
    { name: 'plan', type: 'text', label: 'Тарифний план', defaultValue: 'Базовий' },
    { name: 'order', type: 'number', label: 'Порядок', defaultValue: 0 },
  ],
}
