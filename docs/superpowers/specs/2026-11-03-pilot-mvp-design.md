# bambu-car-app: Pilot Sürüm Tasarımı (Faz 1–2)

- **Tarih:** 2026-11-03
- **Durum:** Taslak, onay bekliyor
- **Kaynaklar:** `Arac_Fotograflama_Platformu.pdf` (Ekim 2026, 31 sayfa; metinde "doküman X.Y" olarak geçer) ve planlama konuşması
- **Etiketler:** **[Karar]** kullanıcının verdiği karar · **[Öneri]** Claude'un kararı, itiraz edilmediği sürece geçerli

## 1. Amaç

Galeriler araçlarını satışa hazırlarken fotoğrafları uzman fotoğrafçı ve düzenleme bilgisi olmadan, her araçta aynı standartta çekebilsin. Uygulama çekimi açı açı yönlendirir. Ardından fotoğrafların arka planını değiştirir, plakanın üstüne galerinin banner'ını oturtur ve filigranı ekler. Sonuç, galerinin ilan sitelerinde doğrudan kullanabileceği bir fotoğraf setidir.

Çekim için uygun ortam beklenmez **[Karar]**. Sabit bir çekim alanı yoktur; araç açık veya kapalı alanda, güneşli, bulutlu ya da yağmurlu havada çekilebilir. Ortam farkını arka plan değişimi, standart kadraj ve ton düzeltmesi kapatır; sınırları 6.3 ve 14'te.

Bu sürümün işi, bu çekirdeği Almanya'daki pilot galeride gerçek stok araçlarıyla kanıtlamak.

**Başarı ölçütü [Öneri]:**

- Pilot galeri personeli bir aracın tüm zorunlu fotoğraflarını tek turda, araca geri dönmeden çekebiliyor.
- İşlenmiş setler düzeltme yapılmadan ilanlarda kullanılıyor.
- Farklı yerlerde ve havalarda çekilmiş setler yan yana konduğunda aynı stüdyo görünümünde duruyor.
- Aracın görünümünün değiştiği tek bir sonuç bile çıkmıyor.

## 2. Kapsam

### 2.1 Bu sürümde (Faz 1–2) [Karar]

1. Davetle giriş, galeri hesabı ve galeri ayarları (logo, plaka banner'ı, filigran, varsayılan arka plan)
2. Araç kaydı: çekime başlamak için asgari bilgi, ayrıntılar sonra
3. Yönlendirmeli çekim: şablon, canlı yönlendirme, otomatik çekim, anlık kalite kontrolü, eksik açı kontrolü
4. İnternetsiz çekim ve sonradan yükleme
5. AI stüdyo: arka plan değiştirme, zemin gölgesi, ton düzeltme, plakaya banner, filigran, toplu işleme, önce/sonra karşılaştırma
6. Otomatik sıralama ve kapak fotoğrafı
7. Araç ayrıntıları, hasar şeması, ekspertiz raporundan alan okuma
8. AI ile ilan başlığı ve açıklaması
9. Kredi defteri (1 kredi = 1 araç)
10. Dışa aktarma: telefona kaydetme, paylaşma, bilgisayar için indirme linki

### 2.2 Bu sürümde yok

- Harici ilan entegrasyonları (mobile.de, AutoScout24, sahibinden, arabam.com) ve kendi pazar yerimiz **[Karar]**
- Herkese açık kayıt, uygulama içi ödeme, kredi paketi satışı **[Karar]**: ilk sürüm sadece pilot galeri için, paketler sonra belirlenecek
- Gelişmiş stok, ekip ve rapor özellikleri; sosyal medya içerikleri, video, 360° görüntüleme (doküman Faz 4 ve vizyon)
- Web admin paneli; pilotta Supabase paneli kullanılır, bkz. 11.1 **[Öneri]**
- Modele özel çekim şablonları; pilot kasa tipi şablonlarıyla başlar **[Öneri]**
- Otomatik açı doğrulama modeli, yansıma giderme, AI ile yeniden ışıklandırma **[Öneri]**
- Galerinin kendi showroom'una perspektif ve ışık eşleştirmesiyle yerleştirme **[Karar]** ve uygulamadan arka plan yükleme **[Öneri]**; pilotta hazır arka plan kütüphanesi kullanılır (bkz. 7.2)

### 2.3 Başarısızlık sayılacaklar

- Aracın şeklini, rengini, jantını, farlarını, hasarlarını veya donanımını değiştiren herhangi bir işlem (doküman 4.3)
- İlan metnine kayıtlı ve onaylı olmayan bir özelliğin yazılması (doküman 6.3)
- Plaka bulunamadığında veya tespit güveni düşükken fotoğrafın uyarı gösterilmeden dışarı verilmesi **[Öneri]**
- İyi sonuç için belirli bir hava, ışık veya mekânın beklenmesinin gerekmesi **[Karar]**
- Teknolojiye uzak galeri personelinin yardım almadan kullanamayacağı bir arayüz (doküman 14)
- Hazır şablon görünümlü, özensiz arayüz **[Karar: /no-slop-ui]**

## 3. Kısıtlar

- **Ekip:** Tek geliştirici. Unity/C# geçmişi var; uygulama Unity ile yapılmayacak **[Karar]**. Bu yüzden az sayıda servis, yönetilen altyapı ve tek ana dil (TypeScript) seçildi **[Öneri]**.
- **Takvim:** Uygulama en kısa sürede çıkacak **[Karar]**.
- **Pilot:** Bambu Games'in Almanya'daki müşterisi olan bir galeri **[Karar]**. Arayüz Almanca olmalı, ilan metni varsayılan olarak Almanca üretilir.
- **Yayıncı:** Mağazalarda geliştirici olarak Bambu Games hesabı görünür **[Karar]**.
- **Platform:** iOS ve Android, ilk pilot sürümden itibaren birlikte **[Karar]**. Personel hangi telefonu kullanıyorsa onunla çeker; bu yüzden ultra geniş kamerası olmayan ve düşük segment telefonlar da desteklenir **[Öneri]**.
- **Çekim ortamı:** Kontrol edilmez, sabit bir çekim alanı yoktur **[Karar]** (bkz. 1).
- **Hesaplar:** Supabase, Google Cloud, Photoroom, Anthropic, Sentry ve Expo hesaplarını kullanıcı Bambu Games adına açar.
- **Veri:** Türkiye'de tutma şartı yok **[Karar]**. Pilot AB'de olduğu için GDPR geçerli ve veriler AB'de tutulur **[Öneri]**.
- **Bütçe:** Belirlenmedi, maliyet araştırmayla netleşecek **[Karar]**. Tahmin bölüm 13'te.
- **Marka:** Henüz yok, çalışma adı bambu-car-app **[Karar]**. Mağaza kimliği (bundle ID) yayından sonra değiştirilemediği için markadan bağımsız seçilir, örneğin `com.bambugames.carapp`. Görünen ad ve ikon marka kesinleşince değişir **[Öneri]**.
- **AI:** Hem API'ler hem eğitilmiş modellerle çalışılacak **[Karar]**. Pilot API'ler ve hazır modellerle başlar; kendi modellerimiz pilotta biriken veriyle sonra eğitilir (bkz. 7.6) **[Öneri]**.
- **Referans:** autofox.ai benzer bir ürün, ama referans alınmayacak **[Karar]**.
- **Repo:** github.com/BambuGames/bambu-car-app (private) **[Karar]**.

## 4. Kullanıcılar ve roller [Öneri]

| Rol | Ne yapar |
|---|---|
| Platform yöneticisi (Bambu Games) | Galeri ve kullanıcı açar, kredi yükler ve iade eder, hataları izler. Pilotta bunları Supabase panelinden yapar. |
| Galeri yöneticisi | Galeri ayarlarını ve personeli yönetir, bakiyeyi ve kredi geçmişini görür. Personelin yaptığı her şeyi de yapabilir. |
| Galeri personeli | Araç açar, çeker, işler, bilgileri doldurur, dışa aktarır. |

- Giriş e-posta ve şifreyle yapılır. Hesaplar Supabase'in davet e-postasıyla açılır; uygulamada kayıt ekranı yoktur.
- Uygulamada "hesabımı sil" seçeneği bulunur (GDPR ve Apple kuralı).
- Dokümandaki ayrıntılı personel rolleri (fotoğrafçı, ilan hazırlayıcı, muhasebe) Faz 4'te.

## 5. Ana akış

1. Personel giriş yapar ve araç listesini durumlarıyla birlikte görür.
2. "Yeni araç" ile marka, model ve kasa tipini seçer. Kasa tipi çekim şablonunu belirler; diğer alanlar sonra doldurulur.
3. Çekim ekranı çekim listesini adım adım gösterir. Her dış açıda silüet ve canlı yönlendirme vardır; her şey tuttuğunda fotoğraf otomatik çekilir. Çekimden hemen sonra kalite kontrolü yapılır.
4. Çekim bitirilirken eksik zorunlu açılar listelenir.
5. Fotoğraflar yüklenir; internet yoksa bağlantı gelince yüklenir.
6. Stüdyoda arka plan seçilir (galerinin varsayılanı seçili gelir) ve "İşle"ye basılır. İlk işlemede 1 kredi düşer. İlerleme canlı görünür. Sonuç ekranında önce/sonra karşılaştırma, plaka banner'ını düzeltme ve tek fotoğrafı yeniden çekme vardır.
7. Ayrıntılar ekranında araç bilgileri ve hasar şeması doldurulur. İstenirse ekspertiz raporu yüklenir ve AI'ın önerdiği alanlar onaylanır.
8. İlan metni ekranında AI başlık ve açıklama üretir; kullanıcı hazır komutlarla düzenleyip kopyalar.
9. Dışa aktarma ekranından fotoğraflar telefona kaydedilir, paylaşılır veya bilgisayar için indirme linki oluşturulur.

## 6. Yönlendirmeli çekim

### 6.1 Çekim listesi

- **Zorunlu dış açılar (8):** ön sol 45°, ön, ön sağ 45°, sağ yan, arka sağ 45°, arka, arka sol 45°, sol yan (doküman 3.2, 1–8). Liste aracın etrafında yürüme sırasına göre ilerler **[Öneri]**.
- **İsteğe bağlı dış detaylar:** jant ve lastik, farlar, stoplar, açık bagaj, motor bölmesi, tavan veya sunroof, diğer (doküman 3.2, 9–14).
- **İsteğe bağlı iç mekân:** kokpit, orta konsol ve multimedya, direksiyon ve gösterge, ön koltuklar, arka koltuklar, kapı içi, bagaj içi, tavan döşemesi, diğer (doküman 3.3).
- Her adımda tek fotoğraf çekilir; yeniden çekim eskisinin yerine geçer **[Öneri]**.
- İlandaki sıra dokümandaki gibi sabittir: ön çapraz, ön, yan, arka, iç, detay (doküman 12.2). Kapak varsayılan olarak ön sol 45°'dir ve kullanıcı değiştirebilir. Her fotoğraf bir çekim adımına bağlı olduğu için sıralamaya AI gerekmez **[Öneri]**.

### 6.2 Şablonlar [Öneri]

- Her kasa tipi, dış açı ve kamera modu (normal veya dar alan, bkz. 6.3) için bir şablon vardır: silüet (SVG), aracın kadrajda durması gereken kutu, telefonun hedef eğimi ve toleranslar.
- **Pilottaki kasa tipleri:** sedan (Limousine), Kombi, SUV, hatchback. Diğer kasa tipleri için genel bir kutu çerçevesi kullanılır. Liste pilot galerinin stoğuna göre genişler.
- **Üretim:** Markasız ve ticari kullanıma uygun lisanslı (örneğin CC0) 3D araç modellerinden Blender veya Unity'de render alınır. Kamera yaklaşık 1 m yüksekliğe konur ve her açı iki kez render alınır: ana kameranın görüş açısıyla (normal) ve ultra geniş kameranın görüş açısıyla, araca daha yakından (dar alan). Silüet çıkarılıp SVG'ye çevrilir. Böylece her açı tam olarak aynı kamera ayarıyla tanımlanmış olur.
- Şablonlar uygulamanın içinde gelir (internetsiz çalışır) ve OTA güncellemeyle yenilenir.
- Şablon model → kasa tipi → genel sırasıyla seçilir. Böylece modele özel şablon eklemek sonradan sadece veri eklemek olur.
- Detay ve iç mekân adımlarında silüet yoktur; bunun yerine örnek fotoğraf, kısa talimat, hiza ve bulanıklık kontrolü vardır.

### 6.3 Canlı yönlendirme [Öneri, doküman 3.4]

- Dış fotoğraflar yatay ve 4:3 oranında, varsayılan olarak telefonun ana (1x) kamerasıyla çekilir. Aracı yandan veya çaprazdan çekmek için yaklaşık 4–5 m boşluk gerekir.
- **Dar alan modu:** Yer darsa ultra geniş kamera (0.5x) kullanılır ve gereken boşluk yaklaşık 2–2,5 m'ye iner. Kullanıcı araca fazla yakın kalıp uzaklaşamıyorsa uygulama bu modu önerir. Perspektif daha belirgin olduğu için varsayılan değildir. Ultra geniş kamerası olmayan veya bunu uygulamalara açmayan telefonlarda bu mod görünmez.
- Bu boşluk da yoksa (örneğin araç başka araçların arasına sıkışık park edilmişse) yan ve çapraz açılar çekilemez. Uygulama bunu açıkça söyler; araç kadraja sığacağı bir yere alınmalıdır. Hava, ışık ve mekân fark etmez; tek fiziksel şart aracın kadraja sığması ve önünün açık olmasıdır.
- Silüet cihazın görüş açısına göre ölçeklenir; böylece farklı telefonlarda aynı kadraj elde edilir.

| Kontrol | Nasıl | Mesaj örneği |
|---|---|---|
| Yatay ve dikey hiza | Hareket sensörleri | "Telefonu düz tutun" |
| Konum ve mesafe | Cihaz üstünde araç tespiti (COCO veri setiyle eğitilmiş, Apache 2.0 lisanslı hafif bir model, örneğin EfficientDet-Lite; car ve truck sınıfları) ve hedef kutuyla kıyas | "Yaklaşın", "Biraz sola" |
| Yükseklik | Telefon düzken aracın kadrajdaki dikey konumu | "Telefonu biraz indirin" |
| Engel | Aynı modelin car, truck ve person sonuçları: başka bir araç veya kişi hedef aracın kutusuyla çakışıyor mu | (uyarı; kişi varsa çekimi bekletir) |
| Işık | Görüntü parlaklığı. Pozlama aracın üzerinden ölçülür; böylece arkadan gelen ışıkta araç kararmaz | "Işık yetersiz" |
| Sabitlik | Jiroskop | (mesaj yok, sadece çekimi bekletir) |

- Hiza, konum, yükseklik ve sabitlik yaklaşık yarım saniye tolerans içinde kalınca silüet yeşile döner ve fotoğraf otomatik çekilir. Otomatik çekim varsayılan olarak açıktır; yağmurda veya tek elle çekerken ekrana dokunmak gerekmez.
- Işık ve araç engeli sadece uyarıdır, çekimi durdurmaz; kullanıcı ortamı her zaman değiştiremez. Kadrajda araca değen bir kişi varsa otomatik çekim bekler.
- Flaş kullanılmaz; boyada parlama yapar.
- **Basit mod:** Araç tespitini yeterli hızda çalıştıramayan telefonlarda konum, mesafe, yükseklik ve engel kontrolleri kapanır. Silüet, hiza ve sabitlik çalışmaya devam eder, çekim elle yapılır. Çekim sonrası kalite kontrolü (6.4) her telefonda çalışır.
- Fotoğrafın doğru açıdan (45° mi, 90° mi) çekilip çekilmediği pilotta kullanıcının silüeti eşlemesine bağlıdır. Bunu otomatik doğrulayan model sonraya kalır.
- Çekim anındaki telefon eğimi, kamera modu ve hedef aracın kutusu fotoğrafla birlikte kaydedilir. İşlemede ufku düzeltmek ve maskeyi hedef araçla sınırlamak için kullanılır.

### 6.4 Anlık kalite kontrolü [Öneri, doküman 11]

- Çekimden hemen sonra cihazda kontrol edilir: bulanıklık, karanlık, ışık patlaması, aracın kadraj kenarından taşması.
- Sorun varsa "yeniden çekin" önerilir; kullanıcı yine de fotoğrafı kabul edebilir.
- Çekim bitirilirken eksik zorunlu açılar adıyla gösterilir, örneğin "Sol yan fotoğrafı eksik". Eksik açı işlemeyi engellemez; açı sonra eklenebilir ve ek kredi istemez (bkz. 9).

### 6.5 İnternetsiz çalışma [Öneri, doküman 15]

- Araç kaydı ve çekim internetsiz çalışır. Veriler cihazda tutulur ve bağlantı gelince yüklenir. Yükleme durumu görünür; başarısız yüklemeler yeniden denenir.
- Pilotta yükleme uygulama açıkken yapılır ve uygulama yeniden açılınca kaldığı yerden devam eder. Uygulama kapalıyken arka planda yükleme sonraya kalır.
- İşleme ve AI metin internet gerektirir.

## 7. AI stüdyo

### 7.1 Temel ilke [Öneri, doküman 4.3]

Aracın pikselleri hiçbir aşamada yeniden üretilmez. Araç sadece arka plandan ayrılır, ölçeklenir ve konumlanır; üzerine sadece sınırlı güçte ton düzeltmesi yapılır (bkz. 7.2). Görüntü üreten AI bu sürümde hiç kullanılmaz. Orijinal fotoğraf her zaman saklanır ve önce/sonra karşılaştırılabilir.

### 7.2 Dış açılar için işlem sırası

1. **Plaka tespiti:** Plakanın dört köşesi bulunur. Model erken denemeyle seçilir (bölüm 14) ve lisansı ticari kullanıma uygun olmalıdır. AGPL lisanslı Ultralytics YOLO kullanılmaz.
2. **Araç maskesi:** Görüntü Photoroom Remove Background API'ye gönderilir ($0.02/görsel). Bulunan bütün plakalar göndermeden önce kapatılır; hangisinin hedef araca ait olduğu ancak maskeden anlaşılır (M0 kararı, 12 Kasım 2026). Plaka bulunamadıysa görüntü olduğu gibi gider. Bu bir garanti değil, en iyi çaba ilkesidir; Photoroom zaten veri işleme sözleşmesi kapsamında bir alt işleyendir **[Öneri]**. Maske saklanır; arka plan veya filigran değişince tekrar API çağrısı yapılmaz. Kadrajda başka araç veya kişi varsa maskeden yalnız çekimde kaydedilen hedef aracın kutusuna değen parçalar tutulur; kutuya kırpılmaz, çünkü tespit kutusu aracın uçlarını ve antenini çoğu zaman dışarıda bırakır. Kutu yoksa (basit mod) merkezdeki en büyük parça tutulur (bkz. 14; M0 kararı, 12 Kasım 2026).
3. **Rötuş:** Maskede kalan yabancı parçayı (bitişik araç, tabela, kablo) personel işlenmiş fotoğrafta dokunarak ya da üstünü silerek kaldırır. Silmeler saklanır ve her çizimde saklı maskeye yeniden uygulanır; API'ye yeniden gidilmez (M0 kararı, 12 Kasım 2026).
4. **Hiza ve kadraj:** Kayıtlı eğime göre ufuk düzeltilir. Araç her fotoğrafta şablonun tanımladığı konum ve boyuta yerleştirilir; dar alan modunda çekilenler de normal modun kutusuna (M2a planı); böylece hem set hem galerinin tüm ilanları tutarlı görünür.
5. **Arka plan:** Hazır kütüphaneden seçilir: kesintisiz stüdyolar (beyaz, açık gri, koyu) ve modern galeri iç mekânı, showroom gibi hazır görseller **[Karar: başlangıçta hazır şablon ve görseller]**. Görseller şablonlarla aynı kamera yüksekliği ve eğimiyle hazırlanır, örneğin 3D sahnelerden render alınarak; böylece araç zemine doğru ölçekte oturur. Galeri kendi görselini kullanmak isterse Bambu Games onu bu kurala göre hazırlayıp galerinin kütüphanesine ekler; uygulamada arka plan yükleme yoktur **[Öneri]**.
6. **Zemin gölgesi:** Maskeden üretilen sentetik bir temas gölgesi eklenir.
7. **Ton düzeltme:** Aynı araç setin her fotoğrafında aynı görünmelidir; oysa tek bir turda bile aracın bir yüzü güneşte, öbürü gölgede kalabilir. Bu yüzden her fotoğrafta aracın parlaklığı ve renk sıcaklığı, setin ortalamasına doğru klasik algoritmalarla ve sınırlı güçte yaklaştırılır. Hedef sabit bir değer değil setin kendisidir; böylece siyah araç siyah, kırmızı araç kırmızı kalır. Kullanıcı bunu kapatabilir **[Öneri]**.
8. **Plaka banner'ı:** Galerinin banner görseli, bulunan dört köşeye perspektif dönüşümüyle (homografi) oturtulur **[Karar: banner plakanın üstünde]**.
9. **Filigran:** Logo konumu, boyutu ve saydamlığı ayarlanır; isteğe bağlı üst veya alt kurumsal bant eklenir (doküman 5).
10. **Çıktı:** JPEG, 4:3, uzun kenar 2560 px. Filigranlı ve filigransız iki sürüm üretilir **[Öneri]**.

### 7.3 Detay ve iç mekân fotoğrafları [Öneri]

Arka plan değişmez. Ton düzeltmesi ve filigran uygulanır. Plaka görünüyorsa (örneğin stop detayında) banner da uygulanır.

### 7.4 Plaka bulunamazsa veya banner yanlış yere oturursa [Öneri]

Plaka bulunamazsa veya tespit güveni düşükse fotoğraf "plaka kontrolü gerekiyor" olarak işaretlenir. Kullanıcı banner'ın dört köşesini sürükleyerek yerleştirir veya "plaka görünmüyor" der. İşaretli bir fotoğraf bu adım yapılmadan dışarı verilmek istenirse uyarı gösterilir.

Tespitin yanlış yere oturttuğu bir banner'ı sistem fark edemez. Bu yüzden sonuç ekranında banner yerleştirilen fotoğraflar hızlı kontrol için öne çıkarılır ve yanlış yerleşim aynı ekrandan düzeltilir. Pilotta güvene göre ayırma yapılmaz: M0'da güvenilir bir eşik bulunamadığı için her banner yerleşimi hızlı kontrolden geçer (M0 kararı, 12 Kasım 2026).

Yan açılarda, detay ve iç mekân fotoğraflarında plaka bulunamazsa fotoğraf işaretlenmez; bu açılarda plaka çoğu zaman görünmez.

### 7.5 Toplu ve yeniden işleme [Öneri, doküman 4.4]

- Bir aracın tüm fotoğrafları tek seferde işlenir.
- Arka plan veya filigran değişirse set yeniden işlenir. Maskeler saklı olduğu için bunun ek API maliyeti yoktur.
- Tek bir fotoğraf yeniden çekilirse sadece o fotoğraf işlenir.

### 7.6 Eğitilmiş modeller için veri [Öneri]

Her fotoğraf çekim adımıyla etiketli saklandığı için pilot süresince açı ve plaka modellerini eğitmeye uygun etiketli veri birikir. Bu veriyi model eğitiminde kullanmak için galeriyle yapılacak sözleşmede açık izin gerekir.

## 8. Araç bilgileri ve ilan metni

### 8.1 Alanlar [Öneri]

- **Çekime başlamak için zorunlu:** marka, model, kasa tipi.
- **Diğer alanlar (Alman ilan pratiğine göre):** model varyantı ve donanım paketi, ilk tescil (ay/yıl), kilometre, yakıt, vites, güç (kW/PS), motor hacmi, çekiş, dış renk, iç renk ve döşeme, önceki sahip sayısı, TÜV/HU geçerlilik tarihi, kaza durumu (unfallfrei), servis defteri (Scheckheft), sigara içilmemiş araç, garanti, fiyat (EUR), KDV gösterilebilir mi (MwSt. ausweisbar), konum, donanım listesi, şasi numarası (FIN), notlar.
- Alan adları ve değer listeleri mobile.de'nin veri yapısına uygun seçilir; böylece ileride entegrasyon kolaylaşır. Türkiye'ye özel alanlar (Tramer gibi) sonra eklenir.
- Marka ve model listesi veritabanında hazır gelir; listede olmayanlar serbest metinle girilir.

### 8.2 Hasar şeması (doküman 2.2)

Kaporta şemasında parçaya dokunulup durumu seçilir: orijinal, boyalı, lokal boyalı, değişen, hasarlı. Bu bilgiler ilan metnine aktarılır.

### 8.3 Ekspertiz raporu (doküman 2.2)

PDF veya fotoğraf yüklenir. Claude alanları doldurmayı önerir, kullanıcı tek tek onaylar. Onaylanmayan bilgi kaydedilmez.

Rapor Claude'a olduğu gibi gönderilir. Alman ekspertiz raporlarında (TÜV/HU, DEKRA, GTÜ) şasi numarası ve plaka yazdığı için 8.4'teki kural rapor okumayı kapsamaz. Yükleme ekranında raporun işlenmek üzere gönderileceği söylenir **[Öneri]**.

### 8.4 İlan metni (doküman 6)

- Claude API kullanılır, varsayılan model `claude-opus-5-5` **[Öneri]**. Daha ucuz bir modele geçmek kullanıcının kararıdır (bkz. bölüm 13).
- Sadece kayıtlı ve onaylı alanlar kullanılır; araçta olmayan donanım yazılmaz.
- Birkaç başlık alternatifi ve bölümlere ayrılmış bir açıklama üretilir. Dil seçilebilir: Almanca (varsayılan), Türkçe, İngilizce.
- Hazır komutlar: kısalt, daha profesyonel yaz, donanımı öne çıkar, sadeleştir, çevir.
- İlan metni üretilirken şasi numarası ve plaka Claude'a gönderilmez **[Öneri]**.
- Metin kopyalanarak kullanılır; herhangi bir siteye entegrasyon yoktur.

## 9. Kredi sistemi

- **1 kredi = 1 araç** **[Karar]**. Paket içerikleri ve satışı sonra belirlenecek **[Karar]**.
- Kredi, aracın fotoğrafları ilk kez işlenirken düşer. Aynı araçta yeniden işleme, yeniden çekim, ilan metni ve ekspertiz okuma ek kredi istemez **[Öneri]**.
- Tek bir araç kaydının başka araçlar için kullanılmaması için araç başına üst sınır vardır, örneğin en fazla 40 fotoğraf **[Öneri]**.
- Bakiye bitince çekim yine yapılabilir ama işleme başlatılamaz. Kullanıcıya "Krediniz bitti, galeri yöneticinizle iletişime geçin" mesajı gösterilir **[Öneri]**.
- Krediler bir hareket defterinde tutulur: yükleme, harcama, iade. Bakiye bu defterden hesaplanır. Aynı araçtan iki kez kredi düşmesi veritabanı kısıtıyla engellenir **[Öneri]**.
- Pilotta krediyi Bambu Games elle yükler. İşleme tamamen başarısız olursa krediyi de elle iade eder **[Öneri]**.
- Galeri yöneticisi uygulamada bakiyeyi ve hareket geçmişini görür (doküman 9.3).

## 10. Dışa aktarma

- Fotoğraflar uygulamada araç bazında saklanır. Galeri onları indirip istediği platformda kullanır **[Karar]**.
- Dışa aktarma seçenekleri **[Öneri]**:
  - Telefon galerisine kaydetme (tümü veya seçili fotoğraflar)
  - Paylaşma menüsü (AirDrop, e-posta, bulut sürücüler vb.)
  - Bilgisayarda açılınca tüm seti ZIP olarak indiren süreli bir link
- Filigranlı veya filigransız sürüm seçilebilir. Dosyalar ilan sırasıyla adlandırılır (`01_...jpg`). Orijinaller de ayrıca indirilebilir **[Öneri]**.

## 11. Teknik mimari

### 11.1 Bileşenler [Öneri]

| Bileşen | Teknoloji | Not |
|---|---|---|
| Mobil uygulama | React Native + Expo (dev build), TypeScript, Expo Router | Kamera: react-native-vision-camera; cihaz üstü model: react-native-fast-tflite; çizim: react-native-skia; sensörler: expo-sensors; yerel veri: expo-sqlite; diller: i18next (DE/TR/EN) |
| Backend | Supabase (Frankfurt) | Postgres ve satır bazlı yetki (galeri izolasyonu), Auth, Storage, Realtime, Edge Functions (TypeScript) |
| Görüntü işleme servisi | Python (OpenCV, Pillow), Docker, Google Cloud Run (Frankfurt) | Sıfıra ölçeklenir, kullandıkça ödenir. Eşdeğer seçenek: Fly.io Frankfurt |
| Dış servisler | Photoroom Remove Background API, Anthropic Claude API | Anahtarlar sadece sunucu tarafında tutulur |
| Yönetim | Supabase paneli ve birkaç SQL fonksiyonu (galeri açma, kredi yükleme, iade) | Web admin paneli (Next.js), ikinci galeri veya paket satışı gündeme gelince yapılır |
| Hata takibi | Sentry (AB veri bölgesi) | Mobil uygulama ve işleme servisi |
| Derleme ve dağıtım | EAS Build (veya yerel derleme), EAS Update (OTA) | Pilot TestFlight ve Google Play kapalı test kanalıyla dağıtılır; genel mağaza yayını pilot sonrası |

### 11.2 Veri modeli taslağı [Öneri]

- `galleries`: ad, logo, plaka banner'ı, filigran ayarları, varsayılan arka plan
- `gallery_members`: galeri, kullanıcı, rol (`owner` veya `staff`)
- `vehicles`: galeri, marka, model, kasa tipi, durum, ayrıntılar (jsonb), hasar şeması (jsonb), kapak fotoğrafı, kredinin düştüğü zaman
- `photos`: araç, çekim adımı, dosya yolları (orijinal, maske, çıktı, filigranlı çıktı), çekim bilgisi (eğim, cihaz, kamera modu, görüş açısı, hedef aracın kutusu), kalite sonuçları, plaka köşeleri ve durumu, işlem durumu, hata
- `credit_ledger`: galeri, miktar (+/−), sebep (`grant`, `vehicle` veya `refund`), araç, işlemi yapan, not. Araç başına tek `vehicle` kaydı bulunur (benzersizlik kısıtı).
- `listing_texts`: araç, dil, başlık, açıklama
- `backgrounds`: platforma veya galeriye ait arka planlar
- `makes`, `models`: hazır marka ve model listesi
- Araç durumları: taslak → çekimde → işleniyor → hazır → arşiv (doküman 10.1'in sadeleştirilmiş hali)
- Çekim şablonları veritabanında değil, uygulamanın içinde tutulur (JSON ve SVG).

### 11.3 İşleme akışı [Öneri]

1. Uygulama orijinal fotoğrafları Storage'a yükler.
2. Kullanıcı "İşle"ye basınca Edge Function yetkiyi kontrol eder, krediyi tek bir veritabanı işleminde (transaction) düşer, her fotoğraf için bir iş kaydı açar ve işleme servisini çağırır.
3. Servis sonuçları Storage'a yazar ve durumu veritabanında günceller.
4. Uygulama ilerlemeyi Realtime üzerinden canlı görür.
5. Başarısız bir iş, fotoğrafın üzerinde hata olarak görünür ve yeniden denenebilir.

### 11.4 Repo düzeni [Öneri]

```
apps/mobile/            Expo uygulaması (şablonlar assets altında)
services/image-worker/  Python işleme servisi
supabase/               migration'lar, edge function'lar, seed
tools/templates/        şablon üretim dosyaları (3D sahne, render ve SVG dönüşüm betikleri)
docs/
```

Monorepo aracı kullanılmaz; ortak tipler Supabase'in ürettiği tip dosyasından gelir.

## 12. Hukuk ve gizlilik (pilot için asgari) [Öneri]

Bu bölüm hukuki görüş değildir; yayından önce bir uzmanla kontrol edilmelidir.

- Veriler AB'de tutulur: Supabase ve Cloud Run Frankfurt'ta.
- Galeriyle bir veri işleme sözleşmesi (AVV) yapılır. Bambu Games adına uygulama içinde ve mağaza sayfasında gizlilik metni (Datenschutzerklärung) ve künye (Impressum) bulunur.
- Alt işleyenler: Supabase, Google Cloud, Photoroom (Fransa), Anthropic (ABD; veri işleme sözleşmesi, mümkünse AB çıkarım bölgesi), Sentry (AB bölgesi).
- Plaka otomatik bulunduysa Photoroom'a kapatılmış olarak gider (en iyi çaba, bkz. 7.2). İlan metni üretiminde Claude'a şasi numarası ve plaka gitmez; ekspertiz raporları ise olduğu gibi gönderilir (bkz. 8.3).
- Galeri fotoğraflarının model eğitiminde kullanılması sözleşmede ayrıca izin gerektirir.
- AB'de App Store yayını için Bambu Games'in satıcı (trader) bilgisinin App Store Connect'te tanımlı olması gerekir.

## 13. Maliyet tahmini (pilot)

Fiyatlar liste fiyatlarıdır; hesap açarken doğrulanmalıdır.

| Kalem | Birim fiyat | Araç başı | Ayda 100 araç |
|---|---|---|---|
| Photoroom maske | $0.02 / görsel | ~$0.20 (8–10 dış fotoğraf) | ~$20 |
| Claude, ilan metni (Opus 5.5: girdi $4, çıktı $20 / milyon token) | üretim başına ~$0.04 | ~$0.15 (3–4 üretim ve düzenleme) | ~$15 |
| Claude, ekspertiz raporu | rapor başına ~$0.10–0.15 (10 sayfa varsayımı) | ~$0.13 | ~$13 |
| Supabase Pro | $25 / ay | — | $25 |
| Cloud Run | kullandıkça | çok düşük | birkaç dolar |
| Sentry, EAS | ücretsiz katman | — | $0 |
| **Toplam** | | **~$0.50** | **~$75–80** |

- Kendi maske modelimize (BiRefNet, MIT lisanslı) geçilirse maske maliyeti görsel başı 1 cent'in altına iner. GPU barındırma hesabı hacim büyüyünce yapılır.
- Claude tarafında Sonnet 5.5 (girdi $2, çıktı $10) maliyeti yarıya indirir, Haiku 5.5 (girdi $0.10, çıktı $0.50) çok daha fazla düşürür. Kaliteyi karşılaştırıp karar vermek kullanıcıya aittir.
- Photoroom'un $0.10'luk düzenleme paketi (AI arka plan, AI gölge, yeniden ışıklandırma) kullanılmaz: 5 kat pahalıdır ve aracı yeniden üretme riski taşır.
- remove.bg elendi: görsel başı $0.11–0.23 tutuyor ve kapanacağına dair doğrulanmamış haberler var.

## 14. Riskler ve erken denemeler [Öneri]

Asıl geliştirmeye başlamadan önce kısa denemeler yapılır; denemelerin kodu atılır, sadece sonuçları kullanılır. Denemeler için pilot galeriden veya kendi çekimimizden 30–40 gerçek araç fotoğrafı gerekir: farklı açılardan ve Alman plakalı; açık ve kapalı alanda, güneşte, bulutlu ve yağmurlu havada, akşam ışığında, başka araçların arasında ve ultra geniş kamerayla çekilmiş.

1. **Maske kalitesi:** Photoroom ve BiRefNet, pilot galerinin gerçek fotoğraflarında karşılaştırılır. Özellikle camlara (arkadaki eski arka plan görünüyor mu), jantlara ve parlak boyalara bakılır. Camlarda sorun büyükse, cam bölgesine yeni arka planı yarı saydam karıştırmak sonraki adım olur. Başka araçların arasında çekilmiş fotoğraflarda maskeye komşu araç parçası karışıyor mu diye de bakılır. Kutuyla sınırlama (7.2) yetmezse, kutuyla yönlendirilen bir nesne ayırma modeli (örneğin SAM 2, Apache 2.0) Photoroom maskesiyle birlikte kullanılır.
2. **Plaka köşeleri:** Alman plakalarında ve 45° çekimlerde dört köşenin ne kadar güvenilir bulunduğu ölçülür; lisansı uygun bir model seçilir.
3. **Canlı yönlendirme performansı:** VisionCamera ve TFLite ile araç tespiti düşük ve orta segment Android telefonlarda ve eski bir iPhone'da denenir; basit moda geçiş eşiği belirlenir. Android'de ultra geniş kameraya uygulamadan erişilip erişilemediği de kontrol edilir.
4. **Şablon üretimi:** Bir kasa tipi için 8 açının normal ve dar alan sürümleriyle render → silüet → SVG hattı kurulur.

Diğer riskler:

- İki platform da ilk pilot sürümde olduğu için Android cihaz çeşitliliği kritik yoldadır. Pilot galeri personelinin telefon modelleri öğrenilir. Test listesi en az yeni bir iPhone, ultra geniş kamerası olmayan bir iPhone (örneğin SE), orta ve düşük segment birer Android telefonu kapsar.
- Boya ve camlarda çekim ortamının yansımaları kalır, çünkü aracın piksellerine dokunulmaz (7.1). Kalabalık ortamda çekilen araçlarda bu, stüdyo görünümünü zayıflatır. Yansıma azaltma, aracın görünümünü değiştirmediği gösterilebilirse sonraki sürümde ele alınır.
- Genel App Store yayınında, davetle giriş yapılan uygulamalar için Apple inceleme ekibine bir demo hesap verilmelidir.

## 15. Teslim aşamaları [Öneri]

| Aşama | İçerik | Sonuç |
|---|---|---|
| M0 | Erken denemeler (bölüm 14) | Model ve servis seçimleri netleşir |
| M1 | Altyapı, giriş, galeri ayarları, temel araç kaydı, yönlendirmeli çekim, kalite kontrolü, internetsiz çalışma, yükleme | Çekim uçtan uca çalışır |
| M2 | İşleme servisi, stüdyo ekranı, plaka düzeltme, kredi, dışa aktarma | **Pilot sürüm 1**, iOS ve Android (TestFlight ve Google Play kapalı test) |
| M3 | Araç ayrıntıları, hasar şeması, ekspertiz okuma, AI ilan metni | **Pilot sürüm 2** |
| Sonra | Web admin paneli, kredi paketi satışı, modele özel şablonlar, genel mağaza yayını | Pilot geri bildirimine göre planlanır |

Dokümanda hasar ve ekspertiz bilgileri Faz 1'deydi. Galeri fotoğrafları daha erken kullanmaya başlasın diye bu sürümde M3'e alındı **[Öneri]**.

## 16. Uygulayıcıya bırakılanlar

- Ekran tasarımları ve bileşen yaklaşımı (ayrı bir UI aşamasında, /no-slop-ui kuralıyla)
- Kütüphane sürümleri, klasörlerin iç yapısı, test araçları
- Gölge ve ton düzeltme algoritmalarının ayrıntıları
- Cihaz üstü tespit modelinin varyantı, tolerans değerleri, basit moda geçiş eşiği ve dar alan modunun önerilme koşulu
- İş kuyruğu ve yeniden deneme mekanizmasının ayrıntıları
- Çıktı boyutu ve dosya adlarında ince ayar

## Kaynaklar

- Photoroom API fiyatları: https://www.photoroom.com/api/pricing
- Photoroom Remove Background API: https://www.photoroom.com/api/remove-background
- Supabase faturalandırma: https://supabase.com/docs/guides/platform/billing-on-supabase
- fal.ai arka plan API karşılaştırması (BiRefNet fiyatı): https://fal.ai/learn/tools/best-background-remover-apis-2026
- remove.bg fiyat ve durum: https://www.banuba.com/blog/best-background-removal-apis-developer-comparison, https://saascrmreview.com/remove-bg-review/
- Claude model fiyatları: Anthropic API referansı (2026-10-06 tarihli fiyat tablosu)
