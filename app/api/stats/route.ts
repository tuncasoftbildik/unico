import { NextRequest, NextResponse } from 'next/server'
import { getStats, invalidateStatsCache } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  // t parametresi varsa cache'i bypass et
  const { searchParams } = new URL(request.url)
  if (searchParams.has('t')) {
    invalidateStatsCache()
  }

  const stats = await getStats()
  return NextResponse.json(stats)
}
