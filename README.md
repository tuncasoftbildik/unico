# UNICO — Rezervasyon Paneli

Booking.com Taxi Supplier API üzerinden transfer rezervasyonlarını gösteren şifre korumalı panel.

## Özellikler

- Şifre ile giriş (cookie tabanlı oturum)
- Booking.com API'den otomatik rezervasyon çekme (OAuth 2.0)
- Bugün / Yarın hızlı filtre butonları + Takvim ile gün seçimi
- Şehir bazlı rezervasyon gruplandırma (İstanbul, Antalya, Bodrum, vb.)
- Rezervasyon numarasına tıklayarak detay görüntüleme
  - Transfer rotası (alış/bırakış noktaları)
  - Araç kategorisi, yolcu sayısı
  - Uçuş bilgisi, mesafe
  - Booking.com portal linki
- Yeni / İptal / Tamamlanan durumu takibi
- Gelir ve komisyon istatistikleri

## Tech Stack

- **Framework:** Next.js 16, TypeScript
- **UI:** Tailwind CSS, Lucide Icons, Sonner
- **API:** Booking.com Taxi Supplier API (OAuth 2.0)
- **DB:** Turso (libSQL)

## Kurulum

```bash
git clone https://github.com/tuncasoftbildik/unico.git
cd unico
npm install
npm run dev
```

## Ortam Değişkenleri

```env
APP_PASSWORD=your_panel_password
BOOKING_CLIENT_ID=your_booking_client_id
BOOKING_CLIENT_SECRET=your_booking_client_secret
TURSO_DATABASE_URL=your_turso_url
TURSO_AUTH_TOKEN=your_turso_token
```

## Yapı

```
app/
  page.tsx                  # Ana sayfa (login → dashboard)
  api/auth/route.ts         # Şifre doğrulama
  api/reservations/route.ts # Tarih bazlı rezervasyon sorgulama
  api/sync/route.ts         # API senkronizasyonu
  api/stats/route.ts        # İstatistikler
  api/search/route.ts       # Arama
components/
  login-screen.tsx          # Giriş ekranı
  dashboard.tsx             # Panel (tarih seçici + şehir grupları)
  reservation-detail.tsx    # Detay modal
lib/
  types.ts                  # Tip tanımları
  booking-api.ts            # Booking.com API entegrasyonu
  cache.ts                  # DB cache yönetimi
  db.ts                     # Turso veritabanı bağlantısı
```

## Rezervasyon Durumları

| API Status | Panel Durumu | Renk |
|-----------|-------------|------|
| NEW, ACCEPTED, DRIVER_ASSIGNED | Yeni | Yeşil |
| CANCELLED, REJECTED, NO_SHOW | İptal | Kırmızı |
| COMPLETED | Tamamlandı | Mavi |

---

*v0.2 — API entegrasyonu*
