import 'package:flutter/foundation.dart';

import '../content/content_model.dart';

/// Foydalanuvchi kiritgan apparat/reagent ma'lumotlari.
@immutable
class IfuQuery {
  const IfuQuery({
    required this.manufacturer,
    required this.model,
    required this.reagentRef,
    required this.ifuRevision,
    this.calibratorLot = '',
  });

  /// `null` — "boshqa" ishlab chiqaruvchi (katalogda bo'lmaydi).
  final String? manufacturer;
  final String model;
  final String reagentRef;
  final String ifuRevision;
  final String calibratorLot;

  /// Model, reagent REF va IFU versiyasisiz moslik qidirilmaydi.
  bool get isComplete =>
      model.trim().isNotEmpty &&
      reagentRef.trim().isNotEmpty &&
      ifuRevision.trim().isNotEmpty;
}

@immutable
class IfuMatch {
  const IfuMatch(this.record);

  /// `null` — tasdiqlangan mos yozuv yo'q: hech qanday parametr
  /// ko'rsatilmaydi.
  final IfuRecord? record;
}

String _norm(String? s) =>
    (s ?? '').trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

/// Faqat **aniq** moslik: ishlab chiqaruvchi, model, reagent REF va IFU
/// versiyasi to'liq mos kelishi shart; yozuvda kalibrator loti
/// ko'rsatilgan bo'lsa, u ham mos bo'lishi kerak. Brend nomi bo'yicha
/// "taxminiy" moslik qilinmaydi.
IfuMatch matchIfu(List<IfuRecord> catalog, IfuQuery q) {
  if (!q.isComplete || q.manufacturer == null) return const IfuMatch(null);
  for (final r in catalog) {
    final b = r.binding;
    if (!b.isBound) continue;
    final same =
        _norm(b.manufacturer) == _norm(q.manufacturer) &&
        _norm(b.model) == _norm(q.model) &&
        _norm(b.reagentRef) == _norm(q.reagentRef) &&
        _norm(b.ifuRevision) == _norm(q.ifuRevision) &&
        (b.calibratorLot == null ||
            _norm(b.calibratorLot) == _norm(q.calibratorLot));
    if (same) return IfuMatch(r);
  }
  return const IfuMatch(null);
}
