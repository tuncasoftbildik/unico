export interface Reservation {
  id: string
  reservationNo: string
  customerName: string
  customerEmail: string
  customerPhone: string
  city: string
  hotel: string
  checkIn: string   // YYYY-MM-DD
  checkOut: string  // YYYY-MM-DD
  guests: number
  roomType: string
  status: 'confirmed' | 'pending' | 'cancelled'
  totalPrice: number
  currency: string
  notes?: string
  createdAt: string
}
