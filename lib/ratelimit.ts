import type { getPayload } from 'payload'

/**
 * Захист форм від напливу.
 *
 * Сервер без пам'яті між запитами — лічильник у змінній тут не працює, тож
 * рахуємо вже збережені заявки. Це трохи дорожче за запит у пам'ять, зате
 * переживає перезапуск і рахує однаково на всіх копіях застосунку.
 *
 * Навіщо: кожна заявка йде карткою з фотографіями в Telegram оцінювачам.
 * Скрипт без обмеження за хвилину завалив би і адмінку, і робочі чати.
 */

export type Limits = {
  /** Скільки заявок з одного номера за годину */
  perPhone: number
  /** Скільки заявок узагалі за десять хвилин */
  perSite: number
}

export async function tooManyRequests(
  payload: Awaited<ReturnType<typeof getPayload>>,
  collection: 'eval-requests' | 'bookings',
  phone: string,
  limits: Limits,
): Promise<string | null> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  try {
    const digits = phone.replace(/\D/g, '').slice(-9)
    if (digits) {
      const { totalDocs } = await payload.count({
        collection,
        overrideAccess: true,
        where: {
          and: [
            { phone: { like: digits } },
            { createdAt: { greater_than: hourAgo } },
          ],
        },
      })
      if (totalDocs >= limits.perPhone) {
        return 'З цього номера вже прийнято кілька заявок. Ми зв’яжемось найближчим часом.'
      }
    }

    const { totalDocs: recent } = await payload.count({
      collection,
      overrideAccess: true,
      where: { createdAt: { greater_than: tenMinAgo } },
    })
    if (recent >= limits.perSite) {
      return 'Зараз надто багато звернень. Спробуйте, будь ласка, за кілька хвилин.'
    }
  } catch {
    // Перевірка не має ставати причиною відмови в заявці
    return null
  }
  return null
}
