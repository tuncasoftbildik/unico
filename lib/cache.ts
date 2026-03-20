/**
 * Turso veritabanı tabanlı cache sistemi
 * booking_id PRIMARY KEY — her rezervasyon tek satır, dedup gerekmez.
 */

import type { Reservation } from './types'
import { getDb, initDb } from './db'

let dbInitialized = false

async function ensureDb() {
  if (!dbInitialized) {
    await initDb()
    dbInitialized = true
  }
}

interface SyncMeta {
  lastSync: string
  totalEmails: number
  lastUid: number
}

// =============================================
// Reservation → DB row dönüştürücüler
// =============================================

function reservationToRow(r: Reservation) {
  const transferDate = r.flightDateISO || r.pickupDateISO || null
  return {
    booking_id: r.bookingId,
    type: r.type,
    category: r.category,
    passengers: r.passengers,
    pickup_location: r.pickupLocation,
    dropoff_location: r.dropoffLocation,
    flight_number: r.flightNumber || null,
    flight_date: r.flightDate || null,
    flight_date_iso: r.flightDateISO || null,
    pickup_date: r.pickupDate || null,
    pickup_date_iso: r.pickupDateISO || null,
    pickup_time: r.pickupTime || null,
    origin_airport: r.originAirport || null,
    distance: r.distance || null,
    city: r.city,
    email_date: r.emailDate,
    subject: r.subject,
    notes: r.notes || null,
    passenger_name: r.passengerName || null,
    passenger_phone: r.passengerPhone || null,
    driver_sign: r.driverSign || null,
    journey_charge: r.journeyCharge || null,
    transfer_date: transferDate,
  }
}

function rowToReservation(row: Record<string, unknown>): Reservation {
  return {
    bookingId: row.booking_id as string,
    type: row.type as 'new' | 'cancelled' | 'updated',
    category: row.category as string,
    passengers: row.passengers as number,
    pickupLocation: row.pickup_location as string,
    dropoffLocation: row.dropoff_location as string,
    flightNumber: row.flight_number as string | undefined,
    flightDate: row.flight_date as string | undefined,
    flightDateISO: row.flight_date_iso as string | undefined,
    pickupDate: row.pickup_date as string | undefined,
    pickupDateISO: row.pickup_date_iso as string | undefined,
    pickupTime: row.pickup_time as string | undefined,
    originAirport: row.origin_airport as string | undefined,
    distance: row.distance as string | undefined,
    city: row.city as string,
    emailDate: row.email_date as string,
    subject: row.subject as string,
    notes: row.notes as string | undefined,
    passengerName: row.passenger_name as string | undefined,
    passengerPhone: row.passenger_phone as string | undefined,
    driverSign: row.driver_sign as string | undefined,
    journeyCharge: row.journey_charge as string | undefined,
  }
}

// =============================================
// Cache'den oku
// =============================================

export async function getCachedReservations(): Promise<Reservation[]> {
  await ensureDb()
  const db = getDb()
  const result = await db.execute('SELECT * FROM reservations')
  return result.rows.map(row => rowToReservation(row as unknown as Record<string, unknown>))
}

export async function getSyncMeta(): Promise<SyncMeta | null> {
  await ensureDb()
  const db = getDb()
  const result = await db.execute('SELECT * FROM sync_meta WHERE id = 1')
  if (result.rows.length === 0) return null
  const row = result.rows[0] as unknown as Record<string, unknown>
  return {
    lastSync: row.last_sync as string,
    totalEmails: row.total_emails as number,
    lastUid: row.last_uid as number,
  }
}

// =============================================
// Cache'e yaz
// =============================================

export async function saveSyncMeta(meta: SyncMeta): Promise<void> {
  await ensureDb()
  const db = getDb()
  await db.execute({
    sql: `INSERT INTO sync_meta (id, last_sync, total_emails, last_uid)
          VALUES (1, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET last_sync = ?, total_emails = ?, last_uid = ?`,
    args: [meta.lastSync, meta.totalEmails, meta.lastUid, meta.lastSync, meta.totalEmails, meta.lastUid],
  })
}

// =============================================
// Cache'e merge et (yeni mailler ekle, iptalleri güncelle)
// booking_id PK — aynı booking gelirse type/bilgiler güncellenir
// =============================================

export async function mergeReservations(newItems: Reservation[]): Promise<Reservation[]> {
  await ensureDb()
  const db = getDb()

  const upsertSql = `INSERT INTO reservations (booking_id, type, category, passengers, pickup_location, dropoff_location,
        flight_number, flight_date, flight_date_iso, pickup_date, pickup_date_iso, pickup_time,
        origin_airport, distance, city, email_date, subject, notes,
        passenger_name, passenger_phone, driver_sign, journey_charge, transfer_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(booking_id) DO UPDATE SET
        type = excluded.type, category = excluded.category, passengers = excluded.passengers,
        pickup_location = excluded.pickup_location, dropoff_location = excluded.dropoff_location,
        flight_number = excluded.flight_number, flight_date = excluded.flight_date,
        flight_date_iso = excluded.flight_date_iso, pickup_date = excluded.pickup_date,
        pickup_date_iso = excluded.pickup_date_iso, pickup_time = excluded.pickup_time,
        origin_airport = excluded.origin_airport, distance = excluded.distance,
        city = excluded.city, email_date = excluded.email_date, subject = excluded.subject,
        notes = excluded.notes, passenger_name = excluded.passenger_name,
        passenger_phone = excluded.passenger_phone, driver_sign = excluded.driver_sign,
        journey_charge = excluded.journey_charge, transfer_date = excluded.transfer_date`

  // 5'erli batch'ler halinde yaz
  for (let i = 0; i < newItems.length; i += 5) {
    const batch = newItems.slice(i, i + 5)
    await db.batch(batch.map(r => {
      const row = reservationToRow(r)
      return {
        sql: upsertSql,
        args: [
          row.booking_id, row.type, row.category, row.passengers,
          row.pickup_location, row.dropoff_location, row.flight_number, row.flight_date,
          row.flight_date_iso, row.pickup_date, row.pickup_date_iso, row.pickup_time,
          row.origin_airport, row.distance, row.city, row.email_date, row.subject, row.notes,
          row.passenger_name, row.passenger_phone, row.driver_sign, row.journey_charge, row.transfer_date,
        ],
      }
    }))
  }

  const countResult = await db.execute('SELECT COUNT(*) as cnt FROM reservations')
  const total = Number((countResult.rows[0] as unknown as Record<string, unknown>).cnt)

  return { length: total } as unknown as Reservation[]
}

// =============================================
// Tarih filtresi — transfer_date sütunu direkt kullanılır
// =============================================

export async function filterByDate(date: string): Promise<Reservation[]> {
  await ensureDb()
  const db = getDb()

  const result = await db.execute({
    sql: `SELECT * FROM reservations WHERE transfer_date = ? ORDER BY pickup_time, booking_id`,
    args: [date],
  })

  return result.rows.map(row => rowToReservation(row as unknown as Record<string, unknown>))
}

// =============================================
// Arama
// =============================================

export async function searchReservations(query: string): Promise<Reservation[]> {
  await ensureDb()
  const db = getDb()
  const q = query.toLowerCase().trim()
  if (!q) return []

  const pattern = `%${q}%`
  const result = await db.execute({
    sql: `SELECT * FROM reservations
          WHERE booking_id LIKE ? OR passenger_name LIKE ? OR flight_number LIKE ?
          OR pickup_location LIKE ? OR dropoff_location LIKE ? OR city LIKE ? OR category LIKE ?
          ORDER BY email_date DESC LIMIT 50`,
    args: [pattern, pattern, pattern, pattern, pattern, pattern, pattern],
  })

  return result.rows.map(row => rowToReservation(row as unknown as Record<string, unknown>))
}

// =============================================
// İstatistikler — DEDUP_CTE yok, doğrudan sorgular
// =============================================

export interface CityMonthly {
  city: string
  total: number
  newCount: number
  cancelledCount: number
  updatedCount: number
}

export interface StatsData {
  totalAll: number
  todayCount: number
  tomorrowCount: number
  weekCount: number
  monthCount: number
  monthCancelled: number
  monthNew: number
  monthUpdated: number
  cityBreakdown: { city: string; count: number }[]
  cityMonthly: CityMonthly[]
  dailyCounts: { date: string; count: number }[]
  typeBreakdown: { type: string; count: number }[]
  monthName: string
}

// Stats in-memory cache — 30 saniye TTL
let statsCache: { data: StatsData; time: number } | null = null
const STATS_TTL = 30_000

export async function getStats(): Promise<StatsData> {
  if (statsCache && Date.now() - statsCache.time < STATS_TTL) {
    return statsCache.data
  }

  await ensureDb()
  const db = getDb()

  const today = new Date()
  const todayISO = toDateStr(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowISO = toDateStr(tomorrow)

  const weekStart = new Date(today)
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1
  weekStart.setDate(today.getDate() - dayOfWeek)
  const weekStartISO = toDateStr(weekStart)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthStartISO = toDateStr(monthStart)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const monthEndISO = toDateStr(monthEnd)

  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 29)
  const thirtyDaysAgoISO = toDateStr(thirtyDaysAgo)

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

  // Doğrudan sorgular — CTE yok, booking_id zaten PK
  const results = await db.batch([
    // 1) Özet sayılar
    {
      sql: `SELECT
          COUNT(*) AS total_all,
          SUM(CASE WHEN transfer_date = ? AND type != 'cancelled' THEN 1 ELSE 0 END) AS today_count,
          SUM(CASE WHEN transfer_date = ? AND type != 'cancelled' THEN 1 ELSE 0 END) AS tomorrow_count,
          SUM(CASE WHEN transfer_date >= ? AND transfer_date <= ? THEN 1 ELSE 0 END) AS week_count,
          SUM(CASE WHEN transfer_date >= ? AND transfer_date <= ? THEN 1 ELSE 0 END) AS month_count,
          SUM(CASE WHEN transfer_date >= ? AND transfer_date <= ? AND type = 'cancelled' THEN 1 ELSE 0 END) AS month_cancelled,
          SUM(CASE WHEN transfer_date >= ? AND transfer_date <= ? AND type = 'new' THEN 1 ELSE 0 END) AS month_new,
          SUM(CASE WHEN transfer_date >= ? AND transfer_date <= ? AND type = 'updated' THEN 1 ELSE 0 END) AS month_updated
        FROM reservations`,
      args: [
        todayISO, tomorrowISO,
        weekStartISO, todayISO,
        monthStartISO, monthEndISO,
        monthStartISO, monthEndISO,
        monthStartISO, monthEndISO,
        monthStartISO, monthEndISO,
      ],
    },
    // 2) Bu ay şehir bazlı
    {
      sql: `SELECT city,
          COUNT(*) AS total,
          SUM(CASE WHEN type = 'new' THEN 1 ELSE 0 END) AS new_count,
          SUM(CASE WHEN type = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
          SUM(CASE WHEN type = 'updated' THEN 1 ELSE 0 END) AS updated_count
        FROM reservations WHERE transfer_date >= ? AND transfer_date <= ?
        GROUP BY city ORDER BY total DESC`,
      args: [monthStartISO, monthEndISO],
    },
    // 3) Son 30 gün günlük
    {
      sql: `SELECT transfer_date AS date, COUNT(*) AS count
        FROM reservations WHERE transfer_date >= ? AND transfer_date <= ?
        GROUP BY transfer_date ORDER BY transfer_date`,
      args: [thirtyDaysAgoISO, todayISO],
    },
    // 4) Tüm zamanlar şehir dağılımı
    {
      sql: `SELECT city, COUNT(*) AS count FROM reservations GROUP BY city ORDER BY count DESC LIMIT 10`,
      args: [],
    },
    // 5) Tip dağılımı
    {
      sql: `SELECT type, COUNT(*) AS count FROM reservations GROUP BY type ORDER BY count DESC`,
      args: [],
    },
  ])

  const [summaryRes, cityMonthRes, dailyRes, cityAllRes, typeRes] = results

  const s = summaryRes.rows[0] as unknown as Record<string, number>

  const cityMonthly: CityMonthly[] = cityMonthRes.rows.map(row => {
    const r = row as unknown as Record<string, unknown>
    return {
      city: r.city as string,
      total: Number(r.total),
      newCount: Number(r.new_count),
      cancelledCount: Number(r.cancelled_count),
      updatedCount: Number(r.updated_count),
    }
  })

  // Son 30 gün — eksik günleri 0 ile doldur
  const dailyMap = new Map<string, number>()
  for (const row of dailyRes.rows) {
    const r = row as unknown as Record<string, unknown>
    dailyMap.set(r.date as string, Number(r.count))
  }
  const dailyCounts: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = toDateStr(d)
    dailyCounts.push({ date: dateStr, count: dailyMap.get(dateStr) || 0 })
  }

  const cityBreakdown = cityAllRes.rows.map(row => {
    const r = row as unknown as Record<string, unknown>
    return { city: r.city as string, count: Number(r.count) }
  })

  const typeBreakdown = typeRes.rows.map(row => {
    const r = row as unknown as Record<string, unknown>
    return { type: r.type as string, count: Number(r.count) }
  })

  const result: StatsData = {
    totalAll: Number(s.total_all) || 0,
    todayCount: Number(s.today_count) || 0,
    tomorrowCount: Number(s.tomorrow_count) || 0,
    weekCount: Number(s.week_count) || 0,
    monthCount: Number(s.month_count) || 0,
    monthCancelled: Number(s.month_cancelled) || 0,
    monthNew: Number(s.month_new) || 0,
    monthUpdated: Number(s.month_updated) || 0,
    cityBreakdown,
    cityMonthly,
    dailyCounts,
    typeBreakdown,
    monthName: monthNames[today.getMonth()],
  }

  statsCache = { data: result, time: Date.now() }
  return result
}

function toDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
