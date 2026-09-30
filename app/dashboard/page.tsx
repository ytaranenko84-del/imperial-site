import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/staffAuth.ts'
import LoginScreen from '@/components/dashboard/LoginScreen.tsx'
import DashboardApp from '@/components/dashboard/DashboardApp.tsx'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const jar = await cookies()
  const sessionToken = jar.get(SESSION_COOKIE)?.value || null
  const recipientId = verifySessionToken(sessionToken)
  if (!recipientId) return <LoginScreen />

  const payload = await getPayload({ config })
  const doc = await payload.findByID({
    collection: 'recipients', id: recipientId, depth: 0, overrideAccess: true,
  }).catch(() => null) as { id: string | number; title?: string; active?: boolean; kind?: string } | null

  if (!doc || doc.active === false) return <LoginScreen />

  return <DashboardApp me={{ id: String(doc.id), title: doc.title || '', kind: doc.kind || '' }} />
}
