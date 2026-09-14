import { headers } from 'next/headers'

/**
 * Мова поточного запиту — middleware.ts проставляє заголовок x-locale=ru
 * для адрес під /ru. Немає заголовка — українська, вона за замовчуванням.
 *
 * Тільки для Server Component: next/headers у клієнтському коді не працює.
 * Чисті хелпери для посилань — lib/locale-utils.ts.
 */
export async function getLocale(): Promise<'uk' | 'ru'> {
  const h = await headers()
  return h.get('x-locale') === 'ru' ? 'ru' : 'uk'
}
