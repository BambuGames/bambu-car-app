# bambu-car-app

Galerilerin ilan fotoğraflarını yönlendirmeli çekmesi için mobil uygulama (iOS ve Android).

- `apps/mobile`: Expo uygulaması.
- `supabase/`: veritabanı, RLS, Edge Function'lar ve testler.
- Tasarım: `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md`.

## Gereksinimler

- Node 26
- Docker (yerel Supabase bunun içinde çalışır)
- JDK 17 (bu Mac'te `/Library/Java/JavaVirtualMachines/zulu-17.jdk`)
- Android SDK (`~/Library/Android/sdk`), bir emülatör ya da USB hata ayıklaması açık bir telefon
- Xcode 26.6, sistemdeki Xcode'un yanında: `~/Downloads/Xcode-26.6.app`.
  - Sistemin varsayılan Xcode'u diğer projeler için olduğu gibi kalır.
  - Bu projede Xcode her komutta `DEVELOPER_DIR` ile seçilir.
  - `xcode-select -s` kullanmayın.

  ```bash
  export DEVELOPER_DIR=$HOME/Downloads/Xcode-26.6.app/Contents/Developer
  ```

## Arka uç

Depo kökünde:

```bash
npm install
npm run db:start         # yerel Supabase: API 54321, Studio 54323, Mailpit 54324
npm run db:reset         # migration'ları ve seed'i baştan uygular, yerel veriyi siler
npm run db:test          # veritabanı testleri (RLS, admin fonksiyonları)
npm run test:int         # davet/şifre kodu ve hesap silme testleri, çalışan yığına karşı
npm run test:int:mobile  # mobil senkronun yerel Supabase'e karşı testleri
npm run db:types         # şema değişince apps/mobile için TypeScript tiplerini üretir
```

Uygulamanın birim testleri:

```bash
cd apps/mobile && npx tsc --noEmit && npx jest
```

`supabase start`, Edge Function'ları yalnızca açılışta bulur. Yeni bir fonksiyondan sonra `npx supabase stop && npx supabase start` çalıştırın. Fonksiyonu düzenlerken `npx supabase functions serve` de iş görür.

### OpenAI

- `write-listing` (ilan metni) ve `read-report` (rapor okuma) OpenAI Responses API'yi resmi `openai` kütüphanesiyle çağırır; ortak kod `supabase/functions/_shared/ai.ts`. Model `gpt-6.2-sol`; yapılandırılmış çıktı ve her istekte `store: false`. Yedek model yoktur: reddedilen istek `422 ai_refused` döner.
- **Yerelde gerçek OpenAI çağrılmaz.**
  - `supabase/functions/.env`'de `OPENAI_BASE_URL=http://host.docker.internal:8091/v1` durur.
  - `npm run test:int` 8091 portunda sahte bir Responses API açar (`supabase/tests/integration/fakeOpenAI.ts`); port o sırada boş olmalı.
  - `.env` değişince `npx supabase stop`, ardından `npm run db:start`.
- **Bulutta:**
  - Anahtarı fonksiyon sırrı olarak kullanıcı kendisi, onayıyla girer: `npx supabase secrets set OPENAI_API_KEY=…`.
  - `OPENAI_BASE_URL` bulutta boş kalır (kütüphanenin varsayılanı). AB'de işleme gerekirse `https://eu.api.openai.com/v1` yazılabilir.
  - Buluta sır, migration ya da fonksiyon gönderimi yalnız kullanıcının onayıyla yapılır.
- Anahtar git'e girmez ve yazdırılmaz. Şasi numarası ilan metni isteğine hiç girmez.

### Rapor temizliği (zamanlanmış iş)

`clean-reports` fonksiyonu, 7 günden uzun açık kalan rapor okumalarının dosyalarını siler ve önerilerini boşaltır. Ardından `reports` kovasında 7 günden eski kalan her dosyayı da siler; okuma kaydı olmayan dosyalar (yükleme yarıda kesildiyse) böylece kalmaz. `pg_cron` işi her gün 03:17'de `pg_net` ile çağırır. Fonksiyon kullanıcı JWT'si taşımaz (`config.toml`'da `verify_jwt = false`); `x-cron-secret` başlığını `CRON_SECRET` ile karşılaştırır. Adres ve sır Vault'ta durur (`clean_reports_url`, `cron_secret`); migration değer içermez.

- **Yerel:**
  - `supabase/functions/.env`'e rastgele bir `CRON_SECRET=` yazın (`openssl rand -hex 24`), ardından `npx supabase stop` ve `npm run db:start`.
  - Vault'a aynı değeri girin (veritabanı konteynerinden `kong`'a erişilir):

    ```sql
    select vault.create_secret('http://kong:8000/functions/v1/clean-reports', 'clean_reports_url');
    select vault.create_secret('<CRON_SECRET değeri>', 'cron_secret');
    ```
  - Var olan bir değeri değiştirmek için `create_secret` hata verir; `update_secret` kullanın:

    ```sql
    select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<yeni değer>');
    ```
- **Hatalar nerede görünür:**
  - `cron.job_run_details`: işin SQL'i çalıştı mı (ör. Vault girdisi eksikse adres boş kalır ve iş burada hata verir).
  - `net._http_response`: fonksiyonun cevabı (`status_code`, `content`, `timed_out`). Çağrı 60 saniye bekler.

    ```sql
    select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
    select status_code, content, timed_out, error_msg from net._http_response order by id desc limit 5;
    ```
- **Bulut (kullanıcı onayıyla, sonra):**
  - Rastgele bir sır üretin; `npx supabase secrets set CRON_SECRET=…` ile fonksiyon sırrı olarak girin.
  - Barındırılan projenin SQL düzenleyicisinde aynı iki Vault girdisini oluşturun; adres `https://<proje-ref>.supabase.co/functions/v1/clean-reports`, sır aynı değer.
  - `npx supabase functions deploy clean-reports` ile fonksiyonu gönderin. `verify_jwt = false` ayarı `config.toml`'dan gelir.
- Sır git'e girmez ve yazdırılmaz.

## Uygulamayı çalıştırma

1. `apps/mobile/.env.example` dosyasını `apps/mobile/.env` adıyla kopyalayın.
2. Depo kökünde `npx supabase status -o env` çalıştırın. Çıktıdaki `API_URL` ve `ANON_KEY` değerlerini `.env` dosyasına yazın.
3. Metro'yu başlatın ve açık bırakın:

   ```bash
   cd apps/mobile
   npx expo start --port 8082
   ```

   - 8081 bu Mac'te başka bir projenin Metro'su tarafından kullanılıyor.
   - `CI=1` ile başlatmayın. O modda Metro dosyaları izlemez ve değişiklikler uygulamaya ulaşmaz.

### iOS simülatörü

```bash
cd apps/mobile
DEVELOPER_DIR=$HOME/Downloads/Xcode-26.6.app/Contents/Developer LANG=en_US.UTF-8 npx expo run:ios --port 8082
```

- Komut 8082'de çalışan Metro'yu kullanır.
- CocoaPods UTF-8 dil ayarı ister. `LANG` bu yüzden komutta.

### Android emülatörü veya telefon

```bash
adb reverse tcp:54321 tcp:54321   # uygulama Supabase'e 127.0.0.1 üzerinden ulaşır
adb reverse tcp:8082 tcp:8082     # telefonun Metro'ya ulaşması için
cd apps/mobile
npx expo prebuild --platform android   # yalnız ilk seferde; android/ klasörü git'e girmez
cd android
JAVA_HOME=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home ./gradlew app:installDebug -PreactNativeDevServerPort=8082 -PreactNativeArchitectures=arm64-v8a
adb shell am start -n com.bambugames.carapp/.MainActivity
```

- Emülatör yeniden başlayınca ya da telefon yeniden takılınca `adb reverse` ayarları silinir. İki komutu tekrar çalıştırın.
- Kurulum Gradle ile yapılıyor, çünkü `expo run:android` `--port` ile `--no-bundler`'ı birlikte kabul etmiyor.
- Android'de Fast Refresh bağlanmıyor. Kod değişikliğinden sonra uygulamayı yeniden başlatın:

  ```bash
  adb shell am force-stop com.bambugames.carapp && adb shell am start -n com.bambugames.carapp/.MainActivity
  ```

## Kamera ve cihaz

Çekim ekranı VisionCamera, resizer ve TFLite kullanır. Bunlar yerel kod içerir; yukarıdaki geliştirme derlemeleri gerekir.

### Derleme gereksinimleri

- **iOS:** Resizer'ın Metal kodu için Xcode'un Metal araç seti gerekir. Her Xcode için bir kez:

  ```bash
  DEVELOPER_DIR=$HOME/Downloads/Xcode-26.6.app/Contents/Developer xcodebuild -downloadComponent MetalToolchain
  ```

- **Android:** Resizer'ın Vulkan gölgelendiricisi NDK'daki `glslc` ile derlenir. `apps/mobile/plugins/withResizerShaders.js` prebuild sırasında `local.properties`'e `glslc.dir` yazar. Önce `GLSLC_DIR` ortam değişkenine, yoksa `$ANDROID_HOME/ndk/<sürüm>/shader-tools/<sistem>` klasörüne bakar; bulamazsa prebuild durur. EAS dahil her derleme makinesinde NDK kurulu olmalı.
- Android `minSdkVersion` 26'dır (resizer bunu istiyor). `app.json`'da `expo-build-properties` ile ayarlı.

### Modeller ve şablonlar

- **Araç tespiti:** `apps/mobile/assets/models/` altındaki TensorFlow EfficientDet-Lite modelleri (Apache-2.0; tespit son işleme adımı modelin içinde). iOS'ta Lite2 CPU'da, Android'de Lite0 GPU'da çalışır. GPU açılmazsa model CPU'da yüklenir.
- **Şablonlar:** `tools/templates/models/` altındaki GLB dosyalarından üretilir. Kaynaklar ve lisanslar `tools/templates/models/SOURCES.md` dosyasında.

  ```bash
  tools/templates/.venv/bin/python tools/templates/templates.py kombi
  tools/templates/.venv/bin/python tools/templates/templates.py export-app
  ```

  İkinci komut `apps/mobile/src/templates/templates.generated.ts` dosyasını yazar. Model yazarları uygulamada Konto → Lizenzen ekranında listelenir.

### Telefona kurulum

- **iPhone:** Mac ile bir kez kabloyla eşleştikten sonra aynı Wi-Fi'da kurulur. İmza için geliştirici hesabı Xcode'a eklenmiş ve ekip projede seçilmiş olmalı. İlk derleme profili oluşturur ve telefonu ekibe ekler.

  ```bash
  xcrun devicectl list devices
  cd apps/mobile/ios
  DEVELOPER_DIR=$HOME/Downloads/Xcode-26.6.app/Contents/Developer LANG=en_US.UTF-8 xcodebuild -workspace bambucarapp.xcworkspace -scheme bambucarapp -configuration Debug -destination 'id=<UDID>' -derivedDataPath build -allowProvisioningUpdates -allowProvisioningDeviceRegistration
  xcrun devicectl device install app --device <UDID> build/Build/Products/Debug-iphoneos/bambucarapp.app
  ```

- **Android (11 ve sonrası):** Telefonda Geliştirici seçenekleri → Kablosuz hata ayıklama → "Eşleme koduyla cihaz eşle". Ekrandaki adres ve kodla:

  ```bash
  adb pair <ip>:<eşleme portu>
  adb connect <ip>:<port>
  ```

  Sonra Android bölümündeki `adb reverse` ve kurulum komutları çalıştırılır. Samsung'da adb güncellemesi, telefonda Play Protect onayı verilene kadar bekler.

### Simülatör ve emülatör sınırları

- iOS simülatöründe kamera yoktur; çekim ekranı iPhone'da denenir.
- Android emülatörü sanal kamerayla çekim, kalite kontrolü ve yüklemeyi gösterir. Emülatörün GPU'su kamera karesini resizer'a veremez ve GPU delegesini açamaz. Bu yüzden tespit çalışmaz ve ekran 3 saniye sonra basit moda geçer. Yönlendirme ve otomatik çekim gerçek telefonda denenir.

## Geliştirme hesapları

Hesaplar seed'den gelir. Hepsinin şifresi `dev-password-1`.

| E-posta | Galeri | Rol |
|---|---|---|
| owner@bambu.test | Testgalerie | owner |
| staff@bambu.test | Testgalerie | staff |
| other@bambu.test | Andere Galerie | owner |

`other@bambu.test`, galerilerin birbirinin araçlarını görmediğini kontrol etmek için var.

## Yerelde birini davet etme

Galeri sahibi personeli uygulamadan davet eder (Konto → Mitarbeitende, aşağıda "Stüdyo ve galeri"). Aşağıdaki yol, bir galerinin ilk sahibini açarken ya da uygulama dışında gerekir.

1. Studio'yu açın (http://127.0.0.1:54323). Authentication → Invite user ile e-postayı girin.
   - Kodla yapmak isterseniz `supabase.auth.admin.inviteUserByEmail(email)` aynı işi görür. Bunun için service role anahtarı gerekir.
2. Davet e-postası Mailpit'e düşer (http://127.0.0.1:54324). E-postada 6 haneli bir kod vardır.
3. Kişi uygulamada daveti kabul eder: kodu, e-postasını ve yeni şifresini girer.
4. Hesabı bir galeriye bağlayın. Studio'nun SQL editöründe şunu çalıştırın:

   ```sql
   select public.admin_add_member('<galeri-id>', 'kisi@example.com', 'staff');
   ```

Galeriye bağlanmamış bir hesap, girişten sonra "Galeri yok" ekranını görür.

## Galeri açma

1. Galeri sahibini yukarıdaki gibi davet edin.
2. SQL editöründe şunu çalıştırın. Komut yeni galerinin id'sini döndürür:

   ```sql
   select public.admin_create_gallery('Galeri adı', 'sahip@example.com');
   ```

`admin_*` fonksiyonlarını yalnız SQL editörü çalıştırabilir. Uygulama kullanıcılarının bu yetkisi yok.

## Kredi yükleme ve iade

1 kredi bir araçtır. Kredi, aracın fotoğrafları ilk kez işlenirken düşer. SQL editöründe:

```sql
select public.admin_grant_credits('<galeri id>', 10, 'Pilot paketi');   -- yeni bakiyeyi döndürür
select public.admin_refund_vehicle('<araç id>', 'İşleme tamamen başarısız');
```

Bir araç en fazla bir kez ücretlendirilir ve en fazla bir kez iade edilir. Bakiye `credit_ledger` tablosundan hesaplanır.

## İşleme servisi

Python servisi `services/image-worker`, bir aracın fotoğraflarını işler:

1. Plakaları bulup kapatır.
2. Photoroom'dan maske alır.
3. Aracı şablon konumuna yerleştirir.
4. Stüdyo arka planını, gölgeyi, ton düzeltmesini, plaka banner'ını ve filigranı ekler.

Uygulama işlemeyi `process-vehicle` Edge Function'ı ile başlatır. Fonksiyon krediyi düşer, fotoğrafları kuyruğa alır ve servisi çağırır.

### Kurulum

```bash
python3.13 -m venv services/image-worker/.venv
```

```bash
services/image-worker/.venv/bin/pip install -r services/image-worker/requirements-dev.txt
```

Plaka modelinin ONNX dosyası git'te değildir; bir kez üretilir. Ağırlıklar M0'da indirildi ve `spikes/.cache/hf` önbelleğinde durur. `spikes/.venv`'de torch, transformers, onnx ve onnxruntime gerekir.

```bash
HF_HOME=spikes/.cache/hf spikes/.venv/bin/python services/image-worker/scripts/export_plate_onnx.py
```

### Ortam değişkenleri

Anahtarlar git'e girmez ve hiçbir yerde yazdırılmaz.

- `services/image-worker/.env`: `.env.example`'dan kopyalanır.
  - `SUPABASE_SERVICE_ROLE_KEY`: `npx supabase status -o env` çıktısındaki `SERVICE_ROLE_KEY`.
  - `PHOTOROOM_API_KEY`: Photoroom panelindeki anahtar.
  - `WORKER_SECRET`: Edge Function'daki değerle aynı olmalı.
  - `SUPABASE_URL`: Docker içinde `http://host.docker.internal:54321`, doğrudan `uvicorn` ile çalıştırırken `http://127.0.0.1:54321`.
- `supabase/functions/.env`: `.env.example`'dan kopyalanır.
  - `WORKER_URL=http://host.docker.internal:8090` ve `WORKER_SECRET`.
  - `supabase start` bu dosyayı okur.
  - Yerel edge runtime, fonksiyon listesini başlarken kurar. Yeni bir fonksiyon eklenince `npx supabase stop`, ardından `npm run db:start` çalıştırılır.
  - Var olan bir fonksiyonun kodu değişince yerel edge runtime değişikliği kendiliğinden almaz: `docker restart supabase_edge_runtime_bambu-car-app`.

### Çalıştırma

Servis yerelde 8090 portunda çalışır.

```bash
docker build -t bambu-image-worker services/image-worker
```

```bash
docker run --rm -d --name bambu-image-worker -p 8090:8080 --env-file services/image-worker/.env bambu-image-worker
```

- Sağlık kontrolü: `curl localhost:8090/health` → `{"ok":true}`.
- Durdurmak için: `docker stop bambu-image-worker`.
- Cloud Run `linux/amd64` imaj ister; buluta kurulum (Frankfurt) M2c'de yapılır.
- Servis `/process` isteğine hemen `202` ile yanıt verir ve aracı arka planda işler. Cloud Run'da bu yüzden CPU'nun istek dışında da ayrılması gerekir (M2c).

### Testler

```bash
services/image-worker/.venv/bin/python -m pytest services/image-worker -q
```

```bash
services/image-worker/.venv/bin/python -m pytest services/image-worker -q -m model
```

- İkinci komut, dönüştürülmüş plaka modelini M0 fotoğraflarında dener.
- `npm run test:int`, sahte bir servisi 8090 portunda açar. Bu yüzden gerçek servis o sırada durdurulmuş olmalı.

### Gerçek fotoğraflarla uçtan uca deneme

Bu deneme Photoroom'a görsel başına $0.02 harcar.

1. Servisi yukarıdaki gibi Docker'da başlatın.
2. Testgalerie'ye kredi yükleyin.
3. Aşağıdaki iki komutu çalıştırın:

```bash
set -a && eval "$(npx supabase status -o env)" && set +a && services/image-worker/.venv/bin/python services/image-worker/scripts/seed_test_vehicle.py --process
```

```bash
set -a && eval "$(npx supabase status -o env)" && set +a && services/image-worker/.venv/bin/python services/image-worker/scripts/contact_sheet.py <araç id>
```

- İlk komut M0 fotoğraflarından 8 açılık bir test aracı kurar ve işlemeyi sahip hesabıyla başlatır. Testgalerie'ye örnek bir logo ve banner da yükler. `--details` eklenirse aynı fotoğraflar detay ve iç mekân adımlarına konur; Photoroom'a gidilmez, para harcanmaz.
- İkinci komut orijinalleri ve çıktıları yan yana koyar: `services/image-worker/out/<araç id>.png`.

## Stüdyo ve galeri

- **İnternet:** Stüdyo, sonuçlar, plaka kontrolü, rötuş, kredi, galeri ayarları ve personel ekranları internet ister. Çevrimdışıyken stüdyo bunu yazar; çekim ve yükleme kuyruğu çevrimdışı çalışmaya devam eder.
- **Sahip ve personel:**
  - Hesap ekranındaki "Galerie verwalten" bölümünü (Guthaben, Galerie-Einstellungen, Mitarbeitende) yalnız sahip görür.
  - Personel bu ekranların adresini elle açarsa hesap ekranına döner. Sunucuda da RLS ve `gallery-members` fonksiyonu yalnız sahibe izin verir.
  - Personel araç açar, çeker, işler, plakayı ve rötuşu düzeltir.
- **Galeri ayarları:** Her değişiklik hemen kaydedilir ve sonraki işlemede kullanılır. Daha önce işlenmiş araçlar stüdyoda "Neu rendern" ile kredisiz güncellenir.
- **Personel daveti:**
  - Yeni adrese 6 haneli kodlu davet e-postası gider. Yerelde Mailpit'e düşer (http://127.0.0.1:54324).
  - Hesabı olan kişi e-postasız eklenir.
  - Başka bir galeride üye olan hesap eklenemez, çünkü uygulama hesap başına bir galeri okur.
  - Çıkarılan kişinin hesabı silinmez.
- **Rötuş:** Yalnız maskesi olan dış açılarda görünür. Silmeler orijinalin koordinatlarında saklanır; her çizimde saklı maskeye yeniden uygulanır, Photoroom'a gidilmez.
- **Yeni geliştirme derlemesi:** M2b `expo-image-picker`, M2c `expo-media-library`, `expo-sharing` ve `@sentry/react-native` ekledi. Eski derleme bu modüller olmadan açılışta düşer (geliştirmede expo-router bütün ekranları baştan yükler), iki platformda da yeni derleme gerekir:

  ```bash
  cd apps/mobile && npx expo prebuild --clean
  ```

  Ardından yukarıdaki Android Gradle komutu ve iOS komutu çalıştırılır. `expo run:ios`'ta `--port` ile `--no-bundler` birlikte kullanılamaz.
  Sentry'nin sembol yüklemesi Debug derlemesinde kendiliğinden atlanır; yerelde Release derlenirse önüne `SENTRY_DISABLE_AUTO_UPLOAD=true` eklenir (yükleme yalnız EAS'te, Task 11'deki anahtarla yapılır).
- **Emülatörde logo ve banner denemesi:**
  - Test görseli galeriye şöyle eklenir: `adb push <dosya> /sdcard/Pictures/`, ardından `adb shell content call --method scan_volume --uri content://media --arg external_primary`.
  - Android'in fotoğraf seçicisi izin istemez. Banner, plaka oranında (520:110) sistemin kırpma ekranından geçer.
  - iOS'ta kırpma ekranı kare olduğu için banner'ın ortası alınır.

## Elle uçtan uca kontrol

Her sürümden önce iOS'ta ve Android'de yapılır:

1. Davetle hesap açılıyor.
2. Giriş ve çıkış çalışıyor.
3. Şifre kodla sıfırlanıyor.
4. İnternet yokken açılan araç listede görünüyor. İnternet gelince yükleniyor ve listedeki bekleme metni kayboluyor.
5. Bekleyen kayıt, uygulama kapatılıp açılınca duruyor.
6. Bekleyen kayıt, çıkış yapıp aynı kullanıcıyla girince duruyor ve yükleniyor.
7. Başka galerinin kullanıcısı bu galerinin araçlarını görmüyor.
8. Hesap silinince sunucudaki kullanıcı gidiyor ve uygulama giriş ekranına dönüyor.
9. Diğer cihazda açılan araç, uygulama arka plandan öne gelince ekrana dokunmadan listede beliriyor.
10. Yalnız gerçek cihazda: davet kabul ve şifre sıfırlamada iOS, yeni şifreyi kodla değil e-posta adresiyle kaydediyor.
