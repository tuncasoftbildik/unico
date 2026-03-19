'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Calendar, MapPin, ChevronLeft, ChevronRight, LogOut, Sun, Sunrise } from 'lucide-react'
import type { Reservation } from '@/lib/types'
import { ReservationDetail } from './reservation-detail'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function todayStr(): string {
  return toDateStr(new Date())
}

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateStr(d)
}

const statusConfig = {
  confirmed: { label: 'Onaylı', dot: 'bg-emerald-500' },
  pending: { label: 'Beklemede', dot: 'bg-amber-500' },
  cancelled: { label: 'İptal', dot: 'bg-red-500' },
}

// Mini takvim bileşeni
function MiniCalendar({ selectedDate, onSelect, onClose }: {
  selectedDate: string
  onSelect: (date: string) => void
  onClose: () => void
}) {
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate || todayStr()))

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = firstDay === 0 ? 6 : firstDay - 1 // Pazartesi başlangıç

  const days: (number | null)[] = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        {/* Ay navigasyonu */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-900">{monthNames[month]} {year}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>

        {/* Gün başlıkları */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Günler */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === todayStr()

            return (
              <button
                key={dateStr}
                onClick={() => { onSelect(dateStr); onClose() }}
                className={`text-sm py-1.5 rounded-lg transition ${
                  isSelected
                    ? 'bg-amber-500 text-white font-semibold'
                    : isToday
                      ? 'bg-amber-50 text-amber-700 font-medium'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [cities, setCities] = useState<Record<string, Reservation[]>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)

  const fetchReservations = useCallback(async (date: string) => {
    setLoading(true)
    const res = await fetch(`/api/reservations?date=${date}`)
    if (!res.ok) {
      if (res.status === 401) {
        toast.error('Oturum süresi doldu.')
        onLogout()
        return
      }
      toast.error('Veriler yüklenemedi.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setCities(data.cities)
    setTotal(data.total)
    setLoading(false)
  }, [onLogout])

  useEffect(() => {
    fetchReservations(selectedDate)
  }, [selectedDate, fetchReservations])

  const isToday = selectedDate === todayStr()
  const isTomorrow = selectedDate === tomorrowStr()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    onLogout()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-sm font-black text-white">U</span>
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">UNICO</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
            <LogOut size={16} />
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Tarih Seçici */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDate(todayStr())}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
              isToday ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-slate-700 border hover:bg-slate-50'
            }`}
          >
            <Sun size={15} />
            Bugün
          </button>
          <button
            onClick={() => setSelectedDate(tomorrowStr())}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
              isTomorrow ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-slate-700 border hover:bg-slate-50'
            }`}
          >
            <Sunrise size={15} />
            Yarın
          </button>
          <button
            onClick={() => setShowCalendar(true)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${
              !isToday && !isTomorrow ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-slate-700 border hover:bg-slate-50'
            }`}
          >
            <Calendar size={15} />
            Takvim
          </button>
        </div>

        {/* Seçili Tarih Bilgisi */}
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Seçili Tarih</p>
              <p className="text-lg font-semibold text-slate-900 mt-0.5">{formatDate(selectedDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Toplam Rezervasyon</p>
              <p className="text-3xl font-bold text-amber-500 mt-0.5">{loading ? '—' : total}</p>
            </div>
          </div>
        </div>

        {/* Şehir Bazlı Rezervasyonlar */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl border p-5 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-32 mb-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-full" />
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center">
            <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Bu tarihte rezervasyon bulunmuyor.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(cities).map(([city, reservations]) => (
              <div key={city} className="bg-white rounded-2xl border overflow-hidden">
                {/* Şehir başlığı */}
                <div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-amber-500" />
                    <span className="font-semibold text-slate-900">{city}</span>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {reservations.length} rezervasyon
                  </span>
                </div>

                {/* Rezervasyon listesi */}
                <div className="divide-y">
                  {reservations.map(r => {
                    const st = statusConfig[r.status]
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedReservation(r)}
                        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                          <div className="min-w-0">
                            <span className="text-sm font-mono font-semibold text-amber-600 block">
                              {r.reservationNo}
                            </span>
                            <span className="text-xs text-slate-500 block truncate">
                              {r.customerName} · {r.hotel}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className="text-sm font-semibold text-slate-900 block">
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: r.currency, minimumFractionDigits: 0 }).format(r.totalPrice)}
                          </span>
                          <span className={`text-xs ${st.dot === 'bg-emerald-500' ? 'text-emerald-600' : st.dot === 'bg-amber-500' ? 'text-amber-600' : 'text-red-500'}`}>
                            {st.label}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Takvim Modal */}
      {showCalendar && (
        <MiniCalendar
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Rezervasyon Detay Modal */}
      {selectedReservation && (
        <ReservationDetail
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </div>
  )
}
