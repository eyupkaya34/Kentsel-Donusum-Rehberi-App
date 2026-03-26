import { Link } from "wouter";
import AppFooter from "@/components/AppFooter";

const SECTIONS = [
  {
    title: "1. Veri Sorumlusu",
    content:
      "Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında hazırlanmıştır. Platformun veri sorumlusu bilgileri yakın zamanda güncellenecektir. Veri sorumlusuna ilişkin sorularınız için lütfen bizimle iletişime geçiniz. [İsim ve iletişim bilgileri eklenecek]",
  },
  {
    title: "2. Hangi Veriler İşlenir?",
    content:
      "Platformu kullandığınızda aşağıdaki veriler işlenebilir: (a) Yüklediğiniz PDF belgeler ve içerdikleri bilgiler — yalnızca analiz süresince tutulur; (b) Platforma girdiğiniz sorular ve metin içerikleri; (c) Teknik amaçlarla toplanan IP adresi ve tarayıcı bilgileri; (d) Uzman iletişim formlarında girdiğiniz ad, soyad ve telefon numarası.",
  },
  {
    title: "3. Verilerin Kullanım Amacı",
    content:
      "Kişisel verileriniz yalnızca aşağıdaki amaçlarla işlenir: Yapay zeka destekli analiz hizmetinin sunulması, teknik güvenlik ve sistem bütünlüğünün sağlanması, uzman yönlendirme taleplerinin iletilmesi. Verileriniz hiçbir koşulda üçüncü şahıslarla, reklam şirketleriyle veya pazarlama amaçlı olarak paylaşılmaz.",
  },
  {
    title: "4. Verilerin Saklanması",
    content:
      "Yüklediğiniz PDF belgeler ve içerdikleri veriler, analiz işlemi tamamlandıktan sonra otomatik olarak sistemden silinir. Soru metinleri ve analiz sonuçları istatistiksel amaçlarla anonim biçimde kısa süre tutulabilir; ancak bu veriler herhangi bir kişiyle ilişkilendirilemez. Uzman iletişim taleplerindeki veriler, talebin işlenmesi amacıyla sınırlı süreyle saklanır.",
  },
  {
    title: "5. Kullanıcı Hakları",
    content:
      "KVKK'nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz: Kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse buna ilişkin bilgi talep etme; verilerin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmesi hâlinde bunların düzeltilmesini isteme; silinmesini veya yok edilmesini isteme; işlemenin otomatik sistemler vasıtasıyla gerçekleştirilmesi hâlinde aleyhte bir sonucun ortaya çıkmasına itiraz etme; zarara uğramanız hâlinde tazminat talep etme.",
  },
  {
    title: "6. Çerezler (Cookies)",
    content:
      "Platform, yalnızca temel işlevselliği sağlamak amacıyla zorunlu minimum düzeyde çerez kullanmaktadır. Bu çerezler oturum yönetimi ve güvenlik amacıyla kullanılır; kişisel profil oluşturma, davranışsal hedefleme veya reklam amaçlı çerez kullanılmamaktadır. Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz, ancak bu durumda bazı platform işlevleri düzgün çalışmayabilir.",
  },
  {
    title: "7. İletişim",
    content:
      "KVKK kapsamındaki haklarınızı kullanmak veya veri işleme pratiklerimiz hakkında bilgi almak için bizimle iletişime geçebilirsiniz. Taleplerinizi en geç 30 gün içinde yanıtlamakla yükümlüyüz. E-posta adresimiz yakın zamanda bu alanda paylaşılacaktır. [E-posta adresi eklenecek]",
  },
];

export default function Kvkk() {
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
          <span className="text-sm font-bold text-white tracking-tight">KVKK Aydınlatma Metni</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-8">
          {/* Hero */}
          <div className="text-center">
            <h1 className="text-[1.5rem] sm:text-[2rem] font-extrabold text-[#1B2E4B] leading-[1.25] tracking-tight mb-3">
              Kişisel Verilerin Korunması<br className="hidden sm:block" /> Kanunu (KVKK) Aydınlatma Metni
            </h1>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Son güncellenme: Aralık 2024
            </p>
          </div>

          {/* Intro card */}
          <div className="bg-[#FDF8F0] border border-[#C9A84C]/30 border-l-4 border-l-[#C9A84C] rounded-xl px-6 py-4">
            <p className="text-sm text-[#5C4A1E] leading-relaxed">
              6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında hazırlanan bu aydınlatma metni, kişisel verilerinizin nasıl toplandığını, işlendiğini ve korunduğunu açıklamaktadır.
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
              Platformu kullanım koşullarımız için{" "}
              <Link href="/kullanim-kosullari" className="text-[#C9A84C] hover:underline">
                Kullanım Koşulları
              </Link>
              'nı da inceleyebilirsiniz.
            </p>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
