import * as XLSX from 'xlsx'

export type ParsedTariff = {
  metal: 'gold' | 'silver'
  purity: number | null
  purityLabel: string
  purchasePrice: number | null
  basePrice: number
  order: number
}

export type ParseResult = {
  approvedAt: string | null
  tariffs: ParsedTariff[]
  notes: string[]
  warnings: string[]
}

const num = (v: unknown): number | null => {
  if (typeof v === 'number' && isFinite(v)) return v
  const s = String(v ?? '').replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isFinite(n) ? n : null
}

/**
 * Розбирає файл «прайс золото_срібло».
 * Бере ЛИШЕ перший лист — на решті листів лежать старі прайси минулих років.
 * З таблиці читаються тільки скупка та базова ціна: ціни за статусами
 * рахуються з надбавок у розділі «Програма лояльності».
 */
export function parsePriceFile(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { approvedAt: null, tariffs: [], notes: [], warnings: ['Файл порожній'] }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' })
  const cell = (r: unknown[], i: number) => String(r?.[i] ?? '').trim()

  const out: ParseResult = { approvedAt: null, tariffs: [], notes: [], warnings: [] }
  let metal: 'gold' | 'silver' | null = null
  let order = 0

  for (const row of rows) {
    const first = cell(row, 0)
    const lower = first.toLowerCase()

    // Дата затвердження. У файлі вона стоїть не в першій колонці, а праворуч,
    // і буває як текстом «24.08.2026р.», так і датою Excel — шукаємо в усьому рядку.
    if (!out.approvedAt) {
      for (const raw of row) {
        if (raw instanceof Date && !isNaN(raw.getTime())) {
          out.approvedAt = raw.toISOString().slice(0, 10)
          break
        }
        const d = String(raw ?? '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
        if (d) {
          out.approvedAt = `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`
          break
        }
      }
    }

    if (/^золото$/i.test(first)) { metal = 'gold'; continue }
    if (/^(срібло|серебро)$/i.test(first)) { metal = 'silver'; continue }
    if (/^проба$/i.test(first)) continue                    // шапка таблиці
    if (/затверджено|утвержда/i.test(lower)) continue

    if (!first) continue

    const values = row.slice(1).map(num).filter((v): v is number => v !== null && v > 0)

    // рядок без цін, у якому багато слів — це примітка під таблицею
    const words = first.split(/\s+/).filter((w) => /\p{L}{3,}/u.test(w))
    if (!values.length && words.length >= 3) { out.notes.push(first); continue }
    if (!metal || !values.length) continue

    const purityNum = num(first.replace(/[^\d.,]/g, '').split(/[,\s]/)[0])

    if (metal === 'gold') {
      // Проба | Покупка | Базова | Новий | Смарагдовий | Рубіновий | Діамантовий
      const [purchase, base] = values
      if (base == null) continue
      out.tariffs.push({
        metal, purity: purityNum, purityLabel: first,
        purchasePrice: purchase != null ? Math.round(purchase) : null,
        basePrice: Math.round(base),
        order: order++,
      })
    } else {
      // Проба | Базова | Смарагдовий | Рубіновий | Діамантовий.
      // Колонки скупки немає: за сріблом скупка дорівнює базовій ціні.
      const base = Math.round(values[0])
      out.tariffs.push({
        metal, purity: purityNum, purityLabel: first,
        purchasePrice: base, basePrice: base, order: order++,
      })
    }
  }

  if (!out.tariffs.length) out.warnings.push('У файлі не знайдено жодного тарифу')
  if (!out.approvedAt) out.warnings.push('Не знайдено дату затвердження — проставте вручну')
  return out
}
