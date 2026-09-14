import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Українська лишається без префіксу — усі вже наявні адреси (/calc,
 * /viddilennya, /pro-nas...) не рухаються й нічого не ламають. Російська
 * додається зверху через /ru: та сама сторінка, той самий файл, просто
 * позначка мовою в заголовку, яку читає getLocale() у Server Component.
 *
 * Тут саме rewrite, а не redirect: у адресному рядку лишається /ru/calc,
 * а Next віддає файл, що лежить за /calc, з поміткою locale=ru.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname !== '/ru' && !pathname.startsWith('/ru/')) return NextResponse.next()

  const path = pathname.slice(3) || '/'
  const url = req.nextUrl.clone()
  url.pathname = path

  const headers = new Headers(req.headers)
  headers.set('x-locale', 'ru')
  return NextResponse.rewrite(url, { request: { headers } })
}

export const config = {
  matcher: ['/((?!_next|api|admin|.*\\..*).*)'],
}
