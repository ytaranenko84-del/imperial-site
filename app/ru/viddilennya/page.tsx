import type { Metadata } from 'next'
import { ViddilennyaContent, viddilennyaMetadata } from '@/app/(frontend)/viddilennya/page.tsx'
import '@/components/Branches.css'

export const revalidate = 600

export default async function BranchesPage() {
  return await ViddilennyaContent({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return viddilennyaMetadata('ru')
}
