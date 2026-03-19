import { NextRequest, NextResponse } from 'next/server'
import { syncFromImap } from '@/lib/imap'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Auth kontrolü
  const auth = request.cookies.get('unico_auth')
  if (auth?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  try {
    const result = await syncFromImap(force)
    return NextResponse.json({
      ok: true,
      synced: result.synced,
      total: result.total,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Sync API] Hata:', err)
    return NextResponse.json({ error: 'Mail senkronizasyonu başarısız.' }, { status: 500 })
  }
}
