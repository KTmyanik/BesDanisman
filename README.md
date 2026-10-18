# BES Danışman

Türkiye ve dünya makro durumunu analiz eden, risk profilinize göre BES portföy önerisi sunan web uygulaması.

## Özellikler

- **Makro Analiz**: TCMB kurları + global piyasa verileri (Yahoo Finance)
- **Risk Profili**: 6 soruluk anket ile risk algınızı belirler
- **Portföy Analizi**: Mevcut BES dağılımınızı değerlendirir
- **Yeni Hesap Önerisi**: BES hesabı açmak isteyenlere fon dağılımı önerir
- **Skorlu Fon Önerisi**: TEFAS verisiyle kategori bazında ilk 3 fon (getiri, ücret, büyüklük)

## Masaüstü (.exe) — npm run dev gerekmez

Tek seferlik paket oluşturma (geliştirici):

```bash
npm run package:win
```

Oluşan klasör: `release/BesDanisman/`

**Kullanım:**
1. `BesDanisman.exe` dosyasına çift tıklayın
2. Tarayıcı otomatik açılır (http://localhost:3002)
3. Kapatmak için siyah konsol penceresini kapatın

Masaüstü kısayolu: exe'ye sağ tık → **Masaüstüne kısayol oluştur**

> Tüm `release/BesDanisman` klasörünü birlikte taşıyın (app, node, scripts exe ile aynı yerde kalmalı).

Fon skorlaması için bir kez: `py -m pip install -r requirements.txt`

## Geliştirici modu

```bash
npm install
py -m pip install -r requirements.txt
npm run dev
```

## Veri Kaynakları

- TCMB günlük döviz kurları
- Yahoo Finance (S&P 500, BIST 100, altın, USD/TRY)

## Not

Bu uygulama yatırım tavsiyesi değildir. Kararlarınızı almadan önce lisanslı bir finansal danışmana danışın.
