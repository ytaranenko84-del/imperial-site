'use client'

import Script from 'next/script'
import { useEffect } from 'react'

import '@/lib/analytics.ts'

/**
 * GA4 — вантажиться лише коли в налаштуваннях заповнено Measurement ID.
 * Порожнє поле — на сайті взагалі немає жодного зовнішнього скрипта, як
 * і з Telegram/Viber: той самий принцип «немає значення — немає коду».
 *
 * Домени AI-рушіїв позначаються окремою подією одразу при заході, а не
 * лише вгадуються з правил GA4 за замовчуванням: свій підпис читається
 * однаково, незалежно від того, як Google того тижня класифікує джерело.
 */

const AI_REFERRERS: Record<string, string> = {
  'chatgpt.com': 'chatgpt',
  'chat.openai.com': 'chatgpt',
  'perplexity.ai': 'perplexity',
  'claude.ai': 'claude',
  'gemini.google.com': 'gemini',
  'copilot.microsoft.com': 'copilot',
  'you.com': 'you',
}

function detectAiReferrer(): string | null {
  try {
    const ref = document.referrer
    if (!ref) return null
    const host = new URL(ref).hostname.replace(/^www\./, '')
    return AI_REFERRERS[host] || null
  } catch {
    return null
  }
}

export default function Analytics({ measurementId }: { measurementId: string }) {
  useEffect(() => {
    const source = detectAiReferrer()
    if (source) window.gtag?.('event', 'ai_referral', { ai_source: source })
  }, [])

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}');`}
      </Script>
    </>
  )
}
