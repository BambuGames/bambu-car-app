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

Task 2 sürüyor. Tecno ölçüldü; Galaxy A34 ve iPhone'lar bekleniyor. Model ve delegate kararı, plana göre orta segment Android ve eski iPhone ölçülünce verilecek.

- **Test telefonları:** iPhone 11 (eski iPhone, ultra geniş kamerası var), iPhone 16 Pro Max (güncel iPhone), Samsung Galaxy A34 (orta segment Android), Tecno CAMON 18P (CH7n; düşük segment Android, Android 12, MediaTek Helio G96, 8 GB RAM). Ultra geniş kamerası olmayan bir iPhone yok. Tecno'da ultra geniş kamera uygulamalara açık değil, bu durum orada görüldü.

### Tecno CAMON 18P (10 Kasım 2026)

Release derlemesi, Wi-Fi üzerinden kablosuz hata ayıklamayla kuruldu. Değerler uygulamanın saniyede bir yazdığı günlükten okundu: her kombinasyon için 15 saniye ısınma, ardından 60 saniye (yaklaşık 56 örnek). Ölçüm ofiste yapıldı: aydınlık için gün ışığı alan pencere kadrajdaydı, az ışık için odanın karanlık köşesi kullanıldı. Model her kareyi aynı boyutta işlediği ve kutu hesaplamadığı için hız, kadrajda araç olup olmamasına bağlı değil.

| Işık | Model + delegate | Çıkarım medyanı | Çıkarım p90 | Tespit/sn medyanı | En düşük |
|---|---|---|---|---|---|
| Aydınlık | Lite0 + CPU | 133 ms | 144 ms | 7 | 5 |
| Aydınlık | Lite0 + GPU | 124 ms | 148 ms | 8 | 6 |
| Aydınlık | Lite2 + CPU | 413 ms | 436 ms | 2 | 2 |
| Aydınlık | Lite2 + GPU | 258 ms | 261 ms | 4 | 3 |
| Az ışık | Lite0 + CPU | 126 ms | 128 ms | 8 | 6 |
| Az ışık | Lite0 + GPU | 129 ms | 173 ms | 7 | 5 |
| Az ışık | Lite2 + CPU | 398 ms | 468 ms | 2 | 1 |
| Az ışık | Lite2 + GPU | 231 ms | 258 ms | 4 | 4 |

- **Sonuç:** Bu telefonda yalnız Lite0 kullanılabilir, saniyede 7-8 tespitle hedefin (en az 8) sınırında ve zaman zaman 5-6'ya iniyor. Lite2 en iyi durumda saniyede 4'te kalıyor. GPU, Lite0'da fark yaratmıyor (int8 model), Lite2'de 1,6 kat hızlandırıyor. Işık hızı değiştirmiyor; darboğaz modelin kendisi.
- **Takılma:** Önizleme akıcı. Tespit hızı kare hızından bağımsız, kamera yalnız işlenebilen kareleri işleyiciye veriyor.
- **Isınma:** 10 dakikalık sürekli ölçümde pil 32,9 °C'den 38,1 °C'ye, odak testinden sonra 41 °C'ye çıktı. Termal durum hep 0 kaldı, telefon kendini yavaşlatmadı.
- **Ultra geniş kamera:** Yok. `minZoom` 1, lens geçiş noktası yok.
- **Odak noktası pozlamayı ölçüyor mu:** Evet. Parlak pencere önünde koyu bir kutu ortalandı ve `focusTo` ekranın ortasına çağrıldı. Ortadaki 300×300 pikselin ortalama parlaklığı 3 saniyede 72'den 167'ye çıktı, sürekli uyarlamayla 6 saniyede 112'ye oturdu. Cihaz `supportsExposureMetering: true` bildiriyor.
- **Fotoğraf çözünürlüğü:** 1x, 4:3: 3968×2976 (11,8 MP). Ultra geniş olmadığı için 0,5x fotoğraf yok.
- **Ölçüm notu:** Deneme uygulamasındaki "camera fps" değeri sensörün hızı değil, işlenen kare sayısı; düşürülen kareler bildirilmiyor.
- **Kurulum notları (M1 için):**
  - Expo SDK 58 ve React Native 0.88, Node 22.13+, 24.3+ veya 26+ istiyor; tek sayılı sürümler (25 dahil) desteklenmiyor. Geliştirme makinesinde Homebrew'un Node 26 LTS'i kullanılıyor.
  - Expo SDK 58 iOS'ta Xcode 26 veya üstünü istiyor: `expo-modules-jsi` Swift 6.2 araçlarıyla derleniyor, Xcode 16.4'te Swift 6.1 var ve derleme başarısız oluyor. App Store Connect de 28 Nisan 2026'dan beri Xcode 26 ve iOS 26 SDK istiyor.
  - Geliştirme makinesinde Xcode 26.6, mevcut Xcode 16.4'ün yanına kuruldu (macOS 26.2'de çalışan en yeni sürüm; Xcode 27 macOS 26.6 istiyor). Bu proje onu komut bazında `DEVELOPER_DIR` ile seçiyor; sistemin varsayılan Xcode'u 16.4 olarak kalıyor.
  - Xcode 26, Metal araç setini ayrı bir bileşen olarak veriyor. Resizer'ın GPU kodu (`ResizerKernels.metal`) için `xcodebuild -downloadComponent MetalToolchain` gerekiyor. Bununla iOS simülatör derlemesi başarılı.
  - CocoaPods (Homebrew, Ruby 4.0) kabuk dil ayarı UTF-8 değilse `pod install` sırasında çöküyor; `LANG=en_US.UTF-8` ile çalışıyor.
  - fast-tflite'ın VisionCamera v5 örneği herkese açık değil; iki kütüphane de Nitro tabanlı olduğu için model kare işleyicide doğrudan çağrılıyor.
  - iOS'ta `metal` delegate'i derlemeye girmiyor; denenen delegate'ler iOS'ta CPU ve CoreML, Android'de CPU ve GPU.
  - VisionCamera'nın resizer paketi Android'de en az API 26 (Android 8.0) istiyor. Expo'nun varsayılanı 24 olduğu için `expo-build-properties` ile `android.minSdkVersion: 26` ayarlanıyor.
  - EfficientDet-Lite0 ve Lite2 (MediaPipe, int8) modellerinin içindeki `labels.txt`'ye göre sınıf numaraları: insan 0, araba 2, otobüs 5, kamyon 7.
  - Bu MediaPipe dosyalarında TFLite'ın tespit son işleme adımı yok. Lite0 iki ham çıkış veriyor: 19.206 çapa için 90 sınıfın skorları (`[1,19206,90]`) ve kutu kodları (`[1,19206,4]`). M1'de ya çapalar çözülüp tekrar eden kutular elenmeli (NMS) ya da son işleme adımı içeren bir model seçilmeli. Deneme uygulaması bu yüzden araç kutusu çizemedi; hız ölçümü bundan etkilenmedi.
  - Android release derlemesinde fast-tflite 3.0.1, `require(...)` ile paketlenen modeli açamıyor (`MalformedURLException: no protocol`), çünkü dosya şemasız bir kaynak adı olarak geliyor. Çözüm: model açılışta `expo-asset` ile bir dosyaya çıkarılıyor ve `{ url: 'file://...' }` olarak veriliyor.
  - Android Gradle Plugin 9, resizer paketinin Vulkan gölgelendiricisini kendiliğinden derlemiyor; resizer çalışırken `shaders/Resizer.comp.spv` bulunamıyor ve hiçbir kare işlenmiyor. Çözüm: Gradle'da `android.defaults.buildfeatures.shaders=true` ve `local.properties` içinde NDK'nın `shader-tools` klasörünü gösteren `glslc.dir`. M1'de bu ayar bir yapılandırma eklentisiyle verilmeli ve her derleme makinesinde (EAS dahil) `glslc` bulunmalı.
  - Test telefonu kablo yerine kablosuz hata ayıklamayla (Android 11 ve sonrası, eşleme kodu) bağlanabiliyor. Tecno'da iki USB kablosu veri taşımadı.

## Maske kalitesi

Task 3, galeri fotoğrafları gelince başlayacak.

## Plaka köşeleri

Task 4, galeri fotoğrafları gelince başlayacak.
