import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

/// Uch til ham TO'LIQ bo'lishi kerak.
///
/// Bitta kalit bir tilda tushib qolsa, foydalanuvchi o'sha joyda
/// begona tildagi matnni ko'radi. Bu testlar uchala tarjimani
/// yonma-yon solishtiradi.
void main() {
  final uz = LUz();
  final ru = LRu();
  final en = LEn();

  /// Har tildan bir xil kalitlar to'plamini oladi.
  Map<String, String> sample(L l) => {
        'appName': l.appName,
        'actionContinue': l.actionContinue,
        'actionSave': l.actionSave,
        'welcomeLogin': l.welcomeLogin,
        'welcomeRegister': l.welcomeRegister,
        'loginTitle': l.loginTitle,
        'fieldEmail': l.fieldEmail,
        'fieldPhone': l.fieldPhone,
        'fieldPassword': l.fieldPassword,
        'verifyTitle': l.verifyTitle,
        'navHome': l.navHome,
        'navDiscover': l.navDiscover,
        'navNfc': l.navNfc,
        'navReels': l.navReels,
        'navProfile': l.navProfile,
        'nfcCenter': l.nfcCenter,
        'nfcUnsupported': l.nfcUnsupported,
        'nfcDisabled': l.nfcDisabled,
        'modePersonal': l.modePersonal,
        'modeBusiness': l.modeBusiness,
        'profileFollowers': l.profileFollowers,
        'bizCatalog': l.bizCatalog,
        'bizCreate': l.bizCreate,
        'shopTitle': l.shopTitle,
        'checkoutTitle': l.checkoutTitle,
        'paymentPending': l.paymentPending,
        'paymentSuccess': l.paymentSuccess,
        'paymentFailed': l.paymentFailed,
        'orders': l.orders,
        'activityTitle': l.activityTitle,
        'settings': l.settings,
        'settingsTheme': l.settingsTheme,
        'settingsLanguage': l.settingsLanguage,
        'logout': l.logout,
        'errOffline': l.errOffline,
        'errServer': l.errServer,
        'errBadEmail': l.errBadEmail,
        'errBadPhone': l.errBadPhone,
        'stateEmpty': l.stateEmpty,
        'stateNoResults': l.stateNoResults,
        'themePearl': l.themePearl,
        'themeMidnight': l.themeMidnight,
      };

  test('uchala til ham bir xil kalitlarni qamrab oladi', () {
    expect(sample(uz).keys.toSet(), sample(ru).keys.toSet());
    expect(sample(uz).keys.toSet(), sample(en).keys.toSet());
  });

  test('hech bir tilda bo‘sh matn yo‘q', () {
    for (final entry in [
      ('uz', sample(uz)),
      ('ru', sample(ru)),
      ('en', sample(en)),
    ]) {
      entry.$2.forEach((key, value) {
        expect(value.trim(), isNotEmpty,
            reason: '${entry.$1} tilida "$key" bo‘sh');
      });
    }
  });

  test('tarjimalar haqiqatan boshqacha — nusxa emas', () {
    final u = sample(uz);
    final r = sample(ru);
    final e = sample(en);

    // Brend nomi uchala tilda bir xil bo'lishi TABIIY, shuning uchun
    // tekshiruvdan chiqariladi.
    const shared = {'appName', 'navNfc', 'navReels'};

    var uzRuDiff = 0;
    var uzEnDiff = 0;
    for (final key in u.keys.where((k) => !shared.contains(k))) {
      if (u[key] != r[key]) uzRuDiff++;
      if (u[key] != e[key]) uzEnDiff++;
    }
    // Kalitlarning katta qismi haqiqatan tarjima qilingan bo'lishi kerak.
    expect(uzRuDiff, greaterThan(u.length * 0.8));
    expect(uzEnDiff, greaterThan(u.length * 0.8));
  });

  test('o‘rin almashtiruvchi qiymatlar uchala tilda ishlaydi', () {
    for (final l in [uz, ru, en]) {
      expect(l.verifySentTo('a@b.uz'), contains('a@b.uz'));
      expect(l.verifyResendIn(42), contains('42'));
      expect(l.registerStep(2, 4), allOf(contains('2'), contains('4')));
      expect(l.uploadProgress(75), contains('75'));
      expect(l.orderNumber('19'), contains('19'));
      expect(l.settingsVersion('1.0.0'), contains('1.0.0'));
    }
  });

  test('rus tilidagi yozuvlar haddan tashqari uzun emas', () {
    // Kapsula va nav yorlig'iga sig'ishi kerak bo'lgan qisqa matnlar.
    final short = <String, String>{
      'navHome': ru.navHome,
      'navDiscover': ru.navDiscover,
      'navProfile': ru.navProfile,
      'modePersonal': ru.modePersonal,
      'modeBusiness': ru.modeBusiness,
      'actionSave': ru.actionSave,
      'actionCancel': ru.actionCancel,
    };
    short.forEach((key, value) {
      expect(value.length, lessThanOrEqualTo(14),
          reason: 'ru "$key" juda uzun: "$value"');
    });
  });

  test('qo‘llab-quvvatlanadigan tillar ro‘yxati to‘liq', () {
    expect(L.supportedLocales.map((e) => e.languageCode).toSet(),
        {'uz', 'ru', 'en'});
  });

  test('delegate uchala tilni ham yuklay oladi', () async {
    for (final code in ['uz', 'ru', 'en']) {
      final loaded = await L.delegate.load(Locale(code));
      expect(loaded.localeName, code);
    }
  });

  test('o\'zbek matnida ASCII apostrof YO\'Q', () {
    // O'ZBEK LOTIN TIPOGRAFIYASI.
    //
    // Loyiha ikki xil belgi ishlatadi va ikkalasi ham TO'G'RI:
    //
    //   ‘  (U+2018) — `o‘`, `g‘` harflari uchun: "o‘chirish",
    //                 "sovg‘a";
    //   ’  (U+2019) — ayirish belgisi: "ma’lumot", "ID’lar".
    //
    // ASCII `'` esa ikkalasidan ham farq qiladi va matn ichida
    // boshqacha ko'rinadi. Bitta satrda shunday bo'lgan edi
    // ("qo'yadi") — qolgan 337 tasida to'g'ri belgi turardi.
    // Ko'z bilan deyarli sezilmaydi, shuning uchun sinov.
    final bad = <String>[];
    for (final lang in ['uz']) {
      final file = File('lib/l10n/arb/app_$lang.arb');
      final map = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
      map.forEach((k, v) {
        if (k.startsWith('@') || v is! String) return;
        if (v.contains("'")) bad.add('$lang.$k = "$v"');
      });
    }
    expect(bad, isEmpty,
        reason: 'ASCII apostrof ishlatilgan — `‘` yoki `’` '
            'bo\'lishi kerak:\n${bad.join('\n')}');
  });
}
