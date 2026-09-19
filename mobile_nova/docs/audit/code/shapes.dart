import 'package:flutter/widgets.dart';

/// Concept B'dagi radius shkalasi. Ilovada `BorderRadius.circular(12)` kabi
/// tasodifiy sonlar yozilmaydi — faqat shu to'rt qiymat ishlatiladi.
abstract final class R {
  /// Kapsula — tugma, chip, nav element.
  static const pill = BorderRadius.all(Radius.circular(100));

  /// "Blob" — organik, katta yumshoq shakl (identity obyekti, hero karta).
  static const blob = BorderRadius.all(Radius.circular(44));

  /// Kartalar va bottom sheet.
  static const soft = BorderRadius.all(Radius.circular(28));

  /// Kichik plitkalar, input, rasm.
  static const gentle = BorderRadius.all(Radius.circular(22));

  static const tile = BorderRadius.all(Radius.circular(16));

  /// Organik nosimmetrik shakl — bir burchagi boshqalaridan yumshoqroq.
  /// HTML'dagi `border-radius:44px 44px 44px 18px` ko'rinishlari uchun.
  static BorderRadius organic({double a = 44, double b = 44, double c = 44, double d = 18}) =>
      BorderRadius.only(
        topLeft: Radius.circular(a),
        topRight: Radius.circular(b),
        bottomRight: Radius.circular(c),
        bottomLeft: Radius.circular(d),
      );
}

/// Bo'shliq shkalasi — 4pt panjara.
abstract final class Gap {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const xxl = 26.0;
  static const section = 34.0;

  /// Ekranning yon hoshiyasi. 360px kenglikda ham matn siqilib qolmaydi.
  static const screenX = 20.0;
}
