import type { Metadata } from 'next'
import Image from 'next/image'
import { getSettings } from '@/lib/data'
import { getLocale } from '@/lib/locale.ts'
import WatchForm from '@/components/WatchForm'
import LangSwitch from '@/components/LangSwitch'
import { BreadcrumbSchema } from '@/components/Schema.tsx'
import '@/components/Watches.css'

export const revalidate = 600

type L = 'uk' | 'ru'

/** Марки, з якими працюємо. Порядок — за впізнаваністю, а не за абеткою. Назви марок не перекладаються. */
const BRANDS = [
  'Rolex', 'Patek Philippe', 'Audemars Piguet', 'Omega', 'Cartier', 'Vacheron Constantin',
  'Jaeger-LeCoultre', 'IWC Schaffhausen', 'Breitling', 'Panerai', 'Hublot', 'Chopard',
  'Zenith', 'Blancpain', 'Breguet', 'Girard-Perregaux', 'Ulysse Nardin', 'A. Lange & Söhne',
  'Piaget', 'Franck Muller', 'Tudor', 'TAG Heuer', 'Longines', 'Richard Mille',
]

const T = {
  uk: {
    metaTitle: 'Позика під заставу годинника — ломбард «Імперіал»',
    metaDesc: 'Застава швейцарських годинників: Rolex, Omega, Patek Philippe, Cartier та інші. '
      + 'Оцінює фахівець, який працює з годинниками. Надішліть фото — відповідь протягом дня.',
    home: 'Головна', crumb: 'Годинники',
    sectionsAria: 'Розділи сайту',
    sections: [['/zastava', 'Що приймаємо'], ['/calc', 'Оцінка'], ['/viddilennya', 'Відділення'], ['/novyny', 'Новини']] as [string, string][],
    heroEyebrow: 'Окремий напрям',
    h1: 'Позика під заставу годинника',
    lead: 'Швейцарська механіка, лімітовані моделі, вінтаж. Оцінює фахівець, який працює '
      + 'з годинниками, а не приймальник за вагою металу.',
    cta: 'Надіслати на оцінку →',
    small: 'Оцінка за фото — попередня. Остаточна сума визначається після огляду фахівцем.',
    brandsEyebrow: 'З чим працюємо', brandsH2: 'Марки',
    brandsNote: 'Список не вичерпний: беремо й інші марки, але сума залежить від конкретної моделі, '
      + 'а не від логотипа.',
    stepsEyebrow: 'Як проходить оцінка', stepsH2: 'Що саме дивиться фахівець',
    stepsLead: 'Годинник оцінюється як механізм і як модель, а не як грам металу. '
      + 'Тому питання інші, ніж до ланцюжка.',
    steps: [
      ['Референс і серійний номер',
        'За ними встановлюємо точну модель, рік випуску та заводську комплектацію.'],
      ['Оригінальність деталей',
        'Циферблат, стрілки, безель, браслет. Замінені деталі знижують вартість — це головне, що дивиться фахівець.'],
      ['Стан і хід механізму',
        'Корпус, скло, точність ходу, запас ходу. Механіка, що давно не обслуговувалась, оцінюється нижче.'],
      ['Комплект',
        'Коробка, паспорт, сервісна книжка. Повний комплект помітно додає до суми.'],
    ] as [string, string][],
    verifyEyebrow: 'Підтвердження оригінальності', verifyH2: 'Що робимо, якщо є сумніви',
    verifyLead: 'Перевіряємо номер корпусу й механізму, тип заводу, шрифти циферблата, вагу '
      + 'й матеріал браслета. Якщо однозначності немає — залучаємо стороннього годинникаря '
      + 'і кажемо про це прямо. Ніяких оцінок «навмання».',
    formEyebrow: 'Заявка', formH2: 'Надішліть годинник на оцінку',
    formLead: 'Відповідь протягом робочого дня. Нічого везти не треба — спершу фото.',
    storageEyebrow: 'Поки годинник у нас', storageH2: 'Зберігання й приватність',
    storageLead: 'Годинник не потрапляє у продаж, доки діє договір, і повертається в тому самому '
      + 'стані, в якому був прийнятий.',
    privacy: [
      ['Окрема ячейка', 'Не спільна вітрина: індивідуальне зберігання, опис стану в договорі разом із вами.'],
      ['Страхування', 'На повну суму оцінки на весь строк застави.'],
      ['За записом', 'Оцінка в окремій кімнаті, без загальної черги. Час узгоджуємо заздалегідь.'],
    ] as [string, string][],
    setEyebrow: 'Комплект', setH2: 'Коробка й документи додають до суми',
    setLead: 'Повний комплект — коробка, паспорт, сервісна книжка — помітно підвищує оцінку. '
      + 'Якщо чогось немає, це не відмова: просто інша сума.',
    hotlineLbl: 'Гаряча лінія',
    heroAlt: 'Швейцарський годинник під заставою в ломбарді «Імперіал»',
    masterAlt: 'Фахівець оглядає годинник', movementAlt: 'Механізм годинника крупним планом',
    vaultAlt: 'Сховище', boxAlt: 'Годинник у коробці',
  },
  ru: {
    metaTitle: 'Заём под залог часов — ломбард «Империал»',
    metaDesc: 'Залог швейцарских часов: Rolex, Omega, Patek Philippe, Cartier и другие. '
      + 'Оценивает специалист, который работает с часами. Пришлите фото — ответ в течение дня.',
    home: 'Главная', crumb: 'Часы',
    sectionsAria: 'Разделы сайта',
    sections: [['/zastava', 'Что принимаем'], ['/calc', 'Оценка'], ['/viddilennya', 'Отделения'], ['/novyny', 'Новости']] as [string, string][],
    heroEyebrow: 'Отдельное направление',
    h1: 'Заём под залог часов',
    lead: 'Швейцарская механика, лимитированные модели, винтаж. Оценивает специалист, который работает '
      + 'с часами, а не приёмщик по весу металла.',
    cta: 'Отправить на оценку →',
    small: 'Оценка по фото — предварительная. Окончательная сумма определяется после осмотра специалистом.',
    brandsEyebrow: 'С чем работаем', brandsH2: 'Марки',
    brandsNote: 'Список не исчерпывающий: берём и другие марки, но сумма зависит от конкретной модели, '
      + 'а не от логотипа.',
    stepsEyebrow: 'Как проходит оценка', stepsH2: 'Что именно смотрит специалист',
    stepsLead: 'Часы оцениваются как механизм и как модель, а не как грамм металла. '
      + 'Поэтому вопросы другие, чем к цепочке.',
    steps: [
      ['Референс и серийный номер',
        'По ним устанавливаем точную модель, год выпуска и заводскую комплектацию.'],
      ['Оригинальность деталей',
        'Циферблат, стрелки, безель, браслет. Заменённые детали снижают стоимость — это главное, что смотрит специалист.'],
      ['Состояние и ход механизма',
        'Корпус, стекло, точность хода, запас хода. Механика, которая давно не обслуживалась, оценивается ниже.'],
      ['Комплект',
        'Коробка, паспорт, сервисная книжка. Полный комплект заметно добавляет к сумме.'],
    ] as [string, string][],
    verifyEyebrow: 'Подтверждение оригинальности', verifyH2: 'Что делаем, если есть сомнения',
    verifyLead: 'Проверяем номер корпуса и механизма, тип завода, шрифты циферблата, вес '
      + 'и материал браслета. Если однозначности нет — привлекаем стороннего часовщика '
      + 'и говорим об этом прямо. Никаких оценок «на глаз».',
    formEyebrow: 'Заявка', formH2: 'Пришлите часы на оценку',
    formLead: 'Ответ в течение рабочего дня. Ничего везти не нужно — сначала фото.',
    storageEyebrow: 'Пока часы у нас', storageH2: 'Хранение и приватность',
    storageLead: 'Часы не попадают в продажу, пока действует договор, и возвращаются в том же '
      + 'состоянии, в котором были приняты.',
    privacy: [
      ['Отдельная ячейка', 'Не общая витрина: индивидуальное хранение, описание состояния в договоре вместе с вами.'],
      ['Страхование', 'На полную сумму оценки на весь срок залога.'],
      ['По записи', 'Оценка в отдельной комнате, без общей очереди. Время согласовываем заранее.'],
    ] as [string, string][],
    setEyebrow: 'Комплект', setH2: 'Коробка и документы добавляют к сумме',
    setLead: 'Полный комплект — коробка, паспорт, сервисная книжка — заметно повышает оценку. '
      + 'Если чего-то нет, это не отказ: просто другая сумма.',
    hotlineLbl: 'Горячая линия',
    heroAlt: 'Швейцарские часы под залогом в ломбарде «Империал»',
    masterAlt: 'Специалист осматривает часы', movementAlt: 'Механизм часов крупным планом',
    vaultAlt: 'Хранилище', boxAlt: 'Часы в коробке',
  },
} satisfies Record<L, unknown>

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const t = T[locale]
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    // Інакше сторінка успадкує canonical головної з кореневого layout.
    alternates: {
      canonical: locale === 'ru' ? '/ru/zastava/hodynnyky' : '/zastava/hodynnyky',
      languages: {
        'uk-UA': '/zastava/hodynnyky', 'ru-UA': '/ru/zastava/hodynnyky', 'x-default': '/zastava/hodynnyky',
      },
    },
  }
}

export default async function WatchesPage() {
  const locale = await getLocale()
  const t = T[locale]
  const settings = await getSettings(locale)
  const s = settings as Record<string, string | number | boolean | undefined>
  const hotline = String(s.hotline || '0 800 30 85 00')

  return (
    <div className="wpage">
      <BreadcrumbSchema items={[
        { name: t.home, href: '/' },
        { name: t.crumb, href: '/zastava/hodynnyky' },
      ]} />
      <header className="wwrap wtop">
        <a className="brand" href="/">
          <Image className="brand__mark" src="/logo.png" alt="" width={36} height={36} priority />
          <span className="brand__txt"><b>ІМПЕРІАЛ</b><span>Ломбард</span></span>
        </a>
        <nav className="wnav" aria-label={t.sectionsAria}>
          {t.sections.map(([href, label]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>
        <LangSwitch locale={locale} />
      </header>

      <section className="whero">
        <Image className="whero__img" src="/watches/hero.jpg" alt={t.heroAlt} fill priority sizes="100vw" />
        <div className="wwrap whero__in">
          <p className="weyebrow">{t.heroEyebrow}</p>
          <h1>{t.h1}</h1>
          <div className="wline" />
          <p className="wlead">{t.lead}</p>
          <a className="wbtn" href="#zayavka">{t.cta}</a>
          <p className="wsmall">{t.small}</p>
        </div>
      </section>

      <section className="wwrap wsec">
        <p className="weyebrow">{t.brandsEyebrow}</p>
        <h2>{t.brandsH2}</h2>
        <div className="wline" />
        <div className="wbrands" data-reveal-group>
          {BRANDS.map((b) => <span key={b}>{b}</span>)}
        </div>
        <p className="wsmall wsmall--wide">{t.brandsNote}</p>
      </section>

      <section className="wwrap wsec">
        <div className="wsplit">
          <div data-reveal>
            <p className="weyebrow">{t.stepsEyebrow}</p>
            <h2>{t.stepsH2}</h2>
            <div className="wline" />
            <p className="wlead">{t.stepsLead}</p>
          </div>
          <div className="wshot">
            <Image src="/watches/master.jpg" alt={t.masterAlt} fill sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
        </div>

        <div className="wsteps" data-reveal-group>
          {t.steps.map(([title, text], i) => (
            <div className="wstep" key={title}>
              <i>0{i + 1}</i><b>{title}</b><p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wwrap wsec">
        <div className="wsplit wsplit--rev">
          <div data-reveal>
            <p className="weyebrow">{t.verifyEyebrow}</p>
            <h2>{t.verifyH2}</h2>
            <div className="wline" />
            <p className="wlead">{t.verifyLead}</p>
          </div>
          <div className="wshot">
            <Image src="/watches/movement.jpg" alt={t.movementAlt} fill sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
        </div>
      </section>

      <section className="wwrap wsec" id="zayavka">
        <p className="weyebrow">{t.formEyebrow}</p>
        <h2>{t.formH2}</h2>
        <div className="wline" />
        <p className="wlead">{t.formLead}</p>
        <WatchForm brands={BRANDS} locale={locale} />
      </section>

      <section className="wwrap wsec">
        <div className="wsplit">
          <div data-reveal>
            <p className="weyebrow">{t.storageEyebrow}</p>
            <h2>{t.storageH2}</h2>
            <div className="wline" />
            <p className="wlead">{t.storageLead}</p>
          </div>
          <div className="wshot">
            <Image src="/watches/vault.jpg" alt={t.vaultAlt} fill sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
        </div>
        <div className="wpriv" data-reveal-group>
          {t.privacy.map(([title, text]) => (
            <div key={title}><b>{title}</b><p>{text}</p></div>
          ))}
        </div>
      </section>

      <section className="wwrap wsec">
        <div className="wsplit wsplit--rev">
          <div data-reveal>
            <p className="weyebrow">{t.setEyebrow}</p>
            <h2>{t.setH2}</h2>
            <div className="wline" />
            <p className="wlead">{t.setLead}</p>
          </div>
          <div className="wshot">
            <Image src="/watches/box.jpg" alt={t.boxAlt} fill sizes="(min-width: 900px) 46vw, 100vw" />
          </div>
        </div>
      </section>

      <footer className="wwrap wfoot">
        <nav className="wfoot__nav" aria-label={t.sectionsAria}>
          <a href="/">{t.home}</a>
          {t.sections.map(([href, label]) => (
            <a key={href} href={href}>{label}</a>
          ))}
        </nav>
        <p className="wfoot__line">
          {t.hotlineLbl} <a href={`tel:${hotline.replace(/\s/g, '')}`}>{hotline}</a>
          {' · '}{String(s.email || 'support@imperial24.com.ua')}
        </p>
      </footer>
    </div>
  )
}
