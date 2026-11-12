# M1b Yönlendirmeli Çekim Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Galeri personeli bir aracın 8 dış açısını şablon, canlı yönlendirme ve otomatik çekimle, detay ve iç mekân fotoğraflarını talimatla çekebilsin. Her fotoğraf çekimden hemen sonra kalite kontrolünden geçsin ve M1a'nın yerel veritabanına ve yükleme kuyruğuna girsin.

**Architecture:** Kamera react-native-vision-camera v5 ile çalışır. Kare işleyici, M0'da seçilen EfficientDet-Lite modelini (iOS'ta Lite2 + CPU, Android'de Lite0 + GPU) react-native-fast-tflite ile saniyede en çok 10 kez çalıştırır. Yönlendirme kararları saf TypeScript modüllerinde verilir: eğim, hedef aracın kutusu ile şablon kutusunun karşılaştırması, otomatik çekim, basit mod ve kalite kontrolü. Bu modüller Jest'te sınanır; kamera ekranı yalnız bunları bağlar. Şablonlar `tools/templates` ile üretilip uygulamaya TypeScript verisi olarak gömülür. Fotoğraflar M1a'nın `savePhoto` fonksiyonuyla kaydedilir; senkronizasyon motoru değişmeden yükler.

**Tech Stack:** Expo SDK 58 / React Native 0.88, react-native-vision-camera 5.2.4 (+ resizer, worklets), react-native-fast-tflite 3.0.1, react-native-nitro-modules 0.37.2, react-native-nitro-image 0.15.2, @shopify/react-native-skia, expo-sensors, expo-screen-orientation, expo-asset, expo-keep-awake, expo-build-properties, Jest 30 (jest-expo), Python 3 + pytest (`tools/templates/.venv`).

**Spec:** `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (özellikle 6.1–6.5, 11.2, 12) · M0 kararları ve kurulum notları: `docs/m0-findings.md` · Önceki plan: `docs/superpowers/plans/2026-11-09-m1a-foundation.md`

**Plan sırası ve sapmalar:**
- Bu plan tasarımdaki M1'in telefon gerektiren kısmıdır (M1b). M1a'nın yerel veritabanı, kuyruğu ve senkronizasyonu üstüne kurulur.
- Detay ve iç mekân adımlarında tasarımdaki "örnek fotoğraf" yerine kısa talimat metni gösterilir. Örnek fotoğraflar, kullanıcı çektiğinde `assets` altına eklenecek ayrı bir iş olarak kalır.
- Araç tespit modeli, M0'da ölçülen MediaPipe dosyaları yerine aynı mimarinin TensorFlow Hub sürümüdür (EfficientDet-Lite0/Lite2 detection, Apache-2.0). Bu sürüm kutuları modelin içinde çözüyor ve dört çıkış veriyor. MediaPipe dosyaları ham çapa çıktısı verdiği için M0'da kutu çizilememişti.
- M0 Task 3 kararı buraya taşındı: başka bir aracın kutusu hedef araca değiyorsa çekim ekranı açı değiştirmeyi önerir (yalnız uyarı).
- Dar alan modu yalnız yan ve 45° açılarda kullanılır. M0 bulgusu: ön ve arkada kamerayı tampona 0,9 m'ye yaklaştırıp perspektifi bozuyor; normal mod orada zaten 2,4 m istiyor.
- Pozlamanın aracın üzerinden ölçülmesi `focusTo` ile yapılır. M0'da bu, A34'te etkisizdi; o telefonlarda yalnız ışık uyarısı kalır.

## Global Constraints

- Arayüz Almanca; Türkçe ve İngilizce de var (i18n). Varsayılan dil Almanca.
- Tüm UI çalışmaları /no-slop-ui kuralına uyar. UI kodu veya metni yazmadan önce `no-slop-ui` skill'i yüklenir.
- Uygulama React Compiler ile derleniyor (`experiments.reactCompiler: true`). Hook bağımlılıkları tetikleyici olarak kullanılmaz; gövdede okunmayan bağımlılık derlemede düşer ve Jest bunu göremez. Değişiklikler abonelikle (`subscribe`) ya da gövdede okunarak izlenir.
- Zorunlu dış açılar (8), yürüme sırasıyla: ön sol 45°, ön, ön sağ 45°, sağ yan, arka sağ 45°, arka, arka sol 45°, sol yan. Her adımda tek fotoğraf olur; yeniden çekim eskisinin yerine geçer.
- Dış fotoğraflar yatay ve 4:3 çekilir; varsayılan kamera ana kamera (1x), dar alan modunda ultra geniş kamera (0.5x). Flaş kullanılmaz.
- Otomatik çekim varsayılan olarak açıktır. Hiza, konum, yükseklik ve sabitlik yarım saniye tolerans içinde kalınca fotoğraf otomatik çekilir.
- Işık ve araç engeli yalnız uyarıdır, çekimi durdurmaz. Kadrajda hedef araca değen bir kişi varsa otomatik çekim bekler.
- Basit mod: tespit hızı 3 saniye boyunca saniyede 4'ün altında kalırsa konum, mesafe, yükseklik ve engel kontrolleri kapanır; silüet, hiza ve sabitlik çalışır, çekim elle yapılır.
- Tespit: iOS'ta EfficientDet-Lite2 + CPU, Android'de Lite0 + GPU. Saniyede en çok 10 tespit; inceleme ekranında, uygulama arka plandayken ve ekran odakta değilken tespit durur (iPhone 11 sürekli tespitle 2–3 dakikada ısınıyor).
- Dar alan modu yalnız ultra geniş kamerayı uygulamalara açan telefonlarda ve yalnız yan ve 45° açılarda görünür.
- Çekim anındaki eğim, kamera modu, görüş açısı ve hedef aracın kutusu fotoğrafın `capture` alanına, kalite sonucu `qc` alanına yazılır.
- Şablonlar uygulamanın içinde gelir (internetsiz çalışır). Kasa tipleri: sedan, Kombi, SUV, hatchback; diğerleri için genel kutu.
- Kullanılan her kod, model ağırlığı, 3D model ve veri setinin lisansı ticari kullanıma uygun olmalı. AGPL ve GPL kullanılmaz. İndirilecek 3D model ve model ağırlıkları önce kaynak, lisans ve boyutuyla kullanıcıya sorulur.
- Node 26 LTS. iOS derlemeleri Xcode 26.6 ile, yalnızca komut bazında: `DEVELOPER_DIR=/Users/egemenderbedek/Downloads/Xcode-26.6.app/Contents/Developer`; CocoaPods için `LANG=en_US.UTF-8`. Sistem çapında araç kurulmaz ve değiştirilmez.
- Telefonlardaki güvenlik ve izin pencerelerini (güven, Geliştirici Modu, Play Protect, kamera izni) kullanıcı yanıtlar. Kamera görüntüsü ve fotoğraflara yalnız kullanıcı teste onay verdiğinde bakılır.
- Commitleri kullanıcı atar. Her görev değişen dosyaların listesi ve kullanıcının stilinde (`add-...`, `upd-...`) önerilen bir commit mesajıyla biter; `git commit` çalıştırılmaz.

## Review Focus

1. **Android'de 16:9 fotoğraf:** M0'da A34 aynı oturumda 4:3 yerine 16:9 verdi. Kadraj ve şablon 4:3 varsayıyor; 4:3 olmayan fotoğraf sessizce geçmemeli. → Task 4, `qcIssues flags a photo that is not 4:3`.
2. **iPhone'da yanlış lens:** Ultra geniş ve ana kamerayı birleştiren iPhone cihazında `zoom=1` ultra geniş kamerayı açar; normal mod ana kamerayı açmalı. → Task 3, `zoomFor picks the main lens on an iPhone dual-wide device`.
3. **Uzun çekimde ısınma:** İnceleme ekranında veya uygulama arka plandayken tespit sürmemeli, sürerken de saniyede 10'u aşmamalı. → Task 3, `detection gate skips frames inside 100 ms and while inactive`.
4. **Kişi ile komşu aracın karışması:** Hedef araca değen kişi otomatik çekimi bekletmeli; komşu araç yalnız uyarı vermeli. → Task 3, `a person touching the car blocks auto capture` ve `another vehicle touching the car only warns`.
5. **Yüklenirken yeniden çekim:** Aynı adım yeniden çekilince yeni dosya eskisinin üstüne yazılmamalı ve eski dosya geride kalmamalı. → Task 2, `savePhoto returns the replaced file uri` ve `photoFileName differs per capture time`.

---

### Task 1: Kalan kasa tiplerinin şablonları ve uygulamaya aktarma

**Files:**
- Modify: `tools/templates/body_types.json`, `tools/templates/models/SOURCES.md`, `tools/templates/templates.py`
- Create: `tools/templates/out/kombi/`, `tools/templates/out/suv/`, `tools/templates/out/hatchback/` (üretilir, commit edilir)
- Create: `apps/mobile/src/templates/templates.generated.ts` (üretilir, commit edilir), `apps/mobile/src/domain/templates.ts`
- Modify: `apps/mobile/src/domain/slots.ts`
- Test: `tools/templates/test_templates.py`, `apps/mobile/src/domain/templates.test.ts`

**Interfaces:**
- Produces:
  - `body_types.json`: her kasa tipinde `file`, `forward`, `up`, `length_m` ve künye alanları `model`, `author`, `license`, `link`. Boylar: sedan 4,75 m (değişmez), Kombi 4,90 m (Passat Variant), SUV 4,55 m (Tiguan), hatchback 4,30 m (Golf).
  - `python tools/templates/templates.py export-app`: `tools/templates/out/*/*.json` ve SVG'lerden `apps/mobile/src/templates/templates.generated.ts`'i yazar. Dar alan modunda `front` ve `rear` aktarılmaz.
    ```ts
    // Generated by tools/templates/templates.py export-app. Do not edit.
    export type GeneratedTemplate = { bodyType: 'sedan' | 'kombi' | 'suv' | 'hatchback'; slot: string; mode: 'normal' | 'wide'; hfovDeg: number; distanceM: number; box: [number, number, number, number]; path: string };
    export const TEMPLATES: readonly GeneratedTemplate[];
    export const TEMPLATE_CREDITS: readonly { bodyType: string; model: string; author: string; license: string; link: string }[];
    ```
    `box` 0–1 arası, 4:3 fotoğraf karesinde `[x0, y0, x1, y1]`; `path` SVG `d` metni, 1600×1200 `viewBox`'ında.
  - `slots.ts`: `type ExteriorSlot = (typeof EXTERIOR_SLOTS)[number]`.
  - `templates.ts`: `type Box = { x0: number; y0: number; x1: number; y1: number }`; `type CaptureMode = 'normal' | 'wide'`; `type Template = { bodyType: BodyType; slot: ExteriorSlot; mode: CaptureMode; hfovDeg: number; box: Box; path: string | null }`; `wideAllowed(slot: ExteriorSlot): boolean` (yan ve 45° açılar); `templateFor(bodyType: BodyType, slot: ExteriorSlot, mode: CaptureMode): Template | null`. `other` için o açı ve moddaki dört kasa tipinin kutularının ortalaması döner, `path: null`. İzin verilmeyen dar alan isteğinde `null`.

- [ ] **Adım 1: 3D model adaylarını kullanıcıya sor**

Kombi, SUV ve hatchback için birer markasız, ticari kullanıma uygun (CC0 veya CC BY) 3D model bulunur. Her aday kaynak bağlantısı, yazar, lisans ve dosya boyutuyla kullanıcıya sorulur. Gerçek ölçülere yakınlık M0'daki gibi kontrol edilir: modele boy verilince genişlik ve yükseklik gerçek araca (Kombi yaklaşık 1,83 × 1,50 m, SUV 1,84 × 1,67 m, hatchback 1,79 × 1,46 m) %10 içinde kalmalı.
Expected: kullanıcı üç modeli onaylar; dosyalar `tools/templates/models/` altına indirilir (git dışı), künyeleri `SOURCES.md` ve `body_types.json`'a yazılır.

- [ ] **Adım 2: Başarısız Python testlerini yaz**

```python
def test_export_app_writes_one_entry_per_template_and_credits(tmp_path):
    # tmp out dir with sedan front_left_45 normal + wide (JSON + SVG); export_app(out_dir, dest)
    # dest text contains '"bodyType": "sedan"' twice and TEMPLATE_CREDITS with the sedan author
def test_export_app_skips_wide_front_and_rear(tmp_path):
    # out dir with sedan front_wide.json → not in dest; front_left_45_wide.json → in dest
```

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `tools/templates/.venv/bin/python -m pytest tools/templates -q`
Expected: 2 yeni test FAIL (`export_app` yok), eski testler geçer.

- [ ] **Adım 4: `export_app(out_dir: str, dest: str) -> None`'u ve `export-app` komutunu yaz; şablonları üret**

Run: `tools/templates/.venv/bin/python tools/templates/templates.py kombi` (aynısı `suv` ve `hatchback` için), sonra `... templates.py export-app`
Expected: her kasa tipinde 16 JSON + 16 SVG ve `overview.png`. `overview.png`'lerde her açının ön tarafı doğru yerde (kırmızı nokta) ve silüetler kadraja sığıyor; kontrol edilir.

- [ ] **Adım 5: Testlerin geçtiğini gör**

Run: `tools/templates/.venv/bin/python -m pytest tools/templates -q`
Expected: tüm testler geçer.

- [ ] **Adım 6: Başarısız TS testlerini yaz (`templates.test.ts`)**

```ts
test('templateFor returns the body type silhouette', () => {
  const t = templateFor('kombi', 'front_left_45', 'normal')!
  expect(t.path).toMatch(/^M /)
  expect(t.box.x0).toBeLessThan(t.box.x1)
})
test('other body type gets the mean box and no silhouette', () => {
  const t = templateFor('other', 'left', 'normal')!
  expect(t.path).toBeNull()
  // t.box.x0 equals the mean of the four body types' x0 for left/normal (toBeCloseTo, 4)
})
test('wide mode is only offered for side and 45 degree angles', () => {
  expect(templateFor('sedan', 'front', 'wide')).toBeNull()
  expect(templateFor('sedan', 'right', 'wide')).not.toBeNull()
  expect(EXTERIOR_SLOTS.filter(wideAllowed)).toEqual(['front_left_45', 'front_right_45', 'right', 'rear_right_45', 'rear_left_45', 'left'])
})
```

- [ ] **Adım 7: `templates.ts`'i yaz ve testlerin geçtiğini gör**

Run: `cd apps/mobile && npx jest src/domain/templates.test.ts`
Expected: 3 test geçer.

- [ ] **Adım 8: Kullanıcıya devret**

Önerilen mesaj: `add-body-type-templates-app-export`.

---

### Task 2: Kalite sonucu, çekim bilgisi ve fotoğraf dosyası

**Files:**
- Create: `apps/mobile/src/domain/capture.ts`
- Modify: `apps/mobile/src/local/db.ts`, `apps/mobile/src/local/photos.ts`, `apps/mobile/src/sync/sync.ts`, `apps/mobile/src/sync/remote.ts`, `apps/mobile/src/sync/fakeRemote.ts`
- Test: `apps/mobile/src/domain/capture.test.ts`, `apps/mobile/src/local/local.test.ts`, `apps/mobile/src/sync/sync.test.ts`, `apps/mobile/src/sync/remote.int.test.ts`

**Interfaces:**
- Consumes: M1a `savePhoto`, `listPhotos`, `syncOnce`, `Remote`; Task 1 `CaptureMode`.
- Produces:
  - `db.ts`: `MIGRATIONS` dışa aktarılır; test sürüm 1 şemasını `MIGRATIONS[0]` ile kurar.
  - `capture.ts`: `type CaptureInfo = { template: string | null; mode: CaptureMode; hfovDeg: number; focal35: number | null; rollDeg: number; pitchDeg: number; targetBox: [number, number, number, number] | null; simpleMode: boolean; auto: boolean; platform: 'ios' | 'android'; deviceModel: string | null; width: number; height: number }` (`template` örneği `'sedan/front_left_45/normal'`); `type QcIssue = 'blurry' | 'dark' | 'overexposed' | 'cutOff' | 'aspect'`; `type QcResult = { issues: QcIssue[]; accepted: boolean; laplacianVar: number; meanLuma: number; clippedShare: number }`; `photoFileName(vehicleId: string, slot: Slot, capturedAt: string): string` = `` `${vehicleId}/${slot}-${capturedAt}.jpg` `` (`:` ve `.` → `-`).
  - Yerel şema sürüm 2: `alter table photos add column qc text not null default '{}'`.
  - `photos.ts`: `PhotoRow.qc: Record<string, unknown>`; `savePhoto` girdisine `qc: Record<string, unknown>`; dönüş `{ photoId: string; replacedUri: string | null }` (aynı adımda önceki satırın `local_uri`'si, yoksa `null`).
  - `Remote.upsertPhoto(p: RemotePhoto & { capture: Record<string, unknown>; qc: Record<string, unknown> })`; `remote.ts` `qc` sütununu yazar; `syncOnce` yerel `qc`'yi gönderir.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
// capture.test.ts
test('photoFileName differs per capture time', () => {
  expect(photoFileName('v1', 'front', '2026-11-12T10:00:00.000Z')).toBe('v1/front-2026-11-12T10-00-00-000Z.jpg')
  expect(photoFileName('v1', 'front', '2026-11-12T10:00:01.000Z')).not.toBe(photoFileName('v1', 'front', '2026-11-12T10:00:00.000Z'))
})
// local.test.ts
test('savePhoto stores qc and returns the replaced file uri', async () => {
  // first save → replacedUri null; second save of 'front' with localUri b → replacedUri 'file:///a.jpg'; listPhotos(v1)[0].qc equals the second qc
})
test('migrate adds qc to a version 1 database', async () => {
  // memoryDb(tmpFile) with version 1 schema and one photo row (create via the first migration only) → migrate → photo.qc equals {}
})
// sync.test.ts
test('pushes qc with the photo row', async () => { /* fake.photos[0].qc toEqual saved qc */ })
// remote.int.test.ts: the existing test also asserts the stored photo row's qc equals the sent qc
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/domain/capture.test.ts src/local src/sync`
Expected: FAIL (yeni alanlar ve fonksiyon yok).

- [ ] **Adım 3: `capture.ts`'i, ikinci migration'ı ve `qc` alanını yaz**

Mevcut `savePhoto` çağrıları (testler) `qc: {}` ile güncellenir.

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: `cd apps/mobile && npx jest`, sonra kökten `npm run db:reset && npm run test:int:mobile`
Expected: tüm birim testleri ve mobil entegrasyon testi geçer.

- [ ] **Adım 5: Kullanıcıya devret**

Önerilen mesaj: `add-capture-info-qc-storage`.

---

### Task 3: Yönlendirme mantığı

**Files:**
- Create: `apps/mobile/src/capture/geometry.ts`, `apps/mobile/src/capture/guidance.ts`, `apps/mobile/src/capture/camera.ts`
- Test: `apps/mobile/src/capture/geometry.test.ts`, `guidance.test.ts`, `camera.test.ts`

**Interfaces:**
- Consumes: Task 1 `Box`, `CaptureMode`.
- Produces:
  - `geometry.ts`: `type Detection = { cls: 'car' | 'truck' | 'person'; score: number; box: Box }`; `scaleBox(box: Box, s: number): Box` (0,5–0,5 merkezli); `silhouetteScale(templateHfovDeg: number, deviceHfovDeg: number): number` = `tan(t/2) / tan(d/2)`; `width(b)`, `center(b): { x: number; y: number }`, `iou(a: Box, b: Box): number`, `intersects(a: Box, b: Box): boolean` (pozitif alanlı kesişim); `pickTarget(dets: Detection[], expected: Box): Detection | null` (skoru 0,5 ve üstündeki car/truck kutularından şablon kutusuyla IoU'su en yüksek olan; hiçbiri kesişmiyorsa en büyük alanlı).
  - `guidance.ts`:
    - `tiltFromGravity(g: { x: number; y: number; z: number }): { rollDeg: number; pitchDeg: number }`: yatay tutuşta `rollDeg = atan2(|g.y|, |g.x|)`, `pitchDeg = atan2(|g.z|, hypot(g.x, g.y))` (derece). İşaretten bağımsız olduğu için platform ve yatay yönden etkilenmez.
    - `TOLERANCES = { rollDeg: 2, pitchDeg: 4, centerX: 0.04, centerY: 0.04, sizeRatio: 0.08, stableDegPerSec: 8, holdMs: 500, staleMs: 400, minLuma: 50, tooLargeRatio: 1.25, tooLargeMs: 2000 }`. Değerler Task 6'daki cihaz denemesinde ayarlanır.
    - `type GuidanceMessage = 'personInFrame' | 'holdLevel' | 'noCar' | 'moveCloser' | 'moveBack' | 'panLeft' | 'panRight' | 'lower' | 'raise'`; `type GuidanceWarning = 'otherVehicle' | 'lowLight'`.
    - `evaluateGuidance(i: { tilt: { rollDeg: number; pitchDeg: number }; rotationRateDegPerSec: number; expected: Box | null; target: Detection | null; others: Detection[]; detectionAgeMs: number; simple: boolean; lumaOnTarget: number | null }): { ready: boolean; message: GuidanceMessage | null; warnings: GuidanceWarning[]; blockAuto: boolean }`. Öncelik: `personInFrame` (hedefle kesişen kişi; `blockAuto: true`), `holdLevel`, `noCar` (hedef yok veya `detectionAgeMs > staleMs`), `moveCloser`/`moveBack` (`width(target)/width(expected)` 1 ± `sizeRatio` dışında), `panLeft`/`panRight` (merkez farkı x; araç beklenenden sağdaysa `panRight`), `lower`/`raise` (merkez farkı y; araç beklenenden aşağıdaysa `lower`). `simple` veya `expected === null` ise yalnız hiza ve sabitlik bakılır. `ready` = mesaj yok ve sabit (`rotationRateDegPerSec < stableDegPerSec`). Uyarılar: hedefle kesişen başka car/truck → `otherVehicle`; `lumaOnTarget < minLuma` → `lowLight`.
    - `createAutoCapture(holdMs = TOLERANCES.holdMs): { update(ready: boolean, blockAuto: boolean, now: number): boolean; reset(): void }`: hazır durum `holdMs` boyunca kesintisiz sürünce bir kez `true` döner; `reset`e kadar tekrar dönmez.
    - `createRateMonitor(): { tick(now: number): void; isSimple(now: number): boolean }`: ilk tespitten sonra son 1 saniyedeki tespit sayısı 3 saniye boyunca 4'ün altında kalırsa basit moda geçer ve oturum boyunca orada kalır.
    - `createSpaceAdvisor(wideAvailable: boolean): { update(sizeRatio: number | null, mode: CaptureMode, now: number): 'suggestWide' | 'needsSpace' | null }`: oran `tooLargeMs` boyunca `tooLargeRatio`'nun üstündeyse normal modda ve dar alan mümkünse `'suggestWide'`, değilse `'needsSpace'` (araç bu yerden sığmıyor; tasarım 6.3).
  - `camera.ts`: `zoomFor(mode: CaptureMode, d: { minZoom: number; zoomLensSwitchFactors: number[] }): number` (normal: `zoomLensSwitchFactors[0] ?? 1`, dar alan: `minZoom`); `canUseWide(d): boolean` (`minZoom < zoomFor('normal', d)`); `shouldDetect(now: number, lastRun: number, active: boolean, intervalMs = 100): boolean` (`'worklet'` yönergesiyle; kare işleyiciden çağrılır).

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
// geometry.test.ts
test('scaleBox shrinks around the frame center', () => {
  expect(scaleBox({ x0: 0.2, y0: 0.4, x1: 0.8, y1: 0.8 }, 0.5)).toEqual({ x0: 0.35, y0: 0.45, x1: 0.65, y1: 0.65 })
})
test('silhouetteScale is 1 for the template field of view and smaller for a wider lens', () => {
  expect(silhouetteScale(69, 69)).toBeCloseTo(1)
  expect(silhouetteScale(69, 80)).toBeLessThan(1)
})
test('pickTarget prefers the vehicle overlapping the template box', () => { /* big car at the edge vs smaller car on the template → smaller one */ })
test('pickTarget ignores persons and low scores', () => { /* person + car score 0.4 → null */ })
// guidance.test.ts
test('tiltFromGravity reads level and tilted landscape holds', () => {
  expect(tiltFromGravity({ x: -9.81, y: 0, z: 0 })).toEqual({ rollDeg: 0, pitchDeg: 0 })
  expect(tiltFromGravity({ x: 9.81 * Math.cos(rad(5)), y: 9.81 * Math.sin(rad(5)), z: 0 }).rollDeg).toBeCloseTo(5)
  expect(tiltFromGravity({ x: -9.81 * Math.cos(rad(10)), y: 0, z: 9.81 * Math.sin(rad(10)) }).pitchDeg).toBeCloseTo(10)
})
test('messages follow the priority order', () => { /* tilted + far car → holdLevel; level + far car → moveCloser; level + right-shifted car → panRight; level + low car → lower */ })
test('a person touching the car blocks auto capture', () => { /* person box intersects target → message personInFrame, blockAuto true */ })
test('another vehicle touching the car only warns', () => { /* car intersects target → warnings ['otherVehicle'], ready true */ })
test('stale detections count as no car', () => { /* detectionAgeMs 500 → noCar */ })
test('simple mode checks only level and stability', () => { /* target null, simple true, level, stable → ready true */ })
test('auto capture fires once after 500 ms of readiness', () => {
  // update(true,false,0) false; update(true,false,499) false; update(true,false,500) true; update(true,false,900) false
  // update(false,...) resets the hold; blockAuto true never fires
})
test('rate monitor switches to simple mode after 3 s under 4 detections per second', () => { /* 3/s for 3000 ms → true; 5/s → false; latched */ })
test('space advisor suggests wide mode, then asks for more space', () => {
  // wideAvailable true, normal, ratio 1.3 for 2000 ms → 'suggestWide'; mode wide, ratio 1.3 for 2000 ms → 'needsSpace'
})
// camera.test.ts
test('zoomFor picks the main lens on an iPhone dual-wide device', () => {
  const iphone = { minZoom: 1, zoomLensSwitchFactors: [2] }
  expect(zoomFor('normal', iphone)).toBe(2)
  expect(zoomFor('wide', iphone)).toBe(1)
  expect(canUseWide({ minZoom: 1, zoomLensSwitchFactors: [] })).toBe(false)
})
test('detection gate skips frames inside 100 ms and while inactive', () => {
  expect(shouldDetect(1000, 950, true)).toBe(false)
  expect(shouldDetect(1050, 950, true)).toBe(true)
  expect(shouldDetect(5000, 0, false)).toBe(false)
})
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/capture`
Expected: FAIL (modüller yok).

- [ ] **Adım 3: Üç modülü yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: `cd apps/mobile && npx jest src/capture`
Expected: tüm testler geçer.

- [ ] **Adım 5: Kullanıcıya devret**

Önerilen mesaj: `add-capture-guidance-logic`.

---

### Task 4: Kalite kontrolü ve görüş açısı

**Files:**
- Create: `apps/mobile/src/capture/quality.ts`, `apps/mobile/src/capture/exif.ts`, `apps/mobile/scripts/qc-calibrate.ts`
- Test: `apps/mobile/src/capture/quality.test.ts`, `apps/mobile/src/capture/exif.test.ts`

**Interfaces:**
- Consumes: Task 1 `Box`, Task 2 `QcIssue`.
- Produces:
  - `quality.ts`: `analyzeRgba(px: Uint8Array, width: number, height: number): { meanLuma: number; clippedShare: number; laplacianVar: number }` (parlaklık `0.299R + 0.587G + 0.114B`; `clippedShare` parlaklığı 250 ve üstü piksellerin payı; `laplacianVar` gri görüntüde 4 komşulu Laplace çıktısının varyansı); `QC_LIMITS = { minLaplacianVar: 60, minMeanLuma: 40, maxClippedShare: 0.15, edgeMargin: 0.01, aspectTolerance: 0.02 }`; `qcIssues(m: ReturnType<typeof analyzeRgba>, f: { width: number; height: number; target: Box | null; exterior: boolean }): QcIssue[]`. `cutOff` yalnız dış açılarda ve hedef kutusu kenara `edgeMargin`'den yakınsa; `aspect`, `|width/height − 4/3| > aspectTolerance` ise. Analiz, fotoğrafın 320×240'a küçültülmüş hali üzerinde yapılır.
  - `exif.ts`: `focal35FromJpeg(bytes: Uint8Array): number | null` (APP1 Exif'te `FocalLengthIn35mmFilm`, etiket `0xA405`; Intel ve Motorola bayt sırası); `hfovFromFocal35(f35: number): number` = `2 · atan(34.6 / (2 · f35))` derece (34,6 mm: 43,27 mm köşegenli 4:3 karenin genişliği).
  - `qc-calibrate.ts`: `npx tsx scripts/qc-calibrate.ts <klasör>` klasördeki JPEG'leri `jpeg-js` (MIT, `devDependency`) ile açar, 320×240'a küçültür ve her biri için ve 5 piksellik kutu bulanıklığı uygulanmış kopyası için `laplacianVar`'ı yazdırır.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
// quality.test.ts (64×48 sentetik görüntüler)
test('a sharp checkerboard is not blurry and a box-blurred copy is', () => { /* laplacianVar sharp > 60 > blurred */ })
test('qcIssues flags dark and overexposed photos', () => { /* all 10 → ['dark']; all 255 → ['overexposed'] */ })
test('qcIssues flags a car touching the frame edge only for exterior photos', () => {
  // target { x0: 0.005, y0: 0.3, x1: 0.7, y1: 0.8 } → includes 'cutOff' when exterior, not when exterior false
})
test('qcIssues flags a photo that is not 4:3', () => {
  // width 1920, height 1080 → includes 'aspect'; 4032×3024 → not; 3024×4032 → includes 'aspect'
})
// exif.test.ts (testte bayt bayt kurulan küçük JPEG'ler)
test('reads the 35 mm focal length from Intel and Motorola EXIF', () => { /* II → 26; MM → 13 */ })
test('returns null without EXIF', () => { /* SOI + EOI only → null */ })
test('hfovFromFocal35 matches the main and ultra wide template angles', () => {
  expect(hfovFromFocal35(26)).toBeCloseTo(67.3, 1)
  expect(hfovFromFocal35(13)).toBeCloseTo(106.2, 1)
})
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/capture/quality.test.ts src/capture/exif.test.ts`
Expected: FAIL (modüller yok).

- [ ] **Adım 3: `quality.ts`, `exif.ts` ve `qc-calibrate.ts`'i yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: aynı komut.
Expected: 7 test geçer.

- [ ] **Adım 5: Bulanıklık eşiğini gerçek fotoğraflarla kontrol et**

Run: `cd apps/mobile && npx tsx scripts/qc-calibrate.ts ../../spikes/data/photos`
Expected: keskin fotoğrafların en düşük %5'i, bulanık kopyaların en yüksek %5'inden büyük. `minLaplacianVar` ikisinin arasına çekilir; değer ve dağılım ilerleme kaydına yazılır. Ayrılmıyorsa durulur ve kullanıcıya sorulur.

- [ ] **Adım 6: Kullanıcıya devret**

Önerilen mesaj: `add-photo-quality-checks`.

---

### Task 5: Kamera kütüphaneleri, yerel derleme ayarları ve araç tespiti

**Files:**
- Modify: `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/metro.config.js` (yoksa oluşturulur), `apps/mobile/src/app/_layout.tsx`
- Create: `apps/mobile/plugins/withResizerShaders.js`, `apps/mobile/assets/models/` (iki `.tflite`), `apps/mobile/src/capture/detector.ts`
- Test: `apps/mobile/src/capture/detector.test.ts`

**Interfaces:**
- Consumes: Task 3 `Detection`.
- Produces:
  - Paketler (`npx expo install`): `react-native-vision-camera@5.2.4 react-native-vision-camera-resizer@5.2.4 react-native-vision-camera-worklets@5.2.4 react-native-fast-tflite@3.0.1 react-native-nitro-modules@0.37.2 react-native-nitro-image@0.15.2 @shopify/react-native-skia expo-sensors expo-screen-orientation expo-asset expo-keep-awake expo-build-properties`.
  - `app.json`: `orientation: "default"`; eklentiler: `react-native-vision-camera` (kamera izni metni Almanca: "Die Kamera wird für die Fahrzeugfotos verwendet."), `["react-native-fast-tflite", { "enableAndroidGpuLibraries": true }]`, `["expo-build-properties", { "android": { "minSdkVersion": 26 } }]`, `"./plugins/withResizerShaders"`. `metro.config.js`'te `resolver.assetExts`'e `tflite` eklenir.
  - `withResizerShaders.js`: `gradle.properties`'e `android.defaults.buildfeatures.shaders=true` yazar; `android/local.properties`'e `glslc.dir`'i yazar. Yol `GLSLC_DIR` ortam değişkeninden, yoksa `ANDROID_NDK_HOME` veya `ANDROID_HOME/ndk/<en yeni>` altındaki `shader-tools/<host>` klasöründen bulunur; bulunamazsa prebuild açık bir hata mesajıyla durur.
  - Kök `_layout.tsx`: açılışta `ScreenOrientation.lockAsync(OrientationLock.PORTRAIT_UP)`.
  - `detector.ts`: `MODEL = Platform.OS === 'ios' ? { asset: require('…/efficientdet_lite2_det.tflite'), size: 448, delegates: [] } : { asset: require('…/efficientdet_lite0_det.tflite'), size: 320, delegates: ['android-gpu'] }`; `CLASS_IDS = { person: 0, car: 2, truck: 7 }`; `parseDetections(boxes: Float32Array, classes: Float32Array, scores: Float32Array, count: number, minScore = 0.5): Detection[]` (`'worklet'`; kutular `[ymin, xmin, ymax, xmax]` 0–1); `useDetectorModel(): { model: TensorflowModel | null; error: string | null }` (model `expo-asset` ile dosyaya çıkarılıp `{ url }` olarak verilir; M0'daki Android hatası).

- [ ] **Adım 1: Tespit modellerini kullanıcıya sor**

TensorFlow Hub / Kaggle'daki EfficientDet-Lite0 ve Lite2 "detection (metadata)" TFLite dosyaları (TensorFlow, Apache-2.0, yaklaşık 4,4 MB ve 7,2 MB) kaynak bağlantısı, lisans ve boyutla kullanıcıya sorulur.
Expected: onaydan sonra iki dosya `apps/mobile/assets/models/` altına indirilir ve commit'e girer.

- [ ] **Adım 2: Başarısız testi yaz (`detector.test.ts`)**

```ts
test('parseDetections keeps cars, trucks and persons above the score', () => {
  // count 4: car 0.9, truck 0.6, person 0.7, bicycle(1) 0.9, plus a car at 0.3 beyond count → 3 detections
  // first box [0.1, 0.2, 0.5, 0.6] → { x0: 0.2, y0: 0.1, x1: 0.6, y1: 0.5 }
})
```

- [ ] **Adım 3: Testin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/capture/detector.test.ts`
Expected: FAIL (modül yok).

- [ ] **Adım 4: Paketleri, ayarları, eklentiyi ve `detector.ts`'i yaz**

- [ ] **Adım 5: Testlerin geçtiğini ve derlemelerin çıktığını gör**

Run: `cd apps/mobile && npx jest && npx expo prebuild --clean`, sonra `DEVELOPER_DIR=… LANG=en_US.UTF-8 npx expo run:ios` ve `npx expo run:android`
Expected: birim testleri geçer; iki platformda uygulama açılır, giriş ve araç ekranları eskisi gibi çalışır. iOS'ta Metal araç seti eksikse `xcodebuild -downloadComponent MetalToolchain` (aynı `DEVELOPER_DIR` ile) çalıştırılır.

- [ ] **Adım 6: Modelin çıkışlarını telefonda doğrula**

Geliştirici derlemesinde model yüklenince `model.outputs` bir kez günlüğe yazılır.
Expected: dört çıkış (kutular, sınıflar, skorlar, sayı). Değilse durulur ve kullanıcıya sorulur.

- [ ] **Adım 7: Kullanıcıya devret**

Önerilen mesaj: `add-camera-libs-detector`.

---

### Task 6: Çekim ekranı

**Files:**
- Move: `apps/mobile/src/app/(app)/vehicles/[id].tsx` → `apps/mobile/src/app/(app)/vehicles/[id]/index.tsx`
- Create: `apps/mobile/src/app/(app)/vehicles/[id]/capture.tsx`, `apps/mobile/src/capture/useGuidedCamera.ts`, `apps/mobile/src/capture/Overlay.tsx`, `apps/mobile/src/capture/ReviewSheet.tsx`, `apps/mobile/src/capture/takePhoto.ts`, `apps/mobile/src/capture/flow.ts`
- Modify: `apps/mobile/src/locales/de.json`, `tr.json`, `en.json`
- Test: `apps/mobile/src/capture/flow.test.ts`

**Interfaces:**
- Consumes: Task 1 `templateFor`, `wideAllowed`; Task 2 `CaptureInfo`, `QcResult`, `photoFileName`, `savePhoto`; Task 3 tamamı; Task 4 `analyzeRgba`, `qcIssues`, `focal35FromJpeg`, `hfovFromFocal35`; Task 5 `useDetectorModel`, `parseDetections`, `MODEL`; M1a `useSession`, `useSync`, `getMeta`, `setMeta`, `listPhotos`.
- Produces:
  - Rota: `/vehicles/[id]/capture?slot=<Slot>`. Araç ekranındaki her adım bu rotayı açar.
  - `flow.ts`: `nextSlot(current: Slot, photos: { slot: Slot }[]): Slot | null` (aynı bölümde, mevcut adımdan sonraki ilk eksik adım; bölüm sonundan başa sarar; hepsi çekiliyse `null`).
  - `takePhoto.ts`: `type TakenPhoto = { uri: string; width: number; height: number; metrics: ReturnType<typeof analyzeRgba>; issues: QcIssue[]; focal35: number | null }`; `takePhoto(output: PhotoOutput, ctx: { vehicleId: string; slot: Slot; capturedAt: string; target: Box | null; exterior: boolean }): Promise<TakenPhoto>`. Fotoğrafı çeker (`flashMode: 'off'`), 320×240 RGBA'ya küçültür (react-native-nitro-image), `analyzeRgba` ve `qcIssues`'ı çalıştırır, dosyanın baytlarından `focal35FromJpeg` okur, dosyayı `Paths.document/photos/<photoFileName>`'e taşır.
  - `useGuidedCamera({ slot, bodyType, active })`: kamera cihazını, çıkışları (`usePhotoOutput({ targetResolution: CommonResolutions.UHD_4_3, qualityPrioritization: 'balanced' })`, 4:3 hedef çözünürlüklü kare akışı), kare işleyiciyi (`shouldDetect` ile en çok 10/s; `resizer` → `model.runSync` → `parseDetections`; hedef kutusu içindeki ortalama parlaklık), sensörleri ve Task 3'ün değerlendirmesini saniyede 10 kez birleştirir. Sensör: `DeviceMotion`; yerçekimi olarak `accelerationIncludingGravity`, dönüş hızı olarak `rotationRate`'in en büyük mutlak bileşeni (derece/saniye). Şablon kutusu `scaleBox(template.box, silhouetteScale(template.hfovDeg, cihazınAçısı))` ile ölçeklenir. Cihazın açısı `meta`'daki `hfov.normal` veya `hfov.wide` değeridir; çekimden okunan `focal35` varsa `hfovFromFocal35` ile buraya yazılır, yoksa şablonun kendi açısı kullanılır. Dönen durum: `{ template, mode, setMode, wideAvailable, guidance: ReturnType<typeof evaluateGuidance>, simple, advice: 'suggestWide' | 'needsSpace' | null, autoCapture, setAutoCapture, capture(): Promise<TakenPhoto> }`.
  - Ekran:
    - Çekim ekranı açılınca yatay kilitlenir (`OrientationLock.LANDSCAPE`), kapanınca dikeye döner; ekran açık tutulur (`useKeepAwake`).
    - Önizleme 4:3 bir alanda gösterilir (kenarlarda siyah bant). Silüet, hedef kutusu ve fotoğraf aynı koordinatlarda olur.
    - Silüet Skia ile çizilir; hazır olunca yeşile döner. Altta tek bir yönlendirme mesajı ve varsa uyarılar görünür.
    - Deklanşör her zaman vardır. Otomatik çekim düğmesi varsayılan açık, seçim `meta`'da `autoCapture` olarak saklanır.
    - Dar alan düğmesi yalnız `wideAvailable && wideAllowed(slot)` iken görünür. `advice === 'suggestWide'` önerisi düğmeyi öne çıkarır; `'needsSpace'` aracın bu yerden sığmadığını söyler.
    - Basit modda konum mesajları gizlenir ve "Automatik aus" bilgisi görünür.
    - Hedef kutusu 1 saniye sabit kalınca `focusTo` ile kutunun merkezine odaklanılır, en çok 3 saniyede bir.
    - Çekimden sonra tespit durur. Sorun yoksa fotoğraf kaydedilir ve sıradaki eksik adıma geçilir. Sorun varsa `ReviewSheet` sorunları adıyla gösterir; "Neu aufnehmen" ve "Trotzdem verwenden" seçenekleri vardır (ikincisi `qc.accepted = true`). `savePhoto`'nun döndürdüğü `replacedUri` silinir.
    - Detay ve iç mekân adımlarında silüet ve tespit yoktur. Adımın talimatı (`capture.instructions.<slot>`), hiza göstergesi ve deklanşör görünür; kalite kontrolünde `cutOff` bakılmaz.
    - "Fertig" düğmesi eksik dış açı varsa adlarını listeler, örneğin "Linke Seite fehlt". "Trotzdem beenden" ve "Weiter fotografieren" seçenekleri vardır.
  - i18n anahtarları: `capture.messages.*` (Task 3'teki her `GuidanceMessage`), `capture.warnings.*`, `capture.advice.*`, `capture.qc.*` (her `QcIssue`), `capture.instructions.*` (16 detay ve iç mekân adımı), `capture.finish.*`.

- [ ] **Adım 1: `no-slop-ui` skill'ini yükle**

- [ ] **Adım 2: Başarısız testi yaz (`flow.test.ts`)**

```ts
test('nextSlot moves to the next missing step of the same section and wraps', () => {
  expect(nextSlot('front', [{ slot: 'front_left_45' }, { slot: 'front' }])).toBe('front_right_45')
  expect(nextSlot('left', [{ slot: 'left' }])).toBe('front_left_45')
  expect(nextSlot('detail_wheel', [{ slot: 'detail_wheel' }])).toBe('detail_headlights')
  expect(nextSlot('front', EXTERIOR_SLOTS.map((slot) => ({ slot })))).toBeNull()
})
```

- [ ] **Adım 3: Testin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/capture/flow.test.ts`
Expected: FAIL (modül yok).

- [ ] **Adım 4: `flow.ts`'i, ekranı ve bileşenleri yaz**

- [ ] **Adım 5: Testlerin geçtiğini gör**

Run: `cd apps/mobile && npx jest`
Expected: tüm birim testleri geçer; i18n testi üç dilde aynı anahtarları bulur.

- [ ] **Adım 6: Telefonlarda dene ve toleransları ayarla**

Kullanıcıdan iPhone 11, Galaxy A34 ve Tecno CAMON 18P için Geliştirici Modu ve kablosuz bağlantı istenir. Release derlemesiyle bir aracın 8 dış açısı çekilir; kamera görüntüsüne yalnız kullanıcı onay verirse bakılır.
Expected:
- Telefon düzken hiza açıları 0 ± 1°'dir.
- Mesajlar doğru yönü söyler (yaklaş, uzaklaş, sola, sağa, indir, kaldır).
- Otomatik çekim tutunca yarım saniye içinde çalışır.
- Bu üç telefonda basit moda geçilmez.
- Fotoğraflar her telefonda yatay, düz ve 4:3'tür (A34 dahil).
- Bilerek bulanık ve karanlık çekilen fotoğraflar kalite uyarısı verir.
- Sabitlik ve bulanıklık eşikleri, mesaj toleransları gerekiyorsa değiştirilir. Yeni değerler `TOLERANCES` ve `QC_LIMITS`'e yazılır, nedenleri ilerleme kaydına.

- [ ] **Adım 7: Kullanıcıya devret**

Önerilen mesaj: `add-guided-capture-screen`.

---

### Task 7: Lisanslar ekranı, kurulum notları ve uçtan uca kontrol

**Files:**
- Create: `apps/mobile/src/app/(app)/licenses.tsx`
- Modify: `apps/mobile/src/app/(app)/account.tsx`, `apps/mobile/src/locales/*.json`, `README.md`

**Interfaces:**
- Consumes: Task 1 `TEMPLATE_CREDITS`; Task 1–6.
- Produces:
  - Lisanslar ekranı hesap ekranından açılır. Her 3D model için model adı, yazar, lisans ve bağlantı listelenir (CC BY gereği). Ayrıca EfficientDet-Lite modelleri (TensorFlow, Apache-2.0) yer alır.
  - `README.md`'ye "Kamera ve cihaz" bölümü eklenir:
    - iOS'ta Metal araç seti (`xcodebuild -downloadComponent MetalToolchain`).
    - Android NDK `shader-tools` ve `GLSLC_DIR`; `minSdkVersion` 26.
    - Modellerin ve şablonların nereden geldiği.
    - iPhone'a kablosuz kurulum (`devicectl`) ve Android'de kablosuz hata ayıklama.

- [ ] **Adım 1: Lisanslar ekranını ve README bölümünü yaz**

- [ ] **Adım 2: Kontrol listesini telefonlarda çalıştır**

Expected, iPhone 11, Galaxy A34 ve Tecno CAMON 18P'de:
1. İnternet kapalıyken bir aracın 8 dış açısı, bir detay ve bir iç mekân fotoğrafı çekilir.
2. Bir açı yeniden çekilince listede tek fotoğraf kalır ve eski dosya silinir.
3. İnternet açılınca fotoğraflar yüklenir. Storage'daki dosyalar 4:3 ve düzdür. `photos` satırlarında `capture` ve `qc` doludur.
4. "Fertig", eksik dış açıları adıyla gösterir.
5. Kadrajda araca değen bir kişiyle otomatik çekim bekler. Komşu araç yalnız uyarı verir.
6. iPhone 11'de 10 dakikalık çekim oturumunda tespit hızı saniyede 8'in altına düşmez. İnceleme ekranında tespit durur.
7. Dar alan modu iPhone 11'de yan ve 45° açılarda görünür, iki Android'de görünmez.
8. Lisanslar ekranı açılır.

Sonuçlar ilerleme kaydına yazılır.

- [ ] **Adım 3: Tüm testleri çalıştır**

Run: `npm run db:reset && npm run db:test && npm run test:int && npm run test:int:mobile && (cd apps/mobile && npx jest) && tools/templates/.venv/bin/python -m pytest tools/templates -q`
Expected: hepsi geçer.

- [ ] **Adım 4: Kullanıcıya devret**

Önerilen mesaj: `add-licenses-camera-setup-notes`.
