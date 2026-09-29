import type { Branch } from '@/lib/data.ts'
import { siteUrl } from '@/lib/site.ts'

/**
 * Розмітка для пошуковика — те, з чого він будує картку організації у видачі:
 * адреси відділень, графік, телефон, ціни. Людина цього не бачить.
 *
 * Тип PawnShop у довіднику schema.org існує окремо від «організації взагалі»,
 * і саме він дає в результатах пошуку графік і кнопку «Подзвонити».
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * Дані в блок розмітки. Кутова дужка перетворюється на escape-послідовність:
 * інакше адреса з «</script>», введена в адмінці, розірвала б блок і поїхала
 * б у розмітку сторінки як код.
 */
const ld = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')

function hoursOf(b: Branch) {
  if (b.roundClock) {
    return [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS, opens: '00:00', closes: '23:59' }]
  }
  if (!b.openTime || !b.closeTime) return undefined
  return [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS, opens: b.openTime, closes: b.closeTime }]
}

function branchNode(b: Branch, hotline: string, base: string, locale: 'uk' | 'ru') {
  return {
    '@type': 'PawnShop',
    '@id': `${base}/#branch-${b.id}`,
    name: `${locale === 'ru' ? 'Ломбард «Империал»' : 'Ломбард «Імперіал»'} — ${b.displayAddress || b.address}`,
    telephone: b.phone || hotline,
    address: {
      '@type': 'PostalAddress',
      streetAddress: b.address,
      addressLocality: b.city.name,
      addressCountry: 'UA',
    },
    ...(b.lat != null && b.lng != null
      ? { geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng } }
      : {}),
    ...(hoursOf(b) ? { openingHoursSpecification: hoursOf(b) } : {}),
    parentOrganization: { '@id': `${base}/#org` },
  }
}

export function OrganizationSchema({
  branches, hotline, minRate, locale = 'uk', includeBranches = false,
}: {
  branches: Branch[]; hotline: string; minRate: string; locale?: 'uk' | 'ru'
  /** Повний список відділень окремими вузлами PawnShop — важить ~18 КБ на 28
   *  відділень. Потрібен лише на сторінці відділень; на головній і решті
   *  сторінок досить організації без дубля цієї розмітки. */
  includeBranches?: boolean
}) {
  const base = siteUrl()
  const cityNames = [...new Set(branches.map((b) => b.city?.name).filter(Boolean))] as string[]
  const citiesLabel = cityNames.length > 1
    ? (locale === 'ru' ? `${cityNames.length} городах` : `${cityNames.length} містах`)
    : (cityNames[0] || (locale === 'ru' ? 'Днепре' : 'Дніпрі'))

  const graph = [
    {
      '@type': 'Organization',
      '@id': `${base}/#org`,
      name: locale === 'ru' ? 'Ломбард «Империал»' : 'Ломбард «Імперіал»',
      url: base,
      logo: `${base}/logo.png`,
      telephone: hotline,
      foundingDate: '2008',
      areaServed: cityNames.length
        ? cityNames.map((name) => ({ '@type': 'City', name }))
        : { '@type': 'City', name: locale === 'ru' ? 'Днепр' : 'Дніпро' },
      sameAs: ['https://www.instagram.com/imperial_lomb'],
      description: locale === 'ru'
        ? `Сеть ломбардов «Империал» в ${citiesLabel}: ${branches.length} отделений, `
          + `оценка золота, серебра и техники, ставка от ${minRate}% в день.`
        : `Мережа ломбардів «Імперіал» у ${citiesLabel}: ${branches.length} відділень, `
          + `оцінка золота, срібла й техніки, ставка від ${minRate}% на день.`,
    },
    ...(includeBranches ? branches.map((b) => branchNode(b, hotline, base, locale)) : []),
  ]

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: ld({ '@context': 'https://schema.org', '@graph': graph }) }}
    />
  )
}

export function FaqSchema({ items }: { items: { q: string; a: string }[] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(data) }} />
}

export function BreadcrumbSchema({ items }: { items: { name: string; href: string }[] }) {
  const base = siteUrl()
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${base}${it.href}`,
    })),
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(data) }} />
}
