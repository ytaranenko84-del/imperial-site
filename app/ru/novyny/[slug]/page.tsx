import type { Metadata } from 'next'
import { NovynyItemContent, novynyItemMetadata } from '@/app/(frontend)/novyny/[slug]/page.tsx'
import { getNews } from '@/lib/news.ts'
import '@/components/News.css'

export const revalidate = 600

export async function generateStaticParams() {
  return (await getNews()).map((n) => ({ slug: n.slug }))
}

export default async function NewsItemPage({ params }: PageProps<'/ru/novyny/[slug]'>) {
  const { slug } = await params
  return await NovynyItemContent({ slug, locale: 'ru' })
}

export async function generateMetadata({ params }: PageProps<'/ru/novyny/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  return novynyItemMetadata(slug, 'ru')
}
