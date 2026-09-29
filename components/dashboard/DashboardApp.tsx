'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import './dashboard.css'

type Item = {
  key: string
  kind: 'eval' | 'hotline'
  id: string | number
  title: string
  phone: string
  status: string
  statusLabel: string
  snippet: string
  assignedTo: string | number | null
  assignedToName: string
  updatedAt: string
}

type Detail = {
  key: string
  kind: 'eval' | 'hotline'
  id: string | number
  title: string
  name: string
  phone: string
  status: string
  clientChat: string
  category?: string
  brand?: string
  model?: string
  comment?: string
  estimate?: number
  photos: string[]
  assignedTo: string | number | null
  assignedToName: string
  answeredBy: string
  thread: { from?: string; text?: string; at?: string }[]
}

type Template = { code: string; title: string; text: string }

const POLL_MS = 8000

function timeAgo(iso: string): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'щойно'
  if (min < 60) return `${min} хв`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} год`
  return `${Math.floor(h / 24)} дн`
}

const KIND_ICON: Record<string, string> = { eval: '💍', hotline: '☎️' }

export default function DashboardApp({ me }: { me: { id: string; title: string } }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned'>('all')
  const [channel, setChannel] = useState<'all' | 'eval' | 'hotline'>('all')
  const [q, setQ] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState('')

  const loadItems = useCallback(async (query: string) => {
    const res = await fetch(`/api/dashboard/items${query ? `?q=${encodeURIComponent(query)}` : ''}`)
    if (res.status === 401) {
      window.location.reload()
      return
    }
    const json = await res.json().catch(() => null)
    if (json?.items) setItems(json.items)
  }, [])

  const loadDetail = useCallback(async (key: string) => {
    const [kind, id] = key.split(':')
    const res = await fetch(`/api/dashboard/item?kind=${kind}&id=${id}`)
    const json = await res.json().catch(() => null)
    if (json && !json.error) setDetail(json)
  }, [])

  useEffect(() => {
    loadItems(q)
    fetch('/api/dashboard/templates').then((r) => r.json()).then((j) => setTemplates(j.templates || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setInterval(() => loadItems(q), POLL_MS)
    return () => clearInterval(t)
  }, [q, loadItems])

  useEffect(() => {
    const t = setTimeout(() => loadItems(q), 300)
    return () => clearTimeout(t)
  }, [q, loadItems])

  useEffect(() => {
    if (selectedKey) loadDetail(selectedKey)
    else setDetail(null)
  }, [selectedKey, loadDetail])

  const byChannel = (items || []).filter((it) => channel === 'all' || it.kind === channel)

  const filtered = byChannel.filter((it) => {
    if (filter === 'mine') return String(it.assignedTo) === String(me.id)
    if (filter === 'unassigned') return !it.assignedTo
    return true
  })

  const mineCount = byChannel.filter((it) => String(it.assignedTo) === String(me.id)).length
  const unassignedCount = byChannel.filter((it) => !it.assignedTo).length
  const evalCount = (items || []).filter((it) => it.kind === 'eval').length
  const hotlineCount = (items || []).filter((it) => it.kind === 'hotline').length

  async function update(body: Record<string, unknown>) {
    if (!detail) return
    await fetch('/api/dashboard/update', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: detail.kind, id: detail.id, ...body }),
    })
    await Promise.all([loadDetail(detail.key), loadItems(q)])
  }

  async function sendReply() {
    if (!detail || !composer.trim() || sending) return
    setSending(true)
    setNote('')
    try {
      const res = await fetch('/api/dashboard/reply', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: detail.kind, id: detail.id, text: composer.trim() }),
      })
      const json = await res.json()
      if (json.warn) {
        setNote(json.warn)
      } else if (!res.ok) {
        setNote(json.error || 'Не вдалося надіслати')
      } else {
        setComposer('')
        if (json.deliveredVia === 'sms') setNote('✓ Надіслано SMS (клієнт не в боті)')
        else if (json.deliveredVia === 'telegram') setNote('✓ Надіслано в Telegram')
        else setNote(`Клієнт не отримав повідомлення: ${json.deliveryNote || 'немає зв’язку'}. Телефон: ${detail.phone}`)
        await Promise.all([loadDetail(detail.key), loadItems(q)])
      }
    } catch {
      setNote('Помилка мережі')
    } finally {
      setSending(false)
    }
  }

  function insertTemplate(code: string) {
    setComposer(`${code}. `)
  }

  async function logout() {
    await fetch('/api/staff-auth/logout', { method: 'POST' })
    window.location.reload()
  }

  return (
    <div className="dw">
      <div className="dw-titlebar">
        <div className="dw-appname"><span className="dw-dot" /> Імперіал · Робочий стіл</div>
      </div>

      <div className="dw-body">
        <aside className="dw-rail">
          <div className="dw-rail-logo">
            <div className="dw-mark">І</div>
            <div><b>Імперіал</b><small>робочий стіл</small></div>
          </div>
          <input
            className="dw-search"
            placeholder="Пошук за ім’ям, телефоном…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="dw-views">
            <button type="button" className={`dw-view ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
              <span>Усі активні</span><span className="dw-n">{items?.length ?? '—'}</span>
            </button>
            <button type="button" className={`dw-view ${filter === 'mine' ? 'on' : ''}`} onClick={() => setFilter('mine')}>
              <span>На мені</span><span className="dw-n">{mineCount}</span>
            </button>
            <button type="button" className={`dw-view ${filter === 'unassigned' ? 'on' : ''}`} onClick={() => setFilter('unassigned')}>
              <span>Непризначені</span><span className="dw-n">{unassignedCount}</span>
            </button>
          </div>
          <div className="dw-rail-bottom">
            <div className="dw-avatar">{me.title.slice(0, 1) || '?'}</div>
            <div className="dw-me"><b>{me.title}</b></div>
            <button type="button" className="dw-logout" onClick={logout} title="Вийти">⏻</button>
          </div>
        </aside>

        <section className="dw-list">
          <div className="dw-tabs">
            <button type="button" className={`dw-tab ${channel === 'all' ? 'on' : ''}`} onClick={() => setChannel('all')}>
              Усі <span className="dw-n">{items?.length ?? '—'}</span>
            </button>
            <button type="button" className={`dw-tab ${channel === 'eval' ? 'on' : ''}`} onClick={() => setChannel('eval')}>
              Оцінка <span className="dw-n">{evalCount}</span>
            </button>
            <button type="button" className={`dw-tab ${channel === 'hotline' ? 'on' : ''}`} onClick={() => setChannel('hotline')}>
              Гаряча лінія <span className="dw-n">{hotlineCount}</span>
            </button>
          </div>
          {(filtered).map((it) => (
            <button
              type="button"
              key={it.key}
              className={`dw-item ${selectedKey === it.key ? 'sel' : ''}`}
              onClick={() => setSelectedKey(it.key)}
            >
              <div className={`dw-ico dw-ico--${it.kind}`}>{KIND_ICON[it.kind]}</div>
              <div className="dw-item-body">
                <div className="dw-item-top"><b>{it.title}</b><time>{timeAgo(it.updatedAt)}</time></div>
                <div className="dw-snippet">{it.snippet}</div>
                <div className="dw-tags">
                  <span className={`dw-tag dw-tag--${it.status}`}>{it.statusLabel}</span>
                  {it.assignedToName && <span className="dw-tag dw-tag--assigned">{it.assignedToName}</span>}
                </div>
              </div>
            </button>
          ))}
          {items && !filtered.length && <p className="dw-empty">Немає заявок за цим фільтром</p>}
        </section>

        <section className="dw-detail">
          {!detail && <div className="dw-placeholder">Оберіть заявку зі списку</div>}
          {detail && (
            <>
              <div className="dw-d-head">
                <div>
                  <h3>{detail.name || detail.title}{detail.phone ? ` · ${detail.phone}` : ''}</h3>
                  <p>
                    {detail.kind === 'eval' ? 'Оцінка' : 'Гаряча лінія'}
                    {detail.brand || detail.model ? ` · ${[detail.brand, detail.model].filter(Boolean).join(' ')}` : ''}
                    {' · заявка №'}{detail.id}
                  </p>
                </div>
                <div className="dw-actions">
                  {String(detail.assignedTo) === String(me.id) ? (
                    <button type="button" className="dw-btn" onClick={() => update({ assignedTo: 'none' })}>Зняти призначення</button>
                  ) : (
                    <button type="button" className="dw-btn" onClick={() => update({ assignedTo: 'me' })}>Призначити на мене</button>
                  )}
                  {detail.status !== 'done' && (
                    <button type="button" className="dw-btn dw-btn--primary" onClick={() => update({ status: 'done' })}>Закрити</button>
                  )}
                </div>
              </div>

              <div className="dw-d-body">
                <div className="dw-thread">
                  {detail.comment && (
                    <div className="dw-ctx"><b>{[detail.brand, detail.model].filter(Boolean).join(' ') || 'Опис від клієнта'}</b><span>{detail.comment}</span></div>
                  )}
                  {detail.photos.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="dw-photo" />
                  ))}
                  {detail.thread.map((m, i) => (
                    <div key={i} className={`dw-bubble ${m.from === detail.answeredBy || (m.from || '').includes('робочого столу') || (m.from || '').includes(me.title) ? 'out' : 'in'}`}>
                      {!((m.from || '').includes('робочого столу')) && m.from ? <span className="dw-who">{m.from}</span> : null}
                      {m.text}
                      {m.at && <time>{new Date(m.at).toLocaleString('uk-UA')}</time>}
                    </div>
                  ))}
                  {!detail.thread.length && !detail.comment && <p className="dw-empty">Ще немає переписки</p>}
                </div>
              </div>

              <div className="dw-composer">
                {templates.length > 0 && (
                  <div className="dw-templates">
                    {templates.map((t) => (
                      <button type="button" key={t.code} className="dw-tpl" onClick={() => insertTemplate(t.code)}>
                        {t.code}. {t.title}
                      </button>
                    ))}
                  </div>
                )}
                <div className="dw-input-row">
                  <input
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendReply() }}
                    placeholder="Напишіть відповідь або код шаблону…"
                  />
                  <button type="button" className="dw-send" disabled={sending || !composer.trim()} onClick={sendReply}>➤</button>
                </div>
                {note && <p className="dw-note">{note}</p>}
                <p className="dw-hint">
                  {detail.clientChat ? 'Клієнт у боті — повідомлення піде в Telegram' : 'Клієнта немає в боті — піде SMS'}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
