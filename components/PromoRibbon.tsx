import { getActivePromo } from '@/lib/data.ts'
import { withLocale } from '@/lib/locale-utils.ts'
import PromoRibbonClient from '@/components/PromoRibbonClient'

const CTA = { uk: 'Умови акції', ru: 'Условия акции' }

/**
 * Стрічка над шапкою для активної акції (News.pinnedOnHome). Сама зникає,
 * щойно акцію знімають з позначки чи переносять в архів — окремого вимикача
 * в коді не потрібно.
 */
export default async function PromoRibbon({ locale = 'uk' }: { locale?: 'uk' | 'ru' }) {
  const promo = await getActivePromo(locale)
  if (!promo) return null

  return (
    <PromoRibbonClient
      dismissKey={promo.slug}
      title={promo.title}
      href={withLocale(`/novyny/${promo.slug}`, locale)}
      cta={CTA[locale]}
    />
  )
}
