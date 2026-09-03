'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Меню сайту.
 *
 * На широкому екрані — рядок посилань. На телефоні рядок не вміщається, і досі
 * там не було нічого: жодного способу перейти в інший розділ. Тому кнопка й
 * панель на весь екран — з телефонів приходить більшість відвідувачів.
 */

export type NavItem = { href: string; label: string }

export default function Nav({ items, hotline }: { items: NavItem[]; hotline: string }) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // Поки меню відкрите, сторінка під ним не гортається
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.querySelector('a')?.focus()
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <nav className="nav">
        {items.map((i) => <a key={i.href} href={i.href}>{i.label}</a>)}
      </nav>

      <button
        ref={btnRef}
        type="button"
        className="burger"
        aria-label={open ? 'Закрити меню' : 'Меню'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={`burger__i${open ? ' burger__i--x' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="mnav" ref={panelRef} role="dialog" aria-modal="true" aria-label="Меню">
          <div className="mnav__links">
            {items.map((i) => (
              <a key={i.href} href={i.href} onClick={() => setOpen(false)}>{i.label}</a>
            ))}
          </div>
          <a className="mnav__tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
            {hotline}
            <span>Цілодобово · безкоштовно</span>
          </a>
        </div>
      )}
    </>
  )
}
