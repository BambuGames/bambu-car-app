# Showroom arka planları, zemine basan gölge, beyaz dengesi — tasarım

Tarih: 2026-11-26. Durum: kullanıcı onayladı (2026-11-26).

## Amaç ve neden

26 Kasım toplantısındaki öneri:
- Stüdyo çıktılarında araçlar havada duruyor gibi görünüyor.
- Galeriler, gönderilen örnekteki gibi bir showroom görünümü istiyor: beyaz duvarlar, perspektifli karo zemin.

Atılacak örnekte (`scratchpad/showroom`) havada durmanın asıl nedeni gölgeydi. Bugünkü gölge yalnız en alttaki
satırın altında, tekerden ayrık bir leke; arka ve karşı tekerleklerin altında gölge yok. Sabit bir showroom görseli
ise araç açısıyla çelişiyor: önden çekilmiş araçta karolar çapraz kalıyor. Porsche örneğinde iki ek neden göründü:
alçak ve eğik kamera, sarı otopark ışığı.

Başarı: Test setindeki ve yeni çekimlerdeki araçlar her açıda zemine basıyor. Showroom'daki oda çekim açısıyla
birlikte dönüyor. Belirgin renk kaymalı fotoğraflar nötr ışıkta görünüyor.

## Hedefler

1. **Zemine basan gölge**, bütün arka planlarda (üç stüdyo + iki showroom):
   - görünen her tekerleğin altında koyu temas;
   - gövdenin altında zemin biraz koyu;
   - geniş ve yumuşak bir yarı gölge.
2. **İki showroom arka planı:**
   - **Showroom Weiß:** beyaz duvarlar, antrasit karo.
   - **Showroom Anthrazit:** koyu duvar, koyu zemin.
3. **Oda araçla birlikte döner.** Oda, aracın ortada park ettiği sabit bir kutudur; karolar aracın boyuna paraleldir.
   Her fotoğrafta oda, o çekim noktasının şablon kamerasından çizilir:
   - açı: slottan;
   - mesafe ve yön düzeltmesi: araç tipinden;
   - 1 m yükseklik, 69° yatay açı.
4. **Odayı fotoğrafın eğimiyle çizmek:**
   - Uygulama bundan sonra telefonun işaretli eğimini kaydeder.
   - Kamera aşağı ya da yukarı bakıyorsa oda aynı eğimle çizilir. Araç, zemindeki temas noktasıyla birlikte dikey
     kaydırılır; boyu değişmez.
   - İşaretli eğimi olmayan eski fotoğraflar düz kamerayla çizilir.
5. **Beyaz dengesi:**
   - Belirgin renk kayması olan fotoğraflarda ışığın rengi aracın çevresinden tahmin edilir.
   - Araç nötr ışığa çekilir: kısmen, sınırlı ve yalnız eşik aşıldığında.
   - Gün ışığındaki fotoğraflar pratikte değişmez.
6. **Uygulama:**
   - Stüdyo ekranındaki arka plan seçicide showroom'lar kendi küçük önizlemeleriyle görünür.
   - "Yeniden çiz" (kredisiz) yeni arka planlarla çalışır.

## Hedef dışı (bu tur)

- Duvarda galeri logosu (örnek görseldeki gibi).
- Zeminde aracın yansıması.
- Kamera yüksekliğini tahmin etmek: yalnız eğim kullanılır.
- Çok alçak, çok yakın ya da karışık ışıklı kareler için stüdyoda "showroom'da yapay görünebilir" uyarısı.
- Galerinin kendi arka plan görseli yüklemesi.
- Detay ve iç mekân kareleri; bunlar bugünkü gibi arka plansız kalır.
- Afiş şablonu.

## Olmaması gerekenler

- Araç açısıyla çelişen bir oda: sabit tek görsel.
- Gölgesi tekerden kopuk, havada duran araç.
- Boya rengini değiştiren beyaz dengesi. Örneğin kırmızı tuğla duvar önündeki beyaz araç pembeye dönmemeli.
- İşlemenin hissedilir yavaşlaması: araç başına ilk seferde birkaç saniyeden fazla değil.

## Yaklaşımlar

**Arka plan kaynağı:**
- **Kendi çizimimiz (seçildi):** Oda kodla, şablon kamerasıyla çizilir. Geometri yerleşimle birebir uyar; lisans ve
  maliyet yok; varyant ve açı başına çizim mümkün.
- **Yapay zekâ görseli (elendi):** Ufuk ve kamera şablona uymaz; her üretim farklı; ücretli servis.
- **Stok fotoğraf (elendi):** Aynı uyumsuzluk; bayi ilanlarında yeniden dağıtım lisansı belirsiz.

**Oda sabit mi, döner mi:**
- **Sabit tek görsel (ilk örnek, elendi):** Kullanıcı açıyla çeliştiğini gördü.
- **Odayı açıya göre çizmek (seçildi).**

**Showroom görseli nerede üretilir (benim kararım):**
- **İşleme servisinde, parametreden, o anda (seçildi):** `spec` içinde renkler ve ayarlar durur, dosya yok. Servis
  `(spec, araç tipi, slot, eğim)` için odayı çizer ve bellekte tutar. Yükleme adımı ve dosya senkronu yok.
- **Önceden çizilmiş dosyalar (elendi):** Showroom başına 4 araç tipi × 8 slot × eğim adımları kadar dosya gerekir;
  bucket'a yükleme ve sürüm takibi ister. Eğimle çizim bunu dosyayla pratikte imkânsız kılıyor.

## Kararlar

**Spec:** Yeni tür `{"kind": "showroom", ...}`.
- Alanları: duvar renkleri, tavan, karo, derz, parlaklık, karo ölçüsü.
- Mevcut `studio` ve `image` türleri olduğu gibi kalır.
- Uygulamada `BackgroundSpec` bu türü de kapsar; tanımadığı türde bugünkü gibi boş önizleme gösterir.

**Oda geometrisi:**
- Araç merkezi orijinde; dünya ekseni `tools/templates` ile aynı: +x ön, +y sol, +z yukarı.
- Oda, aracın etrafında kutu: yaklaşık x −7,5…8,5 m, y −6,5…7 m, tavan 4,2 m, karo 0,8 m.
- Kutu, köşeler açıdan açıya farklı yerlere düşsün diye araca göre hafif kaydırılmış.
- Kamera konumu ve yönü şablonla aynı formül (`_to_camera`): slot açısı, araç tipinin `distanceM` değeri ve
  `center_yaw`.
- `other` tipi için dört tipin ortalaması (bugünkü `template_box` gibi).
- Çıktı 2560×1920; düz kamerada ufuk tam ortada.

**Şablon verisi:** Servisin `templates.json` dosyası bugün yalnız kutuları taşıyor.
- `tools/templates/templates.py`, şablon JSON'una `yawDeg` yazar.
- `export-worker`, `distanceM` ve `yawDeg` değerlerini de dışa aktarır.
- Kutular değişmez; mevcut şablon testleri bunu korur.

**Eğim:**
- Uygulama her çekimde işaretli eğimi kaydeder: `capture.pitchSignedDeg`, kamera aşağı bakarken pozitif.
- Mevcut `pitchDeg` (işaretsiz) kalite kontrolü için olduğu gibi durur.
- Eğim yalnız showroom'larda kullanılır. Stüdyo zeminleri bugünkü gibi düz kamerayla kalır; her fotoğrafta ufku
  oynamasın diye (benim kararım).
- Servis kamerayı bu eğimle çizer. Eğim, kalite kontrol sınırında (±20°) kırpılır.
- Araç, temas noktasının o eğimde düştüğü satıra kaydırılır; boyu şablondaki gibi kalır. Kayma kareden taşırıyorsa
  taşmayacak kadar kısılır.
- İşaret iOS ve Android'de gerçek telefonda doğrulanır (telefon turu 2). Doğrulanana kadar özellik açık kalır, ama
  işaret testi turun kontrol listesine yazılır.

**Gölge:** Yerleştirilmiş araç maskesinden üretilir.
- Her sütunda aracın en alt noktası, yani alt çizgisi bulunur.
- Bu çizginin alttan dışbükey zarfı zemin çizgisi sayılır; tekerlek temasları bu çizgi üzerindedir.
- Üç katman:
  - **Temas:** Zemin çizgisine yakın sütunlarda (lastikler) koyu ve ince.
  - **Gövde altı:** Alt çizgi ile zemin çizgisi arasında, gövdeye yakın yerde daha koyu, yumuşak.
  - **Yarı gölge:** Zemin çizgisinin altında geniş ve yumuşak.
- **Uzak tekerlekler (benim kararım):**
  - Çapraz açılarda görünen uzak tekerlek çoğunlukla silüetin bir ucundadır; zemin çizgisinin üzerinde kalır ve
    temas alır.
  - Çizginin üstünde kalan bir uzak tekerlek yalnız gövde altı gölgesini alır.
  - Ayrıca tekerlek tespiti bu turda yok. Test, ucunda uzak tekerlek olan üç tekerlekli bir maskeyle de yapılır.
- Bugünkü `contact_shadow` bunun yerine geçer.
- Atılacak örnekteki değerler başlangıç: temas 0,85, gövde altı 0,22–0,42, yarı gölge 0,22.

**Beyaz dengesi:**
- Işık rengi, `_analyze` sırasında araç maskesinin dışındaki ve doymuşluğu düşük (nötre yakın) piksellerden tahmin
  edilir.
- Sapma eşiği aşarsa kanal kazançları hesaplanır; kısmi uygulanır ve sınırlanır.
- Kazançlar `tone_stats` içinde saklanır, migration gerekmez. Ton istatistikleri dengelenmiş görüntüden ölçülür.
- Render, kazançları ton düzeltmesinden önce aracın pikselleri için uygular. Detay ve iç mekân karelerine de aynı set
  üzerinden uygulanır.
- **Kapatma (benim kararım):** Stüdyodaki "Renk eşitleme" anahtarı (`tone_enabled`) beyaz dengesini de açıp
  kapatır; yanlış renk veren bir fotoğrafta kullanıcının çıkış yolu budur. Anahtarın açıklaması üç dilde
  güncellenir: fotoğrafları birbirine ve nötr ışığa yaklaştırır.
- Kazancı olmayan eski fotoğraflar değişmez. Kabul ölçüsü M0 setinde:
  - otopark fotoğrafları (Porsche, Egea) belirgin şekilde nötrleşir;
  - gün ışığındaki fotoğrafların kazançları ±%3 içinde kalır.

**Önbellek ve hız (benim kararım):**
- Bir oda çizimi atılacak örnekte tam çözünürlükte yaklaşık 1–1,5 sn sürdü; araç başına 8 oda.
- İşleme servisi Cloud Run'da 2 vCPU, 2 GiB, eşzamanlılık 2 ve en az 0 instance ile çalışıyor. Bellekteki önbellek
  çoğu zaman soğuk başlar.
- **Çözünürlük:** Oda 1280×960'ta çizilip 2560×1920'ye büyütülür. Zaman ve bellek yaklaşık dörtte birine iner.
  Derzlerin büyütmeden sonra okunur kaldığı gözle kontrol edilir.
- **Hesap:** Çizim float32 ile yapılır. Derz yumuşatmasının türevi yarım çözünürlükte komşu piksel farkıyla alınır.
  Tam boy ara dizi sayısı en azda tutulur.
- **Paralellik:** Bir aracın odaları Photoroom analiziyle paralel çizilir (`ANALYSIS_THREADS` havuzunda).
- **Önbellek:** `(spec, araç tipi, slot, eğimin 1°'ye yuvarlanmış hâli)` anahtarıyla bellekte LRU.
- **Bütçe:**
  - Araç başına ek süre, soğuk başlangıçta en çok yaklaşık 8 sn.
  - Bir çizimin bellek tepe noktası ≈ 300 MB altında; iki araç aynı anda 2 GiB'ı aşmaz.
- **Hazır görsel yok:** Odalar Docker imajına önceden çizilip konmaz.
- Bütçe tutmazsa Cloud Run'ın CPU ya da belleğini artırmak ücret demek; ancak kullanıcının onayıyla yapılır.

**Veritabanı:**
- Migration iki platform satırı ekler: `Showroom Weiß` ve `Showroom Anthrazit`, `sort_order` 4 ve 5.
- Varsayılan arka plan `Studio Weiß` olarak kalır.

**Uygulama önizlemesi:**
- `BackgroundSwatch` showroom türünü Skia ile çizer: köşeden bakan iki duvar, zemin ve birkaç derz çizgisi,
  spec renkleriyle.
- Görsel dosya ve imzalı adres gerekmez.

**Dağıtım sırası:**
1. Servis: yeni türü çizebilmeli.
2. Uygulama.
3. Migration: satırlar ancak bundan sonra görünür.

Mevcut "fonksiyon → uygulama → göç" sırasıyla aynı. Eski servis `showroom` türünü tanımaz; bu yüzden satırlar ondan
önce eklenmez.

## Test

**Servis (pytest):**
- Oda çizimi:
  - düz kamerada ufuk orta satırda; zemin ufkun altında, duvarlar üstünde;
  - aynı girdi aynı çıktıyı verir;
  - önden bakışta (`front`) derzler orta dikeye göre simetrik;
  - eğim aşağıyken ufuk yukarı kayar.
- Gölge:
  - farklı yükseklikte iki tekerlekli sentetik maskede iki tekerin hemen altında da temas var;
  - aracın dışında, alt çizginin üstünde gölge yok;
  - en yüksek değer sınırı korunuyor.
- Beyaz dengesi:
  - sarı ışıklı sentetik sahne nötrleşiyor;
  - nötr sahne değişmiyor;
  - renkli tek duvar önündeki nötr araç boyanmıyor.
- Pipeline: showroom spec'inde her fotoğraf kendi slotunun odasını alıyor; eğimli fotoğrafta araç kayıyor.

**Şablonlar:** `export-worker` çıktısında `distanceM` ve `yawDeg` var; kutular değişmedi.

**Uygulama (jest):** İşaretli eğim kaydı (işaret) ve showroom önizlemesinin çizimi.

**Gözle kontrol:**
- M0 setinden 8–10 araç iki showroom'da ve üç stüdyoda.
- Crossland'ın dört açısı aynı odada.

## Kurucuya kalanlar

- Işık ve renk değerlerinin ince ayarı.
- Eşik ve kazanç sınırları.
- Önizleme çiziminin ayrıntısı.
- Önbellek boyutu.
- İşaret dönüşümünün platform ayrıntısı (gerçek cihazda doğrulanır).
