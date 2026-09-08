// Modal oynaning ORQA FONI uchun hodisalar.
//
// MUAMMO: fon `onClick` bilan yopilardi va "bosilgan joy fonmi?" degan
// tekshiruv faqat CHIQARISH payti qilinardi. Odam oyna ichidagi matnni
// sichqoncha bilan belgilab, tugmani fon ustida qo'yib yuborsa — brauzer
// buni fonga bosish deb hisoblab, oynani YOPIB yuborardi. Ya'ni matnni
// nusxalamoqchi bo'lgan odam yozganini yo'qotardi.
//
// YECHIM: yopilish uchun bosish HAM, qo'yib yuborish HAM fonda bo'lishi
// shart. Matn belgilash oyna ichida boshlangan bo'lsa, hech narsa
// yopilmaydi.
//
// Ishlatilishi:
//   <div className="fixed inset-0 ..." {...backdropProps(onClose)}>
// Bayroq DOM tugunining O'ZIDA saqlanadi. Yopilmada (closure) saqlash
// noto'g'ri bo'lardi: backdropProps() har renderda qaytadan chaqiriladi
// va bosish bilan qo'yib yuborish orasida komponent qayta render bo'lsa
// bayroq yo'qolib, foydalanuvchi fonga bosganda oyna yopilmay qolardi.
const DOWN = '__nfcxBackdropDown';

export function backdropProps(onClose) {
  return {
    onMouseDown(e) { e.currentTarget[DOWN] = e.target === e.currentTarget; },
    onClick(e) {
      // `detail === 0` — klaviatura orqali (Enter/Space) chaqirilgan
      // bosish: unda mousedown bo'lmaydi, lekin yopish to'g'ri.
      const ok = e.target === e.currentTarget && (e.currentTarget[DOWN] || e.detail === 0);
      e.currentTarget[DOWN] = false;
      if (ok) onClose();
    },
  };
}
