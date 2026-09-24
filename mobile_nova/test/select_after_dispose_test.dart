import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/app/profile_context.dart';
import 'package:nfcstore_nova/app/providers.dart';
import 'package:nfcstore_nova/core/storage/secure_store.dart';
import 'package:nfcstore_nova/features/business/business_providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// TANLOV PAYTIDA KARTA YO'Q QILINSA HAM REJIM ALMASHADI (E2E #59).
///
/// Lentadagi ID kartasi bosilganda `selectPersonal` tanlovni o'rnatadi —
/// bu kartani qayta quradi va u yo'q qilinadi. Telefon xotirasiga
/// yozish tugagach funksiya O'SHA vidjetning `ref` i bilan rejimni
/// almashtirardi: "Cannot use ref after the widget was disposed" va
/// rejim o'zgarmay qolardi.
class _SlowPrefs extends Prefs {
  _SlowPrefs(super.p);
  final gate = Completer<void>();

  @override
  Future<void> setSelectedPersonal(String? v) async {
    await gate.future;
    return super.setSelectedPersonal(v);
  }

  @override
  Future<void> setSelectedBusiness(String? v) async {
    await gate.future;
    return super.setSelectedBusiness(v);
  }
}

class _Card extends ConsumerStatefulWidget {
  const _Card();

  @override
  ConsumerState<_Card> createState() => _CardState();
}

class _CardState extends ConsumerState<_Card> {
  @override
  Widget build(BuildContext context) => const SizedBox();
}

void main() {
  Future<(ProviderContainer, _SlowPrefs, WidgetRef)> boot(
      WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = _SlowPrefs(await SharedPreferences.getInstance());
    final c = ProviderContainer(overrides: [
      prefsProvider.overrideWithValue(prefs),
    ]);
    addTearDown(c.dispose);
    await tester.pumpWidget(
        UncontrolledProviderScope(container: c, child: const _Card()));
    return (c, prefs, tester.state<_CardState>(find.byType(_Card)).ref);
  }

  testWidgets('selectPersonal: yozish paytida karta yo‘q qilinadi — rejim almashadi',
      (tester) async {
    final (c, prefs, ref) = await boot(tester);
    await c.read(modeProvider.notifier).set(AppMode.business);

    final done = selectPersonal(ref, 'UZD772');
    // Tanlov kartani qayta qurdi va u yo'q qilindi.
    await tester.pumpWidget(
        UncontrolledProviderScope(container: c, child: const SizedBox()));
    prefs.gate.complete();
    await done; // ilgari: Bad state: Cannot use "ref" after ... disposed

    expect(c.read(selectedPersonalCodeProvider), 'UZD772');
    expect(c.read(modeProvider), AppMode.personal,
        reason: 'rejim shaxsiyga o‘tmay qoldi');
    expect(prefs.selectedPersonal, 'UZD772');
  });

  testWidgets('rememberBusiness: yozish paytida vidjet yo‘q qilinadi — xato yo‘q',
      (tester) async {
    final (c, prefs, ref) = await boot(tester);
    final done = rememberBusiness(ref, 'ELITE');
    await tester.pumpWidget(
        UncontrolledProviderScope(container: c, child: const SizedBox()));
    prefs.gate.complete();
    await done;
    expect(c.read(selectedBusinessProvider), 'ELITE');
    expect(prefs.selectedBusiness, 'ELITE');
  });
}
