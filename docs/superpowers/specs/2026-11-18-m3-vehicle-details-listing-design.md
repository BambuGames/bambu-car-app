# M3: Araç Bilgileri, Hasar Şeması, Ekspertiz Okuma ve İlan Metni — Tasarım

**Tarih:** 18 Kasım 2026
**Üst belge:** `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (bölüm 8, 9, 11.2, 12, 13)
**Teslim:** Pilot sürüm 2 (spec 15)

## 1. Amaç ve neden

Galeri bir aracın ilanını baştan sona bu uygulamada hazırlayabilsin. Bunun için dört parça gerekiyor:
- araç bilgileri,
- hasar şeması,
- ekspertiz raporundan doldurma,
- ilan metni.

Bilgiler ilk kez bizim uygulamada giriliyor. Galeri bunları başka bir sisteme girmiyor (kullanıcı, 18 Kasım 2026).

**Ürünün yönü değişti** (kullanıcı, 18 Kasım 2026):
- Bitmiş ilan, kendi pazar yerimizde yayınlanacak.
- Ayrıca WhatsApp, Instagram ve mobile.de'ye afiş ya da dolu form olarak paylaşılabilecek.
- Galeride rol tabanlı yetkiler olacak.

Bunlar dört ayrı proje olarak bu sırayla ele alınır:
1. Bu belge (M3).
2. Paylaşım: afiş, paylaşma menüsü, mobile.de API.
3. Rol tabanlı yetkiler.
4. Pazar yeri.

M3'ün kendi işinin yanında bir görevi daha var: ilanı sonraki projelerin üstüne kurulabileceği gerçek bir kayıt olarak bırakmak. Böylece 2 ve 4 baştan yazılmaz.

## 2. Hedefler, hedef olmayanlar, başarısızlık sayılacaklar

**Hedefler**
- **Bilgi girişi:** Galeri personeli bir aracın bilgilerini telefonda, çevrimdışı da olsa, bölüm bölüm girebilir. Yalnız marka, model ve kasa tipi zorunludur (spec 8.1).
- **Hasar şeması:** Aracın üstten çiziminde parçaya dokunup durumu seçilir.
- **Ekspertiz raporu:**
  - Raporun PDF'i ya da fotoğrafları yüklenir.
  - Claude alanları önerir; kullanıcı her öneriyi tek tek kabul ya da reddeder.
  - Kabul edilmeyen hiçbir şey kaydedilmez (spec 8.3).
- **İlan metni:**
  - Yalnız kayıtlı alanlardan, Almanca (varsayılan), Türkçe ya da İngilizce üretilir.
  - Birkaç başlık seçeneği ve bölümlere ayrılmış bir açıklama içerir.
  - Hazır komutlar: kısalt, daha profesyonel yaz, donanımı öne çıkar, sadeleştir, çevir (spec 8.4).
  - Metin elle düzeltilebilir ve kopyalanır.
- **Eşzamanlı düzenleme:** Aynı araç başka bir cihazda da açıksa ekranda "başka bir cihazda düzenleniyor" uyarısı görünür (kullanıcı, 18 Kasım 2026).

**Hedef olmayanlar (sonraki projeler ya da sonrası)**
- Afiş üretimi, paylaşma menüsü, mobile.de/Instagram API'leri (proje 2).
- Rol ve yetki tanımları (proje 3). M3'te galerinin her üyesi araç bilgisi, hasar, rapor ve ilan metni üzerinde çalışabilir.
- Pazar yerinde yayınlama ve arama (proje 4).
- Şasi numarasından araç bilgisi çözme (ücretli VIN servisleri).
- Türkiye'ye özel alanlar (Tramer) (spec 8.1).
- Alan bazında senkron birleştirme. Uyarı yeterli görüldü.

**Başarısızlık sayılacaklar** (spec 2.3'ten devralınan ve bu belgeye özgü olanlar)
- İlan metnine kayıtlı olmayan bir özelliğin, örneğin araçta olmayan bir donanımın yazılması.
- Rapordan gelen bir önerinin kullanıcı onaylamadan bir alana yazılması.
- İlan metni üretimi için Claude'a şasi numarasının ya da plakanın gönderilmesi (spec 8.4).
- Bilgi girişinin internetsiz çalışmaması.
- Teknolojiye uzak bir personelin uzun formda kaybolması:
  - Form bölümlere ayrılır.
  - Zorunlu alan yalnız üç tanedir.
  - Değerler mümkün olduğunca listeden seçilir.

## 3. Kısıtlar

- **Teknik yapı:** Bugünkü yapıya devam:
  - Expo / React Native, React Compiler açık.
  - Telefonda SQLite ve bir giden kutusuyla (outbox) çevrimdışı senkron.
  - Supabase Frankfurt: Postgres, satır bazlı yetki (RLS), Storage, Realtime, Edge Functions.
- **Arayüz:** Almanca; Türkçe ve İngilizce de var. /no-slop-ui kuralı geçerli.
- **Claude:**
  - Anahtar yalnız sunucuda durur. Varsayılan model `claude-opus-5-5` (spec 8.4). Daha ucuz modele geçmek kullanıcının kararıdır (spec 13).
  - Ekspertiz raporu Claude'a olduğu gibi gider; yükleme ekranında bu söylenir (spec 8.3, 12).
- **Kredi:** Rapor okuma ve ilan metni kredi istemez (spec 9).
- **Maliyet tahmini** (spec 13): ilan metni üretim başına ~$0,04, rapor başına ~$0,10–0,15.
- **Veri bölgesi:** Claude'un ilk taraf API'sinde çıkarım bölgesi bugün yalnız `us` ya da `global` olabiliyor, AB seçeneği yok.
  - Spec 12 Anthropic'i "ABD; veri işleme sözleşmesi, mümkünse AB çıkarım bölgesi" diye kabul ediyor.
  - Hukuki inceleme AB içinde işlem şart koşarsa, Claude Google Cloud Vertex AI'nin AB bölgesi üzerinden çağrılır. Cloud Run'la aynı Google Cloud projesi kullanılır. Bu, istemci ve kimlik doğrulama değişikliğidir; uygulamanın geri kalanı etkilenmez.

## 4. Yaklaşımlar

Araç bilgilerinin nasıl tutulacağı üç yolla düşünüldü:

- **A. Hepsi tek bir esnek alanda (`vehicles.details` jsonb), bugünkü gibi.**
  - Kazancı: en hızlısı.
  - Bedeli: veritabanı değerleri denetlemez. Pazar yerinde fiyat, km ve yakıta göre süzmek zorlaşır. Pazar yeri gelince gerçek verinin yeniden biçimlendirilmesi gerekir.
- **B. Karma — kullanıcının seçimi (18 Kasım 2026).**
  - Aranacak ve denetlenecek temel bilgiler `vehicles` tablosunda tipli kolonlarda; değer listeleri mobile.de'ninkiler.
  - Donanım listesi ve notlar esnek alanda.
  - Hasar şeması ayrı bir jsonb kolonda.
  - Satışa dair bilgiler (fiyat, KDV, garanti) ve metinler ayrı bir `listings` kaydında.
  - Bedeli: telefon veritabanı ve senkron yeni kolonları taşır, A'dan birkaç gün fazla iş.
- **C. Her şey ayrı tablolarda, donanım dahil.** Bu aşamada gereksiz ağırlık; elendi.

## 5. Tasarım

### 5.1 Veri modeli

**`vehicles` tablosuna eklenen kolonlar:**
- Hepsi boş bırakılabilir (nullable). Bugünkü `make`, `model`, `body_type` kolonları değişmez.
- Değer listeleri mobile.de'nin satıcı API'sindeki listelerden alınır; arayüz Almanca etiket gösterir.

| Kolon | Tip | Not |
|---|---|---|
| `variant` | text | model varyantı / donanım paketi, serbest metin |
| `first_registration` | date | ay hassasiyeti, ayın 1'i olarak saklanır |
| `mileage_km` | integer, ≥ 0 | |
| `fuel` | text + check | mobile.de yakıt listesi |
| `transmission` | text + check | manuel, otomatik, yarı otomatik |
| `power_kw` | integer, > 0 | arayüz PS'yi de gösterir |
| `displacement_ccm` | integer, > 0 | elektrikli araçta boş |
| `drive` | text + check | önden, arkadan, dört çeker |
| `color_exterior` | text + check | mobile.de renk listesi |
| `color_interior`, `upholstery` | text + check | iç renk ve döşeme |
| `previous_owners` | integer, ≥ 0 | |
| `hu_until` | date | TÜV/HU geçerlilik, ay hassasiyeti |
| `accident_free` | boolean | unfallfrei |
| `service_book` | boolean | Scheckheft |
| `non_smoker` | boolean | |
| `vin` | text | 17 karakter; ilan metnine hiç gitmez |
| `damage` | jsonb | `{ parçaKimliği: durum }`; yalnız `original` dışındaki parçalar |
| `damage_checked_at` | timestamptz | şema "tüm parçalar kontrol edildi" diye onaylandığında; boşsa şema kontrol edilmemiş sayılır (5.5) |

**Esnek alan:** `vehicles.details` jsonb kalır ve iki anahtar taşır:
- `equipment`: donanım kodlarının listesi (mobile.de özellik kodlarından seçilmiş bir alt küme).
- `notes`: serbest metin.

**Yeni tablolar:**
- **`listings`:** Araç başına bir satır; satırın `id`'si aracın `id`'sidir. Böylece iki cihaz çevrimdışıyken birbirine rakip iki ilan kaydı açamaz.
  - Kolonlar: `id`, `gallery_id`, `vehicle_id`, `status` (M3'te yalnız `draft`; `published` pazar yeriyle gelir), `price_eur` (integer ≥ 0), `vat_deductible` (boolean, MwSt. ausweisbar), `warranty_months` (integer ≥ 0, boş = yok), `location` (text, serbest; M3'te varsayılan yok, galeri adresi bugün hiçbir yerde tutulmuyor), `created_at`, `updated_at`.
- **`listing_texts`:** İlan ve dil başına bir satır (`(listing_id, language)` benzersiz, dil `de`/`tr`/`en`).
  - Kolonlar: `titles` (text[]; üretilen başlık seçenekleri), `title` (seçilen ya da elle yazılan), `description` (bölümlü metin), `model` (üreten model kimliği), `generated_at`, `edited` (boolean; elle düzeltildi mi).
- **`report_reads`:** Rapor okuma kayıtları. Kolonlar: `id`, `gallery_id`, `vehicle_id`, `files` (depo yolları), `status`, `error`, `suggestions` (jsonb), `created_at`.
  - Kabul edilen öneriler buradan değil, normal alan yazımıyla araca geçer.
  - Bu tablo yalnız günlük okuma sınırını ve bir sonraki açılışta önerileri yeniden göstermeyi sağlar.

**Yetki (RLS):** Galeri üyeleri kendi galerilerinin satırlarını okur ve yazar. Bugünkü `vehicles`/`photos` kuralları gibidir; proje 3 bunları daraltır.

**Depo:** Raporlar için özel `reports` kovası:
- yol: `{galeri}/{araç}/{okumaKimliği}/{dosya}`,
- dosya başına 20 MB sınırı,
- PDF, JPEG, PNG kabul edilir. Claude HEIC okumadığı için iPhone fotoğrafları telefonda JPEG'e çevrilip yüklenir.

**Saklama (kullanıcı kararı, 18 Kasım 2026):** Rapor dosyaları okunduktan sonra silinir.
- Bir okumanın bütün önerileri kabul ya da reddedilince dosyaları kovadan silinir ve `report_reads.suggestions` boşaltılır.
- Karar verilmemiş okumalar en geç 7 gün sonra aynı şekilde temizlenir. Bu, günde bir çalışan zamanlanmış bir temizlikle yapılır: Supabase Cron bir Edge Function'ı çağırır. Okuma kaydı olmayan dosyalar da (yükleme yarıda kesildiyse) 7 günden eskiyse silinir.
- `report_reads` satırı (durum, tarih, dosya sayısı) günlük sınır için kalır.
- Onaylanan değerler araçta kalır.
- Galeri raporun aslını kendisi saklar; uygulama raporun arşivi değildir.

### 5.2 Senkron ve çevrimdışı

- **Senkron:**
  - Yeni araç kolonları, `damage` ve `listings` telefon veritabanında da tutulur.
  - Bugünkü giden kutusundan sunucuya gider; `listing` yeni bir giden kutusu türüdür.
  - Senkron bugünkü gibi satırın bütününü yazar.
- **Çevrimdışı çalışan:** bilgi girişi, hasar şeması, fiyat alanları.
- **İnternet isteyen:** rapor okuma ve ilan metni. Çevrimdışıyken düğmeleri pasif olur ve kısa bir not görünür.
- **İlan metinleri:** `listing_texts` telefonda önbellek olarak tutulur, ama yalnız sunucuda üretilir ve düzenlenir.
- **Sunucuya gitmeden önce:** Rapor okuma ve ilan metni sunucudaki veriyi okuduğu için, çağrıdan önce giden kutusu boşaltılır; telefonda girilen son değerler de hesaba katılır.

### 5.3 "Başka bir cihazda düzenleniyor" uyarısı

- İnternet varken aracın düzenleme ekranlarından biri açıldığında uygulama `vehicle:{id}` kanalına Supabase Realtime Presence ile katılır. Bu ekranlar: bilgi formu, hasar şeması, ilan metni.
- Kanal özeldir (Realtime private channel); yalnız aracın galerisinin üyeleri katılabilir.
- Aynı kanalda başka bir cihaz varsa ekranın üstünde uyarı görünür:
  - Metin: "Wird gerade auf einem anderen Gerät bearbeitet".
  - Kişinin adı biliniyorsa eklenir.
- Uyarı düzenlemeyi engellemez.
- Çevrimdışıyken uyarı yoktur. Bu bilinçli bir sınırdır: iki cihaz çevrimdışı aynı aracı düzenlerse son yazan kazanır.

### 5.4 Araç bilgileri ekranı

Aracın sayfasına "Fahrzeugdaten" bölümü eklenir. Form bölümlere ayrılır:
- **Grundlagen:** marka, model, varyant, kasa tipi.
- **Technik:** güç, motor hacmi, yakıt, vites, çekiş.
- **Historie:** ilk tescil, km, sahip sayısı, TÜV/HU, kaza durumu, servis defteri, sigara içilmemiş.
- **Farben:** dış renk, iç renk, döşeme.
- **Ausstattung:** aranabilir donanım listesi, işaretlenir.
- **Preis:** fiyat, KDV, garanti, konum.
- **FIN, Notizen.**

Davranış:
- Her alan değiştiğinde yerel veritabanına yazılır ve giden kutusuna girer; ayrı bir "Kaydet" düğmesi yoktur.
- **Marka, model ve kasa tipi sonradan değiştirilebilir** (1. turda Crossland yanlışlıkla hatchback seçilmişti). İşlenmiş fotoğraflar varken kasa tipi değişirse bir onay sorulur ve set yeni tipin şablon kutularıyla yeniden çizilir. Bu kredi düşmez, Photoroom çağrılmaz (bugünkü "Neu rendern"). Kalan çekimler yeni tipin silüetiyle yapılır.
- Değer listeleri ve donanım adları üç arayüz dilinde gösterilir (de, tr, en; bugünkü i18n kuralı). `write-listing` metnin dilindeki adları kullanır.
- Doldurulmuş bölüm sayısı bölüm başlığında görünür, örneğin "3 von 7". Rozet ya da animasyon yoktur.

### 5.5 Hasar şeması

- **Çizim:** Kasa tipinden bağımsız tek bir üstten araç çizimi (SVG), yaklaşık 15 parça. Parça listesi:
  - Motorhaube, Dach, Heckklappe/Kofferraumdeckel,
  - Stoßfänger vorn ve hinten,
  - Kotflügel vorn links ve rechts,
  - Türen (4),
  - Seitenwand hinten links ve rechts,
  - Schweller links ve rechts.
- **Durum seçimi:** Parçaya dokununca alttan bir seçim açılır, beş durum vardır: original, lackiert, teillackiert, ersetzt, beschädigt (spec 8.2).
- **Renkler:** Her durum kendi rengiyle gösterilir; renk durumu taşır (/no-slop-ui). Altta küçük bir açıklama satırı vardır.
- **Kayıt:** `vehicles.damage`'a yalnız `original` dışındaki parçalar yazılır.
- **"Alle Teile geprüft":** Şemanın altındaki bu düğme `damage_checked_at`'i doldurur. Boş bir şema ancak bu onaydan sonra "tüm parçalar orijinal" anlamına gelir; onay yoksa şema kontrol edilmemiş sayılır. Şemada sonradan bir değişiklik olursa onay kalır, tarih güncellenir.
- **İlan metnine aktarım:** Durumlar ilan metnine yalnız şema onaylıysa gider. Onaysız şemada metin boya ve hasar durumu hakkında hiçbir şey söylemez; "alle Teile original" yazılmaz. Kaza durumu alanı (`accident_free`) şemadan ayrı tutulur ve şemadan türetilmez; kullanıcı ayrıca seçer.

### 5.6 Ekspertiz raporu okuma

**Akış:**
1. Kullanıcı "Bericht auslesen" ile bir PDF ya da bir veya birkaç sayfa fotoğrafı seçer. Ekranda raporun işlenmek üzere Anthropic'e (ABD) gönderileceği yazar (spec 8.3).
2. Dosyalar `reports` kovasına yüklenir ve `read-report` Edge Function'ı çağrılır.
3. Fonksiyon:
   - üyeliği ve günlük sınırı kontrol eder,
   - dosyaları indirir,
   - Claude'a PDF ya da görüntü olarak gönderir,
   - yapılandırılmış çıktı (JSON şeması) ister.
4. Şema, 5.1'deki alan adlarıyla aynıdır; hasar parçaları ve donanım kodları da dahildir. Her öneri değerin yanında raporda geçtiği yeri gösteren kısa bir alıntı taşır.
5. Uygulama önerileri alan alan gösterir: mevcut değer, önerilen değer, alıntı. Kullanıcı her birini kabul ya da reddeder; "hepsini kabul et" yoktur (spec 8.3).
6. Kabul edilenler normal alan yazımıyla araca geçer.

**Sınırlar ve ayarlar:**
- **Günlük sınır:** Araç başına günde en fazla 10 okuma. Kredi düşmediği için maliyeti bu sınırlar.
- **Çağrı ayarları:**
  - Model `claude-opus-5-5`, efor `high` (okuma doğruluğu önemli).
  - Reddetme durumuna karşı sunucu tarafı yedek açık: `fallbacks: "default"`, beta `server-side-fallback-2026-07-01`.
  - Ayrıntılar plan ve uygulamada `claude-api` skill'iyle doğrulanır.

### 5.7 İlan metni

**Akış:**
- **Fonksiyon:** `write-listing` Edge Function'ı üyeliği kontrol eder ve şunları toplar:
  - aracın kayıtlı alanları, donanım kodlarının Almanca adları, hasar durumları,
  - ilanın fiyat ve garanti alanları.
- **Gitmeyenler:** Şasi numarası hiç gönderilmez, plaka zaten alan değildir.
- **İstek tipleri:**
  - **Üretim:** dil seçilir (`de` varsayılan).
  - **Komutlar:** `shorten`, `more_professional`, `highlight_equipment`, `simplify`, `translate:{dil}`. Komutlarda mevcut metin de gönderilir.
- **Çıktı (yapılandırılmış):** üç başlık seçeneği ve başlıklı bölümler:
  - özet,
  - teknik bilgiler,
  - donanım,
  - durum ve geçmiş (hasar şeması dahil),
  - fiyat ve garanti.
  Boş kalan bölüm yazılmaz.

**Sistem talimatı:**
- yalnız verilen bilgileri kullan,
- verilmeyen donanımı ya da durumu yazma,
- abartı ve garanti dışı vaatlerde bulunma.

**Kayıt ve düzenleme:**
- Sonuç `listing_texts`'e yazılır; aynı dilin önceki metninin yerine geçer.
- Kullanıcı başlıklardan birini seçer, metni elle düzeltebilir (`edited = true`) ve kopyalar.
- Elle düzeltilmiş bir metin yeniden üretilmeden ya da `translate:{dil}` ile üzerine yazılmadan önce bir onay sorulur.
- **Bayat metin:** Metin üretildikten sonra aracın ya da ilanın bilgileri değiştiyse, karşılaştırma `facts_updated_at` ile `generated_at` arasındadır. `facts_updated_at` yalnız metne giren bilgiler (araçta şasi numarası dışındaki bilgiler, ilanda satış alanları) değişince ilerler; fotoğraf sayısı, durum ve stüdyo ayarları gibi sunucu işleri onu ilerletmez. Bu durumda metnin üstünde "Die Fahrzeugdaten wurden nach dem Erstellen des Textes geändert" notu ve "Neu erstellen" düğmesi görünür. Kopyalama engellenmez; çünkü değişiklik metni geçersiz kılmayabilir.

**Çağrı ayarları:**
- Model `claude-opus-5-5`, efor `medium`.
- Sunucu tarafı yedek açık (5.6'daki gibi).

### 5.8 Sunucu tarafı

- **Edge Functions:** Yeni iki fonksiyon: `read-report` ve `write-listing`. Bugünkü fonksiyonların kalıbıyla yazılır: üyelik kontrolü, hata kodları, Node `node:test` entegrasyon testleri.
- **SDK:** Claude çağrıları resmi `@anthropic-ai/sdk` ile yapılır.
- **Anahtar:** `ANTHROPIC_API_KEY` Supabase fonksiyon sırlarında durur; yerelde git-ignored `supabase/functions/.env`'de.
- **Testler:** Testlerde Claude çağrısı sahte bir istemciyle değiştirilir. Gerçek çağrı yalnız kullanıcı onayıyla yapılır.

## 6. Uygulayıcıya bırakılanlar

- mobile.de değer listelerinin ve donanım kodu alt kümesinin tam içeriği; yaklaşık 60 yaygın donanım. Kaynak mobile.de satıcı API dokümanı.
- Ekran yerleşimleri ve form alanlarının sırası (/no-slop-ui ile).
- Hasar çiziminin SVG'si.
- Claude talimatlarının metni, JSON şemalarının ayrıntısı, bölüm başlıklarının dillere göre karşılıkları.
- Presence kanalında kişi adının nereden okunacağı.

## 7. Bilinen riskler

- **Fotoğraf rapor:** Telefonla çekilmiş, eğik ya da parlayan bir rapor fotoğrafında okuma doğruluğu düşebilir. Her öneri onaydan geçtiği için yanlış veri kaydedilmez ama kullanıcı vakit kaybeder. Pilot verisiyle ölçülür.
- **Hukuki inceleme:** Raporun ABD'ye gönderilmesini kabul etmeyebilir. Çözüm yolu 3. bölümde (Vertex AI AB bölgesi).
- **Çevrimdışı son yazan kazanır:** İki cihazda çevrimdışı düzenlemede bir cihazın değişiklikleri kaybolabilir (5.3).

## 8. Uygulayıcı kontrolünden sonra verilen kararlar (18 Kasım 2026)

Bağımsız bir okuyucunun sorularına verilen cevaplar. Hepsi bu belgenin ilgili bölümüne işlendi; kullanıcının gözden geçirmesi için burada da listelenir.

1. **Boş hasar şeması:** Kendiliğinden "tüm parçalar orijinal" sayılmaz. `damage_checked_at` ve "Alle Teile geprüft" eklendi (5.1, 5.5).
2. **Marka, model ve kasa tipi:** Sonradan değiştirilebilir. Kasa tipi işlenmiş fotoğraflar varken değişirse set ücretsiz yeniden çizilir (5.4).
3. **Konum alanı:** M3'te varsayılansız, serbest metindir; galerinin adresi bugün tutulmuyor (5.1).
4. **Bayat ilan metni:** Bilgiler değişince not ve "Neu erstellen" düğmesi gösterilir, kopyalama engellenmez (5.7).
5. **Değer listeleri ve donanım adları:** Üç dilde gösterilir (5.4).
6. **Küçük kararlar:**
   - iPhone fotoğrafları telefonda JPEG'e çevrilir (5.1).
   - Sunucu çağrısından önce giden kutusu boşaltılır (5.2).
   - İlan kaydının kimliği aracın kimliğidir (5.1).
   - Presence kanalı özeldir (5.3).
   - Elle düzeltilmiş metnin üzerine çeviri yazılmadan önce sorulur (5.7).
7. **Rapor dosyaları (kullanıcı kararı):** Öneriler karara bağlanınca, en geç 7 gün sonra silinir (5.1).
