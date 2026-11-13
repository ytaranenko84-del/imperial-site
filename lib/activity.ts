/**
 * Коли звернення востаннє «ожило» для команди: написав клієнт, його щойно
 * передали в цей відділ, або воно тільки-но створене. За цим часом
 * робочий стіл піднімає звернення вгору — як чат у Telegram.
 *
 * Відповіді, перегляди, призначення співробітників сюди не входять:
 * інакше список стрибав би від власних дій команди.
 */
export function lastClientActivity(d: { createdAt?: unknown; thread?: unknown; transfers?: unknown }): string {
  let best = toMs(d.createdAt) || Date.now()
  const thread = Array.isArray(d.thread) ? (d.thread as { from?: unknown; at?: unknown }[]) : []
  for (const t of thread) {
    if (t?.from !== 'клієнт') continue
    const ms = toMs(t.at)
    if (ms > best) best = ms
  }
  const transfers = Array.isArray(d.transfers) ? (d.transfers as { at?: unknown }[]) : []
  for (const t of transfers) {
    const ms = toMs(t?.at)
    if (ms > best) best = ms
  }
  return new Date(best).toISOString()
}

function toMs(v: unknown): number {
  if (!v) return 0
  const ms = new Date(String(v)).getTime()
  return Number.isFinite(ms) ? ms : 0
}
