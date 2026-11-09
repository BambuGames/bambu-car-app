# M1a Temel Altyapı Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Galeri personeli davetle gelen kodla hesabını açıp giriş yapabilsin, internet olmadan araç kaydı açabilsin; kayıtlar ve fotoğraflar bağlantı gelince Supabase'e yüklensin; hiçbir galeri başka bir galerinin verisini göremesin.

**Architecture:** Backend yerelde Supabase CLI ile Docker'da çalışır: Postgres şeması ve satır bazlı yetki (RLS), özel bir Storage kovası, Bambu Games'in panelden çağırdığı yönetim fonksiyonları ve hesap silen tek bir Edge Function. Mobil uygulama `apps/mobile` altında Expo SDK 58 ve Expo Router ile yazılır. İnternetsiz çalışmanın asıl kaynağı cihazdaki SQLite'tır: her değişiklik önce yerel veritabanına ve bir giden kuyruğa (outbox) yazılır. Senkronizasyon motoru kuyruğu sırayla Supabase'e iter, başarısız işleri artan bekleme süreleriyle yeniden dener ve diğer cihazlardaki araçları geri çeker. Saf mantık modülleri Jest'te Node'un yerleşik SQLite'ıyla, backend pgTAP ve yerel yığına karşı entegrasyon testleriyle sınanır.

**Tech Stack:** Supabase CLI 3.0.0 (Postgres, pgTAP, Auth, Storage, Deno Edge Functions), @supabase/supabase-js 2.119.0, Expo SDK 58 / React Native 0.88 / Expo Router, expo-sqlite, expo-file-system, expo-network, expo-crypto, expo-localization, i18next 27 + react-i18next 18, Jest 30 (jest-expo), Node 26 (`node --test`).

**Spec:** `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (özellikle 4, 5, 6.1, 6.5, 8.1, 11, 12) · Araç notları: `docs/m0-findings.md`

**Plan sırası ve sapmalar:**
- Tasarımdaki M1 ikiye bölündü. Bu plan telefon gerektirmeyen kısmı (M1a) kapsıyor. Yönlendirmeli çekim ve kalite kontrolü (M1b), M0 Task 2'nin telefon ölçümlerinden sonra yazılacak. M1b, bu planın Task 4'ündeki `savePhoto` fonksiyonuna bağlanacak.
- Galeri ayarları (logo, plaka banner'ı, filigran, varsayılan arka plan) M2'ye kaydırıldı; onları kullanan işleme M2'de geliyor.
- Uygulama içi personel yönetimi de M2'ye kaydırıldı. Pilotta personeli Bambu Games, Task 2'deki yönetim fonksiyonuyla ekler.

## Global Constraints

- Arayüz Almanca; Türkçe ve İngilizce de var (i18n). Varsayılan dil Almanca.
- Tüm UI çalışmaları /no-slop-ui kuralına uyar. UI kodu veya metni yazmadan önce `no-slop-ui` skill'i yüklenir.
- Hesaplar Supabase'in davet e-postasıyla açılır; uygulamada kayıt ekranı yoktur. Giriş e-posta ve şifreyle yapılır.
- Uygulamada "hesabımı sil" seçeneği bulunur (GDPR ve Apple kuralı).
- Galeriler birbirinin verisini göremez; bunu veritabanındaki RLS sağlar.
- Çekime başlamak için zorunlu alanlar: marka, model, kasa tipi. Marka ve model listesi veritabanından gelir; listede olmayan serbest metinle girilir.
- Kasa tipleri: sedan (Limousine), Kombi, SUV, hatchback; diğerleri genel.
- Araç durumları: taslak → çekimde → işleniyor → hazır → arşiv.
- Her çekim adımında tek fotoğraf olur; yeniden çekim eskisinin yerine geçer.
- İnternetsiz çalışma: araç kaydı ve çekim internetsiz çalışır, veriler cihazda tutulur ve bağlantı gelince yüklenir. Yükleme durumu görünür; başarısız yüklemeler yeniden denenir. Yükleme uygulama açıkken yapılır ve uygulama yeniden açılınca kaldığı yerden devam eder; uygulama kapalıyken arka planda yükleme yapılmaz.
- Bundle ID `com.bambugames.carapp`, çalışma adı bambu-car-app.
- Repo düzeni: `apps/mobile/`, `supabase/`; monorepo aracı kullanılmaz; ortak tipler Supabase'in ürettiği tip dosyasından gelir.
- Node 26 LTS (sistemdeki). iOS derlemeleri Xcode 26.6 ile, yalnızca komut bazında: `DEVELOPER_DIR=<Xcode-26.6.app yolu>/Contents/Developer`. Şu an yol `/Users/egemenderbedek/Downloads/Xcode-26.6.app`, Uygulamalar'a taşınırsa `/Applications/Xcode-26.6.app`. CocoaPods için `LANG=en_US.UTF-8`.
- Sistem çapında araç kurulmaz ve değiştirilmez: global `xcode-select`, global Node ve `brew` paketlerine dokunulmaz. Supabase CLI projeye `devDependency` olarak eklenir.
- Commitleri kullanıcı atar. Her görev değişen dosyaların listesi ve kullanıcının stilinde (`add-...`, `upd-...`) önerilen bir commit mesajıyla biter; `git commit` çalıştırılmaz.

## Review Focus

1. **Yarıda kalan yükleme:** Dosya Storage'a çıktıktan sonra satır yazılamazsa veya uygulama o anda kapanırsa, yeniden deneme aynı adım için tek dosya ve tek satır bırakmalı. → Task 5, `retries a photo whose row upsert failed after the file uploaded`.
2. **Bekleyen yerel değişikliğin ezilmesi:** Sunucudan çekilen araç, cihazda henüz yüklenmemiş bir değişikliğin üstüne yazılmamalı. → Task 5, `pull does not overwrite a vehicle with pending local changes`.
3. **Çıkış yapma veya yeniden başlatma:** Bekleyen yüklemeler kaybolmamalı; aynı kullanıcı girince kaldığı yerden devam etmeli. → Task 4, `pending outbox items survive reopening the database`.
4. **Başka galeriye erişim denemesi:** Personel başka bir galerinin aracına fotoğraf bağlayamamalı ve o galerinin Storage klasörüne yazamamalı. → Task 1, `photo cannot point at another gallery's vehicle` ve `member cannot upload under another gallery folder`.
5. **Hatalı davet kodu:** Boşluklu, eksik haneli veya süresi geçmiş kod çökme değil anlaşılır bir mesaj vermeli. → Task 6, `normalizeCode` testleri ve `otp_expired` eşlemesi.

---

### Task 1: Supabase projesi, çekirdek şema, RLS ve Storage

**Files:**
- Create: `package.json` (kök; `"type": "module"`, `"private": true`)
- Create: `supabase/config.toml` (`npx supabase init` üretir)
- Create: `supabase/migrations/20261109000001_core.sql`
- Test: `supabase/tests/database/core.test.sql`

**Interfaces:**
- Produces (sonraki görevlerin kullandığı şema):
  - Enum'lar: `member_role` (`'owner'`, `'staff'`), `body_type` (`'sedan'`, `'kombi'`, `'suv'`, `'hatchback'`, `'other'`), `vehicle_status` (`'draft'`, `'shooting'`, `'processing'`, `'ready'`, `'archived'`).
  - `galleries(id uuid pk default gen_random_uuid(), name text not null, created_at timestamptz not null default now())`
  - `gallery_members(gallery_id uuid → galleries on delete cascade, user_id uuid → auth.users on delete cascade, role member_role not null, created_at, primary key (gallery_id, user_id))`
  - `makes(id int generated always as identity pk, name text not null unique)`, `models(id int generated always as identity pk, make_id int → makes on delete cascade, name text not null, unique (make_id, name))`
  - `vehicles(id uuid pk default gen_random_uuid(), gallery_id uuid not null → galleries, make text not null, model text not null, body_type body_type not null, status vehicle_status not null default 'draft', details jsonb not null default '{}', created_by uuid → auth.users on delete set null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (id, gallery_id))`
  - `photos(id uuid pk, vehicle_id uuid not null, gallery_id uuid not null, slot text not null, original_path text not null, captured_at timestamptz not null, capture jsonb not null default '{}', qc jsonb not null default '{}', created_at, updated_at, unique (vehicle_id, slot), foreign key (vehicle_id, gallery_id) references vehicles (id, gallery_id) on delete cascade)`. `slot` için check: Task 4'teki 24 adım kimliği.
  - `public.set_updated_at()` tetikleyicisi `vehicles` ve `photos` üzerinde.
  - `private.is_gallery_member(gallery uuid) returns boolean` ve `private.is_gallery_owner(gallery uuid) returns boolean`: `security definer`, `stable`, `set search_path = ''`. `authenticated` rolüne `private` şemasında `usage` ve fonksiyonlarda `execute` verilir.
  - Storage: özel `originals` kovası; yol düzeni `{gallery_id}/{vehicle_id}/{slot}.jpg`.
- RLS kuralları:
  - `galleries`: üye okur, sahip (`owner`) günceller.
  - `gallery_members`: kullanıcı kendi galerilerinin üyelerini okur; ekleme, değiştirme ve silme yalnızca yönetim fonksiyonlarıyla yapılır.
  - `vehicles` ve `photos`: galerinin üyesi okur, ekler, günceller; silme yoktur (araç arşivlenir).
  - `makes` ve `models`: giriş yapmış herkes okur.
  - `storage.objects`: `bucket_id = 'originals'` ve `private.is_gallery_member(((storage.foldername(name))[1])::uuid)` ise select, insert ve update.

- [ ] **Adım 1: Supabase'i projeye ekle ve yerel yığını başlat**

Kök `package.json` devDependencies: `"supabase": "3.0.0"`, `"@supabase/supabase-js": "2.119.0"`. Scripts: `"db:start": "supabase start"`, `"db:reset": "supabase db reset"`, `"db:test": "supabase test db"`, `"db:types": "supabase gen types > apps/mobile/src/lib/database.types.ts"`, `"test:int": "set -a && eval \"$(supabase status -o env)\" && set +a && node --test 'supabase/tests/integration/*.test.ts'"`, `"test:int:mobile": "set -a && eval \"$(supabase status -o env)\" && set +a && cd apps/mobile && npm run test:int"`. `set -a`, `status`'un bastığı değişkenleri (`API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`) test süreçlerine aktarır; `status` bu adları farklı basarsa `--override-name` ile bu adlara eşlenir.
Run: `npm install && npx supabase init && npx supabase start`
Expected: `supabase start` API URL'sini (`http://127.0.0.1:54321`), Studio'yu ve mail kutusunu listeler. İlk çalıştırmada Docker imajları indirilir.

- [ ] **Adım 2: Başarısız testleri yaz (`supabase/tests/database/core.test.sql`)**

Sabit kimlikler: kullanıcılar `…0a` (staff A), `…a0` (owner A), `…0b` (staff B); galeriler `aaaaaaaa-…` (A), `bbbbbbbb-…` (B); araçlar `a1` (A'da Volkswagen Passat kombi), `b1` (B'de BMW 320d sedan). Hazırlık `postgres` rolüyle yapılır (`insert into auth.users (id, email)`, galeriler, üyelikler, araçlar). Sonra `set local role authenticated; set local request.jwt.claims = '{"sub":"<id>","role":"authenticated"}'` ile kullanıcı değiştirilir.

```sql
select plan(11);
-- staff A
select results_eq('select id from public.vehicles', $$values ('<a1>'::uuid)$$, 'staff sees only own gallery vehicles');
select lives_ok($$insert into public.vehicles (id, gallery_id, make, model, body_type) values ('<a2>', '<A>', 'Audi', 'A4', 'sedan')$$, 'staff can add a vehicle to own gallery');
select throws_ok($$insert into public.vehicles (id, gallery_id, make, model, body_type) values ('<a3>', '<B>', 'Audi', 'A6', 'sedan')$$, '42501', null, 'staff cannot add a vehicle to another gallery');
select is_empty($$update public.galleries set name = 'x' returning id$$, 'staff cannot rename the gallery');
select throws_ok($$insert into public.photos (id, vehicle_id, gallery_id, slot, original_path, captured_at) values ('<p1>', '<b1>', '<A>', 'front', '<A>/<b1>/front.jpg', now())$$, '23503', null, 'photo cannot point at another gallery''s vehicle');
select lives_ok($$insert into public.photos (id, vehicle_id, gallery_id, slot, original_path, captured_at) values ('<p2>', '<a1>', '<A>', 'front', '<A>/<a1>/front.jpg', now())$$, 'staff can add a photo to own vehicle');
select throws_ok($$insert into public.photos (id, vehicle_id, gallery_id, slot, original_path, captured_at) values ('<p3>', '<a1>', '<A>', 'front', '<A>/<a1>/front.jpg', now())$$, '23505', null, 'one photo per vehicle and slot');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('originals', '<A>/<a1>/front.jpg')$$, 'member can upload under own gallery folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('originals', '<B>/<b1>/front.jpg')$$, '42501', null, 'member cannot upload under another gallery folder');
-- owner A
select isnt_empty($$update public.galleries set name = 'Galerie A2' returning id$$, 'owner can rename the gallery');
-- anon
select is_empty('select id from public.vehicles', 'anon sees no vehicles');
select * from finish();
```

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `npx supabase test db`
Expected: FAIL (tablolar yok).

- [ ] **Adım 4: `supabase/migrations/20261109000001_core.sql`'i yaz**

Yukarıdaki Interfaces bloğundaki tablolar, enum'lar, tetikleyici, `private` fonksiyonları, RLS politikaları, `originals` kovası (`insert into storage.buckets (id, name, public) values ('originals', 'originals', false)`) ve Storage politikaları.

- [ ] **Adım 5: Testlerin geçtiğini gör**

Run: `npx supabase db reset && npx supabase test db`
Expected: `core.test.sql .. ok`, 11 test geçer.

- [ ] **Adım 6: Kullanıcıya devret**

Önerilen mesaj: `add-supabase-core-schema-rls`.

---

### Task 2: Yönetim fonksiyonları, katalog, geliştirme verisi ve kodla davet

**Files:**
- Create: `supabase/migrations/20261109000002_admin.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/templates/invite.html`, `supabase/templates/recovery.html`
- Modify: `supabase/config.toml`
- Test: `supabase/tests/database/admin.test.sql`, `supabase/tests/integration/auth-codes.test.ts`, `supabase/tests/integration/helpers.ts`

**Interfaces:**
- Consumes: Task 1 şeması.
- Produces:
  - `public.admin_create_gallery(p_name text, p_owner_email text) returns uuid`: galeriyi ve sahip üyeliğini açar.
  - `public.admin_add_member(p_gallery_id uuid, p_email text, p_role public.member_role) returns void`.
  - İkisi de `security definer`, `set search_path = ''`. `public`, `anon` ve `authenticated` rollerinden `execute` yetkisi alınır; panelin SQL editörü (`postgres`) çağırır. E-posta `auth.users`'ta yoksa: `raise exception 'no user with email %; invite the user first', p_email`.
  - Geliştirme hesapları (sadece yerel, `seed.sql`): `owner@bambu.test` ve `staff@bambu.test` "Testgalerie"de; `other@bambu.test` "Andere Galerie"de. Hepsinin şifresi `dev-password-1`. Hepsi `auth.users` ve `auth.identities`'e e-postası onaylı olarak yazılır, şifre `crypt(..., gen_salt('bf'))` ile.
  - Katalog: mobile.de'nin yazımıyla Almanya'da yaygın yaklaşık 35 marka (Audi, BMW, Mercedes-Benz, Volkswagen, Opel, Ford, Skoda, Seat, Cupra, Toyota, Hyundai, Kia, Renault, Peugeot, Citroën, Dacia, Fiat, Mazda, Nissan, Volvo, Mini, Porsche, Tesla, Suzuki, Honda, MG, BYD, Jeep, Land Rover, Mitsubishi, Smart, Subaru, Alfa Romeo, Polestar, DS) ve her biri için yaygın 5–15 model.
  - `config.toml`: `[auth] enable_signup = false`, `minimum_password_length = 8`; `[auth.email] otp_length = 6`, `otp_expiry = 86400` (davet kodu 24 saat geçerli; aynı süre şifre sıfırlama kodu için de geçerli); `[auth.email.template.invite]` ve `[auth.email.template.recovery]` için Almanca konu ve `content_path`. İki şablon da bağlantı yerine `{{ .Token }}` kodunu gösterir.
  - `helpers.ts`: `env()` → `{ url, anonKey, serviceKey }` (`API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` ortam değişkenlerinden), `latestCode(email: string): Promise<string>`. Kod, yerel mail kutusunun API'sinden (Mailpit: `/api/v1/search?query=to:<email>` ve `/api/v1/message/<ID>`; adres `supabase status`'ta) son mesajdaki 6 haneli sayıdır.

- [ ] **Adım 1: Başarısız veritabanı testlerini yaz (`admin.test.sql`)**

```sql
select plan(6);
-- postgres
insert into auth.users (id, email) values ('<c0>', 'new-owner@bambu.test'), ('<c1>', 'new-staff@bambu.test');
select isnt(public.admin_create_gallery('Autohaus Test', 'new-owner@bambu.test'), null, 'admin_create_gallery returns the new gallery id');
select results_eq($$select m.role::text from public.gallery_members m join public.galleries g on g.id = m.gallery_id where g.name = 'Autohaus Test'$$, $$values ('owner')$$, 'the owner membership is created');
select lives_ok($$select public.admin_add_member((select id from public.galleries where name = 'Autohaus Test'), 'new-staff@bambu.test', 'staff')$$, 'admin_add_member adds staff');
select throws_ok($$select public.admin_create_gallery('X', 'nobody@bambu.test')$$, 'P0001', 'no user with email nobody@bambu.test; invite the user first', 'unknown email is rejected');
-- authenticated
select throws_ok($$select public.admin_create_gallery('Y', 'new-owner@bambu.test')$$, '42501', null, 'signed-in users cannot call admin functions');
select isnt_empty('select 1 from public.makes', 'signed-in users can read the make list');
select * from finish();
```

- [ ] **Adım 2: Başarısız entegrasyon testlerini yaz (`auth-codes.test.ts`, `node:test`)**

```ts
test('invite code from the email lets the user set a password and sign in', async () => {
  // service-role client: auth.admin.inviteUserByEmail('invited@bambu.test')
  const code = await latestCode('invited@bambu.test')
  // anon client: verifyOtp({ email, token: code, type: 'invite' }) → session; updateUser({ password: 'new-password-1' })
  // fresh anon client: signInWithPassword({ email, password: 'new-password-1' }) → error === null
})
test('recovery code from the email sets a new password', async () => {
  // anon: resetPasswordForEmail('staff@bambu.test'); code = await latestCode(...)
  // verifyOtp({ type: 'recovery' }); updateUser({ password: 'dev-password-2' }); signInWithPassword succeeds with it
  // after: restore 'dev-password-1' via auth.admin.updateUserById
})
```

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `npm run db:reset && npm run db:test`, sonra `npm run test:int`
Expected: `admin.test.sql` FAIL (fonksiyonlar yok); `auth-codes.test.ts` FAIL (e-postada kod yok).

- [ ] **Adım 4: Migration'ı, seed'i, şablonları ve `config.toml`'u yaz**

Şablonlarda 6 haneli kod büyük yazılır, altında kodun 24 saat geçerli olduğu söylenir. Metin Almanca ve sade tutulur (/no-slop-ui). `config.toml` değişikliği yığının yeniden başlatılmasını gerektirir: `npx supabase stop && npx supabase start`.

- [ ] **Adım 5: Testlerin geçtiğini gör**

Run: `npm run db:reset && npm run db:test && npm run test:int`
Expected: `core` ve `admin` dosyaları ok (17 test); `auth-codes.test.ts` 2 test geçer.

- [ ] **Adım 6: Kullanıcıya devret**

Önerilen mesaj: `add-admin-functions-catalog-invite-codes`.

---

### Task 3: Hesap silme fonksiyonu

**Files:**
- Create: `supabase/functions/delete-account/index.ts`
- Test: `supabase/tests/integration/delete-account.test.ts`

**Interfaces:**
- Consumes: Task 2'deki `helpers.ts` ve geliştirme hesapları.
- Produces: `POST /functions/v1/delete-account`, `Authorization: Bearer <access token>` ile çağrılır. Yanıtlar: 200 `{ "deleted": true }`, 401 `{ "error": "unauthorized" }`, 405 (POST dışı). Fonksiyon kullanıcıyı token'dan bulur ve servis anahtarıyla `auth.admin.deleteUser` çağırır (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `jsr:@supabase/supabase-js@2`). Üyelikler cascade ile silinir; galerinin araçları kalır (`created_by` null olur). Mobil taraf `supabase.functions.invoke('delete-account', { method: 'POST' })` ile çağırır.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('deletes the calling user and their gallery membership', async () => {
  // admin: createUser({ email: 'leaving@bambu.test', password: 'pw-12345678', email_confirm: true }); admin_add_member(Testgalerie, ..., 'staff') (service role rpc)
  // sign in as the user, fetch(`${url}/functions/v1/delete-account`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: anonKey } })
  assert.equal(res.status, 200)
  // admin.getUserById(id) → error; gallery_members has no row for id (service role select)
})
test('rejects a request without a valid token', async () => {
  // fetch(..., { method: 'POST', headers: { apikey: anonKey } })
  assert.equal(res.status, 401)
})
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `npm run test:int`
Expected: `delete-account.test.ts` FAIL (404).

- [ ] **Adım 3: `index.ts`'i yaz**

`Deno.serve` ile; token `Authorization` başlığından alınır, `auth.getUser(token)` ile doğrulanır. Fonksiyonların `supabase start` ile servis edilip edilmediği kontrol edilir; edilmiyorsa testler sırasında `npx supabase functions serve` arka planda çalıştırılır.

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: `npm run test:int`
Expected: 4 entegrasyon testi geçer.

- [ ] **Adım 5: Kullanıcıya devret**

Önerilen mesaj: `add-delete-account-function`.

---

### Task 4: Mobil uygulama iskeleti ve yerel veritabanı

**Files:**
- Create: `apps/mobile/` (`npx create-expo-app@latest apps/mobile --template default@sdk-58 --yes --no-agents-md`; şablonun demo ekranları ve bileşenleri silinir)
- Create: `apps/mobile/.env.example` (`EXPO_PUBLIC_SUPABASE_URL=`, `EXPO_PUBLIC_SUPABASE_ANON_KEY=`)
- Create: `apps/mobile/src/lib/database.types.ts` (`npm run db:types`)
- Create: `apps/mobile/src/domain/slots.ts`, `apps/mobile/src/domain/vehicle.ts`
- Create: `apps/mobile/src/local/db.ts`, `vehicles.ts`, `photos.ts`, `catalog.ts`, `outbox.ts`, `meta.ts`
- Test: `apps/mobile/src/local/testDb.ts` (sadece testlerde), `apps/mobile/src/local/local.test.ts`

**Interfaces:**
- Produces:
  - `app.json`: `name: "bambu-car-app"`, `slug: "bambu-car-app"`, `scheme: "bambucarapp"`, `orientation: "portrait"`, `ios.bundleIdentifier` ve `android.package`: `"com.bambugames.carapp"`.
  - Paketler: `npx expo install expo-sqlite expo-file-system expo-network expo-crypto expo-localization`, `npm i @supabase/supabase-js@2.119.0 i18next@27 react-i18next@18`, `npx expo install jest-expo jest @types/jest -- --save-dev`, `npm i -D @types/node` (testlerdeki `node:sqlite` tipleri için). Jest ayarı `package.json`'da: `"preset": "jest-expo"`, `"testPathIgnorePatterns": ["/node_modules/", "\\.int\\.test\\.ts$"]`; scriptler `"test": "jest"`, `"test:int": "jest --testPathIgnorePatterns /node_modules/ --testMatch '**/*.int.test.ts'"`.
  - `slots.ts`: `EXTERIOR_SLOTS = ['front_left_45', 'front', 'front_right_45', 'right', 'rear_right_45', 'rear', 'rear_left_45', 'left']` (yürüme sırası, `tools/templates` ile aynı kimlikler); `DETAIL_SLOTS = ['detail_wheel', 'detail_headlights', 'detail_taillights', 'detail_trunk_open', 'detail_engine', 'detail_roof', 'detail_other']`; `INTERIOR_SLOTS = ['interior_cockpit', 'interior_console', 'interior_instruments', 'interior_front_seats', 'interior_rear_seats', 'interior_door', 'interior_trunk', 'interior_headliner', 'interior_other']`; `type Slot`; `isExterior(slot: Slot): boolean`. Task 1'deki `slot` check'i bu 24 kimliktir.
  - `vehicle.ts`: `type BodyType = 'sedan' | 'kombi' | 'suv' | 'hatchback' | 'other'`, `type VehicleStatus = 'draft' | 'shooting' | 'processing' | 'ready' | 'archived'`, `type Vehicle = { id: string; galleryId: string; make: string; model: string; bodyType: BodyType; status: VehicleStatus; details: Record<string, unknown>; createdAt: string; updatedAt: string }`.
  - `db.ts`: `type SqlValue = string | number | null`; `interface Db { exec(sql: string): Promise<void>; run(sql: string, params?: SqlValue[]): Promise<void>; all<T>(sql: string, params?: SqlValue[]): Promise<T[]>; get<T>(sql: string, params?: SqlValue[]): Promise<T | null>; transaction(fn: () => Promise<void>): Promise<void> }`; `migrate(db: Db): Promise<void>` (`PRAGMA user_version` ile sürüm); `openUserDb(userId: string): Promise<Db>` (expo-sqlite, dosya `user-${userId}.db`, açılınca `migrate`); `deleteUserDb(userId: string): Promise<void>`.
  - Yerel tablolar: `vehicles` (Task 1'deki sütunlar, `details` JSON metni), `photos (id, vehicle_id, gallery_id, slot, local_uri, original_path, captured_at, capture, upload_state, unique (vehicle_id, slot))`; `upload_state`: `'pending' | 'uploading' | 'uploaded' | 'failed' | 'remote'`. Ayrıca `catalog_makes (id, name)`, `catalog_models (id, make_id, name)`, `outbox (id integer primary key autoincrement, kind text, entity_id text, attempts integer not null default 0, next_attempt_at integer not null, last_error text, created_at integer not null, unique (kind, entity_id))` ve `meta (key text primary key, value text)`.
  - `vehicles.ts`: `createVehicle(db, input: { id: string; galleryId: string; make: string; model: string; bodyType: BodyType; now: string }): Promise<Vehicle>` (taslak araç ve kuyrukta `('vehicle', id)`, tek işlemde); `getVehicle(db, id): Promise<Vehicle | null>`; `listVehicles(db, galleryId): Promise<VehicleListItem[]>` (arşiv hariç, yeniden eskiye; `VehicleListItem = Vehicle & { exteriorDone: number; pendingUploads: number }`); `upsertRemoteVehicle(db, v: Vehicle): Promise<void>`.
  - `photos.ts`: `type UploadState = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'remote'`; `type PhotoRow = { id: string; vehicleId: string; galleryId: string; slot: Slot; localUri: string | null; originalPath: string | null; capturedAt: string; capture: Record<string, unknown>; uploadState: UploadState }`; `type RemotePhoto = { id: string; vehicleId: string; galleryId: string; slot: Slot; originalPath: string; capturedAt: string }`; `savePhoto(db, input: { id: string; vehicleId: string; galleryId: string; slot: Slot; localUri: string; capturedAt: string; capture: Record<string, unknown> }): Promise<{ photoId: string }>` (aynı adımda satır varsa onun kimliği korunur, dosya ve zaman güncellenir, durum `pending` olur; araç `draft` ise `shooting` olur ve araç da kuyruğa girer; fotoğraf kuyruğa girer); `listPhotos(db, vehicleId): Promise<PhotoRow[]>`; `setUploadState(db, photoId, state, originalPath?: string): Promise<void>`; `upsertRemotePhoto(db, p: RemotePhoto): Promise<void>`. M1b'deki çekim `savePhoto`'yu çağıracak.
  - `catalog.ts`: `replaceCatalog(db, makes: { id: number; name: string }[], models: { id: number; makeId: number; name: string }[])`, `searchMakes(db, query: string)`, `searchModels(db, makeId: number, query: string)` (büyük-küçük harf duyarsız, ilk 50 sonuç), `catalogIsEmpty(db): Promise<boolean>`.
  - `outbox.ts`: `type OutboxItem = { id: number; kind: 'vehicle' | 'photo'; entityId: string; attempts: number; nextAttemptAt: number; lastError: string | null }`; `enqueue(db, kind, entityId, now: number)` (aynı varlık için bekleyen tek kayıt; varsa dokunmaz); `nextDue(db, now: number): Promise<OutboxItem | null>` (ekleme sırasına göre, `next_attempt_at <= now`); `complete(db, id)`; `fail(db, id, error: string, now: number)`; `backoffMs(attempts: number): number` = `min(5000 * 2 ** (attempts - 1), 600000)`; `pendingCount(db): Promise<number>` (tüm bekleyenler); `counts(db): Promise<{ pending: number; failed: number }>` (`attempts = 0` olanlar bekleyen, `attempts > 0` olanlar başarısız sayılır); `hasPending(db, kind, entityId): Promise<boolean>`.
  - `meta.ts`: `getMeta(db, key): Promise<string | null>`, `setMeta(db, key, value: string)`.
  - `testDb.ts`: `memoryDb(path = ':memory:'): Db` (Node'un `node:sqlite` `DatabaseSync`'i üzerinde) ve `closeDb(db)`.

- [ ] **Adım 1: Uygulamayı oluştur ve paketleri kur**

Run: Yukarıdaki `create-expo-app`, `expo install` ve `npm i` komutları; ardından `npm run db:types` (kökten).
Expected: `cd apps/mobile && npx tsc --noEmit` hatasız biter.

- [ ] **Adım 2: Başarısız testleri yaz (`local.test.ts`)**

```ts
test('createVehicle stores a draft vehicle and queues it for upload', async () => {
  const v = await createVehicle(db, { id: 'v1', galleryId: 'g1', make: 'Volkswagen', model: 'Passat', bodyType: 'kombi', now: '2026-11-09T10:00:00.000Z' })
  expect(v.status).toBe('draft')
  expect(await nextDue(db, Date.now())).toMatchObject({ kind: 'vehicle', entityId: 'v1' })
})
test('savePhoto replaces the photo of the same slot and keeps one row', async () => {
  const first = await savePhoto(db, { id: 'p1', vehicleId: 'v1', galleryId: 'g1', slot: 'front', localUri: 'file:///a.jpg', capturedAt: '2026-11-09T10:01:00.000Z', capture: {} })
  const second = await savePhoto(db, { id: 'p2', vehicleId: 'v1', galleryId: 'g1', slot: 'front', localUri: 'file:///b.jpg', capturedAt: '2026-11-09T10:02:00.000Z', capture: {} })
  expect(second.photoId).toBe(first.photoId)
  expect((await listPhotos(db, 'v1')).map((p) => p.localUri)).toEqual(['file:///b.jpg'])
})
test('savePhoto moves a draft vehicle to shooting', async () => { /* status === 'shooting' */ })
test('listVehicles counts captured exterior slots and pending uploads', async () => {
  // front + left + detail_wheel saved → exteriorDone 2, pendingUploads 3
})
test('outbox returns items in insertion order and skips ones waiting for retry', async () => {
  // enqueue vehicle v1, photo p1; fail(v1 item, 'x', 0) → nextDue(db, 1000) is the photo item
})
test('fail backs off 5s, 10s, 20s and caps at 10 minutes', () => {
  expect([1, 2, 3, 10].map(backoffMs)).toEqual([5000, 10000, 20000, 600000])
})
test('enqueue keeps one pending item per entity', async () => { /* enqueue v1 twice → pendingCount 1 */ })
test('pending outbox items survive reopening the database', async () => {
  // memoryDb(tmpFile) → createVehicle → closeDb → memoryDb(tmpFile) → pendingCount === 1
})
```

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/local`
Expected: FAIL (modüller yok).

- [ ] **Adım 4: `slots.ts`, `vehicle.ts` ve `src/local/*`'ı yaz**

`testDb.ts`, `transaction`'ı `BEGIN`/`COMMIT`/`ROLLBACK` ile kurar. `node:sqlite` jest-expo ortamında yüklenmezse test dosyasının başına `/** @jest-environment node */` eklenir. Uygulamadaki `openUserDb` expo-sqlite'ın `openDatabaseAsync`, `execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync` ve `withTransactionAsync` fonksiyonlarını sarar (`// ponytail: özel olmayan işlem; eşzamanlı yazma artarsa withExclusiveTransactionAsync`).

- [ ] **Adım 5: Testlerin geçtiğini gör**

Run: `cd apps/mobile && npx jest src/local`
Expected: 8 test geçer.

- [ ] **Adım 6: Kullanıcıya devret**

Önerilen mesaj: `add-mobile-app-local-db`.

---

### Task 5: Senkronizasyon motoru

**Files:**
- Create: `apps/mobile/src/sync/remote.ts`, `apps/mobile/src/sync/sync.ts`
- Test: `apps/mobile/src/sync/fakeRemote.ts` (sadece testlerde), `apps/mobile/src/sync/sync.test.ts`, `apps/mobile/src/sync/remote.int.test.ts`

**Interfaces:**
- Consumes: Task 4'teki `Db`, `outbox`, `vehicles`, `photos`, `catalog`; Task 1 şeması ve Storage yolu.
- Produces:
  - `remote.ts` (`RemotePhoto` Task 4'teki `photos.ts`'ten gelir): `interface Remote { upsertVehicle(v: Vehicle): Promise<void>; uploadPhoto(path: string, localUri: string): Promise<void>; upsertPhoto(p: RemotePhoto & { capture: Record<string, unknown> }): Promise<void>; fetchVehicles(galleryId: string): Promise<Vehicle[]>; fetchPhotos(galleryId: string): Promise<RemotePhoto[]>; fetchCatalog(): Promise<{ makes: { id: number; name: string }[]; models: { id: number; makeId: number; name: string }[] }> }`; `createRemote(client: SupabaseClient<Database>, readFile: (uri: string) => Promise<ArrayBuffer>): Remote`. Yükleme `storage.from('originals').upload(path, bytes, { contentType: 'image/jpeg', upsert: true })`, satırlar `upsert(..., { onConflict: 'id' })`. Uygulamada `readFile = (uri) => new File(uri).arrayBuffer()` (expo-file-system).
  - `sync.ts`: `photoPath(galleryId: string, vehicleId: string, slot: Slot): string` = `` `${galleryId}/${vehicleId}/${slot}.jpg` ``; `syncOnce(db: Db, remote: Remote, galleryId: string, now: () => number): Promise<{ pushed: number; failed: number; pending: number }>`. Önce vadesi gelen kuyruk kayıtlarını sırayla iter. Araç kaydı için yerel satırı `upsertVehicle`'a verir. Fotoğraf için durumu `uploading` yapar, dosyayı yükler, satırı yazar ve durumu `uploaded` yapar (`original_path` ile); hata olursa durum `failed` olur ve kayıt `fail` ile bekletilir. Sonra katalog boşsa kataloğu, ardından araçları ve fotoğraf bilgilerini çeker. Kuyrukta bekleyen kaydı olan araç ve fotoğraflar çekilen veriyle ezilmez. Başka cihazdan gelen fotoğraflar `remote` durumunda, dosyasız kaydedilir.

- [ ] **Adım 1: Başarısız birim testlerini yaz (`sync.test.ts`, `FakeRemote` ile)**

`FakeRemote` çağrıları sırasıyla kaydeder, sunucu tarafını bellekte tutar ve belirli bir çağrıyı bir kez başarısız yapabilir.

```ts
test('pushes a new vehicle before its photo', async () => {
  // createVehicle v1, savePhoto front → syncOnce → fake.calls.map(c => c.name) starts with ['upsertVehicle', 'uploadPhoto', 'upsertPhoto']
})
test('uploads the photo file then upserts its row and marks it uploaded', async () => {
  // listPhotos(v1)[0] → uploadState 'uploaded', originalPath 'g1/v1/front.jpg'
})
test('retries a photo whose row upsert failed after the file uploaded', async () => {
  // fake.failOnce('upsertPhoto'); syncOnce at t=0 → photo 'failed', pending 1
  // syncOnce at t=4999 → nothing pushed; syncOnce at t=5000 → uploaded
  // fake.photos has exactly one row for (v1, front); fake.files has exactly one 'g1/v1/front.jpg'
})
test('keeps failed items for later and continues with others', async () => { /* v1 fails, v2 pushed */ })
test('pull adds vehicles created on another device', async () => { /* fake has v9 → listVehicles includes v9 */ })
test('pull does not overwrite a vehicle with pending local changes', async () => {
  // local v1 queued with model 'Passat'; fake has v1 with model 'Golf'; fake.failOnce('upsertVehicle')
  // after syncOnce → getVehicle(v1).model === 'Passat'
})
```

- [ ] **Adım 2: Başarısız entegrasyon testini yaz (`remote.int.test.ts`, `@jest-environment node`)**

```ts
test('real remote stores a vehicle and photo the gallery can read back and other galleries cannot', async () => {
  // anon client signed in as staff@bambu.test; createRemote(client, (uri) => readFile(fileURLToPath(uri)) as ArrayBuffer)
  // upsertVehicle, uploadPhoto(photoPath(...), fixture JPEG written to a temp file), upsertPhoto
  // fetchVehicles(galleryId) includes the vehicle; fetchPhotos includes the photo; storage download returns the same bytes
  // client signed in as other@bambu.test: fetchVehicles(galleryId) is empty
})
```

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/sync`, sonra kökten `npm run test:int:mobile`
Expected: FAIL (modüller yok).

- [ ] **Adım 4: `remote.ts` ve `sync.ts`'i yaz**

Araçların tamamı her senkronizasyonda çekilir (`// ponytail: tam çekim; araç sayısı yüzleri geçince updated_at ile artımlı çekim`).

- [ ] **Adım 5: Testlerin geçtiğini gör**

Run: Adım 3'teki komutlar.
Expected: `sync.test.ts` 6 test, `remote.int.test.ts` 1 test geçer; `npx jest` tüm birim testleri geçer.

- [ ] **Adım 6: Kullanıcıya devret**

Önerilen mesaj: `add-sync-engine`.

---

### Task 6: Giriş, davet, şifre sıfırlama ve hesap ekranları

**Files:**
- Create: `apps/mobile/src/lib/supabase.ts`, `apps/mobile/src/lib/session.tsx`, `apps/mobile/src/lib/i18n.ts`, `apps/mobile/src/locales/de.json`, `tr.json`, `en.json`
- Create: `apps/mobile/src/ui/theme.ts`, `apps/mobile/src/ui/Button.tsx`, `TextField.tsx`, `Screen.tsx`, `Notice.tsx`
- Create: `apps/mobile/src/domain/validation.ts`, `apps/mobile/src/domain/authErrors.ts`
- Create: `apps/mobile/src/app/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `sign-in.tsx`, `accept-invite.tsx`, `reset-password.tsx`, `src/app/(app)/_layout.tsx`, `src/app/(app)/index.tsx`, `src/app/(app)/account.tsx`
- Test: `apps/mobile/src/domain/validation.test.ts`, `authErrors.test.ts`, `apps/mobile/src/lib/i18n.test.ts`

**Interfaces:**
- Consumes: Task 3 fonksiyonu; Task 4'teki `openUserDb`, `deleteUserDb`, `listVehicles`, `getMeta` ve `setMeta`.
- Produces:
  - `supabase.ts`: `import 'expo-sqlite/localStorage/install'`; `supabase = createClient<Database>(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { storage: localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })`; uygulama öne gelince `startAutoRefresh`, arkaya gidince `stopAutoRefresh`.
  - `session.tsx`: `SessionProvider` ve `useSession(): { status: 'loading' | 'signedOut' | 'signedIn'; user: User | null; membership: { galleryId: string; galleryName: string; role: 'owner' | 'staff' } | null; db: Db | null; signOut(): Promise<void>; deleteAccount(): Promise<void> }`. Girişte kullanıcının veritabanı açılır, üyelik çekilir ve `meta`'da `membership` olarak saklanır; çevrimdışı açılışta saklanan üyelik kullanılır. `signOut` yerel veritabanını silmez. `deleteAccount` fonksiyonu çağırır, sonra yerel veritabanını siler ve çıkış yapar.
  - `validation.ts`: `isValidEmail(s: string): boolean`, `normalizeCode(s: string): string | null` (boşlukları atar; tam 6 rakam değilse `null`), `passwordProblem(s: string): 'tooShort' | null` (8 karakterden kısa ise `'tooShort'`).
  - `authErrors.ts`: `authErrorKey(error: unknown): string`: `code` `'invalid_credentials'` ise `'auth.errors.invalidCredentials'`, `'otp_expired'` ise `'auth.errors.codeExpired'`; `name` `'AuthRetryableFetchError'` veya `TypeError` ise `'common.offline'`; diğerleri `'auth.errors.generic'`.
  - `theme.ts`: renkler `{ background: '#FFFFFF', surface: '#F4F4F5', border: '#E4E4E7', text: '#18181B', textMuted: '#52525B', accent: '#0B57D0', danger: '#B3261E', pending: '#8A5A00' }`; boşluklar `[4, 8, 12, 16, 24, 32]`; köşe yarıçapı 8; yazı boyutları `{ small: 14, body: 16, title: 22 }`; sistem yazı tipi. `accent` yalnızca ana eylemler, `danger` hata ve silme, `pending` bekleyen yükleme için kullanılır.
  - Rotalar: kök `_layout.tsx` sağlayıcıları sarar ve `Stack.Protected guard={status === 'signedIn'}` ile `(app)`, `guard={status === 'signedOut'}` ile `(auth)` gruplarını açar. `(app)/index.tsx` araç listesidir: bu görevde `listVehicles` sonuçları ve boş durum; "Neues Fahrzeug" Task 7'de gelir. `(app)/account.tsx` e-postayı, galeri adını ve rolü gösterir, "Abmelden" ve "Konto löschen" düğmelerini içerir. Silme onayı geri alınamayacağını söyler; bekleyen yükleme varsa sayısını da gösterir ve internet ister.
  - Üyeliği olmayan hesap için kendi ekranı vardır: hesabın bir galeriye bağlı olmadığını söyler ve çıkış düğmesi gösterir.

- [ ] **Adım 1: `no-slop-ui` skill'ini yükle**

Expected: kurallar bu görevin ve Task 7'nin tüm ekran ve metinlerine uygulanır.

- [ ] **Adım 2: Başarısız testleri yaz**

```ts
test('isValidEmail accepts a normal address and rejects a broken one', () => {
  expect(isValidEmail('staff@bambu.test')).toBe(true)
  expect(isValidEmail('staff@')).toBe(false)
})
test('normalizeCode strips spaces and requires exactly six digits', () => {
  expect(normalizeCode(' 123 456 ')).toBe('123456')
  expect(normalizeCode('12345')).toBeNull()
  expect(normalizeCode('12a456')).toBeNull()
})
test('passwordProblem requires at least 8 characters', () => {
  expect(passwordProblem('1234567')).toBe('tooShort')
  expect(passwordProblem('12345678')).toBeNull()
})
test('authErrorKey maps Supabase errors to messages', () => {
  expect(authErrorKey({ code: 'invalid_credentials' })).toBe('auth.errors.invalidCredentials')
  expect(authErrorKey({ code: 'otp_expired' })).toBe('auth.errors.codeExpired')
  expect(authErrorKey(new TypeError('Network request failed'))).toBe('common.offline')
  expect(authErrorKey({ code: 'something_else' })).toBe('auth.errors.generic')
})
test('every locale has exactly the German keys', () => {
  // flatten keys of de, tr, en → tr and en key lists equal de's
})
```

- [ ] **Adım 3: Testlerin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/domain src/lib`
Expected: FAIL (modüller yok).

- [ ] **Adım 4: Modülleri, sağlayıcıyı ve ekranları yaz**

Davet ekranı e-posta, 6 haneli kod ve yeni şifreyi alır: `verifyOtp({ email, token, type: 'invite' })` ve ardından `updateUser({ password })`. Şifre sıfırlama iki adımlıdır: önce `resetPasswordForEmail`, sonra kod ve yeni şifreyle `verifyOtp({ type: 'recovery' })` ve `updateUser`. Hatalar `authErrorKey` ile i18n metnine çevrilir. Dil `expo-localization`'dan seçilir; desteklenmiyorsa Almanca. `apps/mobile/.env` `npx supabase status -o env`'den doldurulur (git dışı).

- [ ] **Adım 5: Testlerin geçtiğini gör**

Run: `cd apps/mobile && npx jest`
Expected: tüm birim testleri geçer (Task 4–6).

- [ ] **Adım 6: Simülatörlerde doğrula**

Run: `DEVELOPER_DIR=<Xcode 26.6>/Contents/Developer LANG=en_US.UTF-8 npx expo run:ios` ve `adb reverse tcp:54321 tcp:54321 && npx expo run:android`
Expected: iki platformda da `staff@bambu.test` ile giriş yapılır ve boş araç listesi görünür. Yanlış şifre "invalidCredentials" metnini, ağ kapalıyken giriş "offline" metnini gösterir. Panelden davet edilen yeni bir adresle davet ekranı kodu kabul eder ve hesap açılır. Şifre sıfırlama kodla çalışır. Hesap ekranından çıkış ve hesap silme çalışır. Ekran görüntüleri alınıp /no-slop-ui kurallarına göre kontrol edilir (hizalama, renk anlamı, metin).

- [ ] **Adım 7: Kullanıcıya devret**

Önerilen mesaj: `add-auth-account-screens`.

---

### Task 7: Araç ekranları ve senkronizasyonun bağlanması

**Files:**
- Create: `apps/mobile/src/app/(app)/vehicles/new.tsx`, `apps/mobile/src/app/(app)/vehicles/[id].tsx`
- Create: `apps/mobile/src/sync/scheduler.ts`, `apps/mobile/src/sync/SyncProvider.tsx`, `apps/mobile/src/domain/progress.ts`
- Modify: `apps/mobile/src/app/(app)/index.tsx`, `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/src/locales/*.json`
- Test: `apps/mobile/src/domain/progress.test.ts`, `apps/mobile/src/sync/scheduler.test.ts`

**Interfaces:**
- Consumes: Task 4 (`createVehicle`, `listVehicles`, `listPhotos`, `searchMakes`, `searchModels`, `counts`), Task 5 (`syncOnce`, `createRemote`), Task 6 (`useSession`, UI bileşenleri).
- Produces:
  - `progress.ts`: `missingExterior(photos: { slot: Slot }[]): Slot[]` (yürüme sırasında eksik dış açılar); `uploadSummary(s: { pending: number; failed: number; online: boolean }): { key: string; count: number } | null`. Bekleyen veya hatalı kayıt yoksa `null`. Çevrimdışıysa `{ key: 'sync.offlinePending', count: pending + failed }`. Çevrimiçiyse, hatalı kayıt varsa `{ key: 'sync.retrying', count: failed }`, yoksa `{ key: 'sync.uploading', count: pending }`.
  - `scheduler.ts`: `createSyncScheduler(run: () => Promise<void>): { request(): void; idle(): Promise<void> }`. Aynı anda tek çalışma olur; çalışma sürerken gelen istekler bittikten sonra tek bir ek çalışmada birleşir.
  - `SyncProvider.tsx` ve `useSync(): { pending: number; failed: number; online: boolean; syncing: boolean; request(): void }`. Senkronizasyon şu durumlarda tetiklenir: giriş sonrası, uygulama öne gelince (`AppState` `active`), ağ geri gelince (`addNetworkStateListener`), her yerel değişiklikten sonra ve uygulama öndeyken bekleyen kayıt varsa 30 saniyede bir.
  - Kasa tipi etiketleri (de): `sedan` → "Limousine (Stufenheck)", `hatchback` → "Schrägheck", `kombi` → "Kombi", `suv` → "SUV / Geländewagen", `other` → "Andere".
  - Ekranlar:
    - Yeni araç: marka (katalogda arama, bulunamazsa yazılanı kullanma), model (seçilen markanın modelleri, bulunamazsa yazılanı kullanma) ve kasa tipi. Kayıtta `expo-crypto` `randomUUID()` kullanılır, ardından araç ekranına gidilir.
    - Araç ekranı: başlıkta marka, model, kasa tipi ve durum. Ardından "Außen" (8 zorunlu), "Details" ve "Innenraum" bölümleri. Her adımda durum gösterilir: eksik, cihazda kayıtlı, yükleniyor, yüklendi, başka cihazda çekildi, yükleme başarısız. Eksik dış açılar sayıyla söylenir. Adımlara dokunarak çekim M1b'de gelir.
    - Liste: "Neues Fahrzeug" düğmesi; her araçta dış açı ilerlemesi (`exteriorDone`/8) ve bekleyen yükleme sayısı; başlığın altında `uploadSummary` metni. `null` ise hiçbir şey gösterilmez.

- [ ] **Adım 1: Başarısız testleri yaz**

```ts
test('missingExterior lists missing slots in walking order', () => {
  expect(missingExterior([{ slot: 'front_left_45' }, { slot: 'front' }, { slot: 'detail_wheel' }]))
    .toEqual(['front_right_45', 'right', 'rear_right_45', 'rear', 'rear_left_45', 'left'])
})
test('uploadSummary reports offline, retrying and uploading states', () => {
  expect(uploadSummary({ pending: 0, failed: 0, online: true })).toBeNull()
  expect(uploadSummary({ pending: 2, failed: 1, online: false })).toEqual({ key: 'sync.offlinePending', count: 3 })
  expect(uploadSummary({ pending: 2, failed: 1, online: true })).toEqual({ key: 'sync.retrying', count: 1 })
  expect(uploadSummary({ pending: 2, failed: 0, online: true })).toEqual({ key: 'sync.uploading', count: 2 })
})
test('requests during a run coalesce into one extra run', async () => {
  // run resolves on demand; request() ×3 while first run is pending → run called exactly 2 times in total
})
test('a request while idle runs immediately', async () => { /* run called once */ })
```

- [ ] **Adım 2: Testlerin başarısız olduğunu gör**

Run: `cd apps/mobile && npx jest src/domain/progress.test.ts src/sync/scheduler.test.ts`
Expected: FAIL (modüller yok).

- [ ] **Adım 3: Modülleri ve ekranları yaz**

- [ ] **Adım 4: Testlerin geçtiğini gör**

Run: `cd apps/mobile && npx jest`
Expected: tüm birim testleri geçer.

- [ ] **Adım 5: Simülatörlerde doğrula**

Android emülatöründe ağ kapatılır (`adb shell svc wifi disable && adb shell svc data disable`) ve iki araç açılır.
Expected:
- Liste "offlinePending" metnini sayıyla gösterir.
- Ağ açılınca metin kaybolur ve araçlar Supabase Studio'da `vehicles` tablosunda görünür.
- iOS simülatöründe `owner@bambu.test` ile girilince aynı araçlar listede görünür.
- `other@bambu.test` ile girilince liste boştur.

- [ ] **Adım 6: Kullanıcıya devret**

Önerilen mesaj: `add-vehicle-screens-sync`.

---

### Task 8: Uçtan uca kontrol ve yerel kurulum notları

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: Task 1–7.

- [ ] **Adım 1: `README.md`'yi yaz**

Türkçe ve kısa. İçeriği:
- Gereksinimler: Node 26, Docker, JDK 17, Android SDK, Xcode 26.6 yan kurulum ve `DEVELOPER_DIR`.
- Backend komutları: `npm install`, `npm run db:start`, `db:reset`, `db:test`, `test:int`; tip üretimi.
- Uygulamayı çalıştırma: `.env`'nin doldurulması, iOS ve Android komutları, `adb reverse`.
- Geliştirme hesapları.
- Yerelde birini davet etme: Studio veya `inviteUserByEmail`, mail kutusu, ardından `admin_add_member`.
- Galeri açma: `admin_create_gallery`.

- [ ] **Adım 2: Kontrol listesini iki platformda çalıştır**

Expected, her madde iOS simülatöründe ve Android emülatöründe:
1. Davetle hesap açma.
2. Giriş ve çıkış.
3. Şifre sıfırlama.
4. Çevrimdışı araç açma ve ağ gelince yüklenmesi.
5. Uygulamayı kapatıp açınca bekleyen kaydın sürmesi.
6. Çıkış yapıp aynı kullanıcıyla girince bekleyen kaydın sürmesi.
7. Başka galeri kullanıcısının hiçbir şey görmemesi.
8. Hesap silme.

Sonuçlar ilerleme kaydına yazılır.

- [ ] **Adım 3: Tüm testleri çalıştır**

Run: `npm run db:reset && npm run db:test && npm run test:int && npm run test:int:mobile && (cd apps/mobile && npx jest)`
Expected: hepsi geçer.

- [ ] **Adım 4: Kullanıcıya devret**

Önerilen mesaj: `add-readme-local-setup`.
