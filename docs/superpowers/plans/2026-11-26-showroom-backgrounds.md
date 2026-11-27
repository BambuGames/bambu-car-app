# Showroom arka planları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Araçlar her arka planda tekerlekleriyle zemine bassın. Çekim açısıyla dönen iki showroom ve beyaz dengesi
gelsin.

**Architecture:**
- İşleme servisi (`services/image-worker`) dört şey kazanır:
  - showroom odasını şablon kamerasından çizen yeni bir modül (`showroom.py`);
  - alt çizgiyi izleyen gölge (`compose.contact_shadow`);
  - beyaz dengesi modülü (`whitebalance.py`);
  - `pipeline` içinde slot ve eğim başına oda seçimi.
- Şablon dışa aktarımı kamera mesafesini ve yönünü de taşır.
- Uygulama işaretli eğimi kaydeder ve showroom önizlemesini Skia ile çizer.
- Bir migration iki platform satırı ekler.

**Tech Stack:** Python 3.13, numpy, OpenCV, pytest (worker); Expo SDK 58, React Native, Skia, jest-expo (app);
Supabase SQL.

**Spec:** `docs/superpowers/specs/2026-11-26-showroom-backgrounds-design.md`. Atılacak örnek (yalnız referans,
ürün kodu değil): `scratchpad/showroom/spike.py`, `spike2.py`.

## Global Constraints

- **Şablon kamerası:**
  - 1,0 m yükseklik, 69° yatay görüş, çıktı 2560×1920.
  - Düz kamerada ufuk tam orta satırda.
  - Slot açıları `tools/templates/templates.py` `SLOTS` ile aynı: `front_left_45` 45, `front` 0,
    `front_right_45` 315, `right` 270, `rear_right_45` 225, `rear` 180, `rear_left_45` 135, `left` 90.
- **Showroom spec'leri:**
  - `Showroom Weiß`:
    `{"kind":"showroom","wall":"#F0F1F1","ceiling":"#F6F7F7","floor":"#44474B","grout":"#2B2D30","gloss":0.55}`
  - `Showroom Anthrazit`:
    `{"kind":"showroom","wall":"#474B50","ceiling":"#55595E","floor":"#2C2F32","grout":"#1E2022","gloss":0.45}`
- **Oda:**
  - x −7,5…8,5 m, y −6,5…7,0 m, tavan 4,2 m, karo 0,8 m, derz 6 mm.
  - Duvar gölgelendirme çarpanları: x=8,5 duvarı 1,00; x=−7,5 duvarı 0,97; y=7,0 duvarı 0,99; y=−6,5 duvarı 0,94.
- **Eğim:**
  - Yalnız showroom'larda kullanılır; stüdyolar düz kamerayla kalır.
  - Kaynak `capture.pitchSignedDeg`, aşağı bakınca pozitif. Yoksa 0.
  - ±20° ile kırpılır.
- **Beyaz dengesi** "Renk eşitleme" (`tone_enabled`) ile birlikte açılır ve kapanır. Kazançlar `tone_stats.wb`
  içinde durur.
- **Bütçe:**
  - Bir oda çizimi yerelde 1280×960'ta ≤ 0,5 sn.
  - Bir çizimin bellek tepe noktası ≤ 300 MB.
  - Araç başına soğuk başlangıçta ek süre ≈ 8 sn'yi geçmez.
- **Yeni bağımlılık yok.** numpy, OpenCV ve Skia zaten var.
- **Testlerde ve doğrulamada Photoroom ya da OpenAI çağrısı yok.** Maskeler `spikes/out/mask/photoroom`'dan gelir.
- **Commit ve push yok; commitleri kullanıcı atar.** Her görevin son adımı bir commit önerisidir: slug mesaj
  (`add-…`/`upd-…`) ve dosya listesi.
- **Yalnız yerel Supabase.** `supabase db reset` yok; migration `npx supabase migration up` ile uygulanır.
- **Bulut adımları bu planın dışında:** servis, uygulama ve migration dağıtımı. Sıra: servis → uygulama →
  migration, her biri kullanıcı onayıyla.
- **UI:** `/no-slop-ui` kuralları ve React Compiler kuralları geçerli.
- **Sırlar:** `.env` değerleri hiçbir zaman yazdırılmaz.

## Review Focus

Her biri sahibi olan görevin testleriyle bağlanmıştır.

1. **Büyük eğim:** Yerleştirilen araç kaydırmayla kareden taşmamalı; kayma kısılır (Task 4).
2. **Koyu zemin:** Showroom Anthrazit'te ve Studio Dunkel'de tekerlek teması görünür kalmalı; zemin en az 10
   seviye koyulaşır (Task 1).
3. **Detay ve iç mekân:** Showroom seçili araçta bu kareler bugünkü gibi odasız kalmalı (Task 4).
4. **Eski fotoğraflar:** `tone_stats` içinde `wb` yokken yeniden çizim çökmemeli; görüntü değişmemeli (Task 5).
5. **Önbellek:** Farklı spec, farklı oda vermeli; galeriler arası karışma olmamalı (Task 3).

---

### Task 1: Zemine basan gölge

**Files:**
- Modify: `services/image-worker/worker/compose.py` (`contact_shadow`)
- Test: `services/image-worker/tests/test_compose.py`

**Interfaces:**
- Produces: `contact_shadow(alpha_out: np.ndarray) -> np.ndarray`. İmza aynı kalır. 0–0,9 arası float32 döner,
  `alpha_out` ile aynı boyda. Pipeline aynı adla çağırmaya devam eder.

- [ ] **Step 1: Testleri yaz.** `test_shadow_only_below_the_car`'ı kaldır; yerine aşağıdakileri koy.
  `wheels(...)` yardımcısı, gövde dikdörtgeni ile gövdenin altına taşan daireler (tekerlekler) çizer.

```python
def wheels(*centres, r=110, body=(500, 1150, 2100, 1330)):
    """A car body box with round tyres below it: centres are (x, y_bottom_of_tyre)."""
    a = np.zeros((1920, 2560), np.uint8)
    x0, y0, x1, y1 = body
    a[y0:y1, x0:x1] = 255
    for cx, bottom in centres:
        cv2.circle(a, (cx, bottom - r), r, 255, -1)
    return a


def test_every_wheel_on_the_ground_line_gets_a_dark_contact():
    a = wheels((700, 1440), (1900, 1390))  # 45° view: the far wheel stands higher
    s = contact_shadow(a)
    assert s[1443, 700] > 0.5 and s[1393, 1900] > 0.5


def test_a_far_wheel_at_the_end_of_the_outline_gets_a_contact_too():
    a = wheels((700, 1440), (1500, 1430), (2080, 1380))
    assert contact_shadow(a)[1383, 2080] > 0.5


def test_the_floor_under_the_body_is_darker_than_the_open_floor():
    a = wheels((700, 1440), (1900, 1390))
    s = contact_shadow(a)
    assert 0.1 < s[1350, 1300] < s[1443, 700]  # under the sill, between the tyres
    assert s[1700, 1300] < 0.05  # far below the car


def test_no_shadow_above_the_outline_or_beside_the_car():
    a = wheels((700, 1440), (1900, 1390))
    s = contact_shadow(a)
    assert s[:1100].max() == 0  # above the body
    assert s[:, :300].max() < 0.02 and s[:, 2400:].max() < 0.02
    assert s.max() <= 0.9 + 1e-6


def test_shadow_shows_on_a_dark_floor():
    bg = render_background(DARK)
    a = wheels((700, 1440), (1900, 1390))
    car = np.full((1920, 2560, 3), 200, np.uint8)
    out = compose(bg, car, a, contact_shadow(a))
    assert int(bg[1446, 700].max()) - int(out[1446, 700].max()) >= 10
```

- [ ] **Step 2: Çalıştır, kırmızı gör.**
  `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_compose.py -q`
  Beklenen: yeni testler FAIL; örneğin uzak teker `s[1393, 1900]` ≈ 0.
- [ ] **Step 3: `contact_shadow`'u yeniden yaz.** Algoritma (atılacak örnekteki `ground_shadow`, değerler sabit):

```python
a = alpha_out >= 128
cols = np.where(a.any(axis=0))[0]            # empty → zeros
ybot[x] = last row of a in column x          # the lower outline
car_h, car_w = rows span, cols span
ground = lower convex hull of (x, ybot[x]) in image y (pop while cross >= 0), interpolated over all x
gap = clip(ground - ybot, 0); contact = exp(-gap / (0.015 * car_h)) inside the car's columns
c_band = exp(-clip(y - ground, 0) / (0.008 * car_h)) where y >= ybot - 2
s = 0.85 * c_band * contact
under = (ybot <= y <= ground + 0.01 * car_h) inside the columns
depth = clip((ground - y) / max(gap, 1), 0, 1)
s = max(s, (0.22 + 0.2 * depth) * under);  s = GaussianBlur(s, sigma = max(1, 0.007 * car_w))
pen = exp(-clip(y - ground, 0) / (0.035 * car_h)) where y >= ground - 0.02 * car_h, inside the columns
pen = GaussianBlur(pen, sigma = max(1, 0.025 * car_w))
return clip(max(s, 0.22 * pen), 0, 0.9)
```

  Başındaki docstring'i yeni davranışa göre yaz. Modül başındaki `SHADOW_MAX` sabitini kaldır; kullanan kalmıyor.
- [ ] **Step 4: Çalıştır, yeşil gör.** Aynı komutla bütün `test_compose.py` testleri ve servis takımı (`pytest
  services/image-worker -q`) PASS olmalı. `test_compose_returns_a_2560_by_1920_jpeg` değişmeden geçer.
- [ ] **Step 5: Commit önerisi.** `upd-worker-ground-shadow`:

```bash
git add services/image-worker/worker/compose.py services/image-worker/tests/test_compose.py
```

### Task 2: Şablon kamerası verisi

**Files:**
- Modify: `tools/templates/templates.py` (`_template` meta, `export_worker`)
- Modify: `tools/templates/test_templates.py`
- Regenerate: `tools/templates/out/*/*.json`, `services/image-worker/worker/templates.json`
- Modify: `services/image-worker/worker/templates.py`
- Test: `services/image-worker/tests/test_templates.py`

**Interfaces:**
- Produces:
  - `template_camera(body_type: str, slot: str) -> tuple[float, float] | None`: normal mod için
    `(distance_m, yaw_deg)`. `other` için dört tipin ortalaması; detay ve iç mekânda `None`.
  - `SLOT_AZIMUTH: dict[str, float]`, Global Constraints'teki değerlerle, `worker/templates.py` içinde.

- [ ] **Step 1: Araç tarafında testleri yaz.**
  - `test_export_worker_writes_boxes` artık
    `set(rows[0]) == {"bodyType", "slot", "mode", "box", "distanceM", "yawDeg"}` bekler.
  - Yeni test `test_meta_has_the_centering_yaw`: `make_template(V, F, "sedan", "front_left_45", "normal")`
    meta'sında `yawDeg`, `center_yaw(V, 45, meta["distanceM"])` değerine 0,001 içinde eşit.
- [ ] **Step 2: Kırmızı gör.**
  `cd tools/templates && .venv/bin/python -m pytest test_templates.py -q`
  Beklenen: iki test FAIL.
- [ ] **Step 3: Uygula.**
  - `_template` meta'sına `"yawDeg": round(yaw, 3)` ekle.
  - `export_worker` satırlarına `distanceM` ve `yawDeg` ekle.
- [ ] **Step 4: Yeşil gör.** Aynı komut PASS.
- [ ] **Step 5: Yeniden üret ve kutuların değişmediğini doğrula.**

  ```bash
  cd tools/templates && for b in sedan kombi suv hatchback; do .venv/bin/python templates.py $b; done && .venv/bin/python templates.py export-worker && .venv/bin/python templates.py export-app
  ```

  Ardından eski ve yeni `templates.json` karşılaştırılır:

  ```bash
  git diff --stat
  python3 -c "import json,subprocess; old=json.loads(subprocess.run(['git','show','HEAD:services/image-worker/worker/templates.json'],capture_output=True,text=True).stdout); new=json.load(open('services/image-worker/worker/templates.json')); assert [(r['bodyType'],r['slot'],r['mode'],r['box']) for r in old]==[(r['bodyType'],r['slot'],r['mode'],r['box']) for r in new]; print('boxes unchanged')"
  ```

  Beklenen:
  - `boxes unchanged`;
  - `apps/mobile/src/templates/templates.generated.ts`'de fark yok;
  - SVG ve overview farkı yok. Fark varsa durup ledger'a yaz.
- [ ] **Step 6: Servis testlerini yaz.**

```python
def test_template_camera_is_the_normal_mode_distance_and_yaw():
    row = next(r for r in ROWS if (r["bodyType"], r["slot"], r["mode"]) == ("suv", "front_left_45", "normal"))
    assert template_camera("suv", "front_left_45") == (row["distanceM"], row["yawDeg"])


def test_template_camera_for_other_is_the_mean():
    rows = [r for r in ROWS if r["slot"] == "rear" and r["mode"] == "normal"]
    d, y = template_camera("other", "rear")
    assert d == pytest.approx(sum(r["distanceM"] for r in rows) / 4)
    assert y == pytest.approx(sum(r["yawDeg"] for r in rows) / 4)


def test_template_camera_for_a_detail_is_none():
    assert template_camera("sedan", "detail_wheel") is None
```

- [ ] **Step 7: Kırmızı → uygula → yeşil.** `template_camera`'yı `template_box`'ın önbellekli `_boxes` deseniyle
  yaz. Komut: `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_templates.py -q`
- [ ] **Step 8: Commit önerisi.** `upd-templates-camera-pose`:

```bash
git add tools/templates/templates.py tools/templates/test_templates.py tools/templates/out services/image-worker/worker/templates.json services/image-worker/worker/templates.py services/image-worker/tests/test_templates.py
```

### Task 3: Showroom odası çizimi

**Files:**
- Create: `services/image-worker/worker/showroom.py`
- Test: `services/image-worker/tests/test_showroom.py`

**Interfaces:**
- Consumes: Task 2'den `template_camera` ve `SLOT_AZIMUTH`.
- Produces:
  - `trace(distance_m: float, azimuth_deg: float, yaw_deg: float, pitch_deg: float, size: tuple[int, int]) -> dict`
    - Anahtarlar `surface` (int8: 0 zemin, 1 duvar, 2 tavan), `x`, `y`, `z` (dünya metresi, float32).
    - Dünya ekseni şablonla aynı: araç merkezi orijinde, +x ön, +y sol, +z yukarı.
  - `render_showroom(spec: dict, distance_m: float, azimuth_deg: float, yaw_deg: float, pitch_deg: float = 0.0, size: tuple[int, int] = (1280, 960)) -> np.ndarray`:
    BGR uint8, deterministik.
  - `showroom_background(spec: dict, body_type: str, slot: str, pitch_deg: float = 0.0) -> np.ndarray`:
    - 2560×1920.
    - Yarım çözünürlükteki çizim `functools.lru_cache(maxsize=64)` ile tutulur. Anahtar
      `(json.dumps(spec, sort_keys=True), body_type, slot, round(pitch_deg))`.
    - Büyütme `cv2.INTER_LINEAR` ile.
  - `pitch_shift(box_bottom: float, pitch_deg: float, out_size: tuple[int, int] = OUT_SIZE) -> float`:
    - Şablon kutusunun alt kenarındaki (kesirli satır) zemin noktasının o eğimde kaç piksel kaydığını verir;
      negatif yukarı demek.
    - Formül: `f*tan(atan((yb-cy)/f) - p) - (yb-cy)`; burada `yb = box_bottom*H`, `cy = H/2`,
      `f = (W/2)/tan(34,5°)`.

- [ ] **Step 1: Testleri yaz.**

```python
WEISS = {"kind": "showroom", "wall": "#F0F1F1", "ceiling": "#F6F7F7", "floor": "#44474B", "grout": "#2B2D30", "gloss": 0.55}
ANTHRAZIT = {"kind": "showroom", "wall": "#474B50", "ceiling": "#55595E", "floor": "#2C2F32", "grout": "#1E2022", "gloss": 0.45}
SIZE = (1280, 960)


def test_level_camera_sees_no_floor_above_the_middle_row():
    s = trace(4.735, 45, 0.0, 0.0, SIZE)["surface"]
    assert not (s[: SIZE[1] // 2] == 0).any() and (s[-1] == 0).all()


def test_looking_down_raises_the_floor_above_the_middle_row():
    s = trace(4.735, 45, 0.0, 10.0, SIZE)["surface"]
    assert (s[SIZE[1] // 2 - 40] == 0).any()


def test_front_view_looks_along_the_car_axis():
    t = trace(4.587, 0, 0.0, 0.0, SIZE)
    centre = SIZE[0] // 2
    floor_rows = t["surface"][:, centre] == 0
    assert np.abs(t["y"][floor_rows, centre]).max() < 0.01  # the centre column runs along y = 0


def test_side_view_looks_across_the_car():
    t = trace(4.587, 90, 0.0, 0.0, SIZE)
    centre = SIZE[0] // 2
    floor_rows = t["surface"][:, centre] == 0
    assert np.abs(t["x"][floor_rows, centre]).max() < 0.01


def test_render_is_deterministic_and_spec_dependent():
    a = render_showroom(WEISS, 4.735, 45, 0.0)
    assert a.shape == (960, 1280, 3) and np.array_equal(a, render_showroom(WEISS, 4.735, 45, 0.0))
    assert np.abs(a.astype(int) - render_showroom(ANTHRAZIT, 4.735, 45, 0.0).astype(int)).mean() > 40


def test_showroom_background_is_full_size_and_keyed_by_spec():
    a = showroom_background(WEISS, "suv", "front")
    assert a.shape == (1920, 2560, 3) and np.array_equal(a, showroom_background(WEISS, "suv", "front"))
    assert not np.array_equal(a, showroom_background(ANTHRAZIT, "suv", "front"))


def test_pitch_shift_moves_the_contact_up_when_looking_down():
    assert pitch_shift(0.82, 0.0) == 0
    assert pitch_shift(0.82, 8.0) < -200
```

- [ ] **Step 2: Kırmızı gör.**
  `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_showroom.py -q`
  Beklenen: `ModuleNotFoundError: worker.showroom`.
- [ ] **Step 3: Uygula.**
  - **Kamera:**
    - Konum `(d·cos a, d·sin a, 1,0)`.
    - Taban vektörleri `tools/templates/templates.py` `_to_camera` ile aynı: ileri, sağ ve yaw dönüşü.
    - Eğim `p` (aşağı pozitif) sağ eksen etrafında döndürür: `ileri' = cos p·ileri + sin p·aşağı`,
      `aşağı' = cos p·aşağı − sin p·ileri`.
    - Odak `f = (w/2)/tan(34,5°)`, çizim boyutunda.
  - **İz:** Kutu odada ışın başına x, y ve z düzlemlerinden en yakın pozitif `t`.
    - z<0 yönünde zemin, z>0 yönünde tavan.
    - Atılacak örnekteki `room_view` ile aynı mantık.
  - **Gölgelendirme:** Değerler atılacak örnekteki `spike2.room_view`.
    - **Duvar:** `spec.wall` × duvar çarpanı × `(1 − 0,22·e^(−z/0,35))` × `(1 − 0,10·e^(−köşe mesafesi/0,5))` ×
      `(0,94 + 0,06·z/4,2)`.
    - **Tavan:** `spec.ceiling` × 0,985.
    - **Zemin karoları:**
      - Karolar dünya x/y'sine hizalı, 0,8 m.
      - Derz yumuşatması için türev yarım çözünürlükte komşu piksel farkı.
      - Karo başına ±%2,5 ton farkı, sabit tohumla.
    - **Zemin ışığı:**
      - Fresnel `0,04 + 0,96·(1−cosθ)^5`.
      - Ayna: aynı ışın z'si ters, çarptığı duvar rengi. Bulanıklık σ, çizim boyutunun 2560 pikseline oranla 9 px.
      - Karışım `spec.gloss` ile.
      - Duvar dibi AO `1 − 0,35·e^(−d/0,35)`.
    - **Son:** Vinyet `1 − 0,10·r²`, gren σ 1,1, sabit tohumlu `np.random.default_rng`.
  - Hepsi float32.
- [ ] **Step 4: Yeşil gör.** Aynı komut PASS.
- [ ] **Step 5: Bütçeyi ölç.** Bir betik `render_showroom`'u 8 slot için çalıştırıp süreyi ve `tracemalloc`
  tepe noktasını yazdırır.
  Beklenen: ortalama ≤ 0,5 sn ve tepe ≤ 300 MB. Aşılırsa önce float32'yi ve ara dizileri azaltmayı dene;
  sonucu ledger'a yaz.
- [ ] **Step 6: Commit önerisi.** `add-worker-showroom-render`:

```bash
git add services/image-worker/worker/showroom.py services/image-worker/tests/test_showroom.py
```

### Task 4: Pipeline'da showroom ve eğim

**Files:**
- Modify: `services/image-worker/worker/pipeline.py` (`_context`, `_render`, `run`)
- Test: `services/image-worker/tests/test_pipeline.py`

**Interfaces:**
- Consumes:
  - Task 3: `showroom_background`, `pitch_shift`;
  - Task 2: `template_camera`, `template_box`.
- Produces:
  - `ctx["showroom"]`: showroom ise spec, değilse `None`.
  - `ctx["background"]`: showroom'da `None`.

- [ ] **Step 1: Testleri yaz.** Mevcut `setup(...)` yardımcısına iki parametre ekle: `background: dict = STUDIO`
  ve `body: str = "sedan"`. Fotoğraf sözlüğüne de bir `pitch` anahtarı ekle; `capture["pitchSignedDeg"]` olur.

```python
SHOWROOM = {"kind": "showroom", "wall": "#F0F1F1", "ceiling": "#F6F7F7", "floor": "#44474B", "grout": "#2B2D30", "gloss": 0.55}


def test_a_showroom_gives_each_slot_its_own_room():
    store, pr, det = setup([{"id": "p1", "slot": "front", "index": 1}, {"id": "p2", "slot": "left", "index": 2}],
                           background=SHOWROOM)
    go(store, pr, det, ["p1", "p2"])
    for pid, slot in (("p1", "front"), ("p2", "left")):
        out = decode(store, store.photo_rows[pid]["output_path"])
        room = showroom_background(SHOWROOM, "sedan", slot)
        assert np.abs(out[40:200, 40:200].astype(int) - room[40:200, 40:200].astype(int)).mean() < 4


def test_a_tilted_photo_moves_the_car_with_the_floor():
    flat, tilted = (setup([{"id": "p1", "slot": "front_left_45", "index": 1, "pitch": p}], background=SHOWROOM)
                    for p in (0.0, 8.0))
    for s in (flat, tilted):
        go(s[0], s[1], s[2], ["p1"])
    dy = tilted[0].photo_rows["p1"]["placement"]["m"][1][2] - flat[0].photo_rows["p1"]["placement"]["m"][1][2]
    assert dy == pytest.approx(pitch_shift(template_box("sedan", "front_left_45")[3], 8.0), abs=1.0)


def test_a_large_tilt_keeps_the_car_in_the_frame():
    # suv front_left_45: box top 0.35 H; at 20° the unclamped shift (≈ −671 px) would push the roof out
    store, pr, det = setup([{"id": "p1", "slot": "front_left_45", "index": 1, "pitch": 20.0}],
                           background=SHOWROOM, body="suv")
    go(store, pr, det, ["p1"])
    _, top = to_output(store.photo_rows["p1"], CAR[0], CAR[1])
    assert top >= 0.02 * 1920 - 1


def test_an_unsigned_pitch_and_the_studio_stay_level():
    ty = {}
    for name, extra, bg in (("studio_flat", {}, STUDIO), ("studio_tilted", {"pitch": 8.0}, STUDIO),
                            ("showroom_unsigned", {}, SHOWROOM)):  # no pitchSignedDeg: an older capture
        s = setup([{"id": "p1", "slot": "front_left_45", "index": 1, **extra}], background=bg)
        go(*s, ["p1"])
        ty[name] = s[0].photo_rows["p1"]["placement"]["m"][1][2]
    assert ty["studio_tilted"] == pytest.approx(ty["studio_flat"], abs=0.5)
    assert ty["showroom_unsigned"] == pytest.approx(ty["studio_flat"], abs=0.5)


def test_details_ignore_the_showroom():
    store, pr, det = setup([{"id": "p1", "slot": "front", "index": 1}, {"id": "d1", "slot": "detail_wheel", "index": 2}],
                           background=SHOWROOM)
    go(store, pr, det, ["p1", "d1"])
    assert store.photo_rows["d1"]["process_status"] == "done"
    out = decode(store, store.photo_rows["d1"]["output_path"])
    room = showroom_background(SHOWROOM, "sedan", "front")
    assert np.abs(out[40:200, 40:200].astype(int) - room[40:200, 40:200].astype(int)).mean() > 20  # the photo, not a room
```
- [ ] **Step 2: Kırmızı gör.**
  `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_pipeline.py -q`
  Beklenen: yeni testler FAIL.
- [ ] **Step 3: Uygula.**
  - **`_context`:**
    - `spec.kind == "showroom"` ise `background=None`, `showroom=spec`.
    - Değilse bugünkü gibi `render_background`, `showroom=None`.
  - **`_render` (dış kareler):**
    - `background = ctx["background"]`; showroom'da `showroom_background(spec, vehicle["body_type"], slot,
      pitch)`.
    - `pitch = clip(capture.get("pitchSignedDeg") or 0, −20, 20)`; yalnız showroom'da.
    - Yerleşim matrisinden sonra `m[1, 2] += dy`. `dy = pitch_shift(box[3], pitch)`, yerleştirilen araç kutusunun
      üstü ≥ 0,02·H ve altı ≤ 0,98·H kalacak şekilde kırpılır.
    - Gölge, plaka ve banner aynı `m` ile.
  - **`run`:** Analiz havuzuna, sahiplenilen dış fotoğrafların benzersiz
    `(spec, body_type, slot, round(pitch))` anahtarları için `showroom_background` ısıtma işleri analizle birlikte
    gönderilir.
- [ ] **Step 4: Yeşil gör.** Komut aynı; bütün servis takımı (`pytest services/image-worker -q`) PASS.
- [ ] **Step 5: Commit önerisi.** `upd-worker-showroom-pipeline`:

```bash
git add services/image-worker/worker/pipeline.py services/image-worker/tests/test_pipeline.py
```

### Task 5: Beyaz dengesi

**Files:**
- Create: `services/image-worker/worker/whitebalance.py`
- Modify: `services/image-worker/worker/pipeline.py` (`_analyze`, `_context`, `_render`)
- Test: `services/image-worker/tests/test_whitebalance.py`, `services/image-worker/tests/test_pipeline.py`

**Interfaces:**
- Produces:
  - `estimate_gains(image: np.ndarray, alpha: np.ndarray) -> list[float] | None`: BGR sırasında, aydınlığı koruyan
    kazançlar (`0,114·b + 0,587·g + 0,299·r = 1`).
  - `apply_gains(image: np.ndarray, gains: list[float] | None) -> np.ndarray`: `None` ise aynı görüntü.
  - `tone_stats` artık `{"L", "a", "b", "wb": list | None}` taşır.

- [ ] **Step 1: Testleri yaz.**

```python
def scene(bg_bgr, car_bgr=(128, 128, 128)):
    img = np.zeros((600, 800, 3), np.uint8); img[:] = bg_bgr
    alpha = np.zeros((600, 800), np.uint8); alpha[200:450, 200:600] = 255
    img[alpha > 0] = car_bgr
    return img, alpha


def test_a_yellow_garage_is_pulled_toward_neutral():
    img, alpha = scene((80, 118, 157))                     # warm grey walls (BGR)
    g = estimate_gains(img, alpha)
    assert g is not None and g[0] > 1.05 and g[2] < 0.97
    out = apply_gains(img, g)[50, 50].astype(int)
    assert out.max() - out.min() < 0.5 * (157 - 80)


def test_a_neutral_scene_is_left_alone():
    assert estimate_gains(*scene((120, 121, 119))) is None


def test_a_saturated_wall_does_not_tint_the_car():
    img, alpha = scene((40, 40, 200), car_bgr=(235, 235, 235))   # red brick behind a white car
    img[480:] = (110, 110, 110)                                  # a grey pavement strip
    assert estimate_gains(img, alpha) is None


def test_too_little_neutral_surround_gives_no_gains():
    img, alpha = scene((30, 200, 30))                            # all saturated green
    assert estimate_gains(img, alpha) is None
```

  Ek olarak `test_pipeline.py`'ye iki test:
  - `test_tone_off_also_skips_white_balance`: sarı arka planlı orijinal (`original(...)`'a `tint` parametresi
    eklenir), `tone=False` ile aracın rengi girdiden en fazla 6 seviye farklı.
  - `test_old_tone_stats_without_wb_render_unchanged`: `tone_stats` elle `{"L":…, "a":…, "b":…}` (wb yok) olan
    fotoğraf yeniden çizilir. Çökmez; çıktı, `wb` alanı `None` olan aynı satırın çıktısıyla aynı.
- [ ] **Step 2: Kırmızı gör.**
  `services/image-worker/.venv/bin/python -m pytest services/image-worker/tests/test_whitebalance.py services/image-worker/tests/test_pipeline.py -q`
- [ ] **Step 3: `estimate_gains` uygula.** Değerler sabit, Task 7'deki M0 kontrolüne göre ayarlanabilir; ayar
  ledger'a yazılır.
  - **Aday pikseller:**
    - Araç maskesi 15 px genişletildiğinde dışarıda kalanlar.
    - HSV doymuşluğu < 0,6 (0–1).
    - Parlaklık (V) 30–240.
  - **Yeterlilik:** Aday oranı < %10 ise `None`.
  - **Işık tahmini:** Kanal başına %10–90 aralığında kırpılmış ortalama.
  - **Kazanç:** `gri = üç ortalamanın ortalaması`, `g_c = gri / ortalama_c`.
    - `max|g_c − 1| < 0,06` ise `None`.
    - Değilse `g_c = 1 + 0,75·(g_c − 1)`, [0,75, 1,33] aralığına kırpılır, aydınlığı koruyacak şekilde
      normalleştirilir.
- [ ] **Step 4: Pipeline'a bağla.**
  - **`_analyze` (dış kareler):** Maskeden sonra `wb = estimate_gains(image, alpha)`.
    `tone_stats = {**tone.measure(apply_gains(image, wb), alpha), "wb": wb}`.
    Photoroom'a giden görüntü değişmez.
  - **`_context`:**
    - Ton açıksa `detail_wb` = dış karelerin `wb` kazançlarının ortalaması (eksik olan 1,0 sayılır).
    - Ton kapalıysa beyaz dengesi yok.
  - **`_render`:**
    - Ton açıksa dış karede `image = apply_gains(image, tone_stats.get("wb"))` yerleştirmeden önce uygulanır.
    - Detayda `detail_wb` ton düzeltmesinden önce uygulanır.
    - Ton kapalıysa hiçbiri uygulanmaz.
- [ ] **Step 5: Yeşil gör.** Aynı komut ve bütün servis takımı PASS.
- [ ] **Step 6: Commit önerisi.** `add-worker-white-balance`:

```bash
git add services/image-worker/worker/whitebalance.py services/image-worker/worker/pipeline.py services/image-worker/tests/test_whitebalance.py services/image-worker/tests/test_pipeline.py
```

### Task 6: Uygulama — işaretli eğim, showroom önizlemesi, açıklama metni

**Files:**
- Modify: `apps/mobile/src/capture/guidance.ts`, `apps/mobile/src/capture/guidance.test.ts`
- Modify: `apps/mobile/src/domain/capture.ts` (`CaptureInfo`), `apps/mobile/src/capture/useGuidedCamera.ts`
- Modify: `apps/mobile/src/studio/api.ts` (`BackgroundSpec`)
- Create: `apps/mobile/src/studio/swatch.ts`, `apps/mobile/src/studio/swatch.test.ts`
- Modify: `apps/mobile/src/studio/BackgroundSwatch.tsx`
- Modify: `apps/mobile/src/locales/{de,en,tr}.json` (`toneHint`)

**Interfaces:**
- Produces:
  - `signedPitchDeg(g: { x: number; y: number; z: number }, platform: 'ios' | 'android'): number`: kamera aşağı
    bakarken pozitif.
    - `PITCH_SIGN: Record<'ios' | 'android', 1 | -1>` başlangıçta ikisi de `1`. W3C'ye göre ekran yukarı bakınca z
      pozitiftir.
    - Gerçek cihaz doğrulaması telefon turu 2'de.
  - `CaptureInfo.pitchSignedDeg: number`.
  - `BackgroundSpec` birleşimine
    `{ kind: 'showroom'; wall: string; ceiling: string; floor: string; grout: string; gloss: number }` eklenir.
  - `showroomSwatch(spec, w, h): { polygons: { fill: string; points: [number, number][] }[]; lines: { color: string; from: [number, number]; to: [number, number] }[] }`.

- [ ] **Step 1: Testleri yaz.**

```ts
test('signedPitchDeg is positive looking down and zero level', () => {
  const rad = (d: number) => (d * Math.PI) / 180;
  expect(signedPitchDeg({ x: -9.81, y: 0, z: 0 }, 'ios')).toBeCloseTo(0);
  const down = { x: -9.81 * Math.cos(rad(10)), y: 0, z: 9.81 * Math.sin(rad(10)) };
  expect(signedPitchDeg(down, 'ios')).toBeCloseTo(10 * PITCH_SIGN.ios);
  expect(signedPitchDeg(down, 'android')).toBeCloseTo(10 * PITCH_SIGN.android);
});
```

```ts
const SPEC = { kind: 'showroom', wall: '#F0F1F1', ceiling: '#F6F7F7', floor: '#44474B', grout: '#2B2D30', gloss: 0.55 } as const;

test('the showroom swatch fills the frame with ceiling, two walls and the floor', () => {
  const { polygons, lines } = showroomSwatch(SPEC, 96, 72);
  const area = (p: [number, number][]) => Math.abs(p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
  expect(polygons.map((p) => area(p.points)).reduce((a, b) => a + b, 0)).toBeCloseTo(96 * 72, 0);
  expect(polygons.some((p) => p.fill === SPEC.floor)).toBe(true);
  expect(lines.length).toBeGreaterThanOrEqual(3);
  expect(lines.every((l) => l.color === SPEC.grout)).toBe(true);
  expect(polygons.flatMap((p) => p.points).every(([x, y]) => x >= 0 && x <= 96 && y >= 0 && y <= 72)).toBe(true);
});
```

- [ ] **Step 2: Kırmızı gör.**
  `cd apps/mobile && npx jest src/capture/guidance.test.ts src/studio/swatch.test.ts`
- [ ] **Step 3: Uygula.**
  - **Eğim:**
    - `signedPitchDeg = PITCH_SIGN[platform] · atan2(g.z, hypot(g.x, g.y))` derece.
    - `useGuidedCamera`'daki `CaptureInfo`'ya `pitchSignedDeg` eklenir. Platform mevcut
      `Platform.OS === 'ios'` ifadesiyle verilir.
    - `CaptureInfo` yorumu: `> 0 looking down (signedPitchDeg); verified per platform in phone round 2`.
  - **`swatch.ts` geometrisi:** Dört poligon, çerçeveyi boşluksuz ve üst üste binmeden kaplar.
    - Köşe x=0,58w'de.
    - Tavan: `(0,0)–(w,0)–(w,0.10h)–(0.58w,0.28h)–(0,0.12h)`.
    - Sol duvar: `(0,0.12h)–(0.58w,0.28h)–(0.58w,0.62h)–(0,0.72h)`.
    - Sağ duvar: `(0.58w,0.28h)–(w,0.10h)–(w,0.74h)–(0.58w,0.62h)`.
    - Zemin: `(0,0.72h)–(0.58w,0.62h)–(w,0.74h)–(w,h)–(0,h)`.
    - Duvar renkleri `wall`'ın ×0,97 ve ×0,94 koyulaştırılmışı.
    - Köşeden ve duvar diplerinden zemine 3 derz çizgisi.
  - **`BackgroundSwatch`:** `spec.kind === 'showroom'` ise `Canvas` içinde her poligonu `Path` (fill) ve her
    çizgiyi `Line` (strokeWidth 1) olarak çizer. Diğer türler bugünkü gibi.
  - **`toneHint`:**
    - de: `Gleicht Helligkeit und Farbe der Fotos aneinander und an neutrales Licht an.`
    - en: `Brings the brightness and colour of the photos closer together and to neutral light.`
    - tr: `Fotoğrafların parlaklığını ve rengini birbirine ve nötr ışığa yaklaştırır.`
- [ ] **Step 4: Yeşil gör.** Aynı komut, ardından bütün takım ve tipler:
  `cd apps/mobile && npx jest && npx tsc --noEmit`. Beklenen: PASS, tip hatası yok.
- [ ] **Step 5: Commit önerisi.** `add-app-showroom-swatch-pitch`:

```bash
git add apps/mobile/src/capture/guidance.ts apps/mobile/src/capture/guidance.test.ts apps/mobile/src/domain/capture.ts apps/mobile/src/capture/useGuidedCamera.ts apps/mobile/src/studio/api.ts apps/mobile/src/studio/swatch.ts apps/mobile/src/studio/swatch.test.ts apps/mobile/src/studio/BackgroundSwatch.tsx apps/mobile/src/locales/de.json apps/mobile/src/locales/en.json apps/mobile/src/locales/tr.json
```

### Task 7: Migration, entegrasyon testi, gözle kontrol

**Files:**
- Create: `supabase/migrations/20261126000001_showroom_backgrounds.sql`
- Modify: `apps/mobile/src/studio/api.int.test.ts:49`
- Modify: `docs/superpowers/plans/2026-11-17-m2d-phone-round-fixes.md` (Task 11 kontrol listesi)

**Interfaces:**
- Consumes: Global Constraints'teki iki spec.
- Produces: platform satırları `b0000000-0000-0000-0000-000000000004` (`Showroom Weiß`, `sort_order` 4) ve
  `…0005` (`Showroom Anthrazit`, 5).

- [ ] **Step 1: Entegrasyon testini güncelle.** Satır 49 şunu bekler: `['Studio Weiß', 'Studio Hellgrau',
  'Studio Dunkel', 'Showroom Weiß', 'Showroom Anthrazit']`.
- [ ] **Step 2: Kırmızı gör.** Yerel Supabase çalışırken:
  `cd apps/mobile && npx jest -c jest.int.config.js src/studio/api.int.test.ts`
  Beklenen: FAIL, üç ad var.
- [ ] **Step 3: Migration'ı yaz ve uygula.** `insert into public.backgrounds (id, name, spec, sort_order) values …`
  iki satırla. Komut: `npx supabase migration up`. `db reset` yok.
- [ ] **Step 4: Yeşil gör.** Aynı komut PASS.
- [ ] **Step 5: Gözle kontrol, Photoroom çağrısı yok.** Atılacak örnekteki `render_more`/`spike2` desenindeki
  bellek içi depo ve M0 maskeleriyle ürün kodundan çıktı alınır:
  - M0'dan 8–10 araç; iki showroom ve üç stüdyo.
  - Crossland'ın dört açısı aynı odada.
  - Porsche ve Egea'da beyaz dengesi önce ve sonra.
  - Sonuç: dörtlü bir karşılaştırma sayfası.
  - Kontrol:
    - Tekerlekler basıyor; uzak tekerler uçtaysa temaslı.
    - Derzler büyütmede okunur.
    - Gün ışığındaki fotoğraflarda kazanç `None` ya da ±%3.
    - Araç başına süre ölçülür.
- [ ] **Step 6: Telefon turu 2 listesine ekle.** M2d planının Task 11 listesine:
  "Kamerayı aşağı eğip çek: kaydedilen `pitchSignedDeg` iPhone'da ve Galaxy'de pozitif mi? Değilse o platformun
  `PITCH_SIGN` değeri −1 yapılır."
- [ ] **Step 7: Bütün takımlar.**
  - Servis: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
  - Şablonlar: `cd tools/templates && .venv/bin/python -m pytest test_templates.py -q`
  - Uygulama: `cd apps/mobile && npx jest && npx tsc --noEmit`
  - Hepsi PASS.
- [ ] **Step 8: Commit önerisi.** `add-showroom-backgrounds-migration`:

```bash
git add supabase/migrations/20261126000001_showroom_backgrounds.sql apps/mobile/src/studio/api.int.test.ts docs/superpowers/plans/2026-11-17-m2d-phone-round-fixes.md
```
