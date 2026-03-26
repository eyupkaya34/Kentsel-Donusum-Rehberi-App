import { useState, useEffect } from "react";
import { Link } from "wouter";

const STORAGE_KEY = "kd_welcome_accepted";

interface WelcomeModalProps {
  isFirstVisit: boolean;
  onAccept: () => void;
  onClose: () => void;
}

function WelcomeModal({ isFirstVisit, onAccept, onClose }: WelcomeModalProps) {
  const [termsChecked, setTermsChecked] = useState(false);
  const [kvkkChecked, setKvkkChecked] = useState(false);
  const canProceed = termsChecked && kvkkChecked;

  const handleAccept = () => {
    if (!canProceed) return;
    onAccept();
  };

  const handleBackdropClick = () => {
    if (!isFirstVisit) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Modal card — stop propagation so clicking inside doesn't close */}
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_8px_40px_rgba(27,46,75,0.25)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header stripe */}
        <div className="bg-[#1B2E4B] border-b-2 border-[#C9A84C] px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#C9A84C] uppercase tracking-widest mb-0.5">
              Kentsel Dönüşüm Rehberi
            </p>
            <h2 className="text-xl font-extrabold text-white leading-tight">Hoş Geldiniz</h2>
          </div>
          {/* Close button — only when not first visit */}
          {!isFirstVisit && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors text-sm ml-4 flex-shrink-0"
              aria-label="Kapat"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-5">
          {/* Intro text */}
          <p className="text-sm text-[#2D2D2D] leading-relaxed">
            Bu platform, kentsel dönüşüm süreçleri hakkında genel bilgilendirme amacıyla
            hazırlanmıştır.
            <br /><br />
            Platformu kullanmadan önce lütfen aşağıdakileri okuyun ve onaylayın:
          </p>

          {/* Checkboxes */}
          <div className="flex flex-col gap-4">
            {/* Checkbox 1 — Terms */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#C5D3E8] accent-[#1B2E4B] cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-[#2D2D2D] leading-relaxed group-hover:text-[#1B2E4B] transition-colors">
                <Link
                  href="/kullanim-kosullari"
                  className="text-[#C9A84C] font-semibold hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Kullanım Koşullarını
                </Link>{" "}
                okudum ve kabul ediyorum.
              </span>
            </label>

            {/* Checkbox 2 — KVKK */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={kvkkChecked}
                onChange={(e) => setKvkkChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#C5D3E8] accent-[#1B2E4B] cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-[#2D2D2D] leading-relaxed group-hover:text-[#1B2E4B] transition-colors">
                <Link
                  href="/kvkk"
                  className="text-[#C9A84C] font-semibold hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  KVKK Aydınlatma Metni
                </Link>
                {'\''}ni okudum ve kişisel verilerimin işlenmesini kabul ediyorum.
              </span>
            </label>
          </div>

          {/* Disclaimer */}
          <div className="bg-[#FDF8F0] border border-[#C9A84C]/30 rounded-xl px-4 py-3">
            <p className="text-xs text-[#5C4A1E] leading-relaxed">
              Bu platform kesin hukuki veya mühendislik kararı vermez. Yüklediğiniz belgeler
              analiz sonrası otomatik olarak silinir.
            </p>
          </div>

          {/* CTA button */}
          <button
            onClick={handleAccept}
            disabled={!canProceed}
            className={`w-full font-bold py-4 px-6 rounded-xl text-sm transition-all duration-200 tracking-wide ${
              canProceed
                ? "bg-[#1B2E4B] text-[#C9A84C] hover:bg-[#243d63] shadow-md cursor-pointer"
                : "bg-[#E8E3DC] text-[#A0A0A0] cursor-not-allowed"
            }`}
          >
            Kabul Ediyorum ve Devam Et →
          </button>
        </div>
      </div>
    </div>
  );
}

export function useWelcomeModal() {
  const [showModal, setShowModal] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(true);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY) === "true";
    setHasAccepted(accepted);
    if (!accepted) {
      setShowModal(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setHasAccepted(true);
    setShowModal(false);
  };

  const openInfo = () => setShowModal(true);
  const closeInfo = () => {
    if (hasAccepted) setShowModal(false);
  };

  return { showModal, hasAccepted, accept, openInfo, closeInfo };
}

export default WelcomeModal;
