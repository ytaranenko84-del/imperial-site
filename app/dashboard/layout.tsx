import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Робочий стіл — Імперіал',
  description: 'Заявки на оцінку та гаряча лінія в одному місці',
  manifest: '/manifest-dashboard.json',
  // Safari ігнорує іконки з маніфесту й шукає саме це посилання.
  icons: { apple: '/logo.png' },
}

export const viewport: Viewport = { themeColor: '#b90f0d' }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
