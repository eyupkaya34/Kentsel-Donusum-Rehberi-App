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

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer("");
    setError("");

    try {
      await askClaude(question, (chunk) => {
        setAnswer((prev) => prev + chunk);
      });
    } catch (err) {
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
    alert(
      "Bir uzmanla görüşmek için: Mimarlar Odası veya Barolar Birliği'ne başvurabilirsiniz."
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <div className="w-2 h-6 bg-blue-700 rounded-sm" />
          <span className="text-sm font-medium text-gray-500 tracking-wide uppercase">
            Resmi Rehber
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-16">
        <div className="w-full max-w-2xl">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-3 leading-tight">
              Kentsel Dönüşüm Rehberi
            </h1>
            <p className="text-lg text-gray-500">
              Bina riskinizi öğrenin. Haklarınızı anlayın.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <label
              htmlFor="question"
              className="block text-sm font-semibold text-gray-700 mb-2"
            >
              Sorunuzu buraya yazın
            </label>
            <textarea
              id="question"
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Örnek: Binam riskli mi? Kiracı olarak haklarım neler? Kredi alabilir miyim?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              disabled={loading}
            />

            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="mt-4 w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 text-sm"
            >
              {loading ? "Yanıt hazırlanıyor..." : "Soruyu Sor"}
            </button>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {(answer || loading) && !error && (
              <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-5">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                  Yanıt
                </p>
                {answer ? (
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{answer}</p>
                ) : (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="ml-1">Yanıt hazırlanıyor...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-gray-600 text-sm mb-4">
              Hukuki danışmanlık veya detaylı bilgi almak ister misiniz?
            </p>
            <button
              onClick={handleExpert}
              className="bg-white border border-gray-300 hover:border-gray-400 text-gray-800 font-semibold py-3 px-8 rounded-xl transition-colors duration-200 text-sm shadow-sm"
            >
              Uzmanla Görüş
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs text-gray-400">
            Bu bilgiler genel rehberlik amaçlıdır. Hukuki karar değildir.
          </p>
        </div>
      </footer>
    </div>
  );
}
