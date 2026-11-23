# photocar.ai Arayüz Yenileme — Tasarım

Tarih: 23 Kasım 2026. Ürün kaydı: `PRODUCT.md`. Yön sözleşmesi: `.impeccable/surfaces/apps-mobile.md`. Seçilen taslak: `.impeccable/mocks/decision/zulassung.html`. Üst tasarım: `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md`.

## 1. Niyet

Uygulama, mağazalarda test aşamasına (TestFlight ve Google Play iç test) photocar.ai adıyla çıkacak. Kullanıcının sözü (23 Kasım 2026):

- "genel görünüm çok sade, daha profesyonel olsun. ve bir temaya sahip olsun."
- "galeriler … premium lüks bir kitle."

Mevcut görünüm, düz bir sistem görünümü: beyaz zemin, mavi düğmeler, Expo'nun hazır simgesi. Bu haliyle test kullanıcısına gösterilmeyecek. **[Karar]**

Süre: build için 1–2 gün beklenebilir. **[Karar]**

Sıra:
1. Bu arayüz çalışması.
2. Ayrı bir planla yayın aşaması: alan adı, e-posta, mağaza kayıtları, EAS build'leri.
3. Telefon turu 2.

## 2. Hedefler

- **Görsel dünya: Zulassung.** Uygulama ruhsat belgesi (Zulassungsbescheinigung Teil I) dünyasını taşır. **[Karar: karar sayfasında seçildi]**
  - **İmza:** araç bilgileri, ruhsattaki resmî alan kodlarıyla etiketlenir.
  - **Palet:** adaçayı güvenlik kâğıdı zemini, mürekkep yeşili yazı ve tek bir eylem yeşili.
  - **İşaret rengi:** ruhsat kırmızısı yalnız "burada senin işin var" anlamında kullanılır.
- **Yol A: önce ortak temel, sonra ana ekranlar elle.** **[Karar]**
  - **Ortak temel:** renk ve yazı belirteçleri, ortak bileşenler ve ekran başlıkları yeni dünyaya göre yapılır. Bütün ekranlar bunu devralır.
  - **Elle yeniden kurulacak altı ana ekran:** giriş, araç listesi, araç sayfası, araç bilgileri formu, stüdyo, paylaşım.
- **Marka:**
  - Uygulama adı her yerde photocar.ai. **[Karar]**
  - Yeni uygulama simgesi ve açılış ekranı yapılır.
- **Bitiş:** bağımsız bir tasarım incelemesi yapılır ve tasarım sistemi `DESIGN.md` ile `.impeccable/design.json` olarak yazılır.

## 3. Hedef olmayanlar

- **Koyu mod:** bu turda yok. `userInterfaceStyle: "light"` kalır. **[Benim kararım]** Sebep: kullanım sahnesi açık hava ve gün ışığı, süre de 1–2 gün.
- **Yeni özellik, yeni akış ya da gezinme modeli değişikliği:** yok. Yığın gezinmesi kalır, sekme çubuğu eklenmez.
- **Paylaşım afişinin şablonu:** değişmez. Afiş galerinin markasını taşır, photocar.ai'ninkini değil (PRODUCT.md ilke 4).
- **Metinler:** gereken yeni etiketler dışında metin elden geçirmesi yok.
- **Uygulamanın iç kimliği** (`com.bambugames.carapp`), `slug` ve `scheme` değişmez. Ad değişse de mağaza kaydı bozulmaz.

## 4. Kaçınılacaklar

- **Dünyanın kostüme dönmesi:** guilloche desenleri, sahte damga ve mühürler, kâğıt dokusu, belge çerçeveleri. Dünya yalnız dört şey verir: yazı, palet, yoğunluk ve imza (kod etiketleri).
- **Yerel kontrollerin taklitleri:** anahtar, segment seçici, sistem uyarıları ve paylaşım menüsü platformun kendisi kalır. Geri hareketi ve klavye davranışı bozulmaz.
- **Kontrast:** WCAG AA'nın altında hiçbir metin olmaz; dışarıda, güneşte okunurluk korunur.
- **İç içe kart, renkli sol kenar çizgisi, gradyan, emoji.** (/no-slop-ui.)
- **Çekim ekranının yavaşlaması ya da çevrimdışı çalışmanın bozulması.**

## 5. Kısıtlar

- Expo SDK 58 / React Native 0.88. React Compiler kuralları geçerli:
  - Hook bağımlılığı tetikleyici olarak kullanılmaz.
  - Render içinde `Date.now()` çağrılmaz.
  - Ref'lere yalnız effect ve callback içinde yazılır.
- Yazı tipleri JS paketi olarak gelir (`@expo-google-fonts/barlow-semi-condensed`, `@expo-google-fonts/overpass-mono`). Native derleme gerekmez. Simge ve açılış ekranı ise native değişikliktir ve yayın aşamasındaki EAS build'ine girer.
- Her yeni metin `de`, `tr` ve `en` dil dosyalarına girer; `i18n.test.ts` geçer.
- Mevcut testler (jest, entegrasyon, veritabanı) yeşil kalır. Davranış değişmediği için yeni ekran testi gerekmez. Yeni saf yardımcılar (kod eşlemesi, durum satırı kararı) jest testiyle gelir.
- iOS ve Android kuralları:
  - Dokunma hedefi en az 44 pt / 48 dp.
  - Güvenli alanlar korunur.
  - Gövde metni sistem yazı tipindedir; kullanıcının yazı boyutu ayarına uyar.
  - Marka yazı tipi yalnız başlıklarda, araç adlarında, kodlarda ve sayılarda kullanılır.

## 6. Yaklaşımlar

| | Yol | Artı | Eksi |
|---|---|---|---|
| **A** | **Ortak temel + altı ana ekran elle + marka** | **Dünya bütün ekranlara yayılır; imza ana akışta tam görünür; 1–2 güne sığar** | **Yan ekranlar elle tasarlanmaz, yalnız temeli devralır** |
| B | 24 ekranın her biri elle | En tutarlı sonuç | 3–5 gün; build gecikir |
| C | Yalnız renk ve bileşen | Yarım gün | Seçilen dünyanın imzası (kod etiketleri, yeni liste) gelmez |

Kullanıcı A'yı seçti.

## 7. Görsel sistem

### 7.1 Renkler **[Karar: seçilen taslaktan]**

| Rol | Değer | Kullanım |
|---|---|---|
| `paper` | `#E8EDE9` | Ekran zemini, başlık çubuğu |
| `sheet` | `#F4F7F5` | Satır ve alan yüzeyi (tek yüzey seviyesi) |
| `ink` | `#12291F` | Ana metin |
| `ink2` | `#4A5D55` | İkincil metin |
| `rule` | `#C5D0CA` | İnce ayırıcı çizgiler (süs amaçlı, 1.47:1) |
| `field` | `#788A83` | Giriş alanı ve seçim alanı kenarları (kâğıda 3.08:1, sayfaya 3.38:1; ilk değer #7E918A kâğıtta 2.81:1 kaldığı için koyulaştı) |
| `action` | `#173F33` | Ana düğme, seçili durum, bağlantılar, bütün canlı durumlar |
| `onAction` | `#EEF3EF` | Eylem yeşili üstündeki metin |
| `mark` | `#A8232B` | Yalnız "burada iş var": sıradaki eksik çekim, plaka kontrolü, hata ve silme |
| `ok` | `#1E6A45` | Tamamlandı (Fertig) |
| `wait` | `#855400` | Bekliyor (yükleme ve sahibin işlemesi) |

- **Hata ile "sıradaki adım" aynı kırmızıyı kullanır.** İkisi de "senin işin var" demek. Her zaman metin ya da simgeyle birlikte gelir; renk tek başına anlam taşımaz. **[Benim kararım]**
- **Çekim ekranı:** kılavuz beyazı ve hazır yeşili aynı kalır, çünkü kamera görüntüsü üstünde okunurlukları denenmiş.
- **Hasar haritası:** dolgu renkleri durum anlamı taşıdığı için kalır; yalnız zemini ve kenarları yeni palete geçer.

### 7.2 Yazı **[Karar]**

| Rol | Yazı tipi | Örnek |
|---|---|---|
| `display` | Barlow Semi Condensed 700 | Büyük başlık "Fahrzeuge", 34–36 |
| `title` | Barlow Semi Condensed 600 | Araç adı, bölüm başlığı, 17–22 |
| `body` | Sistem (SF / Roboto), 400 ve 600 | Metin, düğme, form değerleri, 15–17 |
| `code` | Overpass Mono 600 | Alan kodu etiketi, 10.5–11 |
| `value` | Overpass Mono 500, sabit genişlikli rakam | km, kW, fiyat, tarih, sayaç, 13–15 |

- **Marka yazısı:** "photocar.ai" küçük harfle, Barlow Semi Condensed 600. ".ai" ikincil mürekkeple yazılır.
- **Yükleme:** yazı tipleri açılışta yüklenir. Yüklenene kadar açılış ekranı ekranda kalır (`expo-splash-screen`).

### 7.3 İmza: alan kodları

Kod etiketi, içinde resmî alan kodu yazan küçük, kenarlı bir kutudur ve değerden hemen önce gelir. Kodlar Zulassungsbescheinigung Teil I'den alınır. Doğrulanan kaynaklar:
- FZV Anlage 6 (gesetze-im-internet.de/fzv_2023/anlage_6.html)
- ADAC alan listesi
- HUK

| Uygulama alanı | Kod | Belgedeki anlam |
|---|---|---|
| `firstRegistration` | B | Datum der Erstzulassung |
| `make` | D.1 | Marke |
| `model` | D.3 | Handelsbezeichnung |
| `vin` | E | Fahrzeug-Identifizierungsnummer |
| `displacementCcm` | P.1 | Hubraum in cm³ |
| `powerKw` | P.2 | Nennleistung in kW |
| `fuel` | P.3 | Kraftstoffart oder Energiequelle |
| `colorExterior` | R | Farbe des Fahrzeugs |

- **Kodu olmayan alanlar** (km, sahip sayısı, HU, donanım, fiyat): kod etiketi almaz, düz etiketle gösterilir. Listede "km" yalnız bir birim etiketi olarak, aynı kutu biçiminde durabilir. **[Benim kararım]**
- `variant` alanı D.2 değildir. D.2 tip onay kodudur, pazarlama sürümü değil. Bu yüzden `variant` kod almaz.

### 7.4 Bileşenler

- **Mevcutlar, yeni dünyada yeniden:** `Button`, `Notice`, `Segmented`, `TextField`, `SelectField`, `Screen`.
  - `Button` türleri: dolu eylem yeşili, ince kenarlı ikincil, kırmızı tehlike.
  - `Notice` türleri: `info`, `error` ve yeni `attention`. `attention` kırmızı işaret ve metinle gösterilir. M4'te plaka uyarısı `error` türünü kullanmak zorunda kalmıştı; şimdi `attention` kullanır.
- **Yeniler:**
  - `CodeChip`: alan kodu kutusu.
  - `FactLine`: kod etiketi + değer.
  - `StateLine`: renkli nokta + durum metni; sıradaki adım için kırmızı metin ve sekiz bölmeli sayaç.
  - `VehicleRow`: fotoğraf, ad, bilgiler ve durum her satırda aynı yerde. Satırlar çizgiyle ayrılır, kart yok.
  - `Wordmark`: başlıktaki marka yazısı.
- **Başlık çubuğu:** zemin `paper`, başlık `display` yazısıyla, geri ve eylem rengi `action`. Liste ekranında solda marka yazısı, sağda hesap düğmesi (baş harfler).
- **Simgeler:** projede zaten kullanılan simge kümesi tutarlı bir çizgi kalınlığıyla kullanılır. Unicode karakteri ya da emoji simge yerine geçmez.

## 8. Ekranlar

### 8.1 Elle yeniden kurulacak altı ekran

- **Araç listesi:** seçilen taslağın düzeni.
  - Büyük başlık ve tam genişlik "Neues Fahrzeug" düğmesi.
  - Çizgiyle ayrılmış satırlar. Her satırda fotoğraf, ad, kod etiketli bilgiler (B, P.2, km) ve durum satırı bulunur.
  - Durumlar: Fertig yeşil; Wartet auf Verarbeitung amber; eksik dış çekim kırmızı metin ve sayaçla.
  - M5'teki `listStatusKey` aynen kullanılır. Fotoğrafı olmayan araçta boş fotoğraf yeri ve araç çizgi simgesi gösterilir.
- **Araç sayfası:**
  - Üstte kapak fotoğrafı.
  - Ad ve kod etiketli bilgiler.
  - Ana eylem bugünkü gibi "Studio" düğmesidir; davranış değişmez.
  - İşlem satırları: araç bilgileri, hasar haritası, ilan, rapor, paylaşım. Her satırın sağında durumu yazar.
  - Dış ve iç çekimler; eksik olanlar kırmızı işaretle.
- **Araç bilgileri formu:** bölümler aynı kalır. Kodu olan her alan, etiketinin önünde kod etiketi taşır; böylece personel ruhsattan doğrudan yazar.
- **Stüdyo:** arka plan seçimi, işle düğmesi ya da M5'teki sahip notu, ilerleme ve fotoğraf ızgarası yeni bileşenlerle kurulur. Fotoğraflar ön planda kalır.
- **Paylaşım:** afiş önizlemesi, seçimler ve paylaş düğmesi yeni bileşenlerle kurulur. Afişin kendisi değişmez.
- **Giriş:** marka yazısı ve kısa bir ürün satırı, ardından alanlar ve giriş düğmesi. Davet kabulü ve şifre sıfırlama da aynı düzeni kullanır.

### 8.2 Temeli devralacak ekranlar

Hesap, kredi, galeri ayarları, personel, yeni araç, çekim, hasar haritası, ilan, rapor, plakalar, rötuş, fotoğraf, dışa aktarma ve lisanslar. Bu ekranlarda:
- Sabit yazılmış eski renkler ve yazı boyutları belirteçlere çevrilir.
- Satır listeleri `VehicleRow` / satır diline uyar.
- Düzen değişmez.

## 9. Marka varlıkları

- **Uygulama adı:** `expo.name` = "photocar.ai". iOS ana ekranındaki ad ve Android etiketi de bu olur.
- **Simge (1024×1024):** adaçayı zemin üstünde, kod etiketi biçiminde ince kenarlı bir kutu; içinde Overpass Mono 600 ile "pc". **[Benim kararım]**
  - Android için ön plan, arka plan ve tek renk sürümleri ayrı yapılır.
  - Kaynak SVG olarak depoya girer. PNG'ler bu SVG'den üretilir ve nereden geldikleri dosyaya yazılır.
- **Açılış ekranı:** adaçayı zemin, ortada marka yazısı.

## 10. Kurucuya kalanlar

- Boşluk ölçeği, köşe yarıçapları ve çizgi kalınlıkları. Taslaktaki değerler başlangıç noktasıdır.
- Altı ekranın ayrıntılı yerleşimi. Taslağın düzeni bağlayıcıdır, aşağıdaki bölümler kurucuya kalır.
- Hangi simgelerin kullanılacağı (mevcut kümeden).
- Doğrulama ekran görüntüleri:
  - iOS simülatöründen (iPhone 17).
  - Android için bağlı bir telefon ya da emülatör varsa ondan; yoksa bu belirtilir.

## 11. Bitiş

- Impeccable'ın bitiş incelemesi taze bir inceleyiciyle yapılır. Ölçüt yön sözleşmesi ve seçilen taslaktır.
- Ardından `DESIGN.md` ve `.impeccable/design.json` yazılır.
- Commit'leri kullanıcı atar; önerilen mesajlar dosya listeleriyle verilir.

## 12. Kurucu kontrolünden sonra verdiğim kararlar **[Benim kararım]**

1. **Kapak fotoğrafı:** liste ve araç sayfası, bugünkü `useCovers` kancasını kullanır. Bu kanca stüdyonun kapak fotoğrafını (`coverPhoto`) getirir. Veri katmanında değişiklik yok. Kapak yoksa boş fotoğraf yeri ve araç çizgi simgesi gösterilir.
2. **Boş değerler:**
   - Listede değeri olmayan bilgi etiketi gösterilmez. Gösterilenler hep aynı sırada çıkar: B, P.2, km.
   - Araç sayfasında boş değer "—" olarak `ink2` renginde yazılır.
   - Boş alan hiçbir zaman kırmızı değildir; kırmızı yalnız §7.1'deki işler içindir.
3. **Durum satırı:** kararı saf bir yardımcı verir (`src/vehicle/stateLine.ts`, jest testli). M5'teki `listStatusKey` kuralını içine alır. Sıra:

   | Koşul | Görünüm |
   |---|---|
   | `ready` | yeşil "Fertig" |
   | `processing` | amber "In Bearbeitung" |
   | `draft`/`shooting`, `pendingUploads > 0` | amber "n Fotos werden hochgeladen" |
   | `shooting`, dış çekim 8'den az | kırmızı "Außen x/8 · n fehlen" + sekiz bölmeli sayaç |
   | `shooting`, dış 8/8, bekleyen yükleme yok | amber "Wartet auf Verarbeitung" |
   | `draft`, hiç çekim yok | `ink2` "Noch keine Fotos" |

   - İç çekimler sayaca girmez.
   - Veri eksikliği bu satıra girmez.
4. **Araç sayfasının ana eylemi:** bugünkü "Studio" düğmesi kalır. Sahip ve personel farkı M5'teki gibi stüdyonun içinde gösterilir. (§8.1 buna göre düzeltildi.)
5. **Formda kod etiketleri:**
   - Etiket, alanın başlık satırında, başlık metninden önce durur: "[P.2] Leistung (kW)".
   - Kodu olmayan alanların başlığı aynı sol kenardan başlar; boş kod sütunu yoktur.
   - Seçim alanları ve segmentler değişmez.
   - Büyük yazı boyutunda etiket metinle birlikte büyür ve başlık satırı sarar.
6. **Başlık çubuğu:**
   - Yerel yığın başlığı (native-stack) kalır; geri hareketi ve güvenli alanlar onun.
   - `headerStyle` zemini `paper`, `headerTitleStyle` Barlow Semi Condensed, `headerTintColor` `action`.
   - Liste ekranında iOS'ta büyük başlık (`headerLargeTitle`, `headerLargeTitleStyle` aynı yazı tipiyle); Android'de normal başlık. Platform farkı bilinçli.
   - Solda marka yazısı, sağda hesap düğmesi.
7. **Yazı tipi yükleme:**
   - `useFonts` kök `_layout`'ta, girişten önce çalışır.
   - Açılış ekranı `preventAutoHideAsync` ile tutulur ve yazı tipleri yüklenince ya da yükleme hata verince kapanır.
   - Hata olursa uygulama sistem yazı tipiyle açılır; kullanıcıya bir şey gösterilmez. Yazı tipleri pakettedir, ağ gerekmez.
8. **Simge ve açılış ekranı akışı:**
   - SVG kaynağı `apps/mobile/assets/brand/` altına girer. PNG'ler bu makinedeki bir araçla (qlmanage, sips ya da tarayıcı ekran görüntüsü) üretilir ve PNG'ler de depoya girer.
   - Nereden üretildikleri her PNG'nin yanına yazılır (Impeccable `embed-prompt` ile köken notu).
   - iOS `ios.icon`, eski `expo.icon` yerine yeni 1024 PNG'yi gösterir.
   - Android uyarlanabilir simgede kutu %66 güvenli alanın içinde kalır; tek renk katmanı aynı biçimdedir.
   - Açılış ekranı ayarı `app.json`'daki `expo-splash-screen` eklentisinde güncellenir: zemin `paper`, görsel marka yazısı.
9. **Belirteç adları:** renkler yeni rol adlarıyla yeniden adlandırılır ve eski adlar kaldırılır. Eşleme:

   | Eski | Yeni |
   |---|---|
   | `background` | `paper` |
   | `surface` | `sheet` |
   | `border` | `rule` |
   | `text` | `ink` |
   | `textMuted` | `ink2` |
   | `accent` | `action` |
   | `danger` | `mark` |
   | `pending` | `wait` |

   - Yeni olanlar: `field`, `onAction`, `ok`.
   - `guide` ve `ready` çekim ekranında kalır.
   - TypeScript, eski adı kullanan her dosyayı yakalar.
   - `damageColors.original` adaçayı nötrüne (`#D3DCD7`) taşınır; durum renkleri kalır.
   - Çekim ekranının sınırı: kamera görüntüsü ve kılavuz renkleri aynı kalır; düğmeleri ve metinleri yeni belirteçleri kullanır.
10. **Kontrast:** hesaplandı ve hepsi AA. Bkz. §7.1.

    | Çift | Oran |
    |---|---|
    | `ink2`/`paper` | 5.93 |
    | `ink2`/`sheet` | 6.52 |
    | `mark`/`paper` | 6.03 |
    | `wait`/`paper` | 5.43 |
    | `ok`/`sheet` | 6.08 |
    | `onAction`/`action` | 10.42 |
    | `field`/`sheet` | 3.09 (bileşen kenarı için 3:1) |

    - `rule` yalnız süs çizgilerinde kullanılır.
    - Kod etiketi yazısı en az 11 pt olur.
11. **Testler:** yeni saf yardımcılar `src/vehicle/` altına girer:
    - `fieldCodes.ts`: alan → kod eşlemesi.
    - `stateLine.ts`: durum satırı kararı.

    Ekran görüntüsü ya da snapshot testi yok. Ekranlar simülatörde kontrol edilir ve bitiş incelemesine ekran görüntüsüyle gider.
12. **Metinler:**
    - Var olanlar: "Fertig", "Wartet auf Verarbeitung", "Außen x/8", yükleme sayısı.
    - Üç dilde yeni anahtar alacaklar: "n fehlen", "In Bearbeitung" (yoksa), "Noch keine Fotos" ve giriş ekranındaki ürün satırı.
13. **Android ekran görüntüsü:** bağlı bir telefon ya da emülatör varsa alınır. Yoksa bu bitiş raporunda yazılır ve işi durdurmaz.
