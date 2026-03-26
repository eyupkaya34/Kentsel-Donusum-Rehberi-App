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

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAsked, setHasAsked] = useState(false);

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer("");
    setError("");
    setHasAsked(true);

    try {
      await askClaude(question, (chunk) => {
        setAnswer((prev) => prev + chunk);
      });
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleAsk();
    }
  };

  const handleExpert = () => {
    alert("Bir uzmanla görüşmek için: Mimarlar Odası veya Barolar Birliği'ne başvurabilirsiniz.");
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-700 rounded-full" />
          <span className="text-sm font-semibold text-gray-700 tracking-wide">
            AI Destekli Kentsel Dönüşüm Rehberi
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* Hero */}
          <div className="text-center px-2 mb-2">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-3">
              Aklınıza Takılan Her Şeyi<br className="hidden sm:block" /> Sade ve Anlaşılır Şekilde Öğrenin
            </h1>
            <p className="text-base sm:text-lg text-gray-500 leading-relaxed">
              Bina riskinizi öğrenin, haklarınızı anlayın ve sonraki adımları netleştirin.
            </p>
          </div>

          {/* Input Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 flex flex-col gap-4">
            <label htmlFor="question" className="block text-sm font-semibold text-gray-700">
              Sorunuzu buraya yazın
            </label>
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
              className="w-full bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:bg-blue-200 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 text-sm tracking-wide shadow-sm"
            >
              {loading ? "Analiz ediliyor..." : "Analizi Başlat"}
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
                  className="text-left bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:text-blue-800 text-sm px-4 py-3 rounded-xl transition-all duration-150 shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Result Area */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Analiz Sonucu</p>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            {!hasAsked && !error && (
              <p className="text-sm text-gray-400 italic">Analiz sonucu burada görünecek...</p>
            )}

            {hasAsked && !error && (
              <>
                {loading && !answer && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="ml-1">Analiz ediliyor...</span>
                  </div>
                )}
                {answer && (
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
                )}
              </>
            )}
          </div>

          {/* Expert CTA */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 text-center flex flex-col items-center gap-3">
            <p className="text-base font-semibold text-gray-800">Daha net ve kesin bilgi mi istiyorsunuz?</p>
            <button
              onClick={handleExpert}
              className="bg-gray-900 hover:bg-gray-700 active:bg-black text-white font-semibold py-3 px-7 rounded-xl transition-all duration-200 text-sm shadow-sm"
            >
              Detaylı analiz için uzmanla görüş
            </button>
            <p className="text-xs text-gray-400">İnşaat mühendisi, jeolog veya uzman danışman desteği</p>
          </div>

          {/* Trust Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "⚖️", label: "Tarafsız analiz" },
              { icon: "💬", label: "Sade ve anlaşılır açıklamalar" },
              { icon: "🧭", label: "Gerektiğinde uzman yönlendirme" },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3 shadow-sm"
              >
                <span className="text-lg">{icon}</span>
                <span className="text-sm text-gray-600 font-medium">{label}</span>
              </div>
            ))}
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
