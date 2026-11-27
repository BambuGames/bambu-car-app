# M2d Telefon Turu Düzeltmeleri Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 17 Kasım 2026 telefon turunda çıkan bulguları kapatmak. Hedef: gerçek bir araç gerçek telefonlarla çekildiğinde fotoğraflar, plakalar ve rötuş, galerinin elle düzeltmesine gerek kalmadan ya da düzeltmeyi kolaylaştırarak doğru çıksın.

**Architecture:**
- **Servis:** İşleme hattında dört küçük kural değişir:
  - Plakayı kapattığımız alan maskeye geri konur.
  - Plaka yalnız plakanın görünebileceği karelerde aranır.
  - Banner aracın dışına taşmaz.
  - Hedef kutuya yalnız değen komşu parçalar atılır.
  Hepsi saf numpy/OpenCV fonksiyonlarıdır, pytest ile sentetik maskelerle sınanır.
- **Çekim:**
  - 4:3'ten geniş gelen fotoğraf, telefonda önizlemenin gösterdiği 4:3 ortaya kırpılır; görüş açısı da buna göre düzeltilir.
  - Kalite kontrolü aşırı eğimi bildirir.
  - Geniş modda parmak uyarısı görünür.
  - iOS döndürme kilidi simülatörde yeniden üretilip düzeltilir.
- **Düzenleyiciler:**
  - Plaka ve rötuş ekranlarında iOS geri kaydırma hareketi kapanır.
  - İki parmakla yakınlaştırma ve kaydırma gelir; görünüm matematiği saf bir modülde Jest'le sınanır.
  - "Teil entfernen", maskeyi telefonda küçük boyutta okuyup araca yapışık parçaya dokunulduğunda ne yapılacağını söyler.

**Tech Stack:** Expo SDK 58 / RN 0.88, expo-router, react-native-gesture-handler 3.3 (v3 hook API: `usePinchGesture`, `usePanGesture`, `useTapGesture`, `useSimultaneousGestures`, `GestureDetector`), @shopify/react-native-skia 2.14, react-native-vision-camera 5.2.4 + react-native-nitro-image (`cropAsync`, `saveToFileAsync`), Jest 30. Servis: Python 3.13, OpenCV, numpy, pytest. pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (özellikle 6.2–6.4, 7.2–7.4). **Bulgular:** `.superpowers/sdd/2026-11-16-m2c-pilot-release/phone-round.md` (21 madde; bu plandaki numaralar oradakilerdir). **Önceki planlar:** M2a `2026-11-12-m2a-processing-pipeline.md`, M2b `2026-11-12-m2b-studio-app.md`, M2c `2026-11-16-m2c-pilot-release.md`.

**Plan sırası ve kararlar:**
- **Spec'ten sapmalar (kullanıcı onayına sunulur):**
  - 7.2.2 "hedef kutuya değen parçalar tutulur" der. Yeni kural: kutuyla en çok örtüşen parça ve pikselinin en az yarısı kutunun içinde kalan parçalar tutulur (Task 3).
    - Gerekçe: Opel'in sol ön çaprazındaki komşu araç ayrı bir parçaydı ama kutuya değdiği için tutuldu.
    - Aracın uçları ve anteni ana parçaya bağlı olduğundan M0'ın kaygısı korunur.
  - 7.3 "plaka görünüyorsa banner da uygulanır" der. Yeni kural: iç mekânda plaka hiç aranmaz; detaylarda yalnız far, stop ve açık bagaj karelerinde aranır (Task 2).
    - Gerekçe: Chery'nin 5 iç karesine ve Opel'in motor karesine yanlış banner basıldı.
    - Gerçekten görünen bir plaka, fotoğraf ekranındaki tek fotoğraf plaka düzenlemesiyle yine kapatılabilir.
- **Hata kaynağı bulunanlar:**
  - **Bulgu 7:** Plaka deliğini Photoroom değil biz açıyoruz. Plakayı göndermeden önce düz bir renkle kapatıyoruz (spec 7.2.2); karanlık otoparkta bu düz yama arka plan sanılıp maskeden düşüyor.
  - **Bulgu 19:** Kaydedilen 4 "Teil entfernen" dokunuşunun hepsi aracın kendi parçasına düşmüş. Servis ana parçayı bilerek silmiyor ve kullanıcı geri bildirim almıyor.
  - **Bulgu 1 ve 3 (Galaxy kısmı):** Galaxy 16:9 çekiyor, önizleme ise 4:3'ün ortasını gösteriyor. EXIF'ten öğrenilen görüş açısı tüm 16:9 genişliğe ait (69,4°), görünen alan ise yaklaşık 54,9°. Bu yüzden siluet yaklaşık %25 küçük çiziliyor.
  - **Bulgu 5:** Opel'in 10,8–13,1° yatık kareleri hiç düzeltilmedi, çünkü servis 10°'nin üstünü "elde tutma sallantısı değil" sayıp bırakıyor (`MAX_ROLL_DEG`). Telefon zaten yatay kilitli; ±20° sallantıdır.
- **Kaynağı bilinmeyenler simülatörde yeniden üretilir:**
  - iOS döndürme kilidinde kayma (Task 6).
  - Plaka ve rötuş ekranında sayfa üstünün başlığın altında kalması (Task 7).
  Yeniden üretilemezse ledger'a yazılır ve telefon turu 2'de ekran kaydı istenir.
- **Bilinçli olarak dışarıda:**
  - **iPhone'da şablon çizgilerinin araçla örtüşmemesi:** Kanıt yok, ekran görüntüsü yok. Crossland bir crossover ama hatchback seçildi. Telefon turu 2'de üç açıdan ekran görüntüsü alınır; şablon kararı ona göre verilir.
  - **Yönlendirme toleransları (eğim 4°, yatıklık 2°):** iPhone'da hiç otomatik çekim olmamasının olası sebebi bunlar, ama tek turluk veriyle değiştirilmez. Tur 2'de hangi mesajın takıldığı not edilir.
  - **Tekerlek altında kalan çimenler (bulgu 11):** Küçük; rötuşla silinir.
  - **Personel davet e-postası:** Yayın aşamasında SMTP ile gelir.
  - **16:9 karelerde tespit kutuları:** VisionCamera noktaları `convertFramePointToCameraPoint` ile önizleme koordinatına çeviriyor; tur 2'de Galaxy'de doğrulanır.

## Global Constraints

**Arayüz ve metin**
- Arayüz Almanca; Türkçe ve İngilizce de var. Her yeni metin üç dil dosyasına (`src/locales/de.json`, `tr.json`, `en.json`) girer ve i18n anahtar testi geçer.
- Tüm UI çalışmaları /no-slop-ui kuralına uyar. UI kodu ya da metni yazmadan önce `no-slop-ui` skill'i yüklenir. Tema `src/ui/theme.ts`'dir; mevcut `Button`, `Notice`, `Segmented` kullanılır.
- Kesinleşmiş Almanca metinler:
  - `capture.qc.tilted`: "Das Telefon war stark geneigt. Das Fahrzeug wirkt dadurch verzerrt."
  - `capture.wideHint`: "Ultraweitwinkel: Halten Sie die Finger vom Bildrand fern."
  - `touchUp.removeJoined`: "Dieses Teil hängt am Fahrzeug. Trennen Sie es zuerst mit „Radieren“ ab und tippen Sie es dann an."

**Kod kuralları**
- Uygulama React Compiler ile derleniyor:
  - Hook bağımlılıkları tetikleyici olarak kullanılmaz.
  - Render içinde `Date.now()` okunmaz.
  - Ref'lere yalnız effect ve callback içinde yazılır.
- Servis çıktısı 2560×1920, JPEG, 4:3'tür (spec 7.2.10). Maskeler, kenar düzeltmeleri ve plaka köşeleri dik orijinalin 0–1 koordinatlarında saklanır.
- Bağlantı: `cv2.connectedComponentsWithStats(..., connectivity=8)`, eşik `alpha >= 128`. Uygulamadaki eşleniği aynı kuralı izler.

**Araçlar, hesaplar ve commit**
- Global kurulum yapılmaz. Xcode her komutta `DEVELOPER_DIR=/Users/egemenderbedek/Downloads/Xcode-26.6.app/Contents/Developer` ile seçilir; CocoaPods `LANG=en_US.UTF-8` ister.
- Metro 8082'de çalışır (8081 başka projenin). Diğer projelerin emülatör ve uygulamalarına dokunulmaz.
- Photoroom'a giden her gerçek çağrı ve ücretli her adım önce kullanıcıya sorulur.
- Telefon ve simülatördeki izin pencerelerini kullanıcı yanıtlar.
- Buluta migration göndermek (`db push --remote --yes`) yalnız kullanıcı açıkça evet derse yapılır.
- Commitleri kullanıcı atar. Her görev değişen dosyalar ve önerilen mesajla biter; `git commit` çalıştırılmaz.
- İş bitince arka planda çalışan her şey (Supabase, servis konteyneri, Metro, simülatör, Docker) durdurulur.

**Test komutları**
- Uygulama: `cd apps/mobile && npx tsc --noEmit && npx jest`
- Servis: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
- Veritabanı: `npm run db:test` (yerel Supabase açıkken)

## Review Focus

1. **Arka plandaki başka bir aracın plakası:** Kapattığımız plaka hedef araca ait değilse, kapatılan alan maskeye geri konmamalı. Yoksa havada asılı bir yama kalır. → Task 1, `test_restore_leaves_a_plate_off_the_car`.
2. **Detay ve iç karelerde banner kırpması:** Bu karelerde araç maskesi yoktur; banner kırpılmadan tam basılmalı, hata vermemeli. → Task 2, `test_banner_is_not_clipped_without_a_mask` ve `detail_taillights` pipeline testi.
3. **Zaten 4:3 olan ya da dikey gelen fotoğraf:** iPhone'un 4032×3024'ü ve dikey bir kare kırpılmamalı; yalnız 4:3'ten geniş yatay kare kırpılır. → Task 4, `centerCrop43` testleri.
4. **Maske yüklenemezken rötuş:** Çevrimdışı, eski bir fotoğraf ya da indirme hatası durumunda "Teil entfernen" bugünkü gibi dokunuşu kabul etmeli, kullanıcıyı engellememeli. → Task 9, `judgeRemove accepts every tap when the mask is not loaded`.
5. **Yakınlaştırmanın sınırları:** 1x'in altına inen ya da fotoğrafın kenarından taşan görünüm boş alan göstermemeli. Yüksek yakınlaştırmada sürüklenen köşe 0–1 dışına çıkmamalı. → Task 8, `viewport` testleri.

---

### Task 1: Kapatılan plaka alanını maskeye geri koy (bulgu 7, 17)

**Files:**
- Modify: `services/image-worker/worker/plate.py` (`cover`'ın büyütülmüş kutusu ortak yardımcıya çıkar; `restore_covered` eklenir)
- Modify: `services/image-worker/worker/pipeline.py:68-84` (`_analyze`)
- Test: `services/image-worker/tests/test_plate.py`, `services/image-worker/tests/test_pipeline.py`

**Interfaces:**
- Produces:
  - `cover_box(box: Box, w: int, h: int) -> Box | None`: `cover`'ın kullandığı, her yöne %10 büyütülüp görüntüye kırpılmış kutu; boşsa `None`.
  - `restore_covered(alpha: np.ndarray, boxes: list[Box], min_ring: float = 0.5) -> np.ndarray`: her kapatılan kutunun çevresindeki halkanın en az `min_ring`'i araçsa (`alpha >= 128`), kutunun içi 255 yapılır. Halka, `cover_box`'ın dışında `max(3, kutu yüksekliği // 2)` piksel kalınlığındadır.

- [ ] **Adım 1: Başarısız testleri yaz** (`test_plate.py`)

```python
def test_restore_fills_a_plate_hole_inside_the_car():
    alpha = np.zeros((200, 300), np.uint8)
    alpha[50:180, 40:260] = 255
    box = (120, 120, 180, 135)
    x0, y0, x1, y1 = cover_box(box, 300, 200)
    alpha[y0:y1, x0:x1] = 0  # Photoroom took the flat cover for background
    out = restore_covered(alpha, [box])
    assert out[127, 150] == 255 and out[10, 10] == 0


def test_restore_fills_a_plate_hole_at_the_cars_edge():
    alpha = np.zeros((200, 300), np.uint8)
    alpha[50:180, 100:260] = 255
    box = (98, 120, 158, 135)  # rear plate seen at an angle, at the car's left outline
    x0, y0, x1, y1 = cover_box(box, 300, 200)
    alpha[y0:y1, x0:x1] = 0
    assert restore_covered(alpha, [box])[127, 130] == 255


def test_restore_leaves_a_plate_off_the_car():
    alpha = np.zeros((200, 300), np.uint8)
    alpha[50:180, 150:290] = 255
    out = restore_covered(alpha, [(20, 120, 80, 135)])  # a plate on another car, on the background
    assert out[127, 50] == 0
```

`test_pipeline.py`'ye:

```python
def test_a_plate_cut_out_of_the_mask_is_put_back():
    mask = shape_mask()
    x0, y0, x1, y1 = cover_box(PLATE, W, H)
    mask[y0:y1, x0:x1] = 0
    store, photoroom, detector = setup([{"id": "p1", "slot": "front", "index": 1, "mask": mask}])
    go(store, photoroom, detector, ["p1"])
    row = store.photo_rows["p1"]
    assert row["plate_status"] == "auto"
    stored = cv2.imdecode(np.frombuffer(store.files[("processed", row["mask_path"])], np.uint8), cv2.IMREAD_GRAYSCALE)
    assert stored[(PLATE[1] + PLATE[3]) // 2, (PLATE[0] + PLATE[2]) // 2] == 255
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_plate.py services/image-worker/tests/test_pipeline.py -q`
Expected: FAIL. `cover_box` ve `restore_covered` henüz yok; pipeline testi `needs_check` döner.

- [ ] **Adım 3: Uygula**
  - `cover`, kutusunu `cover_box`'tan alır.
  - `_analyze`'da Photoroom maskesi boyutlandıktan sonra ve `keep_target`'tan önce `alpha = plates_mod.restore_covered(alpha, [box for _, box in found])` çağrılır. Böylece plaka, hedef aracın parçasına katılır ve `pick_target` onu bulur.

- [ ] **Adım 4: Servis testlerinin tamamını çalıştır**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
Expected: PASS (69 + 4)

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `upd-worker-restore-covered-plates`.

---

### Task 2: Plaka hangi karelerde aranır, banner araçta kalır (bulgu 10, 12, 13)

**Files:**
- Modify: `services/image-worker/worker/pipeline.py` (`PLATE_DETAIL_SLOTS`, `_analyze`, `_render`)
- Modify: `services/image-worker/worker/plate.py` (`warp_banner` kırpma parametresi)
- Test: `services/image-worker/tests/test_plate.py`, `services/image-worker/tests/test_pipeline.py`

**Interfaces:**
- Produces:
  - `PLATE_DETAIL_SLOTS = {"detail_headlights", "detail_taillights", "detail_trunk_open"}`.
  - `warp_banner(canvas, banner_rgba, corners, clip: np.ndarray | None = None) -> np.ndarray`: `clip` verilirse bannerın saydamlığı `clip / 255` ile çarpılır.

- [ ] **Adım 1: Başarısız testleri yaz**

`test_plate.py`:

```python
def test_banner_stays_on_the_car():
    canvas = np.zeros((100, 100, 3), np.uint8)
    banner = np.zeros((10, 40, 4), np.uint8)
    banner[..., 2], banner[..., 3] = 255, 255
    clip = np.zeros((100, 100), np.uint8)
    clip[:, :50] = 255  # the car ends at x = 50
    out = warp_banner(canvas, banner, np.float32([[10, 40], [90, 40], [90, 60], [10, 60]]), clip)
    assert out[50, 30, 2] > 200 and out[50, 70].sum() == 0


def test_banner_is_not_clipped_without_a_mask():
    canvas = np.zeros((100, 100, 3), np.uint8)
    banner = np.zeros((10, 40, 4), np.uint8)
    banner[..., 2], banner[..., 3] = 255, 255
    out = warp_banner(canvas, banner, np.float32([[10, 40], [90, 40], [90, 60], [10, 60]]))
    assert out[50, 70, 2] > 200
```

`test_pipeline.py`:

```python
@pytest.mark.parametrize("slot, status", [("interior_cockpit", "none"), ("detail_engine", "none"), ("detail_taillights", "auto")])
def test_plates_are_searched_only_where_a_plate_can_show(slot, status):
    store, photoroom, detector = setup([{"id": "p1", "slot": slot, "index": 1}])  # the detector finds PLATE
    go(store, photoroom, detector, ["p1"])
    assert store.photo_rows["p1"]["plate_status"] == status
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_plate.py services/image-worker/tests/test_pipeline.py -q`
Expected: FAIL. `warp_banner`'ın `clip` parametresi yok; iç ve motor kareleri `auto` döner.

- [ ] **Adım 3: Uygula**
  - `_analyze`, dış açılar ve `PLATE_DETAIL_SLOTS` dışında dedektörü hiç çağırmaz (`found = []`).
  - `_render`, dış açılarda `warp_banner`'a `car_alpha`'yı `clip` olarak verir; diğer karelerde vermez.
  - Var olan `test_a_missing_plate_is_flagged_only_where_one_should_be` testi (`detail_wheel` → `none`) değişmeden geçer.

- [ ] **Adım 4: Servis testlerinin tamamını çalıştır**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `upd-worker-plate-slots-banner-clip`.

---

### Task 3: Hedef araç parçaları ve ufuk (bulgu 5, 8)

**Files:**
- Modify: `services/image-worker/worker/imaging.py` (`keep_target`, `MAX_ROLL_DEG`)
- Test: `services/image-worker/tests/test_imaging.py`

**Interfaces:**
- Produces:
  - `keep_target(alpha, target_box)`, imzası aynı. Kutu varken tutulanlar:
    - kutunun içinde en çok pikseli olan parça;
    - pikselinin en az yarısı kutunun içinde kalan diğer parçalar.
    Kutusuz dal değişmez.
  - `MAX_ROLL_DEG = 20`.

- [ ] **Adım 1: Başarısız testleri yaz**

```python
def test_keep_target_drops_a_neighbour_that_only_grazes_the_box():
    alpha = blob(blob(np.zeros((100, 200), np.uint8), 20, 30, 120, 90), 130, 30, 200, 90)  # car, neighbour
    kept = keep_target(alpha, (0.05, 0.25, 0.7, 0.95))  # the box reaches 10 px into the neighbour
    assert kept[60, 70] == 255 and kept[60, 170] == 0


def test_keep_target_keeps_a_detached_piece_inside_the_box():
    alpha = blob(blob(np.zeros((100, 200), np.uint8), 20, 30, 120, 90), 125, 40, 135, 50)  # car, mirror
    kept = keep_target(alpha, (0.05, 0.25, 0.75, 0.95))
    assert kept[45, 130] == 255


def test_straighten_levels_a_roll_of_13_degrees():
    img = np.random.default_rng(0).integers(0, 255, (30, 40, 3), np.uint8)
    _, _, m = straighten(img, None, 13)
    assert not np.allclose(m, [[1, 0, 0], [0, 1, 0]])
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_imaging.py -q`
Expected: FAIL. Komşu tutulur ve 13° yatıklık yok sayılır.
- Ayna testi bugünkü kuralda da geçer; yeni kuralın onu bozmadığını gösteren koruma testidir.
- Var olan beş `keep_target`/`straighten` testi geçmeye devam eder; `ignores_an_out_of_range_roll` 90° kullanıyor.

- [ ] **Adım 3: Uygula**
  - Kutu içindeki piksel sayısı `labels[by0:by1, bx0:bx1]` üzerinde `np.bincount` ile bulunur.
  - Kodun yorumu spec 7.2.2'den sapmayı ve gerekçesini yazar: "değen" yerine "çoğu içinde"; aracın uçları ana parçaya bağlı.

- [ ] **Adım 4: Servis testlerinin tamamını çalıştır**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
Expected: PASS. Pipeline'ın `neighbour` köprülü testleri değişmez; köprülü komşu aynı parça olduğu için rötuşa kalır.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `upd-worker-target-parts-roll`.

---

### Task 4: 4:3'ten geniş fotoğrafı telefonda kırp (bulgu 1, 3'ün Galaxy kısmı)

**Files:**
- Modify: `apps/mobile/src/capture/camera.ts` (`centerCrop43`, `hfovAfterCrop`)
- Modify: `apps/mobile/src/capture/takePhoto.ts` (kırpma, `cropShare`)
- Modify: `apps/mobile/src/capture/useGuidedCamera.ts:292-300` (görüş açısını kırpmaya göre düzelt)
- Test: `apps/mobile/src/capture/camera.test.ts`

**Interfaces:**
- Produces:
  - `centerCrop43(width: number, height: number): { x: number; y: number; width: number; height: number }`. Yalnız `width / height > 4/3 + 0.02` olan yatay karede ortadaki 4:3'ü verir (`width = round(height * 4/3)`, `x = floor((W − width) / 2)`, `y = 0`); diğer her durumda tam kare.
  - `hfovAfterCrop(hfovDeg: number, share: number): number` = `2·atan(tan(hfov/2)·share)`, derece.
  - `TakenPhoto.cropShare: number`: kırpılan genişlik / tam genişlik; kırpma yoksa 1.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('centerCrop43 keeps the middle 4:3 of a wide landscape photo only', () => {
  expect(centerCrop43(3840, 2160)).toEqual({ x: 480, y: 0, width: 2880, height: 2160 });
  expect(centerCrop43(4032, 3024)).toEqual({ x: 0, y: 0, width: 4032, height: 3024 });
  expect(centerCrop43(1080, 1920)).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
});

test('hfovAfterCrop narrows the angle to the kept share', () => {
  expect(hfovAfterCrop(69.4, 0.75)).toBeCloseTo(54.9, 1);
  expect(hfovAfterCrop(69.4, 1)).toBeCloseTo(69.4, 5);
});
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/capture/camera.test.ts`
Expected: FAIL (fonksiyonlar yok).

- [ ] **Adım 3: Uygula**
  - **`takePhoto`:**
    - Önce dosyayı kaydeder ve `focal35`'i EXIF'ten okur.
    - Sonra `centerCrop43` kırpma istiyorsa `image.cropAsync(x, y, x + width, y + height)` ile kırpar ve `saveToFileAsync(path, 'jpg', 92)` ile aynı dosyanın üstüne yazar.
    - Metrikler, kalite sorunları ve dönen `width`/`height` kırpılmış görüntüden hesaplanır.
  - **`useGuidedCamera.capture`:** `plausibleHfov` sonucu `cropShare < 1` ise `hfovAfterCrop` ile düzeltilir. Saklanan `hfov.normal`/`hfov.wide` ve `CaptureInfo.hfovDeg` bu değerdir.
  - **Yorum:** Önizleme 4:3 kutuda ortayı gösterdiği için kırpılan kare kullanıcının gördüğüdür.

- [ ] **Adım 4: Uygulama testlerinin tamamını çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `upd-capture-crop-wide-photos`. Galaxy'de doğrulama telefon turu 2'dedir (Task 11).

---

### Task 5: Aşırı eğim uyarısı ve geniş mod ipucu (bulgu 4, 5, 9)

**Files:**
- Modify: `apps/mobile/src/domain/capture.ts` (`QcIssue`'ya `'tilted'`)
- Modify: `apps/mobile/src/capture/quality.ts` (`QC_LIMITS.maxRollDeg = 20`, `QC_LIMITS.maxPitchDeg = 20`, `qcIssues`'a `tilt`)
- Modify: `apps/mobile/src/capture/takePhoto.ts`, `apps/mobile/src/capture/useGuidedCamera.ts` (çekim anındaki `tiltFromGravity(g)` takePhoto'ya gider)
- Modify: `apps/mobile/src/app/(app)/vehicles/[id]/capture.tsx` (geniş modda ipucu satırı)
- Modify: `apps/mobile/src/locales/{de,tr,en}.json` (`capture.qc.tilted`, `capture.wideHint`)
- Test: `apps/mobile/src/capture/quality.test.ts`

**Interfaces:**
- Consumes: `tiltFromGravity` (`capture/guidance.ts`).
- Produces:
  - `qcIssues(m, f: { width; height; target; exterior; tilt: { rollDeg: number; pitchDeg: number } | null })`.
  - Dış açıda `rollDeg > 20` ya da `pitchDeg > 20` ise `'tilted'` döner. 20, servisin `MAX_ROLL_DEG`'idir: ötesi düzeltilemez.

- [ ] **Adım 1: Başarısız testi yaz**

```ts
test('a strongly tilted exterior photo asks for a retake', () => {
  const m = metrics(checker(30, 220)); // sharp and well exposed: no other issue
  expect(qcIssues(m, photo({ tilt: { rollDeg: 2, pitchDeg: 33 } }))).toContain('tilted');
  expect(qcIssues(m, photo({ tilt: { rollDeg: 25, pitchDeg: 5 } }))).toContain('tilted');
  expect(qcIssues(m, photo({ tilt: { rollDeg: 13, pitchDeg: 16 } }))).not.toContain('tilted');
  expect(qcIssues(m, photo({ tilt: { rollDeg: 2, pitchDeg: 33 }, exterior: false }))).not.toContain('tilted');
  expect(qcIssues(m, photo({ tilt: null }))).not.toContain('tilted');
});
```

Dosyadaki `photo()` yardımcısı `tilt: null` varsayılanını alır.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/capture/quality.test.ts`
Expected: FAIL

- [ ] **Adım 3: Uygula**
  - `'tilted'`, `ReviewSheet`'te diğer sorunlar gibi `capture.qc.tilted` metniyle görünür.
  - Geniş mod seçiliyken (`cam.mode === 'wide'`), mod düğmelerinin altında `capture.wideHint` düz ipucu metni olarak görünür (`fontSize.small`, mevcut ipucu rengi). Rozet ya da animasyon yoktur.
  - Türkçe ve İngilizce karşılıklar Almanca metne sadık çevrilir.

- [ ] **Adım 4: Uygulama testlerinin tamamını çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS (i18n anahtar testi dahil)

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-capture-tilt-check-wide-hint`.

---

### Task 6: iOS döndürme kilidinde çekim ekranı (bulgu 2)

**Files:**
- Modify: `apps/mobile/src/app/(app)/vehicles/[id]/capture.tsx:52-61` (yalnız yeniden üretilirse)
- Ledger: `.superpowers/sdd/2026-11-17-m2d-phone-round-fixes/progress.md`

**Interfaces:** yok (davranış düzeltmesi).

- [ ] **Adım 1: Simülatörde yeniden üret**
  - Ön koşullar:
    - Yerel Supabase ve servis açık (`npm run db:start`; servis konteyneri README'deki komutla).
    - Metro 8082'de. Uygulama iPhone 11 simülatöründe (iOS 26) dev build.
  - Adımlar:
    - Kontrol Merkezi'nden "Yönlendirme Kilidi"ni aç.
    - Bir aracın çekim ekranını aç; simülatörü sola ve sağa döndür.
    - Her durumda `control screenshot` al.
  - Expected: Kilit açıkken arayüz kayık ya da önizleme yanlış yönde; kilit kapalıyken doğru.
  - Simülatörde kamera yoktur; arayüz ve yerleşim yine görülür.

- [ ] **Adım 2: Düzelt ya da ledger'a yaz**
  - Yeniden üretildiyse: iOS'ta `OrientationLock.LANDSCAPE` yerine tek yön (`LANDSCAPE_RIGHT`) dene. Kilit açık ve kapalıyken ekran görüntüsüyle doğrula; seçilen çözüm ledger'a `Ruling:` olarak yazılır.
  - Yeniden üretilemediyse: kod değişmez. Ledger'a "simülatörde yeniden üretilemedi" yazılır ve Task 11'de kullanıcıdan kilit açıkken ekran kaydı istenir.

- [ ] **Adım 3: Uygulama testlerini çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 4: Kullanıcıya devret** — önerilen mesaj: `upd-capture-ios-orientation-lock` (kod değiştiyse).

---

### Task 7: Düzenleyicilerde geri kaydırma ve sayfa üstü (bulgu 14, 15)

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx` (kök `GestureHandlerRootView`, Task 8 için gerekli)
- Modify: `apps/mobile/src/app/(app)/vehicles/[id]/plates.tsx` (`gestureEnabled: !editing`)
- Modify: `apps/mobile/src/app/(app)/vehicles/[id]/touch-up.tsx` (`gestureEnabled: false`)

**Interfaces:**
- Produces: Uygulamanın kökü `<GestureHandlerRootView style={{ flex: 1 }}>` ile sarılır.

- [ ] **Adım 1: Simülatörde yeniden üret**
  - Task 6'daki kurulumla yerel veritabanındaki işlenmiş Opel'i aç (telefon turundan kaldı).
  - Plaka düzenlemede ve rötuşta soldan sağa sürükle. Expected: sayfa geri gider.
  - İki ekranın da ekran görüntüsünü al ve sayfanın üstünün başlığın altında kalıp kalmadığına bak.

- [ ] **Adım 2: Uygula**
  - **Geri hareketi:**
    - Plaka ekranı yalnız köşe düzenlenirken geri kaydırmayı kapatır.
    - Rötuş ekranı her zaman kapatır. Başlıktaki geri düğmesi `usePreventRemove` koruması altında kalır.
  - **Sayfa üstü:** Adım 1 içeriğin başlık altında kaldığını gösterdiyse, plaka ekranının `ScrollView`'una `contentInsetAdjustmentBehavior="automatic"` verilir. Rötuş ekranının `View`'u `useHeaderHeight()` kadar üst boşluk alır. Görülen sebep ve seçilen çözüm ledger'a `Ruling:` olarak yazılır.

- [ ] **Adım 3: Simülatörde doğrula**
  - Aynı sürükleme artık sayfadan çıkarmaz.
  - Ekran görüntüsünde sayfanın üstü tam görünür.
  - Rötuşta değişiklik varken başlıktaki geri düğmesi hâlâ "Retusche verwerfen?" sorar.

- [ ] **Adım 4: Uygulama testlerini çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `upd-editors-back-gesture-insets`.

---

### Task 8: Plaka ve rötuşta iki parmakla yakınlaştırma (bulgu 16, 20)

**Files:**
- Create: `apps/mobile/src/studio/viewport.ts`
- Modify: `apps/mobile/src/studio/plateQuad.ts` (`plateView` bir `View` döner)
- Modify: `apps/mobile/src/studio/PlateEditor.tsx`, `apps/mobile/src/studio/TouchUpEditor.tsx` (PanResponder yerine RNGH v3)
- Test: `apps/mobile/src/studio/viewport.test.ts`

**Interfaces:**
- Consumes: Task 7'nin `GestureHandlerRootView`'u.
- Produces (`studio/viewport.ts`):
  - `type View = { x: number; y: number; scale: number }`: görünümün sol üstü (fotoğrafın 0–1'i) ve büyütme. Görünüm `1/scale` genişlik ve yüksekliğindedir.
  - `MAX_SCALE = 6`.
  - `clampView(v: View): View`: `scale` 1 ile `MAX_SCALE` arasında, `x` ve `y` 0 ile `1 − 1/scale` arasında.
  - `zoomAt(v: View, focal: Point, factor: number): View`: `focal` çerçevenin 0–1'i; altındaki fotoğraf noktası yerinde kalır; sonuç `clampView`'dan geçer.
  - `panBy(v: View, dx: number, dy: number): View`: `dx`, `dy` çerçevenin payı; sonuç `clampView`'dan geçer.
  - `frameToPhoto(v: View, p: Point): Point` ve `photoToFrame(v: View, p: Point): Point`.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('zoomAt keeps the photo point under the fingers in place', () => {
  const v = zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0.25, y: 0.5 }, 2);
  expect(frameToPhoto(v, { x: 0.25, y: 0.5 })).toEqual({ x: 0.25, y: 0.5 });
  expect(v.scale).toBe(2);
});

test('the view never shows past the photo or below 1x', () => {
  expect(zoomAt({ x: 0.3, y: 0.3, scale: 2 }, { x: 0.5, y: 0.5 }, 0.1)).toEqual({ x: 0, y: 0, scale: 1 });
  expect(panBy({ x: 0.4, y: 0, scale: 2 }, -0.5, 0)).toEqual({ x: 0.5, y: 0, scale: 2 });
  expect(zoomAt({ x: 0, y: 0, scale: 5 }, { x: 0, y: 0 }, 3).scale).toBe(MAX_SCALE);
});

test('frameToPhoto and photoToFrame undo each other', () => {
  const v = { x: 0.2, y: 0.1, scale: 3 };
  const p = { x: 0.3, y: 0.25 };
  const back = frameToPhoto(v, photoToFrame(v, p));
  expect(back.x).toBeCloseTo(p.x, 10);
  expect(back.y).toBeCloseTo(p.y, 10);
});
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/studio/viewport.test.ts`
Expected: FAIL (modül yok).

- [ ] **Adım 3: `viewport.ts`'i uygula, testleri geçir**

Run: `cd apps/mobile && npx jest src/studio`
Expected: PASS. `plateView` testleri de geçer; `plateView` artık `View` tipini döner.

- [ ] **Adım 4: Düzenleyicileri RNGH v3'e taşı**
  - **Hareketler:**
    - İki parmak: `usePinchGesture` ve iki parmaklı `usePanGesture` (`useSimultaneousGestures`) görünümü `zoomAt`/`panBy` ile değiştirir.
    - Tek parmak `usePanGesture` (en çok 1 parmak) köşe sürükler ya da fırça çizer.
    - Rötuşta `useTapGesture` parça seçer.
    - Bütün dokunma noktaları `frameToPhoto` ile fotoğraf koordinatına çevrilir.
    - API adları ve geri çağrıların JS'te çalışma ayarı kurulu paketten (`node_modules/react-native-gesture-handler/src/v3`) okunur.
  - **Görüntü:** Fotoğraf `photoToFrame` ile konumlanır.
    - `PlateEditor` açılışta `plateView`'la başlar (bugünkü gibi), sonra serbestçe yakınlaşır.
    - `TouchUpEditor` 1x'te başlar.
  - **Fırça:** Fırça boyutu ekrana göredir. Çıktıya giden yarıçap `BRUSHES[brush] / view.scale` olur; yakınlaşınca daha ince çizilir. Çizili izler `toOutputRadius` ve `photoToFrame` ile çizilir.
  - **Ölçek göstergesi:** Ekranda 1x'ten büyükken "Zoom zurücksetzen" düğmesi gerekmez; iki parmakla uzaklaşmak yeter (YAGNI).

- [ ] **Adım 5: Simülatörde doğrula**
  - Simülatörde iki parmak Option tuşuyla yapılır. Plaka köşesini 4x'te sürükle ve rötuşta 3x'te ince bir çizgi çek.
  - Ekran görüntüleri al: yakınlaşma, köşe ve çizgi, parmağın altında kalmalı.

- [ ] **Adım 6: Uygulama testlerinin tamamını çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 7: Kullanıcıya devret** — önerilen mesaj: `add-editor-pinch-zoom`.

---

### Task 9: "Teil entfernen" araca yapışık parçayı söylesin (bulgu 19)

**Files:**
- Create: `apps/mobile/src/studio/maskParts.ts`, `apps/mobile/src/studio/maskSnapshot.ts`
- Modify: `apps/mobile/src/app/(app)/vehicles/[id]/touch-up.tsx` (maske imzalı URL'den Skia görüntüsüne)
- Modify: `apps/mobile/src/studio/TouchUpEditor.tsx` (`mask` prop'u, karar ve uyarı)
- Modify: `apps/mobile/src/locales/{de,tr,en}.json` (`touchUp.removeJoined`)
- Test: `apps/mobile/src/studio/maskParts.test.ts`

**Interfaces:**
- Consumes: Task 8'in `TouchUpEditor`'ı; `toOriginalTap` (`studio/edits.ts`); `photo.mask_path` ('processed' kovası).
- Produces:
  - `type Parts = { labels: Int32Array; width: number; height: number; car: number }`
  - `labelParts(alpha: Uint8Array, width: number, height: number): Parts`:
    - eşik `>= 128`, 8 komşuluk;
    - 0 arka plandır;
    - `car` en büyük parçanın etiketidir; maske boşsa 0.
  - `judgeRemove(parts: Parts | null, p: Point): 'accept' | 'joined' | 'nothing'`:
    - `p` orijinalin 0–1'idir;
    - `parts` `null` ise `'accept'`;
    - arka plan `'nothing'`, ana parça `'joined'`, diğerleri `'accept'`.
  - `maskSnapshot(mask: SkImage, edits: MaskEdit[], width?: number): { alpha: Uint8Array; width: number; height: number }`:
    - maske varsayılan 512 px genişliğe ölçeklenip ekran dışı bir Skia yüzeyine çizilir;
    - silme izleri siyah, yuvarlak uçlu, `2 · radius · width` kalınlığında üstüne çizilir;
    - `readPixels`'in kırmızı kanalı döner.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
const grid = (rows: string[]) => {
  const height = rows.length;
  const width = rows[0].length;
  const alpha = new Uint8Array(width * height);
  rows.forEach((r, y) => [...r].forEach((c, x) => (alpha[y * width + x] = c === '#' ? 255 : 0)));
  return { alpha, width, height };
};
const at = (x: number, y: number, w: number, h: number) => ({ x: (x + 0.5) / w, y: (y + 0.5) / h });

test('judgeRemove tells a separate piece from the car and the background', () => {
  const g = grid(['######..##', '######..##', '######....']);
  const parts = labelParts(g.alpha, g.width, g.height);
  expect(judgeRemove(parts, at(9, 0, 10, 3))).toBe('accept');
  expect(judgeRemove(parts, at(1, 1, 10, 3))).toBe('joined');
  expect(judgeRemove(parts, at(7, 2, 10, 3))).toBe('nothing');
});

test('pixels touching at a corner are one part, as in the worker', () => {
  const g = grid(['##..', '##..', '..#.']);
  const parts = labelParts(g.alpha, g.width, g.height);
  expect(judgeRemove(parts, at(2, 2, 4, 3))).toBe('joined');
});

test('judgeRemove accepts every tap when the mask is not loaded', () => {
  expect(judgeRemove(null, { x: 0.5, y: 0.5 })).toBe('accept');
});
```

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/studio/maskParts.test.ts`
Expected: FAIL (modül yok).

- [ ] **Adım 3: `maskParts.ts`'i uygula, testleri geçir**

Etiketleme yığınla yapılan taşma doldurmadır (512×384 için yeterince hızlı); `ponytail:` yorumu, daha büyük maskede iki geçişli etiketlemeye geçileceğini yazar.

Run: `cd apps/mobile && npx jest src/studio/maskParts.test.ts`
Expected: PASS

- [ ] **Adım 4: Ekrana bağla**
  - **`touch-up.tsx`:**
    - `mask_path` için imzalı URL alır.
    - `Skia.Data.fromURI` ve `Skia.Image.MakeImageFromEncoded` ile `SkImage`'e çevirir.
    - `TouchUpEditor`'a `mask` (yoksa `null`) olarak verir. İndirme hatası sessizce `null` bırakır.
  - **`TouchUpEditor`:**
    - Maske ve silme izleri değiştikçe `maskSnapshot` → `labelParts` yeniden hesaplanır. Böylece kullanıcı parçayı silgiyle ayırınca dokunuş kabul edilir.
    - Kaldırma modunda dokunuş `toOriginalTap` noktasıyla `judgeRemove`'a gider:
      - `'accept'`: düzenlemeye eklenir (bugünkü gibi).
      - `'joined'`: eklenmez, `Notice` ile `touchUp.removeJoined` görünür; bir sonraki dokunuşta kalkar.
      - `'nothing'`: eklenmez, mesaj yok.

- [ ] **Adım 5: Simülatörde doğrula**
  - Opel'in sağ ön çaprazında (tur 1'in 4 boşa dokunuşu) tekerleğe yapışık çimene dokun: uyarı görünür.
  - Sol ön çaprazdaki ayrı komşu parçaya dokun: kabul edilir. "Fertig"ten sonra işlenmiş fotoğrafta komşu parça kalkar. Bu yeniden çizim Photoroom'u çağırmaz.

- [ ] **Adım 6: Uygulama testlerinin tamamını çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 7: Kullanıcıya devret** — önerilen mesaj: `add-touch-up-remove-feedback`.

---

### Task 10: Katalogda Chery ve katalog yenileme (bulgu 6)

Tur 1'de "Cherry" elle yazıldı, çünkü katalogda Chery yok. Kataloğa eklemek tek başına yetmez: uygulama kataloğu yalnız cihazda boşsa çeker (`sync.ts`, `catalogIsEmpty`). Böylece kurulu telefonlar yeni markayı hiç görmez.

**Files:**
- Create: `supabase/migrations/20261118000001_catalog_chery.sql`
- Modify: `supabase/tests/database/core.test.sql` (`plan(13)` → `plan(14)`, bir assertion)
- Modify: `apps/mobile/src/sync/sync.ts` (`syncOnce`/`syncAndCount`'a `refreshCatalog`)
- Modify: `apps/mobile/src/sync/SyncProvider.tsx` (uygulamanın ilk başarılı turunda `true`)
- Test: `apps/mobile/src/sync/sync.test.ts`

**Interfaces:**
- Produces:
  - `syncOnce(db, remote, galleryId, now, refreshCatalog = false)`. `true` ise katalog cihazda dolu olsa da yeniden çekilip `replaceCatalog` ile yazılır.
  - `syncAndCount(db, remote, galleryId, now, online, refreshCatalog = false)`.

- [ ] **Adım 1: Başarısız testleri yaz**

`core.test.sql`:

```sql
select ok(exists (select 1 from public.models mo join public.makes ma on ma.id = mo.make_id
                  where ma.name = 'Chery' and mo.name = 'Tiggo 7'), 'Chery is in the vehicle catalog');
```

`sync.test.ts` (dosyadaki `db`, `fake`, `T0` ile; `FakeRemote.fetchCatalog` Volkswagen döner):

```ts
test('the first sync of a run fetches the catalog again even when the device has one', async () => {
  await replaceCatalog(db, [{ id: 9, name: 'Opel' }], []);
  await syncOnce(db, fake, 'g1', () => T0);
  expect(await searchMakes(db, 'Volks')).toEqual([]); // a normal run leaves a filled catalog alone
  await syncOnce(db, fake, 'g1', () => T0, true);
  expect((await searchMakes(db, 'Volks')).map((m) => m.name)).toEqual(['Volkswagen']);
});
```

`replaceCatalog` ve `searchMakes`, `local/catalog.ts`'ten gelir.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `npm run db:test` ve `cd apps/mobile && npx jest src/sync/sync.test.ts`
Expected: FAIL

- [ ] **Adım 3: Uygula**
  - **Migration:** Katalog migration'ının kalıbıyla (`on conflict do nothing`), `('Chery', array['Tiggo 4', 'Tiggo 7', 'Tiggo 8'])`. Yerelde `npx supabase migration up` ile uygulanır.
  - **`SyncProvider`:** Bir `useRef(true)` tutar; ilk çevrimiçi tur `refreshCatalog: true` ile gider, başarıyla bitince bayrak `false` olur. Bayrak ref'e yalnız callback içinde yazılır.

- [ ] **Adım 4: Testlerin tamamını çalıştır**

Run: `npm run db:test && cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 5: Buluta gönderme sorusu**

Migration'ın buluta (`npx supabase db push --remote --yes`) gönderilmesi kullanıcıya sorulur; evet demezse yerelde kalır.

- [ ] **Adım 6: Kullanıcıya devret** — önerilen mesaj: `add-catalog-chery-refresh`.

---

### Task 11: Telefon turu 2 (kullanıcıyla)

Kurulum, tur 1'deki gibidir (bellekteki `phone-round` notu):
- Mac'in ağ adresine bakan, JS'i gömülü sürüm derlemeleri.
- `supabase/functions/.env` dosyasında `PUBLIC_API_URL` ağ adresine çevrilir.
- Android'in oluşturulmuş manifestine cleartext izni yazılır.
- Telefonlar kablosuz bağlanır.
- Dışarıda uçak modunda çekilir.
- İşlemeden önce Photoroom onayı alınır: araç başına yaklaşık 8 çağrı ve 1 kredi.

- [ ] **Adım 1: Derle ve kur**
  - Android APK ve iOS sürüm derlemesi alınır.
  - Telefonlara `adb install -r` ve `devicectl` ile kurulur; uygulama verisi korunur.

- [ ] **Adım 2: Kullanıcının kontrol listesi**
  1. **Galaxy:**
     - Fotoğraf 4:3 gelir (sunucuda 2880×2160).
     - Kalite kontrolünün en-boy oranı uyarısı (`capture.qc.aspect`) artık çıkmaz. Tur 1'de her karede çıkmış olmalı.
     - Siluet, aracın boyutuna yakın durur.
  2. **iPhone döndürme kilidi açıkken:** Çekim ekranı doğru görünür. Yeniden üretilemediyse ekran kaydı istenir (Task 6).
  3. **iPhone'da şablon çizgileri:** Ön, sağ ön çapraz ve sol yan açılarda, otomatik çekim hazır olmadan önizlemenin ekran görüntüsü alınır. Bu, şablon kararının kanıtıdır.
  4. **Yönlendirme:** Otomatik çekim tetiklenmiyorsa ekrandaki mesaj not edilir.
  5. **Karanlık bir yerde açık renkli plaka:** Bannerla kapanır, delik kalmaz.
  6. **Plakalar:** İç mekân karelerine banner basılmaz. Yan görünümde banner aracın dışına taşmaz.
  7. **Plaka düzenleme ve rötuş:**
     - İki parmakla yakınlaşma çalışır.
     - Sürükleme sayfadan çıkarmaz ve sayfanın üstü görünür.
     - Araca yapışık parçaya dokununca uyarı çıkar.
  8. **Stüdyo:** "Bearbeiten"den sonra ilerleme ekranda canlı değişir (bulgu 21).
  9. **Katalog:** Yeni araç eklerken Chery ve modelleri listede görünür.
  10. **Eğim işareti (showroom, 2026-11-26 planı):**
      - Kamerayı aşağı eğip çek: kaydedilen `capture.pitchSignedDeg` iPhone'da ve Galaxy'de pozitif mi?
      - Değilse `apps/mobile/src/capture/guidance.ts` içindeki `PITCH_SIGN` o platform için −1 yapılır.
      - Aynı araç bir showroom arka planında işlenir; zemin ve araç aynı eğimde mi, gözle kontrol edilir.

- [ ] **Adım 3: Bulguları yaz, sunucuları durdur**
  - Sonuçlar `.superpowers/sdd/2026-11-17-m2d-phone-round-fixes/phone-round-2.md` dosyasına yazılır.
  - `supabase/functions/.env` `127.0.0.1`'e döner.
  - Servis, Supabase, adb ve Docker durdurulur.
