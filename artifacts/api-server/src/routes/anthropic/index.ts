import { Router, type IRouter, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

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
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(messagesTable.createdAt);
  res.json({ ...conversation, messages });
});

router.delete("/conversations/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
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
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

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

Yanıtını MUTLAKA aşağıdaki yapıda ver. Başka format kullanma:

🔹 Kısa Özet
[2-3 cümlelik kısa özet]

🔹 Olası Riskler
- [risk 1]
- [risk 2]
- [risk 3]

🔹 Eksik Bilgiler
- [eksik bilgi veya dikkat edilmesi gereken nokta 1]
- [eksik bilgi 2]

🔹 Sonraki Adımlar
- [adım 1]
- [adım 2]
- [adım 3]

🔹 Güven Seviyesi
%[0-100 arası bir sayı yaz, sadece sayı ve yüzde işareti]

Bu yapıyı her yanıtta uygula. Yanıtın Türkçe olsun.`,
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

const CHUNK_SYSTEM_PROMPT = `You are an AI assistant for a Turkish urban transformation and construction guidance app.
Your task:
Analyze the uploaded PDF and respond in simple Turkish.
IMPORTANT RULES:
- This is preliminary information only
- Do NOT give definitive legal, structural, or engineering judgments
- Do NOT say things like 'this building is safe' or 'this is legally guaranteed'
- If information is unclear or missing, say so clearly
- If needed, recommend expert review
- Be neutral, clear, and easy to understand`;

const FINAL_SYSTEM_PROMPT = `${CHUNK_SYSTEM_PROMPT}

Always respond in this exact structure:
🔹 Kısa Özet
[write here]
🔹 Dikkat Edilmesi Gereken Noktalar
- ...
- ...
🔹 Olası Riskler
- ...
- ...
🔹 Eksik Bilgiler
- ...
- ...
🔹 Önerilen Sonraki Adımlar
- ...
- ...
🔹 Güven Seviyesi
%[0-100]

If the PDF does not contain enough information, say that clearly.`;

function splitIntoChunks(text: string, wordsPerChunk: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks.length > 0 ? chunks : [text];
}

router.post("/analyze-pdf", async (req: Request, res: Response) => {
  const { pdf, filename } = req.body as { pdf: string; filename: string };

  if (!pdf) {
    res.status(400).json({ error: "PDF verisi eksik." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  try {
    // ── Step 1: extract text ────────────────────────────────────────────────────
    // Import the internal lib directly to avoid pdf-parse's debug-mode test file issue
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default;
    const pdfBuffer = Buffer.from(pdf, "base64");
    const t1 = Date.now();
    const parsed = await pdfParse(pdfBuffer);
    console.log(`[analyze-pdf] pdf-parse done in ${((Date.now() - t1) / 1000).toFixed(2)}s`);

    const fullText = (parsed?.text ?? "").trim();
    const pageCount = parsed?.numpages ?? 0;
    const wordCount = fullText.split(/\s+/).filter((w) => w.length > 0).length;

    console.log(`[analyze-pdf] pages=${pageCount} words=${wordCount}`);
    send({ type: "pages", count: pageCount });

    // ── Step 2: choose strategy based on page count ─────────────────────────────
    if (pageCount <= 5) {
      // ── FAST PATH: 1 direct streaming call, no intermediate chunk step ──────
      // No progress bar for small documents — just stream results directly.
      console.log(`[analyze-pdf] FAST PATH (≤5 pages) — single stream call`);
      send({ type: "final_start" });

      const userMessage = fullText.length > 50
        ? `Aşağıdaki belge metnini analiz et ve belirtilen format ile Türkçe olarak yanıt ver:\n\n${fullText}`
        : `Bu belgeyi (${filename || "yüklenen dosya"}) analiz et ve belirtilen format ile Türkçe olarak yanıt ver.`;

      const msgContent: Parameters<typeof anthropic.messages.stream>[0]["messages"][0]["content"] =
        fullText.length > 50
          ? userMessage
          : [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdf },
              } as Parameters<typeof anthropic.messages.stream>[0]["messages"][0]["content"][0],
              { type: "text", text: userMessage },
            ];

      const t2 = Date.now();
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: FINAL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: msgContent }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ content: event.delta.text });
        }
      }
      console.log(`[analyze-pdf] FAST PATH stream done in ${((Date.now() - t2) / 1000).toFixed(2)}s | total=${elapsed()}`);

    } else if (pageCount <= 15) {
      // ── MEDIUM PATH: 2 parallel chunks + 1 final synthesis ──────────────────
      const words = fullText.split(/\s+/).filter((w) => w.length > 0);
      const mid = Math.ceil(words.length / 2);
      const chunks = [
        words.slice(0, mid).join(" "),
        words.slice(mid).join(" "),
      ].filter((c) => c.trim().length > 10);

      const total = chunks.length;
      console.log(`[analyze-pdf] MEDIUM PATH (5-15 pages) — ${total} parallel chunks`);
      send({ type: "chunking", total });
      send({ type: "progress", current: 0, total });

      let done = 0;
      const t2 = Date.now();
      const chunkResults = await Promise.all(
        chunks.map(async (chunk, i) => {
          const msg = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            system: CHUNK_SYSTEM_PROMPT,
            messages: [{
              role: "user",
              content: `Bu bir sözleşmenin ${i + 1}. bölümü / toplam ${total} bölüm:\n\n${chunk}\n\nSadece bu bölümü analiz et ve bulgularını yaz.`,
            }],
          });
          done++;
          send({ type: "progress", current: done, total });
          return msg.content[0]?.type === "text" ? msg.content[0].text : "";
        })
      );
      console.log(`[analyze-pdf] MEDIUM PATH parallel chunks done in ${((Date.now() - t2) / 1000).toFixed(2)}s`);

      send({ type: "final_start" });

      const allAnalyses = chunkResults
        .map((r, i) => `=== Bölüm ${i + 1} ===\n${r}`)
        .join("\n\n");

      const finalMsg = `Aşağıda bir sözleşmenin tüm bölümlerinin analizleri var. Bunları birleştirerek tek bir nihai analiz yaz.\n\n${allAnalyses}\n\nŞu formatı kullan:\n🔹 Kısa Özet\n🔹 Dikkat Edilmesi Gereken Noktalar\n🔹 Olası Riskler\n🔹 Eksik Bilgiler\n🔹 Önerilen Sonraki Adımlar\n🔹 Güven Seviyesi %`;

      const t3 = Date.now();
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: FINAL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: finalMsg }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ content: event.delta.text });
        }
      }
      console.log(`[analyze-pdf] MEDIUM PATH final stream done in ${((Date.now() - t3) / 1000).toFixed(2)}s | total=${elapsed()}`);

    } else {
      // ── SLOW PATH: sequential chunking, capped at 6 chunks ──────────────────
      const MAX_CHUNKS = 6;
      const wordsArr = fullText.split(/\s+/).filter((w) => w.length > 0);
      const wordsPerChunk = Math.max(3000, Math.ceil(wordsArr.length / MAX_CHUNKS));
      const chunks = splitIntoChunks(fullText, wordsPerChunk).slice(0, MAX_CHUNKS);

      console.log(`[analyze-pdf] SLOW PATH (>15 pages) — ${chunks.length} sequential chunks`);
      send({ type: "chunking", total: chunks.length });
      send({ type: "progress", current: 0, total: chunks.length });

      const chunkResults: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const tc = Date.now();
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: CHUNK_SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: `Bu bir sözleşmenin ${i + 1}. bölümü / toplam ${chunks.length} bölüm:\n\n${chunks[i]}\n\nSadece bu bölümü analiz et ve bulgularını yaz.`,
          }],
        });
        chunkResults.push(msg.content[0]?.type === "text" ? msg.content[0].text : "");
        send({ type: "progress", current: i + 1, total: chunks.length });
        console.log(`[analyze-pdf] SLOW PATH chunk ${i + 1}/${chunks.length} done in ${((Date.now() - tc) / 1000).toFixed(2)}s`);
      }

      send({ type: "final_start" });

      const allAnalyses = chunkResults
        .map((r, i) => `=== Bölüm ${i + 1} ===\n${r}`)
        .join("\n\n");

      const finalMsg = `Aşağıda bir sözleşmenin tüm bölümlerinin analizleri var. Bunları birleştirerek tek bir nihai analiz yaz.\n\n${allAnalyses}\n\nŞu formatı kullan:\n🔹 Kısa Özet\n🔹 Dikkat Edilmesi Gereken Noktalar\n🔹 Olası Riskler\n🔹 Eksik Bilgiler\n🔹 Önerilen Sonraki Adımlar\n🔹 Güven Seviyesi %`;

      const t3 = Date.now();
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: FINAL_SYSTEM_PROMPT,
        messages: [{ role: "user", content: finalMsg }],
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send({ content: event.delta.text });
        }
      }
      console.log(`[analyze-pdf] SLOW PATH final stream done in ${((Date.now() - t3) / 1000).toFixed(2)}s | total=${elapsed()}`);
    }

    send({ done: true });
    res.end();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack?.slice(0, 500) : "";
    console.error("[analyze-pdf] Error:", errMsg, errStack);
    send({ error: `Analiz sırasında bir hata oluştu: ${errMsg}` });
    res.end();
  }
});

export default router;
