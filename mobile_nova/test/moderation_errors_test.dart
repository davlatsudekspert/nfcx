import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_en.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_ru.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

/// Shartnoma §2 — yangi xato kodlari uch tilda.
void main() {
  const video = AppError(AppErrorKind.forbidden,
      code: 'video_uploads_disabled', status: 403);
  const moderation = AppError(AppErrorKind.server,
      code: 'moderation_unavailable', status: 503);

  test('o‘zbekcha — shartnomadagi matn', () {
    final l = LUz();
    expect(describeError(l, video),
        'Video yuklash vaqtincha o‘chirilgan. Rasm yuklashingiz mumkin.');
    expect(describeError(l, moderation),
        'Tekshiruv vaqtincha ishlamayapti. Birozdan keyin qayta urinib ko‘ring.');
  });

  test('ruscha va inglizcha — o‘z tarjimasi, umumiy xato emas', () {
    for (final l in [LRu(), LEn()]) {
      expect(describeError(l, video), l.errVideoUploadsDisabled);
      expect(describeError(l, video), isNot(l.errForbidden));
      expect(describeError(l, moderation), l.errModerationUnavailable);
      expect(describeError(l, moderation), isNot(l.errServer));
    }
    expect(LRu().errVideoUploadsDisabled, isNot(LUz().errVideoUploadsDisabled));
    expect(LEn().errModerationUnavailable,
        isNot(LUz().errModerationUnavailable));
  });
}
