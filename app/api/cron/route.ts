import { NextRequest, NextResponse } from 'next/server'
import { syncFromSalesforce } from '@/lib/salesforce'

export const dynamic = 'force-dynamic'

/**
 * Vercel Cron ile günde 3 kez çağrılır (09:00, 15:00, 21:00 Türkiye saati)
 * SF'den veri çekip Turso DB'ye yazar
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  try {
    console.log('[CRON] SF sync başlatılıyor...')
    const result = await syncFromSalesforce()
    console.log(`[CRON] SF sync tamamlandı: ${result.synced} işlendi, toplam: ${result.total}`)

    return NextResponse.json({
      ok: true,
      synced: result.synced,
      total: result.total,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[CRON] SF sync hatası:', err)
    return NextResponse.json({ error: 'Sync başarısız' }, { status: 500 })
  }
}
