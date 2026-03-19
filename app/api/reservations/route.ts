import { NextRequest, NextResponse } from 'next/server'
import { fetchReservations } from '@/lib/imap'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Auth kontrolü
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!date || date === 'check') {
    return NextResponse.json({ total: 0, date: 'none', cities: {} })
  }

  try {
    const reservations = await fetchReservations({ date })

    // Şehre göre grupla
    const cityGroups: Record<string, typeof reservations> = {}
    for (const r of reservations) {
      if (!cityGroups[r.city]) cityGroups[r.city] = []
      cityGroups[r.city].push(r)
    }

    return NextResponse.json({
      total: reservations.length,
      date,
      cities: cityGroups,
    })
  } catch (err) {
    console.error('[API] Rezervasyon çekme hatası:', err)
    return NextResponse.json({ error: 'Mail sunucusuna bağlanılamadı.' }, { status: 500 })
  }
}
