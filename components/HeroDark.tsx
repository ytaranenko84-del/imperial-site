'use client'

import { useEffect } from 'react'

/**
 * Шапка над темним першим екраном.
 *
 * Шапка липка: вона лишається на місці й тоді, коли під нею вже світлий
 * калькулятор. Тому колір їй не можна задати назавжди — поки під шапкою
 * темний екран, вона темна, далі повертається до звичайної.
 *
 * Спостерігач дивиться, чи перший екран ще перетинає смугу під шапкою.
 * Без JavaScript атрибут не з’явиться, і шапка лишиться світлою — читати
 * сторінку це не заважає.
 */
export default function HeroDark() {
  useEffect(() => {
    const hero = document.querySelector('.start')
    const top = document.querySelector('.top')
    if (!hero || !top) return

    // висота шапки береться з тієї самої змінної, що й у стилях
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 4
    const px = Math.round(h * parseFloat(getComputedStyle(document.documentElement).fontSize))

    const io = new IntersectionObserver(
      ([e]) => top.setAttribute('data-on-dark', String(e.isIntersecting)),
      { rootMargin: `-${px}px 0px 0px 0px`, threshold: 0 },
    )
    io.observe(hero)
    return () => {
      io.disconnect()
      top.removeAttribute('data-on-dark')
    }
  }, [])

  return null
}
