import type { Metadata } from 'next'
import { GoldContent, goldMetadata } from '@/app/(frontend)/tsina-zolota/page.tsx'
import '@/components/Calculator.css'
import '@/components/Branches.css'
import '@/components/Booking.css'
import '@/components/GoldPrice.css'

export const revalidate = 60

export default async function GoldPage() {
  return await GoldContent({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return goldMetadata('ru')
}
