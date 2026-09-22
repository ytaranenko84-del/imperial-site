import type { Metadata } from 'next'
import { NovynyContent, novynyMetadata } from '@/app/(frontend)/novyny/page.tsx'
import '@/components/News.css'

export const revalidate = 600

export default async function NewsList() {
  return await NovynyContent({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return novynyMetadata('ru')
}
