export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-16">
      <h1 className="pt-14 text-3xl font-extrabold tracking-tight">Maxfiylik siyosati</h1>
      <div className="mt-2 font-mono text-xs uppercase tracking-wider text-base-content/40">Oxirgi yangilanish: 2026</div>
      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-base-content/70">
        <p>Ushbu sahifa NFCSTORE qanday ma'lumot yig'ishi va ulardan qanday foydalanishini tushuntiradi.</p>
        <div>
          <h2 className="text-lg font-bold text-base-content">1. Qanday ma'lumot yig'amiz</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            <li>Ro'yxatdan o'tishda: login/email va parol (xeshlangan holda saqlanadi)</li>
            <li>Profil uchun siz kiritgan ma'lumotlar: ism, rasm, bio, kontaktlar, ijtimoiy tarmoqlar</li>
            <li>Sahifa ko'rishlar soni kabi anonim statistik ma'lumotlar</li>
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-bold text-base-content">2. Ma'lumotdan foydalanish</h2>
          <p className="mt-1.5">Ma'lumotlar faqat sizning shaxsiy profilingizni ko'rsatish va xizmatni ishlatish uchun ishlatiladi. Uchinchi tomonlarga sotilmaydi.</p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-base-content">3. Profil ma'lumotlari ommaviy</h2>
          <p className="mt-1.5">Siz profilingizga qo'shgan ma'lumot (ism, kontaktlar, ijtimoiy tarmoqlar) sizning ochiq profil sahifangizda hamma uchun ko'rinadi — faqat o'zingiz oshkor qilmoqchi bo'lgan ma'lumotni kiriting.</p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-base-content">4. Xavfsizlik</h2>
          <p className="mt-1.5">Parollar xesh holida saqlanadi. Sessiya cookie orqali boshqariladi.</p>
        </div>
        <div>
          <h2 className="text-lg font-bold text-base-content">5. Ma'lumotni o'chirish</h2>
          <p className="mt-1.5">Hisobingizni va unga bog'liq ma'lumotlarni o'chirishni so'rash uchun qo'llab-quvvatlash xizmatiga murojaat qiling.</p>
        </div>
      </div>
    </main>
  );
}
