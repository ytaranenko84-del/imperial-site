import type { GlobalConfig } from 'payload'

/** Посилання на мережі приймаємо тільки http(s): решта схем на сторінці небезпечна. */
const link = (value: string | null | undefined) =>
  !value || /^https?:\/\//i.test(value.trim())
    ? true
    : 'Посилання має починатися з https://'

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
            { name: 'bonusWeightLimit', type: 'number', label: 'Надбавка статусу діє до, г', defaultValue: 20,
              admin: { description: 'Понад цю вагу виріб оцінюється за звичайним прайсом, без надбавки статусу. '
                + 'Порожнє поле або 0 — обмеження немає. Знижка на відсотки діє завжди.' } },
            { name: 'bonusWeightPurity', type: 'number', label: '…для проби', defaultValue: 585,
              admin: { description: 'Проба, для якої задано межу. Для інших проб межа перераховується '
                + 'за вмістом золота: 20 г 585-ї = 11,7 г 999-ї = 31,2 г 375-ї.' } },
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
            { name: 'telegram', type: 'text', label: 'Telegram-бот', validate: link },
            { name: 'viber', type: 'text', label: 'Viber', validate: link },
            { name: 'instagram', type: 'text', label: 'Instagram', validate: link },
            { name: 'facebook', type: 'text', label: 'Facebook', validate: link },
            { name: 'botUsername', type: 'text', label: 'Ім’я бота', defaultValue: 'imperialzajavka_bot',
              admin: { description: 'Без @. Потрібне для посилання «Отримати відповідь у Telegram»' } },
            { name: 'telegramChatDefault', type: 'text', label: 'Загальний Telegram-чат',
              admin: { description: 'Сюди йдуть заявки, якщо у відділення чат не заданий. '
                + 'Токен бота зберігається в налаштуваннях хостингу, не тут' } },
            { name: 'reviewChat', type: 'text', label: 'Спільна група оцінок',
              admin: { readOnly: true, description: 'Заповнюється сама, коли бота додають у групу. '
                + 'Туди йде копія кожної оціненої заявки — без телефона й імені клієнта' } },
            { name: 'reviewChatTitle', type: 'text', label: 'Назва групи', admin: { readOnly: true } },
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
