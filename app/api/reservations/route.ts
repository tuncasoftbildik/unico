import { NextRequest, NextResponse } from 'next/server'
import { getCachedReservations, filterByDate, getSyncMeta } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Auth kontrolü
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

  // Cache'ten oku — anında gelir
  const all = await getCachedReservations()
  const reservations = filterByDate(all, date)

  // Şehre göre grupla
  const cityGroups: Record<string, typeof reservations> = {}
  for (const r of reservations) {
    if (!cityGroups[r.city]) cityGroups[r.city] = []
    cityGroups[r.city].push(r)
  }

  const meta = await getSyncMeta()

  return NextResponse.json({
    total: reservations.length,
    date,
    cities: cityGroups,
    lastSync: meta?.lastSync || null,
  })
}
