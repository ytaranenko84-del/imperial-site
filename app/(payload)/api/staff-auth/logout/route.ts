import { clearCookieHeader } from '@/lib/staffAuth.ts'

export async function POST() {
  return Response.json({ ok: true }, { headers: { 'set-cookie': clearCookieHeader() } })
}
