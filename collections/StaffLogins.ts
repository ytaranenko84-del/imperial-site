import type { CollectionConfig } from 'payload'

/**
 * Одноразові токени входу на робочий стіл через бота: браузер створює
 * запис і чекає, поки співробітник підтвердить вхід кнопкою в Telegram.
 * Короткоживуча службова таблиця — адмінка сюди не заглядає.
 */
export const StaffLogins: CollectionConfig = {
  slug: 'staff-logins',
  labels: { singular: 'Вхід на робочий стіл', plural: 'Входи на робочий стіл' },
  admin: { group: 'Система', hidden: true },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'token', type: 'text', required: true, unique: true, index: true },
    { name: 'status', type: 'select', defaultValue: 'pending',
      options: [
        { label: 'Очікує', value: 'pending' },
        { label: 'Підтверджено', value: 'confirmed' },
        { label: 'Використано', value: 'used' },
      ] },
    { name: 'recipient', type: 'relationship', relationTo: 'recipients' },
    /*
     * Захист від фішингу «підтвердіть вхід»: зловмисник теж може відкрити
     * сторінку входу й переслати посилання на бота комусь із співробітників.
     * Код показується і в браузері, і в повідомленні бота — підтверджувати
     * можна, лише коли вони збігаються, а verifier у cookie не дає забрати
     * готову сесію, підгледівши сам токен (він летить у посиланні бота).
     */
    { name: 'code', type: 'text' },
    { name: 'verifier', type: 'text' },
    { name: 'ip', type: 'text' },
    { name: 'userAgent', type: 'text' },
  ],
}
