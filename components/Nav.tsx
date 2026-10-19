'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { localePair, withLocale } from '@/lib/locale-utils.ts'
import { trackCta } from '@/lib/analytics.ts'

/**
 * Меню сайту.
 *
 * На широкому екрані — рядок посилань. На телефоні рядок не вміщається, і досі
 * там не було нічого: жодного способу перейти в інший розділ. Тому кнопка й
 * панель на весь екран — з телефонів приходить більшість відвідувачів.
 */

export type NavItem = { href: string; label: string }

export default function Nav({ items, hotline, locale = 'uk' }: { items: NavItem[]; hotline: string; locale?: 'uk' | 'ru' }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [panelTop, setPanelTop] = useState<number | null>(null)

  /*
   * Панель починається там, де шапка закінчується насправді. Стрічка акції
   * над шапкою зсуває її вниз на свою висоту (на вузькому екрані — два-три
   * рядки), і з фіксованим відступом перший пункт меню залазив під логотип.
   * Міряємо до показу кадру, щоб панель не смикалась.
   */
  useLayoutEffect(() => {
    if (!open) return
    const header = btnRef.current?.closest('header')
    if (!header) return
    const measure = () => setPanelTop(Math.max(0, Math.round(header.getBoundingClientRect().bottom)))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

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
        {items.map((i) => (
          <a key={i.href} href={withLocale(i.href, locale)} onClick={() => { if (i.href === '/calc') trackCta('nav') }}>
            {i.label}
          </a>
        ))}
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

      {open && createPortal(
        <div className="mnav" ref={panelRef} role="dialog" aria-modal="true" aria-label="Меню" style={panelTop != null ? { top: panelTop } : undefined}>
          <div className="mnav__links">
            {items.map((i) => (
              <a key={i.href} href={withLocale(i.href, locale)} onClick={() => { setOpen(false); if (i.href === '/calc') trackCta('nav_mobile') }}>
                {i.label}
              </a>
            ))}
          </div>
          <a className="mnav__tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
            {hotline}
            <span>Цілодобово · безкоштовно</span>
          </a>
          <div className="mnav__lang" role="group" aria-label={locale === 'ru' ? 'Язык страницы' : 'Мова сторінки'}>
            {(() => {
              const { uk, ru } = localePair(pathname, locale)
              return (
                <>
                  <a href={uk} aria-current={locale === 'uk' ? 'true' : undefined}>Українська</a>
                  <a href={ru} aria-current={locale === 'ru' ? 'true' : undefined}>Русский</a>
                </>
              )
            })()}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
