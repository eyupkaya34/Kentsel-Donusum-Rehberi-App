import { useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function askClaude(question: string, onChunk: (text: string) => void): Promise<void> {
  const createRes = await fetch(`${BASE}/api/anthropic/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: question.slice(0, 60) }),
  });
  if (!createRes.ok) throw new Error("Konuşma oluşturulamadı.");
  const conversation = await createRes.json();

  const msgRes = await fetch(`${BASE}/api/anthropic/conversations/${conversation.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: question }),
  });
  if (!msgRes.ok || !msgRes.body) throw new Error("Yanıt alınamadı.");

  const reader = msgRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.content) onChunk(payload.content);
        } catch {}
      }
    }
  }
}

const EXAMPLE_QUESTIONS = [
  "Binam 30 yıllık, riskli olabilir mi?",
  "Kentsel dönüşüm süreci nasıl başlar?",
  "Kiracı olarak haklarım neler?",
  "Müteahhit seçerken nelere dikkat etmeliyim?",
];

const GUIDANCE_BUTTONS = [
  { label: "Risk analizi yap", prompt: "Binamın deprem riski taşıyıp taşımadığını analiz etmek istiyorum. Ne yapmalıyım?" },
  { label: "Süreci öğren", prompt: "Kentsel dönüşüm süreci nasıl işler? Adım adım açıklar mısın?" },
  { label: "Teklif karşılaştır", prompt: "Müteahhitlerden gelen teklifleri karşılaştırırken nelere dikkat etmeliyim?" },
];

const SECTION_KEYS = [
  { key: "🔹 Kısa Özet", label: "Kısa Özet", color: "blue" },
  { key: "🔹 Olası Riskler", label: "Olası Riskler", color: "orange" },
  { key: "🔹 Eksik Bilgiler", label: "Eksik Bilgiler", color: "yellow" },
  { key: "🔹 Sonraki Adımlar", label: "Sonraki Adımlar", color: "green" },
  { key: "🔹 Güven Seviyesi", label: "Güven Seviyesi", color: "purple" },
];

function parseAnswer(raw: string): { label: string; color: string; lines: string[] }[] {
  const sections: { label: string; color: string; lines: string[] }[] = [];
  let current: { label: string; color: string; lines: string[] } | null = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const match = SECTION_KEYS.find((s) => trimmed.startsWith(s.key));
    if (match) {
      if (current) sections.push(current);
      current = { label: match.label, color: match.color, lines: [] };
    } else if (current && trimmed) {
      current.lines.push(trimmed);
    }
  }
  if (current) sections.push(current);
  return sections;
}

const colorMap: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-100",   badge: "bg-blue-100 text-blue-700",   text: "text-blue-900" },
  orange: { bg: "bg-orange-50", border: "border-orange-100", badge: "bg-orange-100 text-orange-700", text: "text-orange-900" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-100", badge: "bg-yellow-100 text-yellow-700", text: "text-yellow-900" },
  green:  { bg: "bg-green-50",  border: "border-green-100",  badge: "bg-green-100 text-green-700",  text: "text-green-900" },
  purple: { bg: "bg-purple-50", border: "border-purple-100", badge: "bg-purple-100 text-purple-700", text: "text-purple-900" },
};

function AnswerSection({ label, color, lines }: { label: string; color: string; lines: string[] }) {
  const c = colorMap[color] ?? colorMap.blue;
  const isConfidence = label === "Güven Seviyesi";
  const confidenceValue = isConfidence ? lines[0]?.replace(/[^0-9]/g, "") : null;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${c.badge}`}>
        {label}
      </span>
      {isConfidence && confidenceValue ? (
        <div className="mt-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-sm font-bold ${c.text}`}>%{confidenceValue}</span>
          </div>
          <div className="w-full bg-white rounded-full h-2 border border-purple-100">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-700"
              style={{ width: `${confidenceValue}%` }}
            />
          </div>
        </div>
      ) : (
        <ul className="space-y-1">
          {lines.map((line, i) => (
            <li key={i} className={`text-sm leading-relaxed ${c.text}`}>
              {line.startsWith("-") ? (
                <span className="flex gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-60" />
                  <span>{line.slice(1).trim()}</span>
                </span>
              ) : line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [rawAnswer, setRawAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAsked, setHasAsked] = useState(false);

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setRawAnswer("");
    setError("");
    setHasAsked(true);
    try {
      await askClaude(question, (chunk) => setRawAnswer((prev) => prev + chunk));
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAsk();
  };

  const handleExpert = () => {
    alert("Bir uzmanla görüşmek için: Mimarlar Odası veya Barolar Birliği'ne başvurabilirsiniz.");
  };

  const parsedSections = rawAnswer ? parseAnswer(rawAnswer) : [];

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-700 rounded-full" />
          <span className="text-sm font-semibold text-gray-700 tracking-wide">
            AI Destekli Kentsel Dönüşüm Rehberi
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* Hero */}
          <div className="text-center px-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-3">
              Aklınıza Takılan Her Şeyi<br className="hidden sm:block" /> Sade ve Anlaşılır Şekilde Öğrenin
            </h1>
            <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-4">
              Bina riskinizi öğrenin, haklarınızı anlayın ve sonraki adımları netleştirin.
            </p>
            <ul className="inline-flex flex-col items-start gap-1.5 text-sm text-gray-600">
              {["Binanızın risklerini anlayın", "Haklarınızı öğrenin", "Doğru adımları planlayın"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Guidance Buttons */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Ne yapmak istiyorsunuz?</p>
            <div className="flex flex-wrap gap-2">
              {GUIDANCE_BUTTONS.map(({ label, prompt }) => (
                <button
                  key={label}
                  onClick={() => setQuestion(prompt)}
                  className="bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 hover:text-blue-800 text-sm font-medium px-4 py-2 rounded-full transition-all duration-150 shadow-sm"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-8 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label htmlFor="question" className="text-sm font-semibold text-gray-700">
                Sorunuzu buraya yazın
              </label>
              <span className="text-xs text-blue-600 font-medium bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5">
                AI ile analiz edilir
              </span>
            </div>
            <textarea
              id="question"
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Örnek: Binam riskli mi? Kiracı olarak haklarım neler? Kredi alabilir miyim? Müteahhit seçerken nelere dikkat etmeliyim?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition disabled:opacity-60"
              disabled={loading}
            />
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:bg-blue-200 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 text-sm tracking-wide shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analiz ediliyor...
                </>
              ) : "Analizi Başlat"}
            </button>
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              Bu sistem ön bilgilendirme sağlar. Kesin teknik ve hukuki değerlendirme için uzman desteği gerekebilir.
            </p>
          </div>

          {/* Example Questions */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Örnek Sorular</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="text-left bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-800 text-sm px-4 py-3 rounded-xl transition-all duration-150 shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Result Area */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-8 flex flex-col gap-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Analiz Sonucu</p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {!hasAsked && !error && (
              <p className="text-sm text-gray-400 italic">Analiz sonucu burada görünecek...</p>
            )}

            {hasAsked && !error && loading && rawAnswer === "" && (
              <div className="flex items-center gap-3 text-gray-400 text-sm py-2">
                <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span>Analiz ediliyor, lütfen bekleyin...</span>
              </div>
            )}

            {rawAnswer && parsedSections.length > 0 && (
              <div className="flex flex-col gap-3">
                {parsedSections.map((section) => (
                  <AnswerSection key={section.label} {...section} />
                ))}
              </div>
            )}

            {rawAnswer && parsedSections.length === 0 && (
              <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{rawAnswer}</p>
            )}

            {hasAsked && !loading && rawAnswer && (
              <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
                <p className="text-sm text-gray-700 font-medium">
                  Bu durumda detaylı analiz önerilir.<br />
                  <span className="text-gray-500 font-normal">Uzman incelemesi ile riskleri netleştirebilirsiniz.</span>
                </p>
                <button
                  onClick={handleExpert}
                  className="self-start bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm"
                >
                  Detaylı analiz için uzmanla görüş
                </button>
              </div>
            )}
          </div>

          {/* Expert Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-8 text-center flex flex-col items-center gap-3">
            <p className="text-lg font-bold text-gray-900">Bu konuda risk almak istemiyor musunuz?</p>
            <p className="text-sm text-gray-500">Detaylı analiz ile daha net ve güvenli karar verin</p>
            <button
              onClick={handleExpert}
              className="bg-gray-900 hover:bg-gray-700 active:bg-black text-white font-semibold py-3.5 px-8 rounded-xl transition-all duration-200 text-sm shadow-md mt-1"
            >
              Detaylı analiz için uzmanla görüş
            </button>
            <p className="text-xs text-gray-400">İnşaat mühendisi, jeolog veya uzman danışman desteği</p>
          </div>

          {/* Trust Features */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Neden güvenilir?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Türkiye'ye özel içerik",
                "Sade ve anlaşılır anlatım",
                "Tarafsız analiz",
                "Gerektiğinde uzman yönlendirme",
              ].map((item) => (
                <div
                  key={item}
                  className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm"
                >
                  <span className="text-green-500 font-bold text-base">✔</span>
                  <span className="text-sm text-gray-700 font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-5 px-6 mt-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs text-gray-400">
            Bu bilgiler genel rehberlik amaçlıdır. Hukuki karar değildir.
          </p>
        </div>
      </footer>
    </div>
  );
}
