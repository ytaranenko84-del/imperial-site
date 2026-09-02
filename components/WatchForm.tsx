'use client'
import React, { useRef, useState } from 'react'

/** Три перші знімки обов'язкові: без них оцінити модель неможливо. */
export const SHOTS: [string, string, boolean][] = [
  ['Циферблат повністю', 'Прямо, без відблисків. Видно марку, модель і стан стрілок.', true],
  ['Задня кришка', 'Гравіювання, номер корпусу, гвинти. Якщо кришка прозора — видно механізм.', true],
  ['Серійний номер і референс', 'Крупно. У більшості марок — між вушками або на кришці.', true],
  ['Застібка й браслет', 'Клеймо на застібці, стан ланок, наявність зайвих ланок.', false],
  ['Комплект', 'Коробка, паспорт, сервісна книжка — усе, що збереглося.', false],
  ['Пошкодження', 'Подряпини, вм’ятини, тріщини. Не зменшують шанс — прискорюють оцінку.', false],
]

const CONDITIONS = ['Не знаю', 'Як новий', 'Відмінний', 'Добрий',
  'Робочий, зі слідами носіння', 'Потребує ремонту']

type State = 'idle' | 'sending' | 'sent'

export default function WatchForm({ brands }: { brands: string[] }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [filled, setFilled] = useState<Record<number, string>>({})
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = formRef.current
    if (!form) return
    const data = new FormData(form)

    if (!data.getAll('photos').some((f) => f instanceof File && f.size > 0)) {
      setError('Додайте хоча б одне фото годинника')
      return
    }

    setState('sending')
    try {
      // спільний роут на всі напрямки; годинники позначені окремим ключем
      data.set('category', 'watches')
      const res = await fetch('/api/eval-request', { method: 'POST', body: data })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Не вдалося надіслати заявку')
      setState('sent')
      form.reset()
      setFilled({})
    } catch (err) {
      setState('idle')
      setError((err as Error).message)
    }
  }

  if (state === 'sent') {
    return (
      <div className="wform wform--done">
        <b>Заявку прийнято</b>
        <p>Фахівець відповість протягом робочого дня на вказаний номер.
          Якщо питання термінове — телефонуйте на гарячу лінію.</p>
        <button className="wbtn" type="button" onClick={() => setState('idle')}>
          Надіслати ще одну
        </button>
      </div>
    )
  }

  return (
    <form className="wform" ref={formRef} onSubmit={submit} noValidate>
      <div className="wgrid">
        <p>
          <label htmlFor="wf-name">Ім’я <span className="req">*</span></label>
          <input id="wf-name" name="name" type="text" required maxLength={120}
            placeholder="Як до вас звертатися" autoComplete="name" />
        </p>
        <p>
          <label htmlFor="wf-phone">Телефон <span className="req">*</span></label>
          <input id="wf-phone" name="phone" type="tel" required maxLength={40}
            placeholder="+380" autoComplete="tel" />
        </p>
      </div>

      <div className="wgrid">
        <p>
          <label htmlFor="wf-brand">Марка <span className="req">*</span></label>
          <select id="wf-brand" name="brand" required defaultValue="">
            <option value="" disabled>Оберіть марку</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
            <option>Інша</option>
          </select>
        </p>
        <p>
          <label htmlFor="wf-model">Модель або референс <span className="req">*</span></label>
          <input id="wf-model" name="model" type="text" required maxLength={120}
            placeholder="Наприклад, Datejust 126334" />
        </p>
      </div>

      <div className="wgrid">
        <p>
          <label htmlFor="wf-year">Рік придбання</label>
          <input id="wf-year" name="year" type="text" maxLength={20} placeholder="Якщо пам’ятаєте" />
        </p>
        <p>
          <label htmlFor="wf-cond">Стан</label>
          <select id="wf-cond" name="condition" defaultValue={CONDITIONS[0]}>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </p>
      </div>

      <div className="wfield">
        <h3>Фотографії <span className="req">*</span></h3>
        <p className="wnote">
          Достатньо телефона. Знімайте при денному світлі, без спалаху, протріть скло —
          відблиск ховає саме те, що потрібно фахівцю.
        </p>
        <div className="wshots">
          {SHOTS.map(([title, hint, must], i) => (
            <label key={title} className={`wslot${filled[i] ? ' wslot--on' : ''}`}>
              <em>{must ? 'обов’язково' : 'бажано'}</em>
              <b>{title}</b>
              <span>{filled[i] || hint}</span>
              <input
                type="file" name="photos" accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setFilled((s) => ({ ...s, [i]: f ? `✓ ${f.name}` : '' }))
                }}
              />
            </label>
          ))}
        </div>
        <p className="wtips">
          Не обрізайте краї корпусу — по них видно стан. Якщо є документи чи чек,
          сфотографуйте окремо. Ми не публікуємо ваші знімки й не передаємо третім особам.
        </p>
      </div>

      <p className="wfield">
        <label htmlFor="wf-comment">Що ще варто знати</label>
        <textarea id="wf-comment" name="comment" rows={3} maxLength={2000}
          placeholder="Обслуговування, заміна деталей, потрібна сума — якщо є побажання" />
      </p>

      {/* приманка для роботів: людина цього поля не бачить */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="wtrap" />

      <label className="wagree">
        <input type="checkbox" required />
        <span>Погоджуюсь на обробку персональних даних для оцінки. Оцінка за фото попередня;
          остаточна сума визначається після огляду фахівцем у відділенні.</span>
      </label>

      {error && <p className="werr">{error}</p>}

      <button className="wbtn wbtn--send" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Надсилаємо…' : 'Надіслати на оцінку'}
      </button>
    </form>
  )
}
