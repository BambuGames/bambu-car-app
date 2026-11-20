# M5: Roller — Tasarım

Tarih: 19 Kasım 2026. Üst tasarım: `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md` (bölüm 4, roller). Bu belge oradaki rol tablosunun işleme satırını değiştirir.

## 1. Niyet

Galeri sahibi, galerinin kredisini ve galeri adına yayınlanan ilanı elinde tutmak istiyor. Kullanıcının sözü (19 Kasım 2026): "Personel kredi harcamasın, ilanı sadece sahip inceleme yapmak isterse yapsın sonrasında o yayınlasın".

## 2. Kurallar

- **Kredi yalnız sahibin:** kredi düşüren ilk işlemeyi yalnız sahip başlatır. **[Karar]**
- **İlanı sahip yayınlar:** personel ilanı hazırlar (fotoğraflar, araç bilgileri, ilan metni). Sahip isterse inceler ve düzeltir, sonra kendisi yayınlar. **[Karar]** Bu aşamada "yayınla" adımı yoktur; kural, pazar yeri aşamasında bu yetkiyle kurulur.
- **Paylaşım personelde kalır:** WhatsApp/Instagram paylaşımı ve dışa aktarma personelde kalır. **[Karar]**
- **Roller ikiyle sınırlı kalır:** sahip ve personel. **[Benim kararım]**
- **Yapay zekâ özellikleri personelde kalır:** ilan metni üretme ve rapor okuma kredi harcamaz; personel kullanmaya devam eder. Maliyeti Bambu Games'e yansır, galeriye değil. **[Benim kararım]**

## 3. Hedef olmayanlar

- İşleme talebi ve onay akışı (yol B).
- Personele kredi hakkı ya da kişi bazlı yetki tablosu.
- Bildirim (push). Bekleyen iş araç listesinden görülür.
- Pazar yerindeki inceleme ve yayın ekranları: pazar yeri aşamasında yapılır.

## 4. Yaklaşımlar

| | Yol | Artı | Eksi |
|---|---|---|---|
| **A** | **Tek kural ve bekleme etiketi** | **Tek sunucu kuralı; yeni tablo ya da ekran yok** | **Personel "hazır" dediğini ayrıca bildiremez; liste etiketi bunu çekimden çıkarır** |
| B | İşleme talebi: personel "Sahibe gönder"e basar, sahip onaylar | Personel hazır olduğunu açıkça bildirir | Yeni tablo, durumlar ve ekran; uygulamanın zaten bildiği "çekim tamam" bilgisini tekrarlar |
| C | Personele kredi hakkı veya kişi bazlı yetki tablosu | Esnek | "Personel kredi harcamasın" kuralına ters; iki rollü pilot için fazla |

Kullanıcı A'yı seçti.

## 5. Davranış

### 5.1 Sunucu kuralı

Bugün `public.start_processing`, bir araç için ilk çağrıldığında 1 kredi düşer (`credit_ledger`, `reason = 'vehicle'`). Aynı araçtaki sonraki çağrılar ücretsizdir: rötuş, plaka, arka plan ya da filigran değişimi ve yeniden çekilen fotoğraf.

- **Kredi düşecekse:** çağıran sahip değilse fonksiyon `not_owner` hatası verir. Bu durumda kredi düşmez ve hiçbir fotoğraf kuyruğa girmez.
- **Araç daha önce ücretlendirildiyse:** personel işlemeye devam eder; davranış bugünkü gibidir.
- **Uygulamaya ulaşan cevap:** `process-vehicle` fonksiyonu bu hatayı `403 { error: 'not_owner' }` olarak döndürür. Bugünkü `not_member` ile karışmamalıdır.
- Kural sunucudadır. Uygulama atlatılsa bile geçerlidir.

### 5.2 Stüdyo ekranı (personel)

- Araç henüz ücretlendirilmediyse personel "Bearbeiten" düğmesini görmez. Onun yerine şu not çıkar: "Dieses Fahrzeug verarbeitet der Inhaber der Galerie."; Türkçe ve İngilizce karşılıkları dil dosyalarına girer.
- İlk kredi notu (`studio.firstCharge`) personele gösterilmez.
- Araç ücretlendirildikten sonra personel ekranı bugünkü gibidir.
- Sunucu yine de `not_owner` dönerse (örneğin önbellekteki rol eskiyse), stüdyo aynı notu hata olarak gösterir.

### 5.3 Araç listesi (herkes)

- **Yeni etiket:** "İşlenmeyi bekliyor"; Almancası "Wartet auf Verarbeitung", İngilizcesi "Waiting for processing".
- **Ne zaman çıkar:** aracın durumu `shooting`, sekiz dış açının hepsi çekilmiş (`EXTERIOR_SLOTS`) ve telefonda yüklenmeyi bekleyen fotoğraf yok. Bu durumda listedeki "Fotos werden aufgenommen" yerine bu etiket görünür.
- **Kimin için ne anlama gelir:** sahip için bu "sıra sende" demektir; personel için "sahipte bekliyor".
- Etiketin kararı saf bir yardımcı fonksiyondan çıkar ve jest testi olur.
- Listenin sırası değişmez. **[Benim kararım]**

### 5.4 Değişmeyenler

Bugün sahibe ait olanlar sahipte kalır:
- galeri ayarları,
- personel yönetimi,
- kredi geçmişi.

Personel geri kalan her şeyi yapmaya devam eder:
- araç açma ve çekim,
- araç bilgileri,
- ilan metni ve rapor okuma,
- ilk işlemeden sonraki ücretsiz işlemler,
- dışa aktarma ve paylaşım.

## 6. Kısıtlar

- Yeni bir veritabanı göçü `start_processing`'i yeniden tanımlar. Göç yalnız yerelde uygulanır; buluta gönderim ve fonksiyon yüklemesi kullanıcının onayıyla yapılır.
- Yeni yerel paket yoktur, uygulamanın yeniden derlenmesi gerekmez.
- Yeni metinler üç dil dosyasına girer. /no-slop-ui ve React Compiler kuralları geçerlidir.
- Testler:
  - veritabanı testi: personel ilk işlemede reddedilir; sahip ücretlendirir; personel ücretlendirilmiş araçta işleyebilir;
  - `process-vehicle` için entegrasyon testi (403 `not_owner`);
  - liste etiketi ve stüdyo görünümü için jest.

## 7. Kurucuya kalanlar

- Personel notunun ve etiketin kesin yazımı (üç dil).
- Üst tasarımdaki (2026-11-03) rol tablosunun "Galeri personeli" satırının bu belgeye göre güncellenmesi.
