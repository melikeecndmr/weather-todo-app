# SkyTasks — Hava Durumlu Görev Takibi

Canlı hava durumuna göre görevlerini planlayan, modern ve duyarlı (responsive) bir görev takip arayüzü.
Tamamen **HTML + CSS + vanilla JavaScript** ile yazıldı; framework, derleme adımı veya API anahtarı gerektirmez.

## Özellikler

- **Dinamik arayüz:** Arka plan, hava durumuna ve gece/gündüze göre değişir (yağmur ve kar animasyonları dahil)
- **Canlı hava verisi:** Anlık durum, 12 saatlik ve 7 günlük tahmin ([Open-Meteo](https://open-meteo.com/))
- **Şehir arama ve konum:** Otomatik tamamlamalı şehir araması, "konumumu kullan" desteği
- **Akıllı öneri:** Hava uygun değilse dış mekan görevleri için uyarı verir
- **Görev yönetimi:** Ekleme, düzenleme (çift tıklama), silme, tamamlama
- **Hava farkındalıklı görevler:** Son tarihi olan görevlerde o günün hava tahmini ve "uygun / uygun değil" rozeti görünür
- **Öncelik, tür (iç/dış mekan) ve son tarih** alanları, filtreleme ve arama
- **İlerleme halkası** ve tamamlanma yüzdesi
- Görevler `localStorage` ile tarayıcıda saklanır
- Klavye erişilebilirliği, `prefers-reduced-motion` desteği, mobil uyumlu tasarım

## Kurulum (XAMPP)

1. Bu klasörü `C:\xampp\htdocs\skytasks` içine kopyala.
2. XAMPP Control Panel'den **Apache**'yi başlat.
3. Tarayıcıda `http://localhost/skytasks/` adresini aç.

> Proje tamamen statik olduğu için veritabanına (phpMyAdmin/MySQL) ihtiyaç duymaz.

## Dosya yapısı

```
├── index.html   # Sayfa iskeleti
├── style.css    # Tasarım (glassmorphism, dinamik gökyüzü, responsive)
├── script.js    # Hava durumu, görev mantığı, arayüz
└── README.md
```

## Teknolojiler

HTML5 · CSS3 (custom properties, grid, backdrop-filter) · JavaScript ES6+ · Open-Meteo Forecast & Geocoding API
