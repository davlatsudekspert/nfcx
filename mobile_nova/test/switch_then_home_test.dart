import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/app.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/data/repositories/business_repository.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:nfcstore_nova/features/auth/session.dart';
import 'package:nfcstore_nova/features/home/home_screen.dart' show activeIdProvider;
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';
import 'package:nfcstore_nova/routing/router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

class _BizRepo extends BusinessRepository {
  _BizRepo() : super(ApiClient());

  @override
  Future<Result<List<Business>>> mine() async => const Ok([
        Business(companyId: 'ELITE', displayName: 'Elite Qurilish'),
        Business(companyId: 'NFCSTOREUZ', displayName: 'NFCSTORE'),
      ]);
}

const _ids = [
  NfcId(code: 'VIP001', name: 'Muhammad', primary: true, followers: 5),
  NfcId(code: 'UZD772', name: 'Oybek'),
  NfcId(code: 'TTS075', name: 'Tohir'),
];

Future<void> _frames(WidgetTester tester, [int n = 30]) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// PROFILDA ID ALMASHTIRIB, BOSH SAHIFAGA O'TISH — HAQIQIY BOSISHLAR.
///
/// Egasi (2026-09): "profil bo'limidan ID'ni almashtirsangiz, keyin
/// asosiy bo'limga o'tsangiz, o'sha tanlangan ID chiqyapti, o'zgarmayapti,
/// boshqa ID'ga ham, biznesga ham o'tmayapti". Sabablari: lenta va bir
/// qator ekranlar eski manbadan (asosiy ID) o'qirdi, sarlavhadagi
/// tanlagich bir martadan keyin ochilmasdi, lentadagi ID bosilganda
/// faol bo'lmasdi.
void main() {
  late ProviderContainer c;

  Future<void> boot(WidgetTester tester, {List<NfcId> ids = _ids}) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    c = ProviderContainer(overrides: [
      ...await testOverrides(),
      authRepositoryProvider.overrideWithValue(FakeAuthRepository(ids: ids)),
      businessRepositoryProvider.overrideWithValue(_BizRepo()),
    ]);
    addTearDown(c.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: c,
      child: const NovaApp(),
    ));
    await _frames(tester);
  }

  Future<void> go(WidgetTester tester, String route) async {
    c.read(routerProvider).go(route);
    await _frames(tester, 40);
  }

  Future<void> tapCard(WidgetTester tester, String code) async {
    // Kartalar kengaygach (190dp) uchinchisi lentaning kesh qismida —
    // qurilgan, lekin ekrandan tashqarida (offstage). Avval uni ko'rinadigan
    // joyga suramiz, keyin bosamiz.
    final card = find.byKey(ValueKey('my-id-$code'), skipOffstage: false);
    await tester.ensureVisible(card);
    await _frames(tester, 6);
    await tester.tap(card);
    await _frames(tester, 20);
  }

  testWidgets('profil lentasidan ID tanlash → bosh sahifa → biznes → boshqa ID',
      (tester) async {
    await boot(tester);
    final l = LUz();

    // 1. Profilda lentadan Tohir.
    await go(tester, Routes.profile);
    await tapCard(tester, 'TTS075');
    expect(c.read(activePersonalProvider)?.code, 'TTS075');
    expect(c.read(activeIdProvider)?.code, 'TTS075',
        reason: 'NFC/post/tahrirlash ham tanlangan ID bilan ishlasin');
    expect(c.read(prefsProvider).selectedPersonal, 'TTS075',
        reason: 'ilova qayta ochilganda ham shu ID');

    // 2. Profilda yana boshqasi — lenta har safar almashtiradi.
    await tapCard(tester, 'UZD772');
    expect(c.read(activePersonalProvider)?.code, 'UZD772');

    // 3. Bosh sahifa o'sha ID'ni ko'rsatadi.
    await go(tester, Routes.home);
    expect(tester.takeException(), isNull);
    expect(find.text('UZD772'), findsWidgets);

    // 4. Bosh sahifada Biznes.
    final biz = find.text(l.modeBusiness).first;
    await tester.ensureVisible(biz);
    await tester.tap(biz);
    await _frames(tester, 30);
    // Ikki kompaniya, hech biri tanlanmagan — tanlagich chiqadi.
    if (find.text('NFCSTORE').evaluate().isNotEmpty &&
        c.read(modeProvider) != AppMode.business) {
      await tester.tap(find.text('NFCSTORE').last);
      await _frames(tester, 30);
    }
    expect(c.read(modeProvider), AppMode.business);
    expect(c.read(activeProfileProvider)?.isBusiness, isTrue);

    // 5. Shaxsiyga qaytish — tanlagich chiqadi, Tohir tanlanadi.
    final per = find.text(l.modePersonal).first;
    await tester.ensureVisible(per);
    await tester.tap(per);
    await _frames(tester, 30);
    expect(find.text(l.profilePickPersonal), findsOneWidget,
        reason: 'bir nechta ID bor — tanlagich ochilishi kerak');
    await tester.tap(find.text('Tohir').last);
    await _frames(tester, 30);
    expect(c.read(modeProvider), AppMode.personal);
    expect(c.read(activePersonalProvider)?.code, 'TTS075');
    expect(find.text('TTS075'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  // E2E #53: haqiqiy hisobda bir odamning hamma ID'sida ism BIR XIL.
  // Ism bo'yicha `.last` boshqa qatorni bosardi — E2E oqimi endi
  // varaq ichidan noyob KOD bo'yicha bosadi. Shu yo'l shu yerda sinaladi.
  testWidgets('bir xil ismli ID lar — tanlagichda kod bo‘yicha to‘g‘ri ID',
      (tester) async {
    await boot(tester, ids: const [
      NfcId(code: 'VIP001', name: 'Davlat', primary: true),
      NfcId(code: 'UZD772', name: 'Davlat'),
      NfcId(code: 'TTS075', name: 'Davlat'),
    ]);
    final l = LUz();
    await go(tester, Routes.profile);
    await tapCard(tester, 'UZD772');
    expect(c.read(activePersonalProvider)?.code, 'UZD772');

    await go(tester, Routes.home);
    final biz = find.text(l.modeBusiness).first;
    await tester.ensureVisible(biz);
    await tester.tap(biz);
    await _frames(tester, 30);
    final bizRow = find.descendant(
        of: find.byType(BottomSheet), matching: find.text('ELITE'));
    if (bizRow.evaluate().isNotEmpty) {
      await tester.tap(bizRow.first);
      await _frames(tester, 30);
    }
    expect(c.read(modeProvider), AppMode.business);

    final per = find.text(l.modePersonal).first;
    await tester.ensureVisible(per);
    await tester.tap(per);
    await _frames(tester, 30);
    final row = find.descendant(
        of: find.byType(BottomSheet), matching: find.text('VIP001'));
    expect(row, findsOneWidget);
    await tester.tap(row.first);
    await _frames(tester, 30);
    expect(c.read(modeProvider), AppMode.personal);
    expect(c.read(activePersonalProvider)?.code, 'VIP001');
    expect(tester.takeException(), isNull);
  });

  // Egasi (2026-09-24): "Profilda personal profilni tanlash bor. Lekin
  // biznes profilni tanlash chiqmayabdi, menda 4 tami bor". Kompaniya
  // bir marta tanlangach varaq endi umuman chiqmasdi.
  testWidgets('biznes tanlangan bo‘lsa ham "Biznes" tanlagichni ochadi',
      (tester) async {
    await boot(tester);
    final l = LUz();
    await c.read(myBusinessesProvider.future);
    c.read(selectedBusinessProvider.notifier).state = 'ELITE';
    await c.read(modeProvider.notifier).set(AppMode.business);
    await go(tester, Routes.profile);
    expect(c.read(selectedBusinessProvider), 'ELITE');

    final biz = find.text(l.modeBusiness).first;
    await tester.ensureVisible(biz);
    await tester.tap(biz);
    await _frames(tester, 30);
    expect(find.text(l.profilePickBusiness), findsOneWidget,
        reason: 'bir nechta biznes bor — tanlagich har safar ochiladi');
    final row = find.descendant(
        of: find.byType(BottomSheet), matching: find.text('NFCSTOREUZ'));
    expect(row, findsOneWidget);
    await tester.tap(row);
    await _frames(tester, 30);
    expect(c.read(selectedBusinessProvider), 'NFCSTOREUZ');
    expect(c.read(modeProvider), AppMode.business);
    expect(tester.takeException(), isNull);
  });

  test('sarlavhadagi tanlagich HAR SAFAR ochiladi (jim chiqib ketmaydi)', () {
    final src = File('lib/features/profile/profile_switcher.dart')
        .readAsStringSync();
    final body = src
        .substring(src.indexOf('Future<void> pickWithinCurrentMode'))
        .split('Future<T?> _pick')
        .first;
    expect(body, isNot(contains('savedCode')),
        reason: 'bir marta tanlagandan keyin tanlagich ochilmay qolardi');
  });
}
