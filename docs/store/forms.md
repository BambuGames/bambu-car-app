# Mağaza formları — photocar.ai

App Store Connect ve Play Console'daki beyan formlarının cevapları. Cevaplar 2026-11-26 tarihli koda
dayanır. Uygulamaya yeni bir veri akışı (analitik, konum, bildirim, satın alma) eklenirse bu dosya ve
formlar güncellenmeli. Köşeli parantezli yerler sonradan doldurulur. Kurulum sırası: `setup.md`.

| Sayfa | Adres | Kaynak |
|---|---|---|
| Gizlilik politikası | `https://photocar.ai/datenschutz/` | `site/datenschutz/` |
| Künye (Impressum) | `https://photocar.ai/impressum/` | `site/impressum/` |
| Hesap silme | `https://photocar.ai/konto-loeschen/` | `site/konto-loeschen/` |
| Destek | `https://photocar.ai/support/` | `site/support/` |

Uygulama kimliği iki mağazada da `com.bambugames.photocar`.

## Uygulamanın gönderdiği veriler (kaynak)

| Veri | Nereye | Neden | Kodda |
|---|---|---|---|
| E-posta adresi, kullanıcı kimliği | Supabase (Frankfurt) | Hesap ve giriş | `lib/session.tsx`, Supabase Auth |
| Araç fotoğrafları, galeri logosu ve plaka banner'ı | Supabase Storage; işleme için Photoroom ve Google Cloud Run (Frankfurt) | Stüdyo fotoğrafı | `services/image-worker` |
| Araç bilgileri (aracın konumu/Standort dahil), hasar şeması, ilan metni | Supabase; ilan metni için OpenAI (ABD, şasi numarası hariç) | Uygulama işlevi | `functions/write-listing` |
| Ekspertiz raporu (PDF ya da fotoğraf) | Supabase; okuma için OpenAI (ABD). İnceleme sonrası, en geç 7 günde silinir | Rapor okuma | `functions/read-report`, `functions/clean-reports` |
| Galerinin telefon ve WhatsApp numarası | Supabase | Paylaşım afişinde gösterilir | Galeri ayarları |
| Çökme raporu ve cihaz bilgisi | Sentry (AB) | Hata düzeltme; kullanıcı kimliği, ekran görüntüsü ve adres parametreleri gönderilmez | `lib/telemetry.ts` |

Olmayanlar:
- reklam ve izleme (tracking);
- kullanım analitiği;
- cihaz konumu;
- kişiler ve takvim;
- uygulama içi satın alma;
- push bildirimi.

Photoroom, OpenAI, Google Cloud ve Sentry bizim adımıza işleyen hizmet sağlayıcılardır. İki mağazanın
tanımında da bu "paylaşım" sayılmaz, ama gizlilik politikasında adları geçmelidir.

---

## App Store Connect

### App Privacy (Uygulama gizliliği)

**Data collection:** Yes, we collect data.

| Data type | Linked to the user | Tracking | Purpose |
|---|---|---|---|
| Contact Info → Email Address | Yes | No | App Functionality |
| Contact Info → Phone Number | Yes | No | App Functionality |
| Identifiers → User ID | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes | No | App Functionality |
| User Content → Other User Content | Yes | No | App Functionality |
| Diagnostics → Crash Data | No | No | App Functionality |
| Diagnostics → Other Diagnostic Data | No | No | App Functionality |

- **Telefon numarası:** Galerinin afişte görünen iş numarası. Kişisel numara da olabileceği için beyan ediliyor.
- **Diğer kullanıcı içeriği:** Araç bilgileri (aracın konumu dahil, elle yazılan metin), ilan metinleri ve ekspertiz raporları.
- **Tracking:** Hiçbiri. App Tracking Transparency izni gerekmez.

### Yaş derecelendirmesi (Age Rating)

Bütün sorular *None* ya da *No*. Uygulama yalnız belirli hukuki sayfaları uygulama içi tarayıcıda açar,
serbest web erişimi yoktur. Kullanıcı içeriği yalnız aynı galerinin ekibine görünür; herkese açık bir
paylaşım alanı yoktur.

**Beklenen sonuç:** 4+

### Şifreleme (Export Compliance)

- Uygulama yalnız HTTPS kullanıyor, yani muafiyet kapsamında.
- Soru: "Does your app use encryption?"
  - Cevap: Yes.
  - Ardından muaf olduğu seçilir (yalnız standart şifreleme).
- `app.json`'daki `ios.config.usesNonExemptEncryption: false` derlemede `ITSAppUsesNonExemptEncryption = false`
  olur. App Store Connect bu yüzden soruyu her yüklemede sormaz; `appConfig.test.ts` bu ayarı korur.

### Hesap

- **Giriş gerekli:** Evet, ama kayıt yok. Hesaplar davetle açılıyor.
- **Hesap silme:** Uygulama içinde: Konto → Konto löschen (guideline 5.1.1(v)).
- **Sign in with Apple:** Gerekmez. Üçüncü taraf ya da sosyal giriş yok.
- **Uygulama içi satın alma:** Yok. Kredileri işletmeci sözleşmeyle tanımlar. Uygulamada satın alma
  bağlantısı ya da yönlendirmesi de yok (guideline 3.1.1 ve 3.1.3).

### App Review notu (İngilizce, "Notes" alanı)

```text
photocar.ai is a business tool for car dealerships (B2B). Accounts are created by invitation only; there is no sign-up in the app.

Please sign in with the demo account:
Email: [DEMO EMAIL]
Password: [DEMO PASSWORD]

The demo gallery "Bambu Demo" already contains processed vehicles, so the studio results, vehicle data, listing text and share poster can be seen without shooting a car.

To try the full flow on a device:
1. Tap "Neues Fahrzeug" (New vehicle), enter a make and model, pick a body type.
2. Open the camera and shoot the car (any car or a printed photo of one works). The camera needs a physical device.
3. In "Studio", pick a background and tap "Bearbeiten" (Process). This uses 1 of the demo gallery's credits; credits are assigned by us under a B2B agreement. There are no purchases in the app and no links to buy anything.
4. "Inseratstext" (Listing text) writes a text with OpenAI from the vehicle data. "Bericht auslesen" (Read report) sends an uploaded inspection report to OpenAI; the screen states this before the user starts.
5. "Teilen" (Share) creates a poster and opens the share sheet.

The app's language follows the device language (German, Turkish or English).
Account deletion: Konto (Account) → Konto löschen (Delete account).
```

### Beta App Review (TestFlight dış test)

- **Beta App Description:** `listing.md` → TestFlight bölümü.
- **Feedback Email:** `info@bambugames.com.tr`
- **Sign-in information:** Yukarıdaki demo hesap.
- **İnceleme notu:** App Review notunun aynısı.

### AB satıcı bilgisi (DSA trader status)

- **TestFlight için:** Gerekmez.
- **AB'de genel yayın için:** Satıcının adresi, telefonu ve e-postası App Store'da herkese açık gösterilir;
  yayından önce girilir.
- **Hesap bireysel:** App Store'da satıcı **Mehmet Çakmak**. AB'de genel yayında Mehmet Çakmak'ın adresi,
  telefonu ve e-postası gösterilir. Şirket adıyla görünmesi için üyeliğin kuruma çevrilmesi (D-U-N-S
  numarası gerekir) ya da uygulamanın kurumsal hesaba aktarılması gerekir. Play'de geliştirici **Bambu Games**.

---

## Google Play Console

### Data safety (Veri güvenliği)

- **Does your app collect or share any of the required user data types?** Yes
- **Is all of the user data collected by your app encrypted in transit?** Yes
- **Do you provide a way for users to request that their data is deleted?** Yes. Uygulama içinde ve
  aşağıdaki web sayfasıyla.

**Shared:** Hiçbiri. Hizmet sağlayıcılar bizim adımıza işler; Play'in tanımında bu paylaşım değildir.

| Category → type | Collected | Required? | Purposes |
|---|---|---|---|
| Personal info → Email address | Yes | Required | App functionality, Account management |
| Personal info → User IDs | Yes | Required | App functionality, Account management |
| Personal info → Phone number | Yes | Optional | App functionality |
| Photos and videos → Photos | Yes | Required | App functionality |
| Files and docs → Files and docs | Yes | Optional | App functionality |
| App activity → Other user-generated content | Yes | Required | App functionality |
| App info and performance → Crash logs | Yes | Required | Analytics |
| App info and performance → Diagnostics | Yes | Required | Analytics |

- Satırların hiçbirinde *Processed ephemerally* işaretlenmez.
- **Dosyalar:** Ekspertiz raporları. İnceleme sonrası, en geç 7 günde silinir.
- **Telefon numarası:** Galerinin afişteki iş numarası.

### App access (Uygulama erişimi)

- **Seçim:** "All or some functionality is restricted".
- **Talimat adı:** "Demo account"
- **Bilgiler:** Demo e-posta ve şifresi.
- **Not:** App Review notunun kısa hâli.

### Diğer beyanlar

| Form | Cevap |
|---|---|
| Ads | No, my app does not contain ads |
| Content rating | Kategori: "All other app types" (yardımcı ve verimlilik). Şiddet, cinsellik, dil, madde ve kumar soruları No. Kullanıcı etkileşimi: yalnız aynı galerinin ekibi, yabancılarla iletişim yok. Konum paylaşımı: No. Dijital ürün satın alma: No. Beklenen sonuç: PEGI 3, USK 0, Everyone |
| Target audience | Yalnız 18 ve üzeri (işletme uygulaması). Böylece aile politikası kapsamına girmez |
| News app | No |
| Government app | No |
| Financial features | None |
| Health | None |
| Account deletion | Uygulama içi yol ve aşağıdaki sayfanın adresi |

### Hesap silme sayfası (web)

Play, uygulama dışında açılan bir sayfa ister: `https://photocar.ai/konto-loeschen/` (taslağı
`site/konto-loeschen/`). İçermesi gerekenler:

1. Uygulamanın adı (photocar.ai) ve geliştirici (Bambu Games).
2. **Uygulama içinden silme:** Konto → Konto löschen. Giriş bilgileri ve hesap hemen silinir.
3. **Uygulamaya giremeyenler için:** `info@bambugames.com.tr` adresine, hesabın e-posta adresinden yazarak silme isteği.
4. **Silinen veriler:** E-posta adresi, kullanıcı kimliği, hesaba bağlı oturumlar.
5. **Kalan veriler:**
   - Galerinin araçları ve fotoğrafları galeriye aittir, hesap silinince galeride kalır. Galeri
     sahibinin isteğiyle silinir.
   - Kredi hareketleri ticaret ve vergi hukukunun saklama süreleri boyunca (10 yıla kadar) saklanır.
   - Ekspertiz raporları zaten en geç 7 günde silinir.

---

## Gizlilik politikasında geçmesi gerekenler

Almanca taslak `site/datenschutz/` içinde; yayından önce hukuki kontrolden geçmeli. Mağaza beyanlarıyla
tutarlı olması için içermesi gerekenler:

- **Sorumlu:** Bambu Games (unvan, adres, iletişim).
- **Veriler:**
  - Hesap: e-posta, kullanıcı kimliği.
  - Galeri ayarları: logo, banner, telefon, WhatsApp.
  - Araç verileri (aracın konumu dahil), fotoğraflar, ekspertiz raporları.
  - Çökme raporları.
- **Hizmet sağlayıcılar ve yerleri:**
  - Supabase (AB, Frankfurt)
  - Google Cloud Run (AB, Frankfurt)
  - Photoroom (fotoğraf işleme)
  - OpenAI (ABD; ilan metni ve rapor okuma, şasi numarası gönderilmez)
  - Sentry (AB)
- **ABD'ye aktarım:** Hukuki dayanak (ör. AB standart sözleşme maddeleri ya da Data Privacy Framework).
- **Saklama süreleri:** Ekspertiz raporları en geç 7 gün; diğerleri hesap ya da galeri silinene kadar.
- **Haklar:** Erişim, düzeltme, silme, itiraz, şikâyet hakkı (KVKK değil, GDPR).
- **Ne yapılmadığı:** Reklam, izleme ya da veri satışı yok.
