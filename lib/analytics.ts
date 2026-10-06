/**
 * Одна крапка виходу в GA4 для всіх форм. Якщо лічильник не завантажений
 * (Measurement ID ще не заданий в адмінці) — виклик просто нічого не робить,
 * форма від цього не ламається.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackLead(method: string) {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'generate_lead', { method })
}

/** Клік по кнопці «Оцінка» чи переходу в Telegram — ще до будь-якої форми. */
export function trackCta(location: string) {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'cta_click', { location })
}

/**
 * Початок заповнення форми — рівно один раз за сесію форми, інакше кожне
 * наступне поле рахувалося б як нова «спроба» і перекручувало воронку.
 *
 * Назва навмисне НЕ "form_start" — GA4 сам, без жодного коду тут, стежить
 * за будь-якою формою на сайті (Enhanced measurement) і шле подію з рівно
 * такою самою назвою. Однакові імена злились би в одну цифру без способу
 * їх розрізнити заднім числом.
 */
export function trackFormStart(form: string) {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'lead_form_start', { form })
}

/** Промайданий крок усередині форми (напр. дійшов до фото) — теж один раз. */
export function trackFormStep(form: string, step: string) {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'form_step', { form, step })
}

/** Калькулятор показав реальну суму — до того, як натиснули «Забронювати». */
export function trackCalcUsed() {
  if (typeof window === 'undefined') return
  window.gtag?.('event', 'calc_used')
}
