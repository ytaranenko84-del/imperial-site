import type { GlobalConfig } from 'payload'

/** Те, що існує в одному екземплярі: ставки, контакти, гарантія, графік чату. */
export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Загальні налаштування',
  admin: { group: 'Система' },
  access: { read: () => true },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Ставки й умови',
          fields: [
            { name: 'dailyRate', type: 'number', label: 'Ставка на день, %', defaultValue: 0.4, required: true },
            { name: 'maxAnnualRate', type: 'number', label: 'Максимальна річна ставка, %', defaultValue: 146 },
            { name: 'minTermDays', type: 'number', label: 'Мінімальний строк, днів', defaultValue: 5 },
            { name: 'maxTermDays', type: 'number', label: 'Максимальний строк, днів', defaultValue: 30,
              admin: { description: 'Після цього строку клієнт приходить сплатити відсотки й перезакласти річ' } },
            { name: 'valuationShare', type: 'number', label: 'Оцінка, % від ринкової', defaultValue: 80 },
            { name: 'processingMinutes', type: 'number', label: 'Оформлення, хвилин', defaultValue: 6 },
            { name: 'calcTerms', type: 'text', label: 'Строки в калькуляторі', defaultValue: '5,7,10,14,21,30',
              admin: { description: 'Через кому — кнопки вибору строку в днях' } },
            { name: 'disclaimer', type: 'textarea', label: 'Застереження під розрахунком', localized: true },
          ],
        },
        {
          label: 'Гарантія оцінки',
          fields: [
            { name: 'guaranteeOn', type: 'checkbox', label: 'Показувати гарантію', defaultValue: false,
              admin: { description: 'Вмикати лише після узгодження з юристом' } },
            { name: 'guaranteeText', type: 'textarea', label: 'Текст гарантії', localized: true,
              defaultValue: 'У відділенні ви гарантовано отримаєте суму не меншу за ту, що показала онлайн-оцінка — за умови підтвердження заявлених характеристик.' },
          ],
        },
        {
          label: 'Контакти',
          fields: [
            { name: 'hotline', type: 'text', label: 'Гаряча лінія', defaultValue: '0 800 30 85 00' },
            { name: 'email', type: 'email', label: 'Пошта', defaultValue: 'support@imperial24.com.ua' },
            { name: 'telegram', type: 'text', label: 'Telegram-бот' },
            { name: 'viber', type: 'text', label: 'Viber' },
            { name: 'instagram', type: 'text', label: 'Instagram' },
            { name: 'facebook', type: 'text', label: 'Facebook' },
            { name: 'license', type: 'text', label: 'Ліцензія НБУ', localized: true },
            { name: 'legalEntity', type: 'text', label: 'Юридична особа, ЄДРПОУ', localized: true },
          ],
        },
        {
          label: 'Чат',
          fields: [
            { name: 'chatFrom', type: 'text', label: 'Онлайн з', defaultValue: '09:00' },
            { name: 'chatTo', type: 'text', label: 'Онлайн до', defaultValue: '20:00' },
            { name: 'chatOffline', type: 'textarea', label: 'Відповідь поза графіком', localized: true,
              defaultValue: 'Ми зараз офлайн. Залиште контакт — відповімо зранку.' },
          ],
        },
      ],
    },
  ],
}
