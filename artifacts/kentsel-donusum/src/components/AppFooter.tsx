import { Link } from "wouter";

export default function AppFooter() {
  return (
    <footer className="border-t border-[#E8E3DC] bg-[#1B2E4B] py-8 px-6 mt-6">
      <div className="max-w-2xl mx-auto flex flex-col items-center gap-4 text-center">
        <p className="text-xs text-white/50 leading-relaxed">
          Bu bilgiler genel rehberlik amaçlıdır. Hukuki karar değildir.
        </p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link
            href="/kullanim-kosullari"
            className="text-xs text-[#C9A84C]/70 hover:text-[#C9A84C] transition-colors underline underline-offset-2"
          >
            Kullanım Koşulları
          </Link>
          <Link
            href="/kvkk"
            className="text-xs text-[#C9A84C]/70 hover:text-[#C9A84C] transition-colors underline underline-offset-2"
          >
            KVKK Aydınlatma Metni
          </Link>
        </div>
        <p className="text-[10px] text-white/30">© 2024 Kentsel Dönüşüm Rehberi. Tüm hakları saklıdır.</p>
      </div>
    </footer>
  );
}
