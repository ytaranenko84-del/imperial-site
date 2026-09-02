'use client'
import React, { useEffect } from 'react'

/**
 * Подвійний клац по рядку списку відкриває запис.
 *
 * Payload за замовчуванням відкриває запис лише через посилання в першій
 * колонці, і це неочевидно: люди клацають будь-де в рядку й нічого не
 * відбувається. Обробник висить на документі, тож працює в усіх списках
 * без правок кожної колекції.
 */
export default function RowOpen({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    const onDouble = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      // не заважаємо тому, що вже клікабельне, і виділенню тексту в полях
      if (target.closest('a, button, input, select, textarea, [role="button"]')) return
      if ((window.getSelection()?.toString() || '').length > 0) return

      const row = target.closest('tbody tr')
      if (!row) return

      const link = row.querySelector<HTMLAnchorElement>('a[href*="/admin/collections/"]')
      if (!link) return

      e.preventDefault()
      link.click()
    }

    document.addEventListener('dblclick', onDouble)
    return () => document.removeEventListener('dblclick', onDouble)
  }, [])

  // провайдер зобов'язаний пропускати через себе все дерево адмінки
  return <>{children}</>
}
