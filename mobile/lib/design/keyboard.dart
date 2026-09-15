import 'package:flutter/widgets.dart';

/// KLAVIATURA EGALLAGAN BALANDLIK.
///
/// HAQIQIY XATO, EGASI SURAT BILAN KO'RSATDI: NFC karta buyurtmasida
/// "Shahar" maydoniga yozgandan keyin "Manzil" va "Aloqa raqami"
/// maydonlari "ishlamay" qolardi. Ular buzilmagan edi — klaviatura
/// ostida qolib ketgan edi va ularga yetib borishning iloji yo'q edi.
///
/// SABABI. Ilova `Scaffold` ishlatmaydi (butun dizayn tizimi o'z
/// widgetlari ustiga qurilgan), ya'ni Flutter'ning
/// `resizeToAvoidBottomInset` xulqi HECH QAYERDA ishlamaydi. Oyna
/// kichraymaydi: klaviatura shunchaki ekranning pastki qismini
/// yopib qo'yadi. Ro'yxat esa buni bilmaydi va pastga sura olmaydi.
///
/// YECHIM. Formaning aylantiriladigan qismiga klaviatura balandligi
/// qadar bo'sh joy qo'shiladi — shunda pastdagi maydonlar
/// klaviatura ustiga surilib chiqadi. Flutter fokusdagi maydonni
/// o'zi ko'rinadigan joyga suradi, lekin buning uchun surish JOYI
/// bo'lishi kerak.
///
/// Bitta funksiya: o'nta formada takrorlansa, bittasi unutilib
/// qolishi aniq edi — hozir aynan shunday bo'lgan.
double keyboardInset(BuildContext context) =>
    MediaQuery.viewInsetsOf(context).bottom;
