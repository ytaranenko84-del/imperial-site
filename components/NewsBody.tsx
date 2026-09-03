/**
 * Текст матеріалу зі звичайного тексту в адмінці: порожній рядок — новий абзац,
 * рядок із «•» — пункт списку. Ніякої розмітки в базі, тож нема чого й екранувати:
 * React сам виводить текст як текст.
 */
export default function NewsBody({ body }: { body: string }) {
  const blocks: React.ReactNode[] = []
  let list: string[] = []

  const flush = (key: string) => {
    if (!list.length) return
    blocks.push(<ul key={key}>{list.map((li, i) => <li key={i}>{li}</li>)}</ul>)
    list = []
  }

  body.split('\n').map((l) => l.trim()).forEach((line, i) => {
    if (!line) { flush(`ul-${i}`); return }
    if (line.startsWith('•')) { list.push(line.replace(/^•\s*/, '')); return }
    flush(`ul-${i}`)
    blocks.push(<p key={`p-${i}`}>{line}</p>)
  })
  flush('ul-end')

  return <div className="ntext">{blocks}</div>
}
