'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Calendar, MapPin, ChevronLeft, ChevronRight, LogOut, Sun, Sunrise,
  Loader2, RefreshCw, Search, X, BarChart3, Bell, BellOff,
  TrendingUp, TrendingDown, ArrowRightLeft, Ban, CheckCircle2, AlertCircle,
  Euro
} from 'lucide-react'
import Image from 'next/image'
import type { Reservation } from '@/lib/types'
import type { StatsData } from '@/lib/cache'
import { ReservationDetail } from './reservation-detail'
import { OverviewSkeleton, TransfersSkeleton } from './skeletons'

const BRAND = '#BE1E2D'
const BRAND_LIGHT = '#fef2f2'
const AUTO_SYNC_INTERVAL = 2 * 60 * 1000

function toDateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayStr(): string { return toDateStr(new Date()) }

function tomorrowStr(): string {
  const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d)
}

function formatDateTR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${d}/${m}`
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
  selectedDate: string; onSelect: (date: string) => void; onClose: () => void
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-xs animate-scaleIn" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg transition-fast">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <span className="text-sm font-semibold text-slate-900">{monthNames[month]} {year}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-slate-100 rounded-lg transition-fast">
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
              <button key={dateStr} onClick={() => { onSelect(dateStr); onClose() }}
                className={`text-sm py-1.5 rounded-lg transition-fast transform hover:scale-105 ${isSelected ? 'text-white font-semibold' : isToday ? 'font-medium' : 'text-slate-700 hover:bg-slate-100'}`}
                style={isSelected ? { background: BRAND } : isToday ? { color: BRAND, background: BRAND_LIGHT } : undefined}
              >{day}</button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// =============================================
// Genel Bakış (İstatistik Sayfası)
// =============================================
function OverviewTab({ stats, loading }: { stats: StatsData | null; loading: boolean }) {
  const [revenueDetail, setRevenueDetail] = useState<'today' | 'month' | null>(null)

  if (loading || !stats) {
    return <OverviewSkeleton />
  }

  const maxDaily = Math.max(...stats.dailyCounts.map(d => d.count), 1)
  const maxCity = stats.cityMonthly[0]?.total || 1

  return (
    <div className="space-y-5">
      {/* Üst özet kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border p-4 transition-smooth hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BRAND_LIGHT }}>
              <Sun size={16} style={{ color: BRAND }} />
            </div>
            <span className="text-xs text-slate-500 font-medium">Bugün</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.todayCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">transfer</p>
        </div>

        <div className="bg-white rounded-2xl border p-4 transition-smooth hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50">
              <Sunrise size={16} className="text-blue-600" />
            </div>
            <span className="text-xs text-slate-500 font-medium">Yarın</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.tomorrowCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">transfer</p>
        </div>

        <div className="bg-white rounded-2xl border p-4 transition-smooth hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <span className="text-xs text-slate-500 font-medium">Bu Hafta</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.weekCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">transfer</p>
        </div>

        <div className="bg-white rounded-2xl border p-4 transition-smooth hover:shadow-md">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50">
              <Calendar size={16} className="text-violet-600" />
            </div>
            <span className="text-xs text-slate-500 font-medium">{stats.monthName}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.monthCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">transfer</p>
        </div>
      </div>

      {/* Bu ay detay kartları */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white rounded-2xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition-smooth hover:shadow-md">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.monthNew}</p>
            <p className="text-[10px] sm:text-xs text-slate-500">Yeni</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition-smooth hover:shadow-md">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Ban size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.monthCancelled}</p>
            <p className="text-[10px] sm:text-xs text-slate-500">İptal</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition-smooth hover:shadow-md">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.monthUpdated}</p>
            <p className="text-[10px] sm:text-xs text-slate-500">Güncellenen</p>
          </div>
        </div>
      </div>

      {/* Ciro kartları */}
      {(() => {
        const rev = stats.monthRevenue
        const commissionRate = rev <= 100_000 ? 7 : rev <= 200_000 ? 6 : rev <= 300_000 ? 5.5 : 5
        const commission = rev * commissionRate / 100
        return (
          <div className="grid grid-cols-3 gap-3">
            <div
              className="bg-white rounded-2xl border p-4 transition-smooth hover:shadow-md cursor-pointer"
              style={revenueDetail === 'today' ? { borderColor: '#d97706', borderWidth: 2 } : {}}
              onClick={() => setRevenueDetail(revenueDetail === 'today' ? null : 'today')}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50">
                  <Euro size={16} className="text-amber-600" />
                </div>
                <span className="text-xs text-slate-500 font-medium">Bugün Ciro</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.todayRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">EUR</p>
            </div>

            <div
              className="bg-white rounded-2xl border p-4 transition-smooth hover:shadow-md cursor-pointer"
              style={revenueDetail === 'month' ? { borderColor: '#d97706', borderWidth: 2 } : {}}
              onClick={() => setRevenueDetail(revenueDetail === 'month' ? null : 'month')}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50">
                  <Euro size={16} className="text-amber-600" />
                </div>
                <span className="text-xs text-slate-500 font-medium">{stats.monthName} Ciro</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.monthRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">EUR</p>
            </div>

            <div className="bg-white rounded-2xl border p-4 transition-smooth hover:shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50">
                  <TrendingUp size={16} className="text-emerald-600" />
                </div>
                <span className="text-xs text-slate-500 font-medium">Komisyon Kazanç</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{commission.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">EUR — %{commissionRate.toLocaleString('tr-TR')}</p>
            </div>
          </div>
        )
      })()}

      {/* Şehir bazlı ciro detayı */}
      {revenueDetail && (() => {
        const cityData = revenueDetail === 'today' ? stats.todayCityRevenue : stats.monthCityRevenue
        const totalRev = revenueDetail === 'today' ? stats.todayRevenue : stats.monthRevenue
        const title = revenueDetail === 'today' ? 'Bugün — Şehir Bazlı Ciro' : `${stats.monthName} — Şehir Bazlı Ciro`
        const maxRev = cityData[0]?.revenue || 1
        return (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b bg-amber-50/50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <span className="text-xs text-slate-400">{cityData.length} şehir</span>
              </div>
            </div>
            {cityData.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Veri bulunamadı</div>
            ) : (
              <div>
                {cityData.map((c, i) => (
                  <div key={c.city} className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${i !== cityData.length - 1 ? 'border-b' : ''} hover:bg-slate-50 transition-fast`}>
                    <MapPin size={14} className="text-amber-600 shrink-0" />
                    <span className="text-sm font-medium text-slate-900 w-28 sm:w-36 truncate shrink-0">{c.city}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-900 shrink-0 min-w-[80px] text-right">{c.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-amber-50/50 border-t font-semibold">
                  <span className="text-sm text-slate-700">Toplam</span>
                  <span className="text-sm text-slate-900">{totalRev.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</span>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Son 30 gün grafiği */}
      <div className="bg-white rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Son 30 Gün</h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <TrendingUp size={12} />
            <span>Günlük transfer sayısı</span>
          </div>
        </div>
        <div className="flex items-end gap-[3px] h-32">
          {stats.dailyCounts.map(d => {
            const isToday = d.date === todayStr()
            const barHeight = maxDaily > 0 ? (d.count / maxDaily) * 110 : 2
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                {/* Tooltip */}
                <div className="absolute -top-8 bg-slate-900 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                  {formatShortDate(d.date)}: {d.count} transfer
                </div>
                <div
                  className="w-full rounded-t transition-all min-h-[2px]"
                  style={{
                    background: isToday ? BRAND : d.count > 0 ? '#94a3b8' : '#e2e8f0',
                    height: `${barHeight}px`,
                  }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-slate-400">{formatShortDate(stats.dailyCounts[0]?.date || '')}</span>
          <span className="text-[10px] text-slate-400 font-medium" style={{ color: BRAND }}>Bugün</span>
        </div>
      </div>

      {/* Şehir bazlı aylık tablo */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{stats.monthName} — Şehir Bazlı</h3>
            <span className="text-xs text-slate-400">{stats.cityMonthly.length} şehir</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Tablo başlığı */}
          <div className="grid grid-cols-12 px-4 sm:px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b bg-slate-50/50 min-w-[400px]">
            <div className="col-span-4">Şehir</div>
            <div className="col-span-3 text-center">Toplam</div>
            <div className="col-span-2 text-center text-emerald-600">Yeni</div>
            <div className="col-span-2 text-center text-red-500">İptal</div>
            <div className="col-span-1 text-center text-blue-500">Gnc</div>
          </div>

          {/* Şehir satırları */}
          {stats.cityMonthly.map((c, i) => (
            <div key={c.city} className={`grid grid-cols-12 px-4 sm:px-5 py-3 items-center min-w-[400px] ${i !== stats.cityMonthly.length - 1 ? 'border-b' : ''} hover:bg-slate-50 transition-fast`}>
              <div className="col-span-4 flex items-center gap-2">
                <MapPin size={14} style={{ color: BRAND }} className="shrink-0" />
                <span className="text-sm font-medium text-slate-900 truncate">{c.city}</span>
              </div>
              <div className="col-span-3 text-center">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(c.total / maxCity) * 100}%`, background: BRAND }} />
                  </div>
                  <span className="text-sm font-bold text-slate-900 w-8 text-right">{c.total}</span>
                </div>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-sm text-emerald-600 font-medium">{c.newCount}</span>
              </div>
              <div className="col-span-2 text-center">
                {c.cancelledCount > 0 ? (
                  <span className="text-sm text-red-500 font-medium">{c.cancelledCount}</span>
                ) : (
                  <span className="text-sm text-slate-300">-</span>
                )}
              </div>
              <div className="col-span-1 text-center">
                {c.updatedCount > 0 ? (
                  <span className="text-sm text-blue-500 font-medium">{c.updatedCount}</span>
                ) : (
                  <span className="text-sm text-slate-300">-</span>
                )}
              </div>
            </div>
          ))}

          {/* Alt toplam satırı */}
          {stats.cityMonthly.length > 0 && (
            <div className="grid grid-cols-12 px-4 sm:px-5 py-3 items-center bg-slate-50 border-t font-semibold min-w-[400px]">
              <div className="col-span-4 text-sm text-slate-700">Toplam</div>
              <div className="col-span-3 text-center text-sm text-slate-900">{stats.monthCount}</div>
              <div className="col-span-2 text-center text-sm text-emerald-600">{stats.monthNew}</div>
              <div className="col-span-2 text-center text-sm text-red-500">{stats.monthCancelled}</div>
              <div className="col-span-1 text-center text-sm text-blue-500">{stats.monthUpdated}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bu ay toplam kartı */}
      <div className="bg-white rounded-2xl border p-5 flex items-center justify-between transition-smooth hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: BRAND }}>
            <ArrowRightLeft size={22} className="text-white" />
          </div>
          <div>
            <p className="text-sm text-slate-500">{stats.monthName} Toplamı</p>
            <p className="text-xs text-slate-400">Bu ayki toplam transfer</p>
          </div>
        </div>
        <p className="text-3xl font-bold" style={{ color: BRAND }}>{stats.monthCount}</p>
      </div>
    </div>
  )
}

// =============================================
// Dashboard
// =============================================
export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'transfers'>('overview')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [cities, setCities] = useState<Record<string, Reservation[]>>({})
  const [total, setTotal] = useState(0)
  const [normalCount, setNormalCount] = useState(0)
  const [cancelledCount, setCancelledCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [needsSync, setNeedsSync] = useState(false)
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())
  const [initialLoading, setInitialLoading] = useState(true)
  
  // Dark mode state: 'light' | 'dark' | 'system'
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system')
  const [isDark, setIsDark] = useState(false)

  // Arama
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Record<string, Reservation[]> | null>(null)
  const [searchTotal, setSearchTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // İstatistikler
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)

  // Bildirimler
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  const fetchReservations = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reservations?date=${date}`)
      if (!res.ok) {
        if (res.status === 401) { toast.error('Oturum süresi doldu.'); onLogout(); return }
        const data = await res.json()
        setError(data.error || 'Bir hata oluştu.'); setLoading(false); return
      }
      const data = await res.json()
      setCities(data.cities)
      setTotal(data.total)
      setNormalCount(data.normalCount || 0)
      setCancelledCount(data.cancelledCount || 0)
      setLastSync(data.lastSync)
      if (!data.lastSync) setNeedsSync(true)
    } catch { setError('Sunucuya bağlanılamadı.') }
    setLoading(false)
  }, [onLogout])

  async function loadStats() {
    setLoadingStats(true)
    try {
      const res = await fetch('/api/stats')
      if (res.ok) setStats(await res.json())
    } catch { /* sessiz */ }
    setLoadingStats(false)
  }

  // Dark mode initialization
  useEffect(() => {
    // localStorage'dan tema tercihini oku
    const savedTheme = localStorage.getItem('unico-theme') as 'light' | 'dark' | 'system' | null
    if (savedTheme) {
      setThemeMode(savedTheme)
    }
  }, [])

  // Sistem temasını dinle ve dark mode'u güncelle
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const updateDarkMode = () => {
      if (themeMode === 'system') {
        setIsDark(mediaQuery.matches)
      } else {
        setIsDark(themeMode === 'dark')
      }
    }
    
    updateDarkMode()
    mediaQuery.addEventListener('change', updateDarkMode)
    
    return () => mediaQuery.removeEventListener('change', updateDarkMode)
  }, [themeMode])

  const toggleTheme = () => {
    const modes: Array<'light' | 'dark' | 'system'> = ['light', 'system', 'dark']
    const currentIndex = modes.indexOf(themeMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setThemeMode(nextMode)
    localStorage.setItem('unico-theme', nextMode)
  }

  // İlk yüklemede stats + reservations + bildirim izni
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([loadStats(), fetchReservations(selectedDate)])
      setInitialLoading(false)
      
      // Otomatik bildirim izni iste
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          setNotificationsEnabled(true)
        }
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        setNotificationsEnabled(true)
      }
    }
    loadInitialData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (needsSync && !syncing) { setNeedsSync(false); handleSync() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSync])

  async function handleSync(force = false, silent = false) {
    if (syncing) return
    setSyncing(true)
    if (!silent) toast.info('Mailler okunuyor... Bu biraz sürebilir.')
    try {
      const res = await fetch(`/api/sync${force ? '?force=true' : ''}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (!silent) toast.error(data.error || 'Senkronizasyon başarısız.')
        setSyncing(false); return
      }
      if (data.synced > 0) {
        if (!silent) { toast.success(`${data.synced} yeni rezervasyon eklendi.`); try { new Audio('/notification.wav').play() } catch {} }
        if (notificationsEnabled && silent && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('UNICO Travel', { body: `${data.synced} yeni rezervasyon geldi!`, icon: '/logo.png' })
          try { new Audio('/notification.wav').play() } catch {}
        }
      } else if (!silent) {
        toast.info('Yeni rezervasyon bulunamadı.')
      }
      setLastSync(data.syncedAt)
      await fetchReservations(selectedDate)
      loadStats() // stats'ı da güncelle
    } catch {
      if (!silent) toast.error('Senkronizasyon başarısız.')
    }
    setSyncing(false)
  }

  // Otomatik sync (2 dk)
  useEffect(() => {
    const interval = setInterval(() => handleSync(false, true), AUTO_SYNC_INTERVAL)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, notificationsEnabled])

  // Tarih değişince veri çek
  useEffect(() => { fetchReservations(selectedDate) }, [selectedDate, fetchReservations])

  // Arama debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (searchQuery.length < 2) { setSearchResults(null); setSearchTotal(0); return }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.cities)
          setSearchTotal(data.total)
          setNormalCount(data.normalCount || 0)
          setCancelledCount(data.cancelledCount || 0)
        }
      } catch { /* sessiz */ }
      setSearching(false)
    }, 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchQuery])

  async function toggleNotifications() {
    if (notificationsEnabled) { setNotificationsEnabled(false); toast.info('Bildirimler kapatıldı.'); return }
    if (typeof Notification === 'undefined') { toast.error('Bu tarayıcı bildirimleri desteklemiyor.'); return }
    if (Notification.permission === 'denied') { toast.error('Bildirim izni reddedildi.'); return }
    if (Notification.permission === 'default') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') { toast.error('Bildirim izni verilmedi.'); return }
    }
    setNotificationsEnabled(true)
    toast.success('Bildirimler açıldı.')
  }

  async function handleLogout() { await fetch('/api/auth', { method: 'DELETE' }); onLogout() }

  const toggleCity = (city: string) => {
    setExpandedCities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(city)) {
        newSet.delete(city)
      } else {
        newSet.add(city)
      }
      return newSet
    })
  }

  const isToday = selectedDate === todayStr()
  const isTomorrow = selectedDate === tomorrowStr()
  const isSearching = searchQuery.length >= 2
  const displayCities = isSearching ? (searchResults || {}) : cities
  const displayTotal = isSearching ? searchTotal : total

  // İlk yükleme ekranı
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#BE1E2D] animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">UNICO Travel</h2>
          <p className="text-sm text-slate-500">Veriler yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-2">
            <Image src="/logo.png" alt="UNICO Travel" width={100} height={40} priority />
            <div className="flex items-center gap-2">
              <button onClick={toggleNotifications} className="p-1.5 rounded-lg transition-fast hover:bg-slate-100 transform hover:scale-110"
                title={notificationsEnabled ? 'Bildirimleri kapat' : 'Bildirimleri aç'}>
                {notificationsEnabled ? <Bell size={16} style={{ color: BRAND }} /> : <BellOff size={16} className="text-slate-400" />}
              </button>
              <button onClick={() => handleSync()} disabled={syncing}
                className="flex items-center gap-1.5 text-sm transition-fast disabled:opacity-50 hover:opacity-80" style={{ color: BRAND }}>
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{syncing ? 'Okunuyor...' : 'Güncelle'}</span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-fast">
                <LogOut size={16} /><span className="hidden sm:inline">Çıkış</span>
              </button>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-fast ${
                activeTab === 'overview' ? 'text-slate-900' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200'
              }`}
              style={activeTab === 'overview' ? { borderColor: BRAND, color: BRAND } : undefined}
            >
              <BarChart3 size={15} />
              Genel Bakış
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-fast ${
                activeTab === 'transfers' ? 'text-slate-900' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-200'
              }`}
              style={activeTab === 'transfers' ? { borderColor: BRAND, color: BRAND } : undefined}
            >
              <ArrowRightLeft size={15} />
              Transferler
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ===== GENEL BAKIŞ TAB ===== */}
        {activeTab === 'overview' && (
          <OverviewTab stats={stats} loading={loadingStats && !stats} />
        )}

        {/* ===== TRANSFERLER TAB ===== */}
        {activeTab === 'transfers' && (
          <div className="space-y-6">
            {/* Arama */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Booking ID, uçuş no, şehir veya konum ara..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': BRAND } as React.CSSProperties} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              )}
              {searching && <Loader2 size={16} className="absolute right-10 top-1/2 -translate-y-1/2 animate-spin" style={{ color: BRAND }} />}
            </div>

            {isSearching && !searching && (
              <div className="flex items-center gap-2 text-sm">
                <Search size={14} style={{ color: BRAND }} />
                <span className="text-slate-600"><strong style={{ color: BRAND }}>{searchTotal}</strong> sonuç: &quot;{searchQuery}&quot;</span>
              </div>
            )}

            {/* Tarih Seçici */}
            {!isSearching && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setSelectedDate(todayStr())}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-fast transform hover:scale-105 ${isToday ? 'text-white shadow-sm' : 'bg-white text-slate-700 border hover:bg-slate-50'}`}
                  style={isToday ? { background: BRAND } : undefined}>
                  <Sun size={15} />Bugün
                </button>
                <button onClick={() => setSelectedDate(tomorrowStr())}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-fast transform hover:scale-105 ${isTomorrow ? 'text-white shadow-sm' : 'bg-white text-slate-700 border hover:bg-slate-50'}`}
                  style={isTomorrow ? { background: BRAND } : undefined}>
                  <Sunrise size={15} />Yarın
                </button>
                <button onClick={() => setShowCalendar(true)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-fast transform hover:scale-105 ${!isToday && !isTomorrow ? 'text-white shadow-sm' : 'bg-white text-slate-700 border hover:bg-slate-50'}`}
                  style={!isToday && !isTomorrow ? { background: BRAND } : undefined}>
                  <Calendar size={15} />Takvim
                </button>
              </div>
            )}

            {/* Tarih info */}
            {!isSearching && (
              <div className="bg-white rounded-2xl border p-4 sm:p-5 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">Seçili Tarih</p>
                    <p className="text-base sm:text-lg font-semibold text-slate-900 mt-0.5">{formatDateTR(selectedDate)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm text-slate-500">Toplam Transfer</p>
                    {loading ? <Loader2 size={28} className="animate-spin mt-1 sm:ml-auto" style={{ color: BRAND }} />
                      : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="sm:text-right">
                            <p className="text-lg font-semibold text-slate-600">{normalCount}</p>
                            <p className="text-[10px] text-slate-400">Normal</p>
                          </div>
                          <span className="text-slate-300">+</span>
                          <div className="sm:text-right">
                            <p className="text-lg font-semibold text-red-500">{cancelledCount}</p>
                            <p className="text-[10px] text-red-400">İptal</p>
                          </div>
                          <span className="text-slate-300">=</span>
                          <div className="sm:text-right">
                            <p className="text-2xl sm:text-3xl font-bold" style={{ color: BRAND }}>{total}</p>
                            <p className="text-[10px] text-slate-400">Toplam</p>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
                {lastSync && (
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-xs text-slate-400">Son güncelleme: {new Date(lastSync).toLocaleString('tr-TR')}</p>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Otomatik sync
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Syncing banner */}
            {syncing && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: BRAND_LIGHT, border: '1px solid #fecaca' }}>
                <Loader2 size={20} className="animate-spin shrink-0" style={{ color: BRAND }} />
                <p className="text-sm" style={{ color: '#991b1b' }}>Mailler okunuyor...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                <p className="text-red-600 font-medium text-sm">{error}</p>
                <button onClick={() => fetchReservations(selectedDate)} className="mt-2 text-sm text-red-500 underline hover:text-red-700 transition-fast">Tekrar Dene</button>
              </div>
            )}

            {/* Rezervasyon listesi */}
            {!isSearching && loading ? (
              <TransfersSkeleton />
            ) : !error && displayTotal === 0 && !searching ? (
              <div className="bg-white rounded-2xl border p-10 text-center">
                {isSearching
                  ? <><Search size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-500 font-medium">Sonuç bulunamadı.</p></>
                  : <><Calendar size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-500 font-medium">Bu tarihte transfer bulunmuyor.</p></>}
              </div>
            ) : !error && displayTotal > 0 && (
              <div className="space-y-4 animate-fadeIn">
                {Object.entries(displayCities).map(([city, reservations]) => {
                  const isExpanded = expandedCities.has(city)
                  const cityCancelled = reservations.filter(r => r.type === 'cancelled').length
                  return (
                    <div key={city} className="bg-white rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md">
                      <button
                        onClick={() => toggleCity(city)}
                        className="w-full px-5 py-3 bg-slate-50 border-b flex items-center justify-between hover:bg-slate-100 transition-fast"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin size={16} style={{ color: BRAND }} />
                          <span className="font-semibold text-slate-900">{city}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-white" style={{ background: BRAND }}>
                            {reservations.length - cityCancelled} transfer
                          </span>
                          {cityCancelled > 0 && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                              {cityCancelled} iptal
                            </span>
                          )}
                          <ChevronRight
                            size={18}
                            className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="divide-y">
                      {reservations.map(r => {
                        const st = typeConfig[r.type]
                        const transferDate = r.flightDateISO || r.pickupDateISO
                        return (
                          <button key={r.bookingId} onClick={() => setSelectedReservation(r)}
                            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-all duration-150 text-left group">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot} transition-transform duration-200 group-hover:scale-125`} />
                              <div className="min-w-0">
                                <span className="text-sm font-mono font-semibold block" style={{ color: BRAND }}>#{r.bookingId}</span>
                                <span className="text-xs text-slate-500 block truncate">
                                  {r.passengerName || r.category} · {r.passengers} yolcu{r.flightNumber && ` · ${r.flightNumber}`}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <span className={`text-xs font-medium ${r.type === 'new' ? 'text-emerald-600' : r.type === 'cancelled' ? 'text-red-500' : 'text-blue-600'}`}>
                                {st.label}
                              </span>
                              {r.pickupTime && <span className="text-xs text-slate-400 block">{r.pickupTime}</span>}
                              {isSearching && transferDate && <span className="text-[10px] text-slate-400 block">{formatShortDate(transferDate)}</span>}
                            </div>
                          </button>
                        )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCalendar && <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} onClose={() => setShowCalendar(false)} />}
      {selectedReservation && <ReservationDetail reservation={selectedReservation} onClose={() => setSelectedReservation(null)} />}
    </div>
  )
}
