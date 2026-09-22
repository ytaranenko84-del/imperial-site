import type { Metadata } from 'next'
import { CATEGORIES } from '@/lib/categories'
import { CategoryContent, categoryMetadata } from '@/app/(frontend)/zastava/[category]/page.tsx'
import '@/components/EvalForm.css'

export const revalidate = 600

export function generateStaticParams() {
  return CATEGORIES.uk.map((c) => ({ category: c.slug }))
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  return await CategoryContent({ category, locale: 'ru' })
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> },
): Promise<Metadata> {
  const { category } = await params
  return categoryMetadata(category, 'ru')
}
