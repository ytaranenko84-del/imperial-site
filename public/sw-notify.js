self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* лишаємо стандартний текст */ }

  const title = data.title || 'Імперіал'
  const body = data.body || 'Нове повідомлення'
  const url = data.url || 'https://t.me/imperialzajavka_bot'

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || 'https://t.me/imperialzajavka_bot'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
