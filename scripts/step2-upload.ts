/**
 * Adım 2: Lokal JSON'dan Turso'ya yükle.
 * Kullanım: npx tsx scripts/step2-upload.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import * as fs from 'fs'
import { createClient } from '@libsql/client'

const INPUT_FILE = 'scripts/emails.json'

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`${INPUT_FILE} bulunamadı! Önce step1-download.ts çalıştırın.`)
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8')) as Record<string, unknown>[]
  console.log(`${raw.length} kayıt okundu.`)

  // booking_id bazlı deduplicate — son gelen mail (en yüksek _uid) kazanır
  // Ama cancelled her zaman kazanır
  const byBooking = new Map<string, Record<string, unknown>>()
  for (const r of raw) {
    const bid = r.bookingId as string
    const existing = byBooking.get(bid)
    if (!existing) {
      byBooking.set(bid, r)
    } else if (r.type === 'cancelled') {
      // İptal her zaman son durumdur
      byBooking.set(bid, { ...existing, type: 'cancelled', subject: r.subject, emailDate: r.emailDate })
    } else if (existing.type !== 'cancelled' && (r._uid as number) > (existing._uid as number)) {
      byBooking.set(bid, r)
    }
  }

  const deduplicated = Array.from(byBooking.values())
  console.log(`${deduplicated.length} unique booking (${raw.length - deduplicated.length} duplicate atıldı)`)

  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  // Tabloları temizle
  await db.execute('DELETE FROM reservations')
  await db.execute('DELETE FROM sync_meta')
  console.log('Tablolar temizlendi.')

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

  // 3'erli batch'ler — Turso NOMEM hatası önlemi
  const BATCH_SIZE = 3
  let written = 0

  for (let i = 0; i < deduplicated.length; i += BATCH_SIZE) {
    const batch = deduplicated.slice(i, i + BATCH_SIZE)

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await db.batch(batch.map(r => {
          const transferDate = (r.flightDateISO || r.pickupDateISO || null) as string | null
          return {
            sql: upsertSql,
            args: [
              r.bookingId as string, r.type as string, (r.category || '-') as string,
              (r.passengers || 1) as number,
              (r.pickupLocation || '') as string, (r.dropoffLocation || '') as string,
              (r.flightNumber || null) as string | null, (r.flightDate || null) as string | null,
              (r.flightDateISO || null) as string | null, (r.pickupDate || null) as string | null,
              (r.pickupDateISO || null) as string | null, (r.pickupTime || null) as string | null,
              (r.originAirport || null) as string | null, (r.distance || null) as string | null,
              (r.city || 'Diğer') as string, (r.emailDate || '') as string,
              (r.subject || '') as string, (r.notes || null) as string | null,
              (r.passengerName || null) as string | null, (r.passengerPhone || null) as string | null,
              (r.driverSign || null) as string | null, (r.journeyCharge || null) as string | null,
              transferDate,
            ],
          }
        }))
        written += batch.length
        break
      } catch (err) {
        console.error(`Batch hatası (deneme ${attempt}/5):`, (err as Error).message)
        if (attempt === 5) {
          console.error(`${i}-${i + BATCH_SIZE} atlanıyor.`)
        } else {
          await new Promise(r => setTimeout(r, 2000 * attempt))
        }
      }
    }

    if (written % 500 === 0 || i + BATCH_SIZE >= deduplicated.length) {
      console.log(`${written}/${deduplicated.length} yazıldı`)
    }
  }

  // Max UID'yi bul
  const maxUid = Math.max(...raw.map(r => (r._uid as number) || 0))

  // sync_meta güncelle
  await db.execute({
    sql: `INSERT INTO sync_meta (id, last_sync, total_emails, last_uid)
          VALUES (1, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET last_sync = ?, total_emails = ?, last_uid = ?`,
    args: [new Date().toISOString(), written, maxUid, new Date().toISOString(), written, maxUid],
  })

  const countResult = await db.execute('SELECT COUNT(*) as cnt FROM reservations')
  console.log(`\nTamamlandı! Turso'da toplam: ${(countResult.rows[0] as unknown as Record<string, number>).cnt} kayıt`)
}

main().catch(err => { console.error(err); process.exit(1) })
