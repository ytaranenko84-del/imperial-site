import type { Metadata } from 'next'
import { HodynnykyContent, hodynnykyMetadata } from '@/app/(frontend)/zastava/hodynnyky/page.tsx'
import '@/components/Watches.css'

export const revalidate = 600

export default async function WatchesPage() {
  return await HodynnykyContent({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return hodynnykyMetadata('ru')
}
