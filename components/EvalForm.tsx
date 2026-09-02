'use client'
import React, { useRef, useState } from 'react'

const CONDITIONS = ['Не знаю', 'Як новий', 'Відмінний', 'Добрий',
  'Робочий, зі слідами використання', 'Потребує ремонту']

type Props = {
  /** ключ напрямку: digital, home, tools, sport, watches */
  category: string
  /** підказки, що фотографувати: [заголовок, пояснення] */
  shots: [string, string][]
  example: string
  /** для годинників — список марок; для решти марка вводиться текстом */
  brands?: string[]
}

type State = 'form' | 'sending' | 'sent'

export default function EvalForm({ category, shots, example, brands }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [filled, setFilled] = useState<Record<number, string>>({})
  const [state, setState] = useState<State>('form')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = formRef.current
    if (!form) return

    setState('sending')
    try {
      const res = await fetch('/api/eval-request', { method: 'POST', body: new FormData(form) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Не вдалося надіслати заявку')
      setState('sent')
      form.reset()
      setFilled({})
    } catch (err) {
      setState('form')
      setError((err as Error).message)
    }
  }

  if (state === 'sent') {
    return (
      <div className="eform eform--done">
        <b>Заявку прийнято</b>
        <p>
          Фахівець відповість протягом робочого дня на вказаний номер.
          Якщо питання термінове — телефонуйте на гарячу лінію.
        </p>
        <button className="pill" type="button" onClick={() => setState('form')}>
          Надіслати ще одну
        </button>
      </div>
    )
  }

  return (
    <form className="eform" ref={formRef} onSubmit={submit}>
      <input type="hidden" name="category" value={category} />

      <div className="eg2">
        <p>
          <label htmlFor="ef-name">Ім’я <span className="req">*</span></label>
          <input id="ef-name" name="name" type="text" required maxLength={120}
            placeholder="Як до вас звертатися" autoComplete="name" />
        </p>
        <p>
          <label htmlFor="ef-phone">Телефон <span className="req">*</span></label>
          <input id="ef-phone" name="phone" type="tel" required maxLength={40}
            placeholder="+380" autoComplete="tel" />
        </p>
      </div>

      <div className="eg2">
        <p>
          <label htmlFor="ef-brand">Марка {!brands && <span className="req">*</span>}</label>
          {brands ? (
            <select id="ef-brand" name="brand" required defaultValue="">
              <option value="" disabled>Оберіть марку</option>
              {brands.map((b) => <option key={b}>{b}</option>)}
              <option>Інша</option>
            </select>
          ) : (
            <input id="ef-brand" name="brand" type="text" required maxLength={80}
              placeholder="Наприклад, Bosch" />
          )}
        </p>
        <p>
          <label htmlFor="ef-model">Модель <span className="req">*</span></label>
          <input id="ef-model" name="model" type="text" required maxLength={120}
            placeholder={`Наприклад, ${example}`} />
        </p>
      </div>

      <div className="eg2">
        <p>
          <label htmlFor="ef-year">Рік придбання</label>
          <input id="ef-year" name="year" type="text" maxLength={20} placeholder="Якщо пам’ятаєте" />
        </p>
        <p>
          <label htmlFor="ef-cond">Стан</label>
          <select id="ef-cond" name="condition" defaultValue={CONDITIONS[0]}>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </p>
      </div>

      <div className="efield">
        <h3>Фотографії</h3>
        <p className="ehint">
          Жодне фото не обов’язкове — надішліть хоча б одне, і ми відповімо. Але оцінка настільки
          точна, наскільки повно ви покажете річ: за одним кадром назвемо приблизний діапазон,
          за повним набором — суму, яку підтвердимо у відділенні, якщо не виявиться прихованих
          дефектів, які не потрапили в кадр. Достатньо телефона: денне світло, без спалаху.
        </p>
        <div className="eshots">
          {shots.map(([title, hint], i) => (
            <label key={title} className={`eslot${filled[i] ? ' eslot--on' : ''}`}>
              <b>{title}</b>
              <span>{filled[i] || hint}</span>
              <input type="file" name="photos" accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setFilled((s) => ({ ...s, [i]: f ? `✓ ${f.name}` : '' }))
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <p className="efield">
        <label htmlFor="ef-comment">Що ще варто знати</label>
        <textarea id="ef-comment" name="comment" rows={3} maxLength={2000}
          placeholder="Ремонти, комплект, потрібна сума — якщо є побажання" />
      </p>

      {/* приманка для роботів */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="etrap" />

      <label className="eagree">
        <input type="checkbox" required />
        <span>Погоджуюсь на обробку персональних даних. Оцінка за фото попередня;
          остаточну суму визначає оцінювач після огляду речі.</span>
      </label>

      {error && <p className="eerr">{error}</p>}

      <button className="pill esend" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Надсилаємо…' : 'Надіслати на оцінку'}
      </button>
      <p className="efine">Відповідь протягом робочого дня. Нічого везти не треба — спершу фото.</p>
    </form>
  )
}
