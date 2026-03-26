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

router.post("/analyze-pdf", async (req: Request, res: Response) => {
  const { pdf, filename } = req.body as { pdf: string; filename: string };

  if (!pdf) {
    res.status(400).json({ error: "PDF verisi eksik." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: `Sen Türkiye'de kentsel dönüşüm ve yapı denetimi konusunda uzman bir rehbersin. 
Yüklenen belgeyi analiz et ve sonuçları aşağıdaki başlıklar altında sade, 
anlaşılır Türkçe ile yaz. Kesin hukuki veya mühendislik kararı verme. 
Gerektiğinde uzman görüşü alınmasını tavsiye et. 
Güvenilir ve profesyonel bir dil kullan.

Yanıtını MUTLAKA bu yapıda ver, başka format kullanma:

🔹 Kısa Özet
[2-3 cümlelik genel özet]

🔹 Dikkat Edilmesi Gereken Noktalar
- [nokta 1]
- [nokta 2]
- [nokta 3]

🔹 Olası Riskler
- [risk 1]
- [risk 2]
- [risk 3]

🔹 Eksik Bilgiler
- [eksik bilgi 1]
- [eksik bilgi 2]

🔹 Önerilen Sonraki Adımlar
- [adım 1]
- [adım 2]
- [adım 3]

🔹 Güven Seviyesi
%[0-100 arası bir sayı, sadece yüzde işareti ve rakam]`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdf,
            },
          } as Parameters<typeof anthropic.messages.stream>[0]["messages"][0]["content"][0],
          {
            type: "text",
            text: `Bu belgeyi (${filename || "yüklenen dosya"}) analiz et ve belirtilen format ile Türkçe olarak yanıt ver.`,
          },
        ],
      },
    ],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
