/**
 * Вибір бази даних за середовищем.
 *
 * 1. DATABASE_URL заданий вручну — беремо його (свій сервер, Supabase тощо).
 * 2. Працюємо на Netlify — база створюється й підключається автоматично,
 *    рядок підключення віддає сама платформа. Нічого налаштовувати не треба.
 * 3. Локально — файл SQLite поруч із проєктом, жодних установок.
 */
export async function resolveDatabaseUrl(): Promise<string | null> {
  const manual = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL
  if (manual) return manual

  // На Netlify підключення надає платформа. Поза нею пакет недоступний —
  // тому імпорт динамічний і помилка не ламає локальний запуск.
  if (process.env.NETLIFY || process.env.NETLIFY_LOCAL) {
    try {
      const { getConnectionString } = await import('@netlify/database')
      const url = getConnectionString()
      if (url) return url
    } catch {
      // пакет або база недоступні — падаємо на SQLite нижче
    }
  }

  return null
}
