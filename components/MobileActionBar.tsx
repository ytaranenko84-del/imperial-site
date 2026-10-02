/**
 * Липка панель дій на телефоні — «Telegram · Оцінити · Подзвонити».
 *
 * 88 % відвідувачів заходять із телефону, а сторінки сайту довгі. Без
 * постійної точки дії людина, яка догортала до середини, не має способу
 * зв'язатись, окрім прокрутки назад. Це не спливне вікно — Google знижує
 * в мобільній видачі сторінки з перекривним оверлеєм на вході, а постійний
 * елемент інтерфейсу, як шапка, під цей штраф не підпадає.
 *
 * На десктопі панель не показується — там і так видно номер у шапці.
 */
import { withLocale } from '@/lib/locale-utils.ts'
import TrackedLink from '@/components/TrackedLink.tsx'

export default function MobileActionBar({
  hotline, telegram, locale = 'uk',
}: { hotline: string; telegram?: string | null; locale?: 'uk' | 'ru' }) {
  const t = locale === 'ru'
    ? { aria: 'Быстрые действия', eval: 'Оценить', call: 'Позвонить' }
    : { aria: 'Швидкі дії', eval: 'Оцінити', call: 'Подзвонити' }
  return (
    <nav className="mabar" aria-label={t.aria}>
      {telegram ? (
        <TrackedLink location="mobile_bar_telegram" className="mabar__i mabar__tg" href={telegram} target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M21.94 4.9 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.15c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.13 12.4 2.55 10.97c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.28 2.31Z" />
          </svg>
          Telegram
        </TrackedLink>
      ) : (
        <span className="mabar__i mabar__tg mabar__i--off" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.94 4.9 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.15c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.13 12.4 2.55 10.97c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.28 2.31Z" />
          </svg>
          Telegram
        </span>
      )}

      <TrackedLink location="mobile_bar_eval" className="mabar__i mabar__main" href={withLocale('/calc', locale)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 2 20 10a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0L3 11V4a2 2 0 0 1 2-2h7Z" />
          <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
        </svg>
        {t.eval}
      </TrackedLink>

      <a className="mabar__i mabar__tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2Z" />
        </svg>
        {t.call}
      </a>
    </nav>
  )
}
