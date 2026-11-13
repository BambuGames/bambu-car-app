# M2b Stüdyo ve Galeri Ekranları Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Personel, yüklenmiş bir aracı uygulamadan işleyebilsin:
- Arka planı ve ton ayarını seçer, "İşle"ye basar, ilerlemeyi canlı görür.
- Sonuçları ilan sırasıyla ve kapak fotoğrafıyla görür, önce/sonra karşılaştırır.
- Plaka banner'ını kontrol edip köşelerini düzeltir, kalan parçaları rötuşla siler, tek fotoğrafı yeniden çeker ya da yeniden dener.

Galeri yöneticisi de şunları yapabilsin:
- Galeri ayarlarını (logo, plaka banner'ı, filigran, varsayılan arka plan) yönetir.
- Personeli davet eder ve çıkarır.
- Kredi bakiyesini ve geçmişini görür.

**Architecture:**
- **Stüdyo ve sonuç ekranları yalnız çevrimiçi çalışır:** İşleme zaten sunucuda yapılıyor. Fotoğraf satırları doğrudan Supabase'den okunur ve Realtime aboneliğiyle güncellenir; yerel SQLite'a kopyalanmaz. Araç listesi ve çekim akışı M1'deki gibi internetsiz çalışmaya devam eder.
- **Kararlar saf TypeScript modüllerinde verilir, Jest'te sınanır:** ilan sırası ve kapak, ilerleme özeti, "İşle"nin ne zaman açık olduğu, çıktı ile orijinal arasındaki koordinat dönüşümleri, filigran yerleşimi.
- **Ekranlar bu modülleri ve küçük bir API katmanını bağlar.**
- **Tek fotoğraflık düzeltmeler** (plaka köşeleri, rötuş) M2a'nın kolonlarına yazılır, ardından `process-vehicle` ile yalnız o fotoğraf yeniden çizilir; ek kredi ve Photoroom çağrısı yok.
- **Personel yönetimi** servis anahtarıyla çalışan yeni bir Edge Function'dadır; yalnız sahip kullanabilir.

**Tech Stack:**
- Uygulama: Expo SDK 58 / React Native 0.88, expo-router, @supabase/supabase-js 2 (Realtime dahil), expo-image, @shopify/react-native-skia, react-native-gesture-handler, react-native-reanimated, expo-image-picker (yeni), i18next.
- Testler: Jest 30 (jest-expo), Node 26 `node:test` entegrasyon testleri, pgTAP.
- Supabase Edge Functions (Deno) ve M2a'nın Python servisi (yalnız Task 10'daki görünüm ayarı için).

**Spec:** `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (özellikle 2.1, 2.3, 4, 5, 7.3–7.5, 9, 11.2) · Önceki plan: `docs/superpowers/plans/2026-11-12-m2a-processing-pipeline.md` (kolonlar, `start_processing`, `process-vehicle`, servis) · M0 kararları: `docs/m0-findings.md`

**Plan sırası ve sapmalar:**
- **M2'nin ikinci planı (M2b):** M2a'nın işleme hattının üstüne kurulur. Dışa aktarma, Cloud Run kurulumu, Sentry, hukuki metinler ve mağaza dağıtımı M2c'de.
- **Çevrimiçi stüdyo:** İşleme sonuçları yerel veritabanına alınmaz. İnternet yokken stüdyo ekranı "İnternet gerekiyor" der; çekim internetsiz çalışmaya devam eder.
- **Otomatik sıralama ve kapak (2.1/6):** Sıra uygulamada sabittir: 8 dış açı yürüme sırasıyla, sonra detaylar, sonra iç mekân. Kapak, bu sırada işlenmiş ilk fotoğraftır; elle değiştirme yok. Sıra M2c'de dışa aktarmadaki dosya adlarında da kullanılacak.
- **Rötuş (M0 kararı) iki araçla:** "Teil entfernen" ayrı duran bir parçaya dokununca onu siler (`remove`). "Radieren" araca bitişik parçanın üstünü fırçayla siler (`erase`). "Rückgängig" son düzenlemeyi geri alır. Her değişiklik o fotoğrafı yeniden çizdirir.
- **Plaka hızlı kontrolü (7.4, M0 kararı):** Banner yerleştirilen ve plakası bulunamayan bütün fotoğraflar bir kontrol listesinde sırayla gösterilir. Seçenekler: "Passt" (`confirmed`, yeniden çizim yok), "Ecken anpassen" (köşe sürükleme, sonra `confirmed` ve yeniden çizim), "Kein Kennzeichen sichtbar" (`none`, yeniden çizim).
- **Galeri ayarları:** Logo ve banner telefondan seçilip yüklenir (`expo-image-picker`). Değişiklik var olan araçları kendiliğinden yeniden çizmez; stüdyo ekranında "Neu rendern" düğmesi vardır (7.5: ek API maliyeti yok).
- **Personel yönetimi:** Sahip e-postayla personel davet eder ve personeli çıkarır. Davet M1a'daki 6 haneli kodlu davet e-postasını kullanır. Kendini ve başka bir sahibi çıkaramaz; rol değiştirme yok.
- **Kredi:** Bakiyeyi ve defteri yalnız sahip görür. Personel, krediler bitince "İşle"de yöneticisine başvurmasını söyleyen mesajı görür.
- **Görünüm ayarı (M2a ertelenen):** Stüdyonun ufuk bandı ve gölge, kullanıcının gözüyle Task 10'da ayarlanır.

## Global Constraints

**Arayüz ve metin**
- Arayüz Almanca; Türkçe ve İngilizce de var. Her yeni metin üç dil dosyasına (`src/locales/{de,tr,en}.json`) girer; i18n anahtar testi geçer.
- Tüm UI çalışmaları /no-slop-ui kuralına uyar. UI kodu veya metni yazmadan önce `no-slop-ui` skill'i yüklenir.
  - Projenin teması `src/ui/theme.ts`'dir; mevcut `Button`, `Notice`, `Screen`, `TextField` kullanılır.
  - Rozet ve renk yalnız durum taşır: hata (`danger`), bekleyen (`pending`), birincil eylem (`accent`).
- Teknolojiye uzak personel yardımsız kullanabilmelidir (2.3). Her ekranın tek bir ana eylemi vardır ve metinler kısa ve düz olur.
- Kesinleşmiş Almanca metinler:
  - Kredi bitti: "Ihr Guthaben ist aufgebraucht. Bitte wenden Sie sich an Ihre Galerieleitung."
  - Fotoğraf sınırı: "Für dieses Fahrzeug wurden zu viele Fotos aufgenommen. Bitte wenden Sie sich an Bambu Games."
  - İnternet yok: "Für das Bearbeiten wird eine Internetverbindung benötigt."
  - Yükleme bekliyor: "{{count}} Fotos werden noch hochgeladen. Danach können Sie bearbeiten."

**Kod kuralları**
- Uygulama React Compiler ile derleniyor. Hook bağımlılıkları tetikleyici olarak kullanılmaz; Realtime ve ekran odağı abonelikle (`subscribe`) izlenir.

**İşleme kuralları (M2a)**
- 1 kredi = 1 araç. Yeniden işleme, yeniden çizim, plaka düzeltme, rötuş ve yeniden çekim ek kredi istemez.
- Araç başına en çok 40 yeni orijinal işlenir (`photo_limit`, 409).
- İşleme M2a'nın `process-vehicle` fonksiyonuyla başlar; gövde `{vehicleId, photoId?, rerender?}`. Yanıtlar:
  - 202 `{queued}`; kuyruk boşsa 200 `{queued: []}`
  - 402 `no_credit`, 409 `photo_limit`, 403 `not_member`, 401, 400.
- Plaka köşeleri (`plate_corners`) ve rötuş (`mask_edits`) dik çevrilmiş orijinale göre 0–1 koordinatlarıyla saklanır.
  - `placement` alanı `{m: 2×3, src: [w, h]}` biçimindedir; orijinal pikselleri 2560 × 1920 çıktıya taşır.
  - Rötuş işlemleri: `{type: 'erase', points, radius}` (yarıçap genişliğe oranla) ve `{type: 'remove', point}`.
- Görseller özel kovalardadır: `originals`, `processed`, `branding`. Uygulama imzalı URL ile okur. `expo-image` önbellek anahtarı olarak depo yolunu kullanır; imzalı URL her seferinde değiştiği için.

**Dağıtım, izinler ve commit**
- Yeni yerel modül `expo-image-picker` (MIT) yeni bir geliştirme derlemesi ister: `expo prebuild`, ardından iOS ve Android derlemesi.
  - iOS izin metni (`NSPhotoLibraryUsageDescription`): "Für das Logo und das Kennzeichen-Banner der Galerie."
- Anahtarlar yalnız sunucuda tutulur.
- Telefonlardaki izin pencerelerini (fotoğraf arşivi, kamera) kullanıcı yanıtlar.
- Photoroom'a gerçek çağrı yapan her deneme önce kullanıcıya sorulur.
- Commitleri kullanıcı atar. Her görev değişen dosyalar ve önerilen mesajla biter; `git commit` çalıştırılmaz.

**Çalışma ortamı**
- Node 26. iOS derlemeleri komut bazında `DEVELOPER_DIR=/Users/egemenderbedek/Downloads/Xcode-26.6.app/Contents/Developer` ve `LANG=en_US.UTF-8` ile yapılır.
- Metro 8082 portunda çalışır; 8081 başka projenin.
- Melocaly'nin Docker container'larına dokunulmaz. Emülatör `melocaly_pixel` `-no-snapshot-save` ile açılır; kapanınca uygulamamız silinir.

## Review Focus

1. **Yükleme bitmeden "İşle":** Telefonda yüklenmeyi bekleyen fotoğraf varken basılırsa, o fotoğraflar sessizce işlenmeden kalmamalı. Düğme kapalı olmalı ve kaç fotoğrafın beklediği görünmeli. → Task 1, `processBlocker says uploading while photos wait`.
2. **Koordinatlar:** Plaka köşesi ya da rötuş, ufku düzeltilmiş (eğik çekilmiş) bir fotoğrafta da parmağın değdiği yere düşmeli. → Task 1, `outputToOriginal undoes originalToOutput on a straightened photo`.
3. **Takılı ya da kopan ilerleme:** Realtime bağlantısı koparsa ya da uygulama arka plana alınırsa ilerleme takılı kalmamalı. Ekran odağa dönünce yenilenmeli. 10 dakikadan uzun takılan fotoğrafta "Erneut versuchen" görünmeli. → Task 1, `a photo processing for over 10 minutes counts as stuck`; Task 2'nin elle kontrolü.
4. **Personelin sahip işlemleri:** Galeri ayarları, personel yönetimi ve kredi ekranları personelde görünmemeli. Sunucu da reddetmeli. → Task 9, `staff cannot invite or remove members`; Task 8, `staff cannot change gallery settings`; Task 6, `only owners manage the gallery`.
5. **Sahibin kendini ya da başka sahibi çıkarması:** Galeri sahipsiz kalmamalı. → Task 9, `an owner cannot remove themselves or another owner`.

---

### Task 1: Stüdyo verisi ve saf kararlar

**Files:**
- Create: `apps/mobile/src/studio/{order.ts, geometry.ts, status.ts, api.ts, useStudio.ts}`
- Test: `apps/mobile/src/studio/{order.test.ts, geometry.test.ts, status.test.ts}`, `apps/mobile/src/studio/api.int.test.ts`

**Interfaces:**
- Consumes: M2a'nın kolonları, `process-vehicle` fonksiyonu, `backgrounds` tablosu; `src/lib/supabase.ts` istemcisi; `src/local/outbox.ts` (bekleyen yüklemeler).
- Produces:
  - **`order.ts`:**
    - `LISTING_ORDER: readonly Slot[]`: `EXTERIOR_SLOTS` (yürüme sırası), sonra `detail_*`, sonra `interior_*`; `slots.ts`'deki sırayla.
    - `orderPhotos<T extends { slot: Slot }>(photos: T[]): T[]`
    - `coverPhoto<T extends { slot: Slot; process_status: string }>(photos: T[]): T | null`: sırada `done` olan ilk fotoğraf.
  - **`geometry.ts`:**
    - `type Placement = { m: [[number, number, number], [number, number, number]]; src: [number, number] }`
    - `type Point = { x: number; y: number }`; noktalar 0–1.
    - `originalToOutput(p: Placement, pt: Point): Point`: orijinal 0–1 → çıktı 0–1 (2560 × 1920).
    - `outputToOriginal(p: Placement, pt: Point): Point`: tersi.
    - `defaultPlateQuad(): Point[]`: çıktı ortasının altında, 520:110 oranlı ve çıktı genişliğinin %20'si kadar bir dörtgen; sol üstten saat yönünde.
  - **`status.ts`:**
    - `type MaskEdit = { type: 'erase'; points: [number, number][]; radius: number } | { type: 'remove'; point: [number, number] }` (M2a'nın biçimi).
    - `type StudioPhoto`: `id, slot, process_status, process_error, output_path, output_wm_path, original_path, placement, plate_corners, plate_status, mask_edits: MaskEdit[], updated_at`.
    - `STUCK_MS = 600_000`
    - `isStuck(p: StudioPhoto, now: number): boolean`: `queued` ya da `processing` ve `updated_at` `STUCK_MS`'den eski.
    - `summarize(photos, now) -> { total, done, failed, running, stuck, unprocessed, plateChecks }`. `plateChecks`: `auto` ya da `needs_check` durumundaki işlenmiş fotoğraflar.
    - `processBlocker({ online, pendingUploads, photos, now }) -> 'offline' | 'uploading' | 'nothing' | null`. `nothing`: işlenecek ya da yeniden denenecek fotoğraf yok.
  - **`api.ts`:**
    - `fetchStudio(vehicleId) -> { vehicle: { id, status, background_id, tone_enabled }, photos: StudioPhoto[], backgrounds: { id, name, spec, sort_order }[] }`
    - `signedUrls(bucket: 'originals' | 'processed' | 'branding', paths: string[], seconds = 3600): Promise<Record<string, string>>`
    - `startProcessing(body: { vehicleId: string; photoId?: string; rerender?: boolean }) -> Promise<{ queued: string[] } | { error: 'no_credit' | 'photo_limit' | 'not_member' | 'offline' | 'internal' }>`
    - `setStudioOptions(vehicleId, { backgroundId?: string; toneEnabled?: boolean })`
    - `saveMaskEdits(photoId, edits: MaskEdit[])`
    - `savePlate(photoId, corners: Point[] | null, status: 'confirmed' | 'none')`
  - **`useStudio.ts`:** `useStudio(vehicleId) -> { data, loading, error, refresh }`.
    - `postgres_changes` aboneliği: `photos` için `vehicle_id=eq.<id>`, `vehicles` için `id=eq.<id>`.
    - Ekran odağa dönünce ve Realtime yeniden bağlanınca yeniler.

- [ ] **Adım 1: Başarısız Jest testlerini yaz**

```ts
test('orderPhotos puts the walk order first, then details, then interior', ...)  // shuffled input → LISTING_ORDER
test('coverPhoto is the first processed photo in listing order', ...)            // front_left_45 failed, front done → front
test('outputToOriginal undoes originalToOutput on a straightened photo', ...)    // m from a 6° rotation + placement; round trip within 1e-9
test('originalToOutput maps the plate the way the worker does', ...)             // m = [[2,0,100],[0,2,50]], src [1000,750]: (0.5,0.5) → ((2*500+100)/2560, (2*375+50)/1920)
test('a photo processing for over 10 minutes counts as stuck', ...)              // updated_at now-11 min → true; now-5 min → false; done → false
test('processBlocker says offline before anything else', ...)
test('processBlocker says uploading while photos wait', ...)                     // pendingUploads 2 → 'uploading'
test('processBlocker allows a retry of failed or stuck photos', ...)             // all done except one failed → null; all done → 'nothing'
test('summarize counts plate checks only on processed photos', ...)
```

- [ ] **Adım 2: Başarısız entegrasyon testini yaz (`api.int.test.ts`, `npm run test:int:mobile` ile)**

Seed'deki sahip hesabıyla:
- `saveMaskEdits` ve `savePlate` satıra yazılır.
- `fetchStudio` üç stüdyo arka planını döner.
- Başka galerinin aracı için `startProcessing` `{ error: 'not_member' }` döner.

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/studio && cd ../.. && npm run test:int:mobile`
Expected: yeni testler FAIL (modüller yok).

- [ ] **Adım 4: Modülleri yaz**
- `startProcessing` fonksiyonu `supabase.functions.invoke('process-vehicle')` ile çağırır. HTTP durumunu M2a'daki koda eşler; ağ hatası `offline` olur.

- [ ] **Adım 5: Testlerin geçtiğini gör** (Adım 3'ün komutu) — Expected: tümü geçer.

- [ ] **Adım 6: Kullanıcıya devret** — önerilen mesaj: `add-studio-data-layer`.

---

### Task 2: Stüdyo ekranı: arka plan, ton, İşle ve canlı ilerleme

**Files:**
- Create: `apps/mobile/src/app/(app)/vehicles/[id]/studio.tsx`, `apps/mobile/src/studio/BackgroundSwatch.tsx`
- Modify: `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/src/app/(app)/vehicles/[id]/index.tsx` (Studio düğmesi), `apps/mobile/src/locales/*.json`

**Interfaces:**
- Consumes: Task 1'in hepsi.
- Produces:
  - `/vehicles/[id]/studio` rotası.
  - `BackgroundSwatch({ spec, selected, onPress })`: stüdyo `spec`'ini Skia ile küçük bir 4:3 önizleme olarak çizer (duvar, zemin, ufuk). `kind: 'image'` için imzalı URL'den görsel gösterir.

- [ ] **Adım 1: Ekranı yaz**
- **Seçimler:** Arka plan seçimi (aracınki, yoksa galerinin varsayılanı, o da yoksa ilk stüdyo) ve "Farbangleichung" anahtarı (`tone_enabled`). Her ikisi `setStudioOptions` ile hemen kaydedilir.
- **Ana düğme:** "Bearbeiten". Araçta hiç işlenmiş fotoğraf yoksa ilk işlemenin bir kredi düşeceği söylenir.
- **Düğme kapalıyken:** `processBlocker` nedenini Global Constraints'teki metinle gösterir.
- **İşleme hataları:** `startProcessing` hatası kendi metniyle gösterilir: `no_credit`, `photo_limit`, `offline`.
- **"Neu rendern":** İşlenmiş fotoğraf varken arka plan ya da ton değişince görünür (`rerender: true`).
- **Canlı ilerleme:** "8 von 24 fertig" biçiminde bir satır ve ilan sırasıyla bir fotoğraf listesi. Her satırda durum yazısı var; hatalıda kısa açıklama ve "Erneut versuchen".
- **Araç detayı:** Araç ekranına "Studio" düğmesi eklenir; en az bir fotoğraf yüklenmişse etkin.

- [ ] **Adım 2: Emülatörde dene** (sahte servis yok; M2a'nın yerel servisi Docker'da)
- Bir aracın detay ve iç mekân fotoğraflarıyla dene; Photoroom çağrısı olmaz.
- "Bearbeiten"e bas: ilerleme Realtime ile canlı ilerler ve araç "Fertig" olur.
- Uygulamayı arka plana alıp geri getir: ekran yenilenir.
- İnterneti kapat: metin görünür.
- Bakiye 0 iken kredi metni görünür.

Expected: hepsi doğru metinle görünür; ekran görüntüleri kontrol edilir.

- [ ] **Adım 3: Testleri çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: geçer (i18n anahtar testi dahil).

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `add-studio-screen`.

---

### Task 3: Sonuçlar, kapak, önce/sonra ve tek fotoğraf ekranı

**Files:**
- Create: `apps/mobile/src/app/(app)/vehicles/[id]/photo/[photoId].tsx`, `apps/mobile/src/studio/CompareImage.tsx`, `apps/mobile/src/studio/useCovers.ts`
- Modify: `apps/mobile/src/app/(app)/vehicles/[id]/studio.tsx` (sonuç ızgarası), `apps/mobile/src/app/(app)/index.tsx` (araç listesinde kapak), `apps/mobile/src/locales/*.json`

**Interfaces:**
- Consumes: Task 1'in `orderPhotos`, `coverPhoto`, `signedUrls`, `startProcessing`; Task 2'nin stüdyo ekranı.
- Produces:
  - `/vehicles/[id]/photo/[photoId]` rotası. Önce/sonra görünümü, "Kennzeichen prüfen" (Task 4), "Retuschieren" (Task 5), "Neu aufnehmen" (çekim ekranına o açıyla gider) ve hatalı fotoğrafta "Erneut versuchen".
  - `CompareImage({ before, after })`: "Vorher | Nachher" seçici ile iki görsel arasında geçiş; basılı tutunca da önceki görünür.
  - `useCovers(galleryId) -> Record<vehicleId, { url, path } | null>`: galerinin işlenmiş fotoğraflarından kapakları tek sorguyla bulur. İnternet yoksa boş döner; liste kapaksız görünür.

- [ ] **Adım 1: Başarısız testi yaz**

```ts
test('covers pick each vehicle\'s first processed photo in listing order', ...)
// pure helper in useCovers.ts: coversByVehicle(rows) → { v1: 'front_left_45 path', v2: null }
```

- [ ] **Adım 2: Testin başarısız olduğunu gör** — `cd apps/mobile && npx jest src/studio`

- [ ] **Adım 3: Yaz**
- Stüdyo ekranının altına ilan sırasıyla 2 sütunlu sonuç ızgarası eklenir; kapakta "Titelbild" etiketi, bekleyen plaka kontrolünde ise bir işaret olur.
- Görseller `expo-image` ile gösterilir; önbellek anahtarı depo yoludur.
- Yeniden çekilen ve henüz işlenmemiş fotoğrafta "Neu aufgenommen, noch nicht bearbeitet" yazar.

- [ ] **Adım 4: Testleri ve emülatörü dene**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Emülatör beklentileri:
- Izgara sırası doğru.
- Önce/sonra geçişi çalışır.
- "Neu aufnehmen" çekim ekranını açar.
- Araç listesinde kapak görünür.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-studio-results-compare`.

---

### Task 4: Plaka hızlı kontrolü ve köşe düzenleme

**Files:**
- Create: `apps/mobile/src/app/(app)/vehicles/[id]/plates.tsx`, `apps/mobile/src/studio/PlateEditor.tsx`, `apps/mobile/src/studio/plateQuad.ts`
- Test: `apps/mobile/src/studio/plateQuad.test.ts`
- Modify: stüdyo ekranı (kontrol sayısı ve "Kennzeichen prüfen" girişi), tek fotoğraf ekranı, `locales`

**Interfaces:**
- Consumes: Task 1'in `originalToOutput`, `outputToOriginal`, `defaultPlateQuad`, `savePlate`, `startProcessing`.
- Produces:
  - **`plateQuad.ts`:**
    - `moveCorner(quad: Point[], index: number, to: Point): Point[]`: köşe çıktı karesinde tutulur (0–1). Dörtgenin kendini kesmesine izin verilmez; kesiyorsa eski dörtgen döner.
    - `isConvexQuad(quad: Point[]): boolean`
  - `/vehicles/[id]/plates` rotası: `plateChecks` sırayla gösterilir.
  - `PlateEditor({ imageUrl, quad, onChange })`: çıktı görselinin üstünde Skia ile dörtgen ve dört büyük tutamaç (en az 44 pt dokunma alanı); sürükleme gesture-handler ile yapılır.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('moveCorner keeps the corner inside the photo', ...)            // to (1.3, -0.2) → (1, 0)
test('moveCorner refuses a self-crossing quad', ...)                 // dragging TL past TR → unchanged quad
test('isConvexQuad accepts a tilted plate and rejects a bow-tie', ...)
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör** — `cd apps/mobile && npx jest src/studio/plateQuad.test.ts`

- [ ] **Adım 3: Yaz**
- "Passt": `savePlate(id, corners, 'confirmed')`, yeniden çizim yok.
- "Ecken anpassen": düzenleyici açılır. Kaydedince köşeler `outputToOriginal` ile çevrilir; ardından `savePlate(…, 'confirmed')` ve `startProcessing({ vehicleId, photoId })`.
- "Kein Kennzeichen sichtbar": `savePlate(id, null, 'none')` ve yeniden çizim.
- `needs_check` fotoğrafında düzenleyici `defaultPlateQuad()` ile açılır.
- Kontrol listesinde sıradaki fotoğrafa geçilir; liste bitince stüdyoya dönülür.

- [ ] **Adım 4: Testleri ve emülatörü dene**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Emülatörde düzeltilen köşelerle yeniden çizilen fotoğrafta banner yeni yerde olmalı; ekran görüntüsüyle kontrol edilir.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-plate-quick-check`.

---

### Task 5: Rötuş

**Files:**
- Create: `apps/mobile/src/studio/TouchUpEditor.tsx`, `apps/mobile/src/studio/edits.ts`
- Test: `apps/mobile/src/studio/edits.test.ts`
- Modify: tek fotoğraf ekranı, `locales`

**Interfaces:**
- Consumes: Task 1'in `MaskEdit`, `outputToOriginal`, `saveMaskEdits`, `startProcessing`.
- Produces:
  - **`edits.ts`:**
    - `toOriginalStroke(p: Placement, outputPoints: Point[], brushOutput: number): MaskEdit`: fırça kalınlığı çıktı genişliğine oranla verilir. Yarıçap, orijinalin genişliğine oranla `brushOutput * 2560 / (placement ölçeği × src[0])` olarak çevrilir.
    - `toOriginalTap(p: Placement, pt: Point): MaskEdit`
    - `undo(edits: MaskEdit[]): MaskEdit[]`
    - `simplify(points: Point[], minStep = 0.004): Point[]`: art arda çok yakın noktaları atar; satır küçük kalır.
  - `TouchUpEditor({ imageUrl, placement, edits, onSave })`.
    - İki mod: "Teil entfernen" (dokunma) ve "Radieren" (sürükleme).
    - Fırça boyutu: küçük, orta ya da büyük (çıktı genişliğinin %1, %2,5, %5'i).
    - "Rückgängig" ve "Fertig" düğmeleri.
    - Kaydedince `saveMaskEdits` ve tek fotoğrafın yeniden çizimi yapılır.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('a tap becomes a remove edit at the right spot of the original', ...)       // placement scale 2, offset; (0.5,0.5) → expected
test('a stroke keeps its width relative to the original', ...)                   // radius conversion with scale 2.56 and src 1000
test('simplify drops points closer than the minimum step', ...)
test('undo removes only the last edit', ...)
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör** — `cd apps/mobile && npx jest src/studio/edits.test.ts`

- [ ] **Adım 3: Yaz.** Fırça izi Skia ile anlık çizilir. Kaydetmeden geri dönülürse değişiklik kaybolur; bunun için onay sorulur.

- [ ] **Adım 4: Testleri ve emülatörü dene**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Emülatörde, M2a uçtan uca denemesindeki gibi komşu araç parçası kalmış bir fotoğrafta (detay olmayan; maske gerekir) silinen parça yeniden çizimde arka plana döner. Bu adım için kullanıcıya Photoroom denemesi sorulur; yoksa bir sentetik maskeyle elle hazırlanmış test aracıyla denenir.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-touch-up-editor`.

---

### Task 6: Hesap ekranı düzeni ve rol kontrolü

**Files:**
- Modify: `apps/mobile/src/app/(app)/account.tsx`, `apps/mobile/src/app/(app)/_layout.tsx`
- Create: `apps/mobile/src/lib/roles.ts`
- Test: `apps/mobile/src/lib/roles.test.ts`

**Interfaces:**
- Produces:
  - `canManageGallery(m: Membership | null): boolean` (yalnız `owner`).
  - `OwnerOnly` rota koruması: personel `/credits`, `/gallery/settings` ya da `/gallery/members` adresini açarsa hesap ekranına döner.
  - Hesap ekranında sahipte "Galerie" bölümü: Guthaben, Galerie-Einstellungen, Mitarbeitende (Task 7–9 bu girişlerin ekranlarını yazar; o zamana kadar girişler gizli kalır). Ardından mevcut Lizenzen, Abmelden ve Konto löschen.

- [ ] **Adım 1: Başarısız testi yaz**

```ts
test('only owners manage the gallery', ...)
```

- [ ] **Adım 2: Testi gör, yaz, geçtiğini gör** — `cd apps/mobile && npx jest src/lib/roles.test.ts`

- [ ] **Adım 3: Emülatörde iki hesapla dene** — `owner@bambu.test` bölümü görür, `staff@bambu.test` görmez; personel adresi elle açamaz.

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `add-owner-section`.

---

### Task 7: Kredi görünümü

**Files:**
- Create: `apps/mobile/src/app/(app)/credits.tsx`, `apps/mobile/src/gallery/credits.ts`
- Test: `apps/mobile/src/gallery/credits.test.ts`
- Modify: `apps/mobile/src/app/(app)/account.tsx` (sahipte "Guthaben" girişi), `_layout.tsx`, `locales`

**Interfaces:**
- Produces:
  - `fetchCredits(galleryId) -> { balance: number; entries: { amount, reason, vehicle: string | null, note, created_at }[] }`: bakiye `gallery_credit_balance` RPC'sinden, hareketler en yenisi önde, araç adı marka ve modelden gelir.
  - `entryLabel(entry) -> string` anahtarı: `credits.grant`, `credits.vehicle`, `credits.refund`.
  - `/credits` rotası. Task 6'nın `OwnerOnly` korumasıyla.

- [ ] **Adım 1: Başarısız testi yaz**

```ts
test('entry labels follow the reason and name the vehicle', ...)
```
Task 1'in `api.int.test.ts` dosyasına: `staff read no ledger rows; the owner reads them`.

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

- [ ] **Adım 3: Yaz.** Ekranda üstte büyük bakiye, altta hareket listesi var. Boşsa: "Noch keine Buchungen."

- [ ] **Adım 4: Testleri çalıştır** — `cd apps/mobile && npx tsc --noEmit && npx jest && cd ../.. && npm run test:int:mobile`

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-credits-screen`.

---

### Task 8: Galeri ayarları: logo, banner, filigran, varsayılan arka plan

**Files:**
- Create:
  - `apps/mobile/src/app/(app)/gallery/settings.tsx`
  - `apps/mobile/src/gallery/{watermarkLayout.ts, branding.ts}`
  - `apps/mobile/src/gallery/WatermarkPreview.tsx`
- Test: `apps/mobile/src/gallery/watermarkLayout.test.ts`
- Modify: `apps/mobile/package.json` (`expo-image-picker`), `app.json` (izin metni ve eklenti), `account.tsx` (sahipte "Galerie-Einstellungen"), `_layout.tsx`, `locales`

**Interfaces:**
- Produces:
  - **`watermarkLayout.ts`:** servisin `worker/watermark.py` hesabının TypeScript eşi.
    - `type WatermarkSettings`: Global Constraints ve M2a'daki `watermark` biçimi.
    - `watermarkLayout(settings, logoAspect: number, width: number, height: number) -> { band: { y: number; h: number; color: string } | null; logo: { x: number; y: number; w: number; h: number } | null }`.
    - `WATERMARK_DEFAULTS` = `{ position: 'bottom_right', width: 0.18, opacity: 0.85, band: null }`.
  - **`branding.ts`:**
    - `pickAndUpload(kind: 'logo' | 'banner') -> Promise<string | null>`:
      - `expo-image-picker` ile seçilir.
      - Logo PNG olarak yüklenir, saydamlık korunur.
      - Banner 4,7:1 oranına kırpılarak yüklenir (resim seçicinin `aspect` seçeneği).
      - Yol `<galleryId>/logo.png` ya da `<galleryId>/banner.png` olur; `galleries.*_path` güncellenir.
    - `saveWatermark(settings)`, `setDefaultBackground(id)`.
  - `/gallery/settings` rotası, Task 6'nın `OwnerOnly` korumasıyla. Kaydedince "Wird für neue Bearbeitungen verwendet. Bereits bearbeitete Fahrzeuge im Studio neu rendern." notu gösterilir.
  - `WatermarkPreview`: galerinin son işlenmiş fotoğrafı (yoksa gri 4:3 alan) üstünde bant ve logoyu `watermarkLayout` ile çizer.

- [ ] **Adım 1: Başarısız testi yaz.** Sayılar servisin testleriyle aynıdır, iki uygulama aynı yeri bulmalı:

```ts
test('the logo sits where the worker puts it', ...)  // 400×300, bottom_right, width 0.18, logo 2:1 → { x: 316, y: 252, w: 72, h: 36 }
test('a band holds the logo inside it', ...)         // bottom band height 0.1 → band { y: 270, h: 30 }, logo h ≤ 21
test('settings outside the limits are clamped', ...) // width 0.9 → 0.4; opacity 2 → 1
```

- [ ] **Adım 2: Testin başarısız olduğunu gör** — `cd apps/mobile && npx jest src/gallery`

- [ ] **Adım 3: Paketi kur ve ekranı yaz**

Run: `cd apps/mobile && npx expo install expo-image-picker`
- Logo ve banner seçilir; önizleme gösterilir.
- Filigran ayarları:
  - Konum: 5 seçenek.
  - Boyut: küçük, orta, büyük (0,12 / 0,18 / 0,26).
  - Saydamlık: %50 / %75 / %100.
  - Bant: yok, üstte ya da altta; renk proje temasından 6 sabit seçenek.
- Varsayılan arka plan: Task 2'nin `BackgroundSwatch` bileşeniyle.
- Yetki: Staff hesabı `galleries` tablosunu güncellemeye çalışırsa RLS satırı göstermez; güncelleme hiçbir satırı değiştirmez. Bunu sınayan `staff cannot change gallery settings` testi Task 1'in `api.int.test.ts` dosyasına eklenir; test, galerinin `watermark` alanının değişmediğini doğrular.

- [ ] **Adım 4: Yeni geliştirme derlemesi ve testler**

Run:
1. `cd apps/mobile && npx tsc --noEmit && npx jest`
2. `npx expo prebuild --clean`
3. Android derlemesi: README'deki gradle komutları.
4. iOS simülatörü: README'deki komut.

Emülatörde:
- Logo seçilir, önizleme doğru yerde görünür.
- Yeni bir işlemede filigran ayarlarla aynı yerde olur.

Fotoğraf arşivi izin penceresine kullanıcı basar (emülatörde test görüntüsüyle).

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-gallery-settings`.

---

### Task 9: Personel yönetimi

**Files:**
- Create: `supabase/functions/gallery-members/index.ts`, `apps/mobile/src/app/(app)/gallery/members.tsx`, `apps/mobile/src/gallery/members.ts`
- Test: `supabase/tests/integration/gallery-members.test.ts`
- Modify: `account.tsx` (sahipte "Mitarbeitende"), `_layout.tsx`, `locales`

**Interfaces:**
- Produces:
  - **`gallery-members` Edge Function:** Kullanıcının token'ıyla çağrılır; çağıran, galerinin sahibi olmalıdır, değilse 403 `not_owner`. Eylemler:
    - `GET ?galleryId=` → `{ members: { userId, email, role, invitedAt, confirmed }[] }`
    - `POST {galleryId, email}`:
      - E-posta yeni ise davet edilir (`auth.admin.inviteUserByEmail`, M1a'nın kodlu şablonu).
      - Hesap zaten varsa e-posta gönderilmez.
      - İki durumda da kişi personel (`staff`) olarak eklenir.
      - Zaten üyeyse 409 `already_member`.
      - Yanıt 201 `{ userId }`.
    - `DELETE {galleryId, userId}`: personeli galeriden çıkarır, hesabı silmez.
      - Kendini çıkarmak `cannot_remove_self`, bir sahibi çıkarmak `cannot_remove_owner` (ikisi de 400).
  - `members.ts`: `listMembers`, `inviteMember`, `removeMember` (fonksiyonun ince sarmalayıcıları).
  - `/gallery/members` ekranı (Task 6'nın `OwnerOnly` korumasıyla):
    - Liste: e-posta, rol, "Einladung offen" durumu.
    - "Einladen": e-posta alanı.
    - "Entfernen": onay penceresiyle.

- [ ] **Adım 1: Başarısız entegrasyon testlerini yaz**

```ts
test('the owner invites a new person, who gets the code mail and becomes staff', ...)  // Mailpit has the invite mail
test('inviting an existing account adds it without a mail', ...)
test('staff cannot invite or remove members', ...)                                    // 403 not_owner
test('an owner cannot remove themselves or another owner', ...)                       // 400 both codes
test('the owner removes staff; the account stays', ...)
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `npm run db:reset && npm run test:int`
Expected: yeni testler FAIL (404).
Not: Yeni fonksiyon için yerel yığın yeniden başlatılır (`npx supabase stop`, ardından `npm run db:start`; README).

- [ ] **Adım 3: Fonksiyonu ve ekranı yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: `npm run db:reset && npm run test:int && cd apps/mobile && npx tsc --noEmit && npx jest`

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-member-management`.

---

### Task 10: Görünüm ayarı (stüdyo ufku ve gölge)

**Files:**
- Modify: `services/image-worker/worker/{backgrounds.py, compose.py}`, `services/image-worker/tests/test_compose.py`

**Interfaces:**
- Consumes: M2a'nın servisi ve `scripts/seed_test_vehicle.py`, `scripts/contact_sheet.py`.
- Produces: ufukta görünür bir çizgi olmayan kesintisiz stüdyo ve yumuşak bir temas gölgesi. Değerleri kullanıcı temas sayfalarına bakarak onaylar.

- [ ] **Adım 1: Başarısız testi yaz**

```python
def test_the_studio_has_no_visible_seam(): ...  # max row-to-row step in the background ≤ 2 levels for all three studios
```
Bu test mevcut stüdyoda düşer, çünkü ufuktaki zemin koyulaşması çizgi gibi görünüyor.

- [ ] **Adım 2: Testi gör, düzelt, geçtiğini gör** — `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`

Yapılacaklar:
- Ufuk geçişi daha geniş ve yumuşak olur, koyulaşma sıçrama yapmaz.
- Gölge: aynı yapı korunur, koyuluk ve yayılma ayarlanır.

- [ ] **Adım 3: Kullanıcıya göster**
1. Gerçek fotoğraflarla bir test aracı kurulur. 8 Photoroom çağrısı (yaklaşık $0,16) yapılır; bu, önce kullanıcıya sorulur.
2. Üç stüdyoda temas sayfası üretilir.
3. Kullanıcı onaylayana ya da değer verene kadar yalnız yeniden çizilir; ek maliyet yok.

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `upd-studio-look`.

---

### Task 11: Uçtan uca kontrol ve kurulum notları

**Files:**
- Modify: `README.md` ("Stüdyo ve galeri" bölümü: stüdyonun internet istediği, sahip ve personel farkı, yeni geliştirme derlemesi)

- [ ] **Adım 1: Emülatörde uçtan uca dene.** Yerel Supabase, servis Docker'da, uygulama `owner@bambu.test` ile:
1. Araç aç ve 8 dış açıyla birkaç detay çek (emülatörde basit mod).
2. Yükleme bitince Studio'da "Bearbeiten"e bas. Kredi düşer, ilerleme canlı görünür.
3. Plaka kontrol listesini bitir: bir fotoğrafta köşeleri düzelt, birinde "Kein Kennzeichen" de.
4. Bir fotoğrafta rötuş yap.
5. Arka planı koyu stüdyoya alıp "Neu rendern"e bas; kredi değişmez.
6. Bir açıyı yeniden çek ve yeniden işle; kredi değişmez.
7. `staff@bambu.test` ile gir: galeri bölümü görünmez, araç işlenebilir.
8. Bakiye 0 iken "Bearbeiten"de kredi metni görünür.

Photoroom'a giden dış açılar için deneme öncesi kullanıcıya sorulur (yaklaşık 8 × $0,02). Sonuçlar ilerleme kaydına yazılır.

- [ ] **Adım 2: Tüm testleri çalıştır**

Run:
1. `npm run db:reset && npm run db:test && npm run test:int && npm run test:int:mobile`
2. `(cd apps/mobile && npx tsc --noEmit && npx jest)`
3. `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`

Expected: hepsi geçer.

- [ ] **Adım 3: Telefon kontrolünü planla.** iPhone 11, A34 ve Tecno'da M1b'nin bekleyen telefon testiyle birlikte yapılır. Liste ilerleme kaydına yazılır, kullanıcıyla zamanı konuşulur.

- [ ] **Adım 4: Arka planda kalanları durdur, kullanıcıya devret**

Durdurulacaklar: Metro, emülatör, servis container'ı ve yerel Supabase. Önerilen mesaj: `upd-studio-readme-e2e`.
