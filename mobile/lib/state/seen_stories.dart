import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/models.dart';

/// KO'RILGAN ISTORYALAR — QURILMADA.
///
/// NIMA UCHUN SERVERDA EMAS: backend'da "kim qaysi istoryani
/// ko'rgan" degan jadval YO'Q (`/api/stories/feed` faqat muddati
/// o'tmagan istoryalarni beradi). Uni qo'shish server o'zgarishi
/// bo'lardi, bu esa taqiqlangan.
///
/// Qurilmada saqlash bu yerda YETARLI, chunki halqaning rangi —
/// ko'rish tajribasi, hisobot emas: odam o'z telefonida nimani
/// ochganini eslash kifoya. Boshqa telefonda halqa yana oltin
/// bo'ladi va bu yolg'on emas — u qurilmada haqiqatan ko'rilmagan.
///
/// SAQLASH JOYI `shared_preferences`: bu maxfiy ma'lumot emas,
/// Keystore'ni band qilishning hojati yo'q. Keystore sekin ham
/// (ba'zi qurilmalarda birinchi murojaat javob bermay qoladi) —
/// istorya qatori esa bosh ekran bilan birga darhol chizilishi
/// kerak.
class SeenStories extends ChangeNotifier {
  /// Testda tayyor `SharedPreferences` berish uchun — ilovada u
  /// birinchi murojaatda o'zi ochiladi.
  // Maydon nomi `_` bilan boshlanadi, nomlangan parametrni esa
  // maxfiy qilib bo'lmaydi — shuning uchun oddiy tayinlash.
  // ignore: prefer_initializing_formals
  SeenStories({SharedPreferences? prefs}) : _prefs = prefs;

  static const _key = 'seen_story_ids';

  /// RO'YXAT CHEKLANGAN. Istorya 24 soatdan keyin o'chadi, ya'ni
  /// eski ID'lar hech qachon qayta uchramaydi va ro'yxatda yotishi
  /// behuda. 500 — bir necha kunlik faol obunachi uchun ham
  /// yetarli, lekin xotira ham, o'qish vaqti ham sezilmaydi.
  static const _limit = 500;

  SharedPreferences? _prefs;

  /// Ko'rilgan ID'lar — eskisidan yangisiga. Tartib chegarani
  /// qo'llashda kerak: to'lib qolganda eng eskisi tashlanadi.
  final List<int> _ids = [];
  final Set<int> _set = {};

  bool _loaded = false;
  bool get loaded => _loaded;

  Future<void> load() async {
    try {
      final p = _prefs ??= await SharedPreferences.getInstance();
      final raw = p.getStringList(_key) ?? const [];
      _ids
        ..clear()
        ..addAll(raw.map((e) => int.tryParse(e) ?? 0).where((e) => e > 0));
      _set
        ..clear()
        ..addAll(_ids);
    } catch (_) {
      // Sozlamalar ochilmasa halqa hammasi uchun oltin qoladi —
      // bu yo'qotish emas, eng ko'pi bilan ortiqcha e'tibor.
    }
    _loaded = true;
    notifyListeners();
  }

  /// Shu odamda KO'RILMAGAN istorya bormi.
  ///
  /// Bitta ID yetarli: odam kechagi ikkitasini ko'rgan bo'lsa ham,
  /// bugun yangisi qo'yilsa halqa yana yonishi kerak.
  bool hasUnseen(StoryFeedEntry e) =>
      e.ids.isEmpty || e.ids.any((id) => !_set.contains(id));

  /// Ko'rildi deb belgilash — istorya to'liq ekranda ochilganda.
  Future<void> markSeen(Iterable<int> ids) async {
    final fresh = ids.where((id) => id > 0 && !_set.contains(id)).toList();
    if (fresh.isEmpty) return;
    _ids.addAll(fresh);
    _set.addAll(fresh);
    if (_ids.length > _limit) {
      final drop = _ids.length - _limit;
      _set.removeAll(_ids.take(drop));
      _ids.removeRange(0, drop);
    }
    notifyListeners();
    try {
      final p = _prefs ??= await SharedPreferences.getInstance();
      await p.setStringList(_key, _ids.map((e) => '$e').toList());
    } catch (_) {
      // Yozilmasa ham joriy sessiyada halqa so'ngan holicha qoladi.
    }
  }
}
