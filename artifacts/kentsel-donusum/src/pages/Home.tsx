import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");

    await new Promise((resolve) => setTimeout(resolve, 800));

    const q = question.toLowerCase();
    let response = "";

    if (q.includes("risk") || q.includes("deprem") || q.includes("bina")) {
      response =
        "Binanızın risk durumunu öğrenmek için Çevre, Şehircilik ve İklim Değişikliği Bakanlığı'nın web sitesi üzerinden veya yerel belediyenize başvurarak ücretsiz bina risk tespiti talep edebilirsiniz. Riskli yapı tespiti, lisanslı kuruluşlar tarafından yapılmakta olup sonuçlar tescil edilmektedir.";
    } else if (q.includes("hak") || q.includes("kira") || q.includes("kiracı")) {
      response =
        "Kentsel dönüşüm kapsamındaki kiracılar, tahliye tazminatı ve kira yardımından yararlanma hakkına sahiptir. Kiracılar için aylık kira yardımı miktarı bölgeye göre değişmekte olup başvuru sürecinde noter onaylı kira sözleşmesi gerekmektedir.";
    } else if (q.includes("kredi") || q.includes("finansman") || q.includes("para")) {
      response =
        "Riskli yapı sahipleri, Çevre ve Şehircilik Bakanlığı destekli kentsel dönüşüm kredilerinden yararlanabilir. TOKİ ve anlaşmalı bankalar aracılığıyla düşük faizli kredi imkânları sunulmaktadır. Başvurular için tapu belgesi, kimlik ve bina risk raporu gereklidir.";
    } else if (q.includes("süre") || q.includes("ne kadar") || q.includes("zaman")) {
      response =
        "Kentsel dönüşüm süreci genellikle 18 ay ile 3 yıl arasında tamamlanmaktadır. Riskli yapı tespitinden yıkım kararına kadar ortalama 60 gün, yıkım sonrası inşaat süreci ise yapının büyüklüğüne göre 12-24 ay sürmektedir.";
    } else {
      response =
        "Kentsel dönüşüm hakkındaki sorunuz için teşekkür ederiz. Bina risk tespiti, kiracı hakları, finansman seçenekleri veya süreç hakkında daha ayrıntılı bilgi almak için lütfen sorunuzu daha spesifik bir şekilde belirtin ya da uzmanlarımızla görüşün.";
    }

    setAnswer(response);
    setLoading(false);
  };

  const handleExpert = () => {
    window.open("tel:+908503330330", "_self");
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
              placeholder="Örnek: Binam riskli mi? Kiracı olarak haklarım neler? Kredi alabilir miyim?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />

            <button
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              className="mt-4 w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 text-sm"
            >
              {loading ? "Yanıt hazırlanıyor..." : "Soruyu Sor"}
            </button>

            {answer && (
              <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-5">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                  Yanıt
                </p>
                <p className="text-gray-800 text-sm leading-relaxed">{answer}</p>
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
