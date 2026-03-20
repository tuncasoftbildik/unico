'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error || 'Giriş başarısız.')
      return
    }

    onSuccess()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 animate-fadeIn" style={{ background: '#BE1E2D' }}>
      <div className="w-full max-w-sm animate-scaleIn">
        <div className="text-center mb-8 animate-slideInLeft">
          <Image
            src="/logo.png"
            alt="UNICO Travel"
            width={180}
            height={80}
            className="mx-auto mb-2"
            priority
          />
        </div>

        <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur rounded-2xl shadow-xl p-6 space-y-4 animate-slideInRight">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Panel Şifresi</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                placeholder="Şifrenizi girin"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': '#BE1E2D' } as React.CSSProperties}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full text-white py-2.5 rounded-xl text-sm font-semibold transition-fast disabled:opacity-50 hover:opacity-90 transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: '#BE1E2D' }}
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
