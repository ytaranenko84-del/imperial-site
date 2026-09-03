import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getSettings } from '@/lib/data'
import { CATEGORIES, byCategorySlug } from '@/lib/categories'
import EvalForm from '@/components/EvalForm'
import '@/components/EvalForm.css'

export const revalidate = 600

/** Сторінки категорій відомі наперед, тож адреси беруться зі списку. */
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> },
): Promise<Metadata> {
  const { category } = await params
  const c = byCategorySlug(category)
  if (!c) return {}
  return {
    title: `${c.name} під заставу — ломбард «Імперіал»`,
    description: `${c.lead} Оцінка за фото: надішліть знімки — фахівець відповість протягом дня.`,
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const c = byCategorySlug(category)
  if (!c) notFound()

  const settings = await getSettings()
  const s = settings as Record<string, string | number | boolean | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')

  return (
    <>
      <header className="wrap top">
        <a className="brand" href="/">
          <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
          <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
        </a>
        <nav className="nav">
          <a href="/#cats">Що приймаємо</a>
          <a href="/#calc">Оцінка</a>
          <a href="/zastava/hodynnyky">Годинники</a>
          <a href="/#branches">Відділення</a>
        </nav>
        <a className="tel" href={`tel:${hotline.replace(/\s/g, '')}`}>
          <b>{hotline}</b><span>Цілодобово · безкоштовно</span>
        </a>
      </header>

      <main>
        <section className="wrap hero center">
          <p className="eyebrow">Що приймаємо</p>
          <h1>{c.name}</h1>
          <div className="goldline" />
          <p className="lede">{c.lead}</p>
          <a className="pill" href="#zayavka">Оцінити за фото</a>
          <p className="rate-note">
            Безкоштовно · відповідь протягом робочого дня · нічого везти не треба.
            Оцінка за фото попередня: остаточну суму визначає фахівець після огляду речі.
          </p>
        </section>

        <section className="sec">
          <div className="wrap split">
            <div data-reveal>
              <h2>Що саме беремо</h2>
              <div className="goldline goldline--left" />
              <ul className="take">
                {c.take.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <p className="cnote">{c.note}</p>
            </div>
            <div className="cshot">
              <Image src={c.photo} alt="" fill sizes="(min-width: 900px) 46vw, 100vw" />
            </div>
          </div>
        </section>

        <section className="sec sec--gray" id="zayavka">
          <div className="wrap">
            <div className="shead" data-reveal>
              <h2>Оцінка за фото</h2>
              <div className="goldline goldline--left" />
              <p>Заповніть коротку форму — фахівець відповість протягом робочого дня.</p>
            </div>
            <EvalForm category={c.key} shots={c.shots} example={c.example} />
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="shead center" data-reveal>
              <h2>Інші напрямки</h2>
            </div>
            <div className="grid grid--4" data-reveal-group>
              <a className="card card--link" href="/#calc">
                <h3 style={{ fontSize: 'var(--s1)' }}>Золото і срібло</h3>
                <p>Калькулятор рахує суму одразу</p>
                <span className="card__act">Порахувати суму<i>→</i></span>
              </a>
              <a className="card card--link" href="/zastava/hodynnyky">
                <h3 style={{ fontSize: 'var(--s1)' }}>Годинники</h3>
                <p>Швейцарська механіка, вінтаж</p>
                <span className="card__act">Надіслати на оцінку<i>→</i></span>
              </a>
              {CATEGORIES.filter((x) => x.slug !== c.slug).slice(0, 2).map((x) => (
                <a className="card card--link" key={x.slug} href={`/zastava/${x.slug}`}>
                  <h3 style={{ fontSize: 'var(--s1)' }}>{x.name}</h3>
                  <p>{x.take[0]}</p>
                  <span className="card__act">Оцінити за фото<i>→</i></span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <p style={{ margin: 0, fontSize: 'var(--s-1)' }}>
            Гаряча лінія <a href={`tel:${hotline.replace(/\s/g, '')}`} style={{ color: 'var(--brand)' }}>{hotline}</a>
            {' · '}{String(s.email || 'support@imperial24.com.ua')}
            {' · '}<a href="/">на головну</a>
          </p>
        </div>
      </footer>
    </>
  )
}
