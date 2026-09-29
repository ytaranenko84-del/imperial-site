import type { CollectionConfig } from 'payload'

/**
 * Швидкі відповіді для Telegram-бота.
 *
 * У Reply на заявку співробітник пише «код. текст» — наприклад «2. 1200-1400грн».
 * Бот знаходить шаблон за кодом і, якщо в тексті є {сума}, підставляє замість
 * неї те, що написано після крапки. Без крапки (гола цифра, що збігається
 * з кодом) — попереджає співробітника, а не шле недописане клієнту.
 */
export const ReplyTemplates: CollectionConfig = {
  slug: 'reply-templates',
  labels: { singular: 'Шаблон відповіді', plural: 'Шаблони відповідей' },
  admin: {
    group: 'Заявки',
    useAsTitle: 'title',
    defaultColumns: ['code', 'title', 'order'],
    description: 'Швидкі відповіді клієнтам через бота. Команда /шаблони в боті показує весь список.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'code', type: 'text', label: 'Код', required: true, unique: true,
          admin: { description: 'Що писати в Reply перед крапкою, наприклад «2»' } },
        { name: 'title', type: 'text', label: 'Назва для себе', required: true },
        { name: 'order', type: 'number', label: 'Порядок', defaultValue: 0 },
      ],
    },
    {
      name: 'text', type: 'textarea', label: 'Текст', required: true,
      admin: { description: 'Місце {сума} — куди підставиться те, що співробітник допише після коду. '
        + 'Наприклад: «2. 1200-1400грн» підставить «1200-1400грн» замість {сума}' },
    },
  ],
}
