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
| Model ve delegate, iOS | Lite2 + CPU. iPhone 11'de saniyede 11 tespit (en düşük 10), telefon ısınmışken de; iPhone 16 Pro Max'te 15–16. CoreML int8 modellerde fark yaratmıyor | Task 2 |
| Model ve delegate, Android | Lite0 + GPU. Galaxy A34'te saniyede 16 (aydınlık) ve 10 (az ışık) tespit; Lite2 + GPU saniyede 7 ile hedefin altında. Düşük segment Tecno'da Lite0 saniyede 7–8 | Task 2 |
| Basit mod eşiği | Plandaki değer kalıyor: tespit hızı 3 saniye boyunca saniyede 4'ün altında kalırsa basit moda geçilir. Seçilen kombinasyonlar test telefonlarında 4'ün altına inmedi (en düşük: Tecno'da Lite0 + GPU, 5) | Task 2 |
| Ultra geniş kamerayı açmayan telefonlar | Tasarımdaki gibi dar alan modu görünmez; bu telefonlarda yalnız normal mod var. Test edilen iki Android de (Tecno, A34) bu durumda | Task 2 |

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

Task 2 tamamlandı: dört test telefonu ölçüldü. Plandaki karar kuralı orta segment Android'e ve eski iPhone'a bakıyor; model ve delegate kararları Kararlar tablosunda.

- **Test telefonları:** iPhone 11 (eski iPhone, iOS 26.6.2, Apple A13, ultra geniş kamerası var), iPhone 16 Pro Max (güncel iPhone, iOS 27.2, Apple A18 Pro), Samsung Galaxy A34 (SM-A346E; orta segment Android, Android 16, MediaTek Dimensity 1080, 8 GB RAM), Tecno CAMON 18P (CH7n; düşük segment Android, Android 12, MediaTek Helio G96, 8 GB RAM). Ultra geniş kamerası olmayan bir iPhone yok. İki Android'de de ultra geniş kamera uygulamalara açık değil, iPhone 11'de açık.
- **Sürümler (deneme uygulaması):** expo 58.0.23, react-native 0.88.1, react-native-vision-camera, -vision-camera-resizer ve -vision-camera-worklets 5.2.4, react-native-fast-tflite 3.0.1, react-native-worklets 0.13.0, react-native-nitro-modules 0.37.2, react-native-nitro-image 0.15.2.

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

### Samsung Galaxy A34 (10 Kasım 2026)

Tecno ile aynı yöntem, aynı ofis ve aynı APK.

| Işık | Model + delegate | Çıkarım medyanı | Çıkarım p90 | Tespit/sn medyanı | En düşük |
|---|---|---|---|---|---|
| Aydınlık | Lite0 + CPU | 122 ms | 123 ms | 8 | 7 |
| Aydınlık | Lite0 + GPU | 58 ms | 62 ms | 16 | 15 |
| Aydınlık | Lite2 + CPU | 392 ms | 394 ms | 3 | 2 |
| Aydınlık | Lite2 + GPU | 143 ms | 149 ms | 7 | 6 |
| Az ışık | Lite0 + CPU | 110 ms | 113 ms | 9 | 7 |
| Az ışık | Lite0 + GPU | 57 ms | 59 ms | 10 | 9 |
| Az ışık | Lite2 + CPU | 353 ms | 371 ms | 3 | 2 |
| Az ışık | Lite2 + GPU | 130 ms | 131 ms | 7 | 7 |

- **Sonuç:** Lite0 + GPU hedefin rahatça üstünde: aydınlıkta saniyede 16, az ışıkta 10 tespit. Lite2 + GPU saniyede 7 ile hedefin hemen altında kalıyor. GPU bu telefonda belirleyici: Lite0'ı 2,1 kat, Lite2'yi 2,7 kat hızlandırıyor.
- **Az ışık:** Lite0 + GPU'nun çıkarım süresi aynı kaldı (57 ms), ama tespit hızı 16'dan 10'a indi. Az ışıkta kamera kare hızını yaklaşık 10 fps'e düşürüyor; sınırı model değil kamera koyuyor.
- **CPU iş parçacığı:** fast-tflite 3.0.1 iş parçacığı sayısını ayarlamıyor; CPU süreleri iki telefonda neredeyse aynı. Kütüphaneye 4 iş parçacığı eklenmiş bir derlemeyle az ışıkta Lite0 110'dan 127 ms'ye (iyileşme yok), Lite2 353'ten 291 ms'ye (%18) gitti. Bu ölçüm sırasında termal durum 2 olduğu için sonuç kesin değil. Android'de asıl kazanç GPU'dan geliyor.
- **Isınma:** Pil 23,9 °C'den 31,7 °C'ye çıktı. Termal durum ilk 5 dakikanın sonunda 1'e (hafif), yaklaşık 20 dakikada 2'ye (orta) yükseldi; Tecno aynı sürede 0'da kalmıştı.
- **Ultra geniş kamera:** Telefonda var (kamera 50: 1,64 mm, yaklaşık 96° yatay görüş) ama Samsung onu yalnız kendi kamera uygulamasına açıyor. Uygulamalar yalnız kamera 0 (ana, 4,65 mm, yaklaşık 69°), 1 ve 2'yi (ön) görüyor; birleşik kamera 23 (0 ve 50) ve makro 54 da gizli. `minZoom` 1.
- **Odak noktası pozlamayı ölçüyor mu:** Hayır. Parlak arka plan önünde koyu bir kutu ortalandı; `focusTo` hatasız bitti, ama ortadaki parlaklık değişmedi (8,8 → 8,7). Cihaz bir pozlama bölgesini kabul ettiğini bildiriyor (`maxRegions` AE 1, donanım seviyesi LIMITED); Samsung'un kamera katmanı bölgeyi pozlamaya yansıtmıyor.
- **Fotoğraf çözünürlüğü:** 4:3 istendi, 3840×2160 (16:9) geldi. Muhtemel neden: aynı oturumdaki 1280×720'lik (16:9) kare akışı. Tecno'da aynı istek 4:3 vermişti.

### iPhone 11 (10–11 Kasım 2026)

Release derlemesi Xcode 26.6 ile imzalanıp `devicectl` ile kuruldu. Aynı ofis ve aynı yöntem (15 saniye ısınma, 60 saniye örnek); her kombinasyon uygulama yeniden açılarak başladı. Günlük satırları uygulamanın hata çıkışından `devicectl device process launch --console` ile okundu. Telefon ağ üzerinden bağlıydı, kablo takılı değildi.

| Işık | Model + delegate | Çıkarım medyanı | Çıkarım p90 | Tespit/sn medyanı | En düşük |
|---|---|---|---|---|---|
| Aydınlık | Lite0 + CPU | 24 ms | 25 ms | 30 | 29 |
| Aydınlık | Lite0 + CoreML | 28 ms | 29 ms | 30 | 29 |
| Aydınlık | Lite2 + CPU | 93 ms | 94 ms | 11 | 10 |
| Aydınlık | Lite2 + CoreML | 93 ms | 94 ms | 10,5 | 10 |
| Az ışık | Lite0 + CPU | 25 ms | 25 ms | 30 | 29 |
| Az ışık | Lite0 + CoreML | 25 ms | 25 ms | 30 | 29 |
| Az ışık | Lite2 + CPU | 90 ms | 90 ms | 11 | 10 |
| Az ışık | Lite2 + CoreML | 90 ms | 90 ms | 11 | 10 |

- **Sonuç:** Lite2 + CPU hem aydınlıkta hem az ışıkta saniyede 11 tespit veriyor, en düşük 10. Hedefi (en az 8) telefon ısınmışken bile karşılıyor. Lite0 kameranın 30 karesinin hepsini işliyor.
- **CoreML:** Fark yaratmıyor; Lite2'de CPU ile 0,1 ms'ye kadar aynı. Delegate oluşturuluyor ama int8 işlemleri almıyor, model tümüyle CPU'da çalışıyor. Neural Engine'den yararlanmak için M1'de float16 bir model denenebilir.
- **Az ışık:** Kamera kare hızını düşürmedi (30 fps); süreler aydınlıktakiyle aynı.
- **Takılma:** İşlenen kare sayısı dalgalanmadı (Lite0'da 29–30, Lite2'de 10–11). Önizlemenin akıcılığı ekrandan ayrıca kontrol edilmedi.
- **Isınma:** Telefon hızlı ısınıyor. Termal durum ilk dakikada 1'e (fair), yaklaşık 2,5 dakikada 2'ye (serious) çıktı ve ölçümün sonuna kadar 2'de kaldı; tablodaki Lite2 değerleri bu durumda alındı. İlk ölçüm telefon şarj kablosundayken ve durum baştan 2 iken yapılmıştı, daha yavaştı (Lite2 + CPU 110 ms, saniyede 9, en düşük 8).
- **Ultra geniş kamera:** Var ve uygulamalara açık. Ultra geniş ve ana kamerayı birleştiren cihazda `minZoom` 1, lens geçişi 2'de: zoom 1 ultra geniş, zoom 2 ana kamera ("1x").
- **Odak noktası pozlamayı ölçüyor mu:** Bu testte fark çıkmadı. Parlak arka plan önünde koyu bir kutu ortalandı; ortadaki 400×400 pikselin ortalama parlaklığı `focusTo`'dan önce 40,9, sonra 43,5 (karenin tamamı 112,7 → 114,3). VisionCamera iOS'ta `focusTo` ile pozlama noktasını da taşıyor, ama iOS'un varsayılan pozlama noktası zaten ekranın ortası; ortalanmış kutuyla bu test iki durumu ayıramıyor. Kutu iki fotoğrafta da karanlık kaldı: iOS'un otomatik pozlaması noktayı tek başına değil, karenin geneliyle birlikte değerlendiriyor.
- **Fotoğraf çözünürlüğü:** 1x ve ultra geniş (0,5x), ikisi de 4:3, 4032×3024 (12,2 MP), HEIC.

### iPhone 16 Pro Max (11 Kasım 2026)

iPhone 11 ile aynı yöntem ve aynı ofis; telefon ağ üzerinden bağlıydı.

| Işık | Model + delegate | Çıkarım medyanı | Çıkarım p90 | Tespit/sn medyanı | En düşük |
|---|---|---|---|---|---|
| Aydınlık | Lite0 + CPU | 18 ms | 19 ms | 52 | 47 |
| Aydınlık | Lite0 + CoreML | 19 ms | 19 ms | 51 | 47 |
| Aydınlık | Lite2 + CPU | 65 ms | 66 ms | 15 | 14 |
| Aydınlık | Lite2 + CoreML | 67 ms | 69 ms | 15 | 13 |
| Az ışık | Lite0 + CPU | 17 ms | 17 ms | 55 | 49 |
| Az ışık | Lite0 + CoreML | 20 ms | 23 ms | 48 | 30 |
| Az ışık | Lite2 + CPU | 62 ms | 64 ms | 16 | 14 |
| Az ışık | Lite2 + CoreML | 60 ms | 62 ms | 16 | 15 |

- **Sonuç:** Bütün kombinasyonlar hedefin çok üstünde. Lite2 + CPU saniyede 15–16 tespit veriyor (en düşük 14), iPhone 11'den yaklaşık 1,4 kat hızlı. Kamera saniyede 60 kare veriyor; Lite0 bunun 52–55'ini işliyor.
- **CoreML:** Yine fark yaratmıyor; az ışıkta Lite0'da biraz yavaş ve dalgalı (en düşük 30).
- **Az ışık:** Kamera kare hızını düşürmedi; süreler aydınlıktakiyle aynı.
- **Isınma:** Telefon ölçümlere termal durum 2'de (serious) başladı ve 2'de kaldı; hemen önce Geliştirici Modu için yeniden başlatılmış ve kabloya bağlı kalmıştı. Tablodaki değerler ısınmış telefondan.
- **Ultra geniş kamera:** Var ve uygulamalara açık. Ultra geniş ve ana kamerayı birleştiren cihaz iPhone 11'dekiyle aynı: `minZoom` 1, lens geçişi 2.
- **Odak noktası pozlamayı ölçüyor mu:** Denenmedi; iOS'ta ortalanmış kutuyla yapılan test bunu ayırt edemiyor (iPhone 11'e bakın).
- **Fotoğraf çözünürlüğü:** 1x ve 0,5x, ikisi de 4:3, 4032×3024 (12,2 MP), HEIC. Ana sensör 48 MP olsa da `UHD_4_3` hedefi 12 MP fotoğraf veriyor.
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
  - Samsung'da uygulama adb ile güncellenirken Google Play Protect onay penceresi çıkıyor; kurulum telefonda seçim yapılana kadar bekliyor.
  - Fotoğrafın en-boy oranı cihaza göre değişebiliyor: A34 aynı oturumda 4:3 yerine 16:9 verdi. M1'de çekim oturumu her cihazda 4:3 fotoğraf verecek şekilde doğrulanmalı (örneğin kare akışını da 4:3 seçerek).
  - Odak noktasıyla pozlama ölçümü her cihazda çalışmıyor (A34'te etkisiz). Araç üzerinde doğru pozlama gerekiyorsa M1'de pozlama telafisi gibi bir yol cihaz bazında denenmeli.
  - VisionCamera v5'te zoom değerleri cihazın kendi çarpanları. iPhone'da ultra geniş ve ana kamerayı birleştiren cihazda 1 ultra geniş kamerayı açıyor; ana kamera ilk lens geçiş değerinde (2). Android'de ana kamera 1. Normal modun zoom'u `zoomLensSwitchFactors[0] ?? 1` gibi seçilmeli; doğrudan `zoom={1}` iPhone'da ultra geniş kamerayı açar.
  - iOS release derlemesinde `console.log` görünmüyor: React Native release'te günlük eşiği hata seviyesinde ve çıktı yalnız sistem günlüğüne gidiyor. Ölçüm için deneme uygulamasının `AppDelegate.swift` dosyasına `RCTSetLogThreshold(.info)` ve satırları termal durumla stderr'e yazan bir günlük fonksiyonu eklendi.
  - iPhone, Mac ile bir kez kabloyla eşleştikten sonra aynı ağ üzerinden `devicectl` ile kurulup açılabiliyor. İmza için geliştirici hesabı Xcode'a eklenip ekip projede seçiliyor; komut satırı derlemesi `-allowProvisioningUpdates` ile profili kendisi oluşturuyor, `-allowProvisioningDeviceRegistration` ile yeni telefonu ekibe ekliyor.
  - Xcode 26.6 (iOS 26 SDK) ile derlenen uygulama iOS 27.2'deki iPhone 16 Pro Max'e kuruldu; geliştirici servisleri (uygulamayı açma, günlük okuma) de çalıştı.
  - iPhone 11 sürekli kamera ve tespitle 2–3 dakikada termal durum 2'ye çıkıyor. M1'de tespit hızı gerekenle sınırlanmalı (örneğin saniyede 10) ve çekimler arasında tespit durdurulmalı.

## Maske kalitesi

Task 3, galeri fotoğrafları gelince başlayacak.

## Plaka köşeleri

Task 4, galeri fotoğrafları gelince başlayacak.
