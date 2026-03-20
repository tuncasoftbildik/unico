export interface Reservation {
  bookingId: string
  type: 'new' | 'cancelled' | 'updated'
  category: string
  passengers: number
  pickupLocation: string
  dropoffLocation: string
  flightNumber?: string
  flightDate?: string       // "Friday, 20 March 2026" gibi orijinal format
  flightDateISO?: string    // YYYY-MM-DD
  pickupDate?: string       // Uçuşsuz transferler için
  pickupDateISO?: string    // YYYY-MM-DD
  pickupTime?: string       // "12:30" gibi
  originAirport?: string
  distance?: string
  city: string              // Parse edilen şehir
  emailDate: string         // Mailin geldiği tarih ISO
  subject: string
  notes?: string            // Update maillerdeki notlar
  passengerName?: string    // Yolcu adı (HTML'den)
  passengerPhone?: string   // Yolcu telefonu (HTML'den)
  driverSign?: string       // Şoför tabelası (HTML'den)
  journeyCharge?: string    // Ücret (HTML'den)
}
