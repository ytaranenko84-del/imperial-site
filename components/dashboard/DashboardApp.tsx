'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import './dashboard.css'

/** Chrome/Edge; відсутнє в стандартних типах DOM. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => void
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

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
  waitingSince: string | null
  firstReplyAt: string | null
  thanked?: boolean
  replyToEstimate?: boolean
  noReply?: boolean
  client?: { tier: TierKey; tierLabel: string; discount: number | null; fullName: string; people: number; networks: string[] } | null
  assignedTo: string | number | null
  assignedToName: string
  updatedAt: string
  createdAt: string
}

type Note = { from?: string; text?: string; at?: string; mentions?: string[] }
type Staff = { id: string; title: string }

type TierKey = 'diamond' | 'ruby' | 'emerald' | 'new' | 'plain'
type OnixNet = {
  network: string; networkLabel: string; customerId: number; url: string; tier: TierKey; tierLabel: string
  discount: number | null; totalBails: number; activeBails: number; boughtBails: number; soldBails: number
  fineBails: number; clientSince: string | null; lastBailAt: string | null; lastBranch: string | null; fullName?: string
}
type OnixClientUI = {
  tier: TierKey; tierLabel: string; discount: number | null; networks: OnixNet[]
  /** Головний запис (де більше активних застав), та сама людина в інших базах, скільки людей на номері. */
  fullName?: string; primary?: OnixNet; also?: OnixNet[]; people?: number
}
type HistoryBail = {
  network: string; networkLabel: string; id: number; createdAt: string; loan: number; product: string
  statusLabel: string; statusKind: 'active' | 'redeemed' | 'overdue' | 'sold' | 'other'; branch: string
}
type ClientHistory = {
  phone: string; name: string; client: OnixClientUI | null; historyEnabled: boolean; onixError: string
  bails: HistoryBail[]; hasMore: boolean; nextOffset: number
  ours: { key: string; channel: Channel; title: string; createdAt: string; status: string }[]
}

type Detail = {
  key: string
  kind: 'eval' | 'hotline' | 'booking'
  id: string | number
  title: string
  name: string
  phone: string
  status: string
  createdAt?: string
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
  mergedInto?: number | null
  thread?: { from?: string; text?: string; at?: string; photo?: string; mergedFrom?: number }[]
  notes?: Note[]
  // лише для брони
  amount?: number
  purity?: string
  weight?: number
  days?: number
  tier?: string
  branchName?: string
  expiresAt?: string
  note?: string
  related?: { key: string; channel: Channel; title: string; createdAt: string; mergedInto?: number | null }[]
  client?: OnixClientUI | null
}

type Template = { code: string; title: string; text: string }

// Було 8000 — опитування з кожної відкритої вкладки било прямо в базу без
// жодного кешу, і разом з парним вибором eval-requests+hotline-chats на
// кожен тик це й було основним джерелом зайвого egress (підтверджено
// реальними цифрами Supabase: ті самі колекції опитувались десятки тисяч
// разів за кілька днів). 15с непомітно для співробітника, але вже в 1.9
// рази менше запитів; решту бере на себе короткий кеш на сервері.
const POLL_MS = 15000
// Вшито при збірці (next.config.ts) — порівнюємо з version, що віддає сервер,
// щоб відрізнити вкладку на старому коді від справді нової версії.
const BUILD_ID = process.env.BUILD_ID || ''

const pad2 = (n: number) => String(n).padStart(2, '0')

function validDate(iso?: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function dayDiff(d: Date): number {
  const today = new Date()
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((b - a) / 86_400_000)
}

function fmtTime(iso?: string | null): string {
  const d = validDate(iso)
  return d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : ''
}

/** «сьогодні 12:31», «вчора 18:05», «12.10 09:14», минулорічне — «12.10.25 09:14». */
function fmtWhen(iso?: string | null): string {
  const d = validDate(iso)
  if (!d) return ''
  const diff = dayDiff(d)
  if (diff === 0) return `сьогодні ${fmtTime(iso)}`
  if (diff === 1) return `вчора ${fmtTime(iso)}`
  const yy = d.getFullYear() === new Date().getFullYear() ? '' : `.${String(d.getFullYear()).slice(2)}`
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}${yy} ${fmtTime(iso)}`
}

/** Розділювач днів у переписці: «Сьогодні», «Вчора», «12 жовтня». */
function dayLabel(iso?: string | null): string {
  const d = validDate(iso)
  if (!d) return ''
  const diff = dayDiff(d)
  if (diff === 0) return 'Сьогодні'
  if (diff === 1) return 'Вчора'
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('uk-UA', sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
}

function dayKey(iso?: string | null): string {
  const d = validDate(iso)
  return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : ''
}

/** «14 хв», «1 год 3 хв», «2 дн 4 год». */
function fmtDur(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000))
  if (min < 1) return 'менше хвилини'
  if (min < 60) return `${min} хв`
  const h = Math.floor(min / 60)
  if (h < 24) return min % 60 ? `${h} год ${min % 60} хв` : `${h} год`
  const days = Math.floor(h / 24)
  return h % 24 ? `${days} дн ${h % 24} год` : `${days} дн`
}

const isClientEntry = (from?: string) => !from || from === 'клієнт'

/** «Назар (робочий стіл)» → «Назар»: у шапці важливо хто, а не звідки. */
const staffName = (from?: string) => String(from || '').replace(/\s*\([^)]*\)\s*$/, '')

/** Короткий «дзвінок» через Web Audio — без файлу, синтезований на льоту. */
function playPing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.5)
    o.onended = () => ctx.close()
  } catch { /* автоплей міг заблокувати браузер до першої взаємодії — не критично */ }
}

/** Скільки чекає без відповіді — і з якого моменту фарбувати це червоним. */
function waitingBadge(waitingSince: string | null): { label: string; level: 'ok' | 'warn' | 'late' } | null {
  if (!waitingSince) return null
  const ms = Date.now() - new Date(waitingSince).getTime()
  const min = Math.floor(ms / 60000)
  const level = min >= 240 ? 'late' : min >= 30 ? 'warn' : 'ok'
  return { label: `чекає ${fmtDur(ms)}`, level }
}

/**
 * Полоска під заголовком заявки: коли звернулись, коли й через скільки вперше
 * відповіли (так само, як рахує звіт), хто відповів останнім.
 */
const TIER_EMOJI: Record<TierKey, string> = { diamond: '💎', ruby: '❤️', emerald: '♦️', new: '', plain: '' }

/** Значок статусу з Оникса: «💎 Діамантовий 22%»; немає в базі — пунктирний «Немає в Ониксі». */
function TierBadge({ client, big }: { client: { tier: TierKey; tierLabel: string; discount: number | null } | null | undefined; big?: boolean }) {
  if (!client) return <span className={`dw-tier dw-tier--none ${big ? 'dw-tier--big' : ''}`}>Немає в Ониксі</span>
  return (
    <span className={`dw-tier dw-tier--${client.tier} ${big ? 'dw-tier--big' : ''}`}>
      {TIER_EMOJI[client.tier] ? `${TIER_EMOJI[client.tier]} ` : ''}{client.tierLabel}{client.discount ? ` · ${client.discount}%` : ''}
    </span>
  )
}

const fmtDateShort = (iso?: string | null) => {
  const d = validDate(iso)
  return d ? `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}` : ''
}

/**
 * Рядок клієнта під заголовком заявки: статус, мережа, скільки застав, де був
 * востаннє, кнопки «Відкрити в Ониксі» (по мережі) й «Історія клієнта».
 */
function renderClientBar(d: Detail, openHistory: (phone: string) => void) {
  if (!d.phone) return null
  const c = d.client
  const best = c?.primary || c?.networks[0]
  const also = c?.also || []
  return (
    <>
    <div className="dw-clientbar">
      <TierBadge client={c} big />
      {best && (
        <a className="dw-net" href={best.url} target="_blank" rel="noopener noreferrer" title="Відкрити картку клієнта в Ониксі">
          {best.networkLabel} ↗
        </a>
      )}
      {best && (
        <span className="dw-clientbar-meta">
          активних <b>{best.activeBails}</b> · усього <b>{best.totalBails}</b>
          {best.lastBailAt ? <> · востаннє <b>{fmtWhen(best.lastBailAt)}</b>{best.lastBranch ? `, ${best.lastBranch}` : ''}</> : null}
        </span>
      )}
      <button type="button" className="dw-btn dw-btn--history" onClick={() => openHistory(d.phone)}>Історія клієнта</button>
    </div>
      {/* Окремим рядком, щоб на телефоні не ховався за краєм гортання */}
      {(also.length > 0 || (c?.people || 1) > 1) && (
        <div className="dw-clientbar-also">
          {also.length > 0 && <span>також є в:</span>}
          {also.map((n) => (
            <a key={`${n.network}:${n.customerId}`} className="dw-net dw-net--small" href={n.url} target="_blank" rel="noopener noreferrer" title="Відкрити картку клієнта в Ониксі">
              {n.networkLabel}{n.tier !== c!.tier ? ` · ${n.tierLabel}` : ''} · активних {n.activeBails} ↗
            </a>
          ))}
          {(c?.people || 1) > 1 && (
            <span className="dw-tag dw-tag--people" title="Під цим номером в Ониксі записано різних людей — показано того, в кого активні застави. Решта — в історії.">
              {c!.people} клієнти на номері
            </span>
          )}
        </div>
      )}
    </>
  )
}

function renderTiming(d: Detail) {
  if (!validDate(d.createdAt)) return null
  const thread = d.thread || []
  const firstStaff = thread.find((t) => !isClientEntry(t.from) && validDate(t.at))
  const lastStaff = [...thread].reverse().find((t) => !isClientEntry(t.from) && validDate(t.at))
  const created = new Date(d.createdAt!).getTime()
  const closed = d.status === 'done' || d.status === 'reject'
  return (
    <div className="dw-timing">
      <div className="dw-tcell"><span>Звернення</span><b>{fmtWhen(d.createdAt)}</b></div>
      <div className="dw-tcell">
        <span>Перша відповідь</span>
        {firstStaff ? (
          <b>{fmtWhen(firstStaff.at)} · <em>через {fmtDur(new Date(firstStaff.at!).getTime() - created)}</em></b>
        ) : closed ? (
          <b className="dw-tcell-dim">без відповіді · закрито</b>
        ) : (
          <b><em className="late">без відповіді · чекає {fmtDur(Date.now() - created)}</em></b>
        )}
      </div>
      {lastStaff && (
        <div className="dw-tcell">
          <span>Остання відповідь</span>
          <b>{fmtWhen(lastStaff.at)}{staffName(lastStaff.from) ? ` · ${staffName(lastStaff.from)}` : ''}</b>
        </div>
      )}
    </div>
  )
}

type Report = {
  total: number
  answered: number
  avgReplyMs: number | null
  staff: { name: string; count: number; avgReplyMs: number | null }[]
}

type BotFunnel = {
  start: number
  menuClick: number
  contactShared: number
  formCompleted: number
  byMenu: { intent: string; count: number }[]
  gotLinkNotStarted: number
}

const MENU_LABEL: Record<string, string> = {
  otsinka: 'Оцінка речі', hotline: 'Гаряча лінія', bron: 'Мої броні',
  viddilennya: 'Найближче відділення', umovy: 'Умови', review: 'Відгуки та побажання',
}

/** Формат тривалості для звіту: не секунди/мілісекунди — хвилини, години, дні. */
function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} хв`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} год`
  return `${Math.round(h / 24)} дн`
}

function pluralUa(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

const CHANNEL_ICON: Record<Channel, string> = {
  eval: '💍', hotline: '☎️', review: '⭐', booking: '📅',
}
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
  const [staff, setStaff] = useState<Staff[]>([])
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply')
  const [composer, setComposer] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteMentions, setNoteMentions] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState('')
  // «Приєднати сюди»: чекаємо підтвердження з переліком того, що переїде
  const [mergeAsk, setMergeAsk] = useState<{ key: string; id: string; messages: number; photos: number; notes: number } | null>(null)
  // «Виділити в нову заявку»: позначені повідомлення (індекси в переписці) й фото з блоку згори
  const [splitMode, setSplitMode] = useState(false)
  const [splitEntries, setSplitEntries] = useState<Set<number>>(new Set())
  const [splitPhotos, setSplitPhotos] = useState<Set<string>>(new Set())
  // Стрічка відкривається на останніх повідомленнях, як у месенджері, а не з самого початку.
  const threadBodyRef = useRef<HTMLDivElement | null>(null)
  // Вікно «Історія клієнта»: статус і застави з Оникса + наші звернення за номером
  const [history, setHistory] = useState<ClientHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  // Лише для телефону: рейка-фільтри як шторка поверх екрана, а не колонка
  // поруч — там і так тісно. Список/деталі перемикаються повноекранно.
  const [railOpen, setRailOpen] = useState(false)

  // Встановлення як програма: Chrome/Edge дають подію й можна показати
  // кнопку напряму; Safari й Firefox такого не вміють — для них лише підказка.
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showInstallHint, setShowInstallHint] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  // Звіти — лише для адміністратора, окремий оверлей над усім дашбордом
  const [showReport, setShowReport] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportPeriod, setReportPeriod] = useState<'all' | 'today' | 'week' | 'month'>('week')

  const loadReport = useCallback(async (p: typeof reportPeriod) => {
    setReportLoading(true)
    try {
      const res = await fetch(`/api/dashboard/report?period=${p}`)
      const json = await res.json().catch(() => null)
      if (json && !json.error) setReport(json)
    } finally {
      setReportLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showReport) loadReport(reportPeriod)
  }, [showReport, reportPeriod, loadReport])

  // Воронка бота — теж лише для адміністратора, окремий оверлей
  const [showBotFunnel, setShowBotFunnel] = useState(false)
  const [botFunnel, setBotFunnel] = useState<BotFunnel | null>(null)
  const [botFunnelLoading, setBotFunnelLoading] = useState(false)
  const [botFunnelPeriod, setBotFunnelPeriod] = useState<'all' | 'today' | 'week' | 'month'>('week')

  const loadBotFunnel = useCallback(async (p: typeof botFunnelPeriod) => {
    setBotFunnelLoading(true)
    try {
      const res = await fetch(`/api/dashboard/bot-funnel?period=${p}`)
      const json = await res.json().catch(() => null)
      if (json && !json.error) setBotFunnel(json)
    } finally {
      setBotFunnelLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showBotFunnel) loadBotFunnel(botFunnelPeriod)
  }, [showBotFunnel, botFunnelPeriod, loadBotFunnel])

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function installApp() {
    if (!installPrompt) {
      setShowInstallHint((v) => !v)
      return
    }
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const qRef = useRef(q)
  useEffect(() => { qRef.current = q }, [q])

  // Для звуку: чи з'явився ключ, якого не було непрочитаним хвилину тому.
  const loadedOnceRef = useRef(false)
  const prevUnreadKeysRef = useRef<Set<string>>(new Set())

  const loadItems = useCallback(async (query: string) => {
    const res = await fetch(`/api/dashboard/items${query ? `?q=${encodeURIComponent(query)}` : ''}`)
    if (res.status === 401) {
      window.location.reload()
      return
    }
    const json = await res.json().catch(() => null)
    if (json?.items) {
      setItems(json.items)
      // Сервер завжди свіжий (API — не статика), а код вкладки лишається
      // тим, з яким її відкрили: якщо мітки розійшлись, деплой уже стався.
      if (BUILD_ID && json.version && json.version !== BUILD_ID) setUpdateAvailable(true)
      const nowUnread = new Set<string>((json.items as Item[]).filter((it) => it.unread).map((it) => it.key))
      if (loadedOnceRef.current) {
        let hasNew = false
        nowUnread.forEach((k) => { if (!prevUnreadKeysRef.current.has(k)) hasNew = true })
        if (hasNew) playPing()
      }
      loadedOnceRef.current = true
      prevUnreadKeysRef.current = nowUnread
    }
  }, [])

  /*
   * Відкриті (і підвантажені наведенням) заявки тримаємо в пам'яті: повторне
   * відкриття показує їх миттєво, а свіжа версія тихо підтягується слідом.
   * selectedKeyRef — щоб відповідь на давно покинуту заявку не перекрила ту,
   * яку вже відкрили після неї.
   */
  const detailCacheRef = useRef(new Map<string, Detail>())
  const prefetchingRef = useRef(new Set<string>())
  const selectedKeyRef = useRef<string | null>(null)

  const loadDetail = useCallback(async (key: string, opts?: { peek?: boolean }) => {
    const [kind, id] = key.split(':')
    const res = await fetch(`/api/dashboard/item?kind=${kind}&id=${id}${opts?.peek ? '&peek=1' : ''}`).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    if (json && !json.error) {
      detailCacheRef.current.set(key, json)
      if (selectedKeyRef.current === key) setDetail(json)
    }
    if (opts?.peek) return
    /*
     * Відкриття картки саме зараз позначило її переглянутою на сервері —
     * без цього лічильники й кольори точок зліва лишались би старими до
     * наступного опитування. Раніше тут перезавантажувався весь список
     * (три важких запити) заради однієї зміненої позначки — тепер просто
     * знімаємо «непрочитане» локально, без зайвого рейсу на сервер.
     */
    setItems((prev) => prev && prev.map((it) => (it.key === key ? { ...it, unread: false } : it)))
  }, [])

  useEffect(() => {
    loadItems(q)
    fetch('/api/dashboard/templates').then((r) => r.json()).then((j) => setTemplates(j.templates || [])).catch(() => {})
    fetch('/api/dashboard/staff').then((r) => r.json()).then((j) => setStaff(j.staff || [])).catch(() => {})
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
    selectedKeyRef.current = selectedKey
    if (selectedKey) {
      setDetail(detailCacheRef.current.get(selectedKey) || null)
      loadDetail(selectedKey)
    } else setDetail(null)
    // Чернетка відповіді чи нотатки для попередньої заявки не має «перетікати» в наступну.
    setComposer('')
    setNoteText('')
    setNoteMentions(new Set())
    setComposerMode('reply')
    setNote('')
    setSplitMode(false)
    setSplitEntries(new Set())
    setSplitPhotos(new Set())
    setMergeAsk(null)
  }, [selectedKey, loadDetail])

  useEffect(() => {
    const el = threadBodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [detail?.key, detail?.thread?.length, detail?.notes?.length])

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
      }).catch(() => null)
      if (!res) {
        setNote('Немає зв’язку з сервером — перевірте інтернет і надішліть ще раз')
        return
      }
      const json = await res.json().catch(() => null)
      if (!json) {
        // Сервер щось почав, але не відповів до кінця: повідомлення могло вже піти.
        setNote(`Сервер не відповів (код ${res.status}). Повідомлення могло вже піти клієнту — заявку оновлено, перевірте переписку перед повторною відправкою.`)
        await Promise.all([loadDetail(detail.key), loadItems(q)])
        return
      }
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
      setNote('Щось пішло не так — оновіть заявку й перевірте переписку')
    } finally {
      setSending(false)
    }
  }

  /** «Приєднати сюди»: спершу показуємо, що саме переїде. */
  async function askMerge(key: string) {
    const [kind, id] = key.split(':')
    const res = await fetch(`/api/dashboard/item?kind=${kind}&id=${id}&peek=1`).catch(() => null)
    const src = res ? (await res.json().catch(() => null)) as (Detail & { error?: string }) | null : null
    if (!src || src.error) { setNote('Не вдалося відкрити заявку для приєднання'); return }
    setMergeAsk({
      key,
      id,
      messages: (src.thread || []).length + (src.comment && detail?.comment ? 1 : 0),
      photos: (src.photos || []).length + (src.thread || []).filter((t) => t.photo).length,
      notes: (src.notes || []).length,
    })
  }

  async function confirmMerge() {
    if (!detail || !mergeAsk) return
    const ask = mergeAsk
    setMergeAsk(null)
    const res = await fetch('/api/dashboard/merge', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: detail.kind, targetId: detail.id, sourceId: ask.id }),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    if (!json?.ok) { setNote(json?.error || 'Не вдалося приєднати'); return }
    detailCacheRef.current.delete(ask.key)
    await Promise.all([loadDetail(detail.key), loadItems(q)])
    setNote(`✓ Заявку №${ask.id} приєднано сюди`)
  }

  async function doSplit() {
    if (!detail || (!splitEntries.size && !splitPhotos.size)) return
    const res = await fetch('/api/dashboard/split', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: detail.id, entries: Array.from(splitEntries), photoUrls: Array.from(splitPhotos) }),
    }).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    if (!json?.ok) { setNote(json?.error || 'Не вдалося виділити'); return }
    detailCacheRef.current.delete(detail.key)
    await loadItems(q)
    openItem(json.key)
  }

  async function openHistory(phone: string) {
    if (!phone) return
    setHistoryLoading(true)
    setHistory({ phone, name: '', client: null, historyEnabled: true, onixError: '', bails: [], hasMore: false, nextOffset: 0, ours: [] })
    const res = await fetch(`/api/dashboard/client-history?phone=${encodeURIComponent(phone)}`).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    setHistoryLoading(false)
    if (!json || json.error) { setHistory(null); setNote(json?.error || 'Не вдалося завантажити історію'); return }
    setHistory(json)
  }

  async function moreHistory() {
    if (!history) return
    setHistoryLoading(true)
    const res = await fetch(`/api/dashboard/client-history?phone=${encodeURIComponent(history.phone)}&offset=${history.nextOffset}`).catch(() => null)
    const json = res ? await res.json().catch(() => null) : null
    setHistoryLoading(false)
    if (!json || json.error) return
    setHistory((h) => h && { ...h, bails: [...h.bails, ...json.bails], hasMore: json.hasMore, nextOffset: json.nextOffset, onixError: json.onixError })
  }

  function toggleIn<T>(set: Set<T>, v: T): Set<T> {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  function insertTemplate(code: string) {
    setComposer(`${code}. `)
  }

  function toggleMention(s: Staff) {
    setNoteMentions((prev) => {
      const next = new Set(prev)
      if (next.has(s.id)) {
        next.delete(s.id)
      } else {
        next.add(s.id)
        if (!noteText.includes(`@${s.title}`)) setNoteText((t) => `${t}${t ? ' ' : ''}@${s.title} `)
      }
      return next
    })
  }

  async function sendNote() {
    if (!detail || !noteText.trim() || sending) return
    setSending(true)
    setNote('')
    try {
      const res = await fetch('/api/dashboard/note', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: detail.kind, id: detail.id, text: noteText.trim(), mentions: Array.from(noteMentions) }),
      }).catch(() => null)
      if (!res) {
        setNote('Немає зв’язку з сервером — перевірте інтернет і збережіть ще раз')
        return
      }
      if (res.ok) {
        setNoteText('')
        setNoteMentions(new Set())
        await Promise.all([loadDetail(detail.key), loadItems(q)])
      } else {
        const json = await res.json().catch(() => ({}))
        setNote(json.error || `Не вдалося зберегти нотатку (код ${res.status})`)
      }
    } catch {
      setNote('Щось пішло не так — оновіть заявку й перевірте нотатки')
    } finally {
      setSending(false)
    }
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

  /** Наведення на рядок — завантажуємо заявку заздалегідь, щоб клік відкривав її миттєво. */
  function prefetchItem(key: string) {
    if (key.startsWith('booking:') || detailCacheRef.current.has(key) || prefetchingRef.current.has(key)) return
    prefetchingRef.current.add(key)
    loadDetail(key, { peek: true }).finally(() => prefetchingRef.current.delete(key))
  }

  function openItem(key: string) {
    setSelectedKey(key)
  }

  /** Підсвічує «@Ім'я» в тексті нотатки — просто косметика, самі згадування рахуються окремо через чіпси. */
  function renderNoteText(text: string) {
    const parts = text.split(/(@[А-Яа-яЇїІіЄєҐґ'’]+)/g)
    return parts.map((p, i) => (p.startsWith('@') ? <b key={i} className="dw-mention">{p}</b> : p))
  }

  /** Переписка й нотатки в одній стрічці за часом — нотатки просто виглядають геть інакше. */
  type TimelineRow = { type: 'message' | 'note'; idx?: number; photo?: string; mergedFrom?: number } & Note
  function mergedTimeline(d: Detail): TimelineRow[] {
    const messages = (d.thread || []).map((m, idx) => ({ type: 'message' as const, idx, ...m }))
    const notes = (d.notes || []).map((n) => ({ type: 'note' as const, ...n }))
    return [...messages, ...notes].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
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
        {updateAvailable && (
          <button type="button" className="dw-update-btn" onClick={() => window.location.reload()}>
            ⟳ Оновити
          </button>
        )}
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

          {!installed && (
            <div className="dw-install">
              <button type="button" className="dw-install-btn" onClick={installApp}>
                📲 Встановити як програму
              </button>
              {showInstallHint && (
                <p className="dw-install-hint">
                  <b>iPhone (Safari):</b> кнопка «Поділитися» → «На екран Домой».<br />
                  <b>Mac (Safari):</b> меню Файл → «Додати в Dock».<br />
                  <b>Firefox:</b> поки не підтримує встановлення — відкривайте як звичайний сайт.
                </p>
              )}
            </div>
          )}

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

          {me.kind === 'admin' && (
            <>
              <div className="dw-section-label">Звіти</div>
              <div className="dw-views">
                <button type="button" className="dw-view" onClick={() => setShowReport(true)}>
                  <span>📊 Відповіді по співробітниках</span>
                </button>
                <button type="button" className="dw-view" onClick={() => setShowBotFunnel(true)}>
                  <span>📊 Воронка бота</span>
                </button>
              </div>
            </>
          )}

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
                onMouseEnter={() => prefetchItem(it.key)}
              >
                <div className={`dw-ico dw-ico--${it.channel}`}>{CHANNEL_ICON[it.channel]}</div>
                {it.unread && <div className="dw-dot dw-dot--unread" title="Ніхто ще не відкривав" />}
                {!it.unread && it.unanswered && <div className="dw-dot dw-dot--unanswered" title="Переглянуто, немає відповіді" />}
                <div className="dw-item-body">
                  {/* Клієнт є в Ониксі — ПІБ і телефон замість ніка; оцінка — річ іде в рядок нижче */}
                  <div className="dw-item-top">
                    {it.client?.fullName
                      ? <b>{it.client.fullName}{it.phone && <span className="dw-item-phone"> · {it.phone}</span>}</b>
                      : <b>{it.title}</b>}
                    <time>{fmtWhen(it.createdAt)}</time>
                  </div>
                  <div className="dw-snippet">{it.client?.fullName && it.kind === 'eval' && it.title ? `${it.title} · ${it.snippet}` : it.snippet}</div>
                  <div className="dw-tags">
                    {it.client && ['diamond', 'ruby', 'emerald'].includes(it.client.tier) && <TierBadge client={it.client} />}
                    {it.client && <span className="dw-net dw-net--small">{it.client.networks[0]}{it.client.networks.length > 1 ? ` +${it.client.networks.slice(1).join(', ')}` : ''}</span>}
                    {it.client && it.client.people > 1 && <span className="dw-tag dw-tag--people">{it.client.people} клієнти на номері</span>}
                    <span className={`dw-tag dw-tag--${it.status}`}>{it.statusLabel}</span>
                    {it.assignedToName && <span className="dw-tag dw-tag--assigned">{it.assignedToName}</span>}
                    {waitingBadge(it.waitingSince) && it.replyToEstimate ? (
                      <span className="dw-tag dw-tag--reply-est">
                        відповів на оцінку · {fmtDur(Date.now() - new Date(it.waitingSince!).getTime())}
                      </span>
                    ) : waitingBadge(it.waitingSince) ? (
                      <span className={`dw-tag dw-tag--wait-${waitingBadge(it.waitingSince)!.level}`}>
                        {waitingBadge(it.waitingSince)!.label}
                      </span>
                    ) : it.thanked ? (
                      <span className="dw-tag dw-tag--muted">клієнт подякував</span>
                    ) : it.noReply ? (
                      <span className="dw-tag dw-tag--muted">не потребує відповіді</span>
                    ) : it.firstReplyAt && validDate(it.createdAt) ? (
                      <span className="dw-tag dw-tag--answered">
                        відповіли за {fmtDur(new Date(it.firstReplyAt).getTime() - new Date(it.createdAt).getTime())}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
            {items && !filtered.length && <p className="dw-empty">Немає заявок за цим фільтром</p>}
          </div>
        </section>

        <section className="dw-detail">
          {!detail && (() => {
            // Поки переписка вантажиться — одразу показуємо те, що вже відомо зі списку.
            const sel = selectedKey ? (items || []).find((i) => i.key === selectedKey) : undefined
            if (!sel) return <div className="dw-placeholder">Оберіть заявку зі списку</div>
            return (
              <>
                <div className="dw-d-head">
                  <button type="button" className="dw-back" onClick={() => setSelectedKey(null)} aria-label="Назад до списку">←</button>
                  <div>
                    <h3>{sel.title}{sel.phone ? ` · ${sel.phone}` : ''}</h3>
                    <p>{sel.kind === 'eval' ? 'Оцінка' : sel.kind === 'hotline' ? 'Гаряча лінія' : 'Бронь'} · заявка №{sel.id}</p>
                  </div>
                </div>
                {sel.kind !== 'booking' && (
                  <div className="dw-timing"><div className="dw-tcell"><span>Звернення</span><b>{fmtWhen(sel.createdAt)}</b></div></div>
                )}
                <div className="dw-d-body">
                  <div className="dw-thread" aria-busy="true">
                    <div className="dw-skel dw-skel--in" />
                    <div className="dw-skel dw-skel--out" />
                    <div className="dw-skel dw-skel--in dw-skel--short" />
                  </div>
                </div>
              </>
            )
          })()}
          {detail && detail.kind === 'booking' && (
            <>
              <div className="dw-d-head">
                <button type="button" className="dw-back" onClick={() => setSelectedKey(null)} aria-label="Назад до списку">←</button>
                <div>
                  <h3>
                    <button type="button" className="dw-name-link" onClick={() => openHistory(detail.phone)}>{detail.client?.fullName || detail.name}</button>
                    {detail.phone ? ` · ${detail.phone}` : ''}
                  </h3>
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
              {renderClientBar(detail, openHistory)}
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
                  <h3>
                    <button type="button" className="dw-name-link" onClick={() => openHistory(detail.phone)}>{detail.client?.fullName || detail.name || detail.title}</button>
                    {detail.phone ? ` · ${detail.phone}` : ''}
                  </h3>
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
                  {(() => {
                    const th = detail.thread || []
                    const clientLast = !th.length || th[th.length - 1].from === 'клієнт'
                    const open = detail.status !== 'done' && detail.status !== 'reject'
                    return clientLast && open ? (
                      <button type="button" className="dw-btn" onClick={() => update({ noReply: true })}>Не потребує відповіді</button>
                    ) : null
                  })()}
                  {detail.kind === 'eval' && (
                    <button
                      type="button"
                      className={`dw-btn ${splitMode ? 'dw-btn--on' : ''}`}
                      onClick={() => { setSplitMode((v) => !v); setSplitEntries(new Set()); setSplitPhotos(new Set()) }}
                    >
                      {splitMode ? 'Скасувати виділення' : 'Виділити в нову заявку'}
                    </button>
                  )}
                  {detail.status !== 'done' && (
                    <button type="button" className="dw-btn dw-btn--primary" onClick={() => update({ status: 'done' })}>Закрити</button>
                  )}
                  {me.kind === 'admin' && (
                    <button type="button" className="dw-btn dw-btn--danger" onClick={deleteCurrent}>🗑 Видалити</button>
                  )}
                </div>
              </div>

              {renderClientBar(detail, openHistory)}
              {renderTiming(detail)}

              {detail.mergedInto != null && (
                <div className="dw-merged-note">
                  Ця заявка приєднана до №{detail.mergedInto} — уся переписка там.
                  <button type="button" className="dw-related-link" onClick={() => openItem(`${detail.kind}:${detail.mergedInto}`)}>Відкрити №{detail.mergedInto}</button>
                </div>
              )}

              {detail.related && detail.related.length > 0 && (
                <div className="dw-related">
                  У цього клієнта є ще {detail.related.length} {pluralUa(detail.related.length, 'заявка', 'заявки', 'заявок')}:
                  {detail.related.map((r) => (
                    <span key={r.key} className="dw-related-chip">
                      <button type="button" className="dw-related-link" onClick={() => openItem(r.key)}>
                        {CHANNEL_ICON[r.channel]} №{r.key.split(':')[1]} · {r.title}
                      </button>
                      {r.mergedInto != null ? (
                        <span className="dw-tag dw-tag--merged">Об’єднано в №{r.mergedInto}</span>
                      ) : r.key.split(':')[0] === detail.kind && detail.mergedInto == null ? (
                        <button type="button" className="dw-join" onClick={() => askMerge(r.key)}>Приєднати сюди</button>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}

              <div className="dw-d-body" ref={threadBodyRef}>
                <div className="dw-thread">
                  {(() => {
                    // Розділювач дня ставимо перед першим записом кожного нового дня,
                    // включно з початковим описом клієнта (його час — створення заявки).
                    let lastDay = ''
                    const daySep = (iso: string | undefined, key: string) => {
                      const k = dayKey(iso)
                      if (!k || k === lastDay) return null
                      lastDay = k
                      return <div key={key} className="dw-day">{dayLabel(iso)}</div>
                    }
                    return (
                      <>
                        {detail.comment && daySep(detail.createdAt, 'day-ctx')}
                        {detail.comment && (
                          <div className="dw-ctx">
                            <b>{[detail.brand, detail.model].filter(Boolean).join(' ') || 'Опис від клієнта'}</b>
                            <span>{detail.comment}</span>
                            {fmtTime(detail.createdAt) && <time>{fmtTime(detail.createdAt)}</time>}
                          </div>
                        )}
                        {(detail.photos || []).map((url) => (splitMode ? (
                          <label key={url} className={`dw-pick ${splitPhotos.has(url) ? 'on' : ''}`}>
                            <input type="checkbox" checked={splitPhotos.has(url)} onChange={() => setSplitPhotos((p) => toggleIn(p, url))} />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="dw-photo" />
                          </label>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={url} src={url} alt="" className="dw-photo" />
                        )))}
                        {mergedTimeline(detail).map((m, i) => [
                          daySep(m.at, `day-${i}`),
                          m.type === 'note' ? (
                            <div key={i} className="dw-note-card">
                              <div className="dw-note-tag">🔒 Нотатка · тільки команда</div>
                              {renderNoteText(m.text || '')}
                              <time>{m.from}{m.at ? ` · ${fmtTime(m.at)}` : ''}</time>
                            </div>
                          ) : (
                            <div
                              key={i}
                              className={`dw-bubble ${m.from && m.from !== 'клієнт' ? 'out' : 'in'} ${splitMode && m.idx != null && splitEntries.has(m.idx) ? 'picked' : ''}`}
                              onClick={splitMode && m.idx != null ? () => setSplitEntries((p) => toggleIn(p, m.idx!)) : undefined}
                            >
                              {splitMode && m.idx != null && (
                                <input type="checkbox" className="dw-pick-box" checked={splitEntries.has(m.idx)} readOnly />
                              )}
                              {m.mergedFrom != null && <span className="dw-from-merged">із заявки №{m.mergedFrom}</span>}
                              {m.from ? <span className="dw-who">{m.from}</span> : null}
                              {m.photo && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.photo} alt="" className="dw-photo dw-photo--in-bubble" />
                              )}
                              {m.photo
                                ? (m.text === '[фото]' ? null : (m.text || '').replace(/\s*\[фото\]$/, ''))
                                // старі повідомлення: фото лише пересилалось у Telegram, у заявці лишилась позначка
                                : (m.text || '').replace(/\[фото\]/g, '📷 фото')}
                              {m.at && <time>{fmtTime(m.at)}</time>}
                            </div>
                          ),
                        ])}
                      </>
                    )
                  })()}
                  {!mergedTimeline(detail).length && !detail.comment && <p className="dw-empty">Ще немає переписки</p>}
                </div>
              </div>

              {splitMode && (
                <div className="dw-split-bar">
                  <span>Позначте повідомлення й фото іншої речі — вони переїдуть в окрему заявку цього клієнта.</span>
                  <button type="button" className="dw-btn dw-btn--primary" disabled={!splitEntries.size && !splitPhotos.size} onClick={doSplit}>
                    Перенести вибране ({splitEntries.size + splitPhotos.size})
                  </button>
                </div>
              )}

              {mergeAsk && (
                <div className="dw-report-backdrop" onClick={() => setMergeAsk(null)}>
                  <div className="dw-merge-modal" onClick={(e) => e.stopPropagation()}>
                    <h4>Приєднати заявку №{mergeAsk.id} до №{detail.id}?</h4>
                    <ul>
                      <li>Перенесеться: <b>{mergeAsk.messages} {pluralUa(mergeAsk.messages, 'повідомлення', 'повідомлення', 'повідомлень')}, {mergeAsk.photos} фото, {mergeAsk.notes} {pluralUa(mergeAsk.notes, 'нотатка', 'нотатки', 'нотаток')}</b></li>
                      <li>№{mergeAsk.id} закриється з позначкою «Об’єднано в №{detail.id}»</li>
                      <li>Оцінка й відповідальний лишаються від №{detail.id}</li>
                    </ul>
                    <p>Дані в №{mergeAsk.id} нікуди не зникають — якщо приєднали помилково, нічого не втрачено.</p>
                    <div className="dw-merge-row">
                      <button type="button" className="dw-btn" onClick={() => setMergeAsk(null)}>Скасувати</button>
                      <button type="button" className="dw-btn dw-btn--primary" onClick={confirmMerge}>Приєднати</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="dw-composer">
                <div className="dw-mode-tabs">
                  <button type="button" className={`dw-mode-tab ${composerMode === 'reply' ? 'on-reply' : ''}`} onClick={() => setComposerMode('reply')}>
                    💬 Відповідь клієнту
                  </button>
                  <button type="button" className={`dw-mode-tab ${composerMode === 'note' ? 'on-note' : ''}`} onClick={() => setComposerMode('note')}>
                    📝 Нотатка команді
                  </button>
                </div>

                {composerMode === 'reply' && (
                  <>
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
                  </>
                )}

                {composerMode === 'note' && (
                  <>
                    {staff.length > 0 && (
                      <div className="dw-mentions">
                        {staff.filter((s) => s.id !== me.id).map((s) => (
                          <button
                            type="button"
                            key={s.id}
                            className={`dw-mention-chip ${noteMentions.has(s.id) ? 'on' : ''}`}
                            onClick={() => toggleMention(s)}
                          >
                            @{s.title}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="dw-input-row dw-input-row--note">
                      <input
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') sendNote() }}
                        placeholder="Нотатка для колег — клієнт цього не побачить…"
                      />
                      <button type="button" className="dw-send dw-send--note" disabled={sending || !noteText.trim()} onClick={sendNote}>➤</button>
                    </div>
                    {note && <p className="dw-note">{note}</p>}
                    <p className="dw-hint">
                      Бачать лише співробітники. {noteMentions.size > 0 ? 'Позначені колеги отримають повідомлення в Telegram.' : 'Оберіть колегу вище, щоб надіслати йому сповіщення.'}
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {history && (
        <div className="dw-report-backdrop" onClick={() => setHistory(null)}>
          <div className="dw-history" onClick={(e) => e.stopPropagation()}>
            <div className="dw-history-head">
              <div>
                <h2>{history.name || 'Історія клієнта'}</h2>
                <p>
                  {history.phone}
                  {history.client?.networks[0]?.clientSince ? ` · клієнт з ${fmtDateShort(history.client.networks[0].clientSince)}` : ''}
                </p>
              </div>
              <button type="button" className="dw-report-close" onClick={() => setHistory(null)} aria-label="Закрити">✕</button>
            </div>

            {history.client ? (
              <div className="dw-history-nets">
                {history.client.networks.map((n) => (
                  <div key={n.network} className="dw-history-net">
                    <TierBadge client={n} />
                    <b>{n.networkLabel}</b>
                    <span className="dw-dim">клієнт №{n.customerId} · {n.totalBails} застав</span>
                    <a className="dw-net dw-net--btn" href={n.url} target="_blank" rel="noopener noreferrer">↗ Відкрити в Ониксі</a>
                  </div>
                ))}
              </div>
            ) : !historyLoading && (
              <p className="dw-history-empty">Цього номера немає в жодній базі Оникса — клієнт у нас ще не закладався (або записаний на інший номер).</p>
            )}

            {history.client && (() => {
              const sum = (k: keyof OnixNet) => history.client!.networks.reduce((a, n) => a + Number(n[k] || 0), 0)
              const last = history.client.networks.map((n) => n.lastBailAt).filter(Boolean).sort().pop()
              return (
                <div className="dw-history-stats">
                  <div><b>{sum('totalBails')}</b><span>усього застав</span></div>
                  <div><b>{sum('activeBails')}</b><span>активні</span></div>
                  <div><b>{sum('boughtBails')}</b><span>викуплено</span></div>
                  <div><b>{sum('fineBails')}</b><span>прострочено</span></div>
                  <div><b>{sum('soldBails')}</b><span>продано</span></div>
                  <div><b>{last ? fmtDateShort(last) : '—'}</b><span>останній візит</span></div>
                </div>
              )
            })()}

            {history.client && (
              <>
                <div className="dw-history-sec"><span>Останні застави</span>{history.bails.length ? <span>показано {history.bails.length}</span> : null}</div>
                {!history.historyEnabled && <p className="dw-history-empty">Історія застав ще не підключена — статус і лічильники вище з нічного оновлення.</p>}
                {history.onixError && <p className="dw-history-empty">{history.onixError}</p>}
                {history.bails.length > 0 && (
                  <div className="dw-history-table">
                    <table>
                      <tbody>
                        {history.bails.map((b) => (
                          <tr key={`${b.network}-${b.id}`}>
                            <td>{fmtDateShort(b.createdAt)}</td>
                            <td className="dw-history-product">{b.product || '—'}</td>
                            <td className="dw-history-amt">{b.loan.toLocaleString('uk-UA')} ₴</td>
                            <td><span className={`dw-bail dw-bail--${b.statusKind}`}>{b.statusLabel}</span></td>
                            <td>{b.branch}</td>
                            {history.client!.networks.length > 1 && <td className="dw-dim">{b.networkLabel}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {history.hasMore && (
                  <button type="button" className="dw-history-more" disabled={historyLoading} onClick={moreHistory}>
                    {historyLoading ? 'Завантажуємо…' : 'Показати ще 20'}
                  </button>
                )}
              </>
            )}
            {historyLoading && !history.bails.length && <p className="dw-history-empty">Завантажуємо…</p>}

            {history.ours.length > 0 && (
              <>
                <div className="dw-history-sec"><span>Звернення до нас</span><span>сайт і бот</span></div>
                <div className="dw-history-ours">
                  {history.ours.map((o) => (
                    <button type="button" key={o.key} className="dw-related-link" onClick={() => { setHistory(null); openItem(o.key) }}>
                      {CHANNEL_ICON[o.channel]} №{o.key.split(':')[1]} · {o.title} · {fmtDateShort(o.createdAt)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showReport && (
        <div className="dw-report-backdrop" onClick={() => setShowReport(false)}>
          <div className="dw-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dw-report-head">
              <b>Відповіді по співробітниках</b>
              <button type="button" className="dw-report-close" onClick={() => setShowReport(false)} aria-label="Закрити">✕</button>
            </div>

            <div className="dw-views dw-views--row">
              {([['all', 'Увесь час'], ['month', '30 днів'], ['week', '7 днів'], ['today', 'Сьогодні']] as const).map(([p, label]) => (
                <button key={p} type="button" className={`dw-view ${reportPeriod === p ? 'on' : ''}`} onClick={() => setReportPeriod(p)}>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {reportLoading && <p className="dw-hint">Рахуємо…</p>}

            {!reportLoading && report && (
              <>
                <div className="dw-report-summary">
                  <div className="dw-report-stat">
                    <b>{report.total}</b>
                    <span>{pluralUa(report.total, 'заявка', 'заявки', 'заявок')} за період</span>
                  </div>
                  <div className="dw-report-stat">
                    <b>{report.answered}</b>
                    <span>з відповіддю</span>
                  </div>
                  <div className="dw-report-stat">
                    <b>{formatDuration(report.avgReplyMs)}</b>
                    <span>середній час першої відповіді</span>
                  </div>
                </div>

                {report.staff.length === 0 ? (
                  <p className="dw-hint">За цей період відповідей ще не було.</p>
                ) : (
                  <table className="dw-report-table">
                    <thead>
                      <tr><th>Співробітник</th><th>Відповідей</th><th>Сер. час відповіді</th></tr>
                    </thead>
                    <tbody>
                      {report.staff.map((s) => (
                        <tr key={s.name}>
                          <td>{s.name}</td>
                          <td>{s.count}</td>
                          <td>{formatDuration(s.avgReplyMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <p className="dw-hint">
                  Рахується з моменту надходження заявки до першої відповіді в переписці. Заявки-брони сюди не входять.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {showBotFunnel && (
        <div className="dw-report-backdrop" onClick={() => setShowBotFunnel(false)}>
          <div className="dw-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dw-report-head">
              <b>Воронка бота</b>
              <button type="button" className="dw-report-close" onClick={() => setShowBotFunnel(false)} aria-label="Закрити">✕</button>
            </div>

            <div className="dw-views dw-views--row">
              {([['all', 'Увесь час'], ['month', '30 днів'], ['week', '7 днів'], ['today', 'Сьогодні']] as const).map(([p, label]) => (
                <button key={p} type="button" className={`dw-view ${botFunnelPeriod === p ? 'on' : ''}`} onClick={() => setBotFunnelPeriod(p)}>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {botFunnelLoading && <p className="dw-hint">Рахуємо…</p>}

            {!botFunnelLoading && botFunnel && (
              <>
                <table className="dw-report-table">
                  <thead><tr><th>Крок</th><th>Людей</th></tr></thead>
                  <tbody>
                    <tr><td>Натиснули «Старт»</td><td>{botFunnel.start}</td></tr>
                    <tr><td>Вибрали пункт меню</td><td>{botFunnel.menuClick}</td></tr>
                    <tr><td>Поділились номером</td><td>{botFunnel.contactShared}</td></tr>
                    <tr><td>Довели до кінця</td><td>{botFunnel.formCompleted}</td></tr>
                  </tbody>
                </table>

                {botFunnel.byMenu.length > 0 && (
                  <>
                    <p className="dw-section-label">По пунктах меню</p>
                    <table className="dw-report-table">
                      <thead><tr><th>Пункт</th><th>Людей</th></tr></thead>
                      <tbody>
                        {botFunnel.byMenu.map((m) => (
                          <tr key={m.intent}><td>{MENU_LABEL[m.intent] || m.intent}</td><td>{m.count}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                <div className="dw-report-summary">
                  <div className="dw-report-stat">
                    <b>{botFunnel.gotLinkNotStarted}</b>
                    <span>отримали посилання після заявки з сайту, але не почали діалог у боті</span>
                  </div>
                </div>

                <p className="dw-hint">
                  Рахуємо унікальних людей на кожному кроці, не кількість натискань. Співробітники, що теж
                  користуються цим ботом, у підрахунок не входять.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
