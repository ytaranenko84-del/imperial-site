import type { Metadata } from 'next'
import { ProNasContent, proNasMetadata } from '@/app/(frontend)/pro-nas/page.tsx'

export const revalidate = 600

export default async function AboutPage() {
  return await ProNasContent({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return proNasMetadata('ru')
}
