# M2a İşleme Hattı Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yüklenmiş fotoğrafları olan bir araç tek çağrıyla işlenebilsin:
- Kredi bir kez düşer.
- Sunucudaki Python servisi plakaları bulup kapatır ve Photoroom'dan maske alır.
- Servis aracı düzeltip şablon konumuna yerleştirir; stüdyo arka planı, gölge, ton, plaka banner'ı ve filigranla iki çıktı üretir.
- Her fotoğrafın durumu kendi satırında canlı izlenir.

Uygulama ekranları (M2b) ve buluta kurulum (M2c) bu planda yok; hat yerelde uçtan uca çalışır.

**Architecture:**
- **Veritabanı:** Supabase'e kredi defteri, işleme kolonları ve `start_processing` fonksiyonu eklenir. Fonksiyon krediyi tek bir veritabanı işleminde düşer ve fotoğrafları kuyruğa alır.
- **`process-vehicle` Edge Function:** Bu fonksiyonu kullanıcının yetkisiyle çağırır, işi Python servisine (FastAPI, OpenCV, Pillow, onnxruntime) devreder ve hemen döner.
- **Analiz aşaması:** Servis her fotoğrafta EXIF yönünü düzeltir, plakaları bulur ve kapatır, Photoroom maskesini alır, hedef aracı ayırır, plaka köşelerini ve ton ölçümünü çıkarır. Sonuç saklanır.
- **Çizim aşaması:** Saklı maskeye rötuş silmeleri uygulanır. Sonra ufuk düzeltilir, araç yerleştirilir; arka plan, gölge, ton, banner ve filigran eklenir.
- **Yeniden çizim:** Arka plan, filigran, plaka köşesi veya rötuş değişince yalnız çizim tekrarlanır; Photoroom'a yeniden gidilmez.

**Tech Stack:**
- Supabase: Postgres, pgTAP, Edge Functions (Deno), Storage, Realtime.
- Python 3.13: FastAPI, uvicorn, opencv-python-headless, Pillow, NumPy, onnxruntime, httpx. Testler pytest ile.
- Docker (`python:3.13-slim`).
- Dış servis ve model: Photoroom Remove Background API, RT-DETRv2 plaka modeli (ONNX).
- Entegrasyon testleri: Node 26 `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (özellikle 7.1–7.5, 9, 11.2–11.4, 12, 13) · M0 kararları: `docs/m0-findings.md` (Maske kalitesi, Plaka köşeleri) · Önceki planlar: `docs/superpowers/plans/2026-11-09-m1a-foundation.md`, `docs/superpowers/plans/2026-11-12-m1b-guided-capture.md`

**Plan sırası ve sapmalar:**
- **M2'nin bölünmesi:** M2 üç plana bölündü (kullanıcı kararı, 12 Kasım 2026).
  - M2a: işleme hattı (bu plan).
  - M2b: uygulama ekranları. Stüdyo ve arka plan seçimi, ilerleme, önce/sonra, plaka hızlı kontrolü ve köşe sürükleme, rötuş, kredi görünümü, galeri ayarları ve personel yönetimi.
  - M2c: dışa aktarma, Cloud Run Frankfurt kurulumu, Sentry, hukuki metinler, TestFlight ve Google Play kapalı test.
- **Tasarıma eklenenler:** M0 kararlarıyla tasarımın 7.2 ve 7.4 bölümlerine iki şey eklenir; metni Task 8 günceller.
  - Rötuş adımı: personel kalan parçayı siler. Silmeler saklanır ve her çizimde yeniden uygulanır.
  - Her plaka yerleşimi hızlı kontrolden geçer; güvene göre ayırma yapılmaz.
- **Hedef aracın ayrılması:** "Maske hedef aracın kutusuyla sınırlanır" kuralı, M0 bulgusu yüzünden kırpma olarak uygulanmaz. Kutuya değen bağlı parçalar tutulur, diğerleri atılır. Kutu yoksa merkezdeki en büyük parça tutulur.
- **Plakaların kapatılması:** Photoroom'a gitmeden önce bulunan bütün plakalar kapatılır. Maske henüz yokken hangi plakanın hedef araca ait olduğu bilinemez. Banner için hedef aracın plakası maske geldikten sonra seçilir.
- **Yerleşim kutusu:** Araç, çekim modu ne olursa olsun normal modun şablon kutusuna yerleştirilir; dar alan fotoğrafları da setle aynı görünür. Arka planlar normal kameranın (1 m, 69°) görüntüsü varsayılır.
- **Arka plan kütüphanesi:** Kodla çizilen 3 kesintisiz stüdyoyla başlar: beyaz, açık gri, koyu (kullanıcı kararı). Görsel arka planlar (showroom) için `kind: 'image'` desteği vardır; içerik sonra eklenir.
- **İş kaydı:** İş kaydı ayrı bir tablo değil, fotoğraf satırındaki durum kolonlarıdır. 10 dakikadan uzun `queued` ya da `processing` kalan fotoğraf yeniden kuyruğa alınabilir; çökme ve zaman aşımı böyle toparlanır.
- **Fotoğraf sınırı:** Araç başına ayrı bir sınır (tasarımda örneğin 40) konmuyor. Her çekim adımında tek fotoğraf olduğu için bir araçta en çok 24 fotoğraf olabilir.
- **Detay ve iç mekân tonu:** Bu fotoğraflara, setin dış fotoğraflarından hesaplanan ortalama ton düzeltmesi uygulanır. Işıkları farklı olduğu için kendi ölçümleri hedef alınmaz.
- **Araç durumu:** Uygulama araç satırını gönderirken durum alanını da yazıyor (M1a). Sunucunun koyduğu `processing` ve `ready` durumları, `draft` ya da `shooting` ile ezilemez (Task 2).

## Global Constraints

**İşleme kuralları**
- Aracın pikselleri yeniden üretilmez. Araç yalnız arka plandan ayrılır, ufka göre döndürülür, ölçeklenir, konumlanır ve sınırlı güçte ton düzeltmesi alır. Görüntü üreten AI kullanılmaz. Orijinal her zaman saklanır.
- **Photoroom Remove Background:** `POST https://sdk.photoroom.com/v1/segment`, başlık `x-api-key`, alanlar `format=png`, `channels=alpha`, `size=full`; görsel başı $0.02. Maske saklanır. Arka plan, filigran, ton, plaka köşesi veya rötuş değişince API çağrılmaz.
- **Plaka:** `justjuu/rtdetr-v2-license-plate-detection` (Apache-2.0; eğitim verisi CC BY 4.0, uygulamanın lisanslar ekranında anılır), eşik 0,3. Köşeler, kutunun %15 büyütülmüş halinde klasik dörtgen aramasıyla ve AB şeridi düzeltmesiyle bulunur; dörtgen yoksa kutunun köşeleri kullanılır. Ultralytics ve diğer AGPL YOLO'lar kullanılmaz.
- Her plaka yerleşimi hızlı kontrol bekler (`plate_status = 'auto'`). Ön, arka ve 45° açılarda plaka bulunamazsa `needs_check` olur ve banner konmaz. Yan, detay ve iç mekânda bulunamazsa `none` olur.
- **Çıktı:** JPEG, 4:3, 2560 × 1920, kalite 90; filigranlı ve filigransız iki dosya. Banner ikisinde de var.

**Kredi**
- 1 kredi = 1 araç. Kredi, aracın fotoğrafları ilk kez işlenirken düşer. Yeniden işleme, yeniden çekim ve yeniden çizim ek kredi istemez.
- Defterde üç hareket var: `grant`, `vehicle`, `refund`. Bakiye defterden hesaplanır. Aynı araçtan iki `vehicle` kaydı veritabanı kısıtıyla engellenir.
- Bakiye bitince işleme başlamaz (`no_credit`), çekim sürer.

**Güvenlik ve veri**
- Anahtarlar (Photoroom, servis rolü, servis sırrı) yalnız sunucuda tutulur. Uygulamaya ve git'e girmez, terminal çıktısına yazdırılmaz.
  - Yerelde `services/image-worker/.env` ve `supabase/functions/.env` dosyalarında durur; ikisi de git dışı.
  - Photoroom anahtarını kullanıcı `services/image-worker/.env`'ye koyar ya da `spikes/.env`'den kopyalanmasına onay verir.
- Veriler AB'de kalır: Supabase Frankfurt; servis Cloud Run Frankfurt (kurulum M2c'de).

**Lisanslar, indirmeler ve maliyet**
- Lisanslar ticari kullanıma uygun olmalı; AGPL ve GPL kullanılmaz. Python bağımlılıkları:
  - fastapi (MIT), uvicorn (BSD-3), httpx (BSD-3), numpy (BSD-3), opencv-python-headless (Apache-2.0), pillow (MIT-CMU), onnxruntime (MIT), pytest (MIT).
  - torch ve transformers yalnız ONNX dönüştürmesi için, geliştirmede kullanılır (`spikes/.venv`, kurulu).
- Plaka modelinin ağırlıkları M0'da onaylanıp `spikes/.cache/hf` altına indirildi. Yeni bir indirme gerekirse önce kaynak, lisans ve boyutla kullanıcıya sorulur. ONNX dosyası git'e girmez.
- Photoroom'a giden her gerçek çağrı ücretlidir. Testler sahte Photoroom kullanır. Gerçek anahtarla uçtan uca deneme (Task 10) önce kullanıcıya sorulur.

**Çalışma ortamı**
- Araçlar proje içinde kalır: `services/image-worker/.venv` (`python3.13 -m venv`). Docker yalnız bu servisin imajı için kullanılır.
- Melocaly'nin Docker container'larına ve 8081 portuna dokunulmaz. Servis yerelde 8090 portunda çalışır.
- Uygulama kodu iki yer dışında değişmez: Task 2'nin `db:types` çıktısı ve Task 5'in lisanslar ekranı satırları. Uygulamanın derlemesi ve testleri yeşil kalır.
- Commitleri kullanıcı atar. Her görev değişen dosyaların listesi ve kullanıcının stilinde (`add-...`, `upd-...`) önerilen bir mesajla biter; `git commit` çalıştırılmaz.

## Review Focus

1. **Yeniden çekim:** İşlenmiş bir fotoğrafın yerine yenisi çekilir. Eski çıktılar yeni fotoğrafa aitmiş gibi görünmemeli ve yeniden işleme kredi düşmemeli. → Task 2, `replacing the original resets processing` ve `reprocessing does not charge again`.
2. **Çift başlatma ve son kredi:** Aynı araçta iki kez "İşle" (iki cihaz, çift dokunma) ya da son kredide iki araç olabilir. Kredi tek kez düşmeli, bakiye eksiye inmemeli. → Task 2, `second start does not charge` ve `last credit goes to one vehicle`.
3. **Servisin yarıda ölmesi:** Zaman aşımı ya da çökmede fotoğraflar sonsuza dek "işleniyor" kalmamalı. → Task 2, `stuck photos can be queued again after 10 minutes`; Task 9, `marks photos failed when the worker is unreachable`.
4. **Eski durumla gönderilen araç satırı:** Uygulamanın gönderdiği satır, sunucunun koyduğu `ready` durumunu ezmemeli. → Task 2, `a client push does not move a processed vehicle back`.
5. **Kötü maske:** Photoroom boş maske döndürebilir; araç kadraj kenarında kesik ya da çok küçük olabilir. O fotoğraf okunur bir hatayla `failed` olmalı, diğerleri işlenmeye devam etmeli. → Task 8, `an empty mask fails only that photo`.

---

### Task 1: Kredi defteri

**Files:**
- Create: `supabase/migrations/20261112000001_credits.sql`
- Test: `supabase/tests/database/credits.test.sql`

**Interfaces:**
- Produces:
  - **Enum:** `public.credit_reason` ('grant', 'vehicle', 'refund').
  - **Tablo:** `public.credit_ledger`:
    - `id bigint generated always as identity primary key`
    - `gallery_id uuid not null references galleries on delete cascade`
    - `amount int not null`
    - `reason credit_reason not null`
    - `vehicle_id uuid references vehicles`
    - `created_by uuid default auth.uid() references auth.users on delete set null`
    - `note text`
    - `created_at timestamptz not null default now()`
  - **Check kısıtları:**
    - `vehicle`: `amount = -1` ve `vehicle_id` dolu.
    - `refund`: `amount = 1` ve `vehicle_id` dolu.
    - `grant`: `amount > 0`.
  - **Benzersizlik:** `(vehicle_id) where reason = 'vehicle'` ve `(vehicle_id) where reason = 'refund'` için ayrı birer kısmi benzersiz indeks.
  - **RLS:** Sahipler kendi galerilerinin satırlarını okur. `authenticated` için insert, update ve delete yok.
  - `public.gallery_credit_balance(p_gallery_id uuid) returns int`: security definer; yalnız galeri üyeleri çağırabilir, diğerlerine 42501. Satırların toplamını döner, hiç satır yoksa 0.
  - `public.admin_grant_credits(p_gallery_id uuid, p_amount int, p_note text) returns int`: yeni bakiyeyi döner.
  - `public.admin_refund_vehicle(p_vehicle_id uuid, p_note text) returns int`: yeni bakiyeyi döner. Krediyi düşülmemiş bir araçta `vehicle <id> was not charged` hatası verir.
  - İki yönetim fonksiyonu `admin_create_gallery` gibi `authenticated` ve `anon`'a kapalıdır.

- [ ] **Adım 1: Başarısız pgTAP testini yaz (`credits.test.sql`, plan 8)**

Testler postgres olarak çalışır ve bir araç ekler. Sonra dev hesaplarının kimlik bilgileriyle (`request.jwt.claims`) şunlar sınanır:
- `admin_grant_credits` 5 döner ve bakiye 5 olur.
- Krediyi düşülmemiş araçta iade `P0001` hatası verir.
- Aynı araca ikinci `vehicle` kaydı `23505` hatası verir.
- Aynı araca ikinci iade `23505` hatası verir.
- Sahip defteri okur, personel boş görür.
- Başka galerinin bakiyesini sormak `42501` hatası verir.
- `authenticated` rolüyle `admin_grant_credits` çağrısı `42501` hatası verir.
- `authenticated` rolüyle `credit_ledger`'a insert `42501` hatası verir.

- [ ] **Adım 2: Testin başarısız olduğunu gör**

Run: `npm run db:reset && npm run db:test`
Expected: `credits.test.sql` FAIL (tablo yok), diğer testler geçer.

- [ ] **Adım 3: Migration'ı yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: `npm run db:reset && npm run db:test`
Expected: tümü geçer.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-credit-ledger`.

---

### Task 2: İşleme şeması ve `start_processing`

**Files:**
- Create: `supabase/migrations/20261112000002_processing.sql`
- Test: `supabase/tests/database/processing.test.sql`
- Modify: `apps/mobile/src/lib/database.types.ts` (`npm run db:types` ile üretilir)

**Interfaces:**
- Consumes: Task 1'in `credit_ledger` tablosu ve `gallery_credit_balance` fonksiyonu.
- Produces:
  - **Enum'lar:**
    - `public.photo_process_status`: 'unprocessed', 'queued', 'processing', 'done', 'failed'.
    - `public.plate_status`: 'auto', 'needs_check', 'confirmed', 'none'.
  - **`photos` kolonları:**
    - `process_status photo_process_status not null default 'unprocessed'`, `process_error text`, `processed_at timestamptz`
    - `mask_path text`, `output_path text`, `output_wm_path text`
    - `placement jsonb`: `{ "m": [[a,b,c],[d,e,f]], "src": [w,h] }`. Dik çevrilmiş orijinalin piksellerini 2560 × 1920 çıktıya taşıyan 2×3 matris; ufuk düzeltmesi dahil.
    - `plate_corners jsonb`: 4 adet `[x,y]`, dik orijinale göre 0–1, sol üstten saat yönünde.
    - `plate_status plate_status`
    - `mask_edits jsonb not null default '[]'`: rötuş; koordinatlar dik orijinale göre 0–1.
    - `tone_stats jsonb`
  - **Tetikleyici `photos_reset_processing`** (before update): `original_path` değişince bütün işleme kolonları sıfırlanır. Durum `unprocessed`, `mask_edits` `'[]'`, diğerleri null olur.
  - **`vehicles` kolonları:** `background_id uuid references backgrounds`, `tone_enabled boolean not null default true`, `credit_charged_at timestamptz`.
  - **Tetikleyici `vehicles_keep_server_status`** (before update): eski durum `processing` ya da `ready` iken yeni durum `draft` ya da `shooting` ise eski durum korunur. `archived`'a geçiş serbesttir.
  - **Tablo `public.backgrounds`:**
    - Kolonlar: `id uuid primary key default gen_random_uuid()`, `gallery_id uuid references galleries on delete cascade` (null = platform), `name text not null`, `spec jsonb not null`, `sort_order int not null default 0`.
    - RLS: signed-in kullanıcılar platform satırlarını ve kendi galerilerinin satırlarını okur.
    - `spec` şu ikisinden biridir: `{"kind":"studio","wall":"#RRGGBB","floor":"#RRGGBB"}` veya `{"kind":"image","path":"<backgrounds kovasında yol>"}`.
    - Migration'daki üç sabit satır:
      - `b0000000-0000-0000-0000-000000000001` "Studio Weiß": wall `#FFFFFF`, floor `#F2F2F2`, sort 1.
      - `…002` "Studio Hellgrau": wall `#E9EAEC`, floor `#DCDDE0`, sort 2.
      - `…003` "Studio Dunkel": wall `#2B2D31`, floor `#1E1F22`, sort 3.
  - **`galleries` kolonları:** `logo_path text`, `banner_path text`, `watermark jsonb not null default '{}'`, `default_background_id uuid references backgrounds`.
    - `watermark` biçimi:
      - `position`: `top_left`, `top_right`, `bottom_left`, `bottom_right` ya da `center`; varsayılan `bottom_right`.
      - `width`: logo genişliğinin çıktı genişliğine oranı, 0,05–0,4; varsayılan 0,18.
      - `opacity`: 0–1; varsayılan 0,85.
      - `band`: `null` ya da `{edge: 'top'|'bottom', color: '#RRGGBB', height: 0.04–0.15}`.
  - **Kolon yetkileri:** `authenticated`, `photos` ve `vehicles` tablolarına yalnız aşağıdaki kolonları yazabilir (insert ve update). İşleme sonuçlarını yalnız servis rolü yazar.
    - `photos`: `id, vehicle_id, gallery_id, slot, original_path, captured_at, capture, qc, mask_edits, plate_corners, plate_status`.
    - `vehicles`: `id, gallery_id, make, model, body_type, status, details, created_at, updated_at, background_id, tone_enabled`.
  - **Kovalar (hepsi özel):**
    - `processed`: `<gallery>/<vehicle>/<photo>/mask.png`, `out-<ms>.jpg`, `outwm-<ms>.jpg`. Üyeler okur; yazmak yalnız servis rolüyle.
    - `branding`: `<gallery>/logo.png`, `<gallery>/banner.png`. Üyeler okur, sahipler yazar.
    - `backgrounds`: `platform/…` klasörünü herkes okur, `<gallery>/…` klasörünü üyeler okur.
  - **Realtime:** `photos` ve `vehicles` tabloları `supabase_realtime` yayınına eklenir.
  - **`public.start_processing(p_vehicle_id uuid, p_photo_id uuid default null, p_rerender boolean default false) returns uuid[]`:** security definer, `authenticated` çağırabilir. Adımlar:
    1. Araç yoksa ya da çağıran kişi galerinin üyesi değilse `not_member` (42501).
    2. Galeri satırı kilitlenir (`for update`).
    3. Kuyruğa girecek fotoğraflar seçilir. Bir fotoğraf "takılı" sayılır: `queued` ya da `processing` durumundadır ve `updated_at` 10 dakikadan eskidir.
       - `p_photo_id` verildiyse yalnız o fotoğraf; şu an kuyrukta ya da işleniyorsa ancak takılıysa.
       - `p_rerender` doğruysa: kuyrukta ya da işlenmekte olmayan bütün fotoğraflar, artı takılı olanlar.
       - Hiçbiri değilse: `unprocessed` ve `failed` durumundakiler, artı takılı olanlar.
    4. Seçilen yoksa boş dizi döner ve kredi düşmez.
    5. Araçta `vehicle` kaydı yoksa kredi düşülür:
       - Bakiye 1'den azsa `no_credit` (P0001).
       - Yeterliyse deftere -1 yazılır ve `credit_charged_at` doldurulur.
    6. Seçilenler `queued` olur, `process_error` temizlenir.
    7. Araç `processing` olur. `background_id` boşsa sırayla galerinin varsayılanıyla, o da yoksa sırası en küçük platform arka planıyla doldurulur.
    8. Kuyruğa giren fotoğrafların id'leri döner.

- [ ] **Adım 1: Başarısız pgTAP testini yaz (`processing.test.sql`)**

Testler postgres olarak bir araç ve üç fotoğraf ekler: iki dış açı, bir detay. Test adları ve beklentiler:
- `first start charges one credit and queues the photos`: bakiye 1 → 0, üç fotoğraf `queued`, araç `processing`, `credit_charged_at` dolu.
- `second start does not charge`: fotoğraflar `done` yapılır; `p_rerender => true` üçünü kuyruğa alır, bakiye ve defter aynı kalır.
- `reprocessing does not charge again`: `failed` bir fotoğraf yeniden kuyruğa girer, defterde yeni satır yok.
- `no credit leaves everything as it was`: bakiye 0 iken `no_credit` (P0001) hatası; hiçbir fotoğraf kuyruğa girmez.
- `last credit goes to one vehicle`: bakiye 1 iken A aracı başlar, B aracı `no_credit` alır.
- `stuck photos can be queued again after 10 minutes`: `updated_at` tetikleyicisi test içinde kapatılır.
  - `processing` + `now() - 11 min` kuyruğa girer.
  - `processing` + `now() - 5 min` girmez.
- `replacing the original resets processing`: `done` durumunda yolları, köşeleri ve silmeleri dolu fotoğrafın `original_path`'i değişir; durum `unprocessed` olur, `mask_path` null, `mask_edits` `[]`.
- `a client push does not move a processed vehicle back`:
  - `ready` durumundaki araç authenticated rolüyle `shooting` yapılmaya çalışılır; `ready` kalır.
  - `archived` yapılabilir.
- `members cannot write processing results`:
  - authenticated rolüyle `process_status` güncellemesi `42501` hatası verir.
  - `credit_charged_at` güncellemesi de `42501` hatası verir.
- `another gallery cannot start processing`: `42501` hatası.
- `staff can start processing`: personel çağırabilir.
- `members read the three studio backgrounds`.

- [ ] **Adım 2: Testin başarısız olduğunu gör**

Run: `npm run db:reset && npm run db:test`
Expected: `processing.test.sql` FAIL, diğerleri geçer.

- [ ] **Adım 3: Migration'ı yaz.** Realtime yayınında tablo zaten varsa ekleme atlanır.

- [ ] **Adım 4: Testlerin ve uygulamanın senkronizasyonunun geçtiğini gör**

Run: `npm run db:reset && npm run db:test && npm run db:types && (cd apps/mobile && npx tsc --noEmit && npx jest) && npm run test:int && npm run test:int:mobile`
Expected: tümü geçer. `test:int:mobile`, uygulamanın araç ve fotoğraf gönderiminin kolon yetkileriyle çalıştığını gösterir.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-processing-schema`.

---

### Task 3: Servis iskeleti, depo erişimi ve şablon verisi

**Files:**
- Create:
  - `services/image-worker/{requirements.txt, requirements-dev.txt, pytest.ini, .gitignore, .env.example}`
  - `services/image-worker/worker/{__init__.py, config.py, store.py, templates.py, app.py, templates.json}`
  - `services/image-worker/tests/{fakes.py, test_app.py, test_templates.py}`
- Modify: `tools/templates/templates.py`, `tools/templates/test_templates.py`

**Interfaces:**
- Produces:
  - **`templates.py export-worker`:** `tools/templates/out/*/*.json` dosyalarından `services/image-worker/worker/templates.json`'u yazar. Biçimi: `[{"bodyType", "slot", "mode", "box": [x0,y0,x1,y1]}]`; `export-app` gibi dar alan ön ve arka atlanır.
  - **`worker/templates.py`:** `template_box(body_type: str, slot: str) -> tuple[float, float, float, float] | None`. Normal modun kutusunu döner. `other` için dört kasa tipinin ortalaması; detay ve iç mekân için `None`.
  - **`worker/config.py`:** `Settings` (dataclass) ve `load_settings()`. Ortam değişkenleri: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PHOTOROOM_API_KEY`, `WORKER_SECRET`, `PLATE_MODEL_PATH` (varsayılan `models/plate_rtdetrv2.onnx`).
  - **`worker/store.py`:** `Store` (Protocol) ve onu httpx ile PostgREST ve Storage REST üzerinden uygulayan `SupabaseStore(url, service_key)`. Metotlar:
    - `vehicle(vehicle_id) -> dict`: araç satırı; içinde `gallery` (watermark, logo_path, banner_path) ve `background` (spec).
    - `photos(vehicle_id) -> list[dict]`
    - `update_photo(photo_id, fields: dict) -> None`, `update_vehicle(vehicle_id, fields: dict) -> None`
    - `download(bucket, path) -> bytes`, `upload(bucket, path, data: bytes, content_type: str) -> None`, `remove(bucket, paths: list[str]) -> None`
  - **`tests/fakes.py`:** `MemoryStore`, aynı protokolü sözlüklerle uygular.
  - **`worker/app.py`:** `create_app(store_factory: Callable[[], Store], runner: Callable[[Store, str, list[str]], dict]) -> FastAPI`.
    - `GET /health` → `{"ok": true}`.
    - `POST /process`, gövde `{"vehicle_id": str, "photo_ids": [str]}`. `x-worker-secret` başlığı `WORKER_SECRET` değilse 401. Doğruysa runner'ı çağırıp sonucunu döner.
  - `pytest.ini`: varsayılan çalıştırma `-m "not model"`.

- [ ] **Adım 1: Ortamı kur**

Run: `python3.13 -m venv services/image-worker/.venv && services/image-worker/.venv/bin/pip install -r services/image-worker/requirements-dev.txt`
`requirements*.txt` kurulan sürümlerle sabitlenir (`==`).
Expected: kurulum biter, sistem Python'una dokunulmaz.

- [ ] **Adım 2: Başarısız testleri yaz**

```python
def test_health(): ...                              # 200, {"ok": True}
def test_process_rejects_a_wrong_secret(): ...      # 401, runner not called
def test_process_hands_the_ids_to_the_runner(): ... # runner got (store, "v1", ["p1", "p2"]); response is its dict
def test_template_box_for_other_is_the_mean(): ...  # == mean of the four body types' left boxes
def test_template_box_for_a_detail_is_none(): ...
```
`tools/templates/test_templates.py` dosyasına: `test_export_worker_writes_boxes` (sedan `left` normal kutusu JSON'da; `front` wide yok).

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q && tools/templates/.venv/bin/python -m pytest tools/templates -q`
Expected: yeni testler FAIL (modüller yok).

- [ ] **Adım 4: Modülleri ve `export-worker`'ı yaz, `templates.json`'u üret**

Run: `tools/templates/.venv/bin/python tools/templates/templates.py export-worker`

- [ ] **Adım 5: Testlerin geçtiğini gör** (Adım 3'ün komutu) — Expected: tümü geçer.

- [ ] **Adım 6: Kullanıcıya devret** — önerilen mesaj: `add-image-worker-skeleton`.

---

### Task 4: Görüntü geometrisi, arka plan ve kompozisyon

**Files:**
- Create: `services/image-worker/worker/{imaging.py, backgrounds.py, compose.py}`
- Test: `services/image-worker/tests/{test_imaging.py, test_backgrounds.py, test_compose.py}`

**Interfaces:**
- Produces (görüntüler BGR `uint8`, alfa `uint8` 0–255):
  - **`imaging.py`:**
    - `load_upright(jpeg: bytes) -> np.ndarray`: EXIF yönü uygulanır (`ImageOps.exif_transpose`).
    - `straighten(image, alpha, roll_deg: float | None) -> tuple[np.ndarray, np.ndarray | None, np.ndarray]`: döndürülmüş görüntü, alfa ve 2×3 matris.
      - `roll_deg > 0` ufkun sağa doğru yükseldiği anlamına gelir (M1b `horizonDeg`); görüntü saat yönünde `roll_deg` kadar döndürülür.
      - `None` ya da `|roll_deg| > 10` → birim matris.
    - `keep_target(alpha, target_box: tuple[float, float, float, float] | None) -> np.ndarray`:
      - 128 eşiğinde 8 komşulu parçalar çıkarılır.
      - Kutu varsa (0–1, dik orijinale göre) kutuyla kesişen parçalar tutulur; kırpma yapılmaz.
      - Kutu yoksa merkezdeki %60'lık alanda ağırlık merkezi olan en büyük parça, o da yoksa en büyük parça tutulur.
      - Tutulan parçaların 3 piksel çevresindeki yumuşak kenarlar korunur.
    - `apply_edits(alpha, edits: list[dict]) -> np.ndarray`, koordinatlar 0–1:
      - `{"type": "erase", "points": [[x, y], ...], "radius": r}`: noktaları kalın çizgiyle siler; yarıçap genişliğe oranlıdır.
      - `{"type": "remove", "point": [x, y]}`: noktanın parçasını siler. O parça en büyük parçaysa (aracın kendisi) dokunmaz.
    - `bbox(alpha) -> tuple[int, int, int, int] | None`
    - `placement(car_bbox, box, out_size=(2560, 1920)) -> np.ndarray`: ölçek = kutu genişliği × 2560 / araç genişliği. Aracın alt-orta noktası kutunun alt-ortasına gelir.
  - **`backgrounds.py`:** `render_background(spec: dict, size=(2560, 1920), load_image: Callable[[str], np.ndarray] | None = None) -> np.ndarray`.
    - `studio`: ufuk `y = 0.5·h`'de. Üstte duvar rengi, altta zemin rengi; ufukta yüksekliğin %4'ü kadar yumuşak geçiş var. Zemin, ufka yakın %6'lık bölümde biraz koyulaşır.
    - `image`: görsel 4:3'e kırpılıp ölçeklenir.
  - **`compose.py`:**
    - `warp(image, matrix, out_size) -> np.ndarray`
    - `contact_shadow(alpha_out) -> np.ndarray`: 0–1 aralığında `float32` gölge. Aracın alt %12'si dikeyde 0,25'e basılıp alt konturun altına konur. Araç genişliğinin %1,5'i sigma ile bulanıklaştırılır; en yüksek koyuluk 0,45.
    - `compose(background, car, alpha, shadow) -> np.ndarray`
    - `encode_jpeg(image, quality=90) -> bytes`

- [ ] **Adım 1: Başarısız testleri yaz** (sentetik görüntülerle):

```python
def test_load_upright_applies_exif_orientation(): ...       # 40×30 JPEG with Orientation 6 → shape (40, 30, 3)
def test_straighten_levels_a_line_rising_to_the_right(): ... # line at +5°, roll 5 → fitted angle within 0.5°
def test_straighten_ignores_an_out_of_range_roll(): ...     # roll 90 → identity matrix, image unchanged
def test_keep_target_drops_a_separate_car(): ...            # two blobs, box over the left one → right blob 0
def test_keep_target_keeps_parts_outside_the_box(): ...     # antenna above the box stays (no cropping)
def test_keep_target_without_box_keeps_the_central_blob(): ...
def test_erase_edit_clears_the_stroke(): ...
def test_remove_edit_drops_a_piece_but_never_the_car(): ...
def test_placement_puts_the_car_on_the_template_box(): ...  # car bbox maps to box width, bottom centre on box bottom centre (±1 px)
def test_studio_background_has_wall_floor_and_horizon(): ... # top pixel ≈ wall, bottom ≈ floor, change around y = 960
def test_shadow_only_below_the_car(): ...                   # 0 above the car's bottom row, > 0.2 just below it
def test_compose_returns_a_2560_by_1920_jpeg(): ...
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
Expected: yeni testler FAIL.

- [ ] **Adım 3: Modülleri yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör** (Adım 2'nin komutu) — Expected: tümü geçer.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-worker-geometry-compose`.

---

### Task 5: Plaka: tespit, köşeler, kapatma ve banner

**Files:**
- Create:
  - `services/image-worker/scripts/export_plate_onnx.py` (`spikes/.venv` ile çalışır)
  - `services/image-worker/worker/plate.py`
- Test: `services/image-worker/tests/{test_plate.py, test_plate_model.py}`
- Modify: `apps/mobile/src/app/(app)/licenses.tsx`, `apps/mobile/src/locales/{de,tr,en}.json`

**Interfaces:**
- Produces:
  - **`scripts/export_plate_onnx.py`:** Ağırlıkları `spikes/.cache/hf` önbelleğinden (`HF_HOME`) okur.
    - Çıktı: `services/image-worker/models/plate_rtdetrv2.onnx`, opset 17.
    - Giriş `pixel_values [1,3,H,W]`, çıkışlar `logits` ve `pred_boxes`.
    - `preprocessor_config.json`'daki boyutlandırma, ölçekleme ve normalleştirmeyi ONNX'in yanına `plate_preprocess.json` olarak yazar.
    - Beş spike fotoğrafında PyTorch ile ONNX kutularını karşılaştırır ve en büyük farkı piksel olarak yazar.
  - **`worker/plate.py`:**
    - `PlateDetector(model_path: str)`:
      - `detect(image) -> list[tuple[float, tuple[int, int, int, int]]]`: skor ≥ 0,3 olanlar, piksel cinsinden kutular.
      - Ön işlem `plate_preprocess.json`'a uyar.
      - Son işlem: logits sigmoid'den geçer, her sorgunun en iyi skoru alınır, `cxcywh` → `xyxy` × görüntü boyutu.
    - `refine_corners(image, box) -> np.ndarray`: `(4, 2)`, sol üstten saat yönünde.
      - `spikes/plate/classical.py`'deki `quads`, `score`, `extend_eu_strip` ve `order_corners` taşınır.
      - Arama kutunun %15 büyütülmüş halinde yapılır; dörtgen yoksa kutunun köşeleri döner.
    - `cover(image, boxes) -> np.ndarray`: her kutu %10 büyütülüp okunmaz hale getirilir. Yükseklikten büyük çekirdekli Gauss bulanıklığı kullanılır.
    - `pick_target(plates, alpha) -> tuple[int, int, int, int] | None`: alanının %50'den fazlası araç maskesinde (> 127) olan en yüksek skorlu kutu.
    - `warp_banner(canvas, banner_rgba, corners) -> np.ndarray`: banner dikdörtgeninden köşelere homografi (`cv2.getPerspectiveTransform`) ve alfa karışımı.
  - **Lisanslar ekranı:** "Kennzeichenerkennung" bölümü eklenir; mevcut `Entry` bileşeni kullanılır.
    - Model: "RT-DETRv2 License Plate Detection", justjuu, Apache-2.0, `https://huggingface.co/justjuu/rtdetr-v2-license-plate-detection`.
    - Eğitim verisi: "License Plate Detection Dataset", justjuu, CC BY 4.0, `https://huggingface.co/datasets/justjuu/license-plate-detection`.

- [ ] **Adım 1: ONNX'e dönüştür ve PyTorch ile karşılaştır**

Run: `HF_HOME=spikes/.cache/hf spikes/.venv/bin/python services/image-worker/scripts/export_plate_onnx.py`
Expected: ONNX dosyası yazılır, en büyük kutu farkı 2 pikselin altında kalır.
Dönüştürme başarısız olursa durulur ve kullanıcıya sorulur. Alternatif, PyTorch'u imaja koymaktır; imaj yaklaşık 1 GB büyür.

- [ ] **Adım 2: Başarısız testleri yaz**

```python
def test_refine_finds_a_drawn_plate(): ...       # synthetic tilted 520:110 white plate with dark bars and a blue left strip:
                                                 # mean corner error < 3 % of plate width, strip included
def test_refine_falls_back_to_the_box(): ...     # flat image → box corners
def test_cover_makes_the_plate_unreadable(): ... # variance inside the grown box drops > 90 %, outside unchanged
def test_pick_target_uses_the_car_mask(): ...    # two plates, the one on the car wins
def test_banner_lands_on_the_corners(): ...      # red banner: quad centre red, a pixel 5 px outside unchanged

@pytest.mark.model
def test_detector_finds_known_plates(): ...      # 3 photos from spikes/data/photos with plates_gt.json: IoU ≥ 0.5
```

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
Expected: yeni testler FAIL.

- [ ] **Adım 4: `plate.py`'yi ve lisanslar satırlarını yaz**

- [ ] **Adım 5: Testlerin geçtiğini gör**

Run:
1. `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
2. `services/image-worker/.venv/bin/python -m pytest services/image-worker -q -m model`
3. `(cd apps/mobile && npx tsc --noEmit && npx jest)`

Expected: tümü geçer.

- [ ] **Adım 6: Kullanıcıya devret** — önerilen mesaj: `add-worker-plate`.

---

### Task 6: Ton düzeltme ve filigran

**Files:**
- Create: `services/image-worker/worker/{tone.py, watermark.py}`
- Test: `services/image-worker/tests/{test_tone.py, test_watermark.py}`

**Interfaces:**
- Produces:
  - **`tone.py`:**
    - `measure(image, alpha) -> dict`: `{"L", "a", "b"}`. Lab ortalaması alınır (L 0–100, a ve b −128…127). Maskede > 127 olan ve L ≤ 97 kalan pikseller kullanılır.
    - `set_target(stats: list[dict]) -> dict | None`: kanal başına ortanca; liste boşsa `None`.
    - `correction(stats, target, strength=0.5) -> dict`: `{"gain", "da", "db"}`.
      - `gain = clamp((L + strength·(T.L − L)) / L, 0.8, 1.25)`.
      - `da` ve `db` = `clamp(strength·(T − s), −6, 6)`.
    - `apply(image, corr, alpha=None) -> np.ndarray`: Lab uzayında L × gain, a + da, b + db. Alfa verildiyse yalnız araç pikselleri, alfayla karıştırılarak değişir.
    - `mean_correction(corrs: list[dict]) -> dict`: liste boşsa birim düzeltme.
  - **`watermark.py`:** `apply_watermark(canvas, logo_rgba: np.ndarray | None, settings: dict) -> np.ndarray`. Ayarlar ve varsayılanları Task 2'deki `watermark` biçimindedir.
    - Önce bant çizilir; logo bandın içinde, dikeyde ortalanır.
    - Bant yoksa logo köşede, genişliğin %3'ü kenar payıyla durur.
    - Logo yok, bant da yoksa görüntü değişmeden kopyalanır.

- [ ] **Adım 1: Başarısız testleri yaz**

```python
def test_a_set_moves_toward_its_own_average(): ...  # car regions L 40 and 60 → after correction ≈ 45 and 55 (±1)
def test_a_black_car_stays_black(): ...             # three dark cars L ≈ 18 → corrected L < 25
def test_correction_is_limited(): ...               # L 20 against target 80 → gain 1.25
def test_detail_gets_the_mean_correction(): ...
def test_watermark_corner_and_opacity(): ...        # bottom_right, width 0.18, opacity 0.5: blended pixel ≈ halfway
def test_band_holds_the_logo(): ...                 # bottom band colour across the full width, logo inside it
def test_no_logo_no_band_leaves_the_image(): ...
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
Expected: yeni testler FAIL.

- [ ] **Adım 3: Modülleri yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör** (Adım 2'nin komutu) — Expected: tümü geçer.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-worker-tone-watermark`.

---

### Task 7: Photoroom istemcisi

**Files:**
- Create: `services/image-worker/worker/photoroom.py`
- Test: `services/image-worker/tests/test_photoroom.py`

**Interfaces:**
- Produces:
  - `class PhotoroomError(Exception)`: `code` alanı `photoroom_402`, `photoroom_4xx` ya da `photoroom_unavailable` olur.
  - `class Photoroom(api_key: str, client: httpx.Client | None = None, sleep=time.sleep)`:
    - `mask(jpeg: bytes) -> np.ndarray`: fotoğrafla aynı boyutta alfa.
    - İstek Global Constraints'teki biçimde; zaman aşımı 120 sn.
    - 429, 5xx ve zaman aşımında 1, 2 ve 4 sn arayla 3 kez yeniden dener.
    - 402 ve diğer 4xx yanıtlarında yeniden denemez.

- [ ] **Adım 1: Başarısız testleri yaz** (`httpx.MockTransport`, `sleep` sahte)

```python
def test_mask_returns_the_alpha(): ...           # PNG alpha in the response → array of the same size
def test_no_credits_is_not_retried(): ...        # 402 → PhotoroomError("photoroom_402"), one call
def test_server_errors_are_retried(): ...        # 503, 503, 200 → mask returned, three calls
def test_the_key_goes_in_the_header(): ...       # x-api-key set, form fields format/channels/size
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör** — `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`

- [ ] **Adım 3: `photoroom.py`'yi yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör** — Expected: tümü geçer.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-worker-photoroom`.

---

### Task 8: İşleme akışı ve tasarım güncellemesi

**Files:**
- Create: `services/image-worker/worker/{pipeline.py, main.py}`
- Test: `services/image-worker/tests/test_pipeline.py`
- Modify:
  - `services/image-worker/tests/fakes.py`: `FakePhotoroom` ve `FakeDetector` eklenir.
  - `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md`: 7.2 ve 7.4 bölümleri.

**Interfaces:**
- Consumes: Task 3'ün `Store` protokolü ve `template_box`; Task 4'ün imaging, compose ve backgrounds modülleri; Task 5'in plate modülü; Task 6'nın tone ve watermark modülleri; Task 7'nin `Photoroom` sınıfı.
- Produces:
  - **`pipeline.run(store, vehicle_id, photo_ids, photoroom, detector, clock=time.time) -> dict`:** `{"done": n, "failed": m}` döner. Kuyruktaki her fotoğraf önce `processing` olur.
  - **Analiz** (dış açıda `mask_path` boşsa; detay ve iç mekânda `plate_status` boşsa):
    1. Orijinal indirilir ve `load_upright` ile dik çevrilir.
    2. `detect` çalışır ve bulunan bütün plakalar `cover` ile kapatılır.
    3. Dış açılarda:
       - Photoroom maskesi alınır ve `keep_target` uygulanır (`capture.targetBox`).
       - Maske `processed/<g>/<v>/<p>/mask.png`'ye yazılır.
       - `pick_target` ve `refine_corners` ile `plate_corners` çıkarılır.
       - `tone_stats = measure(...)`.
    4. Detay ve iç mekânda maske yoktur; plaka en yüksek skorlu kutudan alınır.
    5. `plate_status`: plaka bulunduysa `auto`. Bulunamadıysa ön, arka ve 45° açılarda `needs_check`; yan, detay ve iç mekânda `none`.
  - **Çizim** (kuyruktaki her fotoğraf):
    - Hedef ton, aracın bütün dış fotoğraflarındaki `tone_stats` değerlerinden `set_target` ile hesaplanır.
    - Dış açılarda:
      1. Maske indirilir, `apply_edits(mask_edits)` uygulanır.
      2. `straighten(capture.rollDeg)` çalışır; ardından `bbox` ve `placement(template_box(body_type, slot))`.
      3. Görüntü ve alfa 2560 × 1920'ye taşınır.
      4. `tone_enabled` ise ton uygulanır.
      5. Arka plan (`render_background`), gölge ve kompozisyon eklenir.
      6. `plate_status` `auto` ya da `confirmed` ise banner konur; köşeler ufuk ve yerleşim matrisinden geçirilir.
      7. Önce filigransız, sonra `apply_watermark` ile filigranlı çıktı üretilir.
    - Detay ve iç mekânda: dik orijinal 4:3'e kırpılıp 2560 × 1920 yapılır; `mean_correction`, banner ve filigran uygulanır.
    - Çıktılar `out-<ms>.jpg` ve `outwm-<ms>.jpg` olarak yüklenir, önceki çıktılar silinir.
    - Fotoğraf `done` olur; `placement`, `processed_at` ve yollar yazılır, `process_error` null olur.
  - **Hatalar:** Hata yalnız o fotoğrafı `failed` yapar; diğerleri sürer. `process_error` kısa bir koddur: `photoroom_402`, `photoroom_4xx`, `photoroom_unavailable`, `empty_mask`, `download_failed` ya da `internal`.
  - **Bitiş:** Araçta `queued` ya da `processing` fotoğraf kalmadıysa araç `ready` olur.
  - **`main.py`:** `app = create_app(...)`. `SupabaseStore`, `Photoroom` ve `PlateDetector` `load_settings()` ile kurulur.

- [ ] **Adım 1: Başarısız testleri yaz**

Testler `MemoryStore` ile çalışır. Sentetik veriler:
- Orijinaller: dokulu bir zemin üstünde gri bir "araç" ve yanında ikinci bir parça.
- `FakePhotoroom`: iki parçanın alfasını döner ve çağrı sayısını tutar.
- `FakeDetector`: aracın üstünde bir plaka kutusu döner.

```python
def test_a_full_run_writes_both_outputs_and_marks_done(): ...  # 2 exterior + 1 detail: 2560×1920 JPEGs, mask.png, placement, plate 'auto' with 4 corners, vehicle 'ready'
def test_a_rerender_does_not_call_photoroom(): ...             # second run: Photoroom calls unchanged, new output paths, old ones removed
def test_mask_edits_are_applied(): ...                         # erase over the second piece → that area shows the background
def test_an_empty_mask_fails_only_that_photo(): ...            # one 'failed' with 'empty_mask', the other 'done'
def test_a_photoroom_error_is_recorded(): ...                  # PhotoroomError('photoroom_402') → 'failed', 'photoroom_402'
def test_plates_are_covered_before_photoroom(): ...            # image sent to FakePhotoroom: plate region blurred
def test_a_side_view_without_plate_is_none(): ...              # 'left' → 'none', 'front' → 'needs_check'
def test_tone_off_leaves_the_car_colours(): ...                # tone_enabled false → car pixels equal the plain placement
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör** — `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`

- [ ] **Adım 3: `pipeline.py` ve `main.py`'yi yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör** — Expected: tümü geçer.

- [ ] **Adım 5: Tasarımı güncelle**
- 7.2'de maskeden sonraya rötuş adımı eklenir. Personel işlenmiş fotoğrafta kalan parçaya dokunur ya da üstünü siler. Silmeler saklanır ve her çizimde yeniden uygulanır; API'ye yeniden gidilmez.
- 7.2'de "kutuyla sınırlanır" ifadesi, kutuya değen parçaların tutulması olarak yazılır.
- 7.4'e iki not eklenir: pilotta her banner yerleşimi hızlı kontrolden geçer (güven eşiği yok). Yan açılar, detay ve iç mekânda plaka bulunamazsa işaret konmaz.
- Değişen satırların yanına `(M0 kararı, 12 Kasım 2026)` yazılır.

- [ ] **Adım 6: Kullanıcıya devret** — önerilen mesaj: `add-worker-pipeline`.

---

### Task 9: `process-vehicle` Edge Function

**Files:**
- Create: `supabase/functions/process-vehicle/index.ts`, `supabase/functions/.env.example`
- Test: `supabase/tests/integration/process-vehicle.test.ts`
- Modify: `.gitignore` (`supabase/functions/.env`)

**Interfaces:**
- Consumes: Task 2'nin `start_processing` fonksiyonu; Task 3'ün `POST /process` ucu.
- Produces: `POST /functions/v1/process-vehicle`, gövde `{ vehicleId: string, photoId?: string, rerender?: boolean }`, başlıkta kullanıcının `Authorization` token'ı.
  - **Hata yanıtları:**
    - Token yoksa ya da geçersizse 401 `{error:'unauthorized'}`.
    - Gövde bozuksa 400 `{error:'bad_request'}`.
    - `not_member` → 403 `{error:'not_member'}`.
    - `no_credit` → 402 `{error:'no_credit'}`.
  - **Başarılı yanıtlar:**
    - Kuyruk boşsa 200 `{queued: []}`.
    - Doluysa 202 `{queued: [...]}` döner ve `EdgeRuntime.waitUntil` içinde `${WORKER_URL}/process` çağrılır (`x-worker-secret` başlığıyla).
    - Servis bağlantısı kurulamaz ya da 2xx dışı dönerse, o fotoğraflar servis rolüyle `failed` yapılır; `process_error = 'worker_unreachable'`.
  - `start_processing`, kullanıcının token'ıyla kurulan istemciden çağrılır; böylece `auth.uid()` çalışır.
  - Yerel ortam `supabase/functions/.env` dosyasından okunur: `WORKER_URL=http://host.docker.internal:8090`, `WORKER_SECRET=…`.

- [ ] **Adım 1: Başarısız entegrasyon testlerini yaz**

Sahte servis, testin içinde 54399 portunda çalışan bir `node:http` sunucusudur; gelen istekleri kaydeder. Test sırasında `WORKER_URL=http://host.docker.internal:54399` kullanılır.

```ts
test('charges once and hands the photos to the worker', ...)   // balance −1, fake worker got vehicle_id, ids, secret; second call: no new charge
test('answers 402 when the gallery has no credit', ...)
test('answers 403 for another gallery\'s vehicle', ...)
test('marks photos failed when the worker is unreachable', ...) // fake worker stopped → photos 'failed', 'worker_unreachable'
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `npm run db:reset && npm run test:int`
Expected: yeni testler FAIL (fonksiyon yok), eskiler geçer.

- [ ] **Adım 3: Fonksiyonu yaz.** Yerel edge runtime ortam dosyasını kendiliğinden okumuyorsa, nasıl verildiği README'ye yazılır.

- [ ] **Adım 4: Testlerin geçtiğini gör** (Adım 2'nin komutu) — Expected: tümü geçer.

- [ ] **Adım 5: Kullanıcıya devret** — önerilen mesaj: `add-process-vehicle-function`.

---

### Task 10: Docker imajı, yerelde uçtan uca deneme ve kurulum notları

**Files:**
- Create: `services/image-worker/{Dockerfile, .dockerignore}`, `services/image-worker/scripts/{seed_test_vehicle.py, contact_sheet.py}`
- Modify: `README.md` ("İşleme servisi" bölümü)

**Interfaces:**
- Consumes: Task 1–9.
- Produces:
  - **İmaj:** `python:3.13-slim`. İçine `requirements.txt`, `worker/` ve `models/` girer. Komut: `uvicorn worker.main:app --host 0.0.0.0 --port ${PORT:-8080}`.
  - **`seed_test_vehicle.py`:** `spikes/data/photos` altındaki gerçek fotoğraflardan 8 dış açılık bir test aracı kurar. Fotoğrafları `originals` kovasına yükler; `photos` satırlarını açı etiketleriyle (`spikes/data/photos.csv`) ve `capture` bilgisiyle yazar. Servis rolüyle çalışır.
  - **`contact_sheet.py`:** Bir aracın orijinal ve çıktılarını yan yana tek bir PNG'de toplar (git dışı `services/image-worker/out/`).
  - **README "İşleme servisi" bölümü:**
    - Servis ortamı ve `.env` alanları; anahtarlar yazılmaz.
    - ONNX dönüştürme komutu.
    - Servisi `uvicorn --port 8090` ile çalıştırma; Docker ile çalıştırma.
    - Edge Function ortamı.
    - Kredi yükleme ve iade SQL'i: `select admin_grant_credits('<galeri>', 10, 'Pilot')`, `select admin_refund_vehicle('<araç>', 'İşleme başarısız')`.

- [ ] **Adım 1: İmajı kur ve sağlık ucunu dene**

Run: `docker build -t bambu-image-worker services/image-worker && docker run --rm -d --name bambu-image-worker -p 8090:8080 --env-file services/image-worker/.env bambu-image-worker && curl -s localhost:8090/health`
Expected: `{"ok":true}`. Container sonra durdurulur.

- [ ] **Adım 2: Gerçek Photoroom denemesi için kullanıcıya sor**

8 fotoğraf × $0.02 tutar. Onay olmadan Adım 3'e geçilmez.

- [ ] **Adım 3: Uçtan uca dene**
1. Servis 8090'da çalışırken test aracı kurulur.
2. Testgalerie'ye 2 kredi yüklenir.
3. Sahip hesabının token'ıyla `process-vehicle` çağrılır.
4. Fotoğraf durumları `done` olana kadar izlenir.
5. Temas sayfası üretilir.

Expected:
- 8 fotoğrafın hepsi `done` olur ya da okunur bir hatayla `failed` olur.
- Bakiye bir azalır.
- Temas sayfasında araçlar şablon konumunda ve düz durur. Plakalar banner'lı ya da `needs_check` olarak işaretli.

Temas sayfası kullanıcıya gösterilir; görünüm sorunları (gölge, ton, yerleşim) ayrı bir ayar adımı olarak not edilir.

- [ ] **Adım 4: Arka plan değişince yeniden çizimi dene**

Aracın `background_id`'si koyu stüdyoya alınır ve `rerender: true` ile yeniden çağrılır.
Expected: Photoroom çağrılmaz (servis günlüğü), bakiye değişmez, yeni çıktılar koyu zeminde.

- [ ] **Adım 5: README bölümünü yaz, tüm testleri çalıştır**

Run:
1. `npm run db:reset && npm run db:test && npm run test:int && npm run test:int:mobile`
2. `(cd apps/mobile && npx jest && npx tsc --noEmit)`
3. `services/image-worker/.venv/bin/python -m pytest services/image-worker -q`
4. `tools/templates/.venv/bin/python -m pytest tools/templates -q`

Expected: hepsi geçer.

- [ ] **Adım 6: Arka planda kalanları durdur, kullanıcıya devret**

Durdurulacaklar: servis, Docker container'ı ve sahte sunucular. Önerilen mesaj: `add-worker-docker-e2e-notes`.
