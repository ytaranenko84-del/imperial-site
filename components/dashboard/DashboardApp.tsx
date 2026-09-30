'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import './dashboard.css'

type Channel = 'eval' | 'hotline' | 'review' | 'booking'

type Item = {
  key: string
  kind: 'eval' | 'hotline' | 'booking'
  channel: Channel
  id: string | number
  title: string
  phone: string
  status: string
  statusLabel: string
  snippet: string
  unread: boolean
  unanswered: boolean
  assignedTo: string | number | null
  assignedToName: string
  updatedAt: string
  createdAt: string
}

type Detail = {
  key: string
  kind: 'eval' | 'hotline' | 'booking'
  id: string | number
  title: string
  name: string
  phone: string
  status: string
  clientChat?: string
  category?: string
  brand?: string
  model?: string
  comment?: string
  estimate?: number
  photos?: string[]
  assignedTo: string | number | null
  assignedToName: string
  answeredBy?: string
  thread?: { from?: string; text?: string; at?: string }[]
  // лише для брони
  amount?: number
  purity?: string
  weight?: number
  days?: number
  tier?: string
  branchName?: string
  expiresAt?: string
  note?: string
  related?: { key: string; channel: Channel; title: string; createdAt: string }[]
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

function pluralUa(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const CHANNEL_ICON: Record<Channel, string> = { eval: '💍', hotline: '☎️', review: '⭐', booking: '📅' }
const CHANNEL_LABEL: Record<Channel, string> = {
  eval: 'Оцінка', hotline: 'Гаряча лінія', review: 'Відгуки', booking: 'Бронь',
}
const CHANNELS: Channel[] = ['eval', 'hotline', 'review', 'booking']

export default function DashboardApp({ me }: { me: { id: string; title: string; kind: string } }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned' | 'unread' | 'unanswered' | 'answered'>('all')
  const [channel, setChannel] = useState<'all' | Channel>('all')
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [q, setQ] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState('')
  // Лише для телефону: рейка-фільтри як шторка поверх екрана, а не колонка
  // поруч — там і так тісно. Список/деталі перемикаються повноекранно.
  const [railOpen, setRailOpen] = useState(false)

  const qRef = useRef(q)
  useEffect(() => { qRef.current = q }, [q])

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
    // Відкриття картки саме зараз позначило її переглянутою на сервері —
    // без цього лічильники й кольори точок зліва лишались би старими
    // до наступного опитування (до 8 секунд).
    loadItems(qRef.current)
  }, [loadItems])

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

  function periodCutoff(): number {
    const now = new Date()
    if (period === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() }
    if (period === 'week') return now.getTime() - 7 * 24 * 3600_000
    if (period === 'month') return now.getTime() - 30 * 24 * 3600_000
    return 0
  }
  const cutoff = periodCutoff()

  const byChannel = (items || []).filter((it) =>
    (channel === 'all' || it.channel === channel)
    && (cutoff === 0 || new Date(it.createdAt).getTime() >= cutoff))

  const filtered = byChannel.filter((it) => {
    if (filter === 'mine') return String(it.assignedTo) === String(me.id)
    if (filter === 'unassigned') return !it.assignedTo
    if (filter === 'unread') return it.unread
    if (filter === 'unanswered') return it.unanswered
    if (filter === 'answered') return !it.unanswered
    return true
  })

  const mineCount = byChannel.filter((it) => String(it.assignedTo) === String(me.id)).length
  const unassignedCount = byChannel.filter((it) => !it.assignedTo).length
  const unreadCount = byChannel.filter((it) => it.unread).length
  const unansweredCount = byChannel.filter((it) => it.unanswered).length
  const answeredCount = byChannel.filter((it) => !it.unanswered).length
  const channelCount = (c: Channel) => (items || []).filter((it) => it.channel === c).length
  const channelUnreadCount = (c: Channel) => (items || []).filter((it) => it.channel === c && it.unread).length
  const totalUnread = (items || []).filter((it) => it.unread).length

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

  function pickFilter(f: typeof filter) {
    setFilter(f)
    setRailOpen(false)
  }

  function pickChannel(c: typeof channel) {
    setChannel(c)
    setRailOpen(false)
  }

  function pickPeriod(p: typeof period) {
    setPeriod(p)
    setRailOpen(false)
  }

  function openItem(key: string) {
    setSelectedKey(key)
  }

  async function deleteCurrent() {
    if (!detail) return
    if (!window.confirm('Видалити заявку назавжди, разом з усією перепискою? Це незворотньо.')) return
    const res = await fetch('/api/dashboard/delete', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: detail.kind, id: detail.id }),
    })
    if (res.ok) {
      setSelectedKey(null)
      loadItems(q)
    } else {
      const json = await res.json().catch(() => ({}))
      window.alert(json.error || 'Не вдалося видалити заявку')
    }
  }

  return (
    <div className="dw">
      <div className="dw-titlebar">
        <button type="button" className="dw-burger" onClick={() => setRailOpen(true)} aria-label="Фільтри">
          ☰{totalUnread > 0 && <span className="dw-burger-dot" />}
        </button>
        <div className="dw-appname"><span className="dw-logo-dot" /> Імперіал · Робочий стіл</div>
      </div>

      <div className={`dw-body ${selectedKey ? 'has-selection' : ''}`}>
        {railOpen && <div className="dw-backdrop" onClick={() => setRailOpen(false)} />}
        <aside className={`dw-rail ${railOpen ? 'open' : ''}`}>
          <div className="dw-rail-logo">
            <div className="dw-mark">І</div>
            <div><b>Імперіал</b><small>робочий стіл</small></div>
            <button type="button" className="dw-rail-close" onClick={() => setRailOpen(false)} aria-label="Закрити">✕</button>
          </div>
          <input
            className="dw-search"
            placeholder="Пошук за ім’ям, телефоном…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="dw-section-label">Мої списки</div>
          <div className="dw-views">
            <button type="button" className={`dw-view ${filter === 'all' ? 'on' : ''}`} onClick={() => pickFilter('all')}>
              <span>Усі активні</span><span className="dw-n">{byChannel.length}</span>
            </button>
            <button type="button" className={`dw-view ${filter === 'mine' ? 'on' : ''}`} onClick={() => pickFilter('mine')}>
              <span>На мені</span><span className="dw-n">{mineCount}</span>
            </button>
            <button type="button" className={`dw-view ${filter === 'unassigned' ? 'on' : ''}`} onClick={() => pickFilter('unassigned')}>
              <span>Непризначені</span><span className="dw-n">{unassignedCount}</span>
            </button>
            <button type="button" className={`dw-view ${filter === 'unread' ? 'on' : ''}`} onClick={() => pickFilter('unread')}>
              <span>🔴 Непрочитані</span><span className="dw-n">{unreadCount}</span>
            </button>
            <button type="button" className={`dw-view ${filter === 'unanswered' ? 'on' : ''}`} onClick={() => pickFilter('unanswered')}>
              <span>🟡 Не відповідані</span><span className="dw-n">{unansweredCount}</span>
            </button>
            <button type="button" className={`dw-view ${filter === 'answered' ? 'on' : ''}`} onClick={() => pickFilter('answered')}>
              <span>⚪ Відповідані</span><span className="dw-n">{answeredCount}</span>
            </button>
          </div>

          <div className="dw-section-label">Канал</div>
          <div className="dw-views">
            <button type="button" className={`dw-view ${channel === 'all' ? 'on' : ''}`} onClick={() => pickChannel('all')}>
              <span>💬 Усі канали</span><span className="dw-n">{items?.length ?? '—'}</span>
            </button>
            {CHANNELS.map((c) => (
              <button type="button" key={c} className={`dw-view ${channel === c ? 'on' : ''}`} onClick={() => pickChannel(c)}>
                <span>
                  {CHANNEL_ICON[c]} {CHANNEL_LABEL[c]}
                  {channelUnreadCount(c) > 0 && <b className="dw-n-unread"> ({channelUnreadCount(c)})</b>}
                </span>
                <span className="dw-n">{channelCount(c)}</span>
              </button>
            ))}
          </div>

          <div className="dw-section-label">Період</div>
          <div className="dw-views">
            <button type="button" className={`dw-view ${period === 'all' ? 'on' : ''}`} onClick={() => pickPeriod('all')}>
              <span>Увесь час</span>
            </button>
            <button type="button" className={`dw-view ${period === 'today' ? 'on' : ''}`} onClick={() => pickPeriod('today')}>
              <span>Сьогодні</span>
            </button>
            <button type="button" className={`dw-view ${period === 'week' ? 'on' : ''}`} onClick={() => pickPeriod('week')}>
              <span>7 днів</span>
            </button>
            <button type="button" className={`dw-view ${period === 'month' ? 'on' : ''}`} onClick={() => pickPeriod('month')}>
              <span>30 днів</span>
            </button>
          </div>

          <div className="dw-rail-bottom">
            <div className="dw-avatar">{me.title.slice(0, 1) || '?'}</div>
            <div className="dw-me"><b>{me.title}</b></div>
            <button type="button" className="dw-logout" onClick={logout} title="Вийти">⏻</button>
          </div>
        </aside>

        <section className="dw-list">
          <div className="dw-list-head">
            <h2>{channel === 'all' ? 'Усі канали' : `${CHANNEL_ICON[channel]} ${CHANNEL_LABEL[channel]}`}</h2>
            <span className="dw-n">{filtered.length}</span>
          </div>
          <div className="dw-items">
            {filtered.map((it) => (
              <button
                type="button"
                key={it.key}
                className={`dw-item ${selectedKey === it.key ? 'sel' : ''} ${it.unanswered ? 'unanswered' : ''}`}
                onClick={() => openItem(it.key)}
              >
                <div className={`dw-ico dw-ico--${it.channel}`}>{CHANNEL_ICON[it.channel]}</div>
                {it.unread && <div className="dw-dot dw-dot--unread" title="Ніхто ще не відкривав" />}
                {!it.unread && it.unanswered && <div className="dw-dot dw-dot--unanswered" title="Переглянуто, немає відповіді" />}
                <div className="dw-item-body">
                  <div className="dw-item-top"><b>{it.title}</b><time>{timeAgo(it.createdAt)}</time></div>
                  <div className="dw-snippet">{it.snippet}</div>
                  <div className="dw-tags">
                    <span className={`dw-tag dw-tag--${it.status}`}>{it.statusLabel}</span>
                    {it.assignedToName && <span className="dw-tag dw-tag--assigned">{it.assignedToName}</span>}
                  </div>
                </div>
              </button>
            ))}
            {items && !filtered.length && <p className="dw-empty">Немає заявок за цим фільтром</p>}
          </div>
        </section>

        <section className="dw-detail">
          {!detail && <div className="dw-placeholder">Оберіть заявку зі списку</div>}
          {detail && detail.kind === 'booking' && (
            <>
              <div className="dw-d-head">
                <button type="button" className="dw-back" onClick={() => setSelectedKey(null)} aria-label="Назад до списку">←</button>
                <div>
                  <h3>{detail.name}{detail.phone ? ` · ${detail.phone}` : ''}</h3>
                  <p>Бронь суми{detail.branchName ? ` · ${detail.branchName}` : ''} · №{detail.id}</p>
                </div>
                <div className="dw-actions">
                  <button type="button" className="dw-btn" disabled={detail.status === 'came'} onClick={() => update({ status: 'came' })}>Клієнт прийшов</button>
                  <button type="button" className="dw-btn dw-btn--ok" disabled={detail.status === 'done'} onClick={() => update({ status: 'done' })}>Оформлено</button>
                  <button type="button" className="dw-btn" disabled={detail.status === 'missed'} onClick={() => update({ status: 'missed' })}>Не прийшов</button>
                  {me.kind === 'admin' && (
                    <button type="button" className="dw-btn dw-btn--danger" onClick={deleteCurrent}>🗑 Видалити</button>
                  )}
                </div>
              </div>
              {detail.related && detail.related.length > 0 && (
                <div className="dw-related">
                  У цього клієнта є ще {detail.related.length} {pluralUa(detail.related.length, 'заявка', 'заявки', 'заявок')}:
                  {detail.related.map((r) => (
                    <button type="button" key={r.key} className="dw-related-link" onClick={() => openItem(r.key)}>
                      {CHANNEL_ICON[r.channel]} №{r.key.split(':')[1]} · {r.title}
                    </button>
                  ))}
                </div>
              )}
              <div className="dw-d-body">
                <div className="dw-booking-card">
                  <div className="dw-booking-sum">{(detail.amount || 0).toLocaleString('uk-UA')} ₴</div>
                  <div className="dw-booking-row"><span>Проба / вага</span><b>{[detail.purity, detail.weight ? `${detail.weight} г` : ''].filter(Boolean).join(', ') || '—'}</b></div>
                  <div className="dw-booking-row"><span>Термін</span><b>{detail.days ? `${detail.days} днів` : '—'}</b></div>
                  <div className="dw-booking-row"><span>Відділення</span><b>{detail.branchName || '—'}</b></div>
                  <div className="dw-booking-row"><span>Діє до</span><b>{detail.expiresAt ? new Date(detail.expiresAt).toLocaleString('uk-UA') : '—'}</b></div>
                  {detail.tier && <div className="dw-booking-row"><span>Статус лояльності</span><b>{detail.tier}</b></div>}
                  {detail.note && <div className="dw-booking-row"><span>Нотатка</span><b>{detail.note}</b></div>}
                </div>
                <p className="dw-hint">
                  Бронь — не переписка з клієнтом, а разова заявка на утримання суми, тому тут немає поля відповіді.
                </p>
              </div>
            </>
          )}
          {detail && detail.kind !== 'booking' && (
            <>
              <div className="dw-d-head">
                <button type="button" className="dw-back" onClick={() => setSelectedKey(null)} aria-label="Назад до списку">←</button>
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
                  {me.kind === 'admin' && (
                    <button type="button" className="dw-btn dw-btn--danger" onClick={deleteCurrent}>🗑 Видалити</button>
                  )}
                </div>
              </div>

              {detail.related && detail.related.length > 0 && (
                <div className="dw-related">
                  У цього клієнта є ще {detail.related.length} {pluralUa(detail.related.length, 'заявка', 'заявки', 'заявок')}:
                  {detail.related.map((r) => (
                    <button type="button" key={r.key} className="dw-related-link" onClick={() => openItem(r.key)}>
                      {CHANNEL_ICON[r.channel]} №{r.key.split(':')[1]} · {r.title}
                    </button>
                  ))}
                </div>
              )}

              <div className="dw-d-body">
                <div className="dw-thread">
                  {detail.comment && (
                    <div className="dw-ctx"><b>{[detail.brand, detail.model].filter(Boolean).join(' ') || 'Опис від клієнта'}</b><span>{detail.comment}</span></div>
                  )}
                  {(detail.photos || []).map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="" className="dw-photo" />
                  ))}
                  {(detail.thread || []).map((m, i) => (
                    <div key={i} className={`dw-bubble ${m.from === detail.answeredBy || (m.from || '').includes('робочого столу') || (m.from || '').includes(me.title) ? 'out' : 'in'}`}>
                      {!((m.from || '').includes('робочого столу')) && m.from ? <span className="dw-who">{m.from}</span> : null}
                      {m.text}
                      {m.at && <time>{new Date(m.at).toLocaleString('uk-UA')}</time>}
                    </div>
                  ))}
                  {!(detail.thread || []).length && !detail.comment && <p className="dw-empty">Ще немає переписки</p>}
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
