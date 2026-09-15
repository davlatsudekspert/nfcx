import 'dart:async';

/// TORTIB YANGILASH BELGISI RO'YXATNI UZOQ USHLAB TURMASIN.
///
/// HAQIQIY XATO, EGASI UCH MARTA XABAR QILDI: "bosh sahifa to'liq
/// tepaga qaytmaydi", "tepaga tortsam dirillab tortilmayapti".
///
/// SABABI. `RefreshIndicator` o'ziga berilgan `Future` tugaguncha
/// ro'yxatni USHLAB TURADI — u atayin shunday ishlaydi, chunki
/// aylanuvchi belgi ko'rinib turishi kerak. Ekranlarning yangilash
/// funksiyasi esa serverdan javob kutadi va so'rovning muddati 20
/// soniya (`Api._timeout`).
///
/// Natijada: odam tepaga surganda, eng tepaga yetishi bilan
/// yangilash ishga tushadi va ro'yxat o'sha joyda — belgi
/// balandligida — QOTIB qoladi. Sekin tarmoqda bu 20 soniyagacha
/// davom etadi. Tashqaridan bu "sahifa to'liq tepaga qaytmayapti"
/// bo'lib ko'rinadi va aynan shunday xabar qilingan.
///
/// YECHIM. Belgi bir necha soniyadan ortiq ushlab turmaydi.
/// So'rov BEKOR QILINMAYDI: ma'lumot kelganda ekran baribir
/// yangilanadi (`setState` o'z joyida chaqiriladi). Bu yerda
/// faqat BELGI bo'shatiladi, ya'ni barmoq darhol yana ishlaydi.
///
/// Shuning uchun bu qoida bitta joyda: o'nta ekranda takrorlansa,
/// bittasi unutilib qolishi aniq edi.
const _hold = Duration(seconds: 4);

/// Yangilashni boshlaydi va belgini eng ko'pi [_hold] ushlab turadi.
Future<void> pullRefresh(Future<void> Function() run) =>
    run().timeout(_hold, onTimeout: () {});
