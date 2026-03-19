import { NextRequest, NextResponse } from 'next/server'
import { mockReservations } from '@/lib/mock-data'

export async function GET(request: NextRequest) {
  // Auth kontrolü
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') // YYYY-MM-DD

  let results = [...mockReservations]

  // Tarihe göre filtrele (check-in tarihi)
  if (date) {
    results = results.filter(r => r.checkIn === date)
  }

  // Şehre göre grupla
  const cityGroups: Record<string, typeof results> = {}
  for (const r of results) {
    if (!cityGroups[r.city]) cityGroups[r.city] = []
    cityGroups[r.city].push(r)
  }

  return NextResponse.json({
    total: results.length,
    date: date || 'all',
    cities: cityGroups,
  })
}
