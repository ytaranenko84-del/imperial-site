import { getPayload } from 'payload'
import config from '@payload-config'
import NotifyClient from './NotifyClient'

export default async function NotifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const payload = await getPayload({ config })

  const [{ docs }, settings] = await Promise.all([
    payload.find({
      collection: 'recipients', limit: 1, depth: 0, overrideAccess: true,
      where: { notifyToken: { equals: token }, active: { equals: true } },
    }),
    payload.findGlobal({ slug: 'settings', overrideAccess: true }).catch(() => ({})),
  ])

  const recipient = docs[0] as { title?: string } | undefined
  const botUsername = String((settings as { botUsername?: string }).botUsername || 'imperialzajavka_bot')

  if (!recipient) {
    return (
      <main style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#101116', color: '#c9c9cf', fontFamily: 'sans-serif', padding: 20, textAlign: 'center',
      }}>
        <p>Посилання недійсне. Зверніться до керівника за новим.</p>
      </main>
    )
  }

  return (
    <NotifyClient
      token={token}
      title={String(recipient.title || '')}
      vapidPublicKey={process.env.VAPID_PUBLIC_KEY || ''}
      botLink={`https://t.me/${botUsername}`}
    />
  )
}
