# M3 OpenAI Geçişi Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `write-listing` ve `read-report` fonksiyonları Claude yerine OpenAI Responses API ile çalışır; kullanıcının gördüğü davranış aynı kalır.

**Architecture:**
- `supabase/functions/_shared/claude.ts`'in yerini `_shared/ai.ts` alır. Aynı `askJson` sözleşmesini resmi `openai` kütüphanesiyle uygular.
- İki fonksiyon yalnız içerik bloklarının biçimini değiştirir.
- Testlerdeki sahte Messages API'nin yerini `POST /v1/responses`'a cevap veren sahte bir OpenAI sunucusu alır.

**Tech Stack:** Deno 2 Edge Functions, `npm:openai@7.59.0` (`openai/helpers/zod` → `zodTextFormat`), `npm:zod@4.6.7`, node:test entegrasyon testleri, jest (apps/mobile).

**Spec:** `docs/superpowers/specs/2026-11-18-m3-openai-switch-design.md` (üst tasarım: `docs/superpowers/specs/2026-11-18-m3-vehicle-details-listing-design.md`)

## Global Constraints

- **Model ve efor:** Model `gpt-6.2-sol`. `reasoning: { effort }`, `write-listing` için `'medium'`, `read-report` için `'high'`. `max_output_tokens: 16000`.
- **Saklama:** Her istekte `store: false` gönderilir.
- **Ortam değişkenleri:** `OPENAI_API_KEY`, `OPENAI_BASE_URL`. `OPENAI_BASE_URL` boşsa kütüphane varsayılanı kullanılır. Yerel `supabase/functions/.env`'de `OPENAI_BASE_URL=http://host.docker.internal:8091/v1` durur. `ANTHROPIC_*` her yerden kalkar.
- **Sonuç eşleme:**
  - Çıktıda `refusal` içeriği varsa → `{ ok: false, error: 'ai_refused' }` → HTTP `422 ai_refused`.
  - Cevap tamamlanmadıysa (`status` `'completed'` değil), istek ya da ağ hatası olursa, ayrıştırılmış çıktı yoksa ya da şema tutmazsa → `ai_failed` → HTTP `502 ai_failed`.
  - `model` = cevaptaki model.
- **Şema:** OpenAI yapılandırılmış çıktısında bütün alanlar zorunludur. İsteğe bağlı alan `null` olabilen alanla taklit edilir.
- **Rapor içeriği:**
  - PDF: `{ type: 'input_file', filename, file_data: 'data:application/pdf;base64,…' }`.
  - Fotoğraf: `{ type: 'input_image', image_url: 'data:image/jpeg;base64,…' }` (png için `image/png`).
  - Uygulamanın 20 MB toplam sınırı aynı kalır.
- **Rapor yükleme notu:**
  - Almanca, birebir: "Der Bericht wird zur Auswertung an OpenAI (USA) übermittelt. Die Datei wird gelöscht, sobald Sie die Vorschläge geprüft haben, spätestens nach 7 Tagen."
  - Türkçe ve İngilizce aynı anlamla yazılır; "Anthropic" kelimesi hiçbir dil dosyasında kalmaz.
- **Kurallar (kullanıcının):**
  - Gerçek OpenAI çağrısı yapılmaz; testler sahte sunucuya gider.
  - `supabase/functions/.env` değerleri hiçbir koşulda yazdırılmaz, okunup gösterilmez, loglanmaz. İçindeki gerçek `OPENAI_API_KEY`'e dokunulmaz.
  - `git commit`/`add` yok.
  - `supabase db reset` yok.
  - Bulut değişikliği yok.
  - Kütüphane kullanımı kurulu `openai` paketinin tiplerinden doğrulanır, tahmin edilmez.
  - Tipleri okumak için paket yalnız scratchpad'deki geçici bir klasöre kurulur.
- **Değişmeyenler:** fonksiyonların istek ve cevap gövdeleri, hata kodları, şasi numarası ve plaka kuralı, hasar onayı kuralı, yetki kontrolleri, `report_reads` yaşam döngüsü, uygulama ekranları.

## Review Focus

1. **Model reddeder:** Metin ya da öneri kaydedilmemeli; 422 dönmeli, okuma `failed` olmalı. → Task 1, `a refusal answers 422 ai_refused` (her iki fonksiyon).
2. **Cevap yarıda kesilir** (`status: 'incomplete'`, ör. çıktı sınırı): Yarım metin kaydedilmemeli; 502 dönmeli. → Task 1, `an incomplete answer answers 502 ai_failed`.
3. **Raporda bulunmayan alan `null` döner:** O alan için öneri çıkmamalı; `null` hiçbir zaman öneri değeri olmamalı. → Task 1, `null fields give no suggestion`.
4. **Gizlilik:**
   - Her istekte `store: false` olmalı.
   - İlan isteğinde şasi numarası olmamalı.
   - → Task 1, `write-listing never sends the VIN` testine `store === false` eklenir; read-report'un PDF testine de eklenir.
5. **Yerel ayar eksik:** `OPENAI_BASE_URL` olmadan testler gerçek API'ye gitmemeli; sahte sunucunun isteği almadığı test yüksek sesle düşmeli. → Task 1, her başarı testi sahte sunucudaki istek sayısını doğrular (mevcut kalıp korunur).

---

### Task 1: Sunucu — OpenAI modülü, iki fonksiyon, sahte sunucu, testler

**Files:**
- Create: `supabase/functions/_shared/ai.ts`
- Delete: `supabase/functions/_shared/claude.ts`
- Modify: `supabase/functions/write-listing/index.ts`, `supabase/functions/read-report/index.ts`
- Create: `supabase/tests/integration/fakeOpenAI.ts`
- Delete: `supabase/tests/integration/fakeClaude.ts`
- Modify: `supabase/tests/integration/write-listing.test.ts`, `supabase/tests/integration/read-report.test.ts`
- Modify: `supabase/functions/.env.example`, `README.md` ("Claude" bölümü → "OpenAI")

**Interfaces:**
- Produces (`_shared/ai.ts`):
  - `aiClient(): OpenAI`: `apiKey = OPENAI_API_KEY`, `baseURL = OPENAI_BASE_URL || undefined`.
  - `type AskResult<T> = { ok: true; value: T; model: string } | { ok: false; error: 'ai_refused' | 'ai_failed' }`. Değişmedi.
  - `askJson<T>(opts: { system: string; content: <kurulu SDK'nın Responses kullanıcı içeriği tipi>[]; schema: z.ZodType<T>; effort: 'medium' | 'high' }): Promise<AskResult<T>>`
    - `client.responses.parse` ile çağrılır.
    - `instructions: system`; `input: [{ role: 'user', content }]`.
    - `text: { format: zodTextFormat(schema, …) }`.
    - Global Constraints'teki model, efor, `max_output_tokens` ve `store: false`.
- Produces (`fakeOpenAI.ts`): `fakeClaude.ts` ile aynı rolde ve aynı biçimde. Testler yalnız ad değiştirir.
  - `openaiRequests`, `replyNext(reply)`, `resetFakeOpenAI()`, `startFakeOpenAI()`, `stopFakeOpenAI()`.
  - `reply` biçimleri: `{ output, model? }`, `{ refusal: true }`, `{ incomplete: true }`. Hepsine isteğe bağlı `before` eklenebilir.
  - `POST /v1/responses` (sorgu dizesi önemsiz) isteklerini kaydeder.
  - Kuyrukta cevap yoksa 400 döner.
  - Cevap gövdesi gerçek Responses API biçimindedir; kurulu kütüphanenin `responses.parse`'ı onu ayrıştırabilmelidir:
    - `output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }]`,
    - ya da `content: [{ type: 'refusal', refusal }]`,
    - `status: 'completed' | 'incomplete'`.

- [ ] **Adım 1: Testleri OpenAI'ye çevir ve yenilerini ekle (önce düşsünler).**
  - İki test dosyası `fakeOpenAI.ts`'i kullanır. Gövde doğrulamaları Responses biçimine geçer:
    - `model === 'gpt-6.2-sol'`, `reasoning.effort` (`'medium'` ya da `'high'`), `max_output_tokens === 16000`, `store === false`,
    - `text.format.type === 'json_schema'`.
  - Claude'a özgü doğrulamalar kalkar: `anthropic-beta` başlığı, `fallbacks`, `output_config`.
  - read-report'un PDF testi, `input_file` öğesinin `file_data`'sının `data:application/pdf;base64,` ile başladığını ve yüklenen baytların base64'ünü içerdiğini doğrular.
  - Fotoğraf testi `input_image` / `image_url` data URL'sini doğrular.
  - Yeni testler:
    - `write-listing: an incomplete answer answers 502 ai_failed` (`{ incomplete: true }`; `listing_texts`'te satır yok).
    - `read-report: an incomplete answer answers 502 ai_failed` (okuma `failed`, `error = 'ai_failed'`).
    - `read-report: null fields give no suggestion`. Sahte cevapta `fuel: null` ve `mileageKm: { value: 87000, quote: 'km 87.000' }` var. Cevapta yalnız `mileageKm` önerisi olmalı.
    - `read-report: the schema sent marks every field required`. Gönderilen şemadaki her nesnede `required`, `properties`'in bütün anahtarlarını içerir.
    - `write-listing: the first text is not stale`. Liste satırı olmayan bir araç için metin üretilir. Sonra `listings.facts_updated_at <= listing_texts.generated_at` olmalı. Bu, ertelenmiş saat farkı düzeltmesidir. Fonksiyonun açtığı boş ilan satırı `facts_updated_at` olarak `new Date(0).toISOString()` alır; servis istemcisi bu sütunu yazabilir.

- [ ] **Adım 2: Çalıştır, düştüğünü gör**

Run: `npm run test:int` (görüntü işleyici servis kapalı; `supabase/functions/.env`'de `OPENAI_BASE_URL=http://host.docker.internal:8091/v1` olduğunu yalnız ad ve "dolu/boş" olarak kontrol et)
Expected: FAIL. Fonksiyonlar hâlâ `/v1/messages`'a gider ve sahte sunucu 404 döner.

- [ ] **Adım 3: `_shared/ai.ts`'i yaz, iki fonksiyonu ona geçir, `claude.ts` ve `fakeClaude.ts`'i sil.**
  - **Doğrulama:**
    - `openai@7.59.0`'ı scratchpad'e kur; `responses.parse`, `zodTextFormat`, refusal, `status` ve `output_parsed` alanlarını tiplerden oku.
    - read-report şemasının gönderilen JSON şemasını orada üret ve "her alan required, null'a izin var" olduğunu gör.
  - **read-report şeması:** `.optional().catch(undefined)` → `.nullable().catch(null)` (ya da kütüphanenin desteklediği eşdeğeri). Doğrulama ve listeler aynı kalır; `null` değerler öneri üretmez.
  - **`.env.example`:** `OPENAI_API_KEY=` ve `OPENAI_BASE_URL=` satırları; yerel test değeri yorumda yazılır.
  - **README "OpenAI" bölümü:**
    - Yerelde gerçek çağrı yapılmadığı ve sahte sunucunun 8091'de çalıştığı.
    - Bulutta anahtarı kullanıcının `npx supabase secrets set OPENAI_API_KEY=…` ile, yalnız onayla girdiği.
    - `OPENAI_BASE_URL`'in bulutta boş kaldığı; AB için `https://eu.api.openai.com/v1` seçeneği.
  - **Edge çalışma ortamı:** Yeni kodu almazsa yığını `npx supabase stop` ve `npm run db:start` ile yeniden başlat; `db reset` yok.

- [ ] **Adım 4: Testleri çalıştır**

Run: `npm run test:int && npm run db:test`
Expected: PASS. Çıktı temiz.

- [ ] **Adım 5: Kullanıcıya devret.** Önerilen mesaj: `upd-ai-openai-functions`.

---

### Task 2: Uygulama ve belgeler — sahte sunucular, yükleme notu, tasarım metinleri

**Files:**
- Modify: `apps/mobile/src/listing/api.int.test.ts`, `apps/mobile/src/report/api.int.test.ts` (jest içindeki sahte sunucu → `POST /v1/responses`, Task 1'deki cevap biçimi)
- Modify: `apps/mobile/jest.int.config.js` ve `apps/mobile/src/app/(app)/vehicles/[id]/report.tsx` (yalnız "Claude" geçen yorumlar)
- Modify: `apps/mobile/src/locales/{de,tr,en}.json` (`report.notice`)
- Modify: `docs/superpowers/specs/2026-11-18-m3-vehicle-details-listing-design.md` (Claude bölümleri → OpenAI)
- Modify: `docs/superpowers/specs/2026-11-03-pilot-mvp-design.md`:
  - rapor okuma ve ilan metni bölümleri,
  - dış servisler tablosu,
  - alt işleyenler,
  - maliyet satırları ve kaynak satırı.
  - "Claude'un kararı" etiketi (yazarı anlatır) değişmez.

**Interfaces:**
- Consumes: Task 1'in sahte cevap biçimi (`output[].content[]` içinde `output_text` ya da `refusal`, `status`). Task 1'in hata eşlemesi değişmediği için uygulama kodu değişmez.

- [ ] **Adım 1: İki jest entegrasyon testindeki sahte sunucuyu Responses biçimine çevir ve çalıştır.**

Run: `npm run test:int:mobile`
Expected: Task 1 bittiyse önce Claude biçimli sahte sunucu yüzünden FAIL (fonksiyon `/v1/responses`'a gider, eski sahte 404 döner). Çevirdikten sonra PASS.

- [ ] **Adım 2: Yükleme notunu üç dilde güncelle.** Almancası Global Constraints'teki birebir metindir. `src/lib/i18n.test.ts` geçer. `grep -ri anthropic apps/mobile/src` boş döner.

- [ ] **Adım 3: Tasarım metinlerini güncelle.**
  - **M3 tasarımı:** çağrı ayarları OpenAI tasarımındaki kararlarla değişir: model, efor, `store: false`, yedek model olmaması, ret ve tamamlanmamış cevap eşlemesi. "Anthropic (USA)" geçen yükleme notu da güncellenir.
  - **Pilot tasarımı:**
    - Claude ve Anthropic geçen satırlar OpenAI'ye çevrilir.
    - Maliyet satırları `gpt-6.2-sol` fiyatıyla yeniden hesaplanır: girdi $2, çıktı $10 / milyon token. Kaynak: developers.openai.com/api/docs/pricing, 18 Kasım 2026.
    - Alt işleyenler: OpenAI (ABD; AB işleme bölgesi seçenek).

- [ ] **Adım 4: Testleri çalıştır**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest && cd ../.. && npm run test:int:mobile`
Expected: PASS.

- [ ] **Adım 5: Kullanıcıya devret.** Önerilen mesaj: `upd-ai-openai-app-docs`.

---

### Sonra (kullanıcıyla, plan dışı)

- **Gerçek kontrol (M3 Görev 12):** Onay ve maliyet bilgisiyle yapılır.
  - Yerel `.env`'den `OPENAI_BASE_URL` satırı çıkarılır; anahtar zaten yerindedir.
  - 2 ilan metni ve 1 rapor okuma, tahmini $0,15–0,20.
  - Bitince `OPENAI_BASE_URL` sahte değerine döner.
- **Bulut:** `secrets set OPENAI_API_KEY`, `db push`, `functions deploy` ayrı onayla yapılır.
