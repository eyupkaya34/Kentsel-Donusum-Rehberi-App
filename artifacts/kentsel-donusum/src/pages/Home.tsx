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

async function countPdfPages(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(new Uint8Array(buffer));
    const matches = text.match(/\/Type\s*\/Page(?!s)/g);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

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


function stripMarkdown(s: string): string {
  return s.replace(/^\*+/, "").replace(/\*+$/, "").replace(/^#+\s*/, "").trim();
}

function parseAnswer(
  raw: string,
  sectionKeys: { key: string; label: string; color: string }[]
): { label: string; color: string; lines: string[] }[] {
  const sections: { label: string; color: string; lines: string[] }[] = [];
  let current: { label: string; color: string; lines: string[] } | null = null;

  for (const line of raw.split("\n")) {
    const trimmed = stripMarkdown(line.trim());
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

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
// ── Browser-print PDF report ──────────────────────────────────────────────

function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/🔹|✅|⚠️|❌|📄|🔍|💡|📝|⭐|🏠|🔑/g, "")
    .trim();
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatInline(raw: string): string {
  let s = escHtml(raw);
  s = s.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/&gt;&gt;/g, "");
  return s;
}

function renderLinesHtml(lines: string[]): string {
  let html = "";
  let inList = false;

  const closeList = () => {
    if (inList) { html += "</ul>"; inList = false; }
  };

  for (const rawLine of lines) {
    let line = rawLine
      .replace(/^>+\s*/, "")
      .replace(/^--+$/, "")
      .trim();

    if (!line) { closeList(); continue; }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      closeList();
      const level = Math.min(headingMatch[1].length + 2, 6);
      html += `<h${level} class="md-h">${formatInline(stripEmojis(headingMatch[2]))}</h${level}>`;
      continue;
    }

    if (/^[\*\-•]\s/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${formatInline(stripEmojis(line.replace(/^[\*\-•]\s*/, "")))}</li>`;
      continue;
    }

    closeList();
    html += `<p>${formatInline(stripEmojis(line))}</p>`;
  }

  closeList();
  return html;
}

// ── Extract Güven Seviyesi % from sections ────────────────────────────────
function extractGuvenPct(sections: { label: string; lines: string[] }[]): number | null {
  for (const sec of [...sections].reverse()) {
    const all = [sec.label, ...sec.lines].join(" ");
    const m = all.match(/(\d{1,3})\s*%/) || all.match(/%\s*(\d{1,3})/);
    if (m) {
      const v = parseInt(m[1], 10);
      if (v >= 0 && v <= 100) return v;
    }
  }
  return null;
}

// ── Extract risk bullets from the risk/dikkat section ─────────────────────
function extractRiskInfo(sections: { label: string; lines: string[] }[]): {
  bullets: string[];
  firstItem: string;
} {
  const riskSec = sections.find((s) =>
    /risk|dikkat|olumsuz|tehlike/i.test(stripEmojis(s.label))
  );
  const src = riskSec ?? sections[1] ?? sections[0];
  const bullets = (src?.lines ?? [])
    .filter((l) => /^[\*\-•]/.test(l.trim()) || l.trim().length > 10)
    .map((l) => stripEmojis(l).replace(/^[\*\-•]\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .slice(0, 6);
  const firstItem = bullets[0] ?? "Sözleşme detayları için analiz bölümüne bakınız.";
  return { bullets, firstItem };
}

function openPrintReport(
  fileName: string,
  sections: { label: string; lines: string[] }[],
  rawText: string
): void {
  const now = new Date();
  const dateStr = now.toLocaleString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const dateOnlyStr = now.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const renderSections = sections.length > 0
    ? sections
    : [{ label: "Analiz Sonucu", lines: rawText.split("\n").filter(Boolean) }];

  // ── Extract intelligence from analysis ──────────────────────────────────
  const guvenPct = extractGuvenPct(renderSections);
  const { bullets: riskBullets, firstItem: firstRisk } = extractRiskInfo(renderSections);

  let riskColor = "#C9A84C";
  let riskLabel = "Orta Risk";
  let riskBg = "#FFF8E7";
  let riskBorder = "#C9A84C";
  if (guvenPct !== null) {
    if (guvenPct >= 75) { riskColor = "#16a34a"; riskLabel = "Düşük Risk"; riskBg = "#F0FDF4"; riskBorder = "#16a34a"; }
    else if (guvenPct >= 50) { riskColor = "#d97706"; riskLabel = "Orta Risk"; riskBg = "#FFFBEB"; riskBorder = "#d97706"; }
    else { riskColor = "#dc2626"; riskLabel = "Yüksek Risk"; riskBg = "#FEF2F2"; riskBorder = "#dc2626"; }
  }

  // ── Build main sections HTML ─────────────────────────────────────────────
  const sectionsHtml = renderSections.map((sec) => {
    const label = stripEmojis(sec.label).replace(/^[:\-\s]+/, "").trim();
    return `<div class="section">
        <div class="section-title">${escHtml(label)}</div>
        <div class="section-body">${renderLinesHtml(sec.lines)}</div>
      </div>`;
  }).join("\n");

  // ── Risk summary rows ────────────────────────────────────────────────────
  const riskRowsHtml = riskBullets.slice(0, 4).map((b) =>
    `<div class="risk-item"><span class="risk-dot" style="background:${riskColor}"></span><span>${escHtml(b.slice(0, 120))}${b.length > 120 ? "…" : ""}</span></div>`
  ).join("");

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Kentsel Dönüşüm Rehberi — Analiz Raporu</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #2D2D2D; font-size: 12px; line-height: 1.65; }

    /* ── SCREEN PRINT BAR ───────────────────────────────────────────── */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: #1B2E4B; padding: 10px 24px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .print-bar-left { color: #C9A84C; font-weight: bold; font-size: 13px; }
    .print-bar-right { display: flex; gap: 10px; align-items: center; }
    .print-btn {
      background: #C9A84C; color: #1B2E4B; border: none;
      padding: 8px 22px; font-size: 13px; font-weight: bold;
      cursor: pointer; border-radius: 6px;
    }
    .print-btn:hover { background: #b8963c; }
    .screen-only { display: block; }
    .screen-spacer { height: 52px; }

    /* ── PAGE SHELL ─────────────────────────────────────────────────── */
    .page-wrap { max-width: 820px; margin: 0 auto; }

    /* ── RUNNING HEADER/FOOTER (print fixed) ────────────────────────── */
    .run-header { display: none; }
    .run-footer  { display: none; }

    /* ── COVER PAGE ─────────────────────────────────────────────────── */
    .cover {
      background: #1B2E4B;
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; padding: 0 60px;
      page-break-after: always;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover-kite {
      width: 56px; height: 56px; border-radius: 12px;
      background: #C9A84C; display: flex; align-items: center; justify-content: center;
      margin-bottom: 24px;
    }
    .cover-kite svg { width: 32px; height: 32px; }
    .cover-eyebrow {
      font-size: 10px; color: #C9A84C; letter-spacing: 4px;
      text-transform: uppercase; margin-bottom: 16px;
    }
    .cover-name {
      font-size: 30px; font-weight: bold; color: #fff;
      line-height: 1.2; margin-bottom: 6px;
    }
    .cover-gold-bar {
      width: 80px; height: 3px; background: #C9A84C;
      margin: 28px auto;
    }
    .cover-report-type {
      font-size: 15px; font-weight: bold; color: #C9A84C;
      letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 40px;
    }
    .cover-doc-card {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(201,168,76,0.35);
      border-radius: 10px; padding: 22px 36px;
      max-width: 480px; margin: 0 auto 36px;
    }
    .cover-doc-eyebrow {
      font-size: 9px; color: #C9A84C; letter-spacing: 3px;
      text-transform: uppercase; margin-bottom: 10px;
    }
    .cover-doc-name {
      font-size: 14px; color: #fff; font-weight: bold;
      word-break: break-word; margin-bottom: 12px;
    }
    .cover-doc-date { font-size: 11px; color: rgba(255,255,255,0.55); }
    .cover-tagline {
      font-size: 10px; color: rgba(255,255,255,0.35);
      letter-spacing: 1px; border-top: 1px solid rgba(201,168,76,0.25);
      padding-top: 28px; margin-top: 8px; max-width: 380px;
    }

    /* ── INNER PAGE PADDING ─────────────────────────────────────────── */
    .inner { padding: 44px 52px; }

    /* ── SECTION HEADER (inside inner pages) ────────────────────────── */
    .page-section-header {
      border-bottom: 3px solid #C9A84C;
      padding-bottom: 10px; margin-bottom: 28px;
    }
    .page-section-header h2 {
      font-size: 18px; font-weight: bold; color: #1B2E4B;
    }

    /* ── RISK SUMMARY BOX ───────────────────────────────────────────── */
    .risk-summary-wrap { page-break-after: always; }
    .risk-box {
      border: 2px solid ${riskBorder};
      border-radius: 10px;
      background: ${riskBg};
      overflow: hidden; margin-bottom: 24px;
    }
    .risk-box-header {
      background: ${riskColor};
      padding: 14px 20px;
      display: flex; align-items: center; gap: 12px;
    }
    .risk-badge {
      background: rgba(255,255,255,0.25);
      color: #fff; font-size: 10px; font-weight: bold;
      padding: 3px 10px; border-radius: 20px; letter-spacing: 1px;
      text-transform: uppercase;
    }
    .risk-box-header-title { color: #fff; font-weight: bold; font-size: 14px; }
    .risk-box-body { padding: 20px; }
    .risk-stat-row { display: flex; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
    .risk-stat {
      flex: 1; min-width: 120px;
      background: #fff; border-radius: 8px;
      padding: 14px 16px; border: 1px solid #E8E3DC;
    }
    .risk-stat-label { font-size: 9px; color: #6B7280; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
    .risk-stat-value { font-size: 22px; font-weight: bold; color: ${riskColor}; }
    .risk-stat-unit { font-size: 10px; color: #9CA3AF; }
    .risk-critical-label {
      font-size: 10px; font-weight: bold; color: #374151;
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
    }
    .risk-critical-text {
      font-size: 12px; color: #1B2E4B; line-height: 1.5;
      background: #fff; border-radius: 6px; padding: 10px 14px;
      border-left: 4px solid ${riskColor}; margin-bottom: 14px;
    }
    .risk-item { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 7px; font-size: 11px; color: #374151; }
    .risk-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .risk-tavsiye {
      background: #1B2E4B; color: #C9A84C;
      border-radius: 8px; padding: 12px 16px;
      font-size: 12px; font-weight: bold;
      display: flex; align-items: center; gap: 10px;
    }
    .risk-tavsiye-icon { font-size: 18px; }

    /* ── ANALYSIS SECTIONS ──────────────────────────────────────────── */
    .section { margin-bottom: 26px; page-break-inside: avoid; }
    .section-title {
      font-size: 13px; font-weight: bold; color: #1B2E4B;
      padding-bottom: 5px; margin-bottom: 10px;
      border-bottom: 2px solid #C9A84C;
    }
    .section-body p  { margin-bottom: 7px; color: #2D2D2D; }
    .section-body ul { margin: 4px 0 8px 18px; }
    .section-body li { margin-bottom: 5px; }
    .section-body .md-h { font-size: 12px; font-weight: bold; color: #1B2E4B; margin: 10px 0 5px; }
    .section-body strong { font-weight: bold; }

    /* ── CHECKLIST PAGE ─────────────────────────────────────────────── */
    .checklist-page { page-break-before: always; }
    .checklist-items { margin-top: 20px; }
    .checklist-item {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 13px 16px; border: 1.5px solid #E8E3DC;
      border-radius: 8px; margin-bottom: 10px; background: #FAFAF8;
    }
    .checkbox {
      width: 20px; height: 20px; border: 2px solid #1B2E4B;
      border-radius: 4px; flex-shrink: 0; background: #fff;
    }
    .checklist-text { font-size: 13px; color: #1B2E4B; line-height: 1.4; padding-top: 1px; }
    .checklist-sub  { font-size: 10px; color: #6B7280; margin-top: 2px; }
    .print-note {
      margin-top: 20px; padding: 12px 16px;
      background: #F8F7F4; border-radius: 6px;
      font-size: 10px; color: #9CA3AF; font-style: italic;
    }

    /* ── EXPERT PAGE ────────────────────────────────────────────────── */
    .expert-page { page-break-before: always; }
    .expert-intro { font-size: 13px; color: #374151; margin-bottom: 22px; line-height: 1.7; }
    .expert-cta {
      background: #1B2E4B; border-radius: 12px;
      padding: 28px 32px; text-align: center; margin-bottom: 24px;
    }
    .expert-cta-title { font-size: 16px; font-weight: bold; color: #C9A84C; margin-bottom: 10px; }
    .expert-cta-text { font-size: 13px; color: rgba(255,255,255,0.85); line-height: 1.6; margin-bottom: 20px; }
    .expert-cta-url {
      display: inline-block; background: #C9A84C; color: #1B2E4B;
      font-weight: bold; font-size: 13px;
      padding: 10px 28px; border-radius: 6px; text-decoration: none;
    }
    .expert-types { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 24px; }
    .expert-type-card {
      flex: 1; min-width: 140px;
      border: 1.5px solid #E8E3DC; border-radius: 8px;
      padding: 16px; background: #FAFAF8;
    }
    .expert-type-icon { font-size: 20px; margin-bottom: 8px; }
    .expert-type-title { font-size: 12px; font-weight: bold; color: #1B2E4B; margin-bottom: 4px; }
    .expert-type-desc  { font-size: 10px; color: #6B7280; line-height: 1.4; }

    /* ── DOCUMENT FOOTER ────────────────────────────────────────────── */
    .doc-footer {
      margin-top: 40px; padding: 18px 52px;
      border-top: 3px solid #C9A84C;
      background: #F8F7F4;
    }
    .doc-footer-inner { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; }
    .doc-footer-disc { font-size: 9px; color: #9CA3AF; max-width: 480px; line-height: 1.5; }
    .doc-footer-right { text-align: right; }
    .doc-footer-site { font-size: 11px; font-weight: bold; color: #C9A84C; }
    .doc-footer-date { font-size: 9px; color: #9CA3AF; margin-top: 2px; }

    /* ── @MEDIA PRINT ───────────────────────────────────────────────── */
    @media print {
      .screen-only, .screen-spacer { display: none !important; }
      body { font-size: 11px; }
      .cover {
        min-height: 100vh;
        page-break-after: always;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .risk-box {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .risk-box-header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .expert-cta {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .run-header {
        display: block;
        position: fixed; top: 0; left: 0; right: 0;
        background: #fff; padding: 8px 52px 0;
        border-bottom: 1px solid #E8E3DC;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .run-header-inner {
        display: flex; justify-content: space-between; align-items: center;
        padding-bottom: 6px;
      }
      .run-header-name { font-size: 9px; font-weight: bold; color: #1B2E4B; letter-spacing: 1px; }
      .run-header-doc  { font-size: 9px; color: #9CA3AF; max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .run-header-gold { height: 2px; background: #C9A84C; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .run-footer {
        display: block;
        position: fixed; bottom: 0; left: 0; right: 0;
        background: #fff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .run-footer-gold { height: 2px; background: #C9A84C; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .run-footer-inner {
        display: flex; justify-content: space-between; align-items: center;
        padding: 5px 52px 6px;
      }
      .run-footer-disc { font-size: 8px; color: #9CA3AF; }
      .run-footer-site { font-size: 8px; font-weight: bold; color: #C9A84C; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .inner { padding: 28px 52px; margin-top: 32px; margin-bottom: 28px; }
      .doc-footer { display: none; }
    }
  </style>
</head>
<body>

  <!-- ── SCREEN PRINT BAR ────────────────────────────────────────────────── -->
  <div class="print-bar screen-only">
    <div class="print-bar-left">Kentsel Dönüşüm Rehberi — Analiz Raporu</div>
    <div class="print-bar-right">
      <button class="print-btn" onclick="window.print()">Yazdır / PDF Olarak Kaydet</button>
    </div>
  </div>
  <div class="screen-spacer"></div>

  <!-- ── RUNNING HEADER (print only, fixed, repeats every page) ─────────── -->
  <div class="run-header">
    <div class="run-header-inner">
      <span class="run-header-name">KENTSEL DÖNÜŞÜM REHBERİ</span>
      <span class="run-header-doc">${escHtml(fileName)}</span>
    </div>
    <div class="run-header-gold"></div>
  </div>

  <!-- ── RUNNING FOOTER (print only) ───────────────────────────────────── -->
  <div class="run-footer">
    <div class="run-footer-gold"></div>
    <div class="run-footer-inner">
      <span class="run-footer-disc">Bu rapor bilgilendirme amaçlıdır; hukuki veya teknik tavsiye niteliği taşımaz.</span>
      <span class="run-footer-site">kentseldonusumrehberi.com · ${escHtml(dateStr)}</span>
    </div>
  </div>

  <div class="page-wrap">

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- PAGE 1: COVER                                                      -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div class="cover">
      <div class="cover-kite">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="10" height="10" rx="1" fill="#1B2E4B"/>
          <rect x="18" y="4" width="10" height="10" rx="1" fill="#1B2E4B"/>
          <rect x="4" y="18" width="10" height="10" rx="1" fill="#1B2E4B"/>
          <rect x="18" y="18" width="10" height="10" rx="1" fill="#1B2E4B" opacity="0.5"/>
        </svg>
      </div>
      <div class="cover-eyebrow">Kentsel Dönüşüm Rehberi</div>
      <div class="cover-name">Sözleşme Ön Analiz<br>Raporu</div>
      <div class="cover-gold-bar"></div>
      <div class="cover-report-type">Yapay Zeka Destekli Belge Analizi</div>
      <div class="cover-doc-card">
        <div class="cover-doc-eyebrow">Analiz Edilen Belge</div>
        <div class="cover-doc-name">${escHtml(fileName)}</div>
        <div class="cover-doc-date">Analiz Tarihi: ${escHtml(dateStr)}</div>
      </div>
      <div class="cover-tagline">
        Bu rapor yapay zeka tarafından üretilmiştir.<br>
        Uzman görüşü değildir — Yasal bağlayıcılığı yoktur.<br><br>
        kentseldonusumrehberi.com
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- PAGE 2: RISK EXECUTIVE SUMMARY                                     -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div class="inner risk-summary-wrap">
      <div class="page-section-header">
        <h2>Yönetici Özeti — Risk Değerlendirmesi</h2>
      </div>

      <div class="risk-box">
        <div class="risk-box-header">
          <span class="risk-badge">${escHtml(riskLabel)}</span>
          <span class="risk-box-header-title">Genel Risk Durumu — ${guvenPct !== null ? `Güven Seviyesi %${guvenPct}` : "Değerlendirme tamamlandı"}</span>
        </div>
        <div class="risk-box-body">
          <div class="risk-stat-row">
            <div class="risk-stat">
              <div class="risk-stat-label">Güven Seviyesi</div>
              <div class="risk-stat-value">${guvenPct !== null ? `%${guvenPct}` : "—"}</div>
            </div>
            <div class="risk-stat">
              <div class="risk-stat-label">Tespit Edilen Madde</div>
              <div class="risk-stat-value">${riskBullets.length}</div>
              <div class="risk-stat-unit">dikkat noktası</div>
            </div>
            <div class="risk-stat">
              <div class="risk-stat-label">Tavsiye</div>
              <div class="risk-stat-value" style="font-size:13px;line-height:1.3">Avukat<br>İncelemesi</div>
            </div>
          </div>

          <div class="risk-critical-label">En Kritik Madde</div>
          <div class="risk-critical-text">${escHtml(firstRisk)}</div>

          ${riskRowsHtml ? `<div class="risk-critical-label" style="margin-top:12px">Tespit Edilen Dikkat Noktaları</div>${riskRowsHtml}` : ""}

          <div class="risk-tavsiye">
            <span class="risk-tavsiye-icon">!</span>
            <span>Tavsiye: Bu sözleşmeyi imzalamadan önce mutlaka bir avukata inceletin.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- PAGES 3+: FULL ANALYSIS                                            -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div class="inner">
      <div class="page-section-header">
        <h2>Detaylı Analiz Sonuçları</h2>
      </div>
      ${sectionsHtml}
    </div>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- CHECKLIST PAGE                                                     -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div class="inner checklist-page">
      <div class="page-section-header">
        <h2>Sonraki Adımlar — Kontrol Listesi</h2>
      </div>
      <p style="font-size:12px;color:#6B7280;margin-bottom:20px">
        Bu listeyi yazdırın ve her adımı tamamladıkça işaretleyin.
      </p>
      <div class="checklist-items">
        <div class="checklist-item">
          <div class="checkbox"></div>
          <div>
            <div class="checklist-text">Sözleşmeyi bir kentsel dönüşüm avukatına inceletin</div>
            <div class="checklist-sub">Özellikle hak kayıplarına yol açabilecek maddeler için hukuki görüş alın</div>
          </div>
        </div>
        <div class="checklist-item">
          <div class="checkbox"></div>
          <div>
            <div class="checklist-text">Tüm ekleri ve teknik şartnameleri talep edin</div>
            <div class="checklist-sub">Sözleşmeye atıfta bulunulan tüm ek belgeler eksiksiz olmalıdır</div>
          </div>
        </div>
        <div class="checklist-item">
          <div class="checkbox"></div>
          <div>
            <div class="checklist-text">Yüklenici firma hakkında araştırma yapın</div>
            <div class="checklist-sub">Ticaret sicil kaydı, referanslar ve tamamlanmış projeler</div>
          </div>
        </div>
        <div class="checklist-item">
          <div class="checkbox"></div>
          <div>
            <div class="checklist-text">"Yarısı Bizden" kampanya tarihlerini doğrulayın</div>
            <div class="checklist-sub">Kira yardımı ve destek ödemelerinin süre ve kapsamını teyit edin</div>
          </div>
        </div>
        <div class="checklist-item">
          <div class="checkbox"></div>
          <div>
            <div class="checklist-text">Teknik şartname için bağımsız mühendis görüşü alın</div>
            <div class="checklist-sub">Yapı kalitesi, malzeme standartları ve teslim süresi garantileri</div>
          </div>
        </div>
        <div class="checklist-item">
          <div class="checkbox"></div>
          <div>
            <div class="checklist-text">Kira yardımı ve taşınma desteği belgelerini imzalayın</div>
            <div class="checklist-sub">Tüm ödemelerin yazılı taahhüt altına alındığından emin olun</div>
          </div>
        </div>
        <div class="checklist-item">
          <div class="checkbox"></div>
          <div>
            <div class="checklist-text">Yeni konutun tapu ve kat planını talep edin</div>
            <div class="checklist-sub">Daire numarası, konum ve kat bilgisi sözleşmede açıkça belirtilmeli</div>
          </div>
        </div>
      </div>
      <div class="print-note">
        Bu kontrol listesi genel niteliktedir. Durumunuza özgü ek adımlar için uzman desteği alın.
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- EXPERT REFERRAL PAGE                                               -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div class="inner expert-page">
      <div class="page-section-header">
        <h2>Uzman Desteği Alın</h2>
      </div>
      <p class="expert-intro">
        Bu rapor, sözleşmenizin yapay zeka tarafından yapılmış ön analizini sunar.
        Kentsel dönüşüm sürecinde haklarınızı tam anlamıyla korumak için
        alanında uzman profesyonellerle çalışmanızı şiddetle tavsiye ederiz.
        Aşağıdaki uzman türleri bu süreçte size doğrudan destek sağlayabilir.
      </p>

      <div class="expert-types">
        <div class="expert-type-card">
          <div class="expert-type-icon">Hukuk</div>
          <div class="expert-type-title">Kentsel Dönüşüm Avukatı</div>
          <div class="expert-type-desc">Sözleşme inceleme, hak kayıplarının önlenmesi ve müzakere desteği</div>
        </div>
        <div class="expert-type-card">
          <div class="expert-type-icon">Müh.</div>
          <div class="expert-type-title">İnşaat Mühendisi</div>
          <div class="expert-type-desc">Teknik şartname kontrolü, yapı kalitesi ve teslim süresi değerlendirmesi</div>
        </div>
        <div class="expert-type-card">
          <div class="expert-type-icon">Mali</div>
          <div class="expert-type-title">Mali Müşavir</div>
          <div class="expert-type-desc">Kira yardımı, vergi avantajları ve finansal etkilerin analizi</div>
        </div>
      </div>

      <div class="expert-cta">
        <div class="expert-cta-title">Bu raporu uzmanınıza gösterin</div>
        <div class="expert-cta-text">
          Kentsel dönüşüm haklarınızı koruyun.<br>
          Sözleşmenizi imzalamadan önce profesyonel destek alın.
        </div>
        <span class="expert-cta-url">kentseldonusumrehberi.com</span>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════ -->
    <!-- DOCUMENT FOOTER (screen only — print uses run-footer)              -->
    <!-- ══════════════════════════════════════════════════════════════════ -->
    <div class="doc-footer">
      <div class="doc-footer-inner">
        <div class="doc-footer-disc">
          Bu rapor yalnızca genel bilgilendirme amacıyla hazırlanmıştır. Kesin hukuki veya mühendislik kararı niteliği taşımaz.
          Önemli kararlar için lisanslı uzman görüşü alınız. © ${now.getFullYear()} Kentsel Dönüşüm Rehberi
        </div>
        <div class="doc-footer-right">
          <div class="doc-footer-site">kentseldonusumrehberi.com</div>
          <div class="doc-footer-date">${escHtml(dateOnlyStr)}</div>
        </div>
      </div>
    </div>

  </div><!-- /page-wrap -->

  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 500);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Lütfen açılır pencere engelleyicisini devre dışı bırakın ve tekrar deneyin.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

async function extractPdfText(file: File): Promise<string> {
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDFJS_CDN;
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const pdfjsLib = (window as any).pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as { str: string }[]).map((item) => item.str).join(" ");
    text += `\n[Sayfa ${i}]\n${pageText}`;
  }
  return text.trim();
}

interface PdfCallbacks {
  onChunk: (text: string) => void;
  onFinalStart: () => void;
  onConnected: () => void;
}

async function analyzePdf(file: File, cb: PdfCallbacks): Promise<void> {
  const extractedText = await extractPdfText(file);
  const res = await fetch(`${BASE}/api/anthropic/analyze-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: extractedText, filename: file.name }),
  });
  if (!res.ok || !res.body) throw new Error("Analiz başlatılamadı.");

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
          if (payload.type === "final_start") cb.onFinalStart();
          else if (payload.content) cb.onChunk(payload.content);
          else if (payload.error) serverError = payload.error;
        } catch {}
      }
    }
  }

  if (serverError) throw new Error(serverError);
}

function PdfUploadSection({ onExpert }: { onExpert: () => void }) {
  const [pdfState, setPdfState] = useState<PdfState>("empty");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfAnswer, setPdfAnswer] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [kvkkConsent, setKvkkConsent] = useState(false);
  const [pct, setPct] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pdfStreamRef = useRef<string>("");

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

  const handleFile = async (file: File) => {
    if (!file || file.type !== "application/pdf") return;

    const MB = 1024 * 1024;
    const sizeMB = file.size / MB;
    const sizeStr = sizeMB < 1 ? `${Math.round(sizeMB * 1024)} KB` : `${sizeMB.toFixed(1)} MB`;

    // Hard limit: file size > 10 MB
    if (file.size > 10 * MB) {
      setFileName(file.name);
      setPdfFile(null);
      setPdfState("selected");
      setPdfError("⚠️ Dosya boyutu 10MB sınırını aşmaktadır. Lütfen daha küçük bir dosya yükleyiniz.");
      setFileInfo(null);
      setSoftWarning(null);
      return;
    }

    // Count pages before accepting
    const pages = await countPdfPages(file);

    // Hard limit: > 30 pages
    if (pages > 30) {
      setFileName(file.name);
      setPdfFile(null);
      setPdfState("selected");
      setPdfError("⚠️ Belgeniz 30 sayfadan fazla içermektedir. Lütfen belgeyi bölüp en fazla 30 sayfalık bölümler halinde yükleyiniz.");
      setFileInfo(null);
      setSoftWarning(null);
      return;
    }

    // Soft warning: 20–30 pages
    if (pages >= 20) {
      setSoftWarning(`📄 Uzun belge tespit edildi (${pages} sayfa). Analiz 2-3 dakika sürebilir. Lütfen sayfayı kapatmayın.`);
    } else {
      setSoftWarning(null);
    }

    const infoStr = pages > 0 ? `${pages} sayfa · ${sizeStr}` : sizeStr;
    setFileInfo(infoStr);
    setFileName(file.name);
    setPdfFile(file);
    setPdfState("selected");
    setPdfAnswer("");
    setPdfError("");
    setStatusMsg("");
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
    setEstimatedTime(null);
    setStatusMsg("📄 Belgeniz yükleniyor...");
    setTipIdx(0);
    setTipVisible(true);

    // Jump to 15% immediately, then crawl to 85% over ~40s
    setPct(15);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setPct((prev) => {
        if (prev >= 85) {
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          return 85;
        }
        return Math.min(prev + 1.75, 85);
      });
    }, 1000);

    pdfStreamRef.current = "";

    try {
      await analyzePdf(pdfFile, {
        onConnected: () => {
          setStatusMsg("🔍 Belge Claude'a gönderiliyor...");
          setEstimatedTime("Tahmini süre: 30-60 saniye");
        },
        onFinalStart: () => {
          setStatusMsg("📝 Analiz tamamlanıyor, lütfen bekleyin...");
          if (progressTimerRef.current) clearInterval(progressTimerRef.current);
          setPct(90);
        },
        onChunk: (chunk) => {
          pdfStreamRef.current += chunk;
        },
      });
      // Stream is complete — clean and display the full result at once
      const cleaned = pdfStreamRef.current
        .replace(/\*\*/g, "")
        .replace(/^[ \t]*\*(?!\*)/gm, "•");
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setPdfAnswer(cleaned);
      setPct(100);
      setPdfState("done");
    } catch (e) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      const msg = e instanceof Error ? e.message : "Analiz sırasında bir hata oluştu.";
      setPdfError(msg);
      setPdfState("selected");
      setStatusMsg("");
      setPct(0);
    }
  };

  const handleReset = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setPdfState("empty");
    setFileName("");
    setPdfFile(null);
    setPdfAnswer("");
    setPdfError("");
    setStatusMsg("");
    setPct(0);
    setTipIdx(0);
    setTipVisible(true);
    setEstimatedTime(null);
    setFileInfo(null);
    setSoftWarning(null);
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
                {fileInfo && (
                  <p className="text-xs text-[#9CA3AF] mt-0.5">{fileInfo}</p>
                )}
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

      {/* Soft warning — 20–30 page documents */}
      {pdfState === "selected" && softWarning && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="text-amber-500 text-sm flex-shrink-0 mt-0.5">⚠️</span>
          <p className="text-xs text-amber-800 leading-relaxed">{softWarning}</p>
        </div>
      )}

      {/* KVKK consent checkbox */}
      {pdfState === "selected" && !pdfError && (
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
      {pdfState === "selected" && !pdfError && (
        <button
          onClick={handleAnalyze}
          disabled={!kvkkConsent || !pdfFile}
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

            {/* Estimated time */}
            {estimatedTime && (
              <p className="text-xs text-[#9CA3AF] text-center">{estimatedTime}</p>
            )}
          </div>

          {/* ── Smooth percentage progress bar ─────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#6B7280]">{getMicroMsg(pct)}</p>
              <p className="text-xs font-bold text-[#C9A84C] tabular-nums">{Math.round(pct)}%</p>
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

        </div>
      )}

      {/* Error */}
      {pdfError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{pdfError}</p>
      )}

      {/* Result */}
      {pdfState === "done" && pdfAnswer && (
        <div className="flex flex-col gap-3">
          {/* ✅ Completion banner + download button */}
          <div className="flex items-center gap-3 rounded-xl bg-[#FDF8F0] border border-[#E8E3DC] border-l-[3px] border-l-[#C9A84C] px-5 py-4 shadow-sm">
            <span className="text-lg flex-shrink-0">✅</span>
            <p className="text-sm font-semibold text-[#1B2E4B] leading-snug">Analiz tamamlandı!</p>
          </div>

          {/* 📥 Download report button */}
          <button
            onClick={() => {
              setIsGeneratingReport(true);
              try {
                openPrintReport(fileName, pdfSections, pdfAnswer);
              } catch (e) {
                console.error("Report generation failed:", e);
              } finally {
                setIsGeneratingReport(false);
              }
            }}
            disabled={isGeneratingReport}
            className="w-full flex items-center justify-center gap-2 bg-[#1B2E4B] hover:bg-[#243d63] active:bg-[#142238] disabled:opacity-60 disabled:cursor-not-allowed text-[#C9A84C] font-bold py-4 rounded-xl transition-all duration-200 text-sm shadow-md border border-[#C9A84C]/30"
          >
            {isGeneratingReport ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                <span>Rapor hazırlanıyor...</span>
              </>
            ) : (
              <span>📥 Raporu İndir — 49,99 TL</span>
            )}
          </button>

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
            <MdBlock text={pdfAnswer} className="text-sm text-[#2D2D2D]" />
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
