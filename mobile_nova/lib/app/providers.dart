import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/network/api_client.dart';
import '../core/storage/secure_store.dart';
import '../design/tokens/nfc_tokens.dart';

/// `main()` da haqiqiy nusxa bilan almashtiriladi. Test ichida esa
/// yolg'on `Prefs` beriladi — shuning uchun bu yerda `UnimplementedError`.
final prefsProvider = Provider<Prefs>((_) => throw UnimplementedError('prefs'));

/// Keystore/Keychain — sessiya tokeni va ilova qulfining PIN kodi.
///
/// Testda soxta nusxa bilan almashtiriladi.
final secureStoreProvider = Provider<SecureStore>((_) => SecureStore());

final apiProvider = Provider<ApiClient>((ref) {
  final api = ApiClient();
  ref.onDispose(() {
    api.online.dispose();
    api.sessionExpired.dispose();
  });
  return api;
});

/// Tanlangan mavzu. Saqlanadi, ilova qayta ochilganda tiklanadi.
class ThemeController extends StateNotifier<NfcTokens> {
  ThemeController(this._prefs) : super(NfcTokens.byId(_prefs.themeId));
  final Prefs _prefs;

  Future<void> select(NfcTokens t) async {
    if (t.id == state.id) return;
    state = t;
    await _prefs.setThemeId(t.id);
  }
}

final themeProvider = StateNotifierProvider<ThemeController, NfcTokens>(
  (ref) => ThemeController(ref.watch(prefsProvider)),
);

/// Interfeys tili. Standart — o‘zbekcha (Latin).
class LocaleController extends StateNotifier<Locale> {
  LocaleController(this._prefs)
      : super(Locale(_prefs.localeCode ?? fallback.languageCode));
  final Prefs _prefs;

  static const fallback = Locale('uz');
  static const supported = [Locale('uz'), Locale('ru'), Locale('en')];

  Future<void> select(Locale l) async {
    if (l.languageCode == state.languageCode) return;
    state = l;
    await _prefs.setLocaleCode(l.languageCode);
  }
}

final localeProvider = StateNotifierProvider<LocaleController, Locale>(
  (ref) => LocaleController(ref.watch(prefsProvider)),
);

/// Shaxsiy / Biznes rejimi — Home, Profile va NFC bir vaqtda almashadi.
enum AppMode { personal, business }

class ModeController extends StateNotifier<AppMode> {
  ModeController(this._prefs)
      : super(_prefs.mode == 'business' ? AppMode.business : AppMode.personal);
  final Prefs _prefs;

  Future<void> set(AppMode m) async {
    if (m == state) return;
    state = m;
    await _prefs.setMode(m.name);
  }

  Future<void> toggle() =>
      set(state == AppMode.personal ? AppMode.business : AppMode.personal);
}

final modeProvider = StateNotifierProvider<ModeController, AppMode>(
  (ref) => ModeController(ref.watch(prefsProvider)),
);
