import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// AUDIO FOKUS — ovozli pleyerlar boshqa ilova ovozi bilan
/// aralashmaydi (`mixWithOthers: false`): Spotify/YouTube to'xtaydi,
/// ikki ovoz ustma-ust chiqmaydi.
void main() {
  test('Reels pleyerlari mixWithOthers: false', () {
    final src = File('lib/features/social/reels_screen.dart').readAsStringSync();
    expect(src, isNot(contains('mixWithOthers: true')));
    expect('mixWithOthers: false'.allMatches(src).length, 2,
        reason: 'video va musiqa kontrollerlari');
  });
}
