'use client'

import { useEffect, useState } from 'react'

/**
 * Закриття запам'ятовується в localStorage за адресою акції: нову акцію
 * (інший slug) клієнт, який колись закрив стару, знову побачить.
 */
export default function PromoRibbonClient(
  { dismissKey, title, href, cta }: { dismissKey: string; title: string; href: string; cta: string },
) {
  const storageKey = `promoDismissed:${dismissKey}`
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === '1') setHidden(true)
    } catch {
      // приватний режим чи заблоковане сховище — просто лишаємо стрічку видимою
    }
  }, [storageKey])

  if (hidden) return null

  return (
    <div className="promo-ribbon">
      <span>🎁 <b>{title}</b></span>
      <a href={href}>{cta} →</a>
      <button
        type="button"
        aria-label="Закрити"
        className="promo-ribbon__x"
        onClick={() => {
          try { localStorage.setItem(storageKey, '1') } catch { /* нічого критичного */ }
          setHidden(true)
        }}
      >
        ✕
      </button>
    </div>
  )
}
