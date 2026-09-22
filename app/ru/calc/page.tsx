import type { Metadata } from 'next'
import { CalcContent, calcMetadata } from '@/app/(frontend)/calc/page.tsx'
import '@/components/Calculator.css'
import '@/components/Branches.css'
import '@/components/Booking.css'

export const revalidate = 60

export default async function CalcPage() {
  return await CalcContent({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return calcMetadata('ru')
}
