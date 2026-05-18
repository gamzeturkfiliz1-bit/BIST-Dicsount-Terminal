# BİST Terminali - Dinamik Analiz ve Takip Sistemi

Bu proje, Borsa İstanbul (BİST) hisse senetlerinin temel analiz rasyolarını takip etmek, finansal trendleri grafikler üzerinden incelemek ve dinamik veri simülasyonları gerçekleştirmek amacıyla geliştirilmiş modern bir finans terminalidir.

## 🚀 Öne Çıkan Özellikler ve Mimari Güncellemeler

### 1. Canlı Veri Entegrasyonu (Yahoo Finance API)
•⁠  ⁠Projedeki tüm hisse senedi fiyatları statik yapıdan çıkarılarak *Yahoo Finance API* (⁠ query2.finance.yahoo.com ⁠ altyapısı) ile tamamen dinamik hale getirilmiştir.
•⁠  ⁠Veriler asenkron (⁠ async/await fetch ⁠) mimariyle piyasadan 15 dakika gecikmeli (delayed) olarak canlı çekilmektedir.
•⁠  ⁠API bağlantısında yaşanabilecek olası limit aşımı veya kesintilere karşı sistemin çökmesini engelleyen güvenli bir *Fallback (Yedek Veri) Mekanizması* entegre edilmiştir.

### 2. AI Agent Altyapısı (⁠ .agent/ ⁠)
Projenin kök dizinine, modern yapay zeka ajan mimarilerine uyumlu kural ve iş akışlarını tanımlayan ⁠ .agent ⁠ modülü eklenmiştir:
•⁠  ⁠*⁠ rules.md ⁠*: Finansal hesaplama hassasiyetlerini (toFixed kuralı), veri benzersizliğini ve oturum güvenliği kurallarını içerir.
•⁠  ⁠*⁠ skills.md ⁠*: Durum yönetimi (State Management), DOM manipülasyonu ve F/K - PD/DD finansal hesaplama yeteneklerini tanımlar.
•⁠  ⁠*⁠ workflows.md ⁠*: Oturum doğrulama, dinamik veri re-render süreçleri ve güvenli çıkış (logout) iş akışlarını şemalaştırır.

### 3. Kullanıcı Deneyimi ve Finansal Mantık
•⁠  ⁠*Oturum Yönetimi:* ⁠ LocalStorage ⁠ entegrasyonu ile kullanıcı oturumları ve canlı eklenen sektör verileri sayfa yenilense dahi tarayıcı hafızasında kalıcı olarak saklanır.
•⁠  ⁠*Güvenli Çıkış (Logout):* Profesyonel finans terminalleri standartlarında, tek tıkla oturum sonlandırma ve hafıza temizleme modülü eklenmiştir.
•⁠  ⁠*Statik Rasyo - Dinamik Grafik Ayrımı:* Finansal mantık gereği, zaman periyotları (1A, 3A, 6A, 1Y) değiştirildiğinde bilançoya bağlı temel rasyolar (F/K, PD/DD) sabit kalırken, alt taraftaki zaman serisi trend çizgileri dinamik olarak güncellenir.
•⁠  ⁠*Dark Mode Tasarımı:* Bloomberg ve Reuters terminalleri standartlarına uygun olarak veri odağını artıran koyu tema estetiği kullanılmıştır.

## 🛠️ Kullanılan Teknolojiler
•⁠  ⁠*Front-End:* HTML5, CSS3 (Flexbox/Grid), Vanilla JavaScript (ES6+)
•⁠  ⁠*Veri & Hafıza:* LocalStorage API, Yahoo Finance API
•⁠  ⁠*Dokümantasyon:* Markdown, .agent Spec

## 📂 Proje Klasör Yapısı
```text
bist-terminal-11/
├── .agent/
│   ├── rules.md
│   ├── skills.md
│   └── workflows.md
├── index.html
├── app.js
└── README.md
