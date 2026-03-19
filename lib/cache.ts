/**
 * JSON dosya tabanlı cache sistemi
 * Mailler bir kere okunur, data/reservations.json'a yazılır.
 * Sonraki isteklerde dosyadan okunur.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { Reservation } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const CACHE_FILE = path.join(DATA_DIR, 'reservations.json')
const META_FILE = path.join(DATA_DIR, 'sync-meta.json')

interface SyncMeta {
  lastSync: string       // ISO date
  totalEmails: number
  lastUid: number        // Son okunan mail UID'si
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

// =============================================
// Cache'den oku
// =============================================

export async function getCachedReservations(): Promise<Reservation[]> {
  try {
    const raw = await readFile(CACHE_FILE, 'utf-8')
    return JSON.parse(raw) as Reservation[]
  } catch {
    return []
  }
}

export async function getSyncMeta(): Promise<SyncMeta | null> {
  try {
    const raw = await readFile(META_FILE, 'utf-8')
    return JSON.parse(raw) as SyncMeta
  } catch {
    return null
  }
}

// =============================================
// Cache'e yaz
// =============================================

export async function saveCachedReservations(reservations: Reservation[]): Promise<void> {
  await ensureDataDir()
  await writeFile(CACHE_FILE, JSON.stringify(reservations, null, 2), 'utf-8')
}

export async function saveSyncMeta(meta: SyncMeta): Promise<void> {
  await ensureDataDir()
  await writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf-8')
}

// =============================================
// Cache'e merge et (yeni mailler ekle, iptalleri güncelle)
// =============================================

export async function mergeReservations(newItems: Reservation[]): Promise<Reservation[]> {
  const existing = await getCachedReservations()

  // bookingId bazlı map
  const map = new Map<string, Reservation>()

  // Önce mevcut verileri yükle
  for (const r of existing) {
    map.set(r.id, r)
  }

  // Yeni verileri ekle/güncelle
  for (const r of newItems) {
    const existingByBooking = Array.from(map.values()).find(
      e => e.bookingId === r.bookingId && e.type === 'new' && r.type === 'cancelled'
    )

    if (existingByBooking && r.type === 'cancelled') {
      // Yeni rezervasyonu iptal olarak güncelle
      map.delete(existingByBooking.id)
    }

    map.set(r.id, r)
  }

  const merged = Array.from(map.values())
  await saveCachedReservations(merged)
  return merged
}

// =============================================
// Tarih filtresi
// =============================================

export function filterByDate(reservations: Reservation[], date: string): Reservation[] {
  const filtered = reservations.filter(r => {
    const transferDate = r.flightDateISO || r.pickupDateISO
    return transferDate === date
  })

  // Aynı bookingId için son durumu tut
  const latest = new Map<string, Reservation>()
  for (const r of filtered) {
    const existing = latest.get(r.bookingId)
    if (!existing) {
      latest.set(r.bookingId, r)
    } else if (r.type === 'cancelled') {
      latest.set(r.bookingId, r)
    }
  }

  return Array.from(latest.values())
}
