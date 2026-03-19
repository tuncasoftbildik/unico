'use client'

import type { Reservation } from '@/lib/types'
import { X, MapPin, Plane, Users, Car, Navigation, Clock, FileText, ArrowRight } from 'lucide-react'

const typeConfig = {
  new: { label: 'Yeni', color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'İptal', color: 'bg-red-100 text-red-700' },
  updated: { label: 'Güncellendi', color: 'bg-blue-100 text-blue-700' },
}

export function ReservationDetail({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const type = typeConfig[reservation.type]
  const transferDate = reservation.flightDate || reservation.pickupDate || '-'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-mono">#{reservation.bookingId}</h2>
            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${type.color}`}>
              {type.label}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Transfer Rotası */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Transfer Rotası</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1" />
                  <div className="w-0.5 h-full bg-slate-200 my-1" />
                </div>
                <div className="pb-3">
                  <p className="text-xs text-slate-400 mb-0.5">Alış noktası</p>
                  <p className="text-sm text-slate-900">{reservation.pickupLocation || '-'}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Bırakış noktası</p>
                  <p className="text-sm text-slate-900">{reservation.dropoffLocation || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Detaylar */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Detaylar</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Car size={16} className="text-slate-400" />
                <span className="text-sm text-slate-900">{reservation.category}</span>
              </div>
              <div className="flex items-center gap-3">
                <Users size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">{reservation.passengers} yolcu</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-slate-400" />
                <span className="text-sm text-slate-600">{reservation.city}</span>
              </div>
              {reservation.distance && (
                <div className="flex items-center gap-3">
                  <Navigation size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-600">{reservation.distance}</span>
                </div>
              )}
            </div>
          </div>

          {/* Uçuş / Tarih Bilgileri */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tarih & Uçuş</h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-slate-400" />
                <span className="text-sm text-slate-900 font-medium">{transferDate}</span>
                {reservation.pickupTime && (
                  <span className="text-sm text-amber-600 font-medium">· {reservation.pickupTime}</span>
                )}
              </div>
              {reservation.flightNumber && (
                <div className="flex items-center gap-3">
                  <Plane size={16} className="text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {reservation.flightNumber}
                    {reservation.originAirport && (
                      <span className="text-slate-400"> · {reservation.originAirport}</span>
                    )}
                  </span>
                </div>
              )}
            </div>
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

          {/* Booking.com linki */}
          <a
            href={`https://portal.taxis.booking.com/bookings/rides?bookingId=${reservation.bookingId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            Booking.com&apos;da Görüntüle
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  )
}
