import { useLanguage } from '../lib/i18n.jsx';
import { navigate } from '../lib/router.js';
import { IconArrowLeft } from '../components/Icons.jsx';

// NFCSTORE.UZ auksion qoidalari — to'liq matn (/auksion-qoidalari).
//
// NIMA UCHUN ALOHIDA SAHIFA: taklif berishdan oldingi modal oyna faqat
// eng muhim 8 bandni ko'rsatadi. To'lovga oid nizoda yoki to'lov tizimi
// bilan ulanishda esa to'liq, o'zgarmas matn kerak bo'ladi — u shu yerda
// doimiy manzilda turadi va modal oynadan havola beriladi.
//
// TO'LOV TIZIMI ATAYLAB NOMLANMAGAN: matnda "Payme orqali" emas,
// "mavjud rasmiy to'lov usullari orqali" deyiladi. Shunda Click yoki
// boshqa tizim qo'shilganda qoidalarni qayta yozish shart bo'lmaydi.

const SECTIONS = [
  {
    n: 1,
    title: 'Umumiy qoidalar',
    body: [
      "NFCSTORE.UZ platformasidagi auksion NFCSTORE tomonidan savdoga chiqarilgan yangi NFC ID'larni narx taklif qilish yo'li bilan sotish uchun tashkil etiladi.",
      "Auksion lotereya, qimor yoki tasodifga asoslangan o'yin hisoblanmaydi. G'olib tasodifiy tanlanmaydi. Auksion yakunida belgilangan qoidalarga muvofiq eng yuqori amaldagi narx taklif qilgan ishtirokchi g'olib bo'ladi.",
      "Auksionda qatnashish orqali foydalanuvchi ushbu qoidalarni o'qiganini, tushunganini va ularga roziligini tasdiqlaydi.",
    ],
  },
  {
    n: 2,
    title: 'Auksion loti',
    body: ['Har bir auksion lotida quyidagilar oldindan ko’rsatiladi:'],
    list: [
      'NFC ID;',
      "boshlang'ich narx;",
      'minimal narx oshirish qadami;',
      'auksion boshlanish sanasi va vaqti;',
      'auksion tugash sanasi va vaqti;',
      'joriy eng yuqori taklif;',
      "g'olib uchun to'lov muddati.",
    ],
    after: ['NFCSTORE auksion boshlanganidan keyin lot shartlarini foydalanuvchilarga zarar yetkazadigan tarzda yashirincha o’zgartirmaydi.'],
  },
  {
    n: 3,
    title: 'Auksionda qatnashish',
    body: [
      "Auksionda faqat NFCSTORE.UZ platformasida ro'yxatdan o'tgan va o'z akkauntiga kirgan foydalanuvchi qatnashishi mumkin.",
      'Narx taklif qilishdan oldin foydalanuvchi ushbu Auksion qoidalari bilan tanishib, roziligini tasdiqlashi kerak.',
      'Quyidagilar taqiqlanadi:',
    ],
    list: [
      'boshqa shaxs akkauntidan foydalanish;',
      'soxta akkauntlar yaratish;',
      "narxni sun'iy oshirish;",
      'tizimdagi texnik kamchiliklardan ataylab foydalanish;',
      'avtomatlashtirilgan bot yoki skriptlar orqali noqonuniy ustunlik olish;',
      'boshqa ishtirokchilar bilan kelishib narxni manipulyatsiya qilish.',
    ],
  },
  {
    n: 4,
    title: 'Narx taklif qilish',
    body: ['Har bir yangi narx taklifi:'],
    list: [
      "amaldagi eng yuqori narxdan yuqori bo'lishi;",
      "kamida belgilangan minimal qadam miqdoriga mos bo'lishi;",
      'foydalanuvchi tomonidan alohida tasdiqlanishi kerak.',
    ],
    after: [
      'Foydalanuvchi taklifni tasdiqlashdan oldin unga quyidagi mazmundagi ogohlantirish ko’rsatiladi:',
      "«Siz ___ so'm miqdorida narx taklif qilmoqdasiz. Taklifni tasdiqlaysizmi?»",
      'Tasdiqlangan taklif auksion tarixida qayd etiladi.',
    ],
  },
  {
    n: 5,
    title: "G'olibni aniqlash",
    body: [
      'Auksion belgilangan vaqtda yakunlanadi.',
      "Auksion tugagan paytda eng yuqori amaldagi narx taklif qilgan ishtirokchi g'olib deb hisoblanadi.",
      "G'olib quyidagilar orqali aniqlanmaydi:",
    ],
    list: ['tasodifiy algoritm;', 'lot;', 'random tanlov;', 'omad;', 'ehtimollikka asoslangan mexanizm.'],
  },
  {
    n: 6,
    title: "To'lov",
    body: [
      "G'olib NFCSTORE tomonidan belgilangan muddat ichida lot uchun to'lovni amalga oshirishi kerak.",
      "To'lov NFCSTORE platformasida mavjud bo'lgan rasmiy va integratsiya qilingan to'lov xizmatlari orqali amalga oshiriladi.",
      "Platformada Payme, Click yoki boshqa qonuniy to'lov xizmatlari qo'llab-quvvatlanishi mumkin.",
      "NFCSTORE bank, elektron hamyon yoki mustaqil to'lov tashkiloti sifatida faoliyat yuritmaydi. To'lov operatsiyalari tegishli to'lov infratuzilmasi orqali amalga oshiriladi.",
      "To'lov muvaffaqiyatli tasdiqlanmaguncha NFC ID g'olib akkauntiga yakuniy tarzda biriktirilmaydi.",
    ],
  },
  {
    n: 7,
    title: "NFC ID'ni g'olibga biriktirish",
    body: [
      "To'lov muvaffaqiyatli tasdiqlangach, yutilgan NFC ID g'olibning NFCSTORE akkauntiga biriktiriladi.",
      "NFC ID biriktirilgach, u g'olibning «Mening ID'larim» bo'limida ko'rinadi.",
      "To'lov holati va ID biriktirilishi tizimda qayd etiladi.",
    ],
  },
  {
    n: 8,
    title: "G'olib to'lovni amalga oshirmasa",
    body: [
      "Agar g'olib belgilangan muddatda to'lovni amalga oshirmasa, uning g'oliblik huquqi bekor qilinishi mumkin.",
      'Bunday holatda NFCSTORE:',
    ],
    list: [
      'lotni qayta auksionga qo’yishi;',
      'yoki oldindan belgilangan tartib asosida keyingi eng yuqori taklif bergan ishtirokchiga taklif qilishi mumkin.',
    ],
    after: ["Bu tartib auksion boshlanishidan oldin foydalanuvchiga ochiq ko'rsatiladi."],
  },
  {
    n: 9,
    title: 'Auksionning tugash vaqti',
    body: [
      "Har bir lot uchun auksionning aniq boshlanish va tugash vaqti ko'rsatiladi.",
      "Auksion tugashiga juda yaqin vaqtda yangi yuqori taklif kelgan holatlar uchun, agar platformada avtomatik uzaytirish mexanizmi qo'llansa, bu qoida lot boshlanishidan oldin aniq yoziladi.",
      "Masalan: auksionning so'nggi daqiqalarida yangi yuqori taklif kelib tushsa, auksion belgilangan muddatga uzaytiriladi.",
      "Agar bunday mexanizm qo'llanmasa, auksion belgilangan vaqtda avtomatik yopiladi.",
    ],
  },
  {
    n: 10,
    title: 'Texnik nosozliklar',
    body: ['Agar quyidagilarda jiddiy nosozlik yuz bersa:'],
    list: ['NFCSTORE serverida;', 'internet ulanishida;', "to'lov infratuzilmasida;", 'yoki boshqa muhim texnik tizimda,'],
    after: [
      'NFCSTORE foydalanuvchilar manfaatini himoya qilish uchun auksionni vaqtincha to’xtatishi, yakunlanish vaqtini uzaytirishi yoki zarur holatda lotni bekor qilishi mumkin.',
      'Bunday qaror foydalanuvchilarga ochiq tarzda bildiriladi.',
    ],
  },
  {
    n: 11,
    title: 'Soxta va manipulyativ takliflar',
    body: ['Quyidagilar taqiqlanadi:'],
    list: [
      'soxta akkaunt orqali taklif berish;',
      "o'zaro kelishib narxni sun'iy oshirish;",
      'tizimni aldash;',
      'botlardan foydalanish;',
      "o'ziga tegishli bo'lmagan akkauntdan foydalanish;",
      'boshqa ishtirokchilarga ataylab zarar yetkazish;',
      "noqonuniy to'lov vositalaridan foydalanish.",
    ],
    after: ['Bunday holat aniqlansa NFCSTORE taklifni bekor qilishi, foydalanuvchini vaqtincha cheklashi, akkauntni bloklashi yoki zarur bo’lsa auksion natijasini qayta ko’rib chiqishi mumkin.'],
  },
  {
    n: 12,
    title: 'Foydalanuvchi javobgarligi',
    body: ['Foydalanuvchi quyidagilar uchun javobgar hisoblanadi:'],
    list: ['o’z akkaunti xavfsizligi;', 'bergan narx takliflari;', "to'lov ma'lumotlari;", "va o'z harakatlari."],
    after: ['NFCSTORE foydalanuvchining ehtiyotsizligi tufayli boshqa shaxs uning akkauntidan foydalangan holatlar uchun qonunchilikda belgilangan doiradan tashqari javobgar bo’lmaydi.'],
  },
  {
    n: 13,
    title: 'NFCSTORE huquqlari',
    body: ['NFCSTORE quyidagi huquqlarni saqlab qoladi:'],
    list: [
      'noqonuniy yoki shubhali takliflarni bekor qilish;',
      'texnik xatolarni tuzatish;',
      'xavfsizlik maqsadida akkaunt faoliyatini tekshirish;',
      'qonun talablariga zid harakatlarni cheklash;',
      'xizmatdan foydalanish qoidalarini qonunchilikka muvofiq yangilash.',
    ],
  },
  {
    n: 14,
    title: 'Auksion formati',
    body: [
      "Ushbu auksion hozircha faqat NFCSTORE tomonidan savdoga chiqariladigan yangi NFC ID'lar uchun mo'ljallangan.",
      "Foydalanuvchilar o'z NFC ID'larini boshqa foydalanuvchilarga auksion orqali sotadigan ikkilamchi bozor ushbu qoidalarga kirmaydi.",
      "Ikkilamchi savdo kelajakda joriy qilinsa, uning uchun alohida qoidalar, komissiya, to'lov va huquqiy talablar ishlab chiqiladi.",
    ],
  },
  {
    n: 15,
    title: 'Qoidalarni qabul qilish',
    body: [
      'Auksionda qatnashishdan oldin foydalanuvchi ushbu qoidalarni tasdiqlashi kerak.',
      'Qoidalarni tasdiqlamasdan narx taklif qilish imkoniyati berilmaydi.',
    ],
  },
];

export default function AuctionRulesPage() {
  const { t } = useLanguage();
  const go = (e, path) => { e.preventDefault(); navigate(path); };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <a
        href="/auksion"
        onClick={(e) => go(e, '/auksion')}
        className="vz-tap inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: 'var(--vz-ink-2)' }}
      >
        <IconArrowLeft /> {t('Auksionlar')}
      </a>

      <span className="vz-kicker mt-6 block">{t('Huquqiy')}</span>
      <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">{t('NFCSTORE.UZ — Auksion qoidalari')}</h1>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>
        {t("Auksionda qatnashishdan oldin ushbu qoidalarni o'qing. Taklif berish tugmasini bosish bilan siz ularga rozilik bildirasiz.")}
      </p>

      <div className="mt-8 space-y-7">
        {SECTIONS.map((s) => (
          <article key={s.n} className="vz-card p-5 sm:p-6">
            <h2 className="vz-h2 text-lg">{s.n}. {t(s.title)}</h2>
            {(s.body || []).map((p, i) => (
              <p key={`b${i}`} className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>{t(p)}</p>
            ))}
            {s.list && (
              <ul className="mt-3 space-y-1.5 pl-5 text-[15px] leading-relaxed" style={{ color: 'var(--vz-ink-2)', listStyle: 'disc' }}>
                {s.list.map((li, i) => <li key={`l${i}`}>{t(li)}</li>)}
              </ul>
            )}
            {(s.after || []).map((p, i) => (
              <p key={`a${i}`} className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--vz-ink-2)' }}>{t(p)}</p>
            ))}
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a href="/auksion" onClick={(e) => go(e, '/auksion')} className="btn btn-gold min-h-11">{t('Auksionlarga qaytish')}</a>
        <a href="/shartlar" onClick={(e) => go(e, '/shartlar')} className="btn btn-ghost-vz min-h-11">{t('Foydalanish shartlari')}</a>
      </div>
    </section>
  );
}
