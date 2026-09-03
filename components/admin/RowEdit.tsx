'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast, useConfig } from '@payloadcms/ui'

/**
 * Правка значення просто в переліку: подвійний клац по клітинці — і поле
 * готове до введення, Enter зберігає. Заходити в картку не потрібно.
 *
 * Найчастіша робота в адмінці — поміняти ціну за грам або час роботи
 * відділення. Через картку це чотири дії на кожне значення: відкрити,
 * знайти поле, зберегти, повернутись до переліку. Тут — дві.
 *
 * Клітинки, які в один рядок не правляться (місто, фото, вкладені списки),
 * на подвійний клац відкривають картку — так жест ніде не буває мертвим.
 *
 * Тип поля беремо з опису колекції, а не вгадуємо за виглядом значення:
 * «правда» в клітинці може бути і галочкою, і текстом.
 */

type FieldDef = {
  path: string[]
  type: string
  label: string
  options?: { label: string; value: string }[]
  localized?: boolean
  required?: boolean
  readOnly?: boolean
}

/** Типи, які має сенс правити однією клітинкою. */
const EDITABLE = new Set(['text', 'textarea', 'number', 'email', 'checkbox', 'select', 'date'])

/** Клітинка в розмітці Payload має клас cell-<шлях>, вкладене поле — cell-<група>__<поле>. */
function pathFromCell(td: HTMLElement): string[] | null {
  const cls = [...td.classList].find((c) => c.startsWith('cell-'))
  if (!cls) return null
  const raw = cls.slice('cell-'.length)
  if (!raw || raw.startsWith('_')) return null
  return raw.split('__')
}

/** Розкладаємо поля колекції (з групами) у плоскі шляхи. */
function flatten(fields: unknown[], prefix: string[] = []): FieldDef[] {
  const out: FieldDef[] = []
  for (const f of fields as Record<string, unknown>[]) {
    const type = String(f.type)
    const name = f.name ? String(f.name) : ''
    if (type === 'group' && Array.isArray(f.fields)) {
      out.push(...flatten(f.fields, [...prefix, name]))
      continue
    }
    if (type === 'row' || type === 'collapsible') {
      if (Array.isArray(f.fields)) out.push(...flatten(f.fields, prefix))
      continue
    }
    if (!name) continue
    out.push({
      path: [...prefix, name],
      type,
      label: typeof f.label === 'string' ? f.label : name,
      options: Array.isArray(f.options)
        ? (f.options as Record<string, unknown>[]).map((o) => ({
          label: String(typeof o.label === 'string' ? o.label : o.value),
          value: String(o.value),
        }))
        : undefined,
      localized: Boolean(f.localized),
      required: Boolean(f.required),
      // Поля лише для читання збираються самі — правити їх у переліку нема сенсу
      readOnly: Boolean((f.admin as Record<string, unknown> | undefined)?.readOnly),
    })
  }
  return out
}

const at = (obj: unknown, path: string[]): unknown =>
  path.reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj)

/** Значення в тіло запиту: coords.lat → { coords: { lat: … } }. */
function nest(path: string[], value: unknown): Record<string, unknown> {
  return path.length === 1
    ? { [path[0]]: value }
    : { [path[0]]: nest(path.slice(1), value) }
}

type Editing = {
  collection: string
  id: string
  field: FieldDef
  rect: { top: number; left: number; width: number; height: number }
  value: string
}

export default function RowEdit({ children }: { children?: React.ReactNode }) {
  const { config } = useConfig()
  const router = useRouter()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  const apiBase = String(config?.routes?.api || '/api')
  const adminBase = String(config?.routes?.admin || '/admin')

  const locale = useCallback(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('locale')
    const def = (config as Record<string, unknown>)?.localization
    const fallback = def && typeof def === 'object' ? String((def as Record<string, unknown>).defaultLocale || '') : ''
    return fromUrl || fallback || ''
  }, [config])

  const save = useCallback(async (item: Editing, raw: unknown) => {
    setBusy(true)
    setError(null)
    try {
      const loc = item.field.localized ? locale() : ''
      const url = `${apiBase}/${item.collection}/${item.id}${loc ? `?locale=${encodeURIComponent(loc)}` : ''}`
      const res = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nest(item.field.path, raw)),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const first = body?.errors?.[0]
        const detail = first?.data?.errors?.[0]?.message || first?.message
        throw new Error(detail || 'Не збереглося')
      }
      setEditing(null)
      toast.success(`${item.field.label}: збережено`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не збереглося')
    } finally {
      setBusy(false)
    }
  }, [apiBase, locale, router])

  useEffect(() => {
    const onDouble = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || editing) return
      if (target.closest('a, button, input, select, textarea, [role="button"]')) return

      const td = target.closest('td') as HTMLElement | null
      const row = target.closest('tbody tr') as HTMLElement | null
      if (!td || !row) return

      const link = row.querySelector<HTMLAnchorElement>(`a[href*="${adminBase}/collections/"]`)
      const openCard = () => { if (link) { e.preventDefault(); link.click() } }

      const match = link?.getAttribute('href')?.match(/\/collections\/([^/]+)\/([^/?#]+)/)
      const collection = match?.[1]
      const id = row.dataset.id || match?.[2]
      const path = pathFromCell(td)
      if (!collection || !id || !path) { openCard(); return }

      const cfg = (config?.collections || []).find((c) => String(c.slug) === collection)
      const field = cfg ? flatten((cfg.fields || []) as unknown[]).find((f) => f.path.join('.') === path.join('.')) : undefined

      // Поле, яке в один рядок не правиться, поводиться як раніше — відкриває картку
      if (!field || !EDITABLE.has(field.type) || field.readOnly) { openCard(); return }

      e.preventDefault()
      window.getSelection()?.removeAllRanges()

      const doc = await fetch(`${apiBase}/${collection}/${id}?depth=0`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
      if (!doc) { openCard(); return }

      const current = at(doc, field.path)

      // Галочка не потребує поля введення: подвійний клац одразу перемикає її
      if (field.type === 'checkbox') {
        await save({ collection, id, field, rect: { top: 0, left: 0, width: 0, height: 0 }, value: '' }, !current)
        return
      }

      const r = td.getBoundingClientRect()
      setError(null)
      setEditing({
        collection, id, field,
        rect: { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height },
        value: current == null ? '' : String(field.type === 'date' ? String(current).slice(0, 10) : current),
      })
    }

    document.addEventListener('dblclick', onDouble)
    return () => document.removeEventListener('dblclick', onDouble)
  }, [adminBase, apiBase, config, editing, save])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    if (!editing || busy) return
    const t = editing.field.type
    const v = editing.value.trim()
    if (t === 'number') {
      if (v === '') return void save(editing, null)
      const n = Number(v.replace(',', '.'))
      if (Number.isNaN(n)) { setError('Потрібне число'); return }
      return void save(editing, n)
    }
    void save(editing, v === '' ? null : editing.value)
  }

  return (
    <>
      {children}
      {editing && createPortal(
        <div
          className="rowedit"
          style={{
            position: 'absolute',
            top: editing.rect.top - 4,
            left: editing.rect.left - 4,
            minWidth: Math.max(editing.rect.width + 8, 160),
            zIndex: 90,
          }}
        >
          {editing.field.type === 'select' && editing.field.options ? (
            <select
              ref={(el) => { inputRef.current = el }}
              className="rowedit__in"
              value={editing.value}
              disabled={busy}
              onChange={(ev) => setEditing({ ...editing, value: ev.target.value })}
              onBlur={commit}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); commit() }
                if (ev.key === 'Escape') setEditing(null)
              }}
            >
              <option value="">—</option>
              {editing.field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input
              ref={(el) => { inputRef.current = el }}
              className="rowedit__in"
              type={editing.field.type === 'number' ? 'text' : editing.field.type === 'date' ? 'date' : 'text'}
              inputMode={editing.field.type === 'number' ? 'decimal' : undefined}
              value={editing.value}
              disabled={busy}
              onChange={(ev) => setEditing({ ...editing, value: ev.target.value })}
              onBlur={commit}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); commit() }
                if (ev.key === 'Escape') setEditing(null)
              }}
            />
          )}
          <span className="rowedit__hint">{editing.field.label} · Enter зберігає, Esc скасовує</span>
          {error && <span className="rowedit__err">{error}</span>}
        </div>,
        document.body,
      )}
      <style>{`
        .rowedit { display: grid; gap: 2px; }
        .rowedit__in {
          font: inherit; font-size: 13px; padding: 5px 8px;
          border: 2px solid var(--theme-success-500, #3ba55d);
          border-radius: 4px; background: var(--theme-input-bg, #fff);
          color: var(--theme-elevation-800, #111); width: 100%;
          box-shadow: 0 6px 20px rgba(0,0,0,.18);
        }
        .rowedit__in:disabled { opacity: .6; }
        .rowedit__hint {
          font-size: 10px; line-height: 1.3; color: var(--theme-elevation-0, #fff);
          background: var(--theme-elevation-800, #222); padding: 2px 6px; border-radius: 3px;
          justify-self: start;
        }
        .rowedit__err {
          font-size: 11px; color: var(--theme-elevation-0, #fff);
          background: var(--theme-error-500, #c0392b); padding: 3px 6px; border-radius: 3px;
          justify-self: start; max-width: 320px;
        }
      `}</style>
    </>
  )
}
