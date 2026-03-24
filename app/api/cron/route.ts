import { NextRequest, NextResponse } from 'next/server'
import { syncFromApi } from '@/lib/booking-api'

export const dynamic = 'force-dynamic'

/**
 * Vercel Cron ile günde 3 kez çağrılır (09:00, 15:00, 21:00 Türkiye saati)
 * CRON_SECRET ile korunur — sadece Vercel cron tetikleyebilir
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  try {
    console.log('[CRON] Sync başlatılıyor...')
    const result = await syncFromApi()
    console.log(`[CRON] Sync tamamlandı: ${result.synced} işlendi, toplam: ${result.total}`)

    return NextResponse.json({
      ok: true,
      synced: result.synced,
      total: result.total,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[CRON] Sync hatası:', err)
    return NextResponse.json({ error: 'Sync başarısız' }, { status: 500 })
  }
}
