import type { Metadata } from 'next'
import Image from 'next/image'
import { getSiteData } from '@/lib/data'
import WatchForm from '@/components/WatchForm'
import '@/components/Watches.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Позика під заставу годинника — ломбард «Імперіал»',
  description:
    'Застава швейцарських годинників: Rolex, Omega, Patek Philippe, Cartier та інші. '
    + 'Оцінює фахівець, який працює з годинниками. Надішліть фото — відповідь протягом дня.',
}

/** Марки, з якими працюємо. Порядок — за впізнаваністю, а не за абеткою. */
const BRANDS = [
  'Rolex', 'Patek Philippe', 'Audemars Piguet', 'Omega', 'Cartier', 'Vacheron Constantin',
  'Jaeger-LeCoultre', 'IWC Schaffhausen', 'Breitling', 'Panerai', 'Hublot', 'Chopard',
  'Zenith', 'Blancpain', 'Breguet', 'Girard-Perregaux', 'Ulysse Nardin', 'A. Lange & Söhne',
  'Piaget', 'Franck Muller', 'Tudor', 'TAG Heuer', 'Longines', 'Richard Mille',
]

const STEPS: [string, string][] = [
  ['Референс і серійний номер',
    'За ними встановлюємо точну модель, рік випуску та заводську комплектацію.'],
  ['Оригінальність деталей',
    'Циферблат, стрілки, безель, браслет. Замінені деталі знижують вартість — це головне, що дивиться фахівець.'],
  ['Стан і хід механізму',
    'Корпус, скло, точність ходу, запас ходу. Механіка, що давно не обслуговувалась, оцінюється нижче.'],
  ['Комплект',
    'Коробка, паспорт, сервісна книжка. Повний комплект помітно додає до суми.'],
]

const PRIVACY: [string, string][] = [
  ['Окрема ячейка', 'Не спільна вітрина: індивідуальне зберігання, опис стану в договорі разом із вами.'],
  ['Страхування', 'На повну суму оцінки на весь строк застави.'],
  ['За записом', 'Оцінка в окремій кімнаті, без загальної черги. Час узгоджуємо заздалегідь.'],
]

export default async function WatchesPage() {
  const { settings } = await getSiteData()
  const s = settings as Record<string, string | number | boolean | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')

  return (
    <div className="wpage">
      <header className="wwrap wtop">
        <a className="brand" href="/">
          <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
          <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
        </a>
        <a className="wback" href="/">‹ На головну</a>
      </header>

      <section className="whero">
        <Image className="whero__img" src="/watches/hero.jpg" alt="" fill priority sizes="100vw" />
        <div className="wwrap whero__in">
          <p className="weyebrow">Окремий напрям</p>
          <h1>Позика під заставу годинника</h1>
          <div className="wline" />
          <p className="wlead">
            Швейцарська механіка, лімітовані моделі, вінтаж. Оцінює фахівець, який працює
            з годинниками, а не приймальник за вагою металу.
          </p>
          <a className="wbtn" href="#zayavka">Надіслати на оцінку →</a>
          <p className="wsmall">
            Оцінка за фото — попередня. Остаточна сума визначається після огляду фахівцем.
          </p>
        </div>
      </section>

      <section className="wwrap wsec">
        <p className="weyebrow">З чим працюємо</p>
        <h2>Марки</h2>
        <div className="wline" />
        <div className="wbrands" data-reveal-group>
          {BRANDS.map((b) => <span key={b}>{b}</span>)}
        </div>
        <p className="wsmall wsmall--wide">
          Список не вичерпний: беремо й інші марки, але сума залежить від конкретної моделі,
          а не від логотипа. Кварцові годинники масових брендів під заставу не приймаємо.
        </p>
      </section>

      <section className="wwrap wsec">
        <div className="wsplit">
          <div data-reveal>
            <p className="weyebrow">Як проходить оцінка</p>
            <h2>Що саме дивиться фахівець</h2>
            <div className="wline" />
            <p className="wlead">
              Годинник оцінюється як механізм і як модель, а не як грам металу.
              Тому питання інші, ніж до ланцюжка.
            </p>
          </div>
          <div className="wshot">
            <Image src="/watches/master.jpg" alt="Майстер оглядає механізм" fill sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
        </div>

        <div className="wsteps" data-reveal-group>
          {STEPS.map(([title, text], i) => (
            <div className="wstep" key={title}>
              <i>0{i + 1}</i><b>{title}</b><p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wwrap wsec">
        <div className="wsplit wsplit--rev">
          <div data-reveal>
            <p className="weyebrow">Підтвердження оригінальності</p>
            <h2>Що робимо, якщо є сумніви</h2>
            <div className="wline" />
            <p className="wlead">
              Перевіряємо номер корпусу й механізму, тип заводу, шрифти циферблата, вагу
              й матеріал браслета. Якщо однозначності немає — залучаємо стороннього годинникаря
              і кажемо про це прямо. Ніяких оцінок «навмання».
            </p>
          </div>
          <div className="wshot">
            <Image src="/watches/movement.jpg" alt="Механізм годинника крупним планом" fill sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
        </div>
      </section>

      <section className="wwrap wsec" id="zayavka">
        <p className="weyebrow">Заявка</p>
        <h2>Надішліть годинник на оцінку</h2>
        <div className="wline" />
        <p className="wlead">Відповідь протягом робочого дня. Нічого везти не треба — спершу фото.</p>
        <WatchForm brands={BRANDS} />
      </section>

      <section className="wwrap wsec">
        <div className="wsplit">
          <div data-reveal>
            <p className="weyebrow">Поки годинник у нас</p>
            <h2>Зберігання й приватність</h2>
            <div className="wline" />
            <p className="wlead">
              Годинник не потрапляє у продаж, доки діє договір, і повертається в тому самому
              стані, в якому був прийнятий.
            </p>
          </div>
          <div className="wshot">
            <Image src="/watches/vault.jpg" alt="Сховище" fill sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
        </div>
        <div className="wpriv" data-reveal-group>
          {PRIVACY.map(([title, text]) => (
            <div key={title}><b>{title}</b><p>{text}</p></div>
          ))}
        </div>
      </section>

      <section className="wwrap wsec">
        <div className="wsplit wsplit--rev">
          <div data-reveal>
            <p className="weyebrow">Комплект</p>
            <h2>Коробка й документи додають до суми</h2>
            <div className="wline" />
            <p className="wlead">
              Повний комплект — коробка, паспорт, сервісна книжка — помітно підвищує оцінку.
              Якщо чогось немає, це не відмова: просто інша сума.
            </p>
          </div>
          <div className="wshot">
            <Image src="/watches/box.jpg" alt="Годинник у коробці" fill sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
        </div>
      </section>

      <footer className="wwrap wfoot">
        Гаряча лінія <a href={`tel:${hotline.replace(/\s/g, '')}`}>{hotline}</a>
        {' · '}{String(s.email || 'support@imperial24.com.ua')}
        {' · '}<a href="/">на головну</a>
      </footer>
    </div>
  )
}
