import type { CollectionConfig } from 'payload'

/** Тариф за грам. Дані беруться з файла «прайс золото_срібло».
 *  У прайсі зберігаються лише ДВІ цифри: скупка та базова ціна.
 *  Ціни за статусами рахуються автоматично: базова × (1 + надбавка статусу).
 *  Перевірено на прайсі 24.08.2026: 585° базова 3200 →
 *  Новий 3360 (+5%), Смарагдовий 3296 (+3%), Рубіновий 3520 (+10%), Діамантовий 3840 (+20%). */
export const Tariffs: CollectionConfig = {
  slug: 'tariffs',
  labels: { singular: 'Тариф за грам', plural: 'Тарифи за грам' },
  admin: {
    group: 'Оцінка',
    defaultColumns: ['label', 'metal', 'purity', 'basePrice', 'purchasePrice', 'active'],
    useAsTitle: 'label',
    description: 'Скупка й базова ціна. Ціни за статусами рахуються автоматично з надбавок у розділі «Програма лояльності».',
    components: {
      beforeListTable: ['/components/PriceUpload#PriceUpload'],
    },
  },
  access: { read: () => true },
  fields: [
    {
      name: 'label',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
      hooks: {
        beforeChange: [({ data }) => {
          const m = data?.metal === 'silver' ? 'Срібло' : 'Золото'
          return `${m} ${data?.purityLabel || data?.purity || ''}`.trim()
        }],
      },
    },
    {
      name: 'metal',
      type: 'select',
      label: 'Метал',
      required: true,
      defaultValue: 'gold',
      options: [
        { label: 'Золото', value: 'gold' },
        { label: 'Срібло', value: 'silver' },
      ],
    },
    {
      name: 'purity',
      type: 'number',
      label: 'Проба',
      admin: { description: 'Число для сортування й розрахунку: 999, 750, 585, 925…' },
    },
    {
      name: 'purityLabel',
      type: 'text',
      label: 'Назва проби',
      required: true,
      admin: { description: 'Як показувати клієнту: «585», «925, 875 (1 кат)», «столове срібло»' },
    },
    {
      name: 'purchasePrice',
      type: 'number',
      label: 'Скупка, грн/г',
      admin: {
        description: 'Ціна викупу назавжди. У прайсі — колонка «Покупка». Для срібла не вказується.',
        step: 0.01,
      },
    },
    {
      name: 'basePrice',
      type: 'number',
      label: 'Базова ціна, грн/г',
      required: true,
      admin: {
        description: 'Головна цифра. Від неї рахуються всі статуси.',
        step: 0.01,
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Примітка',
      localized: true,
      admin: { description: 'Наприклад, що відноситься до 1 та 2 категорії срібла' },
    },
    { name: 'active', type: 'checkbox', label: 'Показувати в калькуляторі', defaultValue: true },
    { name: 'order', type: 'number', label: 'Порядок', defaultValue: 0 },
    {
      name: 'approvedAt',
      type: 'date',
      label: 'Затверджено',
      admin: { position: 'sidebar', description: 'Дата прайсу, з якого взято цифри' },
    },
  ],
}
