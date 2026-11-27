# Mağaza kurulumu — photocar.ai

Test sürümünü (TestFlight ve Play dahili test) çıkarmak için sıralı adımlar. **Sen** yazan adımlar
hesap girişi, şifre, ödeme ya da sözleşme isteyen adımlardır. **Ben** yazanlar her seferinde senin onayınla
yapılır. Form cevapları `forms.md`, mağaza metinleri `listing.md` dosyasında.

Durum (2026-11-26):
- Alan adı `photocar.ai` (Metunic) alındı; mail sunucusu yok. İletişim adresi `info@bambugames.com.tr`.
- Apple Developer bireysel hesap: satıcı **Mehmet Çakmak**.
- Play Console: geliştirici **Bambu Games**.
- Expo hesabı `mregodd` hazır.
- Uygulama kimliği `com.bambugames.photocar`.

## 0. Bilinmesi gerekenler

- **Apple bireysel hesap:** App Store'da satıcı olarak Mehmet Çakmak görünür. AB'de genel yayında onun
  adresi, telefonu ve e-postası herkese açık gösterilir (DSA). TestFlight'ı etkilemez. Şirket adıyla
  görünmesi için üyelik kuruma çevrilmeli (D-U-N-S) ya da uygulama sonra kurumsal hesaba aktarılmalı.
- **Play kişisel hesap ise:** Kasım 2023'ten sonra açılmış kişisel hesaplarda üretime çıkmadan önce
  14 gün boyunca en az 12 kişilik kapalı test gerekir. Dahili test bundan etkilenmez.
- **E-posta:** İletişim adresi `info@bambugames.com.tr`. Supabase davet e-postaları gönderim (SMTP)
  ister. SMTP kurulana kadar test hesaplarını Supabase panelinden elle açarız; uygulama içi davet
  e-postası gitmez.
- **Simülatör ve telefon:** Yeni kimlikle yeni bir geliştirme build'i gerekir (`npx expo run:ios`). Eski
  `com.bambugames.carapp` uygulaması cihazda ayrı uygulama olarak kalır.

## 1. Web sayfaları (photocar.ai)

Kaynak `site/` klasörü. Şirket bilgileri bambugames.com.tr'deki gizlilik politikasından alındı.
Künyede eksik: yönetim kurulu / temsilci adı ("Vertreten durch", DDG § 5). Gizlilik metni yayından
sonra da hukuki kontrolden geçmeli.

Barındırma: **GitHub Pages**, bu repodan (artık herkese açık). `.github/workflows/pages.yml`, `main`'e `site/`
değişikliği gelince ya da elle çalıştırılınca `site/` klasörünü yayınlar.

1. **Organizasyon sahibi (`bambugamess`):** Organizasyon ayarlarında Pages oluşturmayı açar. Yol: Settings →
   Member privileges → Pages creation → Public. Şu an kapalı; repo yöneticisi Pages açamıyor.
2. **Ben:** Repoda Pages'i "GitHub Actions" kaynağıyla açar, özel alan adını `photocar.ai` yaparım.
3. **Sen:** İş akışı dosyasını ve `site/`'ı commitleyip `main`'e alırsın. İlk yayın orada çalışır; ayrıca
   Actions sekmesinden elle de çalıştırılabilir.
4. **Sen, Metunic DNS:**

   | Tür | Ad | Değer |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `bambugames.github.io` |

5. **Ben:** Sertifika çıkınca (genelde 15 dakika–birkaç saat) Pages'te "Enforce HTTPS" açılır.
6. Önerilen: GitHub organizasyon ayarlarında `photocar.ai` için alan adı doğrulaması (bir TXT kaydı). Böylece
   başka bir hesap bu alan adını Pages'e bağlayamaz.
7. Sayfa değişikliği `site/` içinde yapılır; `main`'e gelince iş akışı yeniden yayınlar.
8. Adresler:
   - `https://photocar.ai/datenschutz/`
   - `https://photocar.ai/impressum/`
   - `https://photocar.ai/konto-loeschen/`
   - `https://photocar.ai/support/`

## 2. Expo projesi

1. **Ben:** `npx eas-cli init` ile expo.dev'de proje açılır. `app.json`'a `owner` ve `projectId`
   yazılır.
2. **Ben (URL'ler) / Sen (anahtarlar):** `production` ortamına EAS değişkenleri girilir:
   - `EXPO_PUBLIC_PRIVACY_URL=https://photocar.ai/datenschutz/`
   - `EXPO_PUBLIC_IMPRINT_URL=https://photocar.ai/impressum/`
   - `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` (bulut projesinin değerleri)
   - `EXPO_PUBLIC_SENTRY_DSN`

   ```bash
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_PRIVACY_URL --value https://photocar.ai/datenschutz/ --visibility plaintext
   ```

## 3. Bulut

Bulut M2 seviyesinde. Test sürümünün çalışması için M3–M5 fonksiyonları, göçler ve Cloud Run'daki
işleme servisi güncellenmeli. Sıra: fonksiyon → uygulama → göç. Her adım ayrı onayla yapılır.

## 4. iOS — TestFlight

1. **Sen:** Terminalde build başlatırsın. İlk seferde Apple ID ile giriş ve iki adımlı doğrulama sorulur.
   EAS bundle ID'yi kaydeder, dağıtım sertifikasını ve profili oluşturur.

   ```bash
   cd apps/mobile && npx eas-cli build -p ios --profile production
   ```

2. **Sen:** App Store Connect → Uygulamalar → + → Yeni Uygulama:
   - platform iOS
   - ad `photocar.ai` (alınmışsa kısa bir ek gerekir)
   - birincil dil Almanca
   - bundle ID `com.bambugames.photocar`
   - SKU `photocar-ios`
3. **Ben:** Build TestFlight'a gönderilir.

   ```bash
   npx eas-cli submit -p ios --latest
   ```

4. **İç test:** App Store Connect kullanıcıları (100 kişiye kadar), inceleme yok. **Dış test:** Beta App
   Review gerekir; demo hesap ve not `forms.md` dosyasında.
5. **Sen:** App Privacy, yaş derecelendirmesi ve gizlilik URL'si `forms.md`'den girilir.

## 5. Android — Play dahili test

1. **Sen:** Play Console → Uygulama oluştur:
   - ad `photocar.ai`
   - varsayılan dil Almanca (de-DE)
   - uygulama türü Uygulama, ücretsiz
2. **Ben:** AAB derlenir. Yükleme anahtarını EAS üretir, imzalamayı Play App Signing yapar.

   ```bash
   npx eas-cli build -p android --profile production
   ```

3. **Sen:** İlk AAB'yi Play Console'da Test → Dahili test → Yeni sürüm ile elle yüklersin. Google ilk
   yüklemeyi API'den kabul etmiyor.
4. Sonraki sürümler için Play'de bir servis hesabı açılır, JSON anahtarı EAS'e girilir;
   `npx eas-cli submit -p android` çalışır. `eas.json`'da kanal `alpha` (kapalı test); dahili test için
   `internal` yapılmalı.
5. **Sen:** Uygulama içeriği beyanları `forms.md`'den girilir:
   - gizlilik URL'si
   - reklam
   - uygulama erişimi
   - içerik derecelendirmesi
   - hedef kitle
   - veri güvenliği
   - hesap silme URL'si

## 6. Senden gerekenler

- **Künye için temsilci:** "Vertreten durch" satırı için yönetim kurulu başkanı ya da yetkili kişinin adı.
- **Pages oluşturma izni:** organizasyon sahibinin açması (Settings → Member privileges → Pages creation).
- **Metunic'te DNS kayıtları:** yukarıdaki tablo.
