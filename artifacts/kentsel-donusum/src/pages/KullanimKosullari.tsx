import { Link } from "wouter";
import AppFooter from "@/components/AppFooter";

const SECTIONS = [
  {
    title: "1. Hizmetin Amacı",
    content:
      "Bu platform yalnızca genel bilgilendirme amaçlıdır. Sunulan içerikler, yapay zeka destekli analizlere dayanmakta olup kesin hukuki, mühendislik veya yapısal karar niteliği taşımamaktadır. Platform, kentsel dönüşüm konusunda kullanıcıları bilgilendirmeyi ve doğru uzmanlara yönlendirmeyi hedefler.",
  },
  {
    title: "2. Sorumluluk Reddi",
    content:
      "Platformda yer alan hiçbir bilgi, analiz veya öneri; lisanslı bir mimar, mühendis, jeolog veya avukatın profesyonel danışmanlığının yerine geçmez. Kullanıcı, platform üzerinden elde ettiği bilgilere dayanarak aldığı kararların tüm sorumluluğunu kabul eder. Platform sahibi, bu kararlardan doğabilecek maddi veya manevi zararlardan sorumlu tutulamaz.",
  },
  {
    title: "3. Uzman Yönlendirmesi",
    content:
      "Binanızın yapısal güvenliği, hukuki durumu veya kentsel dönüşüm sürecine ilişkin ciddi ve bağlayıcı kararlar için mutlaka lisanslı bir mimar, inşaat mühendisi, jeoloji uzmanı veya avukattan profesyonel destek alınız. Bu platform, uzman desteğinin bir alternatifi değil, ona hazırlık sürecinde bir rehber niteliğindedir.",
  },
  {
    title: "4. Hizmet Kullanımı",
    content:
      "Bu platformu yalnızca yasal amaçlarla kullanabilirsiniz. Platformun kötüye kullanımı, yanıltıcı bilgi girişi, başkalarının haklarını ihlal eden içerik yüklenmesi veya sistemin güvenliğini tehdit edecek herhangi bir eylem kesinlikle yasaktır. Platform sahibi, bu tür kullanımları tespit etmesi halinde hizmeti kısıtlama veya sonlandırma hakkını saklı tutar.",
  },
  {
    title: "5. Değişiklik Hakkı",
    content:
      "Platform içeriği, hizmet kapsamı ve kullanım koşulları önceden haber verilmeksizin değiştirilebilir. Güncel koşullar her zaman bu sayfa üzerinden yayınlanacaktır. Platformu kullanmaya devam etmeniz, değiştirilmiş koşulları kabul ettiğiniz anlamına gelir.",
  },
  {
    title: "6. İletişim",
    content:
      "Kullanım koşullarına ilişkin soru ve görüşleriniz için kentseldonusumrehber.com.tr adresimiz üzerinden bizimle iletişime geçebilirsiniz.",
  },
];

export default function KullanimKosullari() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="bg-[#1B2E4B] border-b-2 border-[#C9A84C] py-4 px-6 sticky top-0 z-10 shadow-[0_2px_12px_rgba(27,46,75,0.2)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="text-white/70 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"
          >
            ← Ana Sayfa
          </Link>
          <span className="w-px h-5 bg-white/20" />
          <span className="text-sm font-bold text-white tracking-tight">Kullanım Koşulları</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-8">
          {/* Hero */}
          <div className="text-center">
            <h1 className="text-[1.75rem] sm:text-[2.25rem] font-extrabold text-[#1B2E4B] leading-[1.2] tracking-tight mb-3">
              Kullanım Koşulları
            </h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Son güncellenme: Aralık 2024
            </p>
          </div>

          {/* Intro card */}
          <div className="bg-[#FDF8F0] border border-[#C9A84C]/30 border-l-4 border-l-[#C9A84C] rounded-xl px-6 py-4">
            <p className="text-sm text-[#5C4A1E] leading-relaxed">
              Bu platformu kullanmadan önce lütfen aşağıdaki kullanım koşullarını dikkatlice okuyunuz. Platformu kullanmaya başlamanız, bu koşulları okuduğunuzu ve kabul ettiğinizi gösterir.
            </p>
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-5">
            {SECTIONS.map((section) => (
              <div
                key={section.title}
                className="bg-white rounded-2xl border border-[#E8E3DC] shadow-[0_2px_16px_rgba(27,46,75,0.07)] p-6 border-l-4 border-l-[#C9A84C]"
              >
                <h2 className="text-base font-bold text-[#1B2E4B] mb-2">{section.title}</h2>
                <p className="text-sm text-[#2D2D2D] leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>

          {/* Bottom note */}
          <div className="text-center pb-4">
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Sorularınız için{" "}
              <Link href="/kvkk" className="text-[#C9A84C] hover:underline">
                KVKK Aydınlatma Metni
              </Link>
              'ni de inceleyebilirsiniz.
            </p>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
