import { NextRequest, NextResponse } from 'next/server'

const APP_PASSWORD = process.env.APP_PASSWORD || 'unico2026'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!password) {
    return NextResponse.json({ error: 'Şifre gereklidir.' }, { status: 400 })
  }

  if (password !== APP_PASSWORD) {
    return NextResponse.json({ error: 'Şifre hatalı.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })

  // HttpOnly cookie ile oturum
  response.cookies.set('unico_auth', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 saat
    path: '/',
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('unico_auth')
  return response
}
