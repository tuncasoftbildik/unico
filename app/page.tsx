'use client'

import { useState, useEffect } from 'react'
import { LoginScreen } from '@/components/login-screen'
import { Dashboard } from '@/components/dashboard'

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)

  // Sayfa yüklendiğinde cookie kontrolü
  useEffect(() => {
    fetch('/api/reservations?date=check')
      .then(res => {
        if (res.ok) setAuthenticated(true)
      })
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-lg animate-pulse" style={{ background: '#BE1E2D' }} />
      </div>
    )
  }

  if (!authenticated) {
    return <LoginScreen onSuccess={() => setAuthenticated(true)} />
  }

  return <Dashboard onLogout={() => setAuthenticated(false)} />
}
