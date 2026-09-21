import 'package:flutter/widgets.dart';

/// Vidjetning EKRANDA qancha qismi ko'rinayotganini o'lchaydi.
///
/// ## NIMA UCHUN PAKET EMAS
///
/// `visibility_detector` bir vaqtda butun ilovaga global
/// `VisibilityDetectorController` o'rnatadi va har bir kadrda
/// hamma detektorni hisoblaydi. Bu yerda kerak bo'lgani esa
/// juda tor: lentadagi bir nechta karta o'z ulushini bilsin.
///
/// ## QANDAY ISHLAYDI
///
/// O'zi turgan `Scrollable` ning pozitsiyasiga OBUNA bo'ladi va
/// har bir siljishda `RenderBox` ni viewport bilan kesishtiradi.
/// Shuning uchun u qanchalik chuqur joylashganidan qat'i nazar
/// ishlaydi — `NotificationListener` dan farqli, u faqat
/// scrollable USTIDA turganda xabar oladi.
///
/// Ulush 0..1: `1.0` — to'liq ko'rinadi, `0.0` — umuman yo'q.
/// Faqat VERTIKAL kesishma hisoblanadi; lenta vertikal va yon
/// tomondan hech narsa kesilmaydi.
class VisibleFraction extends StatefulWidget {
  const VisibleFraction({
    super.key,
    required this.child,
    required this.onChanged,
  });

  final Widget child;

  /// Ulush O'ZGARGANDA chaqiriladi — har kadrda emas.
  final ValueChanged<double> onChanged;

  @override
  State<VisibleFraction> createState() => _VisibleFractionState();
}

class _VisibleFractionState extends State<VisibleFraction> {
  ScrollPosition? _position;
  double _last = -1;
  bool _pending = false;

  /// O'LCHOV KADR CHIZILGANDAN KEYIN.
  ///
  /// `ScrollPosition` tinglovchisi joylashuvdan OLDIN chaqiriladi:
  /// o'sha paytda `RenderBox` hali ESKI o'rnida turadi. Ilgari
  /// o'lchov to'g'ridan-to'g'ri shu yerda bajarilar va natija bir
  /// kadr orqada qolardi — sinov buni o'lchab ko'rsatdi (to'liq
  /// ko'ringan element 1.0 o'rniga 0.25 deb hisoblanardi).
  ///
  /// Navbatda bitta o'lchov turadi: bir kadrda o'nlab siljish
  /// hodisasi kelsa ham ish bir marta bajariladi.
  void _schedule() {
    if (_pending) return;
    _pending = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _pending = false;
      _measure();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = Scrollable.maybeOf(context)?.position;
    if (identical(next, _position)) return;
    _position?.removeListener(_schedule);
    _position = next;
    _position?.addListener(_schedule);
    // Birinchi o'lchov kadr chizilgandan KEYIN: hozir `RenderBox`
    // hali joylashmagan bo'lishi mumkin.
    _schedule();
  }

  @override
  void dispose() {
    _position?.removeListener(_schedule);
    super.dispose();
  }

  void _measure() {
    if (!mounted) return;
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return;
    final h = box.size.height;
    if (h <= 0) return;

    final top = box.localToGlobal(Offset.zero).dy;
    final screen = MediaQuery.maybeSizeOf(context)?.height;
    if (screen == null || screen <= 0) return;

    final visible = (top + h).clamp(0.0, screen) - top.clamp(0.0, screen);
    final f = (visible / h).clamp(0.0, 1.0);

    // Mayda tebranish uchun qayta qurmaymiz.
    if ((f - _last).abs() < 0.02) return;
    _last = f;
    widget.onChanged(f);
  }

  @override
  Widget build(BuildContext context) {
    // Har qurilishda ham o'lchanadi: ro'yxat uzunligi o'zgarsa
    // yoki ekran aylansa siljish hodisasi bo'lmasligi mumkin.
    _schedule();
    return widget.child;
  }
}

/// Lentada qaysi element IJRO ETILISHI kerak.
///
/// [fractions] — `indeks -> ko'rinish ulushi`. Qaytaradi: dominant
/// indeks yoki hech biri chegaradan o'tmasa `null`.
///
/// ## NIMA UCHUN ALOHIDA FUNKSIYA
///
/// Bu butun autoplay xulqining YURAGI: "bir vaqtda bitta video"
/// qoidasi shu yerda hal bo'ladi. Vidjet ichida qolsa, uni faqat
/// emulyatorda, siljitib sinash mumkin bo'lardi. Sof funksiya
/// sifatida esa har bir chekka holat bir soniyada tekshiriladi.
///
/// Qoidalar:
///   * chegaradan past — nomzod emas;
///   * bir nechta nomzod bo'lsa ulushi ENG KATTASI;
///   * ulush teng bo'lsa TEPADAGISI (kichik indeks) — aks holda
///     sekin siljishda dominantlik ikki karta orasida sakrardi.
int? dominantIndex(Map<int, double> fractions, {double threshold = 0.65}) {
  int? best;
  var bestF = 0.0;
  // Indeks bo'yicha tartiblanadi: `Map` ning tartibi qo'shilish
  // tartibi, ya'ni siljish yo'nalishiga qarab o'zgarardi va teng
  // ulushda natija BEQAROR bo'lardi.
  final keys = fractions.keys.toList()..sort();
  for (final k in keys) {
    final f = fractions[k]!;
    if (f < threshold) continue;
    if (best == null || f > bestF) {
      best = k;
      bestF = f;
    }
  }
  return best;
}
