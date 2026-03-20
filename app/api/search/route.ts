import { NextRequest, NextResponse } from 'next/server'
import { searchReservations } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''

  if (q.length < 2) {
    return NextResponse.json({ results: [], cities: {}, total: 0 })
  }

  const results = await searchReservations(q)

  const cityGroups: Record<string, typeof results> = {}
  for (const r of results) {
    if (!cityGroups[r.city]) cityGroups[r.city] = []
    cityGroups[r.city].push(r)
  }

  return NextResponse.json({
    results,
    cities: cityGroups,
    total: results.length,
  })
}
