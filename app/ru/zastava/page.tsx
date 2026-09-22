import type { Metadata } from 'next'
import { ZastavaContent, zastavaMetadata } from '@/app/(frontend)/zastava/page.tsx'

export const revalidate = 600

export default async function ZastavaPage() {
  return await ZastavaContent({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return zastavaMetadata('ru')
}
