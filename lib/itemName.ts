/**
 * Назва речі з марки й моделі. Клієнти часто вписують марку й у модель
 * («Iphone» + «iPhone 14 Pro Max») — тоді лишаємо лише модель, без повтору.
 */
export function itemName(brand: unknown, model: unknown): string {
  const b = String(brand || '').trim()
  const m = String(model || '').trim()
  if (b && m.toLowerCase().startsWith(b.toLowerCase())) return m
  return [b, m].filter(Boolean).join(' ')
}
