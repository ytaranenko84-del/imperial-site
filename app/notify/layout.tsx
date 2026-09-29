import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Сповіщення — Імперіал',
  manifest: '/manifest-notify.json',
}

export const viewport: Viewport = {
  themeColor: '#b90f0d',
}

export default function NotifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body style={{ margin: 0, background: '#101116' }}>{children}</body>
    </html>
  )
}
