import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_v2/app.dart';
import 'package:nfcstore_v2/core/session.dart';
import 'package:nfcstore_v2/core/theme.dart';

Future<void> _pumpSignedOut(
  WidgetTester tester,
  Size size,
) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final session = AppSession()..phase = SessionPhase.signedOut;
  final theme = BrandThemeController();
  addTearDown(session.dispose);
  addTearDown(theme.dispose);

  await tester.pumpWidget(
    NfcstoreV2App(session: session, theme: theme),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
}

void main() {
  testWidgets('premium login fits compact phone without overflow',
      (tester) async {
    await _pumpSignedOut(tester, const Size(360, 800));
    expect(find.text('NFCSTORE'), findsOneWidget);
    expect(find.text('Kirish'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('premium login fits standard modern phone', (tester) async {
    await _pumpSignedOut(tester, const Size(390, 844));
    expect(find.textContaining('More than'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('registration opens and exposes Personal and Business choices',
      (tester) async {
    await _pumpSignedOut(tester, const Size(430, 932));
    await tester.tap(find.text('Personal yoki Business hisob ochish'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));

    expect(find.text('Personal'), findsOneWidget);
    expect(find.text('Business'), findsWidgets);
    expect(find.text('Qanday boshlaysiz?'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });
}