/**
 * IMAP Mail Okuyucu — Booking.com transfer mailleri
 * Sadece sync işlemi için kullanılır, sonuçlar cache'e yazılır.
 */

import { ImapFlow } from 'imapflow'
import { simpleParser, ParsedMail } from 'mailparser'
import type { Reservation } from './types'
import { mergeReservations, saveSyncMeta, getSyncMeta } from './cache'
import { getDb } from './db'

function getClient() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.IMAP_USER || '',
      pass: process.env.IMAP_PASS || '',
    },
    logger: false,
    socketTimeout: 5 * 60 * 1000,
  })
  // Unhandled error event'lerini yakala (process crash önlemi)
  client.on('error', (err: Error) => {
    console.error('[IMAP] Connection error:', err.message)
  })
  return client
}

const monthMap: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04',
  May: '05', June: '06', July: '07', August: '08',
  September: '09', October: '10', November: '11', December: '12',
}

function parseDateStr(dateStr: string): string | undefined {
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (!match) return undefined
  const day = match[1].padStart(2, '0')
  const month = monthMap[match[2]]
  const year = match[3]
  if (!month) return undefined
  return `${year}-${month}-${day}`
}

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
  return 'Diğer'
}

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

/**
 * HTML'den Passenger ve Payment bölümlerini parse et.
 * Booking.com mailleri bu bilgileri sadece HTML'de gönderiyor.
 */
function parseMailHtml(html: string): Partial<Reservation> {
  const result: Partial<Reservation> = {}

  // Helper: HTML tag'lerini temizle ve &nbsp; → boşluk
  const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

  // Name: <td>...</td> pattern — Passenger bölümündeki Name satırı
  const nameMatch = html.match(/Name:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)
  if (nameMatch) result.passengerName = clean(nameMatch[1])

  // Mobile number:
  const phoneMatch = html.match(/Mobile number:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)
  if (phoneMatch) result.passengerPhone = clean(phoneMatch[1])

  // Driver's sign will read:
  const signMatch = html.match(/Driver's sign will read:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)
  if (signMatch) result.driverSign = clean(signMatch[1])

  // Journey charge:
  const chargeMatch = html.match(/Journey charge:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)
  if (chargeMatch) result.journeyCharge = clean(chargeMatch[1])

  return result
}

/**
 * IMAP'tan mailleri sync et ve cache'e yaz.
 * lastUid'den sonraki yeni mailleri okur (incremental sync).
 * force=true ise tümünü baştan okur.
 */
export async function syncFromImap(force = false): Promise<{ synced: number; total: number }> {
  const meta = force ? null : await getSyncMeta()
  let maxUid = 0
  let syncedCount = 0

  // 1) UID listesini al (3 deneme)
  let uids: number[] = []

  for (let attempt = 1; attempt <= 3; attempt++) {
    const searchClient = getClient()
    try {
      await searchClient.connect()
      const lock = await searchClient.getMailboxLock('INBOX')
      try {
        const mailbox = searchClient.mailbox
        if (!mailbox || mailbox.exists === 0) return { synced: 0, total: 0 }

        const searchCriteria: Record<string, unknown> = { from: 'booking.com' }
        if (meta?.lastUid) {
          searchCriteria.uid = `${meta.lastUid + 1}:*`
        }
        const searchResult = await searchClient.search(searchCriteria, { uid: true })
        uids = Array.isArray(searchResult) ? searchResult : []
      } finally {
        lock.release()
      }
      await searchClient.logout()
      break
    } catch (err) {
      console.error(`[IMAP] Search hatası (deneme ${attempt}/3):`, (err as Error).message)
      try { await searchClient.logout() } catch { /* ignore */ }
      if (attempt === 3) throw err
      await new Promise(r => setTimeout(r, 3000 * attempt))
    }
  }

  if (uids.length === 0) {
    await saveSyncMeta({
      lastSync: new Date().toISOString(),
      totalEmails: meta?.totalEmails || 0,
      lastUid: meta?.lastUid || 0,
    })
    return { synced: 0, total: meta?.totalEmails || 0 }
  }

  console.log(`[Sync] ${uids.length} yeni mail okunacak...`)

  // 2) Her chunk için yeni bağlantı aç → oku → DB'ye yaz → kapat
  const CHUNK_SIZE = 200
  const totalChunks = Math.ceil(uids.length / CHUNK_SIZE)

  for (let c = 0; c < uids.length; c += CHUNK_SIZE) {
    const uidChunk = uids.slice(c, c + CHUNK_SIZE)
    const chunkNum = Math.floor(c / CHUNK_SIZE) + 1
    console.log(`[Sync] Chunk ${chunkNum}/${totalChunks} (${uidChunk.length} mail)...`)

    const chunkReservations: Reservation[] = []
    const chunkClient = getClient()

    try {
      await chunkClient.connect()
      const lock = await chunkClient.getMailboxLock('INBOX')
      try {
        const uidRange = uidChunk.join(',')
        for await (const msg of chunkClient.fetch(uidRange, { envelope: true, source: true, uid: true }, { uid: true })) {
          const subject = msg.envelope?.subject || ''
          const mailType = getMailType(subject)
          if (!mailType) continue

          const bookingId = extractBookingId(subject)
          if (!bookingId) continue

          if (!msg.source) continue
          const parsed = await simpleParser(msg.source) as ParsedMail
          const text = parsed.text || ''
          const html = (parsed.html || '') as string
          const fields = parseMailText(text)
          const htmlFields = parseMailHtml(html)

          const pickup = fields.pickupLocation || ''
          const dropoff = fields.dropoffLocation || ''
          const city = extractCity(pickup, dropoff)

          if (msg.uid > maxUid) maxUid = msg.uid

          chunkReservations.push({
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
            passengerName: htmlFields.passengerName,
            passengerPhone: htmlFields.passengerPhone,
            driverSign: htmlFields.driverSign,
            journeyCharge: htmlFields.journeyCharge,
          })
        }
      } finally {
        lock.release()
      }
      await chunkClient.logout()
    } catch (err) {
      console.error(`[IMAP] Chunk ${chunkNum} hatası:`, (err as Error).message)
      // Hata olsa bile okunan verileri kaydet, devam et
      try { await chunkClient.logout() } catch { /* ignore */ }
    }

    // Chunk'ı DB'ye yaz (3 deneme, retry ile)
    if (chunkReservations.length > 0) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await mergeReservations(chunkReservations)
          syncedCount += chunkReservations.length
          console.log(`[Sync] ${syncedCount} toplam yazıldı`)
          break
        } catch (dbErr) {
          console.error(`[Sync] DB yazma hatası (deneme ${attempt}/3):`, (dbErr as Error).message)
          if (attempt === 3) {
            console.error(`[Sync] Chunk ${chunkNum} atlanıyor.`)
          } else {
            await new Promise(r => setTimeout(r, 2000 * attempt))
          }
        }
      }
    }
  }

  const countResult = await getDb().execute('SELECT COUNT(*) as cnt FROM reservations')
  const totalCount = Number((countResult.rows[0] as unknown as Record<string, number>).cnt)

  await saveSyncMeta({
    lastSync: new Date().toISOString(),
    totalEmails: totalCount,
    lastUid: maxUid > 0 ? maxUid : (meta?.lastUid || 0),
  })

  console.log(`[Sync] Tamamlandı! ${syncedCount} rezervasyon eklendi. Toplam: ${totalCount}`)

  return { synced: syncedCount, total: totalCount }
}
