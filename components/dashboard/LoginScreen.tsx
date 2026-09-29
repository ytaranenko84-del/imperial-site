'use client'

import { useEffect, useRef, useState } from 'react'

type Status = 'loading' | 'ready' | 'confirmed' | 'error'

export default function LoginScreen() {
  const [status, setStatus] = useState<Status>('loading')
  const [botLink, setBotLink] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const res = await fetch('/api/staff-auth/start', { method: 'POST' })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.token) {
          setStatus('error')
          return
        }
        setBotLink(json.botLink || '')
        setStatus('ready')

        pollRef.current = setInterval(async () => {
          const r = await fetch(`/api/staff-auth/status?token=${json.token}`)
          const j = await r.json().catch(() => ({}))
          if (j.ok) {
            if (pollRef.current) clearInterval(pollRef.current)
            setStatus('confirmed')
            window.location.reload()
          }
        }, 2000)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    start()
    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  return (
    <main style={S.main}>
      <div style={S.card}>
        <div style={S.mark}>І</div>
        <h1 style={S.h1}>Робочий стіл «Імперіал»</h1>

        {status === 'loading' && <p style={S.dim}>Готуємо вхід…</p>}

        {status === 'error' && (
          <p style={S.dim}>Не вдалося створити посилання для входу. Оновіть сторінку.</p>
        )}

        {(status === 'ready' || status === 'confirmed') && (
          <>
            <p style={S.p}>Щоб увійти, підтвердьте це в Telegram-боті — жодного пароля вводити не треба.</p>
            {botLink ? (
              <a href={botLink} style={S.btn}>Відкрити бота і підтвердити →</a>
            ) : (
              <p style={S.dim}>Бот ще не налаштований — зверніться до адміністратора.</p>
            )}
            <p style={S.wait}>{status === 'confirmed' ? '✓ Підтверджено, заходимо…' : 'Очікуємо підтвердження…'}</p>
          </>
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
    background: '#1a1b21', borderRadius: 16, padding: '32px 26px', maxWidth: 380, width: '100%',
    textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.3)',
  },
  mark: {
    width: 44, height: 44, borderRadius: 12, background: '#b90f0d', color: '#fff', fontWeight: 800,
    fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
  },
  h1: { color: '#fff', fontSize: 19, margin: '0 0 10px' },
  p: { color: '#c9c9cf', fontSize: 13.5, lineHeight: 1.5, margin: '0 0 18px' },
  dim: { color: '#8a8a92', fontSize: 13, lineHeight: 1.5 },
  btn: {
    display: 'block', background: '#b90f0d', color: '#fff', textDecoration: 'none', borderRadius: 980,
    padding: '14px 20px', fontSize: 14.5, fontWeight: 600, marginBottom: 14,
  },
  wait: { color: '#8a8a92', fontSize: 12.5, margin: 0 },
}
