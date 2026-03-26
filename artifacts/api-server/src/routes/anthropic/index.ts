import { Router, type IRouter, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, conversations as conversationsTable, messages as messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ── System prompt ──────────────────────────────────────────────────────────────
const ANALYSIS_SYSTEM = `Sen Türkiye'de kentsel dönüşüm ve yapı denetimi konusunda uzman bir rehbersin. Yüklenen belgeyi analiz et ve sonuçları aşağıdaki başlıklar altında sade, anlaşılır Türkçe ile yaz. Kesin hukuki veya mühendislik kararı verme. Gerektiğinde uzman görüşü alınmasını tavsiye et.

🔹 Kısa Özet
🔹 Dikkat Edilmesi Gereken Noktalar
🔹 Olası Riskler
🔹 Eksik Bilgiler
🔹 Önerilen Sonraki Adımlar
🔹 Güven Seviyesi %

Güven Seviyesini hesaplarken şu kriterleri kullan:
- Tüm ekler mevcut ve eksiksiz ise +20 puan
- Cezai şartlar dengeli ise +20 puan
- Süreler gerçekçi ise +20 puan
- Tarafların bilgileri tam ise +20 puan
- Hukuki riskler düşük ise +20 puan
Toplam = Güven Seviyesi. Tutarlı ve gerekçeli sonuç ver.`;

// ── Conversations API ──────────────────────────────────────────────────────────
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
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: `Sen Türkiye'deki kentsel dönüşüm konusunda uzman bir rehbersin. Kullanıcıların sorularını sade, anlaşılır Türkçe ile yanıtla.

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

// ── PDF analysis — frontend extracts text, backend sends as plain message ───────
router.post("/analyze-pdf", async (req: Request, res: Response) => {
  const { text, filename } = req.body as { text: string; filename: string };
  if (!text) { res.status(400).json({ error: "Belge metni eksik." }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  const totalTimer = setTimeout(() => {
    send({ error: "Analiz 120 saniye sınırını aştı. Lütfen tekrar deneyin." });
    res.end();
  }, 120_000);

  try {
    console.log(`[analyze-pdf] → Text-based analysis (${filename}) — ${text.length} chars`);

    send({ type: "final_start" });

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      system: ANALYSIS_SYSTEM,
      messages: [{
        role: "user",
        content: `Belge adı: ${filename}\n\nBelge içeriği:\n${text}`,
      }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send({ content: event.delta.text });
      }
    }

    console.log(`[analyze-pdf] ✅ Done in ${elapsed()}`);
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

// ── Chat — stateless, non-streaming endpoint ───────────────────────────────────
const CHAT_SYSTEM =
  "Sen kentsel dönüşüm konusunda yardımcı bir rehbersin. " +
  "Soruları sade ve anlaşılır Türkçe ile yanıtla. " +
  "Maksimum 3-4 cümle kullan. " +
  "Kesin hukuki karar verme. " +
  "Gerekirse uzman görüşü öner.";

router.post("/chat", async (req: Request, res: Response) => {
  const { question } = req.body as { question?: string };
  const trimmed = (question ?? "").trim().slice(0, 1000);

  if (trimmed.length < 10) {
    res.status(400).json({ error: "Lütfen daha detaylı bir soru yazın." });
    return;
  }

  console.log(`[chat] → "${trimmed.slice(0, 80)}"`);
  const t0 = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
    console.error("[chat] ❌ Timeout after 25s");
  }, 25_000);

  try {
    const response = await anthropic.messages.create(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 800,
        system: CHAT_SYSTEM,
        messages: [{ role: "user", content: trimmed }],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeout);
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[chat] ✅ Done in ${elapsed}s (${text.length} chars)`);
    res.json({ answer: text });
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[chat] ❌ Error: ${msg}`);

    const isTimeout = msg.includes("abort") || msg.includes("AbortError") || msg.includes("timed out");
    const userMsg = isTimeout
      ? "Yanıt süresi doldu. Lütfen sorunuzu daha kısa yazın ve tekrar deneyin."
      : msg.includes("overloaded") || msg.includes("529")
        ? "Servis şu an yoğun. 30 saniye bekleyip tekrar deneyin."
        : msg.includes("rate_limit") || msg.includes("429")
          ? "İstek limiti aşıldı. Lütfen 1 dakika bekleyin."
          : "Sunucu bağlantı hatası. Lütfen sayfayı yenileyip tekrar deneyin.";
    res.status(503).json({ error: userMsg });
  }
});

export default router;
