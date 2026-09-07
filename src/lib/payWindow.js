// ═══════════════════════════════════════════════════════════════════════
// TO'LOV OYNASINI ISHONCHLI OCHISH
//
// MUAMMO (2026-09): to'lov oqimi ikki bosqichli — avval serverda buyurtma
// yaratiladi (await), keyin to'lov tizimining sahifasi ochiladi. Agar
// oyna `await` dan KEYIN `window.open()` bilan ochilsa, brauzer uni
// foydalanuvchi bosishi bilan bog'lamaydi va "reklama oynasi" deb
// BLOKLAYDI. iOS Safari buni ayniqsa qattiq qo'llaydi.
//
// Natija: mijoz "To'lash" ni bosadi — hech narsa ochilmaydi. To'lov
// sahifasida bunday chalkashlik ishonchni yo'qotadi.
//
// YECHIM: oynani bosilgan ZAHOTI (hali hech qanday await bo'lmasdan)
// bo'sh holda ochib qo'yamiz — brauzer buni bloklamaydi, chunki u
// bevosita bosishdan kelib chiqadi. Server javobi kelgach o'sha oynaga
// manzil yoziladi. Xatolik bo'lsa oyna yopiladi.
//
// Ishlatilishi:
//   const w = openPayWindow();              // bosilgan zahoti
//   try {
//     const res = await createOrder();
//     w.go(res.payLink);                    // javob kelgach
//   } catch (e) { w.close(); }
//
// Popup butunlay o'chirilgan bo'lsa `go()` false qaytaradi — chaqiruvchi
// sahifa ko'rinadigan "To'lovga o'tish" havolasini ko'rsatishi kerak
// (bu oxirgi himoya qatlami sifatida DOIM qolishi shart).
// ═══════════════════════════════════════════════════════════════════════

// Kutish paytida ko'rinadigan sahifa — mijoz oq bo'sh oynani ko'rmasin.
// Faqat statik matn: hech qanday foydalanuvchi ma'lumoti qo'yilmaydi.
const WAITING_HTML = `<!doctype html><meta charset="utf-8">
<title>To'lovga yo'naltirilmoqda…</title>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0b;color:#f0cf7a;font:600 15px/1.5 system-ui,sans-serif">
To'lov sahifasiga yo'naltirilmoqda…</body>`;

export function openPayWindow() {
  let win = null;
  try {
    // DIQQAT: `noopener` bayrog'i QO'YILMAYDI — u bilan `window.open()`
    // hamisha `null` qaytaradi va oynaga keyin manzil yozib bo'lmaydi.
    // Uning o'rniga pastda `opener` qo'lda tozalanadi (bir xil himoya).
    win = window.open('', '_blank');
    if (win) {
      try { win.opener = null; } catch { /* ba'zi brauzerlarda ruxsat yo'q */ }
      try { win.document.write(WAITING_HTML); win.document.close(); } catch { /* muhim emas */ }
    }
  } catch {
    win = null;
  }

  return {
    // Tayyor havolaga o'tkazadi. true — ochildi, false — ochilmadi
    // (chaqiruvchi ko'rinadigan havolani ko'rsatishi kerak).
    go(url) {
      if (!url) { this.close(); return false; }
      if (win && !win.closed) {
        // `replace` — orqaga qaytishda bo'sh oyna tarixda qolmaydi.
        try { win.location.replace(url); return true; } catch { /* pastdagi zaxira */ }
      }
      // Oldindan ochib bo'lmagan bo'lsa — oxirgi urinish.
      try { return !!window.open(url, '_blank', 'noopener'); } catch { return false; }
    },
    close() {
      try { if (win && !win.closed) win.close(); } catch { /* jim */ }
    },
  };
}
