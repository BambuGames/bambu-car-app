# M3: Claude'dan OpenAI'ye geçiş — kısa tasarım

Onay: kullanıcı, 18 Kasım 2026 ("onaylıyorum").
Üst tasarım: `docs/superpowers/specs/2026-11-18-m3-vehicle-details-listing-design.md` (M3).

## Niyet

Ekip OpenAI API'sini zaten kullanıyor ve anahtarı var. M3'ün iki yapay zekâ işi, ilan metni yazma (`write-listing`) ve ekspertiz raporu okuma (`read-report`), Claude yerine OpenAI ile çalışacak. Kullanıcının gördüğü davranış değişmez.

## Hedefler

- `write-listing` ve `read-report` OpenAI Responses API ile çalışır.
- Ekranlar, akışlar, hata kodları ve şasi numarası kuralı aynı kalır. 20 MB sınırı da korunur.
- Testler gerçek API'ye hiç gitmez; sahte OpenAI sunucusu kullanılır.

## Hedef olmayanlar

- İki sağlayıcıyı birlikte tutmak ya da sağlayıcı seçimi eklemek.
- AB'de işleme. Şimdilik yapılmaz; `OPENAI_BASE_URL` ile sonradan tek satırla açılabilir.

## Yaklaşımlar

- **A. Claude modülünü OpenAI'nin resmi `openai` kütüphanesiyle değiştirmek.** Seçilen yol.
- **B. İki sağlayıcıyı bir anahtarla seçilebilir tutmak.** İki sahte sunucu ve iki test seti gerekir; ihtiyaç yok.
- **C. Anthropic SDK'yı OpenAI uyumlu bir aracıyla sürmek.** Yapılandırılmış çıktı ve PDF girişi uyuşmaz.

## Kararlar

- **Kütüphane:** `npm:openai@7.59.0`; yapılandırılmış çıktı için `openai/helpers/zod` içindeki `zodTextFormat` ve `client.responses.parse`. Kullanım kurulu kütüphanenin tiplerinden doğrulanır, tahmin edilmez.
- **Model ve efor:** Model `gpt-6.2-sol`. `reasoning.effort` ilan metni için `medium`, rapor için `high`. `max_output_tokens: 16000`.
- **Saklama:** Her istekte `store: false` gönderilir. OpenAI cevapları varsayılan olarak saklar; raporlarda şasi numarası, plaka ve sahip bilgisi olabilir. (Benim kararım.)
- **Ortam değişkenleri:** `OPENAI_API_KEY` ve `OPENAI_BASE_URL`. `OPENAI_BASE_URL` boşsa kütüphanenin varsayılan adresi kullanılır. Yerelde testler için `http://host.docker.internal:8091/v1` değerini alır. `ANTHROPIC_*` değişkenleri kaldırılır.
- **Sonuç okuma:**
  - Çıktıda `refusal` içeriği varsa `422 ai_refused`.
  - Cevap tamamlanmamışsa (`status` `completed` değil), istek ya da ağ hatası olursa ya da şema tutmazsa `502 ai_failed`.
  - Sunucu tarafı yedek model yoktur; reddedilen istek reddedilmiş kalır.
  - `model` alanı cevaptaki modeldir.
- **Şema:** OpenAI'de bütün alanlar zorunludur. Rapor şemasındaki isteğe bağlı alanlar `null` olabilen alanlara döner. Sunucudaki doğrulama ve listeler aynı kalır.
- **Rapor içeriği:**
  - PDF, `input_file` olarak gider; `file_data` `data:application/pdf;base64,…` biçimindedir.
  - Fotoğraflar `input_image` olarak gider; `image_url` bir data URL'dir.
  - OpenAI'nin dosya sınırı toplamda 50 MB'tır. 20 MB'lık uygulama sınırı yeterince altta kalır.
- **Sahte sunucu:**
  - `supabase/tests/integration/fakeClaude.ts`, `fakeOpenAI.ts` olur ve `POST /v1/responses`'a cevap verir.
  - Uygulamanın iki jest sahte sunucusu da aynı biçime geçer. Port 8091 olarak kalır.
- **Rapor yükleme notu (üç dil):** "Der Bericht wird zur Auswertung an OpenAI (USA) übermittelt. Die Datei wird gelöscht, sobald Sie die Vorschläge geprüft haben, spätestens nach 7 Tagen."
- **Belgeler:** M3 tasarımının Claude bölümleri, README'deki "Claude" bölümü ve `.env.example` OpenAI'ye göre yazılır.

## Kullanıcının işleri

- Eski anahtar iptal edildi. Yeni anahtarı kullanıcı `OPENAI_API_KEY` satırına yazdı.
- Gerçek çağrılar Görev 12'de, maliyet onayıyla yapılır. Tahmini maliyet yaklaşık $0,15–0,20.
- Buluta `secrets set` ve `functions deploy` ayrı onayla yapılır.

## Kurucuya kalanlar

- Yanıt nesnesinden metin, ret ve durum okunurken kütüphanenin gerçek alan adları kullanılır.
- Sahte sunucunun cevap biçimi, kütüphanenin `parse` yardımcısının kabul ettiği gerçek Responses API biçimine uyar.
