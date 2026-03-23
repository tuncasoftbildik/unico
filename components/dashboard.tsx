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
import type { StatsData } from '@/lib/salesforce'
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

const typeConfig: Record<string, { label: string; dot: string }> = {
  new: { label: 'Yeni', dot: 'bg-emerald-500' },
  cancelled: { label: 'İptal', dot: 'bg-red-500' },
  cancelledWithCost: { label: 'İptal (Ücretli)', dot: 'bg-orange-500' },
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
function OverviewTab({ stats, loading, onCityClick, onDateSelect }: { stats: StatsData | null; loading: boolean; onCityClick?: (city: string) => void; onDateSelect?: (date: string) => void }) {
  const [revenueDetail, setRevenueDetail] = useState<'today' | 'month' | null>(null)

  if (loading || !stats) {
    return <OverviewSkeleton />
  }

  const maxDaily = Math.max(...stats.dailyCounts.map(d => d.count), 1)
  const maxCity = stats.cityMonthly[0]?.total || 1
  const rev = stats.monthRevenue
  const commissionRate = rev <= 100_000 ? 7 : rev <= 200_000 ? 6 : rev <= 300_000 ? 5.5 : 5
  const commission = rev * commissionRate / 100

  // Geçen ay karşılaştırma yüzdeleri
  const countChange = stats.prevMonthCount > 0 ? ((stats.monthCount - stats.prevMonthCount) / stats.prevMonthCount) * 100 : 0
  const revenueChange = stats.prevMonthRevenue > 0 ? ((stats.monthRevenue - stats.prevMonthRevenue) / stats.prevMonthRevenue) * 100 : 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero banner — Bugün & Yarın */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-6 text-white" style={{ background: 'linear-gradient(135deg, #BE1E2D 0%, #8B1520 100%)' }}>
          <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <Sun size={14} className="opacity-80 sm:hidden" /><Sun size={16} className="opacity-80 hidden sm:block" />
              <span className="text-xs sm:text-sm font-medium opacity-80">Bugün</span>
            </div>
            <p className="text-3xl sm:text-5xl font-extrabold tracking-tight">{stats.todayCount}</p>
            <p className="text-xs sm:text-sm opacity-70 mt-1">aktif transfer</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-6 text-white" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2540 100%)' }}>
          <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <Sunrise size={14} className="opacity-80 sm:hidden" /><Sunrise size={16} className="opacity-80 hidden sm:block" />
              <span className="text-xs sm:text-sm font-medium opacity-80">Yarın</span>
            </div>
            <p className="text-3xl sm:text-5xl font-extrabold tracking-tight">{stats.tomorrowCount}</p>
            <p className="text-xs sm:text-sm opacity-70 mt-1">planlanan transfer</p>
          </div>
        </div>
      </div>

      {/* Hafta & Ay kartları */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-5 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Bu Hafta</span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={14} className="text-emerald-600 sm:hidden" /><TrendingUp size={18} className="text-emerald-600 hidden sm:block" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.weekCount.toLocaleString('tr-TR')}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1">transfer</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-5 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">{stats.monthName}</span>
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <Calendar size={14} className="text-violet-600 sm:hidden" /><Calendar size={18} className="text-violet-600 hidden sm:block" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.monthCount.toLocaleString('tr-TR')}</p>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-1">transfer</p>
        </div>
      </div>

      {/* Aylık durum kartları */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 p-3 sm:p-4 hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
            <span className="text-[9px] sm:text-xs font-semibold text-emerald-700 uppercase tracking-wider">Yeni</span>
          </div>
          <p className="text-xl sm:text-3xl font-extrabold text-emerald-700">{stats.monthNew.toLocaleString('tr-TR')}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-white rounded-2xl border border-red-100 p-3 sm:p-4 hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500" />
            <span className="text-[9px] sm:text-xs font-semibold text-red-600 uppercase tracking-wider">İptal</span>
          </div>
          <p className="text-xl sm:text-3xl font-extrabold text-red-600">{stats.monthCancelled.toLocaleString('tr-TR')}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 p-3 sm:p-4 hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500" />
            <span className="text-[9px] sm:text-xs font-semibold text-orange-600 uppercase tracking-wider">İptal Oranı</span>
          </div>
          <p className="text-xl sm:text-3xl font-extrabold text-orange-600">{stats.monthCount > 0 ? (stats.monthCancelled / stats.monthCount * 100).toFixed(1) : '0.0'}%</p>
        </div>
      </div>

      {/* Geçen ay karşılaştırma */}
      {stats.prevMonthCount > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <BarChart3 size={16} style={{ color: BRAND }} />
            <span className="text-xs sm:text-sm font-bold text-slate-900">{stats.prevMonthName} vs {stats.monthName}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Transfer Sayısı</p>
              <div className="flex items-end gap-2">
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{stats.monthCount.toLocaleString('tr-TR')}</p>
                <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold mb-1 ${countChange >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {countChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  %{Math.abs(countChange).toFixed(0)}
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{stats.prevMonthName}: {stats.prevMonthCount.toLocaleString('tr-TR')}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Ciro (EUR)</p>
              <div className="flex items-end gap-2">
                <p className="text-lg sm:text-2xl font-extrabold text-slate-900">{(stats.monthRevenue / 1000).toFixed(1)}K</p>
                <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold mb-1 ${revenueChange >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {revenueChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  %{Math.abs(revenueChange).toFixed(0)}
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{stats.prevMonthName}: {(stats.prevMonthRevenue / 1000).toFixed(1)}K</p>
            </div>
          </div>
        </div>
      )}

      {/* Ciro kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div
          className="relative overflow-hidden rounded-2xl p-4 sm:p-5 cursor-pointer hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60"
          onClick={() => setRevenueDetail(revenueDetail === 'today' ? null : 'today')}
        >
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-amber-200/30" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Euro size={14} className="text-amber-700" />
              <span className="text-[10px] sm:text-xs font-semibold text-amber-700 uppercase tracking-wider">Bugün Ciro</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{stats.todayRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[10px] sm:text-xs text-amber-600/80 mt-1 font-medium">EUR</p>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl p-4 sm:p-5 cursor-pointer hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60"
          onClick={() => setRevenueDetail(revenueDetail === 'month' ? null : 'month')}
        >
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-amber-200/30" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Euro size={14} className="text-amber-700" />
              <span className="text-[10px] sm:text-xs font-semibold text-amber-700 uppercase tracking-wider">{stats.monthName} Ciro</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">{stats.monthRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[10px] sm:text-xs text-amber-600/80 mt-1 font-medium">EUR</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white hover:shadow-lg transition-all duration-300">
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <TrendingUp size={14} className="opacity-80" />
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider opacity-80">Komisyon</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold">{commission.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[10px] sm:text-xs opacity-70 mt-1 font-medium">EUR — %{commissionRate.toLocaleString('tr-TR')}</p>
          </div>
        </div>
      </div>

      {/* Şehir bazlı ciro detayı */}
      {revenueDetail && (() => {
        const cityData = revenueDetail === 'today' ? stats.todayCityRevenue : stats.monthCityRevenue
        const totalRev = revenueDetail === 'today' ? stats.todayRevenue : stats.monthRevenue
        const title = revenueDetail === 'today' ? 'Bugün — Şehir Bazlı Ciro' : `${stats.monthName} — Şehir Bazlı Ciro`
        const maxRev = cityData[0]?.revenue || 1
        return (
          <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded-full">{cityData.length} şehir</span>
              </div>
            </div>
            {cityData.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Veri bulunamadı</div>
            ) : (
              <div>
                {cityData.map((c, i) => (
                  <div key={c.city} className={`flex items-center gap-3 px-5 py-3.5 ${i !== cityData.length - 1 ? 'border-b border-slate-100' : ''} hover:bg-slate-50/50 transition-all`}>
                    <MapPin size={14} className="text-amber-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 w-20 sm:w-36 truncate shrink-0">{c.city}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 shrink-0 min-w-[60px] sm:min-w-[80px] text-right">{c.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-t font-bold">
                  <span className="text-sm text-slate-700">Toplam</span>
                  <span className="text-sm text-slate-900">{totalRev.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR</span>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Son 30 gün grafiği */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-6 hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900">Son 30 Gün</h3>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Günlük transfer hacmi</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded" style={{ background: '#94a3b8' }} />
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded" style={{ background: BRAND }} />
              <span>Bugün</span>
            </div>
          </div>
        </div>
        <div className="flex items-end gap-[2px] sm:gap-[3px] h-28 sm:h-36">
          {stats.dailyCounts.map(d => {
            const isToday = d.date === todayStr()
            const barHeight = maxDaily > 0 ? (d.count / maxDaily) * 130 : 2
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute -top-9 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-10 shadow-lg">
                  {formatShortDate(d.date)}: <strong>{d.count}</strong> transfer
                </div>
                <div
                  className="w-full rounded-md transition-all duration-200 min-h-[2px] group-hover:opacity-80"
                  style={{
                    background: isToday
                      ? `linear-gradient(to top, #8B1520, ${BRAND})`
                      : d.count > 0 ? 'linear-gradient(to top, #94a3b8, #cbd5e1)' : '#f1f5f9',
                    height: `${barHeight}px`,
                  }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-3 px-1">
          <span className="text-[11px] text-slate-400 font-medium">{formatShortDate(stats.dailyCounts[0]?.date || '')}</span>
          <span className="text-[11px] font-bold" style={{ color: BRAND }}>Bugün</span>
        </div>
      </div>

      {/* Aylık Takvim Görünümü */}
      {(() => {
        const calendarData = stats.calendarCounts
        if (!calendarData || calendarData.length === 0) return null
        const maxCal = Math.max(...calendarData.map(d => d.total), 1)
        const firstDate = new Date(calendarData[0].date + 'T00:00:00')
        const firstDay = firstDate.getDay()
        const offset = firstDay === 0 ? 6 : firstDay - 1
        const calendarMap = new Map(calendarData.map(d => [d.date, d]))
        const today = todayStr()

        return (
          <div className="bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-6 hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">{stats.monthName} — Takvim</h3>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Güne tıklayarak transferleri görüntüleyin</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded" style={{ background: '#fecaca' }} />
                  <span>Az</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded" style={{ background: BRAND }} />
                  <span>Yoğun</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(d => (
                <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
              {calendarData.map(d => {
                const day = new Date(d.date + 'T00:00:00').getDate()
                const isToday = d.date === today
                const isPast = d.date < today
                const intensity = d.total > 0 ? Math.max(0.15, d.total / maxCal) : 0
                const hasTransfers = d.total > 0
                const activeCount = d.total - d.cancelled

                return (
                  <button
                    key={d.date}
                    onClick={() => hasTransfers && onDateSelect?.(d.date)}
                    className={`relative rounded-xl p-1.5 sm:p-2 text-center transition-all duration-200 ${
                      hasTransfers ? 'cursor-pointer hover:scale-105 hover:shadow-md' : 'cursor-default'
                    } ${isToday ? 'ring-2 ring-offset-1' : ''}`}
                    style={{
                      background: hasTransfers
                        ? `rgba(190, 30, 45, ${intensity})`
                        : isPast ? '#f8fafc' : '#ffffff',
                      ...(isToday ? { ringColor: BRAND } : {}),
                    }}
                  >
                    <p className={`text-xs sm:text-sm font-medium ${
                      isToday ? 'font-bold' : isPast && !hasTransfers ? 'text-slate-300' : 'text-slate-700'
                    }`} style={isToday ? { color: BRAND } : hasTransfers ? { color: intensity > 0.6 ? '#fff' : '#1e293b' } : undefined}>
                      {day}
                    </p>
                    {hasTransfers && (
                      <p className={`text-[9px] sm:text-[10px] font-bold mt-0.5 ${intensity > 0.6 ? 'text-white/90' : ''}`}
                        style={intensity <= 0.6 ? { color: BRAND } : undefined}>
                        {activeCount}{d.cancelled > 0 && <span className="text-red-400">/{d.cancelled}</span>}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Şehir bazlı aylık — kart grid */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">{stats.monthName} — Şehir Bazlı</h3>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Şehre tıklayarak detayları görüntüleyin</p>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 bg-white border px-2 sm:px-3 py-1 rounded-full font-medium">{stats.cityMonthly.length} şehir</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {stats.cityMonthly.map((c) => {
            const pct = maxCity > 0 ? (c.total / maxCity) * 100 : 0
            const cancelRate = c.total > 0 ? Math.round((c.cancelledCount / c.total) * 100) : 0
            return (
              <div key={c.city} onClick={() => onCityClick?.(c.city)}
                className="relative bg-white rounded-2xl border border-slate-200/60 p-4 sm:p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group overflow-hidden">
                {/* Progress arka plan */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                  <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${BRAND}, #e74c5a)` }} />
                </div>

                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center" style={{ background: BRAND_LIGHT }}>
                      <MapPin size={14} className="sm:hidden" style={{ color: BRAND }} /><MapPin size={16} className="hidden sm:block" style={{ color: BRAND }} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#BE1E2D] transition-colors">{c.city}</h4>
                      {cancelRate > 0 && <p className="text-[10px] text-slate-400">%{cancelRate} iptal oranı</p>}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-[#BE1E2D] group-hover:translate-x-0.5 transition-all mt-1" />
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">{c.total.toLocaleString('tr-TR')}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">toplam transfer</p>
                  </div>
                  <div className="flex gap-3 text-right">
                    <div>
                      <p className="text-lg font-bold text-emerald-600">{c.newCount.toLocaleString('tr-TR')}</p>
                      <p className="text-[9px] text-emerald-600/70 uppercase tracking-wider font-semibold">yeni</p>
                    </div>
                    {c.cancelledCount > 0 && (
                      <div>
                        <p className="text-lg font-bold text-red-500">{c.cancelledCount.toLocaleString('tr-TR')}</p>
                        <p className="text-[9px] text-red-400 uppercase tracking-wider font-semibold">iptal</p>
                      </div>
                    )}
                    {c.total > 0 && (
                      <div>
                        <p className="text-lg font-bold text-orange-500">{(c.cancelledCount / c.total * 100).toFixed(0)}%</p>
                        <p className="text-[9px] text-orange-400 uppercase tracking-wider font-semibold">ipt%</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Toplam banner */}
        {stats.cityMonthly.length > 0 && (
          <div className="mt-3 sm:mt-4 relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
            <div className="absolute top-0 right-0 w-32 sm:w-40 h-32 sm:h-40 rounded-full bg-white/5 -translate-y-12 translate-x-12" />
            <div className="relative flex items-center justify-between flex-wrap gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <BarChart3 size={16} className="text-white/80 sm:hidden" /><BarChart3 size={20} className="text-white/80 hidden sm:block" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-white/60">{stats.monthName} Toplamı</p>
                  <p className="text-xl sm:text-2xl font-extrabold">{stats.monthCount.toLocaleString('tr-TR')}</p>
                </div>
              </div>
              <div className="flex gap-4 sm:gap-6">
                <div className="text-right">
                  <p className="text-base sm:text-lg font-bold text-emerald-400">{stats.monthNew.toLocaleString('tr-TR')}</p>
                  <p className="text-[9px] sm:text-[10px] text-emerald-400/70 uppercase tracking-wider font-semibold">yeni</p>
                </div>
                <div className="text-right">
                  <p className="text-base sm:text-lg font-bold text-red-400">{stats.monthCancelled.toLocaleString('tr-TR')}</p>
                  <p className="text-[9px] sm:text-[10px] text-red-400/70 uppercase tracking-wider font-semibold">iptal</p>
                </div>
                <div className="text-right">
                  <p className="text-base sm:text-lg font-bold text-orange-400">{stats.monthCount > 0 ? (stats.monthCancelled / stats.monthCount * 100).toFixed(1) : '0.0'}%</p>
                  <p className="text-[9px] sm:text-[10px] text-orange-400/70 uppercase tracking-wider font-semibold">iptal oranı</p>
                </div>
              </div>
            </div>
          </div>
        )}
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

  // Şehir filtresi (overview'dan tıklanınca)
  const [cityFilter, setCityFilter] = useState<string | null>(null)

  // Bildirim: önceki sayıyı takip et
  const prevTodayCount = useRef<number | null>(null)

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
      // lastSync artık Salesforce'dan geliyor
    } catch { setError('Sunucuya bağlanılamadı.') }
    setLoading(false)
  }, [onLogout])

  async function fetchCityReservations(city: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reservations?city=${encodeURIComponent(city)}`)
      if (!res.ok) { setError('Veri çekilemedi.'); setLoading(false); return }
      const data = await res.json()
      setCities(data.cities)
      setTotal(data.total)
      setNormalCount(data.normalCount || 0)
      setCancelledCount(data.cancelledCount || 0)
      setLastSync(data.lastSync)
      // Tüm grupları aç
      setExpandedCities(new Set(Object.keys(data.cities)))
    } catch { setError('Sunucuya bağlanılamadı.') }
    setLoading(false)
  }

  async function loadStats() {
    setLoadingStats(true)
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        if (prevTodayCount.current === null) prevTodayCount.current = data.todayCount
      }
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

  // Manuel yenileme (Salesforce'dan taze veri çek)
  async function handleRefresh(silent = false) {
    if (syncing) return
    setSyncing(true)
    if (!silent) toast.info('Veriler güncelleniyor...')
    try {
      // Stats cache'i bypass etmek için timestamp ekle
      const res = await fetch(`/api/stats?t=${Date.now()}`)
      if (res.ok) {
        const newStats = await res.json()
        // Bildirim: bugünkü sayı arttıysa
        if (prevTodayCount.current !== null && newStats.todayCount > prevTodayCount.current) {
          const diff = newStats.todayCount - prevTodayCount.current
          if (!silent) { toast.success(`${diff} yeni rezervasyon!`); try { new Audio('/notification.wav').play() } catch {} }
          if (notificationsEnabled && silent && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('UNICO Travel', { body: `${diff} yeni rezervasyon geldi!`, icon: '/logo.png' })
            try { new Audio('/notification.wav').play() } catch {}
          }
        } else if (!silent) {
          toast.info('Veriler güncellendi.')
        }
        prevTodayCount.current = newStats.todayCount
        setStats(newStats)
      }
      await fetchReservations(selectedDate)
      setLastSync(new Date().toISOString())
    } catch {
      if (!silent) toast.error('Güncelleme başarısız.')
    }
    setSyncing(false)
  }

  // Otomatik yenileme (2 dk)
  useEffect(() => {
    const interval = setInterval(() => handleRefresh(true), AUTO_SYNC_INTERVAL)
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

  // cityFilter aktifken veri zaten fetchCityReservations ile çekildi, ek filtre gereksiz
  const displayCities = isSearching ? (searchResults || {}) : cities
  const displayTotal = isSearching ? searchTotal : total

  // İlk yükleme ekranı
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-100/80 flex items-center justify-center">
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
    <div className="min-h-screen bg-slate-100/80">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-2">
            <Image src="/logo.png" alt="UNICO Travel" width={100} height={40} priority />
            <div className="flex items-center gap-2">
              <button onClick={toggleNotifications} className="p-1.5 rounded-lg transition-fast hover:bg-slate-100 transform hover:scale-110"
                title={notificationsEnabled ? 'Bildirimleri kapat' : 'Bildirimleri aç'}>
                {notificationsEnabled ? <Bell size={16} style={{ color: BRAND }} /> : <BellOff size={16} className="text-slate-400" />}
              </button>
              <button onClick={() => handleRefresh()} disabled={syncing}
                className="flex items-center gap-1.5 text-sm transition-fast disabled:opacity-50 hover:opacity-80" style={{ color: BRAND }}>
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{syncing ? 'Yükleniyor...' : 'Yenile'}</span>
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
          <OverviewTab stats={stats} loading={loadingStats && !stats} onCityClick={(city) => {
            setCityFilter(city)
            setActiveTab('transfers')
            fetchCityReservations(city)
          }} onDateSelect={(date) => {
            setSelectedDate(date)
            setActiveTab('transfers')
          }} />
        )}

        {/* ===== TRANSFERLER TAB ===== */}
        {activeTab === 'transfers' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Arama */}
            <div className="relative">
              <Search size={16} className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Booking ID, uçuş no veya konum ara..."
                className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-3.5 bg-white border border-slate-200/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:border-transparent shadow-sm hover:shadow-md transition-all duration-300"
                style={{ '--tw-ring-color': BRAND } as React.CSSProperties} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} />
                </button>
              )}
              {searching && <Loader2 size={18} className="absolute right-12 top-1/2 -translate-y-1/2 animate-spin" style={{ color: BRAND }} />}
            </div>

            {isSearching && !searching && (
              <div className="flex items-center gap-2 px-1">
                <Search size={14} style={{ color: BRAND }} />
                <span className="text-sm text-slate-600"><strong className="font-bold" style={{ color: BRAND }}>{searchTotal}</strong> sonuç: &quot;{searchQuery}&quot;</span>
              </div>
            )}

            {/* Şehir filtresi chip */}
            {cityFilter && !isSearching && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl text-sm font-semibold text-white shadow-md" style={{ background: `linear-gradient(135deg, ${BRAND}, #8B1520)` }}>
                  <MapPin size={15} />
                  {cityFilter} — {stats?.monthName || 'Bu Ay'}
                  <button onClick={() => { setCityFilter(null); fetchReservations(selectedDate) }} className="ml-1 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Tarih Seçici */}
            {!isSearching && !cityFilter && (
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedDate(todayStr())}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${isToday ? 'text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-200/60 hover:shadow-md'}`}
                  style={isToday ? { background: `linear-gradient(135deg, ${BRAND}, #8B1520)` } : undefined}>
                  <Sun size={14} />Bugün
                </button>
                <button onClick={() => setSelectedDate(tomorrowStr())}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${isTomorrow ? 'text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-200/60 hover:shadow-md'}`}
                  style={isTomorrow ? { background: 'linear-gradient(135deg, #1e3a5f, #0f2540)' } : undefined}>
                  <Sunrise size={14} />Yarın
                </button>
                <button onClick={() => setShowCalendar(true)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${!isToday && !isTomorrow ? 'text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-200/60 hover:shadow-md'}`}
                  style={!isToday && !isTomorrow ? { background: 'linear-gradient(135deg, #6d28d9, #4c1d95)' } : undefined}>
                  <Calendar size={14} />Takvim
                </button>
              </div>
            )}

            {/* Tarih hero kartı */}
            {!isSearching && !cityFilter && (
              <div className="relative overflow-hidden rounded-2xl p-4 sm:p-6 text-white animate-fadeIn" style={{ background: isToday ? `linear-gradient(135deg, ${BRAND}, #8B1520)` : isTomorrow ? 'linear-gradient(135deg, #1e3a5f, #0f2540)' : 'linear-gradient(135deg, #6d28d9, #4c1d95)' }}>
                <div className="absolute top-0 right-0 w-28 sm:w-40 h-28 sm:h-40 rounded-full bg-white/5 -translate-y-12 translate-x-12" />
                <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm font-medium opacity-70 mb-1">{isToday ? 'Bugün' : isTomorrow ? 'Yarın' : 'Seçili Tarih'}</p>
                    <p className="text-base sm:text-xl font-bold">{formatDateTR(selectedDate)}</p>
                    {lastSync && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        <p className="text-xs opacity-60">Son güncelleme: {new Date(lastSync).toLocaleString('tr-TR')}</p>
                      </div>
                    )}
                  </div>
                  {!loading && (
                    <div className="flex items-end gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-extrabold">{normalCount}</p>
                        <p className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">aktif</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-extrabold text-red-300">{cancelledCount}</p>
                        <p className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">iptal</p>
                      </div>
                      <div className="text-center border-l border-white/20 pl-4">
                        <p className="text-4xl font-extrabold">{total}</p>
                        <p className="text-[10px] uppercase tracking-wider opacity-60 font-semibold">toplam</p>
                      </div>
                    </div>
                  )}
                  {loading && <Loader2 size={32} className="animate-spin opacity-60" />}
                </div>
              </div>
            )}

            {/* Syncing banner */}
            {syncing && (
              <div className="rounded-2xl p-4 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60">
                <Loader2 size={20} className="animate-spin shrink-0 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">Veriler güncelleniyor...</p>
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
              <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
                {isSearching
                  ? <><Search size={48} className="mx-auto text-slate-200 mb-4" /><p className="text-slate-400 font-semibold text-lg">Sonuç bulunamadı</p><p className="text-sm text-slate-300 mt-1">Farklı bir arama deneyin</p></>
                  : <><Calendar size={48} className="mx-auto text-slate-200 mb-4" /><p className="text-slate-400 font-semibold text-lg">Transfer bulunamadı</p><p className="text-sm text-slate-300 mt-1">Bu tarihte kayıtlı transfer yok</p></>}
              </div>
            ) : !error && displayTotal > 0 && (
              <div className="space-y-4 animate-fadeIn">
                {Object.entries(displayCities).map(([city, reservations]) => {
                  const isExpanded = expandedCities.has(city)
                  const cityCancelled = reservations.filter(r => r.type === 'cancelled' || r.type === 'cancelledWithCost').length
                  const cityActive = reservations.length - cityCancelled
                  return (
                    <div key={city} className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden transition-all duration-300 hover:shadow-lg group/card">
                      <button
                        onClick={() => toggleCity(city)}
                        className="w-full px-5 py-4 flex items-center justify-between transition-all duration-200 hover:bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: BRAND_LIGHT }}>
                            <MapPin size={16} style={{ color: BRAND }} />
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-slate-900 block">{city}</span>
                            <span className="text-[11px] text-slate-400">{cityActive} aktif{cityCancelled > 0 ? ` · ${cityCancelled} iptal` : ''}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-extrabold" style={{ color: BRAND }}>{reservations.length}</span>
                          </div>
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-slate-900 rotate-90' : 'bg-slate-100'}`}>
                            <ChevronRight size={16} className={`transition-colors ${isExpanded ? 'text-white' : 'text-slate-400'}`} />
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-slate-100">
                      {reservations.map((r, ri) => {
                        const st = typeConfig[r.type]
                        const transferDate = r.flightDateISO || r.pickupDateISO
                        return (
                          <button key={r.bookingId} onClick={() => setSelectedReservation(r)}
                            className={`w-full px-5 py-4 flex items-center justify-between hover:bg-gradient-to-r hover:from-slate-50 hover:to-white transition-all duration-200 text-left group ${ri !== reservations.length - 1 ? 'border-b border-slate-50' : ''}`}>
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.dot} ring-4 ${r.type === 'new' ? 'ring-emerald-50' : r.type === 'cancelled' ? 'ring-red-50' : r.type === 'cancelledWithCost' ? 'ring-orange-50' : 'ring-blue-50'}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-mono font-bold" style={{ color: BRAND }}>#{r.bookingId}</span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${r.type === 'new' ? 'bg-emerald-50 text-emerald-700' : r.type === 'cancelled' ? 'bg-red-50 text-red-600' : r.type === 'cancelledWithCost' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {st.label}
                                  </span>
                                </div>
                                <span className="text-xs text-slate-500 block truncate mt-0.5">
                                  {r.passengerName || r.category} · {r.passengers} yolcu{r.flightNumber && ` · ${r.flightNumber}`}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              {r.pickupTime && <span className="text-sm font-bold text-slate-900 block">{r.pickupTime}</span>}
                              {isSearching && transferDate && <span className="text-[11px] text-slate-400 block">{formatShortDate(transferDate)}</span>}
                              {r.journeyCharge && <span className="text-[11px] text-slate-400 block">{r.journeyCharge}</span>}
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
