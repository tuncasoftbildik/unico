import { ImapFlow } from 'imapflow'
import { simpleParser, ParsedMail } from 'mailparser'
import type { Reservation } from './types'

function getClient() {
  return new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.IMAP_USER || '',
      pass: process.env.IMAP_PASS || '',
    },
    logger: false,
  })
}

// =============================================
// Tarih parse yardımcıları
// =============================================

const monthMap: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
}

/** "Friday, 20 March 2026" → "2026-03-20" */
function parseDateStr(dateStr: string): string | undefined {
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (!match) return undefined
  const day = match[1].padStart(2, '0')
  const month = monthMap[match[2]]
  const year = match[3]
  if (!month) return undefined
  return `${year}-${month}-${day}`
}

// =============================================
// Şehir çıkarma
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
  return 'Diğer'
}

// =============================================
// Mail tipini belirle
// =============================================

function getMailType(subject: string): 'new' | 'cancelled' | 'updated' | null {
  if (subject.includes('NEW confirmation')) return 'new'
  if (subject.includes('cancellation')) return 'cancelled'
  if (subject.includes('updated')) return 'updated'
  return null
}

function extractBookingId(subject: string): string {
  const match = subject.match(/#(\d+)/)
  return match ? match[1] : ''
}

// =============================================
// Mail body parse
// =============================================

function parseMailText(text: string): Partial<Reservation> {
  const result: Partial<Reservation> = {}
  const lines = text.split('\n').map(l => l.trim())

  for (const line of lines) {
    if (line.startsWith('Booking ID:'))
      result.bookingId = line.replace('Booking ID:', '').trim()
    else if (line.startsWith('Category:'))
      result.category = line.replace('Category:', '').trim()
    else if (line.startsWith('Number of Passengers:'))
      result.passengers = parseInt(line.replace('Number of Passengers:', '').trim()) || 1
    else if (line.startsWith('Pick-up location:'))
      result.pickupLocation = line.replace('Pick-up location:', '').trim()
    else if (line.startsWith('Drop-off location:'))
      result.dropoffLocation = line.replace('Drop-off location:', '').trim()
    else if (line.startsWith('Flight number:'))
      result.flightNumber = line.replace('Flight number:', '').trim()
    else if (line.startsWith('Flight arrival date:')) {
      result.flightDate = line.replace('Flight arrival date:', '').trim()
      result.flightDateISO = parseDateStr(result.flightDate)
    }
    else if (line.startsWith('Pick-up date:')) {
      result.pickupDate = line.replace('Pick-up date:', '').trim()
      result.pickupDateISO = parseDateStr(result.pickupDate)
    }
    else if (line.startsWith('Pick-up time:'))
      result.pickupTime = line.replace('Pick-up time:', '').trim()
    else if (line.startsWith('Origin Airport'))
      result.originAirport = line.replace('Origin Airport', '').trim()
    else if (line.startsWith('Distance:'))
      result.distance = line.replace('Distance:', '').trim()
    else if (line.match(/^Comments\s*:/))
      result.notes = line.replace(/Comments\s*:\s*/, '').trim()
  }

  return result
}

// =============================================
// Ana fonksiyon: Mailleri çek ve parse et
// =============================================

export async function fetchReservations(options?: {
  date?: string    // YYYY-MM-DD
}): Promise<Reservation[]> {
  const client = getClient()
  const reservations: Reservation[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    try {
      const mailbox = client.mailbox
      if (!mailbox || mailbox.exists === 0) return []

      // IMAP SEARCH ile sadece Booking.com maillerini bul
      // Tarih verildiyse, o tarih civarındaki mailleri ara
      const searchCriteria: Record<string, unknown> = {
        from: 'booking.com',
      }

      // Tarihe göre arama sınırla — verilen tarihten 7 gün önce gelen mailler
      if (options?.date) {
        const targetDate = new Date(options.date)
        const searchSince = new Date(targetDate)
        searchSince.setDate(searchSince.getDate() - 14) // 14 gün öncesinden beri
        searchCriteria.since = searchSince
      }

      const searchResult = await client.search(searchCriteria, { uid: true })
      const uids = Array.isArray(searchResult) ? searchResult : []

      if (uids.length === 0) return []

      // Son 300 uid ile sınırla (performans)
      const limitedUids = uids.slice(-300)
      const uidRange = limitedUids.join(',')

      for await (const msg of client.fetch(uidRange, { envelope: true, source: true }, { uid: true })) {
        const subject = msg.envelope?.subject || ''
        const mailType = getMailType(subject)
        if (!mailType) continue

        const bookingId = extractBookingId(subject)
        if (!bookingId) continue

        if (!msg.source) continue
        const parsed = await simpleParser(msg.source) as ParsedMail
        const text = parsed.text || ''
        const fields = parseMailText(text)

        const pickup = fields.pickupLocation || ''
        const dropoff = fields.dropoffLocation || ''
        const city = extractCity(pickup, dropoff)

        const transferDateISO = fields.flightDateISO || fields.pickupDateISO

        // Tarih filtresi
        if (options?.date && transferDateISO !== options.date) continue

        reservations.push({
          id: `${bookingId}-${mailType}`,
          bookingId: fields.bookingId || bookingId,
          type: mailType,
          category: fields.category || '-',
          passengers: fields.passengers || 1,
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          flightNumber: fields.flightNumber,
          flightDate: fields.flightDate,
          flightDateISO: fields.flightDateISO,
          pickupDate: fields.pickupDate,
          pickupDateISO: fields.pickupDateISO,
          pickupTime: fields.pickupTime,
          originAirport: fields.originAirport,
          distance: fields.distance,
          city,
          emailDate: msg.envelope?.date?.toISOString() || '',
          subject,
          notes: fields.notes,
        })
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    console.error('[IMAP] Hata:', err)
    throw err
  }

  // En yeni mailler üstte
  reservations.reverse()

  // Aynı bookingId için en son durumu tut
  if (options?.date) {
    const latest = new Map<string, Reservation>()
    for (const r of reservations) {
      const existing = latest.get(r.bookingId)
      if (!existing) {
        latest.set(r.bookingId, r)
      } else if (r.type === 'cancelled') {
        latest.set(r.bookingId, r)
      }
    }
    return Array.from(latest.values())
  }

  return reservations
}
