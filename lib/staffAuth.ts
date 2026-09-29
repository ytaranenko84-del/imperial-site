import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Сесія робочого столу: підписана кука, а не пароль — вхід підтверджує
 * бот, а браузер після цього просто «пам'ятає» співробітника довго,
 * як у WhatsApp Web, поки той сам не натисне «Вийти».
 */
export const SESSION_COOKIE = 'imperial_staff'
export const VERIFIER_COOKIE = 'imperial_staff_verifier'
const SESSION_MAX_AGE_SEC = 365 * 24 * 3600
const VERIFIER_MAX_AGE_SEC = 10 * 60

function secret(): string {
  const s = process.env.PAYLOAD_SECRET
  // Порожній ключ підписував би сесію передбачувано — краще впасти явно,
  // ніж мовчки видавати підробні сесії всім охочим.
  if (!s) throw new Error('PAYLOAD_SECRET не задано — підпис сесії неможливий')
  return s
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
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
  const expected = sign(`${recipientId}.${issuedAt}`)
  if (!safeEqual(expected, sig)) return null
  const age = (Date.now() - Number(issuedAt)) / 1000
  if (!Number.isFinite(age) || age < 0 || age > SESSION_MAX_AGE_SEC) return null
  return recipientId
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`
}

export function clearCookieHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
}

/**
 * Verifier — секрет входу, який знає лише браузер, що його розпочав.
 * Бот його ніколи не бачить і не передає, тож самого токена з посилання
 * замало, щоб забрати сесію: її отримає лише той, хто сам натиснув
 * «Увійти» на цій сторінці.
 */
export function verifierCookieHeader(verifier: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${VERIFIER_COOKIE}=${verifier}; Path=/api/staff-auth; HttpOnly; SameSite=Lax; Max-Age=${VERIFIER_MAX_AGE_SEC}${secure}`
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  const m = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : null
}

export function verifierMatches(stored: string | null | undefined, given: string | null): boolean {
  if (!stored || !given) return false
  return safeEqual(stored, given)
}
