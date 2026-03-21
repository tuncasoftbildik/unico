import { NextRequest, NextResponse } from 'next/server'
import { syncFromApi } from '@/lib/booking-api'
import { getDb, initDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const reset = searchParams.get('reset') === 'true'

  try {
    // DB'yi sıfırla ve sadece API'den çek
    if (reset) {
      await initDb()
      const db = getDb()
      await db.execute('DELETE FROM reservations')
      await db.execute('DELETE FROM sync_meta')
      console.log('[Sync] DB sıfırlandı')
    }

    const result = await syncFromApi()
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      total: result.total,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Sync API] Hata:', err)
    return NextResponse.json({ error: 'API senkronizasyonu başarısız.' }, { status: 500 })
  }
}
