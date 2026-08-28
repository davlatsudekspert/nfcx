export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-[1800px] px-6 pb-16 sm:px-10 lg:px-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="pt-14 text-3xl font-extrabold tracking-tight">Maxfiylik siyosati</h1>
        <div className="mt-2 font-mono text-xs uppercase tracking-wider text-base-content/40">Oxirgi yangilanish: 2026</div>
        <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-base-content/70">
          <p>Ushbu sahifa NFCSTORE xizmati ma'lumotlarni qanday yig'ishi, saqlashi va xavfsizligini ta'minlashini tushuntiradi.</p>

          <div>
            <h2 className="text-lg font-bold text-base-content">Qanday ma'lumot yig'amiz</h2>
            <p className="mt-1.5">Ro'yxatdan o'tishda kiritilgan elektron pochta, login va parollar tizimda qat'iy xeshlangan holatda saqlanadi. Xavfsizlikni ta'minlash maqsadida qurilmalarning IP-manzillari hamda tizimdagi harakatlar tarixi (loglar) qayd etib boriladi. Profilni to'ldirish uchun kiritgan ism, rasm, bio va kontaktlaringiz ham saqlanadi.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-base-content">Ma'lumotdan foydalanish va Ommaviylik</h2>
            <p className="mt-1.5">Kiritilgan ma'lumotlar faqat sizning shaxsiy profilingizni shakllantirish va xizmatni uzluksiz ishlashi uchun ishlatiladi. Siz profilga qo'shgan ma'lumotlar ochiq sahifangizda ko'rinadi — faqat o'zingiz oshkor qilishni istagan ma'lumotlarni kiriting. Ushbu ma'lumotlar uchinchi shaxslarga tijorat maqsadida sotilmaydi.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-base-content">Xavfsizlik choralari</h2>
            <p className="mt-1.5">Platformada foydalanuvchilarni identifikatsiya, autentifikatsiya va avtorizatsiya qilish tizimlari joriy etilgan bo'lib, ruxsatsiz kirishning oldini olish choralari to'liq ko'rilgan. Tizimda konfidensial ma'lumotlar bilan ishlash huquqi xodimlarning lavozim majburiyatlaridan kelib chiqib qat'iy cheklangan. Shuningdek, mijozlarning tizimdagi amaliyotlari va harakatlariga oid ma'lumotlar elektron arxivlarda kamida besh yil davomida xavfsiz saqlanishi ta'minlanadi.</p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-base-content">Ma'lumotni o'chirish</h2>
            <p className="mt-1.5">Hisobingizni va barcha bog'langan ma'lumotlarni butunlay o'chirishni xohlasangiz, qo'llab-quvvatlash xizmatiga onlayn murojaat qilishingiz mumkin.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
