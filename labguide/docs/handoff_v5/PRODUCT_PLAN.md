# LabGuide — mahsulot va yetkazish rejasi
2026-10-08 · v5 handoff

## Asosiy maqsad
Tahlilni tushunish, laboratoriyada to‘g‘ri manbani topish va bilimni mustahkamlashni bitta tizimga birlashtirish. Qiymat: tezkor manbali ma’lumot, modelga mos hujjat, oflayn foydalanish va izohli mashq. “AI’dan har narsada yaxshi” degan da’vo qilinmaydi.

## Qamrov — glyukoza bilan cheklanmaydi
1. Uglevodlar: glyukoza, HbA1c, OGTT, fruktozamin.
2. Buyrak: kreatinin, mochevina/urea, eGFR, siydik kislotasi.
3. Jigar: ALT, AST, ALP, GGT, umumiy/to‘g‘ri bilirubin.
4. Lipidlar: umumiy xolesterin, HDL, LDL, triglitseridlar, non-HDL.
5. Oqsillar/yallig‘lanish: albumin, umumiy oqsil, CRP.
6. Elektrolit/minerallar: Na, K, Cl, Ca, Mg, fosfat.
7. Fermentlar: amilaza, lipaza, LDH, CK.
8. Siydik: kimyoviy tahlil, mikroskopiya, albumin/kreatinin nisbati.
Keyingi paketlar: gematologiya, koagulologiya, gormonlar, vitaminlar va maxsus markerlar. Bular dastlabki tayyor kontent deb reklama qilinmaydi.

Har bir karta alohida tasdiqlanadi. Yangi klinik modul uchun tegishli mutaxassis jalb qilinadi. Ilova ustozga ko‘rsatiladigan demo bilan nashrga tayyor ma’lumotnomani farqlaydi.

## Ekranlar va navigatsiya
- Welcome → mehmon yoki email → OTP → rol → bosh sahifa.
- Bosh: rolga mos hero, 4 tezkor amal, foydali tahlillar.
- Tahlillar: qidiruv/sinonim/kategoriya → karta → maqsad, ko‘rsatkich, kontekst, manba → bookmark.
- Lab: apparatlar, kalibrlash mosligi, QC, preanalitika, kalkulyatorlar, mikroskopiya.
- Kutubxona: kitoblar, saqlanganlar, oflayn paketlar, manbalar, ilmiy ish.
- O‘rganish: mavzular, mashq, imtihon, takrorlash, guruhlar/topshiriqlar.
- Profil: rol, til, ko‘rinish, yuklamalar, hisob/qurilmalar, obuna va restore, yordam.

## Tayyor prototipning chegarasi
Ishlaydi: ekranlararo o‘tish, 4 rolga mos bosh sahifa, UZ/RU/EN, theme, qidiruv/filter, vaqtinchalik bookmark, suyultirish hisoblash, izohli 3 savol, glyukoza namuna kartasi.
Ko‘rinish namunasi: apparat mosligi, QC, PDF/paket yuklash, guruh yaratish/yuborish/natija, ilmiy ish reja shakli, obuna/restore.
Ulanmagan: haqiqiy auth/email/backend/IAP/saqlash/sinxronlash. Refreshdan so‘ng demo holat yo‘qoladi.
Qolgan analitlarda struktura bor, to‘liq klinik matn yo‘q. Glyukoza manbalarga tayangan o‘quv namuna, mustaqil ekspert review qilmagan.
Inline prototipda pastki menyu kontentdan keyin turadi. Native ilovada doimiy bottom bar va scroll-collapse joriy qilinadi.

## Narxlash va hajm
Free + Pro monthly/yearly — ishchi taklif. Narx, qurilma soni va paket tarkibi alohida yakunlanadi. Core matn/kichik diagrammalar bazada, katta PDF va atlaslar kerak bo‘lganda yuklanadi. Yuklashdan oldin haqiqiy hajm ko‘rsatiladi; to‘liq kitoblar ilovaga majburiy qo‘shilmaydi.

## Dizayn tamoyillari
Issiq och fon, chuqur yashil sarlavhalar, tungi rejimda sokin aksent. Asosiy e’tibor tipografika, ma’lumot iyerarxiyasi va qulay amal. Rasm katta kirish ekranida, o‘qish sahifasida esa mazmunli original diagramma yoki litsenziyali mikrofoto. Har kartaga bir xil dekorativ rasm takrorlanmaydi.

## Keyingi bosqich uchun kontent talablar
Ustoz tekshiradigan analitlar ro‘yxati va reviewerlar; aniq apparat modeli; reagent REF/IFU; tarqatishga ruxsatli manbalar; uch tildagi terminologiya lug‘ati. Ular yo‘qligi UI ishini to‘xtatmaydi, lekin tekshirilmagan parametrlarni nashr qilishga asos bo‘lmaydi.
