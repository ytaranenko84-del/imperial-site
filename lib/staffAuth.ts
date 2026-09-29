import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Сесія робочого столу: підписана кука, а не пароль — вхід підтверджує
 * бот, а браузер після цього просто «пам'ятає» співробітника довго,
 * як у WhatsApp Web, поки той сам не натисне «Вийти».
 */
export const SESSION_COOKIE = 'imperial_staff'
const MAX_AGE_SEC = 365 * 24 * 3600

function secret(): string {
  return process.env.PAYLOAD_SECRET || ''
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

export function createSessionToken(recipientId: string): string {
  const payload = `${recipientId}.${Date.now()}`
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [recipientId, issuedAt, sig] = parts
  const payload = `${recipientId}.${issuedAt}`
  const expected = sign(payload)
  // Довжини завжди однакові (обидва — hex/base64url HMAC-SHA256), timingSafeEqual тут безпечний.
  if (expected.length !== sig.length) return null
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
  const age = (Date.now() - Number(issuedAt)) / 1000
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_SEC) return null
  return recipientId
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secure}`
}

export function clearCookieHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

export function tokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const m = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}
