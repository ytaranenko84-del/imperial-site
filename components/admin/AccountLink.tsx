import React from 'react'
import Link from 'next/link'

/**
 * Посилання на власний профіль у бічному меню. Там міняється пароль,
 * але сама сторінка схована під аватаром у кутку — знайти її важко.
 */
export default function AccountLink() {
  return (
    <Link
      href="/admin/account"
      className="nav__link"
      style={{
        display: 'flex', alignItems: 'center', gap: '.5rem',
        padding: '.5rem .25rem', textDecoration: 'none', fontSize: '.85rem',
      }}
    >
      <span aria-hidden="true">🔑</span>
      <span>Мій профіль і пароль</span>
    </Link>
  )
}
