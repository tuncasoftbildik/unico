import { NextRequest, NextResponse } from 'next/server'
import { filterByDate, getSyncMeta } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  if (!date || date === 'check') {
    const meta = await getSyncMeta()
    return NextResponse.json({ total: 0, date: 'none', cities: {}, lastSync: meta?.lastSync || null })
  }

  const reservations = await filterByDate(date)

  // Şehre göre grupla ve iptal sayısını hesapla
  const cityGroups: Record<string, typeof reservations> = {}
  let cancelledCount = 0
  
  for (const r of reservations) {
    if (!cityGroups[r.city]) cityGroups[r.city] = []
    cityGroups[r.city].push(r)
    if (r.type === 'cancelled') cancelledCount++
  }

  const meta = await getSyncMeta()

  return NextResponse.json({
    total: reservations.length,
    normalCount: reservations.length - cancelledCount,
    cancelledCount,
    date,
    cities: cityGroups,
    lastSync: meta?.lastSync || null,
  })
}
