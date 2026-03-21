/**
 * Force sync script — API'den tüm booking'leri çekip Turso'ya yazar.
 * Kullanım: npx tsx scripts/force-sync.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { syncFromApi } from '../lib/booking-api'

async function main() {
  console.log('API sync başlıyor...')
  console.time('sync')
  const result = await syncFromApi()
  console.timeEnd('sync')
  console.log(`Sonuç: ${result.synced} işlendi, ${result.total} toplam`)
  process.exit(0)
}

main().catch(err => {
  console.error('Hata:', err)
  process.exit(1)
})
