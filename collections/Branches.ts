import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { resolveCoords } from '../lib/geo.ts'

/** Відділення. Модель даних за розділом 10 ТЗ. */
export const Branches: CollectionConfig = {
  slug: 'branches',
  labels: { singular: 'Відділення', plural: 'Відділення' },
  admin: {
    group: 'Відділення',
    useAsTitle: 'displayAddress',
    defaultColumns: ['displayAddress', 'city', 'phone', 'active'],
  },
  access: { read: () => true },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc }) => {
        const url = typeof data?.coords?.mapsUrl === 'string' ? data.coords.mapsUrl.trim() : ''
        if (!url) return data

        // Ходимо в Google лише коли посилання нове: інакше кожне збереження — зайвий запит
        const same = url === (originalDoc?.coords?.mapsUrl || '').trim()
        if (same && typeof originalDoc?.coords?.lat === 'number') return data

        const c = await resolveCoords(url)
        if (!c) {
          throw new APIError(
            'У цьому посиланні немає координат. Відкрийте його в браузері й скопіюйте адресу '
            + 'з адресного рядка — у ній є @49.44,32.05. Або клацніть правою кнопкою по точці '
            + 'на карті й скопіюйте перший рядок із числами, вставивши його в це саме поле.',
            400,
          )
        }
        data.coords = { ...data.coords, lat: c.lat, lng: c.lng }
        return data
      },
    ],
  },
  fields: [
    {
      // Збирається автоматично при збереженні: адреса + колишня назва в дужках.
      // Потрібне, бо не всі ще знають нові назви вулиць після перейменувань.
      name: 'displayAddress',
      type: 'text',
      label: 'Адреса як бачить клієнт',
      localized: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Заповнюється само з адреси та колишньої назви',
      },
      hooks: {
        beforeChange: [({ siblingData }) => {
          const a = siblingData?.address
          if (!a) return undefined
          return siblingData?.formerName ? `${a} (кол. ${siblingData.formerName})` : a
        }],
      },
    },
    { name: 'city', type: 'relationship', relationTo: 'cities', label: 'Місто', required: true },
    { name: 'address', type: 'text', label: 'Адреса', required: true, localized: true },
    { name: 'slug', type: 'text', label: 'Адреса сторінки',
      admin: { description: 'Латиницею: kosiora-29b' } },
    { name: 'internalName', type: 'text', label: 'Внутрішня назва',
      admin: { description: 'Як відділення звуть між собою: Косіора, Терра, Океан. '
        + 'Клієнтам не показується — потрібна, щоб швидко знайти відділення тут і '
        + 'упізнати його в заявках з бота' } },
    { name: 'phone', type: 'text', label: 'Телефон',
      admin: { description: 'Публічний: показується клієнтам на сайті' } },
    { name: 'workPhone', type: 'text', label: 'Робочий номер',
      admin: { description: 'Внутрішній: для зв’язку з відділенням. На сайті не показується' } },
    { name: 'telegramChat', type: 'text', label: 'Telegram-чат відділення',
      admin: { description: 'Куди надсилати броні цього відділення. Заповнюється автоматично, '
        + 'коли бота додають у групу відділення. Порожнє — броні йдуть у загальний чат' } },
    {
      name: 'schedule',
      type: 'group',
      label: 'Графік роботи',
      fields: [
        { name: 'roundClock', type: 'checkbox', label: 'Цілодобово', defaultValue: false },
        { name: 'openTime', type: 'text', label: 'Відкриття', defaultValue: '09:00',
          admin: { condition: (_, s) => !s?.roundClock } },
        { name: 'closeTime', type: 'text', label: 'Закриття', defaultValue: '20:00',
          admin: { condition: (_, s) => !s?.roundClock } },
        { name: 'weekend', type: 'text', label: 'Вихідні', localized: true },
      ],
    },
    {
      name: 'coords',
      type: 'group',
      label: 'Координати для карти',
      fields: [
        {
          name: 'mapsUrl',
          type: 'text',
          label: 'Посилання Google Maps',
          admin: {
            description: 'Вставте посилання на точку з Google Maps — координати підставляться '
              + 'самі при збереженні. Найнадійніше: клацнути правою кнопкою по потрібному місцю '
              + 'на карті й вибрати перший рядок із числами (це координати) — його теж можна '
              + 'вставити сюди',
          },
        },
        { name: 'lat', type: 'number', label: 'Широта',
          admin: { description: 'Заповнюється з посилання. Можна виправити вручну' } },
        { name: 'lng', type: 'number', label: 'Довгота' },
      ],
    },
    {
      name: 'services',
      type: 'select',
      label: 'Послуги',
      hasMany: true,
      options: [
        { label: 'Дорогоцінні метали', value: 'metals' },
        { label: 'Техніка', value: 'tech' },
        { label: 'Авто', value: 'auto' },
        { label: 'Безбар’єрне', value: 'accessible' },
      ],
    },
    { name: 'photos', type: 'upload', relationTo: 'media', label: 'Фото', hasMany: true },
    {
      name: 'formerName',
      type: 'text',
      label: 'Колишня назва вулиці',
      localized: true,
      admin: { description: 'Показується в дужках після адреси, щоб клієнт упізнав місце після перейменування' },
    },
    { name: 'transport', type: 'text', label: 'Як дістатися', localized: true,
      admin: { description: 'Наприклад: 5 хвилин від зупинки «Центральна»' } },
    { name: 'active', type: 'checkbox', label: 'Активне', defaultValue: true },
    { name: 'paused', type: 'checkbox', label: 'Тимчасово не працює', defaultValue: false },
    { name: 'pauseReason', type: 'text', label: 'Причина', localized: true,
      admin: { condition: (_, s) => s?.paused } },
  ],
}
