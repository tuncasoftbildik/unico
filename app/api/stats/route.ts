import { NextRequest, NextResponse } from 'next/server'
import { getStats } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  const stats = await getStats()
  return NextResponse.json(stats)
}
