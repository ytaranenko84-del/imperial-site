const API = 'https://api.turbosms.ua'

export const smsConfigured = () => Boolean(process.env.TURBOSMS_API_KEY)

/** Міжнародний формат TurboSMS: 380XXXXXXXXX, без «+» і зайвого. */
function toIntlPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '').slice(-9)
  return digits ? `380${digits}` : ''
}

/**
 * Резервний канал, коли клієнт не підключений до бота: той самий текст,
 * що пішов би в Telegram, летить SMS-кою. Ключ і ім'я відправника — ті самі,
 * що вже використовує KeyCRM на цьому акаунті TurboSMS.
 */
export async function sendSms(phone: string, text: string) {
  const key = process.env.TURBOSMS_API_KEY || ''
  if (!key) throw new Error('немає ключа TurboSMS')

  const recipient = toIntlPhone(phone)
  if (!recipient) throw new Error('невірний номер телефону')

  const res = await fetch(`${API}/message/send.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      recipients: [recipient],
      sms: { sender: process.env.TURBOSMS_SENDER || 'Imperial24', text },
    }),
  })
  const json = await res.json().catch(() => ({})) as {
    response_result?: { response_code?: number; response_status?: string }[]
  }
  /*
   * Верхній response_code — код самого запиту (801 = «прийнято в обробку»),
   * не факт доставки конкретному номеру. Реальний статус — у response_result
   * для цього телефону: перевірено наживо, з документації це не було видно.
   */
  const result = json.response_result?.[0]
  if (result?.response_code !== 0) {
    throw new Error(result?.response_status || `turbosms ${res.status}`)
  }
}
