import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

/// O'CHIRILGAN HISOB — ANIQ SABAB (release auditi).
///
/// Server o'chirilgan hisobga kirishda 403 `account_deleted`, o'chirish
/// navbatidagi email bilan qayta ro'yxatda 409 `account_pending_deletion`
/// qaytaradi. Ilgari ilova "Ruxsat yo'q" / "Bu ma'lumot allaqachon band"
/// derdi — odam nima bo'lganini bilmasdi.
void main() {
  for (final l in [LUz(), LRu(), LEn()]) {
    test('${l.localeName}: account_deleted va account_pending_deletion', () {
      expect(
        describeError(
            l, const AppError(AppErrorKind.forbidden, code: 'account_deleted')),
        l.errAccountDeleted,
      );
      expect(
        describeError(l,
            const AppError(AppErrorKind.conflict, code: 'account_pending_deletion')),
        l.errAccountDeleted,
      );
      expect(l.errAccountDeleted, isNot(l.errForbidden));
      expect(l.errAccountDeleted, isNot(l.errConflict));
    });
  }
}
