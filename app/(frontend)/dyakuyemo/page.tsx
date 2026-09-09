import type { Metadata } from 'next'

import { getSettings } from '@/lib/data.ts'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { BreadcrumbSchema } from '@/components/Schema.tsx'
import '@/components/News.css'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Дякуємо за звернення — ломбард «Імперіал»',
  description: 'Ваше звернення прийнято. Оцінювач відповість найближчим часом.',
  alternates: { canonical: '/dyakuyemo' },
  robots: { index: false, follow: true },
}

export default async function ThankYouPage() {
  const settings = await getSettings()
  const hotline = String(settings.hotline || '0 800 30 85 00')
  const telegram = (settings.telegram as string) || null

  return (
    <>
      <BreadcrumbSchema items={[
        { name: 'Головна', href: '/' },
        { name: 'Дякуємо', href: '/dyakuyemo' },
      ]} />
      <SiteHeader hotline={hotline} />

      <main>
        <section className="sec">
          <div className="wrap nart" style={{ textAlign: 'center', maxWidth: '46ch', marginInline: 'auto' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'var(--ok)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              margin: '0 auto 1.2rem',
            }}
            >
              ✓
            </div>
            <h1>Дякуємо, звернення прийнято</h1>
            <p className="lead" style={{ margin: '0.9rem 0 1.8rem' }}>
              Якщо ви залишили заявку з фото — оцінювач подивиться й напише суму в тому самому
              чаті, звідки надійшло звернення. Якщо телефонували чи писали напряму — ми
              зв&apos;яжемось найближчим часом.
            </p>

            <div style={{ display: 'grid', gap: '0.7rem', textAlign: 'left', margin: '0 0 2rem' }}>
              {telegram && (
                <a
                  href={telegram} target="_blank" rel="noopener"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#229ed9',
                    color: '#fff', borderRadius: 12, padding: '0.8rem 1rem', fontWeight: 600,
                    fontSize: '0.9rem', textDecoration: 'none',
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
                    <path d="M21.94 4.9 18.9 19.2c-.23 1.01-.83 1.26-1.68.78l-4.64-3.42-2.24 2.15c-.25.25-.46.46-.94.46l.33-4.73 8.6-7.77c.37-.33-.08-.52-.58-.19L7.13 12.4 2.55 10.97c-1-.31-1.01-1 .21-1.48l17.9-6.9c.83-.3 1.56.2 1.28 2.31Z" />
                  </svg>
                  Написати в Telegram
                </a>
              )}
              <a
                href={`tel:${hotline.replace(/\s/g, '')}`}
                style={{
                  display: 'block', textAlign: 'center', border: '1px solid var(--line)',
                  borderRadius: 12, padding: '0.8rem 1rem', fontWeight: 600, fontSize: '0.9rem',
                  textDecoration: 'none', color: 'var(--ink)',
                }}
              >
                Або зателефонуйте: {hotline}
              </a>
            </div>

            <p style={{ fontSize: '0.86rem' }}>
              <a href="/calc">Порахувати іншу суму →</a>
              {' · '}
              <a href="/">На головну</a>
            </p>
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </>
  )
}
