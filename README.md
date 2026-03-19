# UNICO — Rezervasyon Paneli

Şifre korumalı rezervasyon yönetim paneli. Tarihe ve şehre göre rezervasyonları görüntüleme, detay inceleme.

## Özellikler

- Şifre ile giriş (cookie tabanlı oturum)
- Bugün / Yarın hızlı filtre butonları
- Takvimden gün seçimi
- Şehir bazlı rezervasyon gruplandırma
- Rezervasyon sayısı özeti
- Rezervasyon numarasına tıklayarak detay görüntüleme (müşteri, otel, tarih, fiyat, notlar)

## Tech Stack

- **Framework:** Next.js 16, TypeScript
- **UI:** Tailwind CSS, Lucide Icons, Sonner (toast)

## Kurulum

```bash
git clone https://github.com/tuncasoftbildik/unico.git
cd unico
npm install
cp .env.local.example .env.local
# .env.local dosyasını doldur
npm run dev
```

## Ortam Değişkenleri

```env
APP_PASSWORD=your_password_here
```

## Yapı

```
app/
  page.tsx              # Ana sayfa (login → dashboard)
  api/auth/             # Şifre doğrulama API
  api/reservations/     # Rezervasyon listesi API
components/
  login-screen.tsx      # Giriş ekranı
  dashboard.tsx         # Ana panel (tarih seçici + şehir grupları)
  reservation-detail.tsx # Detay modal
lib/
  types.ts              # Tip tanımları
  mock-data.ts          # Mock rezervasyon verileri
```

---

*Geliştirme aşamasında — v0.1*
