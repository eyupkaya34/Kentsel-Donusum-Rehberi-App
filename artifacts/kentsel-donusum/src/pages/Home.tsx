import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import ReactMarkdown from "react-markdown";
import AppFooter from "@/components/AppFooter";

function MdInline({ text, className }: { text: string; className?: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <span className={className}>{children}</span>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

function MdBlock({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0 text-sm leading-relaxed">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="space-y-1 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="space-y-1 my-1 list-decimal list-inside">{children}</ol>,
          li: ({ children }) => (
            <li className="flex gap-2 text-sm leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 mt-2 opacity-50" />
              <span>{children}</span>
            </li>
          ),
          h1: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
          h2: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
          h3: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

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

const PDF_SECTION_KEYS = [
  { key: "🔹 Kısa Özet", label: "Kısa Özet", color: "blue" },
  { key: "🔹 Dikkat Edilmesi Gereken Noktalar", label: "Dikkat Edilmesi Gereken Noktalar", color: "orange" },
  { key: "🔹 Olası Riskler", label: "Olası Riskler", color: "red" },
  { key: "🔹 Eksik Bilgiler", label: "Eksik Bilgiler", color: "yellow" },
  { key: "🔹 Önerilen Sonraki Adımlar", label: "Önerilen Sonraki Adımlar", color: "green" },
  { key: "🔹 Güven Seviyesi", label: "Güven Seviyesi", color: "purple" },
];


function parseAnswer(
  raw: string,
  sectionKeys: { key: string; label: string; color: string }[]
): { label: string; color: string; lines: string[] }[] {
  const sections: { label: string; color: string; lines: string[] }[] = [];
  let current: { label: string; color: string; lines: string[] } | null = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const match = sectionKeys.find((s) => trimmed.startsWith(s.key));
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
  blue:   { bg: "bg-[#F0F4FA]", border: "border-[#C5D3E8]", badge: "bg-[#1B2E4B]/10 text-[#1B2E4B]", text: "text-[#1B2E4B]" },
  orange: { bg: "bg-[#FDF8F0]", border: "border-[#E8D5A3]", badge: "bg-[#C9A84C]/15 text-[#8B6914]", text: "text-[#5C4A1E]" },
  red:    { bg: "bg-[#FEF2F2]", border: "border-[#FECACA]", badge: "bg-red-100 text-red-700", text: "text-red-800" },
  yellow: { bg: "bg-[#FEFCE8]", border: "border-[#FEF08A]", badge: "bg-yellow-100 text-yellow-800", text: "text-yellow-900" },
  green:  { bg: "bg-[#F0FDF4]", border: "border-[#BBF7D0]", badge: "bg-green-100 text-green-800", text: "text-green-900" },
  purple: { bg: "bg-[#F5F3FF]", border: "border-[#DDD6FE]", badge: "bg-purple-100 text-purple-800", text: "text-purple-900" },
};

function AnswerSection({ label, color, lines }: { label: string; color: string; lines: string[] }) {
  const c = colorMap[color] ?? colorMap.blue;
  const isConfidence = label === "Güven Seviyesi";
  const confidenceValue = isConfidence ? lines[0]?.replace(/[^0-9]/g, "") : null;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-5 flex flex-col gap-2`}>
      <span className={`inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full mb-1 ${c.badge}`}>
        {label}
      </span>
      {isConfidence && confidenceValue ? (
        <div className="mt-1">
          <span className={`text-sm font-bold ${c.text}`}>%{confidenceValue}</span>
          <div className="bg-[#E8E3DC] rounded-full h-2.5 mt-1">
            <div
              className="bg-[#C9A84C] h-2.5 rounded-full transition-all duration-700"
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
                  <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 mt-2 opacity-50" />
                  <MdInline text={line.slice(1).trim()} />
                </span>
              ) : (
                <MdInline text={line} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── PDF Upload Section ────────────────────────────────────────────────────────

const TIPS = [
  "💡 Kentsel dönüşümde en az 2/3 kat malikinin onayı gerekir.",
  "💡 Riskli yapı tespiti yaptırmak için DASK sigortanız olmalıdır.",
  "💡 Kiracılar kentsel dönüşüm sürecinde belirli haklara sahiptir.",
  "💡 Müteahhit seçiminde en az 3 teklif almanızı öneririz.",
  "💡 Tapu devrinden önce tüm borçların temizlendiğini kontrol edin.",
  "💡 Kentsel dönüşüm kredilerinde devlet desteği alabilirsiniz.",
];

function getMicroMsg(pct: number): string {
  if (pct <= 29) return "Belgeniz güvenli şekilde işleniyor...";
  if (pct <= 85) return "Yapay zeka her maddeyi dikkatlice inceliyor...";
  if (pct < 100) return "Son rötuşlar yapılıyor, neredeyse bitti...";
  return "Raporunuz hazır!";
}

type PdfState = "empty" | "selected" | "analyzing" | "done";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface PdfCallbacks {
  onChunk: (text: string) => void;
  onProgress: (current: number, total: number) => void;
  onFinalStart: () => void;
  onConnected: () => void;
  onPages: (count: number) => void;
  onChunking: () => void;
}

async function analyzePdf(file: File, cb: PdfCallbacks): Promise<void> {
  const base64 = await fileToBase64(file);
  const res = await fetch(`${BASE}/api/anthropic/analyze-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdf: base64, filename: file.name }),
  });
  if (!res.ok || !res.body) throw new Error("Analiz başlatılamadı.");

  // SSE connection established — backend is now reading the PDF
  cb.onConnected();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let serverError: string | null = null;

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
          if (payload.type === "pages") cb.onPages(payload.count);
          else if (payload.type === "chunking") cb.onChunking();
          else if (payload.type === "progress") cb.onProgress(payload.current, payload.total);
          else if (payload.type === "final_start") cb.onFinalStart();
          else if (payload.content) cb.onChunk(payload.content);
          else if (payload.error) serverError = payload.error;
        } catch {}
      }
    }
  }

  // Throw AFTER the stream ends so setPdfState("done") in handleAnalyze is never reached
  if (serverError) throw new Error(serverError);
}

function PdfUploadSection({ onExpert }: { onExpert: () => void }) {
  const [pdfState, setPdfState] = useState<PdfState>("empty");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfAnswer, setPdfAnswer] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [kvkkConsent, setKvkkConsent] = useState(false);
  const [pct, setPct] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate tips every 4 seconds while analyzing, with a smooth fade
  useEffect(() => {
    if (pdfState !== "analyzing") return;
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIdx((prev) => (prev + 1) % TIPS.length);
        setTipVisible(true);
      }, 350);
    }, 4000);
    return () => clearInterval(interval);
  }, [pdfState]);

  const handleFile = (file: File) => {
    if (!file || file.type !== "application/pdf") return;
    setFileName(file.name);
    setPdfFile(file);
    setPdfState("selected");
    setPdfAnswer("");
    setPdfError("");
    setProgress(null);
    setIsFinalizing(false);
    setStatusMsg("");
    setPageCount(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const handleAnalyze = async () => {
    if (!pdfFile) return;
    setPdfState("analyzing");
    setPdfAnswer("");
    setPdfError("");
    setProgress(null);
    setIsFinalizing(false);
    setPageCount(null);
    setStatusMsg("📄 Belgeniz yükleniyor...");
    setPct(0);
    setTipIdx(0);
    setTipVisible(true);
    try {
      await analyzePdf(pdfFile, {
        onConnected: () => {
          setStatusMsg("🔍 Belge okunuyor ve hazırlanıyor...");
          setPct(15);
        },
        onPages: (count) => {
          setPageCount(count);
          if (count > 10) {
            setStatusMsg(`⏳ Büyük bir belge yüklediniz (${count} sayfa). Tam analiz 5–10 dakika sürebilir. Lütfen sayfayı kapatmayın.`);
          }
        },
        onChunking: () => {
          setStatusMsg("⚙️ Belge bölümlere ayrılıyor ve analiz için hazırlanıyor...");
          setPct(30);
        },
        onProgress: (current, total) => {
          setProgress({ current, total });
          if (current > 0) {
            setStatusMsg(`🤖 Bölüm ${current} / ${total} analiz ediliyor... Lütfen bekleyin.`);
            setPct(30 + Math.round((current / total) * 55));
          }
        },
        onFinalStart: () => {
          setIsFinalizing(true);
          setStatusMsg("📝 Tüm bölümler tamamlandı. Nihai rapor hazırlanıyor...");
          setPct(90);
        },
        onChunk: (chunk) => {
          setPdfAnswer((prev) => prev + chunk);
        },
      });
      setPct(100);
      setPdfState("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analiz sırasında bir hata oluştu.";
      setPdfError(msg);
      setPdfState("selected");
      setStatusMsg("");
      setPct(0);
    }
  };

  const handleReset = () => {
    setPdfState("empty");
    setFileName("");
    setPdfFile(null);
    setPdfAnswer("");
    setPdfError("");
    setProgress(null);
    setIsFinalizing(false);
    setStatusMsg("");
    setPageCount(null);
    setPct(0);
    setTipIdx(0);
    setTipVisible(true);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pdfSections = pdfAnswer ? parseAnswer(pdfAnswer, PDF_SECTION_KEYS) : [];

  return (
    <div className="bg-white rounded-2xl border border-[#E8E3DC] shadow-[0_2px_16px_rgba(27,46,75,0.07)] p-6 sm:p-8 flex flex-col gap-5 border-l-4 border-l-[#C9A84C]">
      {/* Section header */}
      <div>
        <p className="text-base font-bold text-[#1B2E4B]">Belge Yükle ve Analiz Et</p>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Sözleşme, teklif dosyası veya rapor yükleyerek riskleri öğrenin
        </p>
      </div>

      {/* Upload box — empty or selected */}
      {(pdfState === "empty" || pdfState === "selected") && (
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => (pdfState === "empty" || pdfError) && inputRef.current?.click()}
          className={`relative transition-all duration-200 ${
            pdfError
              ? "border-2 border-dashed border-red-300 bg-red-50 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-red-400"
              : pdfState === "selected"
                ? "border-2 border-dashed border-[#C9A84C] bg-[#FDF8F0] rounded-xl p-8 flex flex-col items-center gap-3 cursor-default"
                : isDragging
                  ? "border-2 border-dashed border-[#1B2E4B] bg-[#F0F4FA] rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer"
                  : "border-2 border-dashed border-[#C5D3E8] bg-[#F7F9FC] hover:border-[#1B2E4B] hover:bg-[#F0F4FA] rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />

          {pdfState === "selected" && !pdfError ? (
            <>
              <span className="text-3xl">✅</span>
              <div className="text-center">
                <p className="text-sm font-semibold text-green-700">{fileName}</p>
                <p className="text-xs text-green-600 mt-0.5">Dosya yüklendi</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                className="text-xs text-gray-400 hover:text-gray-600 underline transition"
              >
                Farklı dosya seç
              </button>
            </>
          ) : pdfError ? (
            <>
              <span className="text-3xl">⚠️</span>
              <div className="text-center">
                <p className="text-sm font-semibold text-red-700">Tekrar denemek için tıklayın</p>
                <p className="text-xs text-red-500 mt-0.5">veya farklı bir PDF dosyası yükleyin</p>
              </div>
            </>
          ) : (
            <>
              <span className="text-4xl text-gray-300">📄</span>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">
                  PDF dosyanızı buraya bırakın veya yüklemek için tıklayın
                </p>
                <p className="text-xs text-gray-400 mt-1">Yalnızca PDF formatı desteklenir</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* KVKK consent checkbox */}
      {pdfState === "selected" && (
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={kvkkConsent}
            onChange={(e) => setKvkkConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#C5D3E8] text-[#1B2E4B] accent-[#1B2E4B] cursor-pointer flex-shrink-0"
          />
          <span className="text-xs text-[#6B7280] leading-relaxed group-hover:text-[#2D2D2D] transition-colors">
            <Link href="/kullanim-kosullari" className="text-[#C9A84C] hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
              Kullanım Koşullarını
            </Link>{" "}
            ve{" "}
            <Link href="/kvkk" className="text-[#C9A84C] hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
              KVKK Aydınlatma Metnini
            </Link>{" "}
            okudum, kabul ediyorum.
          </span>
        </label>
      )}

      {/* Analyze button */}
      {pdfState === "selected" && (
        <button
          onClick={handleAnalyze}
          disabled={!kvkkConsent}
          className="w-full bg-[#1B2E4B] hover:bg-[#243d63] active:bg-[#142238] disabled:bg-[#E8E3DC] disabled:text-[#A0A0A0] disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all duration-200 text-sm shadow-sm"
        >
          Belgeyi Analiz Et
        </button>
      )}

      {/* Analyzing state */}
      {pdfState === "analyzing" && (
        <div className="flex flex-col gap-4">

          {/* ── Animated icon + status message ─────────────────────────────── */}
          <div className="flex flex-col items-center gap-4 py-4">
            {/* Pulsing building icon */}
            <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#1B2E4B]/10 animate-ping" style={{ animationDuration: "2.4s" }} />
              <div className="absolute inset-2 rounded-full bg-[#C9A84C]/10 animate-ping" style={{ animationDuration: "2.4s", animationDelay: "0.7s" }} />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#1B2E4B] to-[#243d63] flex items-center justify-center shadow-[0_4px_24px_rgba(27,46,75,0.25)]">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l7-4 7 4v14" />
                  <path d="M9 21v-6h6v6" />
                  <path d="M9 9h.01M12 9h.01M15 9h.01" />
                  <path d="M9 13h.01M12 13h.01M15 13h.01" />
                </svg>
              </div>
            </div>

            {/* Status notification */}
            <div className="w-full flex items-start gap-3 rounded-xl bg-[#FDF8F0] border border-[#E8E3DC] border-l-[3px] border-l-[#C9A84C] px-5 py-3.5 shadow-sm">
              <span className="mt-0.5 flex-shrink-0 inline-block w-4 h-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-[#1B2E4B] leading-snug">{statusMsg || "📄 Belgeniz yükleniyor..."}</p>
            </div>
          </div>

          {/* ── Smooth percentage progress bar ─────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#6B7280]">{getMicroMsg(pct)}</p>
              <p className="text-xs font-bold text-[#C9A84C] tabular-nums">{pct}%</p>
            </div>
            <div className="w-full bg-[#E8E3DC] rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #C9A84C 0%, #e2c06a 100%)",
                }}
              />
            </div>
          </div>

          {/* ── Rotating helpful tips ───────────────────────────────────────── */}
          <div
            className="rounded-xl bg-[#FDF8F0] border border-[#E8E3DC] border-l-[3px] border-l-[#C9A84C] px-5 py-4 transition-opacity duration-300 ease-in-out"
            style={{ opacity: tipVisible ? 1 : 0 }}
          >
            <p className="text-xs text-[#5C4A1E] leading-relaxed">{TIPS[tipIdx]}</p>
          </div>

          {/* ── Streaming preview ─────────────────────────────────────────── */}
          {pdfAnswer && (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest">
                Sonuç hazırlanıyor...
              </p>
              {pdfSections.length > 0 ? (
                pdfSections.map((section) => (
                  <AnswerSection key={section.label} {...section} />
                ))
              ) : (
                <MdBlock text={pdfAnswer} className="text-sm text-[#2D2D2D]" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {pdfError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{pdfError}</p>
      )}

      {/* Result */}
      {pdfState === "done" && pdfAnswer && (
        <div className="flex flex-col gap-3">
          {/* ✅ Message 7 — always visible on completion */}
          <div className="flex items-center gap-3 rounded-xl bg-[#FDF8F0] border border-[#E8E3DC] border-l-[3px] border-l-[#C9A84C] px-5 py-4 shadow-sm">
            <span className="text-lg flex-shrink-0">✅</span>
            <p className="text-sm font-semibold text-[#1B2E4B] leading-snug">Analiz tamamlandı!</p>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-[#1B2E4B] uppercase tracking-widest">Belge Analiz Sonucu</p>
            <button
              onClick={handleReset}
              className="text-xs text-[#6B7280] hover:text-[#2D2D2D] underline transition"
            >
              Yeni belge yükle
            </button>
          </div>

          <p className="text-xs text-[#6B7280] bg-[#F7F9FC] border border-[#E8E3DC] rounded-lg px-3 py-2">
            📄 <span className="font-medium">{fileName}</span>
          </p>

          {pdfSections.length > 0 ? (
            <div className="flex flex-col gap-3">
              {pdfSections.map((section) => (
                <AnswerSection key={section.label} {...section} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-1">
              <span className="inline-block w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span>Analiz hazırlanıyor...</span>
            </div>
          )}

          {/* Expert CTA — show only when full result is parsed */}
          {pdfSections.length > 0 && (
            <div className="mt-1 rounded-xl bg-gradient-to-r from-[#1B2E4B] to-[#243d63] p-5 flex flex-col gap-3">
              <p className="text-sm font-semibold text-white">
                Bu belge için detaylı inceleme önerilir.
                <br />
                <span className="text-xs text-[#C9A84C]/80 font-normal mt-1 block">Uzman incelemesi ile riskleri netleştirebilirsiniz.</span>
              </p>
              <button
                onClick={onExpert}
                className="bg-[#C9A84C] hover:bg-[#b8923e] text-[#1B2E4B] font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm self-start"
              >
                Uzmanla Detaylı İncele
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

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

  const [, navigate] = useLocation();
  const handleExpert = () => navigate("/uzmanlar");

  const parsedSections = rawAnswer ? parseAnswer(rawAnswer, SECTION_KEYS) : [];

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="bg-[#1B2E4B] border-b-2 border-[#C9A84C] py-4 px-6 sticky top-0 z-10 shadow-[0_2px_12px_rgba(27,46,75,0.2)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <span className="text-sm font-bold text-white tracking-tight flex items-center">
            AI Destekli Kentsel Dönüşüm Rehberi
            <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-2 py-0.5 rounded-full ml-2">Beta</span>
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 sm:py-16 sm:px-6">
        <div className="w-full max-w-2xl flex flex-col gap-8">

          {/* Hero */}
          <div className="text-center px-2 pt-2 pb-6">
            <h1 className="text-[2rem] sm:text-[2.5rem] font-extrabold text-[#1B2E4B] leading-[1.2] tracking-tight mb-3">
              Aklınıza Takılan Her Şeyi<br className="hidden sm:block" /> Sade ve Anlaşılır Şekilde Öğrenin
            </h1>
            <p className="text-base sm:text-lg text-[#6B7280] leading-relaxed max-w-lg mx-auto mb-5">
              Bina riskinizi öğrenin, haklarınızı anlayın ve sonraki adımları netleştirin.
            </p>
            <ul className="inline-flex flex-col items-start gap-2 text-sm text-[#2D2D2D]">
              {["Binanızın risklerini anlayın", "Haklarınızı öğrenin", "Doğru adımları planlayın"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Guidance Buttons */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest px-1">Ne yapmak istiyorsunuz?</p>
            <div className="flex flex-wrap gap-2">
              {GUIDANCE_BUTTONS.map(({ label, prompt }) => (
                <button
                  key={label}
                  onClick={() => setQuestion(prompt)}
                  className="bg-white border border-[#E8E3DC] hover:border-[#C9A84C] hover:bg-[#FDF8F0] text-[#2D2D2D] hover:text-[#1B2E4B] text-sm font-medium px-5 py-2.5 rounded-full shadow-sm transition-all duration-200 active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Card */}
          <div className="bg-white rounded-2xl border border-[#E8E3DC] shadow-[0_2px_16px_rgba(27,46,75,0.07)] p-6 sm:p-8 flex flex-col gap-5 border-l-4 border-l-[#C9A84C]">
            <div className="flex items-center justify-between">
              <label htmlFor="question" className="text-sm font-semibold text-[#1B2E4B]">
                Sorunuzu buraya yazın
              </label>
              <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#FDF8F0] border border-[#C9A84C]/30 rounded-full px-2.5 py-1 tracking-wide uppercase">
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
              className="w-full border border-[#E8E3DC] rounded-xl px-4 py-3.5 text-sm text-[#2D2D2D] placeholder-[#A0A0A0] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#1B2E4B] focus:border-transparent transition-all duration-200 disabled:opacity-50 bg-white"
              disabled={loading}
            />
            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="w-full bg-[#1B2E4B] hover:bg-[#243d63] active:bg-[#142238] disabled:bg-[#E8E3DC] disabled:text-[#A0A0A0] disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 text-sm tracking-wide shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analiz ediliyor...
                </>
              ) : "Analizi Başlat"}
            </button>
            <p className="text-[11px] text-[#A0A0A0] text-center leading-relaxed">
              Bu sistem ön bilgilendirme sağlar. Kesin teknik ve hukuki değerlendirme için uzman desteği gerekebilir.
            </p>
          </div>

          {/* Example Questions */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest px-1">Örnek Sorular</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="group text-left bg-white border border-[#E8E3DC] hover:border-[#C9A84C] hover:bg-[#FDF8F0] text-[#2D2D2D] hover:text-[#1B2E4B] text-sm px-5 py-3.5 rounded-xl transition-all duration-200 shadow-sm flex items-start gap-2"
                >
                  <span className="flex-1">{q}</span>
                  <span className="text-[#C9A84C] group-hover:text-[#C9A84C] transition-colors text-xs mt-0.5">→</span>
                </button>
              ))}
            </div>
          </div>

          {/* Q&A Result Area */}
          <div className="bg-white rounded-2xl border border-[#E8E3DC] shadow-[0_2px_16px_rgba(27,46,75,0.07)] p-6 sm:p-8 flex flex-col gap-5 border-l-4 border-l-[#C9A84C]">
            <p className="text-[10px] font-semibold text-[#C9A84C] uppercase tracking-widest">Analiz Sonucu</p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            {!hasAsked && !error && (
              <p className="text-sm text-[#6B7280] italic">Analiz sonucu burada görünecek...</p>
            )}

            {hasAsked && !error && loading && rawAnswer === "" && (
              <div className="flex items-center gap-3 text-gray-400 text-sm py-2">
                <span className="inline-block w-4 h-4 border-2 border-[#1B2E4B] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[#6B7280]">Analiz ediliyor, lütfen bekleyin...</span>
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
              <MdBlock text={rawAnswer} className="text-sm text-[#2D2D2D]" />
            )}

            {hasAsked && !loading && rawAnswer && (
              <div className="mt-1 rounded-xl bg-gradient-to-r from-[#1B2E4B] to-[#243d63] p-5 flex flex-col gap-3">
                <p className="text-sm font-semibold text-white">
                  Bu durumda detaylı analiz önerilir.<br />
                  <span className="text-xs text-[#C9A84C]/80 font-normal mt-1 block">Uzman incelemesi ile riskleri netleştirebilirsiniz.</span>
                </p>
                <button
                  onClick={handleExpert}
                  className="bg-[#C9A84C] hover:bg-[#b8923e] text-[#1B2E4B] font-bold px-5 py-2.5 rounded-lg text-sm transition-all shadow-sm self-start"
                >
                  Detaylı analiz için uzmanla görüş
                </button>
              </div>
            )}
          </div>

          {/* PDF Upload Section */}
          <PdfUploadSection onExpert={handleExpert} />

          {/* Expert Section */}
          <div className="bg-gradient-to-br from-[#1B2E4B] to-[#243d63] rounded-2xl p-8 sm:p-10 text-center flex flex-col items-center gap-4 shadow-[0_4px_20px_rgba(27,46,75,0.25)]">
            <p className="text-xl font-bold text-white leading-snug">Bu konuda risk almak istemiyor musunuz?</p>
            <p className="text-sm text-[#C9A84C]/80 max-w-xs mx-auto">Detaylı analiz ile daha net ve güvenli karar verin</p>
            <button
              onClick={handleExpert}
              className="bg-[#C9A84C] hover:bg-[#b8923e] active:bg-[#a07830] text-[#1B2E4B] font-bold py-3.5 px-8 rounded-xl transition-all duration-200 text-sm shadow-md mt-2"
            >
              Detaylı analiz için uzmanla görüş
            </button>
            <p className="text-xs text-white/50">İnşaat mühendisi, jeolog veya uzman danışman desteği</p>
          </div>

          {/* Trust Features */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest px-1">Neden güvenilir?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Türkiye'ye özel içerik",
                "Sade ve anlaşılır anlatım",
                "Tarafsız analiz",
                "Gerektiğinde uzman yönlendirme",
              ].map((item) => (
                <div key={item} className="bg-white border border-[#E8E3DC] rounded-xl px-5 py-3.5 flex items-center gap-3 shadow-sm hover:border-[#C9A84C] transition-all duration-150">
                  <span className="text-[#C9A84C] font-bold text-sm">✓</span>
                  <span className="text-sm text-[#2D2D2D] font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <AppFooter />
    </div>
  );
}
