/**
 * Booking.com Taxi Supplier API entegrasyonu
 * IMAP yerine doğrudan API'den rezervasyon çeker.
 */

import type { Reservation } from './types'
import { mergeReservations, saveSyncMeta, getSyncMeta } from './cache'
import { getDb } from './db'

const API_BASE = 'https://dispatchapi.taxi.booking.com'
const OAUTH_TOKEN_URL = 'https://auth.dispatchapi.taxi.booking.com/oauth2/token'
const CLIENT_ID = process.env.BOOKING_CLIENT_ID || '1alf6pjll0t90hqe70ese68i94'
const CLIENT_SECRET = process.env.BOOKING_CLIENT_SECRET || '59a04tts82f3tf6mm1iad1hgm38jvqp9piprl7pn5m52t6k24hs'

let accessToken: string | null = null
let tokenExpiresAt = 0

// =============================================
// OAuth 2.0 Token
// =============================================

async function getToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    throw new Error(`Token alınamadı: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  accessToken = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
  return accessToken!
}

// =============================================
// Şehir çıkarma (pickup/dropoff adreslerinden)
// =============================================

function extractCity(pickup: string, dropoff: string): string {
  const text = `${pickup} ${dropoff}`
  if (/[İi]stanbul/i.test(text)) return 'İstanbul'
  if (/Antalya/i.test(text)) return 'Antalya'
  if (/Bodrum|Muğla|Milas/i.test(text)) return 'Bodrum'
  if (/[İi]zmir/i.test(text)) return 'İzmir'
  if (/Dalaman|Fethiye/i.test(text)) return 'Dalaman'
  if (/Trabzon/i.test(text)) return 'Trabzon'
  if (/Ankara|Esenboğa/i.test(text)) return 'Ankara'
  if (/Kapadokya|Cappadocia|Nevşehir|Kayseri|Göreme/i.test(text)) return 'Kapadokya'
  if (/Alanya/i.test(text)) return 'Alanya'
  if (/Side/i.test(text)) return 'Side'
  if (/Belek/i.test(text)) return 'Belek'
  if (/Bursa/i.test(text)) return 'Bursa'
  if (/Denizli|Pamukkale/i.test(text)) return 'Denizli'
  if (/Marmaris/i.test(text)) return 'Marmaris'
  if (/Kuşadası|Kusadasi/i.test(text)) return 'Kuşadası'
  if (/Sapanca|Sakarya/i.test(text)) return 'Sapanca'
  return 'Diğer'
}

// =============================================
// API status → Panel type eşlemesi
// =============================================

function mapStatus(apiStatus: string): 'new' | 'cancelled' | 'updated' {
  switch (apiStatus) {
    case 'CANCELLED':
    case 'REJECTED':
    case 'NO_SHOW':
      return 'cancelled'
    case 'COMPLETED':
      return 'updated'
    default:
      return 'new'
  }
}

// =============================================
// API booking → Reservation dönüştürme
// =============================================

interface ApiBooking {
  reference?: string
  bookingReference?: string
  legId?: string
  status?: string
  pickup_date_time?: string
  pickup_date_time_zone?: string
  booked_date?: string
  pickup?: {
    establishment_name?: string
    address?: string
    type?: string
    latitude?: number
    longitude?: number
    postcode?: string
    country?: string
  }
  dropoff?: {
    establishment_name?: string
    address?: string
    type?: string
    latitude?: number
    longitude?: number
  }
  passenger?: {
    title?: string
    name?: string
    telephone_number?: string
  }
  vehicle_type?: string
  passenger_count?: number
  flight_number?: string
  meet_and_greet?: boolean
  meet_and_greet_message?: string
  driver_assigned?: {
    name?: string
    telephone_number?: string
  }
  price?: {
    amount?: string
    currency?: string
    customerOriginalPrice?: number
    customerCurrency?: string
  }
  links?: Array<{ rel?: string; href?: string; type?: string }>
  [key: string]: unknown
}

interface ApiResponse {
  bookings?: ApiBooking[]
  links?: Array<{ rel?: string; href?: string; type?: string }>
}

function parseBooking(b: ApiBooking): Reservation {
  const pickup = b.pickup?.establishment_name || b.pickup?.address || ''
  const dropoff = b.dropoff?.establishment_name || b.dropoff?.address || ''
  const city = extractCity(pickup, dropoff)
  const status = mapStatus(b.status || 'NEW')

  // pickup_date_time → tarih ve saat ayır (format: "2026-03-22T14:35:00")
  let pickupDateISO: string | undefined
  let pickupTime: string | undefined
  let pickupDate: string | undefined

  if (b.pickup_date_time) {
    // API tarihi direkt parse et (timezone bilgisi ayrı geliyor)
    const parts = b.pickup_date_time.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (parts) {
      pickupDateISO = `${parts[1]}-${parts[2]}-${parts[3]}`
      pickupTime = `${parts[4]}:${parts[5]}`
      const dt = new Date(b.pickup_date_time)
      pickupDate = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    }
  }

  // Fiyat (amount string olarak geliyor: "12.59")
  let journeyCharge: string | undefined
  if (b.price?.amount) {
    journeyCharge = `${b.price.currency || 'EUR'} ${b.price.amount}`
  }

  // Yolcu adı
  const passengerName = b.passenger
    ? `${b.passenger.title || ''} ${b.passenger.name || ''}`.trim()
    : undefined

  // Pickup tipi (Airport, GEO, vb.)
  const isAirport = b.pickup?.type?.toLowerCase() === 'airport'
  const flightDateISO = isAirport ? pickupDateISO : undefined

  // Booking ID — bookingReference (leg bazlı, gidiş-dönüş ayrı ayrı)
  const bookingId = b.bookingReference || b.legId || b.reference || ''

  return {
    bookingId,
    type: status,
    category: b.vehicle_type || '-',
    passengers: b.passenger_count || 1,
    pickupLocation: pickup,
    dropoffLocation: dropoff,
    flightNumber: b.flight_number || undefined,
    flightDate: isAirport ? pickupDate : undefined,
    flightDateISO,
    pickupDate,
    pickupDateISO,
    pickupTime,
    originAirport: isAirport ? pickup : undefined,
    distance: undefined,
    city,
    emailDate: b.booked_date || new Date().toISOString(),
    subject: `Booking #${bookingId} — ${b.status}`,
    notes: b.meet_and_greet ? `Meet & Greet: ${b.meet_and_greet_message || 'Evet'}` : undefined,
    passengerName,
    passengerPhone: b.passenger?.telephone_number || undefined,
    driverSign: b.meet_and_greet_message || passengerName,
    journeyCharge,
  }
}

// =============================================
// API'den booking'leri çek (cursor tabanlı sayfalama)
// =============================================

async function fetchBookingsPage(url: string, token: string): Promise<{ bookings: ApiBooking[]; nextUrl: string | null }> {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`

  const res = await fetch(fullUrl, {
    headers: { Authorization: token },
  })

  if (!res.ok) {
    console.error(`[API] Hata: ${res.status} — ${fullUrl.substring(0, 80)}`)
    return { bookings: [], nextUrl: null }
  }

  const text = await res.text()
  let data: ApiResponse
  try {
    data = JSON.parse(text)
  } catch {
    console.error(`[API] JSON parse hatası`)
    return { bookings: [], nextUrl: null }
  }

  const bookings = data.bookings || []
  const nextLink = data.links?.find(l => l.rel === 'next')

  return { bookings, nextUrl: nextLink?.href || null }
}

async function fetchAllBookings(): Promise<ApiBooking[]> {
  const token = await getToken()
  const allBookings: ApiBooking[] = []

  // 1) Aktif booking'ler — statüsüz, bu ayın başından itibaren
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const fromDate = monthStart.toISOString().split('.')[0].replace(/:/g, '%3A')

  let nextUrl: string | null = `/v1/bookings?size=500&from=${fromDate}`
  console.log(`[API] Aktif booking'ler çekiliyor (${monthStart.toISOString().split('T')[0]}'den itibaren)...`)

  while (nextUrl) {
    const { bookings, nextUrl: next } = await fetchBookingsPage(nextUrl, token)
    if (bookings.length === 0) break
    allBookings.push(...bookings)
    console.log(`[API] ${allBookings.length} booking alındı...`)
    nextUrl = next
    if (allBookings.length > 10000) break
  }

  // 2) İptal edilen booking'ler — ayrıca çek
  console.log(`[API] CANCELLED booking'ler çekiliyor...`)
  nextUrl = `/v1/bookings?status=CANCELLED&size=500&from=${fromDate}`

  while (nextUrl) {
    const { bookings, nextUrl: next } = await fetchBookingsPage(nextUrl, token)
    if (bookings.length === 0) break
    allBookings.push(...bookings)
    console.log(`[API] Toplam ${allBookings.length} booking (iptallerle)...`)
    nextUrl = next
    if (allBookings.length > 15000) break
  }

  // Duplicate'ları kaldır (bookingReference/leg bazlı)
  const seen = new Set<string>()
  const unique = allBookings.filter(b => {
    const id = b.bookingReference || b.legId || b.reference || ''
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })

  console.log(`[API] Toplam ${unique.length} benzersiz booking`)
  return unique
}

// =============================================
// Ana sync fonksiyonu
// =============================================

export async function syncFromApi(): Promise<{ synced: number; total: number }> {
  console.log('[API Sync] Başlatılıyor...')

  const apiBookings = await fetchAllBookings()
  console.log(`[API Sync] ${apiBookings.length} booking API'den çekildi`)

  if (apiBookings.length === 0) {
    const meta = await getSyncMeta()
    await saveSyncMeta({
      lastSync: new Date().toISOString(),
      totalEmails: meta?.totalEmails || 0,
      lastUid: 0,
    })
    return { synced: 0, total: meta?.totalEmails || 0 }
  }

  // API booking'lerini Reservation formatına dönüştür
  const reservations: Reservation[] = apiBookings
    .filter(b => b.bookingReference || b.reference)
    .map(parseBooking)

  console.log(`[API Sync] ${reservations.length} rezervasyon parse edildi`)

  // DB'ye merge et (batch halinde)
  const BATCH_SIZE = 50
  let syncedCount = 0

  for (let i = 0; i < reservations.length; i += BATCH_SIZE) {
    const batch = reservations.slice(i, i + BATCH_SIZE)
    await mergeReservations(batch)
    syncedCount += batch.length
  }

  const countResult = await getDb().execute('SELECT COUNT(*) as cnt FROM reservations')
  const totalCount = Number((countResult.rows[0] as unknown as Record<string, number>).cnt)

  await saveSyncMeta({
    lastSync: new Date().toISOString(),
    totalEmails: totalCount,
    lastUid: 0,
  })

  console.log(`[API Sync] Tamamlandı! ${syncedCount} booking işlendi. Toplam DB: ${totalCount}`)

  return { synced: syncedCount, total: totalCount }
}
