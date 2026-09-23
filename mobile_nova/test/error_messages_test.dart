import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/design/widgets/states.dart';
import 'package:nfcstore_nova/l10n/gen/app_localizations_uz.dart';

/// Ro'yxatdan o'tish va biznes ochishdagi xabarlar ODAMGA nima qilishni
/// aytishi kerak — "serverda xatolik" emas.
void main() {
  final l = LUz();

  test('email yuborilmasa — aniq xabar, umumiy server xatosi emas', () {
    const e = AppError(AppErrorKind.server,
        code: 'email_send_failed', status: 503);
    expect(describeError(l, e), l.errEmailSendFailed);
    expect(describeError(l, e), isNot(l.errServer));
  });

  test('timeout xabari tarmoqni tekshirishni maslahat beradi', () {
    // Qurilmada: "Server javob bermadi" chiqdi, sabab esa Wi-Fi edi —
    // mobil internetda hammasi ishladi.
    const e = AppError(AppErrorKind.timeout);
    expect(describeError(l, e), contains('Wi-Fi'));
  });

  test('taqiqlangan biznes nomi — tushunarli xabar', () {
    const e = AppError(AppErrorKind.validation,
        code: 'name_not_allowed', status: 422);
    expect(describeError(l, e), l.errNameNotAllowed);
  });
}
