import { NextRequest, NextResponse } from 'next/server'
import { filterByDate, getSyncMeta } from '@/lib/cache'
import { getDb, initDb } from '@/lib/db'
import type { Reservation } from '@/lib/types'

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

  const reservations: Reservation[] = city
    ? await filterByCity(city)
    : await filterByDate(date!)

  const groups: Record<string, Reservation[]> = {}
  let cancelledCount = 0

  for (const r of reservations) {
    const key = city ? (r.pickupDateISO || r.flightDateISO || 'Tarihsiz') : r.city
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
    if (r.type === 'cancelled') cancelledCount++
  }

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

async function filterByCity(city: string): Promise<Reservation[]> {
  await initDb()
  const db = getDb()
  const today = new Date()
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}`

  const result = await db.execute({
    sql: `SELECT * FROM reservations WHERE city = ? AND transfer_date >= ? AND transfer_date <= ? ORDER BY transfer_date, pickup_time`,
    args: [city, monthStart, monthEnd],
  })

  return result.rows.map(row => {
    const r = row as unknown as Record<string, unknown>
    return {
      bookingId: r.booking_id as string,
      type: r.type as Reservation['type'],
      category: r.category as string,
      passengers: r.passengers as number,
      pickupLocation: r.pickup_location as string,
      dropoffLocation: r.dropoff_location as string,
      flightNumber: r.flight_number as string | undefined,
      flightDateISO: r.flight_date_iso as string | undefined,
      pickupDateISO: r.pickup_date_iso as string | undefined,
      pickupTime: r.pickup_time as string | undefined,
      city: r.city as string,
      emailDate: r.email_date as string,
      subject: r.subject as string,
      passengerName: r.passenger_name as string | undefined,
      passengerPhone: r.passenger_phone as string | undefined,
      driverSign: r.driver_sign as string | undefined,
      journeyCharge: r.journey_charge as string | undefined,
      distance: r.distance as string | undefined,
    }
  })
}
