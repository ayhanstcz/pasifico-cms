# Pasifico CMS — Ana Proje Hedefi

## Proje Durumu (2026-07-24)
Site: Pasifico Lounge & Dining (restaurant sitesi, Bakü)
Mevcut: Express.js + JSON-dosya CMS, 4 dil (TR/EN/AZ/RU), WebP görseller

## Faz 1: Admin Panel Revamp
- [ ] Admin panelde HER kelime 4 dilde düzenlenebilir
- [ ] Admin panelde HER fotoğraf değiştirilebilir
- [ ] Admin panel modern, yenilikçi UI
- [ ] 4 dil desteği (admin panel arayüzü de çoklu-dil olmalı)
- [ ] Tüm content JSON dosyaları admin panelde yönetilebilir:
  - menu.json (87 ürün, 8 kategori)
  - featured.json (3 öne çıkan tabak)
  - i18n.json (100+ çeviri × 4 dil)
  - site.json (iletişim, sosyal medya)
  - events.json (etkinlikler)
  - categories.json (kategoriler)
  - times.json, guests.json, visits.json (form seçenekleri)
  - empty-category.json (boş kategori mesajları)

## Faz 2: AI Asistan (pasifico-admin)
- [ ] Admin panele AI asistan entegre
- [ ] Model: 9Router.ayhanhasanov.cyou (pasifico-admin modeli)
- [ ] Yetenekler:
  - Admin panel kullanımı hakkında yardım
  - Web arama + kullanıcı onayı ile değişiklik yapma
  - Fotoğraf girdilerini kabul etme
  - Ses girdilerini kabul etme
- [ ] Prompt: HTML prompt, İngilizce, "" tırnak kuralı yok, dil kısıtlaması yok
- [ ] AI düşünme bulutu gösterilir, sonra silinir (sadece final mesaj)
- [ ] 20 senaryo × 10 mesaj test
- [ ] Her senaryo 10 üzerinden puanlanır (tool seçimi, cevap kalitesi, kararlar)
- [ ] 9 puan altındaki senaryolar tekrarlanır

## Faz 3: V2 Premium Site
- [ ] Ana site kopyalanır → v2-site/
- [ ] V2'de chatbot (pasifico-bot) entegre
- [ ] Chatbot tüm websiteye erişimli
- [ ] Chatbot promptu: HTML, İngilizce, "" kuralı yok, dinamik verilerle konuşur
- [ ] System prompt'ta hiçbir değişken olmamalı (caching için)
- [ ] Admin panel kopyası → v2-admin/
  - Tek fark: "Chatbot Knowledge" bölümü
  - + butonu ile site dışı özel bilgi eklenir
  - Chatbot bundan haberdar olur
- [ ] V2'de test senaryoları (V1'deki gibi, 20 senaryo × 10 mesaj)

## Faz 4: Optimizasyon
- [ ] Web araştırması — benzer projeler, GitHub repoları
- [ ] Performance optimizasyonu
- [ ] Lighthouse skoru 90+

## Faz 5: Final
- [ ] GitHub push
- [ ] Bilgisayarı kapat
