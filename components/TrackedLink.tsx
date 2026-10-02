'use client'

import type { AnchorHTMLAttributes } from 'react'
import { trackCta } from '@/lib/analytics.ts'

/**
 * Звичайне посилання, що перед переходом лишає слід у GA4. Існує окремим
 * маленьким клієнтським компонентом, щоб сторінки навколо (головна,
 * категорії) лишались статичними — не переводити всю сторінку в клієнтську
 * заради однієї кнопки.
 */
export default function TrackedLink({
  location,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { location: string }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        trackCta(location)
        onClick?.(e)
      }}
    />
  )
}
