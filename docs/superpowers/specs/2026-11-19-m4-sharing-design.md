# M4: Paylaşım — Tasarım

Tarih: 19 Kasım 2026. Üst tasarım: `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md`; ilan metni ve araç bilgileri: `docs/superpowers/specs/2026-11-18-m3-vehicle-details-listing-design.md`.

## 1. Niyet

Galeri bir aracı WhatsApp ve Instagram'da tek dokunuşla paylaşabilir. Paylaşılabilenler:

- hazır bir afiş,
- seçili stüdyo fotoğrafları,
- M3'te üretilen ilan metni.

Böylece ilanı her yerde elle yeniden kurmak gerekmez. Kullanıcının sözü (18 Kasım 2026): "whatsappta, instagramda, mobile.de de paylaş … ya afiş olarak ya da formun doldurulmuş halini paylaşabilecek".

Sıra: M3 → paylaşım (bu belge) → roller → pazar yeri. **[Karar]**

## 2. Hedefler

- Araç başına bir afiş üretilir. Kullanıcının seçtiği düzen A'dır: büyük fotoğraf, altta bilgi bandı. **[Karar]**
- Afiş, seçili fotoğraflar ve ilan metni tek dokunuşla birlikte sistemin paylaşım menüsüne gider; oradan WhatsApp, Instagram ve diğer uygulamalara gönderilir. **[Karar: yol B, çoklu paylaşım paketi]**
- Afişte galerinin telefon ve WhatsApp numarası yer alır. Bu numaralar galeri ayarlarına eklenir. **[Karar]**
- mobile.de için ilan metni panoya kopyalanır. Alanlar zaten mobile.de listeleriyle uyumludur.

## 3. Hedef olmayanlar

- **mobile.de'ye doğrudan yükleme (Seller API):** sonraya kaldı **[Karar]**. Galerinin mobile.de'den API erişimi istemesi gerekir; erişim gelince ayrı bir aşama olur.
- **Instagram Graph API ile otomatik gönderi** ve **Facebook App ID gerektiren "hikâyeye doğrudan paylaş"**: yapılmaz.
- Video, birden fazla afiş şablonu, galeri renk teması.
- **Yakıt tüketimi ve CO2 değeri:** Almanya'da yeni araç ilanlarında zorunlu olabiliyor. Pilot galeri yalnız ikinci el satıyor, bu yüzden bu aşamada bu alanlar eklenmez. **[Karar, 19 Kasım 2026]** Yeni ya da Tageszulassung araç satılırsa önce yasal kontrol yapılır, alanlar sonra eklenir.
- Pazar yeri ve roller: sonraki aşamalar.

## 4. Kaçınılacaklar

- Afişte şasi numarası ya da plaka görünmesi. Afiş stüdyo çıktısını kullanır; plaka orada kapatılmıştır.
- Şablon görünümlü, "yapay zekâ işi" duran bir afiş. /no-slop-ui geçerlidir: gradyan yok, sınırlı renk, düz ve okunaklı yazı.
- Metnin paylaşımda sessizce düşmesi. Bazı uygulamalar dosyanın yanında gelen metni yok sayar; bu durumda kullanıcı metni panodan yapıştırabilmelidir (6.3).

## 5. Yaklaşımlar

| | Yol | Artı | Eksi |
|---|---|---|---|
| A | Mevcut `expo-sharing` ve pano | Yeni paket yok | Bir seferde tek dosya; fotoğraf seti için önce telefona kaydet, sonra seç |
| **B** | **`react-native-share` (çoklu dosya + metin)** | **Afiş, fotoğraflar ve metin tek dokunuşla gider** | **Bir yerel paket ve yeniden derleme** |
| C | Platforma özel bağlantılar (`wa.me`, `instagram-stories://`) | Hedefe doğrudan gider | `wa.me` fotoğraf taşımaz; hikâye bağlantısı Facebook App ID ister |

Kullanıcı B'yi seçti. Sebep: istenen şey "tek dokunuşla paylaş"; A bunu birkaç adımda yapıyor. C sınırlı ve fazladan hesap istiyor.

## 6. Davranış

### 6.1 Galeri iletişim bilgileri

- Galeriye iki alan eklenir: `phone` ve `whatsapp`. İkisi de isteğe bağlı metindir.
- Galeri sahibi bunları galeri ayarları ekranında girer. Yetki mevcut marka ayarlarıyla aynıdır: yalnız sahip yazar, üyeler okur.
- Doğrulama hafiftir: rakam, boşluk, `+`, `-`, `/` ve parantez kabul edilir; en az 6 rakam olmalıdır. Numara girildiği gibi saklanır ve gösterilir. **[Benim kararım]**
- WhatsApp alanı boşsa afişte yalnız telefon görünür; ikisi de boşsa iletişim satırı çıkmaz.

### 6.2 Afiş

**Düzen A:**
- **Üst kısım:** kapak fotoğrafı.
- **Alt bant (beyaz):**
  - Başlık: marka, model, varyant.
  - Bilgi satırı: ilk tescil, km, yakıt ve şanzıman. Değeri olmayan atlanır.
  - Fiyat büyük yazılır; boşsa "Preis auf Anfrage" (dile göre).
  - Fiyatın altında kısa bir satır, yalnız değer varsa çıkar **[Karar, 19 Kasım 2026]**:
    - KDV gösterilebiliyorsa "MwSt. ausweisbar",
    - garanti girildiyse "12 Monate Garantie".
    - İkisi de boşsa satır hiç çıkmaz.
  - Konum (ilandaki konum alanı).
  - İletişim satırı: "Tel." ve "WhatsApp" numaraları.
  - Galeri logosu. Logo yüklenmemişse bant logosuz çizilir. **[Benim kararım]**

**Boyutlar:**
- 4:5 (1080×1350): Instagram gönderisi.
- 9:16 (1080×1920): hikâye ve WhatsApp durumu. Aynı düzen dikeyde yerleşir; fotoğraf alanı uzar.
- Kullanıcı iki boyut arasında seçer. Varsayılan 4:5. **[Benim kararım]**

**Fotoğraf:** Varsayılan olarak stüdyonun kapak fotoğrafı (`coverPhoto`) kullanılır. Kullanıcı setteki başka bir işlenmiş fotoğrafı seçebilir. Filigranlı/filigransız seçimi dışa aktarma ekranındaki gibidir; varsayılan filigranlı. **[Benim kararım]**

**Dil:** Afiş yazıları Almanca, Türkçe ya da İngilizce olabilir. Varsayılan Almanca. Yazı değerleri M2/M3'teki çeviri anahtarlarından gelir: "Benzin" ya da "Automatik" gibi. Paylaş ekranındaki tek dil seçimi hem afişi hem paylaşılan metni belirler. **[Benim kararım]**

**Çizim:** Afiş telefonda Skia ile ekran dışı (offscreen) çizilir ve JPEG olarak önbelleğe yazılır. Önizleme aynı çizimden gelir. Yazı tipi, iOS ve Android'de aynı görünsün diye uygulamaya gömülen tek bir yazı tipidir. Yazı tipini kurucu seçer: Inter değil; okunaklı bir sistem benzeri sans-serif olmalı ve /no-slop-ui'ye uymalı. **[Benim kararım]**

**Ön koşullar:**
- En az bir işlenmiş fotoğraf yoksa afiş düğmesi kapalıdır; yanında "Fotoğrafları önce stüdyoda işle" notu durur.
- Fotoğraf ve logo indirileceği için internet gerekir. Çevrimdışıysa not gösterilir.

**Yazının sığması:** Uzun başlık iki satıra kadar sarar, sonra kısaltılır. Bilgi satırı sığmazsa sondaki öğeler atlanır.

### 6.3 Paylaş ekranı

- Araç sayfasına bir "Paylaş" satırı ve yeni bir ekran eklenir.
- **Ekranın bölümleri:**
  1. Afiş önizlemesi, boyut seçimi (4:5 / 9:16) ve fotoğraf seçimi.
  2. Eklenecek fotoğraflar: setten seçmeli; varsayılan seçim yalnız afiş.
  3. Metin: seçilen dildeki ilan metni (başlık + açıklama). O dilde metin yoksa yalnız başlık ve bilgi satırı gider; yanında "İlan metni oluştur" bağlantısı olur.
- **"Teilen" düğmesi:** seçili dosyaları ve metni `react-native-share` ile sistem paylaşım menüsüne verir. Aynı anda metin panoya da kopyalanır; WhatsApp gibi metni yok sayan hedeflerde kullanıcı yapıştırabilir. Paylaşımdan sonra kısa bir "Metin panoda" notu çıkar.
- **"Text kopieren (mobile.de)" düğmesi:** başlık ve açıklamayı panoya kopyalar. Listing ekranındaki "Kopieren" ile aynı biçimdir.
- **Başka cihazda düzenleniyor uyarısı (M3):** bu ekranda gösterilmez; ekran salt okunur paylaşım yapar. **[Benim kararım]**

## 7. Kısıtlar

- Expo SDK 58 / React Native 0.88; React Compiler kuralları geçerlidir. `react-native-share`'in Expo config plugin'i ile eklenmesi gerekir; yeni yerel paket olduğu için iOS ve Android geliştirme derlemesi yenilenir.
- Arayüz Almanca, Türkçe ve İngilizce; yeni metinler üç dil dosyasına girer.
- Veritabanı göçü yalnız yerelde uygulanır; buluta gönderim kullanıcının onayıyla yapılır.
- Yeni bir sunucu fonksiyonu ya da yapay zekâ çağrısı yoktur.

## 8. Kurucuya kalanlar

- Afişin tipografisi, boşlukları ve logonun yeri (düzen A içinde). Ekran görüntüsüyle kontrol edilir.
- 9:16 düzeninde fotoğrafın kırpılma biçimi: ortalanmış ve aracı kesmeyecek şekilde.
- Instagram'ın çoklu görseli paylaşım menüsünden nasıl kabul ettiği. Kabul etmiyorsa Instagram'a yalnız afiş gider; bu bir not olarak gösterilir.
