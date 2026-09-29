import type { getPayload } from 'payload'

/**
 * Захист форм від напливу.
 *
 * Сервер без пам'яті між запитами — лічильник у змінній тут не працює, тож
 * рахуємо хіти в окремій таблиці. Три незалежні межі: з одного номера
 * телефону (де він є), з однієї IP-адреси, і всього на форму — без перевірки
 * по IP досить просто щоразу підставляти новий номер телефону, щоб обійти
 * ліміт «з одного номера», а спільний ліміт «на всю форму» без цього ж сам
 * стає зброєю: один повільний скрипт тримає його заповненим і блокує форму
 * геть усім справжнім клієнтам.
 */

export type Limits = {
  /** Скільки за годину з одного номера телефону (форми без телефону — пропускають) */
  perPhone?: number
  /** Скільки за десять хвилин з однієї IP */
  perIp: number
  /** Скільки за десять хвилин узагалі на цю форму */
  perSite: number
}

type Identity = { phone?: string; ip?: string }

export async function tooManyRequests(
  payload: Awaited<ReturnType<typeof getPayload>>,
  scope: string,
  identity: Identity,
  limits: Limits,
): Promise<string | null> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  try {
    const digits = identity.phone ? identity.phone.replace(/\D/g, '').slice(-9) : ''
    if (digits && limits.perPhone) {
      const { totalDocs } = await payload.count({
        collection: 'rate-limit-hits', overrideAccess: true,
        where: {
          and: [
            { scope: { equals: scope } },
            { phone: { equals: digits } },
            { createdAt: { greater_than: hourAgo } },
          ],
        },
      })
      if (totalDocs >= limits.perPhone) {
        return 'З цього номера вже прийнято кілька заявок. Ми зв’яжемось найближчим часом.'
      }
    }

    if (identity.ip) {
      const { totalDocs } = await payload.count({
        collection: 'rate-limit-hits', overrideAccess: true,
        where: {
          and: [
            { scope: { equals: scope } },
            { ip: { equals: identity.ip } },
            { createdAt: { greater_than: tenMinAgo } },
          ],
        },
      })
      if (totalDocs >= limits.perIp) {
        return 'Забагато запитів з вашої мережі. Спробуйте, будь ласка, за кілька хвилин.'
      }
    }

    const { totalDocs: recent } = await payload.count({
      collection: 'rate-limit-hits', overrideAccess: true,
      where: { and: [{ scope: { equals: scope } }, { createdAt: { greater_than: tenMinAgo } }] },
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

/** Пише хіт лічильника. Викликати одразу після tooManyRequests, коли форма приймається. */
export async function recordHit(
  payload: Awaited<ReturnType<typeof getPayload>>,
  scope: string,
  identity: Identity,
) {
  try {
    await payload.create({
      collection: 'rate-limit-hits', overrideAccess: true,
      data: {
        scope,
        ...(identity.phone ? { phone: identity.phone.replace(/\D/g, '').slice(-9) } : {}),
        ...(identity.ip ? { ip: identity.ip } : {}),
      },
    })
  } catch {
    // Хіт не критичний — головне, щоб сама заявка не постраждала
  }
}

/** IP клієнта з заголовків: Netlify підставляє свій, інакше — перший з x-forwarded-for. */
export function clientIp(req: Request): string {
  const nf = req.headers.get('x-nf-client-connection-ip')
  if (nf) return nf
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return ''
}
