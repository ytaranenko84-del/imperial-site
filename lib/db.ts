/**
 * Вибір бази даних за середовищем.
 *
 * 1. DATABASE_URL заданий вручну — беремо його (свій сервер, Supabase тощо).
 * 2. Платформа сама віддає підключення — беремо його.
 * 3. Локально — файл SQLite поруч із проєктом, жодних установок.
 *
 * Ознаку Netlify через process.env перевіряти не можна: під час збірки вона є,
 * а в рантаймі функцій — ні. Тому просто пробуємо отримати підключення.
 */
export async function resolveDatabaseUrl(): Promise<string | null> {
  const manual =
    process.env.DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.NETLIFY_DATABASE_URL_UNPOOLED
  if (manual) return manual

  try {
    const { getConnectionString } = await import('@netlify/database')
    const url = getConnectionString()
    if (url) return url
  } catch {
    // пакет недоступний або бази немає — працюємо на SQLite
  }

  return null
}
