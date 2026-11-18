# M3 Araç Bilgileri, Hasar Şeması, Ekspertiz Okuma ve İlan Metni Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Galeri bir aracın ilanını uygulamada baştan sona hazırlayabilsin:
- araç bilgileri (çevrimdışı da),
- hasar şeması,
- ekspertiz raporundan onaylı doldurma,
- Claude ile ilan metni.

İlan, sonraki projelerin (paylaşım, pazar yeri) üstüne kurulacağı gerçek bir kayıt olsun.

**Architecture:**
- **Veri:** Aranacak araç bilgileri `vehicles` tablosunda tipli kolonlarda, değerler mobile.de listelerinden. Donanım ve notlar `details` jsonb'de, hasar `damage` jsonb'de. Satış bilgileri `listings`, metinler `listing_texts`, rapor okumaları `report_reads` tablosunda.
- **Senkron:** Telefon veritabanı yeni kolonları ve `listings`'i bugünkü giden kutusuyla senkronlar.
- **Claude:** İki yeni Edge Function (`write-listing`, `read-report`) resmi `@anthropic-ai/sdk` ile çağırır; yapılandırılmış çıktı (JSON şeması) kullanılır.
- **Rapor temizliği:** Üçüncü bir fonksiyon (`clean-reports`) eski rapor dosyalarını günlük bir zamanlanmış işle siler.
- **Eşzamanlı düzenleme uyarısı:** Supabase Realtime Presence'ın özel kanallarıyla.

**Tech Stack:**
- **Uygulama:** Expo SDK 58 / RN 0.88, expo-router, expo-sqlite, @supabase/supabase-js 2, @shopify/react-native-skia 2.14, Jest 30.
- **Yeni paketler:** `expo-document-picker` (PDF seçimi), `expo-clipboard` (metni kopyalama). İkisi de Expo'nun MIT paketleri, `npx expo install` ile.
- **Sunucu:**
  - Supabase Edge Functions (Deno 2, `jsr:@supabase/supabase-js@2`),
  - `npm:@anthropic-ai/sdk` (yürütme anında en güncel sürüme sabitlenir),
  - `npm:zod`,
  - pg_cron + pg_net + Vault.
- **Testler:** pgTAP, Node 26 `node:test` entegrasyon testleri.

**Spec:** `docs/superpowers/specs/2026-11-18-m3-vehicle-details-listing-design.md` (onaylı, 18 Kasım 2026). Üst belge: `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (bölüm 8, 9, 12, 13).

**Plan sırası ve kararlar:**
- **Etiket tablosu yok:** Donanım ve değer listesi kodları Claude'a kod olarak gider (`seat_heating`, `hybrid_petrol`). Claude metni hedef dilde kendisi yazar; sunucuda ayrı bir etiket tablosu tutulmaz.
- **Listelerin iki kopyası:** Değer listelerinin tek doğru kaynağı uygulamadaki `src/domain/vehicleData.ts`'tir. `read-report` JSON şemasında aynı listeleri kullanmak zorunda olduğu için `supabase/functions/_shared/vehicleData.ts` aynı sabitleri taşır. Bir Jest testi ikisinin eşit olduğunu denetler.
- **Rapor kapatma uygulamadan:** Öneriler karara bağlanınca uygulama dosyaları kendisi siler ve `report_reads.suggestions`'ı boşaltır (RLS ile). Fonksiyon yalnız 7 günü aşan okumaları temizler.
- **Giden kutusunu boşaltma:** Sunucu çağrısından önce `SyncProvider`'ın yeni `flush()`'ı kullanılır. Bu `request()` ve `idle()` çağırır, ardından ilgili kayıtların giden kutusunda kalıp kalmadığına bakar.
- **Testlerde gerçek Claude yok:** Entegrasyon testleri `127.0.0.1:8091`'de sahte bir Messages API sunucusu çalıştırır. Fonksiyonlar `ANTHROPIC_BASE_URL` ile ona yönlenir. Gerçek Claude çağrısı yalnız Task 12'de, kullanıcının onayıyla yapılır.

## Global Constraints

**Arayüz ve metin**
- Arayüz Almanca, Türkçe ve İngilizce. Her yeni metin üç dil dosyasına (`src/locales/{de,tr,en}.json`) girer; `src/lib/i18n.test.ts` geçer.
  - Yeni üst anahtarlar: `vehicleData`, `damage`, `report`, `listing`.
  - `vehicle.details` zaten "detay fotoğrafları" için kullanılıyor; dokunulmaz.
- Tüm UI çalışmaları /no-slop-ui kuralına uyar. UI kodu yazmadan önce `no-slop-ui` skill'i yüklenir. Tema `src/ui/theme.ts`; mevcut `Button`, `Notice`, `Segmented`, `TextField`, `Screen` kullanılır.
- Kesinleşmiş Almanca metinler:
  - Presence uyarısı: "Wird gerade auf einem anderen Gerät bearbeitet" (ad biliniyorsa ": {{name}}" eklenir).
  - Bayat metin notu: "Die Fahrzeugdaten wurden nach dem Erstellen des Textes geändert." Düğme: "Neu erstellen".
  - Rapor yükleme notu: "Der Bericht wird zur Auswertung an Anthropic (USA) übermittelt. Die Datei wird gelöscht, sobald Sie die Vorschläge geprüft haben, spätestens nach 7 Tagen."
  - Hasar onayı düğmesi: "Alle Teile geprüft".

**Kod kuralları**
- React Compiler açık:
  - hook bağımlılıkları tetikleyici olarak kullanılmaz,
  - render içinde `Date.now()` okunmaz,
  - ref'lere yalnız effect ve callback içinde yazılır.
- Telefon veritabanı göçleri `src/local/db.ts` `MIGRATIONS` dizisinin sonuna eklenir; yayımlanmış bir girdi değiştirilmez.
- Sunucu fonksiyonları bugünkü kalıbı izler:
  - `json(status, body)` yardımcısı,
  - hata gövdesi `{ error: 'snake_code' }`,
  - kullanıcı istemcisi (`SUPABASE_ANON_KEY` + `Authorization`) ile RLS'e dayalı üyelik kontrolü, ayrıcalıklı işler için servis istemcisi,
  - girdiler `UUID` regex'iyle doğrulanır.
- Hata kodları:
  - `400 bad_request`, `401 unauthorized`, `403 not_member`,
  - `422 ai_refused`, `429 daily_limit`, `502 ai_failed`, `500 internal`.
  - Uygulama çağrılarında ağ hatası `offline` sayılır.

**Claude**
- **Çağrı:** Model `claude-opus-5-5`, `max_tokens: 16000`, `thinking` gönderilmez (Opus 5.5'te uyarlamalı düşünme hep açık).
- **Efor:** `write-listing` için `output_config.effort: 'medium'`, `read-report` için `'high'`.
- **Çıktı:** Yapılandırılmış çıktı `output_config.format` ile; şemalar zod'dan.
- **Reddetme yedeği:** Sunucu tarafı yedek açık: `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`.
- **Sonuç okuma:** `stop_reason === 'refusal'` ise `422 ai_refused` dönülür; içerik okunmadan önce `stop_reason` kontrol edilir.
- **SDK doğrulaması:** Yazmadan önce `claude-api` skill'i yüklenir; `typescript/claude-api/README.md` ve `tool-use.md`'nin "Structured Outputs" bölümü okunur. Yapılandırılmış çıktı ile `fallbacks`'in beta uç noktasında birlikte kullanımı kurulu SDK'ya göre doğrulanır; tahmin edilmez.
- **Anahtar ve gizlilik:**
  - `ANTHROPIC_API_KEY` yalnız fonksiyon sırlarında ve git-ignored `supabase/functions/.env`'de durur; yazdırılmaz.
  - İlan metni isteğine şasi numarası (`vin`) hiçbir biçimde girmez.

**Araçlar ve hesaplar**
- Global kurulum yapılmaz. Xcode her komutta `DEVELOPER_DIR=/Users/egemenderbedek/Downloads/Xcode-26.6.app/Contents/Developer` ile seçilir. Metro 8082'de, CI modu kapalı (`npx expo start --dev-client --port 8082`).
- **Gerçek Claude çağrısı ve Anthropic hesabı:**
  - Gerçek çağrı yalnız kullanıcı onayıyla yapılır.
  - Anthropic hesabını ve anahtarını kullanıcı açar ve girer.
  - Buluta migration ya da fonksiyon gönderme yalnız kullanıcı açıkça evet derse yapılır.
- Telefon ve simülatördeki izin pencerelerini kullanıcı yanıtlar.
- Commitleri kullanıcı atar. Her görev değişen dosyalar ve önerilen mesajla biter; `git commit` çalıştırılmaz.
- İş bitince arka planda çalışan her şey durdurulur: Supabase, servis konteyneri, sahte sunucular, Metro, simülatör, Docker.

**Test komutları**
- Uygulama: `cd apps/mobile && npx tsc --noEmit && npx jest`
- Veritabanı: `npm run db:test` (yerel Supabase açık)
- Fonksiyon entegrasyonu: `npm run test:int` (görüntü işleyici servis kapalı)
- Uygulama entegrasyonu: `npm run test:int:mobile`

## Review Focus

1. **İki cihaz aynı ilana çevrimdışı fiyat girer:** İkinci bir `listings` satırı oluşmamalı, son yazan kazanmalı. → Task 3, `two devices saving the same listing offline end in one row`.
2. **Claude geçersiz ya da listede olmayan bir değer önerir** (ör. `fuel: 'kerosene'`, `mileageKm: -5`, bilinmeyen donanım kodu): Öneri gösterilmemeli; kabul edilse bile senkronu kıran bir değer araca yazılmamalı. → Task 9 `read-report drops suggestions outside the value lists` ve Task 10 `applySuggestions ignores values the lists do not allow`.
3. **Onaysız hasar şeması ilan metnine "orijinal" diye girer:** `damage_checked_at` boşken metin isteğinde hasar bilgisi hiç olmamalı. → Task 7, `write-listing leaves damage out until the map is checked`.
4. **Rapor yüklenip uygulama kapatılır, öneriler hiç karara bağlanmaz:** 7 gün sonra dosyalar silinmeli, öneriler boşalmalı; daha yeni okumalara dokunulmamalı. → Task 11, `clean-reports removes only reads older than 7 days`.
5. **Kasa tipi işlenmiş bir sette değiştirilir:** Set ücretsiz yeniden çizilmeli; kredi düşmemeli, Photoroom çağrılmamalı. → Task 4, simülatör doğrulaması ve `start_processing` yeniden çizim çağrısının `p_rerender = true` ile yapıldığını gösteren `vehicleDataApi` testi.

---

### Task 1: Veritabanı — araç kolonları, ilan ve rapor tabloları, rapor kovası

**Files:**
- Create: `supabase/migrations/20261119000001_vehicle_details.sql`
- Create: `supabase/tests/database/details.test.sql`
- Modify: `apps/mobile/src/lib/database.types.ts` (`npm run db:types` ile üretilir)

**Interfaces:**
- Produces:
  - **`vehicles` yeni kolonları** (hepsi boş bırakılabilir): `variant text`, `first_registration date`, `mileage_km integer check (>= 0)`, `fuel text`, `transmission text`, `power_kw integer check (> 0)`, `displacement_ccm integer check (> 0)`, `drive text`, `color_exterior text`, `color_interior text`, `upholstery text`, `previous_owners integer check (>= 0)`, `hu_until date`, `accident_free boolean`, `service_book boolean`, `non_smoker boolean`, `vin text check (char_length(vin) = 17)`, `damage jsonb not null default '{}'`, `damage_checked_at timestamptz`.
  - **Değer kontrolleri:** Metin kolonlarının check listeleri Task 2'deki listelerle aynıdır.
  - **`listings`:**
    - kolonlar: `id uuid primary key references vehicles(id)`, `gallery_id uuid not null`, `status text not null default 'draft' check (status in ('draft'))`, `price_eur integer check (>= 0)`, `vat_deductible boolean`, `warranty_months integer check (>= 0)`, `location text`, `created_at`, `updated_at`;
    - `(id, gallery_id)` → `vehicles(id, gallery_id)` yabancı anahtarı,
    - `set_updated_at` tetikleyicisi.
  - **`listing_texts`:**
    - kolonlar: `listing_id uuid references listings(id)`, `gallery_id uuid not null`, `language text check (in ('de','tr','en'))`, `titles text[] not null`, `title text not null`, `description text not null`, `model text not null`, `generated_at timestamptz not null`, `edited boolean not null default false`, `updated_at`;
    - birincil anahtar `(listing_id, language)`.
  - **`report_reads`:** `id uuid pk default gen_random_uuid()`, `gallery_id`, `vehicle_id` (`(vehicle_id, gallery_id)` yabancı anahtar), `files text[] not null`, `status text check (in ('reading','done','failed'))`, `error text`, `suggestions jsonb`, `closed_at timestamptz`, `created_at timestamptz default now()`.
  - **Yetkiler (RLS):**
    - Üç tablo için de: galeri üyeleri okur.
    - `listings`: yazar.
    - `listing_texts`: `title`, `description` ve `edited` kolonlarını günceller (ekleme fonksiyondan, servis rolüyle yapılır).
    - `report_reads`: yalnız `suggestions` ve `closed_at`'i günceller.
    - Hiçbirinde silme yok.
  - **`vehicles` sütun hakları:** Ekleme ve güncelleme listesine yeni kolonlar eklenir. Liste `20261112000002_processing.sql:152-155`'teki gibi yeniden yazılır.
  - **Kova `reports`:**
    - özel, `file_size_limit = 20 MB`, `allowed_mime_types = {application/pdf,image/jpeg,image/png}`;
    - `storage.objects` politikaları: üyeler kendi galeri klasörlerinde okur, ekler ve siler (`private.is_gallery_folder`).

- [ ] **Adım 1: Başarısız pgTAP testlerini yaz** (`details.test.sql`, `plan(8)`). Her biri `set local role authenticated` ile seed'deki staff (Testgalerie) ve other (Andere Galerie) kullanıcılarıyla çalışır:
  1. Staff kendi aracına `mileage_km = 120000, fuel = 'diesel'` yazabilir.
  2. `fuel = 'kerosene'` ihlal hatası verir (`throws_ok ... '23514'`).
  3. `mileage_km = -1` ihlal hatası verir.
  4. Staff kendi aracı için bir `listings` satırı ekler.
  5. Aynı araç için ikinci bir `listings` satırı hata verir (`23505`).
  6. Other, Testgalerie'nin ilanını göremez (`is_empty`).
  7. `report_reads.files` güncellemesi staff için reddedilir (sütun hakkı yok).
  8. `reports` kovasının boyut sınırı ve MIME listesi doğru (`results_eq`).

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `npm run db:test`
Expected: FAIL (tablolar ve kolonlar yok).

- [ ] **Adım 3: Migration'ı yaz ve yerelde uygula**

Run: `npx supabase migration up && npm run db:types`
Expected: `Migrations applied`. `database.types.ts` yeni kolonları ve tabloları içerir.

- [ ] **Adım 4: Testleri çalıştır**

Run: `npm run db:test`
Expected: PASS (61 + 8).

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-vehicle-details-schema`.

---

### Task 2: Değer listeleri ve alan doğrulama

**Files:**
- Create: `apps/mobile/src/domain/vehicleData.ts`, `apps/mobile/src/domain/vehicleData.test.ts`
- Create: `supabase/functions/_shared/vehicleData.ts` (aynı sabitler, Deno'da import edilebilir saf TypeScript)
- Modify: `apps/mobile/src/domain/vehicle.ts` (`Vehicle` tipi genişler)
- Modify: `apps/mobile/src/locales/{de,tr,en}.json` (`vehicleData` anahtarları: alan adları ve her değerin etiketi)

**Interfaces:**
- **Produces (`src/domain/vehicleData.ts`)** — listeler mobile.de yükleme arayüzünden (`services.mobile.de/manual/upload-interface-csv_en.html`):
  - `FUELS = ['petrol','diesel','lpg','cng','electric','hybrid_petrol','hybrid_diesel','hydrogen','ethanol','other'] as const`
  - `TRANSMISSIONS = ['manual','semi_automatic','automatic'] as const`
  - `DRIVES = ['front','rear','all'] as const`
  - `EXTERIOR_COLORS = ['beige','black','blue','brown','gold','green','grey','orange','purple','red','silver','white','yellow'] as const`
  - `INTERIOR_COLORS = ['black','grey','beige','brown','other'] as const`
  - `UPHOLSTERIES = ['full_leather','part_leather','cloth','velour','alcantara','other'] as const`
  - `EQUIPMENT` (44 kod):

    | Grup | Kodlar |
    |---|---|
    | Güvenlik | `abs`, `esp`, `traction_control`, `immobiliser`, `central_locking` |
    | Park | `parking_sensors_front`, `parking_sensors_rear`, `parking_camera`, `park_assist` |
    | Multimedya | `navigation`, `bluetooth`, `onboard_computer`, `cd_player`, `radio`, `mp3_interface`, `hands_free`, `head_up_display` |
    | Tavan ve gövde | `sunroof`, `panorama_roof`, `electric_windows`, `electric_mirrors` |
    | Sürüş | `power_steering`, `cruise_control`, `multifunction_wheel` |
    | Koltuklar | `electric_seats`, `sport_seats` |
    | Taşıma | `trailer_coupling`, `roof_rack`, `ski_bag`, `isofix` |
    | Tekerlek ve ışık | `alloy_wheels`, `xenon_headlights`, `cornering_lights`, `fog_lights`, `daytime_running_lights`, `light_sensor`, `rain_sensor` |
    | Konfor | `seat_heating`, `auxiliary_heating`, `start_stop` |
    | Paketler ve diğer | `sport_package`, `metallic`, `air_conditioning`, `climate_control` |
  - `DAMAGE_PARTS = ['hood','roof','trunk','bumper_front','bumper_rear','fender_front_left','fender_front_right','door_front_left','door_front_right','door_rear_left','door_rear_right','quarter_rear_left','quarter_rear_right','sill_left','sill_right'] as const`
  - `DAMAGE_STATES = ['original','painted','partly_painted','replaced','damaged'] as const`
  - `LANGUAGES = ['de','tr','en'] as const`
  - **Tipler:**
    - `type VehicleData = { variant, firstRegistration (YYYY-MM-01 | null), mileageKm, fuel, transmission, powerKw, displacementCcm, drive, colorExterior, colorInterior, upholstery, previousOwners, huUntil, accidentFree, serviceBook, nonSmoker, vin }` (her alan `| null`);
    - `type DamageMap = Partial<Record<DamagePart, Exclude<DamageState,'original'>>>`;
    - `type VehicleDetails = { equipment?: Equipment[]; notes?: string }`.
  - **Fonksiyonlar:**
    - `validateVehicleData(d: Partial<VehicleData>): Partial<Record<keyof VehicleData, 'invalid'>>`
    - `kwToPs(kw: number): number` (`Math.round(kw * 1.35962)`)
    - `monthOf(date: string | null): string | null` (`'2019-03-17'` → `'2019-03-01'`)
- **`Vehicle` (`domain/vehicle.ts`) yeni alanları:** `data: VehicleData`, `damage: DamageMap`, `damageCheckedAt: string | null`. `details` artık `VehicleDetails` tipinde.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('validateVehicleData flags values outside the lists and impossible numbers', () => {
  expect(validateVehicleData({ fuel: 'kerosene' as never, mileageKm: -5, vin: 'ABC' })).toEqual({ fuel: 'invalid', mileageKm: 'invalid', vin: 'invalid' });
  expect(validateVehicleData({ fuel: 'diesel', mileageKm: 120000, vin: 'WVWZZZ1KZAW000001' })).toEqual({});
});

test('kwToPs and monthOf', () => {
  expect(kwToPs(110)).toBe(150);
  expect(monthOf('2019-03-17')).toBe('2019-03-01');
  expect(monthOf(null)).toBeNull();
});

test('the edge functions use the same value lists as the app', () => {
  // import * as shared from '../../../../supabase/functions/_shared/vehicleData';
  expect(shared.FUELS).toEqual(FUELS);
  expect(shared.EQUIPMENT).toEqual(EQUIPMENT);
  expect(shared.DAMAGE_PARTS).toEqual(DAMAGE_PARTS);
  // ...and the other lists
});

test('every value has a label in every language', () => {
  // for each list and value: i18n.exists(`vehicleData.values.${list}.${value}`, { lng }) for de, tr, en
});
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/domain/vehicleData.test.ts`
Expected: FAIL (modül yok).

- [ ] **Adım 3: Listeleri, tipleri, fonksiyonları ve çevirileri yaz**
  - **Değer çevirileri:** Almanca etiketler mobile.de'deki adlardır (ör. `hybrid_petrol` → "Hybrid (Benzin/Elektro)", `seat_heating` → "Sitzheizung"). Türkçe ve İngilizce karşılıkları aynı anlamla yazılır.
  - **Bu görevde yapılmayanlar:** `Vehicle`'ı üreten ve okuyan kodlar (`local/vehicles.ts`, `sync/remote.ts`) Task 3'te güncellenir. Bu görevde yalnız tip derlemesinin geçmesi için `data`, `damage` ve `damageCheckedAt` varsayılan boş değerlerle doldurulur.

- [ ] **Adım 4: Uygulama testlerinin tamamını çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-vehicle-value-lists`.

---

### Task 3: Telefon veritabanı ve senkron

**Files:**
- Modify: `apps/mobile/src/local/db.ts` (`MIGRATIONS`'a 3. girdi)
- Modify: `apps/mobile/src/local/vehicles.ts` (`updateVehicle`, yeni kolonların okunup yazılması)
- Create: `apps/mobile/src/local/listings.ts`
- Modify: `apps/mobile/src/local/outbox.ts` (`OutboxKind`'e `'listing'`)
- Modify: `apps/mobile/src/sync/remote.ts`, `apps/mobile/src/sync/fakeRemote.ts`, `apps/mobile/src/sync/sync.ts`, `apps/mobile/src/sync/SyncProvider.tsx`
- Test: `apps/mobile/src/local/local.test.ts`, `apps/mobile/src/sync/sync.test.ts`, `apps/mobile/src/sync/remote.int.test.ts`

**Interfaces:**
- Consumes: Task 1 kolonları ve tabloları; Task 2 `VehicleData`, `DamageMap`, `VehicleDetails`, `validateVehicleData`.
- Produces:
  - **Yerel göç (`MIGRATIONS[2]`):** `vehicles`'a Task 1'in kolonları eklenir. Tarihler ve boolean'lar SQLite'ta `text` ve `integer 0/1`, `damage` JSON metni. Ayrıca `listings` (`id text pk`, Task 1'in kolonları) ve `listing_texts` önbelleği (`listing_id`, `language`, kolonlar, `primary key (listing_id, language)`) eklenir.
  - **`updateVehicle`:** `updateVehicle(db, id: string, patch: VehiclePatch, now: string): Promise<Vehicle>`, `VehiclePatch = Partial<Pick<Vehicle,'make'|'model'|'bodyType'|'data'|'damage'|'damageCheckedAt'|'details'>>`.
    - `data` alan alan birleştirilir, `details` anahtar anahtar.
    - `validateVehicleData` geçersiz bir alan bulursa `Error('invalid')` fırlatır ve hiçbir şey yazmaz.
    - Yazınca `enqueue(db, 'vehicle', id, …)`.
  - **`listings.ts`:**
    - `type Listing = { id: string /* = vehicleId */; galleryId; status: 'draft'; priceEur; vatDeductible; warrantyMonths; location; createdAt; updatedAt }`
    - `getListing(db, vehicleId): Promise<Listing | null>`
    - `saveListing(db, vehicleId, galleryId, patch: Partial<Pick<Listing,'priceEur'|'vatDeductible'|'warrantyMonths'|'location'>>, now): Promise<Listing>`: yoksa oluşturur, `enqueue(db, 'listing', vehicleId, …)`.
    - `upsertRemoteListing(db, l: Listing)`
    - `cacheListingText(db, t: ListingText)`, `getListingTexts(db, listingId): Promise<ListingText[]>`
    - `type ListingText = { listingId; language: Language; titles: string[]; title; description; model; generatedAt; edited; updatedAt }`
  - **`Remote` yeni metotları:**
    - `upsertListing(l: Listing): Promise<void>` (`onConflict: 'id'`)
    - `fetchListings(galleryId): Promise<Listing[]>`
    - `fetchListingTexts(galleryId): Promise<ListingText[]>`
    - `upsertVehicle` ve `fetchVehicles` yeni kolonları gönderir ve seçer.
  - **`syncOnce`:**
    - `'listing'` öğelerini iter.
    - Araçlardan sonra ilanları çeker (`hasPending(db,'listing',id)` ise atlar), ardından ilan metinlerini önbelleğe yazar.
  - **`SyncState`'e eklenenler:**
    - `idle(): Promise<void>` (zamanlayıcıdan).
    - `flush(entities: { kind: OutboxKind; id: string }[]): Promise<boolean>`: `request()`, ardından `await idle()`. Verilen öğelerden hiçbiri giden kutusunda kalmadıysa `true` döner.

- [ ] **Adım 1: Başarısız testleri yaz**
  - **`local.test.ts`:**
    - `updateVehicle merges data and queues the vehicle once`: iki ardışık yamadan sonra `data.fuel` ve `data.mileageKm` birlikte durur, giden kutusunda tek `vehicle` öğesi vardır.
    - `updateVehicle rejects an invalid value and writes nothing`: `{ data: { mileageKm: -1 } }` → `rejects.toThrow('invalid')`, araç değişmez.
    - `migration 3 keeps existing vehicles`: sürüm 2'de kaydedilmiş bir araç göçten sonra `data` alanları `null`, `damage` `{}` olarak okunur.
  - **`sync.test.ts`:**
    - `pushes the new vehicle columns`: `fake.vehicles.get('v1')` içinde `data.fuel === 'diesel'`.
    - `two devices saving the same listing offline end in one row`: iki ayrı bellek veritabanı aynı `vehicleId` ile `saveListing` yapar, sırayla senkronlanır. `fake.listings.size === 1` ve fiyat ikinci cihazınkidir.
    - `a pending listing is not overwritten by the pull`.
  - **`remote.int.test.ts`:** `upsertListing then fetchListings returns the row for gallery members only` (staff görür, other görmez).

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/local src/sync`
Expected: FAIL

- [ ] **Adım 3: Uygula.** `FakeRemote`'a `listings` ve `listingTexts` Map'leri ve yeni metotlar eklenir.

- [ ] **Adım 4: Testleri çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`, ardından `npm run test:int:mobile`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-vehicle-details-sync`.

---

### Task 4: Araç bilgileri formu

**Files:**
- Create: `apps/mobile/src/ui/SelectField.tsx` (etiket, seçili değer, dokununca açılan liste: `Modal` içinde `Pressable` satırlar; seçimi kaldırma satırı)
- Create: `apps/mobile/src/vehicle/sections.ts`, `apps/mobile/src/vehicle/sections.test.ts`
- Create: `apps/mobile/src/vehicle/api.ts` (kasa tipi değişince yeniden çizim)
- Create: `apps/mobile/src/app/(app)/vehicles/[id]/data.tsx`
- Modify: `apps/mobile/src/app/(app)/vehicles/[id]/index.tsx` ("Fahrzeug" bölümü: Fahrzeugdaten, Schadenskarte, Bericht auslesen, Anzeigentext satırları)
- Modify: `apps/mobile/src/app/(app)/_layout.tsx` (yeni ekranların `Stack.Screen` kayıtları: `data`, `damage`, `report`, `listing`)
- Modify: `apps/mobile/src/locales/{de,tr,en}.json`

**Interfaces:**
- Consumes: Task 2 listeleri; Task 3 `updateVehicle`, `saveListing`, `flush`; `studioApi.startProcessing` (`src/studio/api.ts`).
- Produces:
  - **Bölümler (`sections.ts`):** `SECTIONS: { key: 'basics'|'technical'|'history'|'colors'|'equipment'|'price'|'vinNotes'; fields: string[] }[]` ve `sectionProgress(v: Vehicle, l: Listing | null): { done: number; total: number }`. Bir bölüm, alanlarından en az biri doluysa "dolu" sayılır.
  - **Kasa tipi değişimi:** `changeBodyType(deps: { db; flush; startProcessing }, vehicle: Vehicle, bodyType: BodyType, now): Promise<'saved' | 'rerendered' | 'offline'>`.
    - Önce `updateVehicle` çağrılır.
    - Araçta işlenmiş fotoğraf varsa (`vehicle.status` `'ready'` ya da `'processing'`) `flush([{ kind: 'vehicle', id }])`, ardından `startProcessing({ vehicleId, rerender: true })`.
    - `flush` `false` dönerse `'offline'` döner; değişiklik yerelde kalır.

- [ ] **Adım 1: Başarısız testleri yaz** (`sections.test.ts`). Test yardımcıları dosyada tanımlanır: `vehicle(overrides)` varsayılanlarla bir `Vehicle` kurar; `ready`, `status = 'ready'` olan ve bellek veritabanına (`memoryDb` + `migrate`) kaydedilmiş bir araçtır.

```ts
test('sectionProgress counts a section once any of its fields is set', () => {
  expect(sectionProgress(vehicle({ data: { mileageKm: 1000 } }), null)).toEqual({ done: 2, total: 7 }); // basics + history
});

test('changeBodyType re-renders a processed set without a credit and stays local offline', async () => {
  const startProcessing = jest.fn().mockResolvedValue({ photoIds: [] });
  expect(await changeBodyType({ db, flush: async () => true, startProcessing }, ready, 'suv', NOW)).toBe('rerendered');
  expect(startProcessing).toHaveBeenCalledWith({ vehicleId: ready.id, rerender: true });
  expect(await changeBodyType({ db, flush: async () => false, startProcessing }, ready, 'kombi', NOW)).toBe('offline');
  expect((await getVehicle(db, ready.id))!.bodyType).toBe('kombi');
});
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/vehicle`
Expected: FAIL

- [ ] **Adım 3: `sections.ts`, `api.ts`, `SelectField` ve `data.tsx`'i yaz** (`no-slop-ui` yüklü).
  - **Form davranışı:**
    - Her alan değişince `updateVehicle` ya da `saveListing` çağrılır ve `request()` istenir.
    - Sayısal alanlar boşaltılınca `null` olur.
    - Kısa listeler `Segmented` (vites, çekiş), uzun listeler `SelectField`.
    - Donanım, aranabilir işaret listesidir.
    - Güç alanının yanında PS gösterilir.
  - **Kasa tipi:** Değişince işlenmiş set varsa bir `Alert` onayı sorulur (`vehicleData.bodyTypeRerender`), ardından `changeBodyType` çağrılır.
  - **İlerleme:** Bölüm başlıklarında `sectionProgress` gösterilir ("3 von 7").

- [ ] **Adım 4: Testleri ve simülatörü doğrula**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

Simülatörde (iPhone 17, yerel Supabase ve servis açık, staff hesabı):
- Bir araca km, yakıt ve fiyat gir; uygulamayı yeniden aç, değerler duruyor.
- İşlenmiş bir aracın kasa tipini değiştir, onayla. Stüdyo set yeniden çizilir; kredi bakiyesi değişmez (`select sum(amount) from credit_ledger` önce/sonra aynı).

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-vehicle-data-form`.

---

### Task 5: Hasar şeması

**Files:**
- Create: `apps/mobile/src/vehicle/damageParts.ts` (her parça için 1000×500 bakış kutusunda SVG yol metni; üstten araç çizimi)
- Create: `apps/mobile/src/vehicle/damage.ts`, `apps/mobile/src/vehicle/damage.test.ts`
- Create: `apps/mobile/src/vehicle/DamageMap.tsx` (Skia `Canvas`; parçalar `Skia.Path.MakeFromSVGString`; dokunma `path.contains(x, y)`)
- Create: `apps/mobile/src/app/(app)/vehicles/[id]/damage.tsx`
- Modify: `apps/mobile/src/ui/theme.ts` (beş durum rengi: `damageColors`)
- Modify: `apps/mobile/src/locales/{de,tr,en}.json`

**Interfaces:**
- Consumes: Task 2 `DAMAGE_PARTS`, `DAMAGE_STATES`, `DamageMap`; Task 3 `updateVehicle`.
- Produces:
  - `setPartState(map: DamageMap, part: DamagePart, state: DamageState): DamageMap` (`'original'` parçayı haritadan çıkarır)
  - `damageSummary(map: DamageMap): Record<Exclude<DamageState,'original'>, DamagePart[]>`
  - `partAt(parts: { id: DamagePart; path: SkPath }[], x: number, y: number): DamagePart | null`. Saf değildir, Skia ister. Test edilmez; simülatörde doğrulanır.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('setPartState stores only parts that are not original', () => {
  const m = setPartState(setPartState({}, 'hood', 'painted'), 'roof', 'damaged');
  expect(setPartState(m, 'hood', 'original')).toEqual({ roof: 'damaged' });
});

test('damageSummary groups parts by state', () => {
  expect(damageSummary({ hood: 'painted', door_front_left: 'painted', roof: 'replaced' })).toEqual({
    painted: ['hood', 'door_front_left'], partly_painted: [], replaced: ['roof'], damaged: [],
  });
});

test('every damage part has a drawing', () => {
  expect(Object.keys(PART_PATHS).sort()).toEqual([...DAMAGE_PARTS].sort());
});
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/vehicle/damage.test.ts`
Expected: FAIL

- [ ] **Adım 3: Uygula.**
  - **Parça seçimi:** Dokunulan parça için alttan beş durumlu bir seçim açılır (mevcut `Segmented` ya da `Button` listesi).
  - **Açıklama:** Altta renk açıklama satırı.
  - **"Alle Teile geprüft":** `updateVehicle(..., { damageCheckedAt: now })`. Onaydan sonra yapılan değişiklikler tarihi günceller (5.5).
  - **Renk kuralı:** Renkler yalnız durumu taşır (/no-slop-ui).

- [ ] **Adım 4: Testleri ve simülatörü doğrula**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

Simülatörde:
- Üç parçaya farklı durum ver ve "Alle Teile geprüft"e bas.
- Uygulamayı yeniden aç; durumlar ve onay duruyor.
- Ekran görüntüsünde parçaların birbirine ve çizime hizalı olduğunu kontrol et.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-damage-map`.

---

### Task 6: "Başka bir cihazda düzenleniyor" uyarısı

**Files:**
- Create: `supabase/migrations/20261119000002_vehicle_presence.sql` (`realtime.messages` için özel kanal politikası)
- Create: `apps/mobile/src/vehicle/usePresence.ts`, `apps/mobile/src/vehicle/presence.ts`, `apps/mobile/src/vehicle/presence.test.ts`
- Create: `apps/mobile/src/vehicle/presence.int.test.ts`
- Modify: `data.tsx`, `damage.tsx` (Task 4, 5) ve Task 8'in `listing.tsx`'i (uyarı bandı)

**Interfaces:**
- Consumes: `supabase` istemcisi (`src/lib/supabase.ts`), oturum (`useSession`).
- Produces:
  - **Politika:** `realtime.messages` üzerinde `authenticated` için `select` ve `insert`. Koşul: `realtime.topic()` `vehicle:{uuid}` biçiminde ve o aracın galerisinde üyelik (`private.is_gallery_member`).
  - **Saf yardımcı:** `othersEditing(state: Record<string, { device: string; name: string }[]>, myDevice: string): string[]`. Kendi cihazı dışındaki adları, tekrarsız döner.
  - **Hook:** `useEditingElsewhere(vehicleId: string): string[] | null`. Çevrimdışıysa ya da kanal açılamazsa `null`.
    - Kanal: `supabase.channel(`vehicle:${id}`, { config: { private: true, presence: { key: deviceId } } })`.
    - `deviceId`, `meta` tablosunda bir kez üretilen rastgele kimliktir.
    - `track({ device, name })`; ad, e-postanın `@` öncesi kısmıdır.

- [ ] **Adım 1: Başarısız testleri yaz**
  - **`presence.test.ts`:** `othersEditing ignores this device and repeats`:

```ts
expect(othersEditing({ a: [{ device: 'me', name: 'staff' }], b: [{ device: 'x', name: 'owner' }, { device: 'x', name: 'owner' }] }, 'me')).toEqual(['owner']);
```
  - **`presence.int.test.ts`:**
    - `two members of the gallery see each other on the vehicle channel`: owner ve staff aynı kanala katılır, her biri ötekinin `track`'ini görür.
    - `a member of another gallery cannot join it`: other'ın aboneliği `CHANNEL_ERROR` ya da yetki hatasıyla biter.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/vehicle/presence.test.ts`, ardından `npm run test:int:mobile`
Expected: FAIL

- [ ] **Adım 3: Migration'ı (`npx supabase migration up`), yardımcıyı ve hook'u yaz; bandı üç ekrana ekle.** Bant düzenlemeyi engellemez; `Notice` (info) kullanır.

- [ ] **Adım 4: Testleri çalıştır**

Run: `npm run db:test && cd apps/mobile && npx tsc --noEmit && npx jest && cd ../.. && npm run test:int:mobile`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-vehicle-presence-warning`.

---

### Task 7: Claude ortak modülü ve `write-listing` fonksiyonu

**Files:**
- Create: `supabase/functions/_shared/claude.ts`
- Create: `supabase/functions/write-listing/index.ts`
- Create: `supabase/tests/integration/fakeClaude.ts` (sahte Messages API, `127.0.0.1:8091`; `/v1/messages` ile başlayan her yola, sorgu dizesi ne olursa olsun cevap verir; çünkü beta çağrıları `?beta=true` ekler)
- Create: `supabase/tests/integration/write-listing.test.ts`
- Modify: `supabase/functions/.env.example` (`ANTHROPIC_API_KEY=`, `ANTHROPIC_BASE_URL=`), yerel `.env` (`ANTHROPIC_API_KEY=test-key`, `ANTHROPIC_BASE_URL=http://host.docker.internal:8091`)
- Modify: `README.md` ("Claude" alt bölümü: anahtarın `npx supabase secrets set ANTHROPIC_API_KEY=…` ile kullanıcı tarafından girilmesi, buluta yalnız onayla)

**Interfaces:**
- Consumes: Task 1 tabloları; Task 2 listeleri (`_shared/vehicleData.ts`).
- Produces:
  - **`_shared/claude.ts`:**
    - `claudeClient(): Anthropic`: `apiKey = ANTHROPIC_API_KEY`, `baseURL = ANTHROPIC_BASE_URL` (boşsa SDK varsayılanı).
    - `askJson<T>(opts: { system: string; content: Anthropic.Beta.BetaContentBlockParam[]; schema: z.ZodType<T>; effort: 'medium' | 'high' }): Promise<{ ok: true; value: T; model: string } | { ok: false; error: 'ai_refused' | 'ai_failed' }>`
    - Global Constraints'teki Claude ayarlarıyla çağırır.
  - **`write-listing` isteği:**
    - Gövde: `POST { vehicle_id: uuid, language: 'de'|'tr'|'en', command?: 'shorten'|'more_professional'|'highlight_equipment'|'simplify'|'translate', from_language?: Language }`.
    - `translate`'te kaynak metin `from_language`'den okunur.
    - Diğer komutlarda kaynak aynı dilin metnidir; yoksa `400 bad_request`.
  - **`write-listing` cevabı:** `200 { listing_id, language, titles, title, description, model, generated_at, edited: false }`. Satır servis istemcisiyle `listing_texts`'e upsert edilir; `title = titles[0]`.
  - **Claude'a giden bilgiler (`facts`):**
    - Gidenler:
      - marka, model, varyant, kasa tipi,
      - Task 1'in tipli alanları (`vin` hariç),
      - donanım kodları,
      - `damage_checked_at` doluysa hasar özeti (yoksa hiç),
      - ilanın fiyat, KDV, garanti ve konum alanları,
      - notlar.
    - Gitmeyenler: şasi numarası ve plaka hiçbir alanda yer almaz.
  - **Yapılandırılmış çıktı şeması:** `{ titles: string[3], sections: { heading: string; body: string }[] }`. `description`, `## {heading}\n{body}` bölümlerinin boş satırla birleşimidir.
  - **Sistem talimatının kuralları:**
    - yalnız verilen bilgiler kullanılır,
    - verilmeyen donanım ya da durum yazılmaz,
    - abartı ve garanti dışı vaat yazılmaz,
    - hedef dil `language`,
    - kodlar o dildeki yerleşik terimlerle yazılır (ör. `seat_heating` → "Sitzheizung").

- [ ] **Adım 1: Başarısız entegrasyon testlerini yaz** (`write-listing.test.ts`; `before`'da sahte Claude başlar ve her isteği kaydeder):
  - `write-listing returns three titles and stores the text`: 200; `listing_texts`'te `de` satırı.
  - `write-listing never sends the VIN`: aracın `vin`'i `WVWZZZ1KZAW000001`; sahte sunucuya giden gövdede bu metin yok.
  - `write-listing leaves damage out until the map is checked`: `damage = {"hood":"painted"}`, `damage_checked_at` boş → gövdede `hood` yok. Doldurunca var.
  - `a member of another gallery gets 403 not_member`.
  - `a refusal answers 422 ai_refused`: sahte sunucu `stop_reason: 'refusal'` döner.
  - `shorten without an existing text answers 400 bad_request`.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `npx supabase functions serve` gerekmez (yerel yığın fonksiyonları sunar). `npm run test:int`
Expected: FAIL (404, fonksiyon yok).

- [ ] **Adım 3: `claude-api` skill'ini yükle, ortak modülü ve fonksiyonu yaz.** SDK sürümü `npm view @anthropic-ai/sdk version` ile okunup `npm:@anthropic-ai/sdk@<sürüm>` olarak sabitlenir.

- [ ] **Adım 4: Testleri çalıştır**

Run: `npm run test:int`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-write-listing-function`.

---

### Task 8: İlan metni ekranı

**Files:**
- Create: `apps/mobile/src/listing/api.ts`, `apps/mobile/src/listing/api.int.test.ts`
- Create: `apps/mobile/src/listing/stale.ts`, `apps/mobile/src/listing/stale.test.ts`
- Create: `apps/mobile/src/app/(app)/vehicles/[id]/listing.tsx`
- Modify: `apps/mobile/package.json` (`npx expo install expo-clipboard`)
- Modify: `apps/mobile/src/locales/{de,tr,en}.json`

**Interfaces:**
- Consumes: Task 3 `getListing`, `getListingTexts`, `cacheListingText`, `flush`; Task 6 `useEditingElsewhere`; Task 7 fonksiyonu.
- Produces:
  - **İstemci:** `createListingApi(client)` → `generate(a: { vehicleId; language; command?; fromLanguage? }): Promise<ListingText | { error: ListingError }>`.
    - `ListingError = 'not_member' | 'ai_refused' | 'ai_failed' | 'daily_limit' | 'offline' | 'internal'`.
    - Gövde `{ error }` kodundan eşlenir (`src/export/api.ts` kalıbı).
  - **Elle düzeltme:** `saveText(listingId, language, { title, description }): Promise<void>`. RLS ile güncelleme yapar, `edited = true`.
  - **Bayat metin:** `isStale(text: ListingText, vehicleUpdatedAt: string, listingUpdatedAt: string | null): boolean`.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('a text is stale once the vehicle or the listing changed after it was generated', () => {
  const t = text({ generatedAt: '2026-11-19T10:00:00.000Z' });
  expect(isStale(t, '2026-11-19T09:00:00.000Z', null)).toBe(false);
  expect(isStale(t, '2026-11-19T11:00:00.000Z', null)).toBe(true);
  expect(isStale(t, '2026-11-19T09:00:00.000Z', '2026-11-19T10:30:00.000Z')).toBe(true);
});
```

`api.int.test.ts` (sahte Claude açık): `generate stores and returns a German text`, `generate maps a refusal to ai_refused`.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/listing`
Expected: FAIL

- [ ] **Adım 3: Ekranı yaz** (`no-slop-ui` yüklü).
  - **Ekranın öğeleri:**
    - dil seçimi (`Segmented`),
    - "Erstellen" düğmesi,
    - başlık seçenekleri (seçilebilir satırlar),
    - düzenlenebilir başlık ve açıklama (`TextField multiline`),
    - komut düğmeleri,
    - "Kopieren" (`expo-clipboard`, başlık + boş satır + açıklama),
    - bayat not ve "Neu erstellen".
  - **Çağrı öncesi:** `flush([{kind:'vehicle',id},{kind:'listing',id}])`; `false` ise `offline` notu, çağrı yapılmaz.
  - **Elle düzeltilmiş metin:** Yeniden üretme ya da çeviri öncesi `Alert` onayı.
  - **Çevrimdışı:** Düğmeler pasif.

- [ ] **Adım 4: Testleri çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest && cd ../.. && npm run test:int:mobile`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-listing-text-screen`.

---

### Task 9: `read-report` fonksiyonu

**Files:**
- Create: `supabase/functions/read-report/index.ts`
- Create: `supabase/tests/integration/read-report.test.ts`

**Interfaces:**
- Consumes: Task 1 `report_reads`, `reports` kovası; Task 2 `_shared/vehicleData.ts`; Task 7 `askJson`.
- Produces:
  - **İstek:** `POST { vehicle_id: uuid, read_id: uuid, files: string[] }`.
    - Her yol `{galeri}/{vehicle_id}/{read_id}/` ile başlamalı; değilse `400 bad_request`.
    - 1–10 dosya kabul edilir.
  - **Akış:**
    1. Kullanıcı istemcisiyle araç okunur → `403 not_member`.
    2. Son 24 saatte bu araç için 10 `report_reads` satırı varsa `429 daily_limit`.
    3. Servis istemcisiyle `status = 'reading'` satırı eklenir (`id = read_id`).
    4. Dosyalar indirilip Claude'a gönderilir: PDF `document` (base64, `application/pdf`), görüntüler `image` (base64).
    5. Sonuç doğrulanır ve kaydedilir.
  - **Cevap:** `200 { read_id, suggestions: Suggestion[] }`. Alan adları uygulamanın `VehicleData` anahtarlarıdır (camelCase); JSON şeması da aynı adları kullanır. Tip:

```ts
type Suggestion =
  | { kind: 'field'; field: keyof VehicleData | 'make' | 'model'; value: string | number | boolean; quote: string }
  | { kind: 'damage'; part: DamagePart; state: DamageState; quote: string }
  | { kind: 'equipment'; code: Equipment; quote: string };
```
  - **Yapılandırılmış çıktı şeması:**
    - Her tipli alan için isteğe bağlı `{ value, quote }`; enum alanlarda `enum` Task 2 listeleri.
    - `damage: { part, state, quote }[]`, `equipment: { code, quote }[]`.
  - **Doğrulama:** Sunucu geçersiz değerleri (listede olmayan, `validateVehicleData`'nın eşdeğer kurallarını geçmeyen) atar ve `suggestions`'a yazar, `status = 'done'`.
  - **Hatalar:** Claude hatasında `status = 'failed'`, `502 ai_failed`; reddetmede `422 ai_refused`.
  - **Okuma talimatı:**
    - yalnız raporda açıkça yazanı öner,
    - tahmin etme,
    - her öneriye raporda geçtiği yerin kısa alıntısını ekle.

- [ ] **Adım 1: Başarısız entegrasyon testlerini yaz** (sahte Claude Task 7'deki):
  - `read-report sends the PDF as a document and returns suggestions`
  - `read-report drops suggestions outside the value lists`: sahte cevapta `fuel: 'kerosene'` ve `mileageKm: -5`; ikisi de cevapta yok, `fuel: 'diesel'` var.
  - `the eleventh read in a day answers 429 daily_limit`
  - `a path outside the vehicle's folder answers 400`
  - `a member of another gallery gets 403`

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `npm run test:int`
Expected: FAIL

- [ ] **Adım 3: Fonksiyonu yaz.**

- [ ] **Adım 4: Testleri çalıştır**

Run: `npm run test:int`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-read-report-function`.

---

### Task 10: Rapor ekranı

**Files:**
- Create: `apps/mobile/src/report/api.ts`, `apps/mobile/src/report/api.int.test.ts`
- Create: `apps/mobile/src/report/apply.ts`, `apps/mobile/src/report/apply.test.ts`
- Create: `apps/mobile/src/report/pickReport.ts` (PDF: `expo-document-picker`; fotoğraf: `expo-image-picker` + Skia ile JPEG'e çevirme, `src/gallery/pickImage.ts` kalıbı, uzun kenar en çok 2400 px)
- Create: `apps/mobile/src/app/(app)/vehicles/[id]/report.tsx`
- Modify: `apps/mobile/package.json` (`npx expo install expo-document-picker`)
- Modify: `apps/mobile/src/locales/{de,tr,en}.json`

**Interfaces:**
- Consumes: Task 3 `updateVehicle`, `flush`; Task 9 fonksiyonu ve `Suggestion`.
- Produces:
  - **İstemci:** `createReportApi(client)` →
    - `upload(galleryId, vehicleId, readId, files: { bytes: Uint8Array; mime: string; name: string }[]): Promise<string[]>`
    - `read(vehicleId, readId, paths): Promise<{ suggestions: Suggestion[] } | { error: ReportError }>`
    - `close(readId, paths): Promise<void>`: dosyaları siler, `suggestions = null`, `closed_at = now`.
  - **Öneri uygulama:** `applySuggestions(vehicle: Vehicle, accepted: Suggestion[]): VehiclePatch`.
    - Alanlar `data`'ya yazılır; `make` ve `model` önerileri yamanın üst düzey `make`/`model` alanlarına gider.
    - Hasar parçaları `setPartState` ile birleşir; `damageCheckedAt` değişmez.
    - Donanım listesine eklenir, tekrarsız.
    - `validateVehicleData`'dan geçmeyen değerler atlanır.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('applySuggestions writes accepted values and merges damage and equipment', () => {
  const patch = applySuggestions(vehicle({ details: { equipment: ['abs'] } }), [
    { kind: 'field', field: 'mileageKm', value: 87000, quote: 'km 87.000' },
    { kind: 'damage', part: 'hood', state: 'painted', quote: 'Motorhaube lackiert' },
    { kind: 'equipment', code: 'navigation', quote: 'Navi' },
  ]);
  expect(patch.data).toEqual(expect.objectContaining({ mileageKm: 87000 }));
  expect(patch.damage).toEqual({ hood: 'painted' });
  expect(patch.details!.equipment).toEqual(['abs', 'navigation']);
});

test('applySuggestions ignores values the lists do not allow', () => {
  const patch = applySuggestions(vehicle({}), [{ kind: 'field', field: 'fuel', value: 'kerosene', quote: '' }]);
  expect(patch.data?.fuel).toBeUndefined();
});
```

`api.int.test.ts` (sahte Claude açık): `upload, read and close leave no file behind and empty the suggestions`.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/report`
Expected: FAIL

- [ ] **Adım 3: Paketi kur, ekranı yaz** (`no-slop-ui` yüklü).
  - **Akış:**
    - yükleme notu (Global Constraints),
    - "PDF wählen" ve "Fotos aufnehmen/wählen",
    - yükleme ve okuma,
    - öneri listesi: alan adı, mevcut değer, önerilen değer, alıntı; her satırda "Übernehmen" / "Verwerfen".
  - **"Hepsini kabul et" yok.**
  - **Kapanış:** Bütün satırlar karara bağlanınca kabul edilenler `updateVehicle`'a gider ve `close` çağrılır.
  - **Kaldığı yerden devam:** Ekran yarıda kapanırsa öneriler `report_reads`'ten (RLS ile) yeniden okunup gösterilir.

- [ ] **Adım 4: Testleri çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest && cd ../.. && npm run test:int:mobile`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-report-reading-screen`.

---

### Task 11: Rapor temizliği

**Files:**
- Create: `supabase/functions/clean-reports/index.ts`
- Create: `supabase/migrations/20261119000003_clean_reports_cron.sql`
- Create: `supabase/tests/integration/clean-reports.test.ts`
- Modify: `supabase/functions/.env.example` (`CRON_SECRET=`), `README.md` (zamanlanmış işin sırları)

**Interfaces:**
- Consumes: Task 1 `report_reads`, `reports` kovası.
- Produces:
  - **Fonksiyon:** `POST /functions/v1/clean-reports`, başlık `x-cron-secret: CRON_SECRET`; yanlışsa `401`.
    - Servis istemcisiyle `closed_at is null and created_at < now() - interval '7 days'` okumaları bulunur.
    - Dosyalar kovadan silinir, `suggestions = null`, `closed_at = now()`.
    - Cevap: `200 { cleaned: number }`.
  - **Zamanlama:**
    - `pg_cron` ve `pg_net` eklentileri açılır.
    - `cron.schedule('clean-reports', '17 3 * * *', …)` her gün çalışır ve `net.http_post` ile fonksiyonu çağırır.
    - Adres ve sır Vault'tan okunur (`vault.decrypted_secrets`, adlar `clean_reports_url`, `cron_secret`). Değerleri her ortamda kullanıcı ya da README'deki komut girer; migration sır içermez.

- [ ] **Adım 1: Başarısız testleri yaz**
  - **Entegrasyon:**
    - `clean-reports removes only reads older than 7 days`: 8 günlük ve 1 günlük iki okuma, ikisinin de dosyası var. Çağrıdan sonra eski okumanın dosyası yok ve `suggestions` boş; yenisi yerinde.
    - `clean-reports without the secret answers 401`.
  - **pgTAP** (`details.test.sql`, plan +1): `the clean-reports job is scheduled` (`select count(*) from cron.job where jobname = 'clean-reports'` = 1).

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `npm run test:int && npm run db:test`
Expected: FAIL

- [ ] **Adım 3: Fonksiyonu ve migration'ı yaz; yerel Vault değerlerini README'deki komutla gir.**

- [ ] **Adım 4: Testleri çalıştır**

Run: `npm run test:int && npm run db:test`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-report-cleanup`.

---

### Task 12: Gerçek Claude ile kontrol ve simülatör turu (kullanıcıyla)

- [ ] **Adım 1: Anahtar.** Kullanıcı Anthropic hesabını açar ve yerel `supabase/functions/.env`'e `ANTHROPIC_API_KEY`'i kendisi yazar. `ANTHROPIC_BASE_URL` satırı silinir.

- [ ] **Adım 2: Onay.** Kullanıcıya çağrı sayısı ve tahmini maliyet söylenip onay alınır: 2 ilan metni (~$0,08) ve 1 rapor okuma (~$0,15).

- [ ] **Adım 3: Simülatörde uçtan uca.** Opel Crossland'a:
  - bilgileri gir,
  - hasar şemasını doldurup onayla,
  - Almanca ilan metni üret, "kısalt" komutunu dene, Türkçeye çevir.
  - Kontrol: metinde kayıtlı olmayan bir donanım geçmiyor; şasi numarası istekte yok (fonksiyon günlüğü).

- [ ] **Adım 4: Rapor.** Kullanıcının verdiği gerçek bir ekspertiz raporunu (PDF) okut.
  - Önerileri kabul ya da reddet.
  - Okuma kapandıktan sonra `reports` kovasında dosya kalmadığını doğrula.

- [ ] **Adım 5: Bulguları ve maliyeti yaz, sunucuları durdur.**
  - Gerçek token kullanımı fonksiyon günlüğünden okunur.
  - `supabase/functions/.env` sahte değerlerine döner; anahtar silinmez, kullanıcı karar verir.

- [ ] **Adım 6: Kullanıcıya devret.** Buluta migration ve fonksiyon gönderimi (`db push --remote`, `functions deploy`, `secrets set`) ayrı bir onayla yapılır; yayın aşamasında da olabilir.
