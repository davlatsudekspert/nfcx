/// Katta sarlavhani ixchamlashtirish/kengaytirish qarori.
///
/// Qoidalar (START_HERE: hysteresis 12–16 px):
/// * Kontent pastga surilsa (barmoq yuqoriga, offset oshadi) va shu
///   yo'nalishda jami [threshold] px dan oshsa — ixcham holat.
/// * Teskari yo'nalishda [threshold] px dan oshsa — kengaytirilgan holat.
/// * Yo'nalish o'zgarganda yig'ilgan masofa nolga tushadi, shuning uchun
///   mayda tebranish holatni almashtirmaydi.
/// * Ro'yxat tepasida ([topSnap] px ichida) sarlavha doim kengaytirilgan.
/// * Kontent ixchamlashgandan keyin ham scroll qilinadigan bo'lib qolmasa,
///   ixchamlashtirilmaydi — aks holda viewport kattalashib offset nolga
///   qisiladi va holat "tebranadi".
///
/// Sof Dart: widgetdan ajratilgan, unit testda aniq ketma-ketlik bilan
/// tekshiriladi.
class CollapseHysteresis {
  CollapseHysteresis({this.threshold = 14, this.topSnap = 4})
    : assert(threshold >= 12 && threshold <= 16);

  final double threshold;
  final double topSnap;

  bool _collapsed = false;
  double _accumulated = 0;

  bool get collapsed => _collapsed;

  /// Foydalanuvchi qo'zg'atgan bitta scroll qadamini qayta ishlaydi.
  ///
  /// [pixels] — yangi offset, [delta] — shu qadamdagi o'zgarish
  /// (musbat = kontent pastga surildi), [maxScrollExtent] — joriy
  /// maksimal offset, [collapsibleExtent] — ixchamlashganda viewportga
  /// qo'shiladigan balandlik.
  ///
  /// Holat o'zgargan bo'lsa `true` qaytaradi.
  bool onScroll({
    required double pixels,
    required double delta,
    required double maxScrollExtent,
    required double collapsibleExtent,
  }) {
    if (delta.isNaN || pixels.isNaN) return false;

    if (pixels <= topSnap) {
      _accumulated = 0;
      return _set(false);
    }
    if (delta == 0) return false;

    if (_accumulated != 0 && (delta > 0) != (_accumulated > 0)) {
      _accumulated = 0;
    }
    _accumulated += delta;

    if (!_collapsed && _accumulated >= threshold) {
      final stillScrollable =
          maxScrollExtent - collapsibleExtent >= threshold + topSnap;
      if (!stillScrollable) return false;
      _accumulated = 0;
      return _set(true);
    }
    if (_collapsed && _accumulated <= -threshold) {
      _accumulated = 0;
      return _set(false);
    }
    return false;
  }

  /// Masalan, tab qayta tanlanib ro'yxat tepaga qaytarilganda.
  bool reset() {
    _accumulated = 0;
    return _set(false);
  }

  bool _set(bool value) {
    if (_collapsed == value) return false;
    _collapsed = value;
    return true;
  }
}
