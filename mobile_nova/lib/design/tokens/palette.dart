/// Concept B Final dizaynidagi CSS o'zgaruvchilarining Dart ko'chirmasi.
///
/// NIMA UCHUN ALOHIDA FAYL: ranglar bitta joyda tursa, HTML manbasi bilan
/// yonma-yon solishtirish mumkin. Bu yerdagi har bir qiymat
/// `nfcstore_concept_b_final` dagi `html[data-theme=...]` blokidan
/// ko'chirilgan — taxmin qilingan rang yo'q.
library;

import 'dart:ui';

/// `#RRGGBB` yoki `#AARRGGBB` ni `Color` ga aylantiradi.
Color hex(String v) {
  final s = v.replaceFirst('#', '');
  return Color(int.parse(s.length == 6 ? 'FF$s' : s, radix: 16));
}

/// CSS `rgba(r,g,b,a)` ekvivalenti — opacity qiymatlari HTML bilan
/// bir xil qolishi uchun qo'lda hisoblanmaydi.
Color rgba(int r, int g, int b, double a) =>
    Color.fromRGBO(r, g, b, a);
