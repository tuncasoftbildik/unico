/**
 * Salesforce REST API client
 * sf CLI ile alınan session veya OAuth credentials ile bağlanır
 */

import type { Reservation } from './types'

interface SFAuthResult {
  accessToken: string
  instanceUrl: string
}

let cachedAuth: SFAuthResult | null = null
let authExpiry = 0

async function getAuth(): Promise<SFAuthResult> {
  // Cache'deki token hala geçerliyse kullan (55 dk)
  if (cachedAuth && Date.now() < authExpiry) {
    return cachedAuth
  }

  // Direkt access token varsa kullan (geliştirme ortamı)
  if (process.env.SF_ACCESS_TOKEN) {
    cachedAuth = {
      accessToken: process.env.SF_ACCESS_TOKEN,
      instanceUrl: process.env.SF_INSTANCE_URL || 'https://triocab.my.salesforce.com',
    }
    authExpiry = Date.now() + 55 * 60 * 1000
    return cachedAuth
  }

  // Refresh token flow (production)
  const res = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SF_REFRESH_TOKEN!,
      client_id: process.env.SF_CLIENT_ID!,
      client_secret: process.env.SF_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SF Auth failed: ${err}`)
  }

  const data = await res.json()
  cachedAuth = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
  }
  authExpiry = Date.now() + 55 * 60 * 1000 // 55 dakika
  return cachedAuth
}

async function sfQuery<T = Record<string, unknown>>(soql: string): Promise<T[]> {
  const auth = await getAuth()
  const url = `${auth.instanceUrl}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  })

  if (!res.ok) {
    // Token expired — retry once
    if (res.status === 401) {
      cachedAuth = null
      authExpiry = 0
      const auth2 = await getAuth()
      const res2 = await fetch(url, {
        headers: { Authorization: `Bearer ${auth2.accessToken}` },
      })
      if (!res2.ok) throw new Error(`SF Query failed: ${await res2.text()}`)
      const data2 = await res2.json()
      return data2.records
    }
    throw new Error(`SF Query failed: ${await res.text()}`)
  }

  const data = await res.json()
  let records = data.records as T[]

  // Handle pagination for large result sets
  let nextUrl = data.nextRecordsUrl
  while (nextUrl) {
    const nextRes = await fetch(`${auth.instanceUrl}${nextUrl}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
    if (!nextRes.ok) break
    const nextData = await nextRes.json()
    records = records.concat(nextData.records)
    nextUrl = nextData.nextRecordsUrl
  }

  return records
}

async function sfCountQuery(soql: string): Promise<number> {
  const auth = await getAuth()
  const url = `${auth.instanceUrl}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  })
  if (!res.ok) throw new Error(`SF Count Query failed: ${await res.text()}`)
  const data = await res.json()
  return data.totalSize || 0
}

// =============================================
// SF field'lardan Reservation'a dönüştürme
// =============================================

interface SFReservation {
  Name: string
  Reservation_Id__c: string | null
  Journey_Status__c: string | null
  Vehicle_Type__c: string | null
  Passenger_Count__c: number | null
  Pickup_Address__c: string | null
  Dropoff_Address__c: string | null
  Flight_Number__c: string | null
  Pickup_Date_Time__c: string | null
  Pickup_Date__c: string | null
  Pickup_Resolved_City__c: string | null
  Pickup_Resolved_Region__c: string | null
  CreatedDate: string
  Passenger_Name__c: string | null
  Passenger_Telephone_Number__c: string | null
  Passenger_Meet_and_Greet_Sign_Text__c: string | null
  Price_Amount__c: number | null
  Price_Currency__c: string | null
  Fare_Summary_Including_Vat__c: number | null
  Fare_Summary_Currency__c: string | null
  Journey_Distance__c: number | null
  Distance_Unit__c: string | null
  Airport__r?: { Name: string } | null
  Unico_Revenue__c: number | null
  Origin_Amount__c: number | null
}

function mapStatus(journeyStatus: string | null): 'new' | 'cancelled' | 'cancelledWithCost' | 'updated' {
  if (!journeyStatus) return 'new'
  const s = journeyStatus.toLowerCase()
  if (s.includes('cancel') && s.includes('cost')) return 'cancelledWithCost'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('update') || s.includes('amended')) return 'updated'
  return 'new'
}

function resolveCity(record: SFReservation): string {
  // Tüm alanları birleştirip şehir ara — Türkçe karakterleri normalize et
  const raw = [
    record.Pickup_Address__c,
    record.Dropoff_Address__c,
    record.Pickup_Resolved_City__c,
    record.Pickup_Resolved_Region__c,
    record.Airport__r?.Name,
  ].filter(Boolean).join(' ')
  const allText = raw
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .replace(/Ş/g, 'ş').replace(/Ç/g, 'ç').replace(/Ö/g, 'ö').replace(/Ü/g, 'ü').replace(/Ğ/g, 'ğ')
    .toLowerCase()

  // Havalimanı kodlarından şehir belirle
  if (allText.includes('istanbul') || allText.includes('ist ') || allText.includes('(ist)') || allText.includes('sabiha') || allText.includes('saw ') || allText.includes('(saw)') || allText.includes('fatih') || allText.includes('beyoğlu') || allText.includes('beyoglu') || allText.includes('sultanahmet') || allText.includes('taksim') || allText.includes('kadıköy') || allText.includes('kadikoy') || allText.includes('beşiktaş') || allText.includes('besiktas') || allText.includes('bakırköy') || allText.includes('bakirkoy') || allText.includes('şişli') || allText.includes('sisli') || allText.includes('üsküdar') || allText.includes('uskudar') || allText.includes('arnavutköy') || allText.includes('arnavutkoy') || allText.includes('pendik') || allText.includes('ataşehir') || allText.includes('atasehir') || allText.includes('sarıyer') || allText.includes('sariyer') || allText.includes('beykoz') || allText.includes('bayrampaşa') || allText.includes('bayrampasa') || allText.includes('zeytinburnu') || allText.includes('eyüp') || allText.includes('eyup') || allText.includes('kağıthane') || allText.includes('kagithane') || allText.includes('bakkalkoy') || allText.includes('maltepe') || allText.includes('kartal') || allText.includes('avcılar') || allText.includes('avcilar') || allText.includes('güngören') || allText.includes('gungoren') || allText.includes('bağcılar') || allText.includes('bagcilar') || allText.includes('esenler') || allText.includes('başakşehir') || allText.includes('basaksehir') || allText.includes('beylikdüzü') || allText.includes('beylikduzu') || allText.includes('çekmeköy') || allText.includes('cekmekoy') || allText.includes('esenyurt') || allText.includes('küçükçekmece') || allText.includes('kucukcekmece') || allText.includes('sancaktepe') || allText.includes('sultanbeyli') || allText.includes('tuzla') || allText.includes('ümraniye') || allText.includes('umraniye') || allText.includes('yenibosna') || allText.includes('laleli') || allText.includes('aksaray') || allText.includes('sirkeci') || allText.includes('eminönü') || allText.includes('eminonu') || allText.includes('cankurtaran') || allText.includes('kumkapı') || allText.includes('kumkapi') || allText.includes('harbiye') || allText.includes('nişantaşı') || allText.includes('nisantasi') || allText.includes('levent') || allText.includes('maslak') || allText.includes('mecidiyeköy') || allText.includes('mecidiyekoy')) return 'İstanbul'
  if (allText.includes('antalya') || allText.includes('(ayt)') || allText.includes('ayt ') || allText.includes('lara') || allText.includes('konyaaltı') || allText.includes('konyaalti') || allText.includes('kundu') || allText.includes('belek') || allText.includes('kemer') || allText.includes('side') || allText.includes('manavgat')) return 'Antalya'
  if (allText.includes('alanya')) return 'Alanya'
  if (allText.includes('trabzon') || allText.includes('(tzx)')) return 'Trabzon'
  if (allText.includes('ankara') || allText.includes('(esb)') || allText.includes('esenboğa') || allText.includes('esenboga')) return 'Ankara'
  if (allText.includes('cappadocia') || allText.includes('kapadokya') || allText.includes('nevşehir') || allText.includes('nevsehir') || allText.includes('göreme') || allText.includes('goreme') || allText.includes('kayseri') || allText.includes('(nav)') || allText.includes('(asr)') || allText.includes('ürgüp') || allText.includes('urgup') || allText.includes('avanos') || allText.includes('uçhisar') || allText.includes('uchisar')) return 'Kapadokya'
  if (allText.includes('izmir') || allText.includes('(adb)') || allText.includes('çeşme') || allText.includes('cesme') || allText.includes('alaçatı') || allText.includes('alacati') || allText.includes('kuşadası') || allText.includes('kusadasi')) return 'İzmir'
  if (allText.includes('dalaman') || allText.includes('(dlm)') || allText.includes('fethiye') || allText.includes('ölüdeniz') || allText.includes('oludeniz') || allText.includes('marmaris') || allText.includes('göcek') || allText.includes('gocek')) return 'Dalaman'
  if (allText.includes('bodrum') || allText.includes('(bjv)') || allText.includes('milas')) return 'Bodrum'
  if (allText.includes('bursa') || allText.includes('(yei)')) return 'Bursa'
  if (allText.includes('gaziantep') || allText.includes('(gzt)')) return 'Gaziantep'
  if (allText.includes('denizli') || allText.includes('pamukkale') || allText.includes('(dnz)')) return 'Denizli'

  return 'Diğer'
}

function sfToReservation(r: SFReservation): Reservation {
  const pickupDateTime = r.Pickup_Date_Time__c ? new Date(r.Pickup_Date_Time__c) : null
  const pickupDateISO = r.Pickup_Date__c || (pickupDateTime ? pickupDateTime.toISOString().split('T')[0] : undefined)
  const pickupTime = pickupDateTime
    ? `${String(pickupDateTime.getHours()).padStart(2, '0')}:${String(pickupDateTime.getMinutes()).padStart(2, '0')}`
    : undefined

  const charge = r.Origin_Amount__c
  const currency = 'EUR'
  const journeyCharge = charge ? `${currency} ${charge.toFixed(2)}` : undefined

  const distance = r.Journey_Distance__c
    ? `${r.Journey_Distance__c} ${r.Distance_Unit__c || 'km'}`
    : undefined

  return {
    bookingId: r.Reservation_Id__c || r.Name,
    type: mapStatus(r.Journey_Status__c),
    category: r.Vehicle_Type__c || '-',
    passengers: r.Passenger_Count__c || 1,
    pickupLocation: r.Pickup_Address__c || '',
    dropoffLocation: r.Dropoff_Address__c || '',
    flightNumber: r.Flight_Number__c || undefined,
    flightDateISO: pickupDateISO,
    pickupDateISO,
    pickupTime,
    city: resolveCity(r),
    emailDate: r.CreatedDate,
    subject: `Reservation ${r.Name}`,
    passengerName: r.Passenger_Name__c || undefined,
    passengerPhone: r.Passenger_Telephone_Number__c || undefined,
    driverSign: r.Passenger_Meet_and_Greet_Sign_Text__c || undefined,
    journeyCharge,
    distance,
  }
}

// =============================================
// Public API — cache.ts ile aynı interface
// =============================================

const SF_FIELDS = `
  Name, Reservation_Id__c, Journey_Status__c, Vehicle_Type__c,
  Passenger_Count__c, Pickup_Address__c, Dropoff_Address__c,
  Flight_Number__c, Pickup_Date_Time__c, Pickup_Date__c,
  Pickup_Resolved_City__c, Pickup_Resolved_Region__c,
  CreatedDate, Passenger_Name__c, Passenger_Telephone_Number__c,
  Passenger_Meet_and_Greet_Sign_Text__c, Price_Amount__c,
  Price_Currency__c, Fare_Summary_Including_Vat__c,
  Fare_Summary_Currency__c, Journey_Distance__c, Distance_Unit__c,
  Unico_Revenue__c, Origin_Amount__c
`.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

const RT_FILTER = "RecordType.Name = 'Booking - Unico'"

// =============================================
// CRON SYNC — Günde 3 kez SF'den çekip Turso'ya yaz
// =============================================

export async function syncFromSalesforce(): Promise<{ synced: number; total: number }> {
  const { mergeReservations, saveSyncMeta } = await import('./cache')
  const { getDb, initDb } = await import('./db')

  console.log('[SF Sync] Başlatılıyor...')

  // Bu ay + geçen ay verilerini tek sorguda çek
  const today = new Date()
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const startISO = toDateStr(prevMonthStart)

  const records = await sfQuery<SFReservation>(
    `SELECT ${SF_FIELDS} FROM Reservation__c WHERE ${RT_FILTER} AND Pickup_Date__c >= ${startISO} ORDER BY Pickup_Date_Time__c ASC`
  )

  console.log(`[SF Sync] ${records.length} kayıt SF'den çekildi`)

  if (records.length === 0) {
    return { synced: 0, total: 0 }
  }

  const reservations = records.map(sfToReservation)

  // Turso'ya yaz
  await initDb()
  const BATCH_SIZE = 50
  let syncedCount = 0

  for (let i = 0; i < reservations.length; i += BATCH_SIZE) {
    const batch = reservations.slice(i, i + BATCH_SIZE)
    await mergeReservations(batch)
    syncedCount += batch.length
  }

  const db = getDb()
  const countResult = await db.execute('SELECT COUNT(*) as cnt FROM reservations')
  const totalCount = Number((countResult.rows[0] as unknown as Record<string, number>).cnt)

  await saveSyncMeta({
    lastSync: new Date().toISOString(),
    totalEmails: totalCount,
    lastUid: 0,
  })

  console.log(`[SF Sync] Tamamlandı! ${syncedCount} kayıt işlendi. Toplam DB: ${totalCount}`)
  return { synced: syncedCount, total: totalCount }
}

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
  todayRevenue: number
  monthRevenue: number
  todayCityRevenue: { city: string; revenue: number }[]
  monthCityRevenue: { city: string; revenue: number }[]
  cityBreakdown: { city: string; count: number }[]
  cityMonthly: CityMonthly[]
  dailyCounts: { date: string; count: number }[]
  calendarCounts: { date: string; total: number; cancelled: number }[]
  typeBreakdown: { type: string; count: number }[]
  monthName: string
  // Geçen ay karşılaştırma
  prevMonthCount: number
  prevMonthRevenue: number
  prevMonthName: string
}

function toDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Stats cache — 5 dakika TTL
let statsCache: { data: StatsData; time: number } | null = null
const STATS_TTL = 5 * 60_000

export function invalidateStatsCache() {
  statsCache = null
}

export async function getStats(): Promise<StatsData> {
  // SALESFORCE SORGULARI DEVRE DIŞI — aşırı sorgu limiti aşıldı
  // Boş stats döndür
  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
  const today = new Date()
  const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  return {
    totalAll: 0, todayCount: 0, tomorrowCount: 0, weekCount: 0,
    monthCount: 0, monthCancelled: 0, monthNew: 0, monthUpdated: 0,
    todayRevenue: 0, monthRevenue: 0,
    todayCityRevenue: [], monthCityRevenue: [],
    cityBreakdown: [], cityMonthly: [], dailyCounts: [], calendarCounts: [],
    typeBreakdown: [], monthName: monthNames[today.getMonth()],
    prevMonthCount: 0, prevMonthRevenue: 0, prevMonthName: monthNames[prevMonth.getMonth()],
  }

  /* --- Orijinal SF sorgu kodu devre dışı ---
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

  // Geçen ay
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthStartISO = toDateStr(prevMonthStart)
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
  const prevMonthEndISO = toDateStr(prevMonthEnd)

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

  // Parallel queries
  const [monthRecords, todayRecords, tomorrowRecords, weekRecords, dailyRecords, prevMonthRecords] = await Promise.all([
    sfQuery<SFReservation>(`SELECT ${SF_FIELDS} FROM Reservation__c WHERE ${RT_FILTER} AND Pickup_Date__c >= ${monthStartISO} AND Pickup_Date__c <= ${monthEndISO}`),
    sfQuery<SFReservation>(`SELECT ${SF_FIELDS} FROM Reservation__c WHERE ${RT_FILTER} AND Pickup_Date__c = ${todayISO}`),
    sfQuery<SFReservation>(`SELECT ${SF_FIELDS} FROM Reservation__c WHERE ${RT_FILTER} AND Pickup_Date__c = ${tomorrowISO}`),
    sfQuery<SFReservation>(`SELECT ${SF_FIELDS} FROM Reservation__c WHERE ${RT_FILTER} AND Pickup_Date__c >= ${weekStartISO} AND Pickup_Date__c <= ${todayISO}`),
    sfQuery<SFReservation>(`SELECT ${SF_FIELDS} FROM Reservation__c WHERE ${RT_FILTER} AND Pickup_Date__c >= ${thirtyDaysAgoISO} AND Pickup_Date__c <= ${todayISO}`),
    sfQuery<SFReservation>(`SELECT ${SF_FIELDS} FROM Reservation__c WHERE ${RT_FILTER} AND Pickup_Date__c >= ${prevMonthStartISO} AND Pickup_Date__c <= ${prevMonthEndISO}`),
  ])

  // Total count via totalSize from COUNT() query
  const totalAllData = await sfCountQuery(`SELECT COUNT() FROM Reservation__c WHERE ${RT_FILTER}`)
  const totalAll = totalAllData

  const monthReservations = monthRecords.map(sfToReservation)
  const todayReservations = todayRecords.map(sfToReservation)
  const tomorrowReservations = tomorrowRecords.map(sfToReservation)
  const weekReservations = weekRecords.map(sfToReservation)
  const dailyReservations = dailyRecords.map(sfToReservation)
  const prevMonthReservations = prevMonthRecords.map(sfToReservation)

  // Today count (non-cancelled)
  const todayCount = todayReservations.filter(r => r.type !== 'cancelled').length
  const tomorrowCount = tomorrowReservations.filter(r => r.type !== 'cancelled').length
  const weekCount = weekReservations.length

  // Month stats
  const monthCancelled = monthReservations.filter(r => r.type === 'cancelled').length
  const monthNew = monthReservations.filter(r => r.type === 'new').length
  const monthUpdated = monthReservations.filter(r => r.type === 'updated').length

  // Revenue
  function parseRevenue(r: Reservation): number {
    if (!r.journeyCharge) return 0
    const num = r.journeyCharge.replace(/[^0-9.]/g, '')
    return parseFloat(num) || 0
  }

  const todayRevenue = todayReservations.filter(r => r.type !== 'cancelled').reduce((sum, r) => sum + parseRevenue(r), 0)
  const monthRevenue = monthReservations.filter(r => r.type !== 'cancelled').reduce((sum, r) => sum + parseRevenue(r), 0)
  const prevMonthCount = prevMonthReservations.filter(r => r.type !== 'cancelled').length
  const prevMonthRevenue = prevMonthReservations.filter(r => r.type !== 'cancelled').reduce((sum, r) => sum + parseRevenue(r), 0)

  // City revenue
  function cityRevenue(reservations: Reservation[]): { city: string; revenue: number }[] {
    const map = new Map<string, number>()
    for (const r of reservations.filter(r => r.type !== 'cancelled')) { // cancelledWithCost dahil
      const rev = parseRevenue(r)
      if (rev > 0) map.set(r.city, (map.get(r.city) || 0) + rev)
    }
    return Array.from(map.entries()).map(([city, revenue]) => ({ city, revenue })).sort((a, b) => b.revenue - a.revenue)
  }

  // City monthly breakdown
  const cityMap = new Map<string, CityMonthly>()
  for (const r of monthReservations) {
    const existing = cityMap.get(r.city) || { city: r.city, total: 0, newCount: 0, cancelledCount: 0, updatedCount: 0 }
    existing.total++
    if (r.type === 'new') existing.newCount++
    else if (r.type === 'cancelled') existing.cancelledCount++
    else if (r.type === 'updated') existing.updatedCount++
    cityMap.set(r.city, existing)
  }
  const cityMonthly = Array.from(cityMap.values()).sort((a, b) => b.total - a.total)

  // Daily counts (last 30 days) — cancelled hariç
  const dailyMap = new Map<string, number>()
  for (const r of dailyReservations) {
    if (r.type === 'cancelled') continue
    const date = r.pickupDateISO || r.flightDateISO
    if (date) dailyMap.set(date, (dailyMap.get(date) || 0) + 1)
  }
  const dailyCounts: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = toDateStr(d)
    dailyCounts.push({ date: dateStr, count: dailyMap.get(dateStr) || 0 })
  }

  // Calendar counts (current month — day by day)
  const calendarMap = new Map<string, { total: number; cancelled: number }>()
  for (const r of monthReservations) {
    const date = r.pickupDateISO || r.flightDateISO
    if (!date) continue
    const existing = calendarMap.get(date) || { total: 0, cancelled: 0 }
    existing.total++
    if (r.type === 'cancelled') existing.cancelled++
    calendarMap.set(date, existing)
  }
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const calendarCounts: { date: string; total: number; cancelled: number }[] = []
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), i)
    const dateStr = toDateStr(d)
    const entry = calendarMap.get(dateStr) || { total: 0, cancelled: 0 }
    calendarCounts.push({ date: dateStr, ...entry })
  }

  // City breakdown (all time — use month data for performance)
  const cityAllMap = new Map<string, number>()
  for (const r of monthReservations) {
    cityAllMap.set(r.city, (cityAllMap.get(r.city) || 0) + 1)
  }
  const cityBreakdown = Array.from(cityAllMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)

  // Type breakdown
  const typeMap = new Map<string, number>()
  for (const r of monthReservations) {
    typeMap.set(r.type, (typeMap.get(r.type) || 0) + 1)
  }
  const typeBreakdown = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  const result: StatsData = {
    totalAll,
    todayCount,
    tomorrowCount,
    weekCount,
    monthCount: monthReservations.length,
    monthCancelled,
    monthNew,
    monthUpdated,
    todayRevenue,
    monthRevenue,
    todayCityRevenue: cityRevenue(todayReservations),
    monthCityRevenue: cityRevenue(monthReservations),
    cityBreakdown,
    cityMonthly,
    dailyCounts,
    calendarCounts,
    typeBreakdown,
    monthName: monthNames[today.getMonth()],
    prevMonthCount,
    prevMonthRevenue,
    prevMonthName: monthNames[prevMonthStart.getMonth()],
  }

  statsCache = { data: result, time: Date.now() }
  return result
  --- */
}

export async function filterByCityMonth(_city: string): Promise<Reservation[]> {
  // SALESFORCE SORGULARI DEVRE DIŞI — aşırı sorgu limiti aşıldı
  return []
}

export async function getSyncMeta() {
  return { lastSync: new Date().toISOString(), totalEmails: 0, lastUid: 0 }
}
