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

## Geliştirme hesapları

Hesaplar seed'den gelir. Hepsinin şifresi `dev-password-1`.

| E-posta | Galeri | Rol |
|---|---|---|
| owner@bambu.test | Testgalerie | owner |
| staff@bambu.test | Testgalerie | staff |
| other@bambu.test | Andere Galerie | owner |

`other@bambu.test`, galerilerin birbirinin araçlarını görmediğini kontrol etmek için var.

## Yerelde birini davet etme

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
