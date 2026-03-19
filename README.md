# UNICO — Rezervasyon Paneli

Booking.com transfer rezervasyonlarını email üzerinden okuyarak gösteren şifre korumalı panel.

## Özellikler

- Şifre ile giriş (cookie tabanlı oturum)
- Booking.com maillerinden otomatik rezervasyon parse etme (IMAP)
- Bugün / Yarın hızlı filtre butonları + Takvim ile gün seçimi
- Şehir bazlı rezervasyon gruplandırma (İstanbul, Antalya, Bodrum, vb.)
- Rezervasyon numarasına tıklayarak detay görüntüleme
  - Transfer rotası (alış/bırakış noktaları)
  - Araç kategorisi, yolcu sayısı
  - Uçuş bilgisi, mesafe
  - Booking.com portal linki
- Yeni / İptal / Güncelleme durumu takibi
- Aynı booking ID için son durumu gösterme (iptal varsa iptal olarak gösterir)

## Tech Stack

- **Framework:** Next.js 16, TypeScript
- **UI:** Tailwind CSS, Lucide Icons, Sonner
- **Email:** IMAP (imapflow + mailparser)

## Kurulum

```bash
git clone https://github.com/tuncasoftbildik/unico.git
cd unico
npm install
cp .env.local.example .env.local
npm run dev
```

## Ortam Değişkenleri

```env
APP_PASSWORD=your_panel_password
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your@email.com
IMAP_PASS=your_app_password
```

## Yapı

```
app/
  page.tsx                  # Ana sayfa (login → dashboard)
  api/auth/route.ts         # Şifre doğrulama
  api/reservations/route.ts # IMAP'tan rezervasyon çekme
components/
  login-screen.tsx          # Giriş ekranı
  dashboard.tsx             # Panel (tarih seçici + şehir grupları)
  reservation-detail.tsx    # Detay modal
lib/
  types.ts                  # Tip tanımları
  imap.ts                   # IMAP bağlantısı + mail parse
```

## Desteklenen Mail Tipleri

| Tip | Subject Pattern | Durum |
|-----|----------------|-------|
| Yeni | `booking NEW confirmation ID #XXX` | Yeşil |
| İptal | `free cancellation ID #XXX` | Kırmızı |
| Güncelleme | `Booking ID #XXX updated` | Mavi |

---

*v0.1*
