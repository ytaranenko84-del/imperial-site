import React from 'react'

/**
 * Іконки мереж у підвалі. Посилання беруться з адмінки
 * (Загальні налаштування → Контакти); константа поруч — те, що діє,
 * доки поле порожнє.
 *
 * Мережу без посилання показуємо приглушеною й без переходу: значок стоїть
 * на місці, а щойно посилання з'явиться в адмінці — стає робочим.
 */

const IG = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

const TG = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M21.94 4.9 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.15c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.13 12.4 2.55 10.97c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.28 2.31Z" />
  </svg>
)

const VB = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c4.6 0 7.5 2.5 7.5 6.6 0 4-2.9 6.6-7.5 6.6-.7 0-1.3 0-1.9-.1l-3.7 2.8.5-3.5C4.6 14.2 3.4 12 3.4 9.6 3.4 5.5 7.4 3 12 3Z" />
    <path d="M9.6 8.1c.6 1.9 2 3.3 3.9 3.9" />
  </svg>
)

const FB = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.29-.04-1.27-.13-2.41-.13-2.39 0-4.02 1.46-4.02 4.13V9.9H7.5V13h2.77v8h3.23Z" />
  </svg>
)

/** Порожнє поле в адмінці — мережі просто немає на сайті. */
const NETS = [
  { name: 'Instagram', key: 'instagram', fallback: 'https://www.instagram.com/imperial_lomb', icon: IG, hold: false },
  { name: 'Telegram', key: 'telegram', fallback: '', icon: TG, hold: true },
  { name: 'Viber', key: 'viber', fallback: '', icon: VB, hold: false },
  { name: 'Facebook', key: 'facebook', fallback: '', icon: FB, hold: false },
]

export default function Social({ settings }: { settings: Record<string, unknown> }) {
  const items = NETS.map((n) => ({ ...n, url: String(settings[n.key] || n.fallback || '') }))
    .filter((n) => n.url || n.hold)

  if (!items.length) return null

  return (
    <div className="soc">
      {items.map((n) =>
        n.url ? (
          <a key={n.name} className="soc__i" href={n.url} target="_blank" rel="noopener"
            title={n.name} aria-label={n.name}>
            {n.icon}
          </a>
        ) : (
          <span key={n.name} className="soc__i soc__i--off" title={`${n.name} — посилання додамо`}
            aria-label={`${n.name} — посилання додамо`}>
            {n.icon}
          </span>
        ),
      )}
    </div>
  )
}
