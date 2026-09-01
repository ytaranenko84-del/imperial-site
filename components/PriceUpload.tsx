'use client'
import React, { useRef, useState } from 'react'

type Result = {
  ok?: boolean
  error?: string
  approvedAt?: string | null
  created?: number
  updated?: number
  hidden?: number
  warnings?: string[]
}

/** Кнопка завантаження прайсу над списком тарифів. */
export const PriceUpload: React.FC = () => {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Result | null>(null)

  const send = async (file: File) => {
    setBusy(true); setRes(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await fetch('/api/import-price', { method: 'POST', body: fd, credentials: 'include' })
      const data = (await r.json()) as Result
      setRes(data)
      if (data.ok) setTimeout(() => window.location.reload(), 1400)
    } catch (e) {
      setRes({ error: 'Не вдалося надіслати файл: ' + (e as Error).message })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const box: React.CSSProperties = {
    border: '1px solid var(--theme-elevation-150)',
    borderRadius: 4,
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
    background: 'var(--theme-elevation-50)',
  }

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px' }}>
          <strong style={{ display: 'block', marginBottom: '.2rem' }}>Оновити тарифи з прайсу</strong>
          <span style={{ color: 'var(--theme-elevation-600)', fontSize: '.85em' }}>
            Файл «прайс золото_срібло» у форматі Excel. Беруться скупка та базова ціна;
            ціни за статусами рахуються автоматично.
          </span>
        </div>
        <input
          ref={input}
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f) }}
        />
        <button
          type="button"
          className="btn btn--style-primary"
          disabled={busy}
          onClick={() => input.current?.click()}
          style={{ margin: 0 }}
        >
          {busy ? 'Завантаження…' : 'Завантажити прайс'}
        </button>
      </div>

      {res && (
        <div style={{ marginTop: '.9rem', fontSize: '.9em' }}>
          {res.error ? (
            <span style={{ color: 'var(--theme-error-500)' }}>✗ {res.error}</span>
          ) : (
            <span style={{ color: 'var(--theme-success-500)' }}>
              ✓ Прайс від {res.approvedAt || 'невідомої дати'} застосовано:
              оновлено {res.updated}, додано {res.created}
              {res.hidden ? `, приховано ${res.hidden}` : ''}. Оновлюю сторінку…
            </span>
          )}
          {res.warnings?.length ? (
            <div style={{ color: 'var(--theme-warning-500)', marginTop: '.4rem' }}>
              {res.warnings.map((w) => <div key={w}>⚠ {w}</div>)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default PriceUpload
