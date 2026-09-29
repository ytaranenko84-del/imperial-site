'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64safe)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type Status = 'idle' | 'checking' | 'unsupported' | 'ready' | 'working' | 'enabled' | 'denied' | 'error'

export default function NotifyClient(
  { token, title, vapidPublicKey, botLink }:
  { token: string; title: string; vapidPublicKey: string; botLink: string },
) {
  const [status, setStatus] = useState<Status>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    navigator.serviceWorker.getRegistration('/sw-notify.js').then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription()
      setStatus(sub ? 'enabled' : 'ready')
    }).catch(() => setStatus('ready'))
  }, [])

  const enable = async () => {
    setStatus('working')
    setError('')
    try {
      await navigator.serviceWorker.register('/sw-notify.js')
      // register() може повернутись раніше, ніж воркер стане active — subscribe
      // на неактивному воркері падає з помилкою, тож чекаємо .ready
      const reg = await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      })
      if (!res.ok) throw new Error('save failed')
      setStatus('enabled')
    } catch (e) {
      setError((e as Error).message || 'Невідома помилка')
      setStatus('error')
    }
  }

  return (
    <main style={S.main}>
      <div style={S.card}>
        <h1 style={S.h1}>Сповіщення про заявки</h1>
        <p style={S.p}>{title}</p>

        {status === 'checking' && <p style={S.dim}>Перевіряємо…</p>}

        {status === 'unsupported' && (
          <p style={S.dim}>Цей браузер не підтримує push-сповіщення. Спробуйте відкрити це посилання
            в Chrome або Safari останньої версії.</p>
        )}

        {(status === 'ready' || status === 'working') && (
          <button type="button" onClick={enable} disabled={status === 'working'} style={S.btn}>
            {status === 'working' ? 'Секунду…' : 'Увімкнути сповіщення'}
          </button>
        )}

        {status === 'enabled' && (
          <>
            <p style={S.ok}>✓ Готово. Сповіщення про нові заявки будуть приходити на цей телефон.</p>
            <a href={botLink} style={S.link}>Відкрити бота в Telegram →</a>
          </>
        )}

        {status === 'denied' && (
          <p style={S.dim}>Сповіщення заблоковані в браузері. Дозволити можна в налаштуваннях сайту
            (значок 🔒 біля адреси) — і повторити спробу.</p>
        )}

        {status === 'error' && (
          <p style={S.dim}>Щось не спрацювало{error ? `: ${error}` : ''}. Спробуйте ще раз.</p>
        )}
      </div>
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#101116', padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  },
  card: {
    background: '#1a1b21', borderRadius: 16, padding: '28px 24px', maxWidth: 360, width: '100%',
    textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.3)',
  },
  h1: { color: '#fff', fontSize: 20, margin: '0 0 8px' },
  p: { color: '#c9c9cf', fontSize: 14, margin: '0 0 20px' },
  dim: { color: '#8a8a92', fontSize: 13.5, lineHeight: 1.5 },
  ok: { color: '#7fd67f', fontSize: 14, lineHeight: 1.5, margin: '0 0 14px' },
  btn: {
    background: '#b90f0d', color: '#fff', border: 0, borderRadius: 980, padding: '14px 28px',
    fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  link: { color: '#e7b34a', fontSize: 13.5, textDecoration: 'none' },
}
