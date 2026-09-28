import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/features/nfc/nfc_misc_screens.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

/// VAQT TELEFON SOATIDA (egasi, 2026-09-28: "soatlarini bizning soatga
/// moslab ol, +5 Toshkent"). Server UTC (`...Z`) beradi.
void main() {
  final L l = LUz();
  final now = DateTime.utc(2026, 9, 28, 12);

  test('nisbiy vaqt o‘zbekcha — "Yuklanmoqda" emas', () {
    expect(relativeTime(now.subtract(const Duration(seconds: 20)), l, now: now),
        'Hozirgina');
    expect(relativeTime(now.subtract(const Duration(minutes: 7)), l, now: now),
        '7 daqiqa oldin');
    expect(relativeTime(now.subtract(const Duration(hours: 3)), l, now: now),
        '3 soat oldin');
  });

  test('sana mahalliy vaqtda (Toshkentda tun 02:30 — o‘sha kun)', () {
    // 27-sentabr 21:30 UTC = Toshkentda 28-sentabr 02:30.
    final at = DateTime.utc(2026, 9, 27, 21, 30);
    final local = at.toLocal();
    final want = '${local.day.toString().padLeft(2, '0')}.'
        '${local.month.toString().padLeft(2, '0')}.${local.year}';
    expect(relativeTime(at, l, now: DateTime.utc(2026, 10, 5)), want);
    if (DateTime.now().timeZoneOffset == const Duration(hours: 5)) {
      expect(want, '28.09.2026');
    }
  });
}
