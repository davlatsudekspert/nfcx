# 4 ta dizayn varianti — taqqoslash

Barcha variantlar bir xil 9 ekranni, bir xil UZ/RU/EN matnlarini ko'rsatadi; farq — **tuzilma, navigatsiya, hero, kartalar, tipografiya, mobil boshqaruv** va rang. Har biri 1440/390 px da, UZ/RU/EN da real render qilingan (104 screenshot, 0 gorizontal scroll, 0 JS xato — `screenshots/report.json`).

| | **1 · Black & Gold Prestige** | **2 · Platinum Executive** | **3 · Midnight Digital** | **4 · Clean Luxury** |
|---|---|---|---|---|
| **Kayfiyat** | Jiddiy, boy, "klub" | Korporativ, sovuq, ishonchli | Zamonaviy texno-platforma | Minimalistik, yorug', xotirjam |
| **Hero** | Markazlashgan, serif sarlavha, **karta pastda katta** (karta — qahramon) | **Split**: matn chapda, karta o'ngda platina panelda | Grid fon + glow, karta suzib turadi, pill nav | Yorug' sahifa ichida **qorong'i hero paneli**, minimal matn |
| **Navigatsiya (desktop)** | Top bar, linklar markazda | Top bar, chapda | Pill-guruh top bar | Top bar, border'siz |
| **Dashboard tuzilmasi** | Chap sidebar (240px) | Tor rail sidebar (200px), zich | **Sidebar yo'q** — yuqori "command bar" (pill) + o'ng preview | Sidebar yo'q — yuqori tab qatori, yorug' |
| **Mobil boshqaruv** | Yuqori gorizontal tab + burger | **Pastki tab-bar** (5 ta) | **Pastki tab-bar** (yumaloq) | Yuqori gorizontal tab |
| **Kartalar / radius** | 14px, gradient, oltin chiziq | 8px, flat, 1px chegara, oltin ustki chiziq (KPI) | 20px, shisha effekt, glow | 24px, oq, yumshoq soya |
| **Tipografiya** | Serif sarlavha (Playfair) + Inter | Inter, tor, og'ir | Space Grotesk, mono ID'lar, gradient h1 | Cormorant serif (yengil) + system sans |
| **CTA** | Oltin gradient pill | Oq/platina to'rtburchak | Oltin gradient pill + glow | Qora pill (hero'da oq) |
| **Kuchli tomonlari** | NFCSTORE brendiga eng yaqin; premium his; karta vizuali kuchli; konversiyaga yaxshi | Kompaniyalar/B2B uchun eng ishonchli; admin va jadvallar eng o'qiladigan; eng "tinch" | Eng zamonaviy; yoshlar/IT auditoriyaga; dashboard eng qulay (command bar + preview); mobil bottom-bar | Oddiy foydalanuvchiga eng tushunarli; eng yuqori o'qilish; kontrast eng yaxshi; tez |
| **Kamchiliklari** | Serif + oltin ko'p bo'lsa "og'ir"; kontrast oltin/qora matnda ehtiyot kerak | Brend oltini deyarli yo'q — "NFCSTORE" his susayadi; sovuq | Glow/blur ko'p bo'lsa arzon ko'rinadi; `backdrop-filter` eski qurilmalarda sekin | Qorong'i profil sahifalari bilan kontrast "sakrash"; premium his kamroq |
| **Auditoriya** | Shaxsiy premium, VIP ID egalari | Kompaniyalar, Business Account | Yosh mutaxassislar, IT, startaplar | Keng ommaviy, birinchi marta kirganlar |
| **Tezlikka ta'siri** | O'rta: 1 web-font (serif) + gradientlar | **Eng yengil**: system font, soya yo'q | Og'irroq: blur, glow, grid fon (GPU) | Yengil: system font, minimal effekt |
| **Accessibility** | Oltin matn qora fonda 5.9:1 ✅; 44px target ✅; focus ✅ | Eng yuqori kontrast (13:1) ✅ | Cyan/oltin ikonlar 4.6:1 ✅; glow'lar dekorativ | Qora/oq 15:1 ✅; oltin matn oq fonda **3.4:1 ⚠️** (faqat dekorativ, matnda qora ishlatiladi) |
| **UZ/RU/EN** | RU uzun matnlar serif h1 da 3 qatorga tushadi — normal | Eng barqaror | Barqaror | RU tugmalar 2 qatorga o'raladi — normal |

## Umumiy tavsiya

- **Brend + konversiya** birinchi bo'lsa → **1** (yoki 1 ning hero'si + 3 ning dashboard'i).
- **B2B / kompaniya yo'nalishi** ustun bo'lsa → **2**.
- **Eng zamonaviy va eng qulay boshqaruv** kerak bo'lsa → **3**.
- **Eng oddiy, tushunarli, tez** kerak bo'lsa → **4**.

Variantlarni aralashtirish mumkin (masalan: 1-variant rang/tipografiyasi + 3-variant dashboard tuzilmasi) — tanlovda shuni ham yozing.
