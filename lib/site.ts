/** Адреса сайту. Поки він живе на службовому домені, після переїзду міняється одним рядком. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SERVER_URL || 'https://imperial-lombard-ua.netlify.app'
  return raw.replace(/\/$/, '')
}
