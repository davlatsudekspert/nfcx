import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';
import 'buttons.dart';

/// BO'SH holat — bitta oddiy qator va uni to'ldiradigan BITTA amal.
///
/// Rasm ham, illyustratsiya ham yo'q: handoff buni ataylab taqiqlaydi.
/// Bo'sh ekranga chizilgan odam qo'shish uni to'ldirmaydi, faqat
/// e'tiborni kerakli tugmadan chalg'itadi.
class EmptyState extends StatelessWidget {
  const EmptyState(this.message, {super.key, this.actionLabel, this.onAction});

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter, vertical: S.x32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center, style: T.body),
            if (actionLabel != null) ...[
              const SizedBox(height: S.x20),
              SizedBox(width: 220, child: SecondaryButton(actionLabel!, onTap: onAction)),
            ],
          ],
        ),
      );
}

/// XATO holati — NIMA buzilgani SO'Z BILAN, keyin "Qayta urinish".
///
/// Ekranga HECH QACHON xato kodi chiqarilmaydi ("500", "http_400"):
/// odam u bilan nima qilishini bilmaydi. Kod faqat jurnal uchun.
class ErrorState extends StatelessWidget {
  const ErrorState(this.message, {super.key, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter, vertical: S.x32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center,
                style: T.body.copyWith(color: C.offWhite)),
            if (onRetry != null) ...[
              const SizedBox(height: S.x20),
              SizedBox(width: 200, child: GhostButton('Qayta urinish', onTap: onRetry)),
            ],
          ],
        ),
      );
}

/// OFFLINE — ingichka doimiy chiziq ekran tepasida.
///
/// Modal oyna EMAS: keshlangan tarkib o'qilishi kerak, odam esa
/// ma'lumot eski ekanini bilib tursin.
class OfflineBar extends StatelessWidget {
  const OfflineBar({super.key, this.text = 'Internet aloqasi yo‘q'});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: S.x12),
        color: C.signal.withValues(alpha: .16),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: T.caption.copyWith(color: C.signal, fontWeight: FontWeight.w600),
        ),
      );
}

/// Yuklash / bo'sh / xato / tarkib — to'rttasini bitta joyda hal qiladi.
///
/// Har ekranda `if (loading) … else if (error) …` zanjirini qayta
/// yozish o'rniga shu widget ishlatiladi: holat mantiqi bitta joyda
/// turadi va biror ekran biror holatni unutib qoldirolmaydi.
class AsyncView<Tv> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.loading,
    required this.error,
    required this.data,
    required this.builder,
    required this.skeleton,
    this.emptyMessage,
    this.emptyAction,
    this.onEmptyAction,
    this.onRetry,
    this.isEmpty,
  });

  final bool loading;
  final Object? error;
  final Tv? data;
  final Widget Function(Tv data) builder;
  final Widget skeleton;
  final String? emptyMessage;
  final String? emptyAction;
  final VoidCallback? onEmptyAction;
  final VoidCallback? onRetry;
  final bool Function(Tv data)? isEmpty;

  @override
  Widget build(BuildContext context) {
    if (loading && data == null) return skeleton;
    if (error != null && data == null) {
      return ErrorState(humanError(error), onRetry: onRetry);
    }
    final d = data;
    if (d == null) return skeleton;
    if (emptyMessage != null && (isEmpty?.call(d) ?? false)) {
      return EmptyState(emptyMessage!, actionLabel: emptyAction, onAction: onEmptyAction);
    }
    return builder(d);
  }
}

/// Xatoni odam tilida yozish.
///
/// Backend `{error: 'bad_credentials'}` kabi KALIT qaytaradi — u
/// dasturchi uchun. Bu yer o'sha kalitni o'zbekcha jumlaga aylantiradi.
/// Noma'lum kalit ham xom holda chiqarilmaydi.
String humanError(Object? e) {
  final s = e?.toString() ?? '';
  const map = {
    'bad_credentials': 'Login yoki parol noto‘g‘ri.',
    'bad_login': 'Email yoki telefon raqamini tekshiring.',
    'too_many_requests': 'Juda ko‘p urinish. Bir necha daqiqadan so‘ng qayta urining.',
    'account_suspended': 'Hisob vaqtincha to‘xtatilgan.',
    'account_deleted': 'Bu hisob o‘chirilgan.',
    'email_taken': 'Bu email allaqachon ro‘yxatdan o‘tgan.',
    'email_required': 'Email kiriting.',
    'email_code_required': 'Emailga kelgan kodni kiriting.',
    'bad_email_code': 'Kod xato. Tekshirib, qaytadan kiriting.',
    'email_send_failed': 'Emailga kod yuborib bo‘lmadi. Birozdan so‘ng qayta urining.',
    'not_found': 'Topilmadi.',
    'forbidden': 'Bu amal uchun ruxsat yo‘q.',
    'orders_disabled': 'Bu biznes hozir buyurtma qabul qilmayapti.',
    'required_fields': 'Barcha majburiy maydonlarni to‘ldiring.',
    'offline': 'Internet aloqasi yo‘q. Ulanishni tekshiring.',
    'timeout': 'Server javob bermadi. Qayta urinib ko‘ring.',
  };
  for (final k in map.keys) {
    if (s.contains(k)) return map[k]!;
  }
  if (s.contains('SocketException') || s.contains('Failed host lookup')) {
    return map['offline']!;
  }
  return 'Nimadir noto‘g‘ri ketdi. Qayta urinib ko‘ring.';
}
