import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/design/tokens/nfc_tokens.dart';
import 'package:nfcstore_nova/features/profile/music_player.dart';

import 'helpers.dart';

/// Play testeri: "Musiqa yo'q".
///
/// Musiqa tahrirlash ekranida qo'shilardi, lekin FAQAT bosh sahifa
/// orbida chalinardi — profilda (o'ziniki ham, boshqa odamniki ham)
/// belgi ham, pleyer ham yo'q edi. Mehmon uni hech qachon eshitmasdi.
void main() {
  test('profil avatari yonida musiqa belgisi bor', () {
    final src =
        File('lib/features/profile/profile_screen.dart').readAsStringSync();
    expect(src, contains('urls: profile!.musicUrls'),
        reason: 'profil ekranida musiqa pleyeri yo‘q');
  });

  testWidgets('musiqa BOR bo‘lsa belgi chiziladi', (tester) async {
    await tester.pumpWidget(ProviderScope(
      child: wrapScreen(
        const Center(
          child: MusicControl(urls: ['https://nfcstore.uz/uploads/a.mp3'], size: 34),
        ),
        tokens: NfcTokens.ivory,
      ),
    ));
    await tester.pump();
    // Ekvalayzer belgisi (to'xtaganda jim ustunlar).
    expect(find.byKey(const ValueKey('music-eq')), findsOneWidget);
  });

  testWidgets('musiqa YO‘Q bo‘lsa hech narsa chizilmaydi', (tester) async {
    await tester.pumpWidget(ProviderScope(
      child: wrapScreen(
        const Center(child: MusicControl(urls: [], size: 34)),
        tokens: NfcTokens.ivory,
      ),
    ));
    await tester.pump();
    expect(find.byKey(const ValueKey('music-eq')), findsNothing);
  });
}
