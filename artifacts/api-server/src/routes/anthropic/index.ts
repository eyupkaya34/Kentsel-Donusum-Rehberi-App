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

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const pdfBuffer = Buffer.from(pdf, "base64");
    const pdfData = await pdfParse(pdfBuffer);
    const fullText = pdfData.text?.trim() ?? "";

    const chunks = fullText.length > 100
      ? splitIntoChunks(fullText, 3000)
      : null;

    const totalChunks = chunks ? chunks.length : 1;
    send({ type: "progress", current: 0, total: totalChunks });

    const chunkResults: string[] = [];

    if (chunks && chunks.length > 0) {
      for (let i = 0; i < chunks.length; i++) {
        const msg = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: CHUNK_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Bu bir sözleşmenin ${i + 1}. bölümü / toplam ${chunks.length} bölüm:\n\n${chunks[i]}\n\nSadece bu bölümü analiz et ve bulgularını yaz.`,
            },
          ],
        });
        const result = msg.content[0]?.type === "text" ? msg.content[0].text : "";
        chunkResults.push(result);
        send({ type: "progress", current: i + 1, total: chunks.length });
      }
    } else {
      chunkResults.push("(PDF'ten metin çıkarılamadı, doğrudan belge analizi yapılıyor.)");
      send({ type: "progress", current: 1, total: 1 });
    }

    send({ type: "final_start" });

    const allAnalyses = chunkResults
      .map((r, i) => `=== Bölüm ${i + 1} ===\n${r}`)
      .join("\n\n");

    const finalUserMessage = chunks
      ? `Aşağıda bir sözleşmenin tüm bölümlerinin analizleri var. Bunları birleştirerek tek bir nihai analiz yaz.\n\n${allAnalyses}\n\nŞu formatı kullan:\n🔹 Kısa Özet\n🔹 Dikkat Edilmesi Gereken Noktalar\n🔹 Olası Riskler\n🔹 Eksik Bilgiler\n🔹 Önerilen Sonraki Adımlar\n🔹 Güven Seviyesi %`
      : `Bu belgeyi (${filename || "yüklenen dosya"}) analiz et ve belirtilen format ile Türkçe olarak yanıt ver.`;

    const finalContent: Parameters<typeof anthropic.messages.stream>[0]["messages"][0]["content"] =
      chunks
        ? finalUserMessage
        : [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdf },
            } as Parameters<typeof anthropic.messages.stream>[0]["messages"][0]["content"][0],
            { type: "text", text: finalUserMessage },
          ];

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: FINAL_SYSTEM_PROMPT,
      messages: [{ role: "user", content: finalContent }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send({ content: event.delta.text });
      }
    }

    send({ done: true });
    res.end();
  } catch (err) {
    send({ error: "Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin." });
    res.end();
  }
});

export default router;
