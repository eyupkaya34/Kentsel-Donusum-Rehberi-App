import { Router, type IRouter, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ── Hard limits ─────────────────────────────────────────────────────────────
const PDF_PARSE_TIMEOUT_MS = 10_000;   // 10s max for text extraction
const CLAUDE_CALL_TIMEOUT_MS = 40_000; // 40s max per Claude call
const TOTAL_TIMEOUT_MS = 90_000;       // 90s max overall

// ── Chunking thresholds ──────────────────────────────────────────────────────
// <10 pages  → FAST PATH: 1 direct streaming call
// 10-20 pages → MEDIUM PATH: 2 parallel non-streaming chunks + 1 streaming synthesis
// >20 pages  → SLOW PATH: 3 parallel non-streaming chunks + 1 streaming synthesis
const FAST_MAX_PAGES = 9;
const MEDIUM_MAX_PAGES = 20;

// ── Prompts (kept short) ─────────────────────────────────────────────────────
const ANALYSIS_SYSTEM = `Türkiye kentsel dönüşüm ve yapı belgesi analiz asistanısın. Sade Türkçe yaz. Kesin hukuki veya mühendislik kararı verme. Bilgi eksikse bunu açıkça belirt.

Yanıtını MUTLAKA bu yapıda ver:
🔹 Kısa Özet
[2-3 cümle]
🔹 Dikkat Edilmesi Gereken Noktalar
- ...
🔹 Olası Riskler
- ...
🔹 Eksik Bilgiler
- ...
🔹 Önerilen Sonraki Adımlar
- ...
🔹 Güven Seviyesi
%[0-100]`;

const CHUNK_SYSTEM = `Türkiye kentsel dönüşüm belgesi analistisın. Sade Türkçe. Kesin hukuki/mühendislik kararı verme. Bu belgenin bir bölümünü analiz ediyorsun.`;

// ── Timeout helper ───────────────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} ${ms / 1000}s sınırını aştı`)), ms)
    ),
  ]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function splitWords(text: string, n: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const size = Math.ceil(words.length / n);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const slice = words.slice(i * size, (i + 1) * size).join(" ");
    if (slice.trim().length > 10) out.push(slice);
  }
  return out;
}

// ── Conversations API ─────────────────────────────────────────────────────────
router.get("/conversations", async (req: Request, res: Response) => {
  const conversations = await db.select().from(conversationsTable).orderBy(conversationsTable.createdAt);
  res.json(conversations);
});

router.post("/conversations", async (req: Request, res: Response) => {
  const { title } = req.body;
  const [conversation] = await db.insert(conversationsTable).values({ title }).returning();
  res.status(201).json(conversation);
});

router.get("/conversations/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);
  res.json({ ...conversation, messages });
});

router.delete("/conversations/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
  await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
  await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
  res.status(204).send();
});

router.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);
  res.json(messages);
});

router.post("/conversations/:id/messages", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { content } = req.body;
  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }

  await db.insert(messagesTable).values({ conversationId: id, role: "user", content });
  const allMessages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);
  const chatMessages = allMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: `Sen Türkiye'deki kentsel dönüşüm konusunda uzman bir rehbersin. Kullanıcıların sorularını sade, anlaşılır Türkçe ile yanıtla. Teknik veya hukuki jargon kullanma.

Yanıtını MUTLAKA aşağıdaki yapıda ver:
🔹 Kısa Özet
[2-3 cümlelik özet]
🔹 Olası Riskler
- [risk 1]
- [risk 2]
🔹 Eksik Bilgiler
- [eksik nokta 1]
🔹 Sonraki Adımlar
- [adım 1]
- [adım 2]
🔹 Güven Seviyesi
%[0-100]`,
    messages: chatMessages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullResponse += event.delta.text;
      res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
    }
  }

  await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// ── PDF analysis ──────────────────────────────────────────────────────────────
router.post("/analyze-pdf", async (req: Request, res: Response) => {
  const { pdf, filename } = req.body as { pdf: string; filename: string };
  if (!pdf) { res.status(400).json({ error: "PDF verisi eksik." }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  // Total timeout guard
  const totalTimer = setTimeout(() => {
    send({ error: "Analiz 90 saniye sınırını aştı. Lütfen tekrar deneyin." });
    res.end();
  }, TOTAL_TIMEOUT_MS);

  try {
    // ── Step 1: Text extraction (max 10s) ──────────────────────────────────
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default;
    const pdfBuffer = Buffer.from(pdf, "base64");
    const t1 = Date.now();

    const parsed = await withTimeout(
      pdfParse(pdfBuffer),
      PDF_PARSE_TIMEOUT_MS,
      "PDF metin çıkarma"
    );
    const extractSecs = ((Date.now() - t1) / 1000).toFixed(2);
    console.log(`[analyze-pdf] ✅ pdf-parse: ${extractSecs}s`);

    const fullText = (parsed?.text ?? "").trim();
    const pageCount = parsed?.numpages ?? 0;
    const wordCount = fullText.split(/\s+/).filter((w) => w.length > 0).length;

    console.log(`[analyze-pdf] pages=${pageCount} words=${wordCount}`);
    send({ type: "pages", count: pageCount });

    // ── Step 2: Choose strategy ─────────────────────────────────────────────
    if (pageCount <= FAST_MAX_PAGES) {
      // ── FAST PATH: <10 pages → 1 direct streaming call ──────────────────
      console.log(`[analyze-pdf] → FAST PATH (${pageCount} pages, ${wordCount} words) — single call`);
      send({ type: "final_start" });

      const userMsg = fullText.length > 50
        ? `Belgeyi analiz et:\n\n${fullText}`
        : `Belgeyi analiz et (${filename || "dosya"}).`;

      const t2 = Date.now();
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: ANALYSIS_SYSTEM,
        messages: [{ role: "user", content: userMsg }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ content: event.delta.text });
        }
      }
      console.log(`[analyze-pdf] ✅ FAST PATH done: stream=${((Date.now() - t2) / 1000).toFixed(2)}s | total=${elapsed()}`);

    } else if (pageCount <= MEDIUM_MAX_PAGES) {
      // ── MEDIUM PATH: 10-20 pages → 2 parallel chunks + streaming synthesis
      const chunks = splitWords(fullText, 2);
      const total = chunks.length;
      console.log(`[analyze-pdf] → MEDIUM PATH (${pageCount} pages) — ${total} parallel chunks`);
      send({ type: "chunking", total });
      send({ type: "progress", current: 0, total });

      let done = 0;
      const t2 = Date.now();
      const chunkResults = await Promise.all(
        chunks.map(async (chunk, i) => {
          const msg = await withTimeout(
            anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 800,
              system: CHUNK_SYSTEM,
              messages: [{
                role: "user",
                content: `Belge bölümü ${i + 1}/${total}:\n\n${chunk}\n\nBu bölümün bulgularını yaz.`,
              }],
            }),
            CLAUDE_CALL_TIMEOUT_MS,
            `Chunk ${i + 1}`
          );
          done++;
          const chunkText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
          send({ type: "progress", current: done, total });
          send({ type: "chunk_result", index: i, total, text: chunkText });
          console.log(`[analyze-pdf]   chunk ${i + 1}/${total} done (running total: ${((Date.now() - t2) / 1000).toFixed(1)}s)`);
          return chunkText;
        })
      );
      console.log(`[analyze-pdf] ✅ MEDIUM PATH chunks: ${((Date.now() - t2) / 1000).toFixed(2)}s`);

      send({ type: "final_start" });

      const combined = chunkResults.map((r, i) => `=== Bölüm ${i + 1} ===\n${r}`).join("\n\n");
      const finalMsg = `Aşağıdaki bölüm analizlerini birleştirerek tek bir nihai rapor yaz:\n\n${combined}`;

      const t3 = Date.now();
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: ANALYSIS_SYSTEM,
        messages: [{ role: "user", content: finalMsg }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ content: event.delta.text });
        }
      }
      console.log(`[analyze-pdf] ✅ MEDIUM PATH synthesis: ${((Date.now() - t3) / 1000).toFixed(2)}s | total=${elapsed()}`);

    } else {
      // ── SLOW PATH: >20 pages → 3 parallel chunks + streaming synthesis ───
      const chunks = splitWords(fullText, 3);
      const total = chunks.length;
      console.log(`[analyze-pdf] → SLOW PATH (${pageCount} pages) — ${total} parallel chunks`);
      send({ type: "chunking", total });
      send({ type: "progress", current: 0, total });

      let done = 0;
      const t2 = Date.now();
      const chunkResults = await Promise.all(
        chunks.map(async (chunk, i) => {
          const msg = await withTimeout(
            anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 800,
              system: CHUNK_SYSTEM,
              messages: [{
                role: "user",
                content: `Belge bölümü ${i + 1}/${total}:\n\n${chunk}\n\nBu bölümün bulgularını yaz.`,
              }],
            }),
            CLAUDE_CALL_TIMEOUT_MS,
            `Chunk ${i + 1}`
          );
          done++;
          const chunkText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
          send({ type: "progress", current: done, total });
          send({ type: "chunk_result", index: i, total, text: chunkText });
          console.log(`[analyze-pdf]   chunk ${i + 1}/${total} done (running total: ${((Date.now() - t2) / 1000).toFixed(1)}s)`);
          return chunkText;
        })
      );
      console.log(`[analyze-pdf] ✅ SLOW PATH chunks: ${((Date.now() - t2) / 1000).toFixed(2)}s`);

      send({ type: "final_start" });

      const combined = chunkResults.map((r, i) => `=== Bölüm ${i + 1} ===\n${r}`).join("\n\n");
      const finalMsg = `Aşağıdaki bölüm analizlerini birleştirerek tek bir nihai rapor yaz:\n\n${combined}`;

      const t3 = Date.now();
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: ANALYSIS_SYSTEM,
        messages: [{ role: "user", content: finalMsg }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ content: event.delta.text });
        }
      }
      console.log(`[analyze-pdf] ✅ SLOW PATH synthesis: ${((Date.now() - t3) / 1000).toFixed(2)}s | total=${elapsed()}`);
    }

    clearTimeout(totalTimer);
    send({ done: true });
    res.end();
  } catch (err) {
    clearTimeout(totalTimer);
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[analyze-pdf] ❌ Error at ${elapsed()}: ${errMsg}`);
    send({ error: `Analiz hatası: ${errMsg}` });
    res.end();
  }
});

export default router;
