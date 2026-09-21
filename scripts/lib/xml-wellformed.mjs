// XML TUZILISHI — OCHILADIGAN TEG ICHIDA BEGONA `<` BORMI.
//
// Node'da o'rnatilgan XML tahlilchisi yo'q va butun boshli
// kutubxona qo'shish bu tekshiruv uchun ortiqcha. Shuning uchun
// AYNAN bitta narsa tekshiriladi — va u haqiqiy xatodan kelib
// chiqqan:
//
//   <application
//       <!-- izoh -->          <-- YAROQSIZ
//       android:label="..."
//
// `flutter build apk` bunday manifestni "Error parsing
// LocalFile" bilan rad etadi. `flutter analyze` ham, `flutter
// test` ham manifestni umuman o'qimaydi, ya'ni xato faqat
// qurilish bosqichida ko'rinadi.
//
// IZOHLAR OLIB TASHLANMAYDI: tekshirilayotgan narsa aynan
// ularning JOYI. Birinchi urinishda ular avval olib tashlangan
// edi va tekshiruv haqiqiy xatoni TUTMADI.

/// Ochiladigan teg ichidagi begona `<` larni topadi.
///
/// Qaytadi: buzuq joylarning qisqa parchalari (bo'sh massiv —
/// hammasi joyida).
export function badTagOpens(xml) {
  const bad = [];
  for (let i = 0; i < xml.length; i++) {
    if (xml[i] !== '<') continue;

    // Izohning O'ZI — butunlay o'tkazib yuboriladi.
    if (xml.startsWith('<!--', i)) {
      const close = xml.indexOf('-->', i);
      i = close < 0 ? xml.length : close + 2;
      continue;
    }
    // `<?xml ...?>` va `<!DOCTYPE ...>` ham teg emas.
    if (xml[i + 1] === '?' || xml[i + 1] === '!') {
      const close = xml.indexOf('>', i);
      i = close < 0 ? xml.length : close;
      continue;
    }
    if (!/[A-Za-z/]/.test(xml[i + 1] || '')) continue;

    // Atribut qiymati ichidagi `>` tegni TUGATMAYDI.
    let quote = '';
    let j = i + 1;
    for (; j < xml.length; j++) {
      const c = xml[j];
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '>') break;
      if (c === '<') {
        bad.push(xml.slice(i, Math.min(j + 40, xml.length)).split('\n')[0].trim());
        break;
      }
    }
    i = j;
  }
  return bad;
}
