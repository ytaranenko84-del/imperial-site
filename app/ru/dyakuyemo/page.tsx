import type { Metadata } from 'next'
import { DyakuyemoContent, dyakuyemoMetadata } from '@/app/(frontend)/dyakuyemo/page.tsx'
import '@/components/News.css'

export const revalidate = 600

export default async function ThankYouPage() {
  return await DyakuyemoContent({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return dyakuyemoMetadata('ru')
}
