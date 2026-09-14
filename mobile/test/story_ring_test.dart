
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/design/components/media.dart';
import 'package:nfcstore/design/components/story_ring.dart';
import 'package:nfcstore/screens/identity/profile_screen.dart';
import 'audit/harness.dart';

/// ISTORYA HALQASI — profil avatarining atrofida.
///
/// NIMA UCHUN BU TEST BOR: qurilmada sinovda "halqa chizilmagan"
/// deb xabar berildi. Halqa aslida chizilardi, lekin 2.4px to'q
/// oltin chiziq muqova rasmi ustida oddiy avatar chegarasidan
/// farq qilmasdi. Qalinlik va rang o'zgartirildi — bu test esa
/// halqaning MANTIQIY yarmini qo'riqlaydi: istorya bor ekan,
/// avatar o'rniga halqa qo'yilishi shart.
void main() {
  testWidgets('istorya bor — avatar atrofida halqa turadi', (tester) async {
    mockImageCacheDir();
    await pumpScreen(tester, const ProfileScreen(code: 'AAA512'));

    final rings = tester.widgetList<StoryRing>(find.byType(StoryRing)).toList();
    expect(rings, hasLength(1));
    // "+" EMAS: istorya bor, ya'ni halqa aylanadigan holatda.
    expect(rings.single.addButton, isFalse);
    expect(rings.single.onTap, isNotNull);

    // Sarlavhada YAKKA avatar bo'lmasligi kerak — u halqa ichida.
    final headerAvatars = tester
        .widgetList<Avatar>(find.byType(Avatar))
        .where((a) => a.size == 72)
        .toList();
    expect(headerAvatars, isEmpty);
  });
}
