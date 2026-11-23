# photocar.ai Arayüz Yenileme Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uygulama, Zulassung dünyasında ve photocar.ai adıyla mağaza testine hazır hâle gelir:
- adaçayı zemin, mürekkep yeşili ve tek eylem yeşili;
- araç bilgilerinde ruhsat alan kodları;
- yeni simge ve açılış ekranı.

**Architecture:**
- **Ortak temel:** önce renk ve yazı belirteçleri, yazı tipi yükleme, ortak bileşenler ve başlık çubukları yeni dünyaya geçer. Bütün ekranlar bunu devralır.
- **Ana ekranlar:** sonra altı ana ekran elle yeniden kurulur.
- **Kalan ekranlar:** belirteç adlarıyla taranır.
- **Bitiş:** marka varlıkları eklenir, ardından Impeccable bitiş incelemesi yapılır ve DESIGN.md yazılır.
- **Testler:** iki saf yardımcı (alan kodları, durum satırı) jest testlidir.

**Tech Stack:** Expo SDK 58 / React Native 0.88, expo-router (native-stack), `expo-font`, `expo-splash-screen`, `expo-symbols` 58.0.4, `@expo-google-fonts/barlow-semi-condensed` 0.4.1, `@expo-google-fonts/overpass-mono` 0.4.2, jest.

**Spec:** `docs/superpowers/specs/2026-11-23-photocar-ui-design.md`
- Yön sözleşmesi: `.impeccable/surfaces/apps-mobile.md`
- Seçilen taslak: `.impeccable/mocks/decision/zulassung.html`
- Ürün kaydı: `PRODUCT.md`

## Global Constraints

- **Renkler** (spec §7.1, birebir):

  | Rol | Değer |
  |---|---|
  | `paper` | `#E8EDE9` |
  | `sheet` | `#F4F7F5` |
  | `ink` | `#12291F` |
  | `ink2` | `#4A5D55` |
  | `rule` | `#C5D0CA` (yalnız süs çizgisi) |
  | `field` | `#788A83` (giriş ve seçim kenarı; ilk değer #7E918A idi) |
  | `action` | `#173F33` |
  | `onAction` | `#EEF3EF` |
  | `mark` | `#A8232B` |
  | `ok` | `#1E6A45` |
  | `wait` | `#855400` |

  - `guide` (`#FFFFFF`) ve `ready` (`#2E9E4F`) çekim ekranında kalır.
  - `damageColors.original` = `#D3DCD7`; diğer hasar renkleri aynı.
- **Eski → yeni belirteç adları:**

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

  Eski adlar silinir.
- **`mark` (kırmızı)** yalnız şunlar içindir: sıradaki eksik çekim, plaka kontrolü, hata, silme. Hep metin ya da simgeyle birlikte gelir. Boş bir bilgi alanı hiçbir zaman kırmızı değildir.
- **Yazı:**

  | Rol | Yazı tipi | Boyut |
  |---|---|---|
  | `display` | Barlow Semi Condensed 700 | 34 |
  | `title` | Barlow Semi Condensed 600 | 17–22 |
  | `body` | sistem yazı tipi | 15–17 |
  | `code` | Overpass Mono 600 | en az 11 |
  | `value` | Overpass Mono 500, `fontVariant: ['tabular-nums']` | 13–15 |

  - Düğme, form değeri ve gövde metni sistem yazı tipinde kalır.
  - Marka yazısı: "photocar.ai" küçük harf, Barlow Semi Condensed 600, ".ai" `ink2`.
- **Alan kodları** (spec §7.3):

  | Alan | Kod |
  |---|---|
  | `firstRegistration` | B |
  | `make` | D.1 |
  | `model` | D.3 |
  | `vin` | E |
  | `displacementCcm` | P.1 |
  | `powerKw` | P.2 |
  | `fuel` | P.3 |
  | `colorExterior` | R |

  - Diğer alanlar kod almaz; `variant` D.2 değildir.
  - Listede km yalnız birim etiketidir ("km").
- **Durum satırı** (spec §12.3, ilk tutan kazanır):

  | Koşul | Görünüm |
  |---|---|
  | `ready` | `ok` "Fertig" |
  | `processing` | `wait` "In Bearbeitung" |
  | `pendingUploads > 0` | `wait` yükleme sayısı |
  | `shooting` ve dış < 8 | `mark` "Außen x/8 · n fehlen" + 8 bölmeli sayaç |
  | `shooting` ve dış = 8 | `wait` "Wartet auf Verarbeitung" |
  | `draft` | `ink2` "Noch keine Fotos" |

  İç çekimler ve veri eksikliği bu karara girmez.
- **Değişmeyenler:**
  - Gezinme modeli, davranışlar ve araç sayfasındaki "Studio" ana düğmesi.
  - Paylaşım afişinin şablonu.
  - `slug`, `scheme`, `com.bambugames.carapp`.
  - Koyu mod yok; `userInterfaceStyle: "light"`.
- **Kaçınılacaklar:**
  - Kostüm yok: guilloche, damga, kâğıt dokusu, belge çerçevesi.
  - İç içe kart, renkli sol kenar çizgisi, gradyan ve emoji yok.
  - Simgeler yalnız `expo-symbols` `SymbolView` ile (iOS SF Symbol, Android Material Symbol).
- **Platform:**
  - Yerel başlık çubuğu (native-stack) kalır; geri hareketi ve güvenli alanlar bozulmaz.
  - Dokunma hedefi en az 44 pt / 48 dp.
  - Metinlerde sabit yükseklik yok; büyük yazı boyutunda satırlar sarar.
- **Kontrast:** AA. Metin en az 4.5:1; bileşen kenarı (`field`) en az 3:1.
- **Diller:** her yeni metin `de`, `tr` ve `en` dosyalarına girer; `src/lib/i18n.test.ts` geçer.
- **React Compiler:**
  - Hook bağımlılığı tetikleyici olarak kullanılmaz.
  - Render içinde `Date.now()` çağrılmaz.
  - Ref'lere yalnız effect ve callback içinde yazılır.
- **Kullanıcının kuralları:**
  - `git commit` çalıştırılmaz.
  - Global kurulum yok; paketler `apps/mobile` içine kurulur.
  - Buluta gönderim yok.
  - `supabase db reset` ve `supabase stop --no-backup` yok.
  - Metro yalnız 8082'de, CI modu kapalı; iPhone 17 simülatörü.
  - 8081, `melocaly-*` ve iPhone 16 Pro Max'e dokunulmaz.
  - Xcode komutları `DEVELOPER_DIR=/Users/egemenderbedek/Downloads/Xcode-26.6.app/Contents/Developer` ile çalışır.
  - `supabase/functions/.env` değerleri yazdırılmaz.
  - İzin pencereleri kullanıcınındır.

## Review Focus

1. **Büyük sistem yazı boyutu** (iOS en büyük erişilebilirlik boyutunun bir altı; Android `font_scale 1.3`): liste satırı, kod etiketleri ve form başlıkları sarar, kesilmez, üst üste binmez. → Task 7, simülatörde büyük yazıyla ekran görüntüsü.
2. **Çok uzun araç adı** (ör. "Mercedes-Benz GLC 300 e 4MATIC Coupé AMG Line"): listede en fazla iki satır, sonra "…". Durum satırı ve fotoğraf yerinden kaymaz. → Task 3, `numberOfLines={2}`, simülatör kontrolü.
3. **Fotoğrafı ve bilgisi olmayan yeni araç:** boş fotoğraf yeri ve araç simgesi; kod etiketi yok; "Noch keine Fotos". → Task 2, `stateLine` testi `a draft with no shots reads Noch keine Fotos`; Task 3 görsel kontrol.
4. **Yazı tipi yüklenemezse:** açılış ekranı takılı kalmaz; uygulama sistem yazı tipiyle açılır. → Task 1, açılış ekranını `loaded || error` ile kapatan kod; inceleme kontrolü.
5. **Android:**
   - Büyük başlık yok, normal başlık var.
   - Simgeler Material adlarıyla çizilir.
   - Gölge yerine düz yüzey.

   → Task 2'de `AndroidSymbol` türünü TypeScript denetler; Task 7'de cihaz varsa Android ekran görüntüsü alınır.

---

### Task 1: Belirteçler, yazı tipleri, açılış ekranı

**Files:**
- Modify:
  - `apps/mobile/src/ui/theme.ts`
  - `apps/mobile/src/app/_layout.tsx`
  - `apps/mobile/package.json`, `package-lock.json`
  - `colors.` kullanan 40 dosyanın tamamı (yalnız ad değişimi)
- Create: `apps/mobile/src/ui/theme.test.ts`

**Interfaces:**
- Produces (`src/ui/theme.ts`):
  - `colors`: Global Constraints'teki roller + `guide`, `ready`.
  - `damageColors`
  - `fonts = { display: 'BarlowSemiCondensed_700Bold', title: 'BarlowSemiCondensed_600SemiBold', code: 'OverpassMono_600SemiBold', value: 'OverpassMono_500Medium' }`
  - `space` (aynı)
  - `radius = 12`, `radiusPhoto = 8`, `radiusChip = 3`
  - `fontSize = { small: 14, body: 16, title: 20, display: 34 }`

- [ ] **Adım 1: Testi yaz** — `theme.test.ts`, test içinde yerel bir `contrast(a, b)` (WCAG göreli parlaklık):
  - `text tokens meet AA on their grounds`:
    - `ink`, `ink2`, `mark`, `ok`, `wait` hem `paper` hem `sheet` üstünde ≥ 4.5;
    - `onAction` `action` üstünde ≥ 4.5;
    - `action` `paper` üstünde ≥ 4.5.
  - `field edges meet 3:1 on sheet`: `field` / `sheet` ≥ 3.
  - `old token names are gone`: `colors` içinde `background`, `accent`, `textMuted` yok.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/ui/theme.test.ts`
Expected: FAIL (`paper` tanımsız).

- [ ] **Adım 3: Belirteçleri ve yükleyiciyi yaz**
  1. `npm install @expo-google-fonts/barlow-semi-condensed@0.4.1 @expo-google-fonts/overpass-mono@0.4.2` (`apps/mobile` içinde).
  2. `theme.ts`'i Interfaces'a göre yaz.
  3. Bütün `colors.<eski>` kullanımlarını yeni adlara çevir. `npx tsc --noEmit` hiç hata bırakmayana kadar sürdür.
  4. Kök `_layout.tsx`:
     - Modül düzeyinde `SplashScreen.preventAutoHideAsync()`.
     - `useFonts({ BarlowSemiCondensed_600SemiBold, BarlowSemiCondensed_700Bold, OverpassMono_500Medium, OverpassMono_600SemiBold })`.
     - `loaded || error` olunca `SplashScreen.hideAsync()`.
     - Yazı tipi hazır değilken ve hata yokken `null` döndür.
     - `status === 'loading'` görünümü `colors.paper` kullanır.

- [ ] **Adım 4: Testleri çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret.** Önerilen mesaj: `add-photocar-tokens-fonts`.

---

### Task 2: Ortak bileşenler, saf yardımcılar, başlık çubukları

**Files:**
- Create:
  - `apps/mobile/src/vehicle/fieldCodes.ts` + `fieldCodes.test.ts`
  - `apps/mobile/src/vehicle/stateLine.ts` + `stateLine.test.ts`
  - `apps/mobile/src/ui/CodeChip.tsx`, `Fact.tsx`, `StateLine.tsx`, `Wordmark.tsx`, `Icon.tsx`
- Modify:
  - `apps/mobile/src/ui/Button.tsx`, `Notice.tsx`, `Segmented.tsx`, `TextField.tsx`, `SelectField.tsx`, `Screen.tsx`
  - `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/src/app/(auth)/_layout.tsx`
  - `apps/mobile/src/locales/{de,tr,en}.json`

**Interfaces:**
- Consumes: Task 1 `colors`, `fonts`, `radius*`, `fontSize`.
- Produces:
  - `FIELD_CODES: Partial<Record<keyof VehicleData, string>>` ve `codeFor(field: string): string | null` (`src/vehicle/fieldCodes.ts`).
  - `type VehicleState = { tone: 'ok' | 'wait' | 'mark' | 'neutral'; key: string; params?: Record<string, number>; meter?: { done: number; total: number } }`.
  - `stateLine(v: Pick<VehicleListItem, 'status' | 'exteriorDone' | 'pendingUploads'>): VehicleState` (`src/vehicle/stateLine.ts`).
  - Yeni bileşenler:
    - `CodeChip({ code }: { code: string })`
    - `Fact({ code, value }: { code: string; value: string })`
    - `StateLine({ state }: { state: VehicleState })`
    - `Wordmark()`
    - `Icon({ ios, android, size, color }: { ios: SFSymbol; android: AndroidSymbol; size?: number; color: string })`
  - Mevcut bileşenlere eklenenler:
    - `Notice` türü `'info' | 'error' | 'attention'`.
    - `TextField` ve `SelectField` yeni `code?: string | null` alır; varsa başlık satırında `CodeChip` + başlık.

- [ ] **Adım 1: Testleri yaz**
  - `fieldCodes.test.ts`:
    - `document fields carry their registration codes`: Global Constraints'teki sekiz eşleme birebir.
    - `fields without a document code get none`: `variant`, `mileageKm`, `huUntil`, `priceEur` → `null`.
  - `stateLine.test.ts`:
    - `a ready vehicle reads Fertig`: `{status:'ready', exteriorDone:8, pendingUploads:0}` → `{tone:'ok', key:'vehicles.status.ready'}`.
    - `processing reads In Bearbeitung`: → `{tone:'wait', key:'vehicles.status.processing'}`.
    - `uploads still pending win over shooting`: `{status:'shooting', exteriorDone:3, pendingUploads:2}` → `{tone:'wait', key:'vehicles.pendingUploads', params:{count:2}}`.
    - `missing exterior angles are the next step`: `{status:'shooting', exteriorDone:5, pendingUploads:0}` → `{tone:'mark', key:'vehicles.exteriorMissing', params:{done:5, total:8, missing:3}, meter:{done:5, total:8}}`.
    - `a fully shot vehicle waits for processing`: `{status:'shooting', exteriorDone:8, pendingUploads:0}` → `{tone:'wait', key:'vehicles.waitingForProcessing'}`.
    - `a draft with no shots reads Noch keine Fotos`: `{status:'draft', exteriorDone:0, pendingUploads:0}` → `{tone:'neutral', key:'vehicles.noPhotos'}`.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `cd apps/mobile && npx jest src/vehicle/fieldCodes.test.ts src/vehicle/stateLine.test.ts`
Expected: FAIL (modüller yok).

- [ ] **Adım 3: Yardımcıları, bileşenleri ve başlıkları yaz**
  - **Yardımcılar:** `fieldCodes.ts` ve `stateLine.ts`. Toplam dış çekim sayısı `EXTERIOR_SLOTS.length`.
  - **Yeni dil anahtarları** (üç dilde):
    - `vehicles.exteriorMissing`: de "Außen {{done}}/{{total}} · {{missing}} fehlen", tr "Dış {{done}}/{{total}} · {{missing}} eksik", en "Exterior {{done}}/{{total}} · {{missing}} missing".
    - `vehicles.noPhotos`: de "Noch keine Fotos", tr "Henüz fotoğraf yok", en "No photos yet".
  - **Bileşenler** (seçilen taslağın dilinde):
    - `Button`: `primary` = `action` dolgu + `onAction` yazı; `secondary` = `field` kenar + `ink` yazı; `danger` = `mark` yazı + `field` kenar; yükseklik ≥ 48.
    - `Notice` `attention`: `mark` renginde, önünde `Icon` (ios `exclamationmark.circle`, android `error`).
    - `Segmented`: seçili `action` dolgu, `onAction` yazı.
    - `TextField` / `SelectField`: `sheet` zemin, `field` kenar.
    - `Screen`: `paper` zemin.
    - `CodeChip`: `rule` kenar, `paper` zemin, `fonts.code` 11, `ink2`.
    - `StateLine`: 8×8 nokta + metin; `mark` tonunda metin `mark` ve yarı kalın; `meter` varsa 8 bölmeli çubuk (`ink` dolu, `rule` boş).
    - `Wordmark`: "photocar" `ink` + ".ai" `ink2`.
  - **Başlık çubukları** (`(app)` ve `(auth)` `screenOptions`):
    - `headerStyle: { backgroundColor: colors.paper }`
    - `headerTitleStyle: { fontFamily: fonts.title, color: colors.ink }`
    - `headerTintColor: colors.action`
    - `contentStyle: { backgroundColor: colors.paper }`
  - **Liste ekranının `Stack.Screen` ayarları:**
    - iOS'ta `headerLargeTitle: true`, `headerLargeTitleStyle: { fontFamily: fonts.display }`.
    - `headerLeft: Wordmark`.
    - `headerRight`: 36×36 daire içinde galeri adının baş harfleri. Erişilebilirlik etiketi `account.title`; dokunma alanı ≥ 44.

- [ ] **Adım 4: Testleri çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

- [ ] **Adım 5: Kullanıcıya devret.** Önerilen mesaj: `add-zulassung-components`.

---

### Task 3: Araç listesi, araç sayfası, giriş ekranları

**Files:**
- Modify:
  - `apps/mobile/src/app/(app)/index.tsx`
  - `apps/mobile/src/app/(app)/vehicles/[id]/index.tsx`
  - `apps/mobile/src/app/(auth)/sign-in.tsx`, `accept-invite.tsx`, `reset-password.tsx`
- Delete: `apps/mobile/src/vehicle/listStatus.ts`, `listStatus.test.ts`. `stateLine` M5 kuralını içine aldı; testi `a fully shot vehicle waits for processing`.

**Interfaces:**
- Consumes: Task 2 `stateLine`, `StateLine`, `Fact`, `CodeChip`, `codeFor`, `Icon`, `Wordmark`; `useCovers` (mevcut).

- [ ] **Adım 1: Araç listesini yaz.** Seçilen taslağın düzeni:
  - **Satır:** solda fotoğraf (116×87, `radiusPhoto`); kapak yoksa `paper` zemin, `field` kesikli kenar ve `Icon` (ios `car.side`, android `directions_car`).
  - **Sağ sütun:**
    - ad: `fonts.title` 18, `numberOfLines={2}`;
    - `Fact` satırı, sırayla B, P.2, km; değeri olmayan atlanır; km `Intl.NumberFormat` ile;
    - altında `StateLine`.
  - **Liste:** satırlar `sheet` üstünde, `rule` çizgisiyle ayrılır, kart yok. "Neues Fahrzeug" tam genişlik `primary` düğme.
  - **Mevcut yükleme özeti** (`summary`) başlık bölümünde kalır.

- [ ] **Adım 2: Araç sayfasını yaz.**
  - Üstte kapak fotoğrafı: tam genişlik, 4:3, kapak yoksa boş yer.
  - Ad (`fonts.display` 28) ve `Fact` satırı. Burada B, P.2, P.3 ve km hep gösterilir; boş olan "—" olarak `ink2` renginde (spec §12.2).
  - `StateLine`.
  - "Studio" `primary` düğmesi: bugünkü davranış, bugünkü etiket.
  - İşlem satırları bugünkü sırayla. Her satır `sheet` üstünde, ≥ 48 yükseklik; sağda bugünkü durum metni `ink2`; ok simgesi `Icon` (ios `chevron.right`, android `chevron_right`).
  - Dış ve iç çekim listesi bugünkü davranışla. Eksik dış açılar `mark` renkli "fehlt" metniyle.

- [ ] **Adım 3: Giriş, davet kabulü ve şifre sıfırlamayı yaz.**
  - Üstte `Wordmark` (büyük, 28).
  - Altında `ink2` tek satır ürün cümlesi: yeni anahtar `auth.tagline`:
    - de "Studiofotos und Anzeigen direkt vom Hof."
    - tr "Galeriden doğrudan stüdyo fotoğrafı ve ilan."
    - en "Studio photos and listings, straight from the lot."
  - Sonra alanlar ve düğmeler. Davranış aynı.

- [ ] **Adım 4: Testleri çalıştır, simülatörde bak**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

Simülatörde (iPhone 17, Metro 8082) liste, araç sayfası ve giriş ekranlarını gör. Uzun bir araç adıyla (Review Focus 2) ve fotoğrafsız bir taslak araçla (Review Focus 3) dene. Ekran görüntülerini `.impeccable/review/` altına kaydet.

- [ ] **Adım 5: Kullanıcıya devret.** Önerilen mesaj: `upd-list-vehicle-signin-zulassung`.

---

### Task 4: Araç bilgileri formu, stüdyo, paylaşım

**Files:**
- Modify:
  - `apps/mobile/src/app/(app)/vehicles/[id]/data.tsx`
  - `apps/mobile/src/app/(app)/vehicles/[id]/studio.tsx`
  - `apps/mobile/src/app/(app)/vehicles/[id]/share.tsx`

**Interfaces:**
- Consumes: Task 2 `codeFor`, `TextField`/`SelectField` `code` prop, `Notice` `attention`, `Icon`.

- [ ] **Adım 1: Formu yaz.**
  - Her `TextField` ve `SelectField` çağrısına `code={codeFor('<alan>')}` eklenir.
  - Bölüm başlıkları `fonts.title` 20.
  - Bölümler `sheet` yüzeyinde, aralarında `rule` çizgisi.
  - Davranış ve alanların sırası aynı.
- [ ] **Adım 2: Stüdyoyu yaz.**
  - Arka plan seçimi, renk eşitleme anahtarı (yerel `Switch`, `trackColor` `action`) ve "Bearbeiten" ya da M5 sahip notu.
  - İlk kredi notu, ilerleme başlığı (`fonts.title`) ve fotoğraf ızgarası.
  - Plaka kontrolü bekleyen fotoğraflar `Notice` `attention` ile.
- [ ] **Adım 3: Paylaşım ekranını yaz.**
  - Afiş önizlemesi, `Segmented` seçimler, fotoğraf seçimi (seçili işaret `action` daire + `Icon` ios `checkmark`, android `check`) ve "Teilen" `primary`.
  - M4'teki plaka uyarısı artık `Notice kind="attention"`.
- [ ] **Adım 4: Testleri çalıştır, simülatörde bak**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

Simülatörde form (kod etiketleri), stüdyo ve paylaşım ekranlarını gör; ekran görüntülerini kaydet.

- [ ] **Adım 5: Kullanıcıya devret.** Önerilen mesaj: `upd-data-studio-share-zulassung`.

---

### Task 5: Kalan ekranların taraması

**Files:**
- Modify (yalnız biçim; davranış ve düzen aynı):
  - `account`, `credits`, `gallery/settings`, `gallery/members`, `vehicles/new`
  - `vehicles/[id]/capture`, `damage`, `listing`, `report`, `plates`, `touch-up`, `photo/[photoId]`, `export`
  - `licenses`, `(app)/_layout` içindeki `NoGallery`
  - `src/capture/*`, `src/studio/*`, `src/vehicle/DamageMap.tsx`

- [ ] **Adım 1: Tara ve düzelt.**
  - **Başlıklar:** ekran içi başlıklar `fonts.title`.
  - **Tehlikeli eylemler:** `Button variant="danger"`.
  - **Uyarılar:** gerekirse `Notice` `attention`.
  - **Satır listeleri:** `sheet` + `rule`.
  - **Hesap ekranındaki merkezlenmiş metin düğmeleri:** sola hizalı satırlar (≥ 48 yükseklik, sağda `Icon` `chevron`). Hesap ekranı "Galerie verwalten" grubuyla.
  - **Çekim ekranı:** kamera alanı, `guide`/`ready` ve `HALO` aynı kalır; yan paneldeki düğme ve metinler yeni belirteçlere geçer.
  - **Hasar haritası:** zemin `paper`, `original` dolgusu Task 1'deki yeni değer.
  - **Kalan sabit renkler:** sabit `#000000` ve `rgba` değerleri yalnız fotoğraf ya da kamera üstünde kalır; başka yerde belirtece çevrilir.
- [ ] **Adım 2: Testleri çalıştır, simülatörde gez.**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest`
Expected: PASS

Simülatörde her ekranı bir kez aç. Eski mavi ya da beyaz kalan yer olmadığını gör; birkaç temsilî ekran görüntüsü kaydet.

- [ ] **Adım 3: Kullanıcıya devret.** Önerilen mesaj: `upd-remaining-screens-zulassung`.

---

### Task 6: Marka varlıkları

**Files:**
- Create:
  - `apps/mobile/assets/brand/icon.svg`, `icon-android-foreground.svg`, `icon-android-monochrome.svg`, `splash-wordmark.svg`
  - Bunlardan üretilen PNG'ler:
    - `assets/images/icon.png` (1024)
    - `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png` (1024)
    - `splash-icon.png`
- Modify: `apps/mobile/app.json`

- [ ] **Adım 1: SVG'leri çiz.**
  - **Simge:** `paper` zemin; ortada %56 genişlikte, `ink` 4 % kalınlıkta kenarlı, `radiusChip` oranında yuvarlak köşeli kod kutusu; içinde Overpass Mono 600 "pc" `ink`.
  - **Android:**
    - Ön plan: aynı kutu, %66 güvenli alanın içinde.
    - Arka plan: düz `paper`.
    - Tek renk: aynı biçim, düz siyah.
  - **Açılış ekranı:** marka yazısı.
  - Yazılar yola (path) çevrilir; SVG yazı tipine bağımlı olmaz.
- [ ] **Adım 2: PNG üret.**
  - Bu makinede çalışan bir araçla üret (sırayla dene: `qlmanage -t -s 1024 -o <dir> <svg>`, `sips -s format png`, ya da yerel dosyayı uygulama içi tarayıcıda açıp ekran görüntüsü). Global kurulum yok.
  - Her PNG'nin kökenini yaz: `.claude/skills/impeccable/scripts/impeccable embed-prompt <png> --prompt-file <kaynak notu>`. Not, kaynak SVG yolunu ve aracı içerir.
- [ ] **Adım 3: `app.json`'u güncelle.**
  - `expo.name` = "photocar.ai".
  - `ios.icon` = `./assets/images/icon.png`.
  - Android `adaptiveIcon.backgroundColor` = `#E8EDE9`.
  - `expo-splash-screen`: `backgroundColor` `#E8EDE9`, `image` yeni `splash-icon.png`.
  - `slug`, `scheme` ve kimlikler aynı.
- [ ] **Adım 4: Doğrula.**
  - PNG'leri aç ve gör: 1024'te ve 60 px'e küçültülmüş hâlde "pc" okunuyor mu?
  - `npx expo config --type public | grep -E '"name"|icon|splash'` yeni değerleri gösteriyor mu?
  - Native derleme bu planda yok; yayın planındaki EAS build'inde görülecek.
- [ ] **Adım 5: Kullanıcıya devret.** Önerilen mesaj: `add-photocar-brand-assets`.

---

### Task 7: Bitiş incelemesi ve DESIGN.md

**Files:**
- Create:
  - `.impeccable/review/*.png`
  - `DESIGN.md` (proje kökü)
  - `.impeccable/design.json`

- [ ] **Adım 1: Ekran görüntülerini al.**
  - iPhone 17'de altı ana ekranı ve iki temsilî yan ekranı çek: `xcrun simctl io <UDID> screenshot`.
  - Büyük yazı boyutunda liste ve form ekranlarını çek (Review Focus 1).
  - Android telefon ya da emülatör bağlıysa aynı ekranları `adb exec-out screencap -p` ile çek. Bağlı değilse bunu rapora yaz.
  - Her dosyayı açıp neyi gösterdiğini doğrula.
- [ ] **Adım 2: Bitiş incelemesi.** Yeni bir `impeccable-finish-reviewer` alt ajanı başlat. Girdiler:
  - kullanıcının isteği ve onaylanan cevaplar;
  - ekran görüntüsü yolları;
  - yön sözleşmesi (`.impeccable/surfaces/apps-mobile.md`);
  - eleştiri referansı olarak seçilen taslak (`.impeccable/mocks/decision/zulassung.html`);
  - `craft-floor.md`, `ios.md` ve `android.md` yolları;
  - "native platform, detector ran on no file" notu.

  Kararına göre hareket et (`ship` / `fix` / `rebuild` / `recapture`). En fazla iki düzeltme turu.
- [ ] **Adım 3: Belgele.** `impeccable-documenter` alt ajanı, yapılmış dünyadan `DESIGN.md` ve `.impeccable/design.json` yazar. Girdiler: proje kökü, yön sözleşmesi, PRODUCT.md, yazma sınırı.
- [ ] **Adım 4: Son test.**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest && cd ../.. && npm run test:int:mobile`
Expected: PASS. Entegrasyon için yerel Supabase açık olmalı; iş bitince `npx supabase stop` ile kapatılır.

- [ ] **Adım 5: Kullanıcıya devret.** Önerilen mesaj: `add-design-md`. Metro, simülatör ve yerel Supabase durdurulur.
