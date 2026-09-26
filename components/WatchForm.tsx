'use client'
import React, { useEffect, useRef, useState } from 'react'

import { trackLead } from '@/lib/analytics.ts'
import { compressImage } from '@/lib/compress-image.ts'

/** Три перші знімки обов'язкові: без них оцінити модель неможливо. */
export const SHOTS: Record<'uk' | 'ru', [string, string, boolean][]> = {
  uk: [
    ['Циферблат повністю', 'Прямо, без відблисків. Видно марку, модель і стан стрілок.', true],
    ['Задня кришка', 'Гравіювання, номер корпусу, гвинти. Якщо кришка прозора — видно механізм.', true],
    ['Серійний номер і референс', 'Крупно. У більшості марок — між вушками або на кришці.', true],
    ['Застібка й браслет', 'Клеймо на застібці, стан ланок, наявність зайвих ланок.', false],
    ['Комплект', 'Коробка, паспорт, сервісна книжка — усе, що збереглося.', false],
    ['Пошкодження', 'Подряпини, вм’ятини, тріщини. Не зменшують шанс — прискорюють оцінку.', false],
  ],
  ru: [
    ['Циферблат целиком', 'Прямо, без бликов. Видна марка, модель и состояние стрелок.', true],
    ['Задняя крышка', 'Гравировка, номер корпуса, винты. Если крышка прозрачная — виден механизм.', true],
    ['Серийный номер и референс', 'Крупно. У большинства марок — между ушками или на крышке.', true],
    ['Застёжка и браслет', 'Клеймо на застёжке, состояние звеньев, наличие лишних звеньев.', false],
    ['Комплект', 'Коробка, паспорт, сервисная книжка — всё, что сохранилось.', false],
    ['Повреждения', 'Царапины, вмятины, трещины. Не снижают шанс — ускоряют оценку.', false],
  ],
}

const CONDITIONS: Record<'uk' | 'ru', string[]> = {
  uk: ['Не знаю', 'Як новий', 'Відмінний', 'Добрий', 'Робочий, зі слідами носіння', 'Потребує ремонту'],
  ru: ['Не знаю', 'Как новые', 'Отличное', 'Хорошее', 'Рабочее, со следами носки', 'Требует ремонта'],
}

const WT = {
  uk: {
    name: 'Ім’я', namePh: 'Як до вас звертатися', phone: 'Телефон',
    brand: 'Марка', chooseBrand: 'Оберіть марку', other: 'Інша',
    model: 'Модель або референс', modelPh: 'Наприклад, Datejust 126334',
    year: 'Рік придбання', yearPh: 'Якщо пам’ятаєте', cond: 'Стан',
    photosTitle: 'Фотографії', required: 'обов’язково', desired: 'бажано',
    photosNote: 'Достатньо телефона. Знімайте при денному світлі, без спалаху, протріть скло — '
      + 'відблиск ховає саме те, що потрібно фахівцю.',
    tips: 'Не обрізайте краї корпусу — по них видно стан. Якщо є документи чи чек, '
      + 'сфотографуйте окремо. Ми не публікуємо ваші знімки й не передаємо третім особам.',
    comment: 'Що ще варто знати', commentPh: 'Обслуговування, заміна деталей, потрібна сума — якщо є побажання',
    agree: 'Погоджуюсь на обробку персональних даних для оцінки. Оцінка за фото попередня; остаточна сума визначається після огляду фахівцем у відділенні.',
    sending: 'Надсилаємо…', send: 'Надіслати на оцінку', compressing: 'Обробляємо фото…',
    errNoPhotos: 'Додайте хоча б одне фото годинника', errFallback: 'Не вдалося надіслати заявку',
    doneTitle: 'Заявку прийнято',
    doneText: 'Фахівець відповість протягом робочого дня на вказаний номер. Якщо питання термінове — телефонуйте на гарячу лінію.',
    tgLink: 'Отримати відповідь у Telegram', tgHint: 'Натисніть, щоб листуватися з оцінювачем у Telegram.',
    another: 'Надіслати ще одну',
  },
  ru: {
    name: 'Имя', namePh: 'Как к вам обращаться', phone: 'Телефон',
    brand: 'Марка', chooseBrand: 'Выберите марку', other: 'Другая',
    model: 'Модель или референс', modelPh: 'Например, Datejust 126334',
    year: 'Год покупки', yearPh: 'Если помните', cond: 'Состояние',
    photosTitle: 'Фотографии', required: 'обязательно', desired: 'желательно',
    photosNote: 'Достаточно телефона. Снимайте при дневном свете, без вспышки, протрите стекло — '
      + 'блик скрывает именно то, что нужно специалисту.',
    tips: 'Не обрезайте края корпуса — по ним видно состояние. Если есть документы или чек, '
      + 'сфотографируйте отдельно. Мы не публикуем ваши снимки и не передаём третьим лицам.',
    comment: 'Что ещё стоит знать', commentPh: 'Обслуживание, замена деталей, нужная сумма — если есть пожелания',
    agree: 'Соглашаюсь на обработку персональных данных для оценки. Оценка по фото предварительная; окончательная сумма определяется после осмотра специалистом в отделении.',
    sending: 'Отправляем…', send: 'Отправить на оценку', compressing: 'Обрабатываем фото…',
    errNoPhotos: 'Добавьте хотя бы одно фото часов', errFallback: 'Не удалось отправить заявку',
    doneTitle: 'Заявка принята',
    doneText: 'Специалист ответит в течение рабочего дня на указанный номер. Если вопрос срочный — звоните на горячую линию.',
    tgLink: 'Получить ответ в Telegram', tgHint: 'Нажмите, чтобы переписываться с оценщиком в Telegram.',
    another: 'Отправить ещё одну',
  },
} satisfies Record<'uk' | 'ru', unknown>

type State = 'idle' | 'sending' | 'sent'

export default function WatchForm({ brands, locale = 'uk' }: { brands: string[]; locale?: 'uk' | 'ru' }) {
  const wt = WT[locale]
  const shots = SHOTS[locale]
  const conditions = CONDITIONS[locale]
  const formRef = useRef<HTMLFormElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const [filled, setFilled] = useState<Record<number, string>>({})
  const [photoFiles, setPhotoFiles] = useState<Record<number, File>>({})
  const [compressing, setCompressing] = useState(0)
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)
  const [botLink, setBotLink] = useState<string | null>(null)

  async function pickPhoto(i: number, f: File | undefined) {
    if (!f) {
      setFilled((s) => { const n = { ...s }; delete n[i]; return n })
      setPhotoFiles((s) => { const n = { ...s }; delete n[i]; return n })
      return
    }
    setFilled((s) => ({ ...s, [i]: `✓ ${f.name}` }))
    setCompressing((c) => c + 1)
    try {
      const compressed = await compressImage(f)
      setPhotoFiles((s) => ({ ...s, [i]: compressed }))
    } finally {
      setCompressing((c) => c - 1)
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = formRef.current
    if (!form) return

    if (Object.keys(photoFiles).length === 0) {
      setError(wt.errNoPhotos)
      return
    }

    setState('sending')
    try {
      // фото беремо зі стану: там уже стиснені файли, а не оригінали з інпута
      const data = new FormData(form)
      data.delete('photos')
      Object.values(photoFiles).forEach((f) => data.append('photos', f))
      // спільний роут на всі напрямки; годинники позначені окремим ключем
      data.set('category', 'watches')
      const res = await fetch('/api/eval-request', { method: 'POST', body: data })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || wt.errFallback)
      setBotLink(json.botLink || null)
      trackLead('eval-watches')
      setState('sent')
      form.reset()
      setFilled({})
      setPhotoFiles({})
    } catch (err) {
      setState('idle')
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    // Форма довга, а підтвердження коротке: сторінка різко «сплющується»,
    // і клієнт, що дивився на кнопку внизу, лишається дивитись у порожнечу.
    if (state === 'sent') doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [state])

  if (state === 'sent') {
    return (
      <div className="wform wform--done" ref={doneRef}>
        <b>{wt.doneTitle}</b>
        <p>{wt.doneText}</p>
        {botLink && (
          <>
            <a className="tgbtn" href={botLink} target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21.94 4.9 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.15c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.13 12.4 2.55 10.97c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.28 2.31Z" />
              </svg>
              {wt.tgLink}
            </a>
            <p className="wtips" style={{ borderLeft: 0, paddingLeft: 0, textAlign: 'center' }}>
              {wt.tgHint}
            </p>
          </>
        )}

        <button className="wbtn" type="button" onClick={() => setState('idle')}>
          {wt.another}
        </button>
      </div>
    )
  }

  return (
    <form className="wform" ref={formRef} onSubmit={submit} noValidate>
      <div className="wgrid">
        <p>
          <label htmlFor="wf-name">{wt.name} <span className="req">*</span></label>
          <input id="wf-name" name="name" type="text" required maxLength={120}
            placeholder={wt.namePh} autoComplete="name" />
        </p>
        <p>
          <label htmlFor="wf-phone">{wt.phone} <span className="req">*</span></label>
          <input id="wf-phone" name="phone" type="tel" required maxLength={40}
            placeholder="+380" autoComplete="tel" />
        </p>
      </div>

      <div className="wgrid">
        <p>
          <label htmlFor="wf-brand">{wt.brand} <span className="req">*</span></label>
          <select id="wf-brand" name="brand" required defaultValue="">
            <option value="" disabled>{wt.chooseBrand}</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
            <option>{wt.other}</option>
          </select>
        </p>
        <p>
          <label htmlFor="wf-model">{wt.model} <span className="req">*</span></label>
          <input id="wf-model" name="model" type="text" required maxLength={120}
            placeholder={wt.modelPh} />
        </p>
      </div>

      <div className="wgrid">
        <p>
          <label htmlFor="wf-year">{wt.year}</label>
          <input id="wf-year" name="year" type="text" maxLength={20} placeholder={wt.yearPh} />
        </p>
        <p>
          <label htmlFor="wf-cond">{wt.cond}</label>
          <select id="wf-cond" name="condition" defaultValue={conditions[0]}>
            {conditions.map((c) => <option key={c}>{c}</option>)}
          </select>
        </p>
      </div>

      <div className="wfield">
        <h3>{wt.photosTitle} <span className="req">*</span></h3>
        <p className="wnote">{wt.photosNote}</p>
        <div className="wshots">
          {shots.map(([title, hint, must], i) => (
            <label key={title} className={`wslot${filled[i] ? ' wslot--on' : ''}`}>
              <em>{must ? wt.required : wt.desired}</em>
              <b>{title}</b>
              <span>{filled[i] || hint}</span>
              <input
                type="file" name="photos" accept="image/*"
                onChange={(e) => { void pickPhoto(i, e.target.files?.[0]) }}
              />
            </label>
          ))}
        </div>
        <p className="wtips">{wt.tips}</p>
      </div>

      <p className="wfield">
        <label htmlFor="wf-comment">{wt.comment}</label>
        <textarea id="wf-comment" name="comment" rows={3} maxLength={2000}
          placeholder={wt.commentPh} />
      </p>

      {/* приманка для роботів: людина цього поля не бачить */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="wtrap" />

      <label className="wagree">
        <input type="checkbox" required />
        <span>{wt.agree}</span>
      </label>

      {error && <p className="werr">{error}</p>}

      <button className="wbtn wbtn--send" type="submit" disabled={state === 'sending' || compressing > 0}>
        {compressing > 0 ? wt.compressing : (state === 'sending' ? wt.sending : wt.send)}
      </button>
    </form>
  )
}
