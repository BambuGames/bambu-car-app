# M0 bulguları

Plan: `docs/superpowers/plans/2026-11-03-m0-spikes.md` · Tasarım: `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md`

## Kararlar

| Karar | Değer | Kaynak |
|---|---|---|
| Şablon kamerası | 1,0 m yükseklik, telefon düz, araç kadrajda yatay olarak ortalı | Task 1 |
| Yatay görüş açısı | Normal mod 69°, dar alan modu 106° | Task 1 |
| Yürüme yarıçapı | Bir modda 8 açının hepsi aynı uzaklıktan çekilir. Normal modda bu uzaklık, yan görünümün kadraj genişliğinin %80'ini doldurduğu mesafedir. Dar alan modunda, 8 silüetin hepsinin kenarlarda %5 pay bırakarak sığdığı en yakın mesafedir | Task 1 |
| Sedan için gereken boşluk | Normal: aracın yanında 3,8 m, önünde 2,4 m. Dar alan: yanında 2,3 m, önünde 0,9 m | Task 1 |
| Sedan şablon modeli | Generic Electric sedan vector (Antonis_zks, CC BY 4.0). Uygulamanın lisanslar ekranında anılmalı | Task 1 |

## Şablon üretimi

- **Araç:** `tools/templates/`, testleriyle birlikte. Şablonları üretmek için: `tools/templates/.venv/bin/python tools/templates/templates.py sedan`. Çıktı `tools/templates/out/sedan/` altında: 8 açı × 2 mod için JSON ve SVG, kontrol için `overview.png`.
- **Model seçimi:** İki aday 4,75 m boya ölçeklenip karşılaştırıldı. Gerçek bir D segmenti Limousine (Passat, 3er, C-Klasse) yaklaşık 1,83 m geniş ve 1,45 m yüksek.
  - Modern Sedan (Chazbc): 2,31 m geniş, 1,82 m yüksek. Sedandan çok küçük bir crossover'a benziyor; elendi.
  - Generic Electric sedan vector (Antonis_zks): 1,92 m geniş, 1,36 m yüksek. Seçildi; gerçek sedana göre biraz geniş ve alçak. Modelin önü `-x` yönünde (`body_types.json`).
- **Plandan sapma:** Plandaki "her açıda araç kutusu kadrajın belli bir oranını doldursun" kuralı iki sorun çıkardı. 45° silüetler kadrajın kenarına yapışıyordu, çünkü kamera aracın merkezine bakıyordu. Ön görünümde de kamera tampona 1,6 m'ye kadar giriyordu. Yerine yukarıdaki kural kondu: her modda tek bir yürüme yarıçapı var ve kamera aracı kadrajda ortalıyor. Bu kural sete tutarlı bir perspektif de veriyor.
- **Hesaplanan mesafeler (sedan):**

  | Mod | Kameranın aracın merkezine uzaklığı | Aracın yanındaki boşluk | Aracın önündeki boşluk | Yan görünümde aracın kadraj genişliğindeki payı |
  |---|---|---|---|---|
  | Normal | 4,74 m | 3,78 m | 2,36 m | %80 |
  | Dar alan | 3,27 m | 2,31 m | 0,89 m | %64 |

- **Tasarımla karşılaştırma:** Tasarım normal modda "yaklaşık 4–5 m", dar alanda "yaklaşık 2–2,5 m" diyor. Ölçülen değerler 3,8 m ve 2,3 m; çelişki yok, normal mod biraz daha az yer istiyor.
- **M1 için not:** Dar alan modunda ön ve arka görünüm kamerayı tampona 0,9 m'ye kadar yaklaştırıyor ve perspektifi çok bozuyor. Normal mod ön ve arka için zaten sadece 2,4 m istiyor. M1'de dar alan modu yan ve çapraz açılarla sınırlanabilir.
- **Gerçek fotoğrafla karşılaştırma (Adım 9):** Task 3'ün fotoğrafları bekleniyor.

## Canlı yönlendirme performansı

Task 2 sürüyor.

- **Test telefonları:** iPhone 11 (eski iPhone, ultra geniş kamerası var), iPhone 16 Pro Max (güncel iPhone), Samsung Galaxy A34 (orta segment Android), Tecno Camon (düşük segment Android; tam model ve işletim sistemi sürümleri bekleniyor). Ultra geniş kamerası olmayan bir iPhone yok. Bu durum, ultra geniş kamerası yoksa Tecno'da denenecek; o da varsa uygulamada lens gizlenerek denenecek.
- **Kurulum notları (M1 için):**
  - Expo SDK 58 ve React Native 0.88, Node 22.13+, 24.3+ veya 26+ istiyor; tek sayılı sürümler (25 dahil) desteklenmiyor. Geliştirme makinesinde Homebrew'un Node 26 LTS'i kullanılıyor.
  - Expo SDK 58 iOS'ta Xcode 26 veya üstünü istiyor: `expo-modules-jsi` Swift 6.2 araçlarıyla derleniyor, Xcode 16.4'te Swift 6.1 var ve derleme başarısız oluyor.
  - CocoaPods (Homebrew, Ruby 4.0) kabuk dil ayarı UTF-8 değilse `pod install` sırasında çöküyor; `LANG=en_US.UTF-8` ile çalışıyor.
  - fast-tflite'ın VisionCamera v5 örneği herkese açık değil; iki kütüphane de Nitro tabanlı olduğu için model kare işleyicide doğrudan çağrılıyor.
  - iOS'ta `metal` delegate'i derlemeye girmiyor; denenen delegate'ler iOS'ta CPU ve CoreML, Android'de CPU ve GPU.

## Maske kalitesi

Task 3, galeri fotoğrafları gelince başlayacak.

## Plaka köşeleri

Task 4, galeri fotoğrafları gelince başlayacak.
