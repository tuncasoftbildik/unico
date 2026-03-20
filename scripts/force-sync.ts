/**
 * Force sync script — tüm mailleri baştan okuyup Turso'ya yazar.
 * ON CONFLICT ile duplicate'ler güvenli şekilde güncellenir.
 * Kullanım: npx tsx scripts/force-sync.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { syncFromImap } from '../lib/imap'

async function main() {
  console.log('Force sync başlıyor...')
  console.time('sync')
  const result = await syncFromImap(true)
  console.timeEnd('sync')
  console.log(`Sonuç: ${result.synced} yeni, ${result.total} toplam`)
  process.exit(0)
}

main().catch(err => {
  console.error('Hata:', err)
  process.exit(1)
})
