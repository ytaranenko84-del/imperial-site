import type { Metadata } from 'next'
import { HomePage, homeMetadata } from '@/app/(frontend)/page.tsx'

export const revalidate = 60

export default async function Home() {
  return await HomePage({ locale: 'ru' })
}

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata('ru')
}
