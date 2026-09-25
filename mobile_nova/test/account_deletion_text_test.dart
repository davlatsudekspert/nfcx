import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations.dart';

/// Hisobni o'chirish (egasi, 2026-09-25): 30 kundan keyin butunlay
/// o'chadi. O'chirish navbatidagi hisob bilan kirishda server
/// `purgeAfter` beradi — ilova sanani va bekor qilish yo'lini aytadi.
void main() {
  test('account_deleted + purgeAfter — sana va bekor qilish manzili', () async {
    final l = await L.delegate.load(const Locale('uz'));
    final msg = describeError(
      l,
      const AppError(AppErrorKind.forbidden,
          code: 'account_deleted', detail: '2026-10-25T10:00:00.000Z', status: 403),
    );
    expect(msg, contains('25.10.2026'));
    expect(msg, contains('davlatsudekspert@gmail.com'));
  });

  test('sana kelmasa (eski server) — umumiy matn', () async {
    final l = await L.delegate.load(const Locale('uz'));
    final msg = describeError(
      l,
      const AppError(AppErrorKind.forbidden, code: 'account_deleted', status: 403),
    );
    expect(msg, l.errAccountDeleted);
  });

  test('o‘chirish matnlari 30 kunni aytadi (uz/ru/en)', () async {
    for (final code in ['uz', 'ru', 'en']) {
      final l = await L.delegate.load(Locale(code));
      expect(l.settingsDeleteConfirm, contains('30'), reason: code);
      expect(l.deleteAccountWhat, contains('30'), reason: code);
      expect(l.deleteAccountDone, contains('30'), reason: code);
    }
  });
}
