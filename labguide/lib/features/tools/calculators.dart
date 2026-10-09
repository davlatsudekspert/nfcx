/// Laboratoriya kalkulyatorlari — sof Dart, UI dan ajratilgan va
/// chegaraviy holatlar (nol, manfiy, NaN, overflow) bilan testlangan.
library;

/// Raqamni foydalanuvchi kiritgan matndan o'qish. UZ/RU klaviaturalarida
/// o'nlik ajratuvchi vergul bo'lgani uchun "2,5" ham qabul qilinadi.
/// Bo'shliqlar (minglik ajratuvchi) olib tashlanadi. Noto'g'ri kirish `null`
/// qaytaradi — hech qachon NaN emas.
///
/// [commaIsDecimal] — ilova tilida vergul o'nlik belgisi (UZ, RU): unda
/// “1,500” = 1,5. Aks holda (EN) “1,500” ikki ma'noli va `null`.
double? parseDecimal(String raw, {bool commaIsDecimal = false}) {
  final compact = raw.trim().replaceAll(RegExp(r'[\s  ]'), '');
  // “1,500” — ming ajratgichmi (1500) yoki o'nlik vergulmi (1,5)? Vergul
  // o'nlik belgisi bo'lmagan tilda taxmin qilinmaydi: foydalanuvchi qayta
  // kiritadi (“1500” yoki “1.5”).
  if (!commaIsDecimal &&
      RegExp(r'^[+-]?[1-9]\d{0,2}(,\d{3})+$').hasMatch(compact)) {
    return null;
  }
  final cleaned = compact.replaceAll(',', '.');
  if (cleaned.isEmpty) return null;
  if (!RegExp(r'^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$').hasMatch(cleaned)) {
    return null;
  }
  final value = double.tryParse(cleaned);
  if (value == null || value.isNaN) return null;
  return value;
}

enum DilutionError { invalidInput, targetAboveStock, outOfRange }

class DilutionResult {
  const DilutionResult._({this.stockVolume, this.diluentVolume, this.error});

  /// V₁ — olinadigan boshlang'ich eritma hajmi (V₂ bilan bir birlikda).
  final double? stockVolume;

  /// V₂ − V₁ — hajmlar qo'shiladi degan oddiy model bo'yicha.
  final double? diluentVolume;
  final DilutionError? error;

  bool get isOk => error == null;

  /// C₂ = C₁ — suyultirish kerak emas.
  bool get noDilutionNeeded => isOk && diluentVolume == 0;
}

/// C₁V₁ = C₂V₂ dan V₁ ni topadi.
///
/// Qoidalar: hamma qiymat chekli va > 0; C₂ ≤ C₁ (suyultirish
/// konsentratsiyani oshirmaydi); natija chekli va musbat bo'lishi shart.
DilutionResult solveDilution({
  required double? stockConcentration,
  required double? targetConcentration,
  required double? finalVolume,
}) {
  final c1 = stockConcentration;
  final c2 = targetConcentration;
  final v2 = finalVolume;
  if (c1 == null || c2 == null || v2 == null) {
    return const DilutionResult._(error: DilutionError.invalidInput);
  }
  for (final x in [c1, c2, v2]) {
    if (!x.isFinite) {
      return const DilutionResult._(error: DilutionError.outOfRange);
    }
    if (x <= 0) {
      return const DilutionResult._(error: DilutionError.invalidInput);
    }
  }
  if (c2 > c1) {
    return const DilutionResult._(error: DilutionError.targetAboveStock);
  }
  // V₁ = V₂ · (C₂ / C₁). Avval nisbat (≤ 1) hisoblanadi — c2*v2 ko'paytmasi
  // katta qiymatlarda cheksizlikka chiqib ketmasligi uchun.
  final v1 = v2 * (c2 / c1);
  if (!v1.isFinite || v1 <= 0) {
    return const DilutionResult._(error: DilutionError.outOfRange);
  }
  final diluent = c2 == c1 ? 0.0 : v2 - v1;
  return DilutionResult._(stockVolume: v1, diluentVolume: diluent);
}

enum MassUnit { mgPerDl, mmolPerL }

enum ConversionError { invalidInput, outOfRange, unsupported }

class ConversionResult {
  const ConversionResult._({this.value, this.error});

  final double? value;
  final ConversionError? error;

  bool get isOk => error == null;
}

/// Moddaga xos mg/dL ↔ mmol/L (yoki µmol/L) o'tkazish.
///
/// mmol/L = mg/dL × 10 / M, bu yerda M — molyar massa (g/mol);
/// µmol/L uchun [siPerMmol] = 1000.
/// M berilmasa (moddaning tasdiqlangan molyar massasi yo'q) o'tkazish
/// taklif qilinmaydi: bitta umumiy koeffitsiyent ishlatilmaydi.
ConversionResult convertConcentration({
  required double? value,
  required MassUnit from,
  required double? molarMass,
  double siPerMmol = 1,
}) {
  final m = molarMass;
  if (m == null || !m.isFinite || m <= 0) {
    return const ConversionResult._(error: ConversionError.unsupported);
  }
  final v = value;
  if (v == null) {
    return const ConversionResult._(error: ConversionError.invalidInput);
  }
  if (!v.isFinite) {
    return const ConversionResult._(error: ConversionError.outOfRange);
  }
  if (v < 0) {
    return const ConversionResult._(error: ConversionError.invalidInput);
  }
  final result = switch (from) {
    MassUnit.mgPerDl => v * 10 / m * siPerMmol,
    MassUnit.mmolPerL => v / siPerMmol * m / 10,
  };
  if (!result.isFinite) {
    return const ConversionResult._(error: ConversionError.outOfRange);
  }
  return ConversionResult._(value: result);
}
