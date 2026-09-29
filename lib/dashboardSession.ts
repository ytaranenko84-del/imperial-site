import type { Payload } from 'payload'
import { verifySessionToken } from './staffAuth.ts'

export type SessionRecipient = { id: string | number; title: string; kind: string }

/** Дістає активного отримувача за токеном сесії — з куки, звідки б її не взяли. */
export async function recipientFromToken(payload: Payload, sessionToken: string | null): Promise<SessionRecipient | null> {
  const recipientId = verifySessionToken(sessionToken)
  if (!recipientId) return null

  const doc = await payload.findByID({
    collection: 'recipients', id: recipientId, depth: 0, overrideAccess: true,
  }).catch(() => null) as { id: string | number; title?: string; kind?: string; active?: boolean } | null

  if (!doc || doc.active === false) return null
  return { id: doc.id, title: doc.title || '', kind: doc.kind || '' }
}
