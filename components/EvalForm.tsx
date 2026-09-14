'use client'
import React, { useRef, useState } from 'react'

import { trackLead } from '@/lib/analytics.ts'

const CONDITIONS: Record<'uk' | 'ru', string[]> = {
  uk: ['Не знаю', 'Як новий', 'Відмінний', 'Добрий', 'Робочий, зі слідами використання', 'Потребує ремонту'],
  ru: ['Не знаю', 'Как новый', 'Отличное', 'Хорошее', 'Рабочее, со следами использования', 'Требует ремонта'],
}

const EF = {
  uk: {
    name: 'Ім’я', namePh: 'Як до вас звертатися', phone: 'Телефон',
    brand: 'Марка', chooseBrand: 'Оберіть марку', other: 'Інша', brandPh: 'Наприклад, Bosch',
    model: 'Модель', modelPh: (ex: string) => `Наприклад, ${ex}`,
    year: 'Рік придбання', yearPh: 'Якщо пам’ятаєте', cond: 'Стан',
    photosTitle: 'Фотографії',
    photosHint: 'Жодне фото не обов’язкове — надішліть хоча б одне, і ми відповімо. Але оцінка настільки '
      + 'точна, наскільки повно ви покажете річ: за одним кадром назвемо приблизний діапазон, '
      + 'за повним набором — суму, яку підтвердимо у відділенні, якщо не виявиться прихованих '
      + 'дефектів, які не потрапили в кадр. Достатньо телефона: денне світло, без спалаху.',
    comment: 'Що ще варто знати', commentPh: 'Ремонти, комплект, потрібна сума — якщо є побажання',
    agree: 'Погоджуюсь на обробку персональних даних. Оцінка за фото попередня; остаточну суму визначає оцінювач після огляду речі.',
    sending: 'Надсилаємо…', send: 'Надіслати на оцінку',
    fine: 'Відповідь протягом робочого дня. Нічого везти не треба — спершу фото.',
    errFallback: 'Не вдалося надіслати заявку',
    doneTitle: 'Заявку прийнято',
    doneText: 'Фахівець відповість протягом робочого дня на вказаний номер. Якщо питання термінове — телефонуйте на гарячу лінію.',
    tgLink: 'Отримати відповідь у Telegram',
    tgHint: 'Натисніть, щоб листуватися з оцінювачем у Telegram. Не натиснете — просто зателефонуємо.',
    another: 'Надіслати ще одну',
  },
  ru: {
    name: 'Имя', namePh: 'Как к вам обращаться', phone: 'Телефон',
    brand: 'Марка', chooseBrand: 'Выберите марку', other: 'Другая', brandPh: 'Например, Bosch',
    model: 'Модель', modelPh: (ex: string) => `Например, ${ex}`,
    year: 'Год покупки', yearPh: 'Если помните', cond: 'Состояние',
    photosTitle: 'Фотографии',
    photosHint: 'Ни одно фото не обязательно — пришлите хотя бы одно, и мы ответим. Но оценка настолько '
      + 'точна, насколько полно вы покажете вещь: по одному кадру назовём примерный диапазон, '
      + 'по полному набору — сумму, которую подтвердим в отделении, если не обнаружится скрытых '
      + 'дефектов, не попавших в кадр. Достаточно телефона: дневной свет, без вспышки.',
    comment: 'Что ещё стоит знать', commentPh: 'Ремонты, комплект, нужная сумма — если есть пожелания',
    agree: 'Соглашаюсь на обработку персональных данных. Оценка по фото предварительная; окончательную сумму определяет оценщик после осмотра вещи.',
    sending: 'Отправляем…', send: 'Отправить на оценку',
    fine: 'Ответ в течение рабочего дня. Ничего везти не нужно — сначала фото.',
    errFallback: 'Не удалось отправить заявку',
    doneTitle: 'Заявка принята',
    doneText: 'Специалист ответит в течение рабочего дня на указанный номер. Если вопрос срочный — звоните на горячую линию.',
    tgLink: 'Получить ответ в Telegram',
    tgHint: 'Нажмите, чтобы переписываться с оценщиком в Telegram. Не нажмёте — просто позвоним.',
    another: 'Отправить ещё одну',
  },
} satisfies Record<'uk' | 'ru', unknown>

type Props = {
  /** ключ напрямку: digital, home, tools, sport, watches */
  category: string
  /** підказки, що фотографувати: [заголовок, пояснення] */
  shots: [string, string][]
  example: string
  /** для годинників — список марок; для решти марка вводиться текстом */
  brands?: string[]
  locale?: 'uk' | 'ru'
}

type State = 'form' | 'sending' | 'sent'

export default function EvalForm({ category, shots, example, brands, locale = 'uk' }: Props) {
  const ef = EF[locale]
  const conditions = CONDITIONS[locale]
  const formRef = useRef<HTMLFormElement>(null)
  const [filled, setFilled] = useState<Record<number, string>>({})
  const [state, setState] = useState<State>('form')
  const [error, setError] = useState<string | null>(null)
  // посилання на бота з міткою саме цієї заявки
  const [botLink, setBotLink] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = formRef.current
    if (!form) return

    setState('sending')
    try {
      const res = await fetch('/api/eval-request', { method: 'POST', body: new FormData(form) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || ef.errFallback)
      setBotLink(json.botLink || null)
      trackLead(`eval-${category}`)
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
        <b>{ef.doneTitle}</b>
        <p>{ef.doneText}</p>

        {botLink && (
          <>
            <a className="tgbtn" href={botLink} target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21.94 4.9 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.15c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.13 12.4 2.55 10.97c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.28 2.31Z" />
              </svg>
              {ef.tgLink}
            </a>
            <p className="efine">{ef.tgHint}</p>
          </>
        )}

        <button className="pill" type="button" onClick={() => setState('form')}>
          {ef.another}
        </button>
      </div>
    )
  }

  return (
    <form className="eform" ref={formRef} onSubmit={submit}>
      <input type="hidden" name="category" value={category} />

      <div className="eg2">
        <p>
          <label htmlFor="ef-name">{ef.name} <span className="req">*</span></label>
          <input id="ef-name" name="name" type="text" required maxLength={120}
            placeholder={ef.namePh} autoComplete="name" />
        </p>
        <p>
          <label htmlFor="ef-phone">{ef.phone} <span className="req">*</span></label>
          <input id="ef-phone" name="phone" type="tel" required maxLength={40}
            placeholder="+380" autoComplete="tel" />
        </p>
      </div>

      <div className="eg2">
        <p>
          <label htmlFor="ef-brand">{ef.brand} {!brands && <span className="req">*</span>}</label>
          {brands ? (
            <select id="ef-brand" name="brand" required defaultValue="">
              <option value="" disabled>{ef.chooseBrand}</option>
              {brands.map((b) => <option key={b}>{b}</option>)}
              <option>{ef.other}</option>
            </select>
          ) : (
            <input id="ef-brand" name="brand" type="text" required maxLength={80}
              placeholder={ef.brandPh} />
          )}
        </p>
        <p>
          <label htmlFor="ef-model">{ef.model} <span className="req">*</span></label>
          <input id="ef-model" name="model" type="text" required maxLength={120}
            placeholder={ef.modelPh(example)} />
        </p>
      </div>

      <div className="eg2">
        <p>
          <label htmlFor="ef-year">{ef.year}</label>
          <input id="ef-year" name="year" type="text" maxLength={20} placeholder={ef.yearPh} />
        </p>
        <p>
          <label htmlFor="ef-cond">{ef.cond}</label>
          <select id="ef-cond" name="condition" defaultValue={conditions[0]}>
            {conditions.map((c) => <option key={c}>{c}</option>)}
          </select>
        </p>
      </div>

      <div className="efield">
        <h3>{ef.photosTitle}</h3>
        <p className="ehint">{ef.photosHint}</p>
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
        <label htmlFor="ef-comment">{ef.comment}</label>
        <textarea id="ef-comment" name="comment" rows={3} maxLength={2000}
          placeholder={ef.commentPh} />
      </p>

      {/* приманка для роботів */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="etrap" />

      <label className="eagree">
        <input type="checkbox" required />
        <span>{ef.agree}</span>
      </label>

      {error && <p className="eerr">{error}</p>}

      <button className="pill esend" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? ef.sending : ef.send}
      </button>
      <p className="efine">{ef.fine}</p>
    </form>
  )
}
