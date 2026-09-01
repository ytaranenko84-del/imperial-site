'use client'
import { useEffect } from 'react'

/**
 * Рух при прокручуванні. Без бібліотек: IntersectionObserver + CSS-перехід.
 *
 * Розмітка нічого не знає про цей файл — достатньо атрибутів:
 *   data-reveal        — блок спливає знизу, коли потрапляє в екран
 *   data-reveal-group  — те саме для дітей, по черзі хвилею
 *   data-count="26"    — число дораховується від нуля
 *
 * Ховає блоки лише клас .motion на <html>, який ставить вбудований скрипт
 * у layout. Без JavaScript і за «зменшити рух» сторінка лишається звичайною.
 */

const STEP = 60      // затримка між сусідніми картками, мс
const COUNT_MS = 1200 // тривалість дорахунку

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

function runCount(el: HTMLElement) {
  const target = Number(el.dataset.count)
  if (!Number.isFinite(target)) return
  const dec = (el.dataset.count || '').includes('.') ? 1 : 0
  const t0 = performance.now()
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / COUNT_MS)
    const v = target * easeOut(p)
    el.textContent = v.toLocaleString('uk-UA', {
      minimumFractionDigits: dec, maximumFractionDigits: dec,
    })
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export default function Motion() {
  useEffect(() => {
    const root = document.documentElement
    if (!root.classList.contains('motion')) return

    // діти груп спливають по черзі
    document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((g) => {
      Array.from(g.children).forEach((child, i) => {
        const el = child as HTMLElement
        el.setAttribute('data-reveal', '')
        el.style.transitionDelay = `${Math.min(i, 8) * STEP}ms`
      })
    })

    const counters = document.querySelectorAll<HTMLElement>('[data-count]')
    counters.forEach((el) => { el.textContent = '0' })

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        el.classList.add('is-in')
        if (el.dataset.count != null) runCount(el)
        io.unobserve(el)  // один раз: назад прокрутили — блоки не мигають
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el))
    counters.forEach((el) => io.observe(el))

    return () => io.disconnect()
  }, [])

  return null
}
