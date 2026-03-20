/**
 * Adım 1: Tüm Booking.com maillerini IMAP'tan indirip lokal JSON'a yaz.
 * Kullanım: npx tsx scripts/step1-download.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { ImapFlow } from 'imapflow'
import { simpleParser, ParsedMail } from 'mailparser'
import * as fs from 'fs'

const OUTPUT_FILE = 'scripts/emails.json'

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

function parseMailText(text: string) {
  const result: Record<string, string | number | undefined> = {}
  const lines = text.split('\n').map(l => l.trim())
  for (const line of lines) {
    if (line.startsWith('Booking ID:')) result.bookingId = line.replace('Booking ID:', '').trim()
    else if (line.startsWith('Category:')) result.category = line.replace('Category:', '').trim()
    else if (line.startsWith('Number of Passengers:')) result.passengers = parseInt(line.replace('Number of Passengers:', '').trim()) || 1
    else if (line.startsWith('Pick-up location:')) result.pickupLocation = line.replace('Pick-up location:', '').trim()
    else if (line.startsWith('Drop-off location:')) result.dropoffLocation = line.replace('Drop-off location:', '').trim()
    else if (line.startsWith('Flight number:')) result.flightNumber = line.replace('Flight number:', '').trim()
    else if (line.startsWith('Flight arrival date:')) {
      result.flightDate = line.replace('Flight arrival date:', '').trim()
      result.flightDateISO = parseDateStr(result.flightDate as string)
    }
    else if (line.startsWith('Pick-up date:')) {
      result.pickupDate = line.replace('Pick-up date:', '').trim()
      result.pickupDateISO = parseDateStr(result.pickupDate as string)
    }
    else if (line.startsWith('Pick-up time:')) result.pickupTime = line.replace('Pick-up time:', '').trim()
    else if (line.startsWith('Origin Airport')) result.originAirport = line.replace('Origin Airport', '').trim()
    else if (line.startsWith('Distance:')) result.distance = line.replace('Distance:', '').trim()
    else if (line.match(/^Comments\s*:/)) result.notes = line.replace(/Comments\s*:\s*/, '').trim()
  }
  return result
}

function parseMailHtml(html: string) {
  const result: Record<string, string> = {}
  const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
  const nameMatch = html.match(/Name:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)
  if (nameMatch) result.passengerName = clean(nameMatch[1])
  const phoneMatch = html.match(/Mobile number:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)
  if (phoneMatch) result.passengerPhone = clean(phoneMatch[1])
  const signMatch = html.match(/Driver's sign will read:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)
  if (signMatch) result.driverSign = clean(signMatch[1])
  const chargeMatch = html.match(/Journey charge:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/)
  if (chargeMatch) result.journeyCharge = clean(chargeMatch[1])
  return result
}

function getClient() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: { user: process.env.IMAP_USER || '', pass: process.env.IMAP_PASS || '' },
    logger: false,
    socketTimeout: 5 * 60 * 1000,
  })
  client.on('error', (err: Error) => console.error('[IMAP] Error:', err.message))
  return client
}

async function main() {
  // Daha önce indirilmiş veri varsa devam et
  let existing: Record<string, unknown>[] = []
  let processedUids = new Set<number>()
  if (fs.existsSync(OUTPUT_FILE)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
    processedUids = new Set(existing.map((e: Record<string, unknown>) => e._uid as number).filter(Boolean))
    console.log(`${existing.length} kayıt zaten indirilmiş, kaldığı yerden devam ediliyor...`)
  }

  // UID listesini al
  const searchClient = getClient()
  let uids: number[] = []

  await searchClient.connect()
  const searchLock = await searchClient.getMailboxLock('INBOX')
  try {
    const searchResult = await searchClient.search({ from: 'booking.com' }, { uid: true })
    uids = Array.isArray(searchResult) ? searchResult : []
  } finally {
    searchLock.release()
  }
  await searchClient.logout()

  // Zaten indirilmişleri atla
  const remainingUids = uids.filter(u => !processedUids.has(u))
  console.log(`Toplam: ${uids.length} mail, Kalan: ${remainingUids.length}`)

  if (remainingUids.length === 0) {
    console.log('Tüm mailler zaten indirilmiş!')
    process.exit(0)
  }

  const CHUNK_SIZE = 200
  const totalChunks = Math.ceil(remainingUids.length / CHUNK_SIZE)
  const allData = [...existing]
  let downloaded = 0

  for (let c = 0; c < remainingUids.length; c += CHUNK_SIZE) {
    const chunk = remainingUids.slice(c, c + CHUNK_SIZE)
    const chunkNum = Math.floor(c / CHUNK_SIZE) + 1
    console.log(`Chunk ${chunkNum}/${totalChunks} (${chunk.length} mail)...`)

    const client = getClient()
    try {
      await client.connect()
      const lock = await client.getMailboxLock('INBOX')
      try {
        const uidRange = chunk.join(',')
        for await (const msg of client.fetch(uidRange, { envelope: true, source: true, uid: true }, { uid: true })) {
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

          const pickup = (fields.pickupLocation || '') as string
          const dropoff = (fields.dropoffLocation || '') as string

          allData.push({
            _uid: msg.uid,
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
            city: extractCity(pickup, dropoff),
            emailDate: msg.envelope?.date?.toISOString() || '',
            subject,
            notes: fields.notes,
            passengerName: htmlFields.passengerName,
            passengerPhone: htmlFields.passengerPhone,
            driverSign: htmlFields.driverSign,
            journeyCharge: htmlFields.journeyCharge,
          })
          downloaded++
        }
      } finally {
        lock.release()
      }
      await client.logout()
    } catch (err) {
      console.error(`Chunk ${chunkNum} hatası:`, (err as Error).message)
      try { await client.logout() } catch { /* */ }
    }

    // Her chunk sonrası dosyaya kaydet (crash koruması)
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 0))
    console.log(`  → ${downloaded} yeni indirildi, toplam ${allData.length} kayıt`)
  }

  console.log(`\nTamamlandı! ${allData.length} kayıt ${OUTPUT_FILE} dosyasına yazıldı.`)
}

main().catch(err => { console.error(err); process.exit(1) })
