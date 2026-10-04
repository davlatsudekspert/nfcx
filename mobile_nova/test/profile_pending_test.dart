import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/data/models/models.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';
import 'package:nfcstore_nova/features/profile/profile_screen.dart';

import 'helpers.dart';

/// BEGONA PROFIL YUKLANAYOTGANDA — O'Z MA'LUMOTIMIZ CHIQMAYDI.
///
/// Egasi (2026-10-04, video): katalogdan birovning profiliga kirilganda
/// bir lahza hisob egasining ismi va bosh harflari, bo'sh sonlar va
/// "Kuzatish" tugmasi ko'rinib, keyin haqiqiy profil chiqardi.
void main() {
  testWidgets('yuklanayotganda faqat skelet, keyin begona profil',
      (tester) async {
    tester.view.physicalSize = const Size(390 * 3, 844 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final base = await testOverrides();
    await tester.pumpWidget(ProviderScope(
      overrides: [
        ...base,
        publicProfileProvider('77777777').overrideWith((ref) async {
          await Future<void>.delayed(const Duration(milliseconds: 600));
          return const NfcId(code: '77777777', name: 'Begona Odam');
        }),
      ],
      child: wrapScreen(const ProfileScreen(code: '77777777')),
    ));
    await tester.pump(const Duration(milliseconds: 100));

    // Yuklanmoqda: skelet bor, hisob egasining ismi va "Kuzatish" yo'q.
    expect(find.byKey(const ValueKey('profile-pending')), findsOneWidget);
    expect(find.text(testUser.displayName), findsNothing);
    expect(find.text(testUser.name), findsNothing);
    expect(find.text('Begona Odam'), findsNothing);

    await tester.pump(const Duration(milliseconds: 700));
    await settle(tester, frames: 6);
    expect(find.byKey(const ValueKey('profile-pending')), findsNothing);
    expect(find.text('Begona Odam'), findsWidgets);
    expect(find.text(testUser.displayName), findsNothing);
  });
}
