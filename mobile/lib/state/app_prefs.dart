import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../design/tokens.dart';
import '../l10n/strings.dart';

/// KO'RINISH SOZLAMALARI — rang mavzusi va til.
///
/// NIMA UCHUN `AppState` DAN AJRATILGAN: `AppState` sessiyaga
/// tegishli (kim kirgan, qaysi shaxs faol). Mavzu va til esa hisobga
/// umuman bog'liq emas — ular chiqib ketgandan keyin ham saqlanadi
/// va kirish ekranida ham amal qiladi. Bitta klassga qo'shsak,
/// chiqishda ular ham tozalanib ketardi.
///
/// SAQLASH: `flutter_secure_storage` — ilovada allaqachon bor va
/// qo'shimcha bog'liqlik talab qilmaydi. Kalit ochilmasa (ba'zi
/// qurilmalarda shunday bo'ladi) standart qiymat ishlatiladi va
/// ilova baribir ochiladi.
class AppPrefs extends ChangeNotifier {
  AppPrefs({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _themeKey = 'app_theme';
  static const _localeKey = 'app_locale';

  Palette _palette = Palette.original;
  AppLocale _locale = AppLocale.uz;
  bool _loaded = false;

  Palette get palette => _palette;
  AppLocale get locale => _locale;

  /// Saqlangan qiymatlar o'qib bo'lindimi.
  ///
  /// Ilova shu tugamaguncha ko'rsatilmaydi: aks holda ekran avval
  /// asl mavzuda chiqib, keyin sakrab boshqa rangga o'tardi.
  bool get loaded => _loaded;

  Future<void> load() async {
    try {
      final theme = await _storage.read(key: _themeKey);
      final locale = await _storage.read(key: _localeKey);
      _palette = Palette.byId(theme);
      _locale = AppLocale.byCode(locale);
    } catch (_) {
      _palette = Palette.original;
      _locale = AppLocale.uz;
    }
    // TOKENLARGA DARHOL QO'LLANADI: `C` statik o'qiydi, ya'ni
    // birinchi qurilishdan oldin joyida bo'lishi shart.
    C.apply(_palette);
    _loaded = true;
    notifyListeners();
  }

  Future<void> setPalette(Palette p) async {
    if (p.id == _palette.id) return;
    _palette = p;
    C.apply(p);
    notifyListeners();
    try {
      await _storage.write(key: _themeKey, value: p.id);
    } catch (_) {
      // Saqlanmasa ham joriy seansda ishlaydi — bu xatoni
      // foydalanuvchiga ko'rsatish ortiqcha bezovtalik bo'lardi.
    }
  }

  Future<void> setLocale(AppLocale l) async {
    if (l == _locale) return;
    _locale = l;
    notifyListeners();
    try {
      await _storage.write(key: _localeKey, value: l.code);
    } catch (_) {}
  }
}
