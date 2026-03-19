'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Calendar, MapPin, ChevronLeft, ChevronRight, LogOut, Sun, Sunrise, Loader2 } from 'lucide-react'
import type { Reservation } from '@/lib/types'
import { ReservationDetail } from './reservation-detail'

function toDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayStr(): string {
  return toDateStr(new Date())
}

function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return toDateStr(d)
}

function formatDateTR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
}

const typeConfig = {
  new: { label: 'Yeni', dot: 'bg-emerald-500' },
  cancelled: { label: 'İptal', dot: 'bg-red-500' },
  updated: { label: 'Güncellendi', dot: 'bg-blue-500' },
}

// =============================================
// Mini Takvim
// =============================================
function MiniCalendar({ selectedDate, onSelect, onClose }: {
  selectedDate: string
  onSelect: (date: string) => void
  onClose: () => void
}) {
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = selectedDate.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = firstDay === 0 ? 6 : firstDay - 1

  const days: (number | null)[] = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-900">{monthNames[month]} {year}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
          ))}
        </div>

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

// =============================================
// Dashboard
// =============================================
export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [cities, setCities] = useState<Record<string, Reservation[]>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)

  const fetchReservations = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/reservations?date=${date}`)
      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Oturum süresi doldu.')
          onLogout()
          return
        }
        const data = await res.json()
        setError(data.error || 'Bir hata oluştu.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setCities(data.cities)
      setTotal(data.total)
    } catch {
      setError('Sunucuya bağlanılamadı.')
    }

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
              <p className="text-lg font-semibold text-slate-900 mt-0.5">{formatDateTR(selectedDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Toplam Transfer</p>
              {loading ? (
                <Loader2 size={28} className="animate-spin text-amber-500 mt-1 ml-auto" />
              ) : (
                <p className="text-3xl font-bold text-amber-500 mt-0.5">{total}</p>
              )}
            </div>
          </div>
        </div>

        {/* Hata */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <p className="text-red-600 font-medium text-sm">{error}</p>
            <button
              onClick={() => fetchReservations(selectedDate)}
              className="mt-2 text-sm text-red-500 underline hover:text-red-700"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* Şehir Bazlı Rezervasyonlar */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 size={32} className="animate-spin text-amber-500 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Mailler okunuyor...</p>
            </div>
          </div>
        ) : !error && total === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center">
            <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Bu tarihte transfer bulunmuyor.</p>
          </div>
        ) : !error && (
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
                    {reservations.length} transfer
                  </span>
                </div>

                {/* Rezervasyon listesi */}
                <div className="divide-y">
                  {reservations.map(r => {
                    const st = typeConfig[r.type]
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
                              #{r.bookingId}
                            </span>
                            <span className="text-xs text-slate-500 block truncate">
                              {r.category} · {r.passengers} yolcu
                              {r.flightNumber && ` · ${r.flightNumber}`}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <span className={`text-xs font-medium ${
                            r.type === 'new' ? 'text-emerald-600' :
                            r.type === 'cancelled' ? 'text-red-500' : 'text-blue-600'
                          }`}>
                            {st.label}
                          </span>
                          {r.pickupTime && (
                            <span className="text-xs text-slate-400 block">{r.pickupTime}</span>
                          )}
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
