'use client'

import type { Reservation } from '@/lib/types'
import { X, User, Mail, Phone, MapPin, Hotel, Calendar, Users, CreditCard, FileText } from 'lucide-react'

function formatCurrency(amount: number, currency: string = 'TRY'): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const statusConfig = {
  confirmed: { label: 'Onaylı', color: 'bg-emerald-100 text-emerald-700' },
  pending: { label: 'Beklemede', color: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'İptal', color: 'bg-red-100 text-red-700' },
}

export function ReservationDetail({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const status = statusConfig[reservation.status]
  const nights = Math.ceil(
    (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{reservation.reservationNo}</h2>
            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Müşteri Bilgileri */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Müşteri</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <User size={16} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-900">{reservation.customerName}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">{reservation.customerEmail}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">{reservation.customerPhone}</span>
              </div>
            </div>
          </div>

          {/* Konaklama Bilgileri */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Konaklama</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-900">{reservation.city}</span>
              </div>
              <div className="flex items-center gap-3">
                <Hotel size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">{reservation.hotel}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">
                  {formatDate(reservation.checkIn)} — {formatDate(reservation.checkOut)}
                  <span className="text-slate-400 ml-1">({nights} gece)</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Users size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">{reservation.guests} kişi · {reservation.roomType}</span>
              </div>
            </div>
          </div>

          {/* Fiyat */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard size={16} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Toplam Tutar</span>
            </div>
            <span className="text-lg font-bold text-slate-900">
              {formatCurrency(reservation.totalPrice, reservation.currency)}
            </span>
          </div>

          {/* Notlar */}
          {reservation.notes && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notlar</h3>
              <div className="flex gap-3">
                <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-600">{reservation.notes}</p>
              </div>
            </div>
          )}

          {/* Oluşturulma tarihi */}
          <p className="text-xs text-slate-400 text-right">
            Oluşturulma: {new Date(reservation.createdAt).toLocaleString('tr-TR')}
          </p>
        </div>
      </div>
    </div>
  )
}
