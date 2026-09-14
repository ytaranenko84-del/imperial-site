/** Чисті функції без серверних імпортів — безпечно використовувати і в клієнтських компонентах. */

/** Адреса тієї самої сторінки іншою мовою — для метаданих і серверних посилань. */
export function withLocale(path: string, locale: 'uk' | 'ru'): string {
  const clean = path === '/' ? '' : path
  return locale === 'ru' ? `/ru${clean}` : (clean || '/')
}

/** Пара адрес поточної сторінки: українська й російська версії того самого шляху. */
export function localePair(pathname: string, current: 'uk' | 'ru') {
  const bare = current === 'ru' ? pathname.replace(/^\/ru(\/|$)/, '/') : pathname
  const uk = bare === '' ? '/' : bare
  const ru = `/ru${uk === '/' ? '' : uk}`
  return { uk, ru }
}
