import webpush from 'web-push'
import type { Payload } from 'payload'

const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = () => process.env.VAPID_PRIVATE_KEY || ''

export const pushConfigured = () => Boolean(vapidPublicKey() && vapidPrivateKey())

/**
 * Push-сповіщення для тих отримувачів із мапи `chats` (той самий список, що
 * й отримує картку в Telegram), хто підключив сповіщення на телефоні.
 * Найкраще зусилля: якщо VAPID не налаштований чи надсилання не вдалось —
 * просто нічого не робимо, заявка й Telegram-картка від цього не залежать.
 */
export async function notifyRecipients(
  payload: Payload,
  chats: Map<string, { title: string; id: string }>,
  data: { title: string; body: string; url?: string },
) {
  if (!pushConfigured() || !chats.size) return

  const recipientIds = [...new Set([...chats.values()].map((v) => v.id))]
  if (!recipientIds.length) return

  webpush.setVapidDetails('mailto:support@imperial24.com.ua', vapidPublicKey(), vapidPrivateKey())

  const { docs } = await payload.find({
    collection: 'push-subscriptions', limit: 200, depth: 0, overrideAccess: true,
    where: { recipient: { in: recipientIds } },
  })

  await Promise.all(docs.map(async (s) => {
    const doc = s as { id: string | number; endpoint?: string; p256dh?: string; auth?: string }
    const subscription = {
      endpoint: String(doc.endpoint || ''),
      keys: { p256dh: String(doc.p256dh || ''), auth: String(doc.auth || '') },
    }
    if (!subscription.endpoint || !subscription.keys.p256dh || !subscription.keys.auth) return

    try {
      await webpush.sendNotification(subscription, JSON.stringify(data))
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // 404/410 — підписка більше не діє (сторінку закрили, кеш очистили): прибираємо її
      if (status === 404 || status === 410) {
        await payload.delete({ collection: 'push-subscriptions', id: doc.id, overrideAccess: true }).catch(() => {})
      } else {
        payload.logger.error({ err: e }, 'push notify failed')
      }
    }
  }))
}
