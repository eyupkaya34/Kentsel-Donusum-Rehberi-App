import { useState } from "react";
import { useLocation } from "wouter";

const CATEGORIES = [
  "Tümü",
  "İnşaat Mühendisi",
  "Jeoloji Uzmanı",
  "Hukuk Danışmanı",
  "Kentsel Dönüşüm Danışmanı",
];

interface Expert {
  id: number;
  name: string;
  title: string;
  category: string;
  about: string;
  tags: string[];
  price: string;
  initials: string;
  color: string;
  experience: string;
}

const EXPERTS: Expert[] = [
  {
    id: 1,
    name: "Murat Çelik",
    title: "İnşaat Mühendisi",
    category: "İnşaat Mühendisi",
    about:
      "15 yıllık deneyimiyle yapısal risk değerlendirmesi ve deprem performans analizi konularında uzmanlaşmış bir inşaat mühendisi. İstanbul ve çevre ilçelerde yüzlerce bina incelemesi gerçekleştirmiştir.",
    tags: ["Yapısal Risk Analizi", "Deprem Performansı", "Bina Güçlendirme", "Zemin Etüdü"],
    price: "1.800 TL / seans",
    initials: "MÇ",
    color: "bg-blue-600",
    experience: "15 yıl deneyim",
  },
  {
    id: 2,
    name: "Selin Aydın",
    title: "İnşaat Mühendisi",
    category: "İnşaat Mühendisi",
    about:
      "Kentsel dönüşüm projelerinde teknik danışmanlık ve ruhsat süreçlerinde uzman. Özellikle eski yapıların yeni yönetmeliklere uygunluk analizi konusunda 12 yıllık deneyime sahip.",
    tags: ["Teknik Danışmanlık", "Ruhsat Süreci", "Uygunluk Analizi", "Proje Yönetimi"],
    price: "1.500 TL / seans",
    initials: "SA",
    color: "bg-violet-600",
    experience: "12 yıl deneyim",
  },
  {
    id: 3,
    name: "Dr. Kemal Yıldız",
    title: "Jeoloji Uzmanı",
    category: "Jeoloji Uzmanı",
    about:
      "Zemin ve temel mühendisliği alanında doktora derecesine sahip uzman. Kentsel alanlarda zemin sıvılaşması, heyelan riski ve temel güçlendirme projelerinde kapsamlı deneyim.",
    tags: ["Zemin Etüdü", "Sıvılaşma Analizi", "Heyelan Riski", "Temel Güçlendirme"],
    price: "2.500 TL / seans",
    initials: "KY",
    color: "bg-emerald-600",
    experience: "18 yıl deneyim",
  },
  {
    id: 4,
    name: "Ayşe Kara",
    title: "Jeoloji Uzmanı",
    category: "Jeoloji Uzmanı",
    about:
      "Deprem bölgesi zemin karakterizasyonu ve riskli alan tespiti konularında uzman. İstanbul Avrupa yakasında çok sayıda mahalle bazında zemin riski haritalaması projesi yürütmüştür.",
    tags: ["Zemin Karakterizasyonu", "Riskli Alan Tespiti", "CBS Haritalama", "Deprem Riski"],
    price: "2.200 TL / seans",
    initials: "AK",
    color: "bg-teal-600",
    experience: "10 yıl deneyim",
  },
  {
    id: 5,
    name: "Av. Hasan Öztürk",
    title: "Hukuk Danışmanı",
    category: "Hukuk Danışmanı",
    about:
      "Kentsel dönüşüm hukuku, kat karşılığı inşaat sözleşmeleri ve kiracı hakları konularında deneyimli avukat. 6306 Sayılı Afet Riski Altındaki Alanların Dönüştürülmesi Kanunu kapsamındaki davalarda 200'den fazla davayı başarıyla sonuçlandırmıştır.",
    tags: ["Kentsel Dönüşüm Hukuku", "Kiracı Hakları", "Kat Karşılığı Sözleşme", "6306 Kanunu"],
    price: "2.000 TL / seans",
    initials: "HÖ",
    color: "bg-orange-600",
    experience: "14 yıl deneyim",
  },
  {
    id: 6,
    name: "Fatma Şahin",
    title: "Kentsel Dönüşüm Danışmanı",
    category: "Kentsel Dönüşüm Danışmanı",
    about:
      "Belediyeler ve özel sektörde kentsel dönüşüm proje koordinasyonu alanında uzman. Müteahhit seçimi, sözleşme müzakere süreçleri ve hak sahipleriyle diyalog yönetimi konularında kapsamlı birikim.",
    tags: ["Proje Koordinasyonu", "Müteahhit Seçimi", "Hak Sahibi Diyaloğu", "Sözleşme Müzakeresi"],
    price: "1.800 TL / seans",
    initials: "FŞ",
    color: "bg-rose-600",
    experience: "9 yıl deneyim",
  },
];

interface ContactForm {
  name: string;
  phone: string;
  note: string;
  type: string;
}

const MEETING_TYPES = ["Online Görüşme", "Telefon Görüşmesi", "Ön Değerlendirme"];

function ContactModal({ expert, onClose }: { expert: Expert; onClose: () => void }) {
  const [form, setForm] = useState<ContactForm>({
    name: "",
    phone: "",
    note: "",
    type: "Online Görüşme",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E8E3DC]">
          <div>
            <p className="text-base font-bold text-[#1B2E4B]">Görüşme Talep Et</p>
            <p className="text-sm text-[#6B7280] mt-0.5">{expert.name} · {expert.title}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F0F4FA] hover:bg-[#E8E3DC] text-[#6B7280] transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="px-6 py-10 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[#FDF8F0] flex items-center justify-center text-2xl text-[#C9A84C]">
              ✓
            </div>
            <p className="text-base font-bold text-[#1B2E4B]">Talebiniz Alındı</p>
            <p className="text-sm text-[#6B7280] leading-relaxed max-w-xs">
              Talebiniz alınmıştır. En kısa sürede sizinle iletişime geçilecektir.
            </p>
            <button
              onClick={onClose}
              className="mt-2 bg-[#1B2E4B] hover:bg-[#243d63] text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all duration-200"
            >
              Tamam
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Ad Soyad</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Adınızı ve soyadınızı girin"
                className="w-full border border-[#E8E3DC] rounded-xl px-4 py-3 text-sm text-[#2D2D2D] placeholder-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#1B2E4B] focus:border-transparent transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Telefon</label>
              <input
                required
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="05XX XXX XX XX"
                className="w-full border border-[#E8E3DC] rounded-xl px-4 py-3 text-sm text-[#2D2D2D] placeholder-[#A0A0A0] focus:outline-none focus:ring-2 focus:ring-[#1B2E4B] focus:border-transparent transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Kısa Not</label>
              <textarea
                rows={3}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Danışmanlık konunuzu kısaca belirtin..."
                className="w-full border border-[#E8E3DC] rounded-xl px-4 py-3 text-sm text-[#2D2D2D] placeholder-[#A0A0A0] resize-none focus:outline-none focus:ring-2 focus:ring-[#1B2E4B] focus:border-transparent transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Görüşme Türü</label>
              <div className="flex flex-wrap gap-2">
                {MEETING_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, type })}
                    className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-all duration-150 ${
                      form.type === type
                        ? "bg-[#1B2E4B] border-[#1B2E4B] text-white"
                        : "bg-white border-[#E8E3DC] text-[#6B7280] hover:border-[#C9A84C] hover:text-[#1B2E4B]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-[#E8E3DC] flex items-center justify-between gap-3">
              <p className="text-xs text-[#6B7280] leading-snug">
                Fiyat: <span className="font-semibold text-[#1B2E4B]">{expert.price}</span>
              </p>
              <button
                type="submit"
                className="bg-[#1B2E4B] hover:bg-[#243d63] active:bg-[#142238] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all duration-200 shadow-sm"
              >
                Talep Gönder
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ExpertCard({ expert, onContact }: { expert: Expert; onContact: (e: Expert) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E3DC] shadow-[0_2px_12px_rgba(27,46,75,0.06)] p-6 flex flex-col gap-4 hover:shadow-[0_4px_20px_rgba(27,46,75,0.1)] hover:border-[#C9A84C]/40 transition-all duration-200 border-l-4 border-l-[#C9A84C]">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl ${expert.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
          {expert.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[#1B2E4B] leading-tight">{expert.name}</p>
          <p className="text-sm text-[#6B7280] mt-0.5">{expert.title}</p>
          <p className="text-xs text-[#A0A0A0] mt-0.5">{expert.experience}</p>
        </div>
      </div>
      <p className="text-sm text-[#2D2D2D] leading-relaxed">{expert.about}</p>
      <div className="flex flex-wrap gap-1.5">
        {expert.tags.map((tag) => (
          <span
            key={tag}
            className="text-[11px] font-medium bg-[#F0F4FA] text-[#1B2E4B] px-2.5 py-1 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="border-t border-[#E8E3DC] pt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Danışmanlık Ücreti</p>
          <p className="text-base font-bold text-[#1B2E4B] mt-0.5">{expert.price}</p>
        </div>
        <button
          onClick={() => onContact(expert)}
          className="bg-[#1B2E4B] hover:bg-[#243d63] active:bg-[#142238] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-sm whitespace-nowrap"
        >
          Randevu Al
        </button>
      </div>
    </div>
  );
}

export default function Uzmanlar() {
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState("Tümü");
  const [search, setSearch] = useState("");
  const [contactExpert, setContactExpert] = useState<Expert | null>(null);

  const filtered = EXPERTS.filter((e) => {
    const matchesCategory = activeCategory === "Tümü" || e.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.title.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="bg-[#1B2E4B] border-b-2 border-[#C9A84C] py-4 px-6 sticky top-0 z-10 shadow-[0_2px_12px_rgba(27,46,75,0.2)]">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            <span className="text-lg leading-none">←</span>
            <span>Ana Sayfa</span>
          </button>
          <div className="w-px h-5 bg-white/20" />
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-white tracking-tight">Uzman Rehberi</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 sm:py-16 sm:px-6">
        <div className="w-full max-w-5xl flex flex-col gap-8">

          {/* Page hero */}
          <div className="text-center px-2">
            <h1 className="text-[1.75rem] sm:text-[2.25rem] font-extrabold text-[#1B2E4B] leading-[1.2] tracking-tight mb-3">
              Alanında Uzman Danışmanlarla Görüşün
            </h1>
            <p className="text-base text-[#6B7280] leading-relaxed max-w-xl mx-auto">
              İhtiyacınıza uygun uzmanı seçin, kısa profilini inceleyin ve danışmanlık ücretini görün.
            </p>
          </div>

          {/* Trust bullets */}
          <div className="bg-[#FDF8F0] border border-[#C9A84C]/30 rounded-2xl px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-xs font-semibold text-[#8B6914] sm:mr-2 shrink-0">ℹ️ Bilgi:</p>
            <p className="text-xs text-[#5C4A1E] leading-relaxed">
              Uzman bilgileri demo içeriktir. Gerçek uzman entegrasyonu bir sonraki aşamada yapılacaktır.
              Taleplerinizi bırakabilir, süreç başladığında bildirim alabilirsiniz.
            </p>
          </div>

          {/* Trust features row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "🎯", label: "Uzmanlık alanına göre filtreleme" },
              { icon: "💰", label: "Şeffaf ücret bilgisi" },
              { icon: "📋", label: "Kolay talep oluşturma" },
            ].map(({ icon, label }) => (
              <div key={label} className="bg-white border border-[#E8E3DC] rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-sm hover:border-[#C9A84C] transition-all duration-150">
                <span className="text-lg">{icon}</span>
                <span className="text-sm text-[#2D2D2D] font-medium">{label}</span>
              </div>
            ))}
          </div>

          {/* Filters + Search */}
          <div className="flex flex-col gap-4">
            {/* Category chips */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200 ${
                    activeCategory === cat
                      ? "bg-[#1B2E4B] border-[#1B2E4B] text-white shadow-sm"
                      : "bg-white border-[#E8E3DC] text-[#2D2D2D] hover:border-[#C9A84C] hover:text-[#1B2E4B]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Uzman adı veya uzmanlık alanı ara"
                className="w-full pl-10 pr-4 py-3.5 border border-[#E8E3DC] rounded-xl text-sm text-[#2D2D2D] placeholder-[#A0A0A0] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2E4B] focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Results count */}
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest -mb-4">
            {filtered.length} uzman listeleniyor
          </p>

          {/* Expert grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((expert) => (
                <ExpertCard key={expert.id} expert={expert} onContact={setContactExpert} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E8E3DC] p-12 text-center">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-base font-semibold text-[#1B2E4B] mb-1">Sonuç bulunamadı</p>
              <p className="text-sm text-[#6B7280]">Farklı bir arama terimi veya kategori deneyin.</p>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E3DC] bg-[#1B2E4B] py-6 px-6 mt-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs text-white/50 leading-relaxed">
            Bu bilgiler genel rehberlik amaçlıdır. Hukuki karar değildir.
          </p>
        </div>
      </footer>

      {/* Contact modal */}
      {contactExpert && (
        <ContactModal expert={contactExpert} onClose={() => setContactExpert(null)} />
      )}
    </div>
  );
}
