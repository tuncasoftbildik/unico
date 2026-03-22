/**
 * Turso (libSQL) veritabanı bağlantısı ve şema yönetimi
 */

import { createClient } from '@libsql/client'

let client: ReturnType<typeof createClient> | null = null

export function getDb() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return client
}

/**
 * Tabloları kontrol et — tablolar zaten varsa yazma işlemi yapma
 */
export async function initDb() {
  const db = getDb()

  // Sadece okuma ile tablo varlığını kontrol et
  try {
    await db.execute("SELECT 1 FROM reservations LIMIT 1")
    return // Tablolar zaten var, yazma gerekmez
  } catch {
    // Tablo yoksa oluştur
  }

  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS reservations (
        booking_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '-',
        passengers INTEGER NOT NULL DEFAULT 1,
        pickup_location TEXT NOT NULL DEFAULT '',
        dropoff_location TEXT NOT NULL DEFAULT '',
        flight_number TEXT,
        flight_date TEXT,
        flight_date_iso TEXT,
        pickup_date TEXT,
        pickup_date_iso TEXT,
        pickup_time TEXT,
        origin_airport TEXT,
        distance TEXT,
        city TEXT NOT NULL DEFAULT 'Diğer',
        email_date TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        notes TEXT,
        passenger_name TEXT,
        passenger_phone TEXT,
        driver_sign TEXT,
        journey_charge TEXT,
        transfer_date TEXT
      )`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_reservations_transfer_date ON reservations(transfer_date)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_reservations_city ON reservations(city)`,
      args: [],
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_reservations_type ON reservations(type)`,
      args: [],
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS sync_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_sync TEXT,
        total_emails INTEGER NOT NULL DEFAULT 0,
        last_uid INTEGER NOT NULL DEFAULT 0
      )`,
      args: [],
    },
  ])
}
