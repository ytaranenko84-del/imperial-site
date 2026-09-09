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
