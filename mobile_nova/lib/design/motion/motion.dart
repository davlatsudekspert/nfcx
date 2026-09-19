import 'package:flutter/widgets.dart';

/// Harakat tizimi — HTML'dagi `--ease-*` va `--dur-*` qiymatlari.
///
/// QOIDA: ilovada `Duration(milliseconds: 300)` qo'lda yozilmaydi. Har bir
/// animatsiya shu yerdagi uchta tezlikdan birini oladi, shuning uchun butun
/// ilova bir maromda "nafas oladi".
abstract final class Motion {
  static const fast = Duration(milliseconds: 250);
  static const med = Duration(milliseconds: 450);
  static const slow = Duration(milliseconds: 700);

  /// Mavzu almashuvi — sezilarli, lekin shoshmaydigan.
  static const theme = Duration(milliseconds: 520);

  /// `cubic-bezier(.34,1.4,.5,1)` — bosilganda yengil "qaytish".
  static const spring = Cubic(.34, 1.4, .5, 1);

  /// `cubic-bezier(.4,0,.2,1)` — standart material tezlanish.
  static const smooth = Cubic(.4, 0, .2, 1);

  /// Nafas olish sikli: NFC orb, halo va ambient gradient.
  static const breathe = Duration(milliseconds: 5000);

  /// Orbit — NFC markazidagi amallar markaz atrofida bir marta
  /// aylanib chiqadigan vaqt. HTML: `animation:orbit 22s linear
  /// infinite`. Ataylab SEKIN: harakat e'tiborni tortish uchun emas,
  /// obyekt "tirik" ekanini bildirish uchun.
  static const orbit = Duration(seconds: 22);

  /// NFC to'lqinlari — uchtasi 1/3 siklga surilib chiqadi.
  static const wave = Duration(milliseconds: 3200);
}

/// Tizimda "harakatni kamaytirish" yoqilganmi.
///
/// Yoqilgan bo'lsa takrorlanuvchi animatsiyalar (nafas, to'lqin, shimmer)
/// to'xtaydi: ular bezak, ma'no tashimaydi.
bool reduceMotion(BuildContext context) =>
    MediaQuery.maybeDisableAnimationsOf(context) ?? false;
