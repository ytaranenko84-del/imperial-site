import type { Payload } from 'payload'
import { verifySessionToken } from './staffAuth.ts'

export type SessionRecipient = { id: string | number; title: string; kind: string }

/*
 * Кожен запит робочого столу спершу перевіряв співробітника окремим походом у
 * базу — ще один рейс через Атлантику на кожен клік і кожне опитування.
 * Хвилинний кеш у межах теплої функції: вимкнений співробітник втрачає доступ
 * щонайпізніше за хвилину.
 */
const SESSION_TTL_MS = 60_000
const sessionCache = new Map<string, { recipient: SessionRecipient; expires: number }>()

/** Дістає активного отримувача за токеном сесії — з куки, звідки б її не взяли. */
export async function recipientFromToken(payload: Payload, sessionToken: string | null): Promise<SessionRecipient | null> {
  const recipientId = verifySessionToken(sessionToken)
  if (!recipientId) return null

  const cached = sessionCache.get(String(recipientId))
  if (cached && cached.expires > Date.now()) return cached.recipient

  const doc = await payload.findByID({
    collection: 'recipients', id: recipientId, depth: 0, overrideAccess: true,
  }).catch(() => null) as { id: string | number; title?: string; kind?: string; active?: boolean } | null

  if (!doc || doc.active === false) {
    sessionCache.delete(String(recipientId))
    return null
  }
  const recipient = { id: doc.id, title: doc.title || '', kind: doc.kind || '' }
  sessionCache.set(String(recipientId), { recipient, expires: Date.now() + SESSION_TTL_MS })
  return recipient
}
