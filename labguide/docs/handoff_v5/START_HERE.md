# LabGuide — Claude Code uchun boshlang‘ich topshiriq

Siz LabGuide ilovasini ishlab chiqyapsiz. Ushbu paketni loyiha papkasiga oching va avval prototype.html, DESIGN_REQUIREMENTS.md, PRODUCT_PLAN.md hamda CONTENT_MODEL.json fayllarini o‘qing. Prototype — vizual va navigatsion namuna; tayyor backend yoki tasdiqlangan klinik ma’lumotlar bazasi emas.

## Natija
EN/RU/UZ tillarida ishlaydigan, iOS va Android uchun professional biokimyo/laboratoriya ilovasi. Shifokor, laboratoriya mutaxassisi, talaba va ustoz uchun bir xil tekshirilgan bilim bazasi, lekin turlicha bosh sahifa va tezkor vazifalar. Faqat glyukoza ilovasi emas: glyukoza qolgan analitlar uchun birinchi mazmunli namuna.

## Dastlabki ish
1. Repository, AGENTS.md, README va mavjud build/CI ni o‘qing. Mavjud loyihani qayta yozmang, boshqa NFCSTORE/Forensic loyihalariga tegmang. Maxfiy kalitlarni chiqarib yubormang.
2. Yangi loyiha bo‘lsa Flutter asosida iOS/Android tuzilmasini yarating; mavjud mobil texnologiya bo‘lsa uni saqlang. Amaldagi SDK va kutubxona hujjatlarini tekshiring. Versiyalarni taxmin qilmang.
3. docs/IMPLEMENTATION_PLAN.md, docs/DECISIONS.md va docs/PROGRESS.md yarating. Aniqlangan holat va bosqichlarni yozib, shu sessiyada birinchi ishlaydigan bosqichni boshlang. Faqat reja bilan to‘xtamang.
4. UI prototipini WebView ichiga o‘rab topshirmang. Uni platformaga mos haqiqiy ekran va komponentlarga aylantiring.

## Birinchi yakunlanadigan bosqich
Dizayn tizimi + onboarding + besh tab + to‘rt rol + uch til + yorug‘/tungi/tizim mavzusi. Mehmon kirishi, email va OTP ekranlari bo‘lsin. Haqiqiy email xizmati hali sozlanmagan bo‘lsa faqat debug rejimida ko‘rinadigan demo adapter yarating; release build demo kodni qabul qilmasin. Asosiy kontentni ko‘rish uchun majburiy login bo‘lmasin; sinxronlash/guruh/xaridni hisobga bog‘lashda login.

## Vizual talablar
- prototype.html asosiy vizual manba. Iliq ivory fon, forest yashil, tungi rejimda yumshoq lime aksent; katta aniq sarlavha, ochiq joy, kam chiziq.
- molecular-hero.webp original dekorativ rasm. Uni haqiqiy molekula yoki mikrofoto deb nomlamang. Hero tasvirni o‘qish kontenti bilan aralashtirmang.
- Ilova ochilganda welcome; keyin foydalanuvchi tanlagan rolga mos bosh sahifa. Shifokorda tahlil/kontekst, laborantda kalibrlash/QC, talabada mavzu/test, ustozda guruh/topshiriq ustuvor.
- Besh tab: Bosh, Tahlillar, Lab, Kutubxona, O‘rganish. Profil yuqorida. Har bir tab stack va scroll holatini saqlasin.
- Kontent bo‘ylab pastga scroll qilganda (barmoq yuqoriga) katta header ixchamlashadi; yuqoriga qaytganda (barmoq pastga) kengayadi. Pastki menyu doim foydalanishga ochiq. Hysteresis 12–16 px, animatsiya 180–220 ms. Butun ilovani masshtablamang. Reduced motionni hurmat qiling.
- 320/390/430 px, planshet, kattalashtirilgan shrift, uzun ruscha matn, klaviatura va safe area. Tugmalar kamida 44×44. Asosiy o‘qish matni 16 atrofida; 11 px faqat qisqa yordamchi yozuv uchun.
- Loading, empty, offline, error, retry va success holatlari bo‘lsin. Ishlamaydigan tugma muvaffaqiyat xabarini bermasin.

## Tahlillar va klinik kontent
PRODUCT_PLAN.md dagi modullarni bitta ma’lumot modeli bilan ishlating. Har bir analit: maqsad, namuna, metod, birliklar, referens interval, diagnostik chegara, yuqori/past sabablar, interferensiyalar, bog‘liq tahlillar, manba va review holati.

Glyukoza namunasini manbaga bog‘lab kiriting. Qolganlari uchun universal matnni takrorlab “tayyor” deb ko‘rsatmang. Draft/verified/published holatlari bo‘lsin. Mustaqil mutaxassis ko‘rmagan kontentni reviewer-approved deb belgilamang. Nashrdagi klinik da’volar uchun asl manba, sana, yurisdiksiya va tegishli versiya kerak. Noto‘g‘ri natijadan avtomatik tashxis yoki dori dozasi chiqarmang.

Birliklar konvertori analitga xos bo‘lsin: mg/dL → mmol/L uchun bitta umumiy koeffitsiyent noto‘g‘ri. Referens interval va diagnostik qaror chegarasini ajrating. Homiladorlik, yosh, biomaterial va metodni hisobga olmagan rangli “normal/abnormal” belgisi qo‘ymang.

Apparat kalibrlashida manufacturer/model/reagent REF/IFU revision/calibrator lot mosligi zarur. Aniq IFU yo‘q bo‘lsa parametr ko‘rsatilmang. Mindray yoki HUMAN nomi barcha modellar bir xil degani emas. Parametrlar, service kodlar va kalibrovka qiymatlarini AI bilan to‘qimang.

## Ma’lumotlar, oflayn va huquqlar
UI, domen, kontent, autentifikatsiya, billing va saqlash qatlamlarini ajrating. Kontentni UI satrlariga qotirib qo‘ymang. Core matnlar lokal DB, hajmli rasmlar/PDF alohida yuklanadigan paketlar bo‘lsin. Manifest: version, size, hash, language, licence, minimum schema. Yuklama tekshirilib, atomar almashtirilsin; buzilgan yangilanish avvalgi sog‘lom paketni yo‘qotmasin.

Foydalanuvchi taqdim etgan kitoblar shaxsiy foydalanish va manbani o‘rganish uchun; tarqatish huquqi tasdiqlanmagan PDFni global pullik kutubxonaga joylamang. Maqola topshirish bo‘lsa private draft → review → publish oqimi, foydalanuvchi bevosita klinik bazani o‘zgartirmaydi.

## Ta’lim, ustoz va ilmiy ish
Mavzu → izohli test → xato sababini tushuntirish → takrorlash. Savolning to‘g‘ri javobi, har bir chalg‘ituvchi javob izohi va manba bo‘lsin. Test/imtihon natijasi real javoblardan hisoblanadi.
Mini tizim: ustoz guruh yaratadi, taklif beradi, test tayyorlaydi va muddat belgilaydi; talaba qo‘shiladi va topshiradi; ustoz o‘z guruhini, talaba faqat o‘z natijasini ko‘radi. Rol tanlash — UI preference; o‘zini ustoz deb tanlash boshqa guruh ma’lumotlariga ruxsat bermaydi. Haqiqiy vakolat serverda tekshirilsin. Taklif asosidagi topshiriq uchun zarur savollarni studentning Pro obunasi yo‘qligi bloklamasin.
Ilmiy ish: savol, adabiyotlar, reja, foydalanuvchining haqiqiy ma’lumotlari va bibliografiya. Natija, bemor ma’lumoti yoki manba to‘qilmasin. AI integratsiya keyingi alohida bosqich; core funksiyalar AI/API bilan bog‘lanib qolmasin.

## Savdo
Taklif: Free + Pro oylik/yillik. Narxlar yakuniy tasdiqlanmagan; store mahsulotidan lokal narx olinsin. Bepul demo va bazaviy kartalar, Pro: to‘liq nashr etilgan paketlar, kengaytirilgan o‘rganish va laboratoriya vositalari. Hali tayyor bo‘lmagan imkoniyatni pullik deb sotmang.
Billing adapterlari: StoreKit/Google Play, purchase/pending/cancelled/expired/refunded/restore, server tekshiruvi va bildirishnomalar. Ikki qurilma siyosati hozircha taklif; config orqali boshqarilsin, qat’iy biznes qarori deb qotirilmasin. Qayta o‘rnatishda xaridni tiklash ishlasin.

## Bosqichma-bosqich bajarish
A. UI, onboarding, rollar, navigation, i18n, theme.
B. Kontent modeli, qidiruv, analit kartalari, bookmark, lokal DB, source/review metadata.
C. Lab workflow, IFU match, tekshirilgan kalkulyatorlar, QC va offline paketlar.
D. O‘rganish, test, shaxsiy progress; keyin mini guruh tizimi va research.
E. Haqiqiy auth, server ruxsatlari, IAP, release tayyorgarligi.
Har bosqichda ishga tushadigan natija qoldiring. O‘zgarishlarni kichik izchil commitlarga ajrating. Rutin qaytariladigan ishlar uchun qayta-qayta ruxsat so‘ramang; sirlar, pullik xizmatni yoqish yoki nashrga yuborish uchun zarur foydalanuvchi qadami bo‘lsa aniq yozing.

## Qabul mezonlari
- Shifokor/laborant/talaba/ustozni almashtirish bosh sahifa mazmunini o‘zgartiradi.
- Uch til va ikki rang rejimida overflow yo‘q; keyboard/safe area/back ishlaydi.
- Sinonim qidiruv, filter, bo‘sh natija, bookmark va qayta ochilganda saqlanish tekshirilgan.
- Kalkulyator birligi, chegaralari, nol/manfiy/NaN va overflow holatlari testlangan.
- Buzilgan offline paket rad etiladi, oldingi kontent qoladi.
- Talaba boshqa talaba natijasini o‘qiy olmaydi; ustoz boshqa guruhga kira olmaydi.
- OTP expiry/rate limit va billing restore/pending/refund holatlari tegishli bosqichda tekshirilgan.
- Android build va mavjud bo‘lsa iOS simulator build; haqiqiy qurilma tekshiruvi alohida qayd.

Har sessiya oxirida docs/PROGRESS.md ni yangilang: bajarilganlar, haqiqiy test natijalari, ulanmagan xizmatlar, blockerlar va bitta aniq keyingi qadam. Limit uzilgach yangi sessiya shu faylni o‘qib davom eta olsin. O‘zingiz bajarmagan tekshiruvni o‘tdi demang.
