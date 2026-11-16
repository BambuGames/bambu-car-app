# M2c Pilot Sürüm 1 Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pilot galeri uygulamayı TestFlight ve Google Play kapalı testinden kurup gerçek sunucularla kullanabilsin:
- İşlenmiş fotoğrafları telefona kaydeder, tek tek paylaşır ya da bilgisayar için süreli bir ZIP linki alır.
- Veri AB'de kalır: Supabase Frankfurt, işleme servisi Cloud Run Frankfurt.
- Hatalar Sentry'de (AB bölgesi) görünür, gizlilik metni ve künye uygulamada ve mağaza sayfasında bulunur.

**Architecture:**
- **Dışa aktarma üç yoldan yapılır:**
  - Kaydetme ve tek fotoğraf paylaşma telefonda yapılır: imzalı URL'den indirilir, `expo-media-library` ile Fotoğraflar'a yazılır ya da `expo-sharing` ile paylaşılır.
  - ZIP linki sunucuda üretilir: yeni `export-vehicle` Edge Function üyeliği kontrol eder, M2a'nın servisine yeni `/export` uç noktasıyla ZIP'i yaptırır ve 7 gün geçerli imzalı link döner.
  - Hangi fotoğrafların, hangi sırada ve hangi adla verileceğine uygulama karar verir. Bu karar saf bir modülde Jest'le sınanır, servis aynı adlandırmayı uygular.
- **Bulut kurulumu kod değil, adım listesidir:** Supabase bulut projesi, Cloud Run ve EAS komutları README'nin yeni "Üretim" bölümüne girer. Her adımın sonunda bir doğrulama komutu vardır. Hesapları ve anahtarları kullanıcı açar.
- **Sürüm güvenliği:** EAS derlemesi, yerel Supabase adresiyle ya da hukuki linkler eksikken başlamadan durur.
- **Gözlem:** Sentry uygulamada ve serviste çalışır, DSN yoksa kapalıdır. Kişisel veri gönderilmez; imzalı URL'lerin anahtar kısmı silinir.

**Tech Stack:**
- Uygulama: Expo SDK 58 / React Native 0.88, expo-router, @supabase/supabase-js 2. Yeni paketler: expo-media-library, expo-sharing, @sentry/react-native (hepsi MIT).
- Servis: Python 3.13, FastAPI, `zipfile`. Yeni paket: sentry-sdk (MIT).
- Supabase Edge Functions (Deno), Node 26 `node:test`, pgTAP, Jest 30.
- Bulut ve dağıtım:
  - Supabase Pro, Frankfurt (eu-central-1).
  - Google Cloud Run, europe-west3. `gcloud` bir Docker imajında çalışır.
  - Sentry, AB bölgesi (de.sentry.io).
  - EAS Build + Submit (`npx eas-cli`).

**Spec:** `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (özellikle 2.1/10, 3, 9, 10, 11.1, 12, 13, 15) · Önceki planlar: `docs/superpowers/plans/2026-11-12-m2a-processing-pipeline.md`, `docs/superpowers/plans/2026-11-12-m2b-studio-app.md`

**Plan sırası ve sapmalar:**
- **M2'nin son planı (M2c):** Bitince M2 tamamdır, yani Pilot sürüm 1 (spec 15). Araç ayrıntıları, hasar şeması, ekspertiz okuma ve ilan metni M3'tedir.
- **Kullanıcı kararları (16 Kasım 2026):**
  - Supabase ve Google Cloud hesapları birlikte açılır. Apple Developer ve Google Play Console hesapları hazırdır.
  - Derleme ve yükleme EAS Build + Submit ile yapılır.
  - Gizlilik metnini (Datenschutzerklärung) ve künyeyi (Impressum) Bambu Games verir. Uygulama ve mağaza sayfası onlara link verir.
- **Paylaşma:** Tek fotoğraf, fotoğraf ekranından dosya olarak paylaşılır (AirDrop, e-posta, bulut sürücü). Bütün set için paylaşma menüsü ZIP linkini açar, çünkü Expo'nun paylaşma modülü bir seferde tek dosya alır.
- **ZIP'i servis yapar:**
  - Edge Function'ların bellek ve süre sınırı orijinallerle 200 MB'a varan bir set için dardır; Python servisi Cloud Run'da zaten çalışıyor.
  - Her araç ve sürüm için tek bir ZIP tutulur (`{galeri}/{araç}/exports/{sürüm}.zip`). Yeni istek eskisinin üstüne yazar, link 7 gün geçerlidir.
- **Araç kataloğu migration'a taşınır:** Marka ve model listesi bugün `seed.sql`'de. Seed buluta hiç uygulanmadığı için üretimde liste boş kalırdı.
- **E-posta:** Supabase'in kendi e-postası yalnız proje ekibinin adreslerine gider. Personel davetleri ve şifre sıfırlama için kullanıcı bir SMTP hesabı verir; AB'de bir sağlayıcı ya da Bambu Games'in kendi posta sunucusu olabilir.
- **EAS Update (OTA) bu planda yok:** Spec 11.1'de anılıyor, ama pilot TestFlight ve kapalı testle dağıtılıyor. Hızlı düzeltme ihtiyacı doğarsa ayrı bir adımda eklenir.
- **Telefon turu:** M1b ve M2b'nin bekleyen telefon testleri bu planın mağaza derlemeleriyle (TestFlight, kapalı test) yapılır. Zamanı kullanıcı belirler (Task 14).
- **M2b'den kalanlar:** İnceleme ve kendi notlarımızdan ertelenen küçük bulgular Task 7 ve 8'dedir. Şunlar bilinçli olarak dışarıda:
  - Köşeleri sıfırdan yerleştirirken "dokun ve yakınlaş" adımı, telefon turundaki geri bildirime kalır.
  - Görsel arka planların örnek kutusu: henüz görsel arka plan yok.
  - `member_elsewhere`'in bir adresin başka galeriye ait olduğunu belli etmesi: pilotta kabul edildi.

## Global Constraints

**Veri ve gizlilik (spec 3, 11.1, 12)**
- Veriler AB'de tutulur:
  - Supabase: Frankfurt (eu-central-1).
  - İşleme servisi: Cloud Run europe-west3 (Frankfurt).
  - Sentry: AB veri bölgesi (`https://de.sentry.io/`).
- Anahtarlar yalnız sunucuda tutulur: Photoroom anahtarı, servis rolü anahtarı, `WORKER_SECRET` ve Sentry auth token.
  - Uygulamada yalnız Supabase anon anahtarı ve Sentry DSN bulunur; ikisi de gizli değildir.
- Sentry'ye kişisel veri gitmez (`sendDefaultPii: false`). Ekran görüntüsü ve görünüm hiyerarşisi eklenmez; imzalı URL'lerin sorgu kısmı silinir.

**Dışa aktarma (spec 2.1/10, 10)**
- Seçenekler:
  - Telefon galerisine kaydetme (tümü ya da seçili).
  - Paylaşma menüsü.
  - Bilgisayar için süreli ZIP linki.
- Filigranlı ya da filigransız sürüm seçilir; orijinaller ayrıca indirilebilir. Uygulamadaki sürümler: `watermarked`, `plain`, `originals`.
- Dosyalar ilan sırasıyla (M2b `LISTING_ORDER`) ve `01_<slot>.jpg` biçiminde adlandırılır, örneğin `01_front_left_45.jpg`.
- İşlenmiş sürümlere yalnız `process_status = 'done'` olan fotoğraflar girer. Orijinallere bütün yüklenmiş fotoğraflar girer.
- ZIP linki 7 gün (604 800 saniye) geçerlidir. Dışa aktarma kredi istemez.

**Arayüz ve metin**
- Arayüz Almanca; Türkçe ve İngilizce de var. Her yeni metin üç dil dosyasına girer ve i18n anahtar testi geçer.
- Tüm UI çalışmaları /no-slop-ui kuralına uyar. UI kodu veya metni yazmadan önce `no-slop-ui` skill'i yüklenir.
  - Tema `src/ui/theme.ts`'dir; mevcut `Button`, `Notice`, `Segmented`, `TextField` kullanılır.
- Kesinleşmiş Almanca metinler:
  - Fotoğraf izni: "Zum Sichern der bearbeiteten Fahrzeugfotos in Ihren Fotos." (`NSPhotoLibraryAddUsageDescription`)
  - İzin reddedildi: "Die App darf keine Fotos sichern. Bitte erlauben Sie es in den Einstellungen."
  - Link: "Der Link lädt die ausgewählten Fotos als ZIP-Datei, zum Beispiel am Computer. Gültig bis {{date}}."
  - Sahibe kredi bitti: "Ihr Guthaben ist aufgebraucht. Neues Guthaben erhalten Sie von Bambu Games."
  - Hukuki linkler: "Datenschutzerklärung", "Impressum".

**Kod kuralları**
- Uygulama React Compiler ile derleniyor. Hook bağımlılıkları tetikleyici olarak kullanılmaz; render içinde `Date.now()` gibi değer okunmaz (M2b dersi).
- Yeni API sarmalayıcıları istemciyi parametre alır (`createStudioApi(client)`, `fetchCredits(client, …)` gibi), böylece Node entegrasyon testleri yükleyebilir.
- Önbellek anahtarı olarak depo yolu yalnız üstüne yazılmayan dosyalarda kullanılır (çıktılar). Orijinal ve markalama dosyaları üstüne yazılır.

**Araçlar, hesaplar ve commit**
- Global kurulum yapılmaz:
  - `gcloud`, Google'ın resmi `google-cloud-cli` Docker imajında çalışır; ayarları repodaki git-ignored `.gcloud/` klasöründe tutulur.
  - EAS ve Supabase CLI'ları `npx` ile çalışır.
  - Xcode her komutta `DEVELOPER_DIR` ile seçilir.
- Hesapları, şifreleri ve anahtarları kullanıcı açar ve girer:
  - Kimlik bilgileri yazdırılmaz.
  - Sırlar git-ignored dosyalarda (`.env.cloud`) ya da servislerin kendi sır depolarında durur.
- Para harcatan her adım önce kullanıcıya sorulur: ücretli plan açmak, Photoroom çağrısı, EAS'in ücretli derleme kotası.
- Mağaza formlarını (gizlilik etiketleri, veri güvenliği, içerik derecelendirmesi) kullanıcı doldurur; plan içeriklerini README'de listeler.
- Telefonlardaki izin pencerelerini kullanıcı yanıtlar.
- Commitleri kullanıcı atar. Her görev değişen dosyalar ve önerilen mesajla biter; `git commit` çalıştırılmaz.
- Entegrasyon testleri Node 26 `node:test` ile yazılır (spec 16).

## Review Focus

1. **İmzalı URL'ler Sentry'ye sızmamalı:** Supabase'in imzalı depo linkleri anahtarı sorgu kısmında taşır; ağ kayıtlarıyla Sentry'ye giderse fotoğraflar herkese açılır. → Task 5, `scrubUrl removes the token of a signed storage URL`.
2. **Yanlış yapılandırılmış mağaza derlemesi çıkmamalı:** Yerel Supabase adresiyle ya da hukuki linkler olmadan yapılan derleme EAS'te başlamadan durmalı. → Task 6, kötü ortam değişkenleriyle `eas-pre-install.sh` 1 ile çıkar.
3. **Seçimde işlenmemiş ya da başarısız fotoğraf varken dışa aktarma:**
   - Yalnız seçilen sürümü olan fotoğraflar, doğru sırada ve adla verilmeli.
   - Hiçbiri yoksa açık bir mesaj görünmeli.
   - → Task 2, `test_export_skips_photos_without_the_version`; Task 4, `exportItems keeps listing order and skips photos without the chosen version`.
4. **Fotoğraf izni reddedilince:** Hiçbir şey indirilmemeli; "Einstellungen öffnen" ile açık bir mesaj görünmeli. → Task 4, `saveToPhotos reports denied without downloading anything`.
5. **Servis uyurken ya da ulaşılamazken link istemek:** Cloud Run soğuk başlar ya da düşerse istek askıda kalmamalı. Fonksiyon 502 `worker_unreachable` dönmeli, uygulama anlaşılır bir mesaj göstermeli. → Task 3, `the worker being down answers 502 worker_unreachable`.

---

### Task 1: Araç kataloğunu migration'a taşı

**Files:**
- Create: `supabase/migrations/20261116000001_vehicle_catalog.sql`
- Modify: `supabase/seed.sql` (katalog bloğu çıkar, yalnız geliştirme hesapları ve galeriler kalır)
- Test: `supabase/tests/database/core.test.sql` (bir assertion)

**Interfaces:**
- Produces: `makes` ve `models` tabloları her yeni veritabanında, seed olmadan da dolu gelir.

- [ ] **Adım 1: Başarısız testi yaz**

`core.test.sql`'e eklenir. Test, katalogun migration'dan geldiğini seed'in yokluğunda gösteremez. Bu yüzden ikinci kontrol Adım 4'teki dosya kontrolüdür.

```sql
select ok((select count(*) from public.makes) >= 30 and exists (select 1 from public.makes where name = 'Volkswagen'),
  'the vehicle catalog comes with the migrations');
```

- [ ] **Adım 2: Katalog bloğunu migration'a taşı**

Bloğun aynısı taşınır, `on conflict do nothing` ile tekrar çalıştırılabilir hale gelir. Yerel veritabanına `npx supabase migration up` ile uygulanır; yerel veri silinmez.

- [ ] **Adım 3: Testleri çalıştır**

Run: `npm run db:test`
Expected: PASS (58 + 1)

- [ ] **Adım 4: Seed'de katalog kalmadığını doğrula**

Run: `grep -c "insert into public.makes" supabase/seed.sql`
Expected: `0`

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `upd-vehicle-catalog-migration`.

---

### Task 2: Servisin `/export` uç noktası

**Files:**
- Create: `services/image-worker/worker/export.py`
- Modify: `services/image-worker/worker/app.py` (yeni rota; mevcut `Store.download` ve `Store.upload` yeter)
- Test: `services/image-worker/tests/test_export.py`

**Interfaces:**
- Produces:
  - `POST /export`, `X-Worker-Secret` başlığıyla. Gövde `{vehicle_id, version: 'watermarked'|'plain'|'originals', photo_ids: string[]}` (sıralı, en çok 40).
    - 200 `{path, count, bytes}`
    - 409 `{detail: 'nothing_to_export'}`
    - 401
  - `export_name(index: int, slot: str) -> str` → `f"{index + 1:02d}_{slot}.jpg"`
  - `build_export(store, vehicle_id, version, photo_ids) -> dict` → `{path, count, bytes}`
    - ZIP `ZIP_STORED` ile yazılır; JPEG'ler zaten sıkıştırılmış.
    - Yol `processed` kovasında: `{gallery}/{vehicle}/exports/{version}.zip`, `application/zip`, üstüne yazar.
    - Fotoğraf satırları servis rolüyle okunur. Sıra `photo_ids` sırasıdır.
    - Bu araca ait olmayan ya da sürümü bulunmayan fotoğraflar atlanır.

- [ ] **Adım 1: Başarısız testleri yaz** (M2a'nın sahte `Store`'u ile)

```python
def test_export_names_follow_the_given_order(): ...          # ['p2','p1'] → ['01_front.jpg', '02_front_left_45.jpg']
def test_export_skips_photos_without_the_version(): ...     # watermarked: failed/unprocessed and other-vehicle photos left out; count == 1
def test_export_of_nothing_is_refused(): ...                 # none usable → raises NothingToExport; HTTP 409 nothing_to_export
def test_originals_come_from_the_originals_bucket(): ...
def test_export_needs_the_worker_secret(): ...               # 401 without X-Worker-Secret
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör** — `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_export.py -q`

- [ ] **Adım 3: Yaz.** `/export` eşzamanlıdır: ZIP'i yapar, yükler ve yanıtlar. `/process` gibi arka plana atılmaz, çünkü Edge Function linki hemen ister.

- [ ] **Adım 4: Tüm servis testleri** — `services/image-worker/.venv/bin/python -m pytest services/image-worker -q` → PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-export-worker`.

---

### Task 3: `export-vehicle` Edge Function

**Files:**
- Create: `supabase/functions/export-vehicle/index.ts`
- Test: `supabase/tests/integration/export-vehicle.test.ts`

**Interfaces:**
- Consumes: Task 2'nin `/export` uç noktası ve `WORKER_URL` / `WORKER_SECRET` (M2a ile aynı).
- Produces: `POST export-vehicle` gövdesi `{vehicleId, version, photoIds}`:
  - 200 `{url, expiresAt, count}`
  - 400 `bad_request`: sürüm bilinmiyor, liste boş, 40'tan fazla ya da kimlik UUID değil.
  - 401, 403 `not_member`
  - 409 `nothing_to_export`
  - 502 `worker_unreachable`: istek 120 saniyede yanıt almazsa, ağ hatasında ya da servis 5xx dönerse.
  - Link `processed` kovasına 604 800 saniyelik imzalı URL'dir.
    - İndirme adı `zipName(make, model)` → `VW-Golf.zip` (aksanlar sadeleşir, harf ve rakam dışı karakterler `-` olur).
    - Personel de link alabilir; dışa aktarma sahip işlemi değildir.

- [ ] **Adım 1: Başarısız testleri yaz** (M2a'nın `process-vehicle` testlerindeki gibi 8090'da sahte servis)

```ts
test('a member gets a 7-day link to the ZIP the worker built', ...)   // fake worker uploads a tiny ZIP; url downloads bytes starting "PK"; expiresAt ≈ now + 7 d
test('staff can export too', ...)
test("another gallery's vehicle cannot be exported", ...)             // 403 not_member
test('an unknown version or an empty list is refused', ...)           // 400 bad_request
test('nothing usable answers 409 nothing_to_export', ...)             // fake worker answers 409
test('the worker being down answers 502 worker_unreachable', ...)     // fake worker closed
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `npx supabase stop && npm run db:start`, ardından `npm run test:int` (gerçek servis kapalıyken).
Expected: yeni testler FAIL (404).

- [ ] **Adım 3: Yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: `npm run test:int && npm run db:test`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-export-function`.

---

### Task 4: Uygulamada dışa aktarma

**Files:**
- Create:
  - `apps/mobile/src/export/plan.ts`, `apps/mobile/src/export/save.ts`, `apps/mobile/src/export/api.ts`
  - `apps/mobile/src/app/(app)/vehicles/[id]/export.tsx`
- Modify:
  - `apps/mobile/package.json` (`expo-media-library`, `expo-sharing`), `app.json` (eklenti ve izin metni)
  - `studio.tsx` ("Exportieren"), `photo/[photoId].tsx` ("Teilen"), `_layout.tsx`, `locales`
- Test: `apps/mobile/src/export/{plan,save}.test.ts`, `apps/mobile/src/export/api.int.test.ts`

**Interfaces:**
- Consumes: M2b'nin `StudioPhoto` tipi, `orderPhotos`, `studioApi.signedUrls`; Task 3'ün fonksiyonu.
- Produces:
  - `type ExportVersion = 'watermarked' | 'plain' | 'originals'`
  - `exportName(index: number, slot: Slot): string`
  - `exportItems(photos: StudioPhoto[], version: ExportVersion, selected?: ReadonlySet<string>): { photoId: string; bucket: 'processed' | 'originals'; path: string; name: string }[]`
    - İlan sırasıyla döner.
    - İşlenmiş sürümlerde yalnız `done` ve yolu olan fotoğraflar girer; filigranlı sürümde `output_wm_path`, filigransızda `output_path` kullanılır.
    - Orijinallerde bütün fotoğraflar girer.
  - `saveToPhotos(items, deps: SaveDeps, onProgress?: (done: number) => void): Promise<{ status: 'denied' } | { status: 'done'; saved: number; failed: number }>`
    - `deps` gerçek modülleri sarar, testte sahtesi verilir: `requestPermission`, `signedUrl`, `download`, `saveToLibrary`, `remove`.
    - İzin yalnız yazma için istenir (`writeOnly`).
  - `createExportLink(client, { vehicleId, version, photoIds }): Promise<{ url: string; expiresAt: string; count: number } | { error: 'not_member' | 'nothing_to_export' | 'worker_unreachable' | 'offline' | 'internal' }>`

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('exportName numbers from 01', ...)                                                     // (0,'front_left_45') → '01_front_left_45.jpg'
test('exportItems keeps listing order and skips photos without the chosen version', ...)   // failed + unprocessed out for watermarked/plain; all in for originals
test('exportItems honours the selection but keeps listing numbers dense', ...)              // 3 of 5 selected → 01..03
test('saveToPhotos reports denied without downloading anything', ...)                       // download never called
test('saveToPhotos counts a photo that could not be saved and carries on', ...)             // 3 items, 1 download throws → saved 2, failed 1; temp files removed
```
Entegrasyon (`api.int.test.ts`): `createExportLink` gerçek fonksiyona gider ve 8090'daki sahte servisle `url` döner; başka galeride `{ error: 'not_member' }`.

- [ ] **Adım 2: Testlerin başarısız olduğunu gör** — `cd apps/mobile && npx jest src/export`

- [ ] **Adım 3: Paketleri kur ve yaz**

Run: `cd apps/mobile && npx expo install expo-media-library expo-sharing`

`app.json`:
- `expo-media-library` eklentisi:
  - `photosPermission`, `expo-image-picker`'ınkiyle aynı metindir; iki eklenti aynı anahtarı yazar.
  - `savePhotosPermission` yukarıdaki metindir.
  - `isAccessMediaLocationEnabled: false`, `granularPermissions: ['photo']`.

Ekran:
- Üstte sürüm seçimi (`Segmented`: "Mit Wasserzeichen" / "Ohne Wasserzeichen" / "Originale").
- Altında seçilebilir küçük resimler; hepsi seçili gelir, "Alle" / "Keine" düğmeleri var.
- Ana eylem "In Fotos sichern ({{count}})". İkincisi "Download-Link teilen": paylaşma menüsünü açar, metin linki ve geçerlilik tarihini taşır.
- Kayıt sırasında "{{done}} von {{count}} gesichert" gösterilir.
- İzin reddinde mesaj ve `Linking.openSettings()` düğmesi gösterilir.

Diğer ekranlar:
- Stüdyoda en az bir fotoğraf işlenmişse "Exportieren" görünür.
- Fotoğraf ekranındaki "Teilen" filigranlı sürümü (yoksa düz sürümü) önbelleğe indirir ve `Sharing.shareAsync` ile paylaşır.

- [ ] **Adım 4: Yeni geliştirme derlemesi ve testler**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`, ardından `npx expo prebuild --clean` ve README'deki Android ve iOS derleme komutları.

Emülatörde kontrol edilenler:
- Seçili 3 fotoğraf Fotoğraflar'a `01_…`, `02_…`, `03_…` adlarıyla kaydedilir. Fotoğraf izni penceresine kullanıcı basar.
- Link paylaşma menüsünde görünür; bilgisayarda açılınca ZIP iner.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-export-screen`.

---

### Task 5: Sentry (uygulama ve servis)

**Files:**
- Create: `apps/mobile/src/lib/telemetry.ts`, `services/image-worker/worker/telemetry.py`
- Modify:
  - Uygulama: `apps/mobile/package.json`, `app.json` (eklenti), `metro.config.js` (`getSentryExpoConfig`), `src/app/_layout.tsx` (başlatma ve `Sentry.wrap`)
  - Servis: `services/image-worker/requirements.txt` (`sentry-sdk[fastapi]`), `worker/main.py`, `worker/pipeline.py` (iç hatalar yakalanır), `.env.example` (`SENTRY_DSN`)
- Test: `apps/mobile/src/lib/telemetry.test.ts`, `services/image-worker/tests/test_telemetry.py`

**Interfaces:**
- Produces:
  - `scrubUrl(url: string): string`: sorgu ve parça kısmı silinir, yol kalır.
  - `scrubBreadcrumb(b: Breadcrumb): Breadcrumb`: `data.url` ve `data.to`/`from` alanlarını `scrubUrl`'den geçirir.
  - `telemetryOptions(dsn: string | undefined, isDev: boolean): SentryOptions`
    - `enabled`, DSN varsa ve geliştirme değilse açıktır.
    - Diğer seçenekler: `sendDefaultPii: false`, `attachScreenshot: false`, `attachViewHierarchy: false`, `beforeBreadcrumb: scrubBreadcrumb`.
  - `init_sentry(dsn: str | None) -> bool` (Python): `send_default_pii=False`, `before_send=scrub_event`.
  - `scrub_event(event, hint)`: istekteki sorgu dizesini ve `X-Worker-Secret` / `Authorization` başlıklarını siler.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('scrubUrl removes the token of a signed storage URL', ...)   // .../object/sign/processed/g/v/p/out.jpg?token=abc → no "token"
test('breadcrumbs of fetches lose their query strings', ...)
test('Sentry stays off without a DSN and in development', ...)
```
```python
def test_scrub_event_drops_secret_headers_and_query(): ...
def test_no_dsn_means_no_sentry(): ...
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör, paketleri kur, yaz, geçtiğini gör**

Run: `cd apps/mobile && npx expo install @sentry/react-native && npx jest src/lib/telemetry.test.ts`, ardından `services/image-worker/.venv/bin/pip install -r services/image-worker/requirements.txt && services/image-worker/.venv/bin/python -m pytest services/image-worker -q`

Expo eklentisi: `["@sentry/react-native/expo", {"url": "https://de.sentry.io/"}]`. Kuruluş ve proje adları koda girmez; kaynak haritası yüklemesi onları EAS'teki `SENTRY_ORG` ve `SENTRY_PROJECT` değişkenlerinden okur (Task 11).

- [ ] **Adım 3: Yerelde DSN yokken uygulamanın ve servisin değişmeden çalıştığını doğrula** — emülatörde giriş ve stüdyo açılır, Sentry'ye istek gitmez (Metro günlüğünde `sentry` uyarısı yok).

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `add-sentry`.

---

### Task 6: Sürüm yapılandırması, hukuki linkler ve EAS dosyaları

**Files:**
- Create:
  - `apps/mobile/eas.json`, `apps/mobile/scripts/eas-pre-install.sh`, `.easignore` (repo kökünde)
  - `apps/mobile/src/lib/legal.ts`
- Modify:
  - `apps/mobile/package.json` (`eas-build-pre-install` betiği)
  - `app.json` (`ios.config.usesNonExemptEncryption: false`)
  - `src/app/(auth)/sign-in.tsx` (alt linkler), `src/app/(app)/account.tsx` (linkler), `locales`
  - `.gitignore` (`.gcloud/`, `.env.cloud`)

**Interfaces:**
- Produces:
  - `legalLinks(): { key: 'privacy' | 'imprint'; url: string }[]`: `EXPO_PUBLIC_PRIVACY_URL` ve `EXPO_PUBLIC_IMPRINT_URL`'den okunur, boş olanlar atlanır. Linkler `WebBrowser.openBrowserAsync` ile açılır.
  - `eas.json` profilleri:
    - `development`: geliştirme istemcisi, internal.
    - `preview`: internal, Android APK.
    - `production`: mağaza, `autoIncrement`.
    - `cli.appVersionSource: "remote"`.
    - `submit.production.android.track: "alpha"` (Play kapalı test).
  - `eas-pre-install.sh`:
    - `EAS_BUILD_PROFILE` `preview` ya da `production` ise şunları denetler:
      - `EXPO_PUBLIC_SUPABASE_URL` `https://` ile başlar, `127.0.0.1`, `localhost` ya da `10.0.2.2` içermez.
      - `EXPO_PUBLIC_SUPABASE_ANON_KEY` boş değildir.
      - `EXPO_PUBLIC_PRIVACY_URL` ve `EXPO_PUBLIC_IMPRINT_URL` `https://` ile başlar.
    - Biri tutmazsa nedenini yazar ve 1 ile çıkar.
    - Yalnız EAS'te (`EAS_BUILD=true`):
      - iOS'ta Metal araç zinciri yoksa `xcodebuild -downloadComponent MetalToolchain` çalışır.
      - Android'de `GLSLC_DIR`, `$ANDROID_NDK_HOME/shader-tools/linux-x86_64` yapılır (README "Derleme gereksinimleri").
  - `.easignore`: `.gitignore`'un içeriğine ek olarak `spikes/`, `services/`, `supabase/`, `docs/`.

- [ ] **Adım 1: Betiği kötü ve iyi ortamla dene (önce betik yokken başarısız)**

```bash
EAS_BUILD_PROFILE=production EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=x EXPO_PUBLIC_PRIVACY_URL=https://a EXPO_PUBLIC_IMPRINT_URL=https://b bash apps/mobile/scripts/eas-pre-install.sh; echo $?
```
Expected: önce "No such file", yazıldıktan sonra yerel adres uyarısı ve `1`. Aynı komut `https://abc.supabase.co` ile `0` verir. `EAS_BUILD_PROFILE=development` her zaman `0` verir.

- [ ] **Adım 2: Yaz.** Giriş ekranının altında ve hesap ekranında iki link durur. Yerelde ortam değişkeni yoksa görünmezler.

- [ ] **Adım 3: Testler** — `cd apps/mobile && npx tsc --noEmit && npx jest` → PASS

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `add-release-config`.

---

### Task 7: M2b'den kalanlar, stüdyo durumları ve hata mesajları

**Files:**
- Modify:
  - `apps/mobile/src/studio/status.ts`, `api.ts`
  - `src/app/(app)/vehicles/[id]/studio.tsx`, `photo/[photoId].tsx`, `plates.tsx`
  - `locales`
- Test: `status.test.ts`, `apps/mobile/src/studio/api.test.ts` (yeni, sahte istemciyle)

**Interfaces:**
- Produces:
  - `processBlocker` `pendingUploads: number | null` alır. `null` (yerel sayım henüz okunmadı) iken `'checking'` döner; "Bearbeiten" kapalıdır, mesaj yoktur.
  - `startProcessing` `FunctionsRelayError`'ı (fonksiyon çöktü ya da açılamadı) `'internal'` olarak döner. Yalnız `FunctionsFetchError` `'offline'` döner.
  - `studio.errors.no_credit_owner`: sahip için kredi metni (Global Constraints).

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('processBlocker waits while the local upload count is unknown', ...)   // pendingUploads null → 'checking'
test('a crashed function reads as an internal error, not as offline', ...)  // fake invoke returns FunctionsRelayError → { error: 'internal' }
```

- [ ] **Adım 2: Gör, yaz, geçtiğini gör** — `cd apps/mobile && npx jest src/studio`

Ekranlardaki değişiklikler (testle değil emülatörde doğrulanır):
- Stüdyo yüklenemezse sebebe göre mesaj gösterilir: çevrimdışıysa `studio.blocked.offline`, değilse yeni `studio.loadFailed`. Yanında "Erneut versuchen" vardır. Fotoğraf ekranı boş kalmaz, aynı mesajı gösterir.
- Arka plan ve ton değişikliği başarısız olursa mesaj gösterilir. Çevrimdışıyken örnek kutuları ve ton anahtarı kapalıdır.
- Kredi bitince sahip `no_credit_owner`, personel mevcut metni görür (`canManageGallery`).
- Tek fotoğraf modunda plaka işlendikten sonra ekran kendiliğinden fotoğrafa döner (`router.back()`).

- [ ] **Adım 3: Testler ve emülatör** — `npx tsc --noEmit && npx jest`; emülatörde çevrimdışı açılış ve kredisiz sahip denenir.

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `upd-studio-states`.

---

### Task 8: M2b'den kalanlar, veri yükü ve küçük düzeltmeler

**Files:**
- Create: `apps/mobile/src/lib/coalesce.ts`
- Modify:
  - Stüdyo: `apps/mobile/src/studio/useStudio.ts`, `useCovers.ts`, `api.ts` (`saveAndRender`), `src/app/(app)/vehicles/[id]/touch-up.tsx`
  - Personel: `src/app/(app)/gallery/members.tsx`
  - Diğer: `src/studio/edits.ts` (biçim), `locales` (çoğullar), `README.md` (eski geliştirme derlemesi notu)
- Test: `apps/mobile/src/lib/coalesce.test.ts`, `apps/mobile/src/studio/edits.test.ts` ya da `api.test.ts`

**Interfaces:**
- Produces:
  - `coalesce(fn: () => void, ms: number): { call(): void; cancel(): void }`: `ms` içindeki çağrılar tek çağrıya iner. `useStudio` Realtime olaylarında 250 ms ile kullanır. Geç gelen eski yanıt, sıra numarasıyla atılır.
  - `saveAndRender(api, { vehicleId, photoId, edits, previous })`:
    - Önce kaydeder, sonra yeniden çizdirir.
    - Yeniden çizim kuyruğa girmezse eski düzenlemeleri geri yazar ve hatayı fırlatır.
    - Böylece "Verwerfen" kaydı değişmemiş bırakır.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('coalesce turns a burst of calls into one', ...)                              // fake timers: 5 calls in 100 ms → 1 call after 250 ms
test('a touch-up whose re-render fails puts the earlier edits back', ...)          // fake api: renderPhoto throws → saveMaskEdits called with previous; error rethrown
```

- [ ] **Adım 2: Gör, yaz, geçtiğini gör** — `cd apps/mobile && npx jest src/lib/coalesce.test.ts src/studio`

Testsiz küçük düzeltmeler (her biri ledger'da tek satır):
- **Kapaklar:** `useCovers` sayfalar (`readAll`, `sync/remote.ts`).
- **Davet:** Alan Enter ile gönderilirken `busy` korunur.
- **Çoğullar:** `studio.blocked.uploading_one` / `_other` üç dilde.
- **README:** Eski bir geliştirme derlemesinin yeni yerel modüllerle açılışta düştüğünü yazar.
- **Biçim:** `edits.ts` biçim düzeltmesi.

- [ ] **Adım 3: Testler** — `npx tsc --noEmit && npx jest && cd ../.. && npm run test:int:mobile` → PASS

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `upd-studio-load-fixes`.

---

### Task 9: Supabase bulut projesi (Frankfurt)

**Files:**
- Modify:
  - `supabase/config.toml`: `[auth.email.smtp]` bölümü `env()` ile; `site_url` üretim değeri.
  - `README.md`: yeni "Üretim" bölümü, Supabase adımları.
- Create: `.env.cloud.example` (git-ignored `.env.cloud`'un şablonu: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SMOKE_EMAIL`; şifre ve servis anahtarı dosyaya yazılmaz, terminalde girilir)

**Interfaces:**
- Consumes: Task 1'in migration'ı, Task 3'ün fonksiyonu.
- Produces:
  - Proje referansı ve `https://<ref>.supabase.co`.
  - Migration'ları, kovaları, Realtime yayını, Auth ayarları (kayıt kapalı, 6 haneli kod, 24 saat) ve Almanca şablonlarıyla dolu bir veritabanı.
  - Dört fonksiyon dağıtılmış olur: `process-vehicle`, `delete-account`, `gallery-members`, `export-vehicle`.
  - "Bambu Demo" galerisi ve demo sahibi, Apple ve Google incelemesi ile duman testi için.

- [ ] **Adım 1 (kullanıcı):**
  - Supabase'te kuruluşu ve `bambu-car-app` projesini Frankfurt'ta açar. Pro plan ayda yaklaşık 25 $ tutar; açmadan önce onaylanır.
  - Terminalde `npx supabase login` yapar ve proje referansını verir.
  - SMTP bilgilerini (sunucu, port, kullanıcı, gönderen adres) verir; şifreyi kendi terminalinde ortam değişkeni olarak girer.

- [ ] **Adım 2: Bağla ve migration'ları gönder**

Run: `npx supabase link --project-ref <ref>` (veritabanı şifresini kullanıcı girer), `npx supabase db push --dry-run`, ardından `npx supabase db push`
Expected: dry-run bütün migration'ları listeler; push hatasız biter. Panelin SQL editöründe `select count(*) from makes` 30'dan büyüktür.

- [ ] **Adım 3: Auth ayarları ve e-posta**

Run: `npx supabase config push`

Doğrulama:
- Panelde kayıt kapalıdır, OTP uzunluğu 6, süresi 86 400 saniyedir; şablonlar Almancadır.
- Kullanıcının kendi adresine panelden gönderilen davet, 6 haneli kodla gelir.
- `config push` şablonları göndermezse kullanıcı onları panele elle yapıştırır ve bu ledger'a yazılır.

- [ ] **Adım 4: Fonksiyonları dağıt ve sırları koy**

Run: `npx supabase functions deploy process-vehicle delete-account gallery-members export-vehicle`

Sırlar:
- `WORKER_SECRET`, kullanıcının terminalinde `openssl rand -hex 32` ile üretilir ve `npx supabase secrets set` ile girilir.
- `WORKER_URL`, Task 10'da girilir.

- [ ] **Adım 5: Demo galeri**

1. Kullanıcı demo sahibinin adresini davet eder.
2. SQL editöründe `select public.admin_create_gallery('Bambu Demo', '<adres>')` ve `select public.admin_grant_credits('<galeri id>', 5, 'Demo')` çalıştırılır.
3. Demo sahibi uygulamada daveti kabul eder.

- [ ] **Adım 6: Kullanıcıya devret** — önerilen mesaj: `add-supabase-cloud-setup`.

---

### Task 10: Cloud Run Frankfurt

**Files:**
- Create:
  - `scripts/gcloud.sh`: `google-cloud-cli` imajını sabit sürümle çalıştırır; `.gcloud/` ve repo bağlanır.
  - `services/image-worker/.gcloudignore`: `models/` gönderilir; `.venv`, `tests`, `out` gönderilmez.
- Modify: `README.md` ("Üretim", Cloud Run adımları)

**Interfaces:**
- Consumes: Task 2 ve 5'in servisi, Task 9'un Supabase adresi.
- Produces: `https://bambu-image-worker-<hash>-ey.a.run.app`; Supabase'te `WORKER_URL` sırrı.

- [ ] **Adım 1 (kullanıcı):** Google Cloud'da faturalandırması açık bir proje açar ve kimliğini verir. Ardından `scripts/gcloud.sh auth login --no-launch-browser` ile kendi terminalinde giriş yapar.

- [ ] **Adım 2: API'leri aç ve sırları koy**

Run: `scripts/gcloud.sh services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com`

Sırlar (`photoroom-api-key`, `worker-secret`, `supabase-service-role-key`, `sentry-dsn-worker`):
- Kullanıcı kendi terminalinde `printf %s "<değer>" | scripts/gcloud.sh secrets create <ad> --data-file=-` ile girer.
- Değerler bu oturumda yazdırılmaz.

- [ ] **Adım 3: Plaka modelinin yerelde olduğunu doğrula ve dağıt**

Run:
1. `ls services/image-worker/models/plate_rtdetrv2.onnx`
2. Dağıtım:

```bash
scripts/gcloud.sh run deploy bambu-image-worker --source services/image-worker --region europe-west3 \
  --no-cpu-throttling --cpu 2 --memory 2Gi --concurrency 2 --min-instances 0 --max-instances 3 --timeout 900 \
  --allow-unauthenticated --set-env-vars SUPABASE_URL=https://<ref>.supabase.co \
  --set-secrets PHOTOROOM_API_KEY=photoroom-api-key:latest,WORKER_SECRET=worker-secret:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,SENTRY_DSN=sentry-dsn-worker:latest
```

Notlar:
- `--no-cpu-throttling` şarttır: `/process` 202 döndükten sonra araç arka planda işlenir.
- Servis herkese açık adreste çalışır; istekleri `X-Worker-Secret` ile korunur.

- [ ] **Adım 4: Doğrula ve bağla**

Run: `curl -s https://<url>/health` → `{"ok":true}`; `curl -s -o /dev/null -w '%{http_code}' -X POST https://<url>/process -H 'content-type: application/json' -d '{}'` → `401`
Ardından kullanıcı `npx supabase secrets set WORKER_URL=https://<url>` girer.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-cloud-run-setup`.

---

### Task 11: Sentry hesabı ve EAS projesi

**Files:**
- Modify:
  - `apps/mobile/app.json`: `eas init` sonrası `extra.eas.projectId` ve `owner`.
  - `README.md`: "Üretim" bölümünde Sentry ve EAS ortam değişkenleri.

**Interfaces:**
- Produces: EAS projesi. `preview` ve `production` ortamlarında şu değişkenler:
  - Görünür: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_IMPRINT_URL`, `SENTRY_ORG`, `SENTRY_PROJECT`.
  - Gizli: `SENTRY_AUTH_TOKEN`.

- [ ] **Adım 1 (kullanıcı):**
  - Sentry'de AB veri bölgesinde (de.sentry.io) bir kuruluş açar. İçinde `bambu-car-app` (React Native) ve `bambu-image-worker` (Python) projeleri ile kaynak haritası için bir auth token oluşturur.
  - Expo hesabıyla `npx eas-cli login` yapar.
  - Bambu Games'ten gizlilik metni ve künye adreslerini verir.

- [ ] **Adım 2: EAS projesini bağla ve değişkenleri gir**

Run: `cd apps/mobile && npx eas-cli init`, ardından kullanıcı `npx eas-cli env:create` ile değişkenleri girer (`SENTRY_AUTH_TOKEN` gizli görünürlükte).
Expected: `npx eas-cli env:list --environment production` yedi görünür ve bir gizli değişkeni listeler, gizlinin değeri gösterilmez.

- [ ] **Adım 3: Servisin Sentry'ye ulaştığını doğrula**

Run: servis imajında, kullanıcının terminalinde `SENTRY_DSN` verilerek:

```bash
python -c "import sentry_sdk; sentry_sdk.init(dsn=__import__('os').environ['SENTRY_DSN']); sentry_sdk.capture_message('M2c worker check'); sentry_sdk.flush()"
```
Expected: olay `bambu-image-worker` projesinde görünür. Yalnız bir kez yapılır.

- [ ] **Adım 4: EAS arşivini incele**

Run: `cd apps/mobile && npx eas-cli build:inspect --platform android --stage archive --output /tmp/eas-archive`
Expected: arşivde `spikes/`, `services/` ve `.env` yok, boyutu yüzlerce MB değil.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-eas-sentry-setup`.

---

### Task 12: Bulutta duman testi

**Files:**
- Create: `scripts/smoke-cloud.mjs`
- Modify: `README.md` ("Üretim", duman testi)

**Interfaces:**
- Consumes: Task 3, 9, 10.
- Produces: `node scripts/smoke-cloud.mjs <fotoğraf.jpg>`. `.env.cloud`'dan adresi, anon anahtarını ve demo adresini okur; şifreyi `SMOKE_PASSWORD` ortam değişkeninden alır. Adımlar:
  1. Demo sahibiyle girer.
  2. Bir araç açar, fotoğrafı `front` olarak yükler ve fotoğraf satırını ekler.
  3. `process-vehicle`'ı çağırır, 3 dakika içinde `done` olmasını bekler.
  4. `export-vehicle` ile filigranlı ZIP linkini alır, indirir ve `PK` ile başladığını ve içinde `01_front.jpg` olduğunu denetler.
  5. Aracı arşivler.
  - Çıktıda anahtar ya da token yoktur.

- [ ] **Adım 1: Kullanıcıya sor.** Bir Photoroom çağrısı (≈ 0,02 $) ve demo galeriden 1 kredi harcanır.

- [ ] **Adım 2: Çalıştır**

Run: `node scripts/smoke-cloud.mjs spikes/data/photos/03-volvo-c70-meet-front.jpg`
Expected: `ok: processed in <n>s, zip <bytes> bytes, 1 file`

- [ ] **Adım 3: Kullanıcıya devret** — önerilen mesaj: `add-cloud-smoke-test`.

---

### Task 13: TestFlight ve Google Play kapalı test

**Files:**
- Modify:
  - `apps/mobile/eas.json`: `submit.production.ios.ascAppId`.
  - `README.md`: "Mağaza ve test dağıtımı" bölümü, adımlar ve kullanıcının dolduracağı formların içeriği.

**Interfaces:**
- Produces: TestFlight'ta ve Play kapalı testinde (`alpha` kanalı) kurulabilir bir 1.0.0 sürümü.

- [ ] **Adım 1 (kullanıcı):**
  - App Store Connect'te `com.bambugames.carapp` uygulama kaydını açar ve `ascAppId`'yi verir. EAS'e App Store Connect API anahtarını `npx eas-cli credentials` ile kendisi girer.
  - Play Console'da `com.bambugames.carapp` uygulamasını ve kapalı test kanalını açar.

- [ ] **Adım 2: İlk mağaza derlemeleri.** EAS'in ücretsiz derleme kotası kontrol edilir ve kullanıcıya söylenir.

Run: `cd apps/mobile && npx eas-cli build --platform all --profile production`
Expected:
- İki derleme de geçer. `eas-pre-install.sh` adımları ve Sentry kaynak haritası yüklemesi günlükte görünür.
- Bir platform düşerse sebep düzeltilir ve ledger'a yazılır. Beklenen yerler: NDK `glslc`, Metal araç zinciri.

- [ ] **Adım 3: Yükle**

Run: `npx eas-cli submit --platform ios --latest`
Android:
- Google ilk sürümü yalnız elle kabul eder: kullanıcı ilk AAB'yi Play Console'dan kapalı teste yükler.
- Sonraki sürümler, kullanıcının oluşturduğu servis hesabı anahtarıyla `npx eas-cli submit --platform android --latest` ile yüklenir.

- [ ] **Adım 4 (kullanıcı): Mağaza formları.** README'deki listeye göre doldurulur:
  - App Store Connect:
    - App Privacy: e-posta adresi (hesap), fotoğraflar (uygulama işlevi), çökme ve tanılama verileri (Sentry); izleme yok.
    - Gizlilik URL'si.
    - Şifreleme: yalnız standart.
    - Test bilgileri: demo hesap, Task 9.
  - Play Console:
    - Veri güvenliği formu (App Privacy ile aynı içerik).
    - Gizlilik politikası URL'si.
    - Uygulama erişimi (demo hesap), içerik derecelendirmesi, reklam yok.
    - Hesap silme bağlantısı: Bambu Games'in sayfası ya da e-posta adresi.
    - Test kullanıcılarının listesi.
  - Pilot galeri personeli dış test kullanıcısı olarak eklenir. TestFlight'ta bu, Apple'ın beta incelemesinden sonra açılır.
  - AB'deki genel App Store yayını için satıcı (trader) bilgisi gerekir (spec 12). TestFlight için gerekmez; genel yayın bu planda yok.

- [ ] **Adım 5: Doğrula.** Kullanıcı TestFlight'tan ve Play kapalı testinden kurar, demo hesapla girer. Hesap ekranında iki hukuki link açılır.

- [ ] **Adım 6: Kullanıcıya devret** — önerilen mesaj: `add-store-release`.

---

### Task 14: Telefon turu (mağaza derlemeleriyle)

**Files:**
- Modify: `README.md` ("Elle uçtan uca kontrol" listesine dışa aktarma ve sürüm maddeleri)

- [ ] **Adım 1: Zamanı kullanıcıyla belirle.** Kullanıcı 16 Kasım 2026'da müsait değildi.

- [ ] **Adım 2: Turu yap.** iPhone 11, Galaxy A34 ve Tecno'da şunlar denenir:
  - M1b'nin bekleyen listesi.
  - M2b'nin listesi: bkz. hafızadaki telefon turu notu ve M1b ledger'ı.
  - M2c: kaydetme (izin penceresi, adlar, Fotoğraflar'da sıra), tek fotoğraf paylaşma, ZIP linkinin bilgisayarda açılması, hukuki linkler, Sentry'de oturum görünmesi.

- [ ] **Adım 3: Sonuçları yaz.** Düşen her madde ledger'a girer. Ayar ya da düzeltme gerekiyorsa ayrı bir plan yazılır.

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `upd-manual-checks-m2c`.
