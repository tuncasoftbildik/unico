import { NextRequest, NextResponse } from 'next/server'
import { filterByDate, filterByCityMonth, getSyncMeta } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const city = searchParams.get('city')

  if (!date && !city || date === 'check') {
    const meta = await getSyncMeta()
    return NextResponse.json({ total: 0, date: 'none', cities: {}, lastSync: meta?.lastSync || null })
  }

  // Şehir bazlı aylık sorgu
  const reservations = city
    ? await filterByCityMonth(city)
    : await filterByDate(date!)

  // Tarihe göre grupla (şehir modunda) veya şehre göre grupla
  const groups: Record<string, typeof reservations> = {}
  let cancelledCount = 0

  for (const r of reservations) {
    const key = city ? (r.pickupDateISO || r.flightDateISO || 'Tarihsiz') : r.city
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
    if (r.type === 'cancelled') cancelledCount++
  }

  // Şehir modunda tarihe göre sırala (en yakın tarih üstte)
  const sortedGroups = city
    ? Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)))
    : groups

  const meta = await getSyncMeta()

  return NextResponse.json({
    total: reservations.length,
    normalCount: reservations.length - cancelledCount,
    cancelledCount,
    date: date || city,
    cities: sortedGroups,
    lastSync: meta?.lastSync || null,
    cityMode: !!city,
  })
}
