'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'loading' | 'ready' | 'confirmed' | 'expired' | 'error'
type Pending = { token: string; code: string; botLink: string; startedAt: number }

const STORAGE_KEY = 'imperial_staff_login'
const PENDING_TTL_MS = 9 * 60 * 1000 // трохи менше за 10-хвилинний строк токена на сервері

function loadPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Pending
    if (!p.token || Date.now() - p.startedAt > PENDING_TTL_MS) return null
    return p
  } catch {
    return null
  }
}

function savePending(p: Pending) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch { /* приватний режим тощо */ }
}

function clearPending() {
  try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* приватний режим тощо */ }
}

export default function LoginScreen() {
  const [status, setStatus] = useState<Status>('loading')
  const [botLink, setBotLink] = useState('')
  const [code, setCode] = useState('')
  const tokenRef = useRef<string>('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkStatus = useCallback(async () => {
    if (!tokenRef.current) return
    try {
      const r = await fetch('/api/staff-auth/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: tokenRef.current }),
      })
      if (r.status === 410 || r.status === 403) {
        if (pollRef.current) clearInterval(pollRef.current)
        clearPending()
        setStatus('expired')
        return
      }
      const j = await r.json().catch(() => ({}))
      if (j.ok) {
        if (pollRef.current) clearInterval(pollRef.current)
        clearPending()
        setStatus('confirmed')
        window.location.reload()
      }
    } catch {
      // мережа на секунду пропала — просто спробуємо ще раз наступним тіком
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function begin() {
      /*
       * На телефоні натискання посилання на бота відкриває Telegram, а
       * вкладку браузера залишає у фоні — iOS часто перезавантажує таку
       * вкладку, коли ви повертаєтесь. Без цього кожне повернення починало б
       * новий вхід з нуля, хоча в боті вже все підтверджено.
       */
      const pending = loadPending()
      if (pending) {
        tokenRef.current = pending.token
        setCode(pending.code)
        setBotLink(pending.botLink)
        setStatus('ready')
        return
      }

      try {
        const res = await fetch('/api/staff-auth/start', { method: 'POST' })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || !json.token) {
          setStatus('error')
          return
        }
        tokenRef.current = json.token
        setBotLink(json.botLink || '')
        setCode(json.code || '')
        savePending({ token: json.token, code: json.code || '', botLink: json.botLink || '', startedAt: Date.now() })
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    begin()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (status !== 'ready') return

    pollRef.current = setInterval(checkStatus, 2500)
    // Повернулись із бота — перевіряємо одразу, а не чекаємо до наступного тіка.
    const onVisible = () => { if (document.visibilityState === 'visible') checkStatus() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [status, checkStatus])

  function restart() {
    clearPending()
    window.location.reload()
  }

  return (
    <main style={S.main}>
      <div style={S.card}>
        <div style={S.mark}>І</div>
        <h1 style={S.h1}>Робочий стіл «Імперіал»</h1>

        {status === 'loading' && <p style={S.dim}>Готуємо вхід…</p>}

        {status === 'error' && (
          <p style={S.dim}>Не вдалося створити посилання для входу. Оновіть сторінку.</p>
        )}

        {status === 'expired' && (
          <p style={S.dim}>Час на вхід вийшов. <a href="#" onClick={(e) => { e.preventDefault(); restart() }} style={S.link}>Спробувати ще раз</a>.</p>
        )}

        {(status === 'ready' || status === 'confirmed') && (
          <>
            <p style={S.p}>Щоб увійти, підтвердьте це в Telegram-боті — жодного пароля вводити не треба.</p>
            {botLink ? (
              <a href={botLink} style={S.btn}>Відкрити бота і підтвердити →</a>
            ) : (
              <p style={S.dim}>Бот ще не налаштований — зверніться до адміністратора.</p>
            )}
            {code && (
              <p style={S.code}>
                Код підтвердження: <b style={S.codeNum}>{code}</b>
                <br />
                <span style={S.dim}>Підтверджуйте в боті, лише якщо бачите там той самий код</span>
              </p>
            )}
            <p style={S.wait}>{status === 'confirmed' ? '✓ Підтверджено, заходимо…' : 'Очікуємо підтвердження…'}</p>
            {status === 'ready' && (
              <p style={S.retry}>
                <a href="#" onClick={(e) => { e.preventDefault(); checkStatus() }} style={S.link}>Перевірити зараз</a>
                {' · '}
                <a href="#" onClick={(e) => { e.preventDefault(); restart() }} style={S.link}>Почати заново</a>
              </p>
            )}
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
    padding: '14px 20px', fontSize: 14.5, fontWeight: 600, marginBottom: 18,
  },
  code: {
    color: '#c9c9cf', fontSize: 13, lineHeight: 1.6, margin: '0 0 18px', background: '#101116',
    borderRadius: 12, padding: '12px 14px',
  },
  codeNum: { color: '#e7b34a', fontSize: 22, letterSpacing: '0.12em' },
  link: { color: '#e7b34a' },
  wait: { color: '#8a8a92', fontSize: 12.5, margin: '0 0 10px' },
  retry: { fontSize: 12, margin: 0 },
}
