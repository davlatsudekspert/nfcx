import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';
import 'buttons.dart';
import 'icons.dart';
import '../../l10n/strings.dart';

/// BO'SH holat — belgi, sarlavha, izoh va (kerak bo'lsa) BITTA amal.
///
/// NIMA UCHUN QAYTA YOZILDI: avval bu faqat bitta qator matn edi
/// ("Hali post yo'q"). Auditda ko'rindiki, yangi foydalanuvchi
/// ilovaning yarmida shunday quruq qatorlarni ko'radi va KEYINGI
/// QADAM nima ekani hech qayerda aytilmaydi.
///
/// RASM YO'Q va bo'lmaydi: handoff buni ataylab taqiqlaydi va
/// to'g'ri qiladi — bo'sh ekranga chizilgan odam uni to'ldirmaydi,
/// faqat e'tiborni kerakli tugmadan chalg'itadi. Buning o'rniga
/// dizayn tilidagi CHIZILGAN belgi ishlatiladi: u tarkibning bir
/// qismi, bezak emas.
///
/// MEHMONDA CTA BO'LMAYDI: begona profildagi "Post qo'shing" —
/// bajarib bo'lmaydigan taklif. Shuning uchun `onAction` ixtiyoriy
/// va chaqiruvchi joy EGALIKNI o'zi hal qiladi.
class EmptyState extends StatelessWidget {
  const EmptyState(
    this.message, {
    super.key,
    this.title,
    this.icon,
    this.actionLabel,
    this.onAction,
  });

  /// Foydali izoh — nima uchun bo'sh va nima qilish mumkin.
  final String message;

  /// Qisqa sarlavha. Berilmasa faqat izoh chiqadi (eski xulq).
  final String? title;

  /// Dizayn tilidagi chizilgan belgi.
  final Ico? icon;

  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter, vertical: S.x32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              _Glyph(icon!),
              const SizedBox(height: S.x20),
            ],
            if (title != null) ...[
              Text(title!, textAlign: TextAlign.center, style: T.section),
              const SizedBox(height: S.x8),
            ],
            Text(
              message,
              textAlign: TextAlign.center,
              style: title == null ? T.body : T.caption,
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: S.x20),
              SizedBox(width: 220, child: SecondaryButton(actionLabel!, onTap: onAction)),
            ],
          ],
        ),
      );
}

/// Bo'sh holat belgisi — ikki halqa ichidagi ikonka.
///
/// Halqalar CHIZIQ bilan: to'ldirilgan shakl qorong'i fonda "dog'"
/// bo'lib qolardi va e'tiborni matndan tortib olardi.
class _Glyph extends StatelessWidget {
  const _Glyph(this.icon);
  final Ico icon;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 72,
        height: 72,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: C.hairline),
              ),
            ),
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: C.slate.withValues(alpha: .55),
                border: Border.all(color: C.warmHairline),
              ),
            ),
            NIcon(icon, size: 22, color: C.antiqueGold),
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
        padding: EdgeInsets.symmetric(horizontal: S.gutter, vertical: S.x32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center,
                style: T.body.copyWith(color: C.offWhite)),
            if (onRetry != null) ...[
              SizedBox(height: S.x20),
              SizedBox(width: 200, child: GhostButton(tr('Qayta urinish'), onTap: onRetry)),
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
  // Standart qiymat TILGA BOG'LIQ — `const` bo'la olmaydi.
  // `null` -> build ichida joriy tilda olinadi.
  const OfflineBar({super.key, this.text});
  final String? text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: S.x12),
        color: C.signal.withValues(alpha: .16),
        child: Text(
          text ?? tr('Internet aloqasi yo‘q'),
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
  // TILGA BOG'LIQ, ya'ni `const` bo'la olmaydi: jadval har
  // chaqiruvda joriy tilda quriladi.
  final map = {
    'bad_credentials': tr('Login yoki parol noto‘g‘ri.'),
    'bad_login': tr('Email yoki telefon raqamini tekshiring.'),
    'too_many_requests': tr('Juda ko‘p urinish. Bir necha daqiqadan so‘ng qayta urining.'),
    'account_suspended': tr('Hisob vaqtincha to‘xtatilgan.'),
    'account_deleted': tr('Bu hisob o‘chirilgan.'),
    'email_taken': tr('Bu email allaqachon ro‘yxatdan o‘tgan.'),
    'email_required': tr('Email kiriting.'),
    'email_code_required': tr('Emailga kelgan kodni kiriting.'),
    'bad_email_code': tr('Kod xato. Tekshirib, qaytadan kiriting.'),
    'email_send_failed': tr('Emailga kod yuborib bo‘lmadi. Birozdan so‘ng qayta urining.'),
    'not_found': tr('Topilmadi.'),
    'forbidden': tr('Bu amal uchun ruxsat yo‘q.'),
    'orders_disabled': tr('Bu biznes hozir buyurtma qabul qilmayapti.'),
    'required_fields': tr('Barcha majburiy maydonlarni to‘ldiring.'),
    'offline': tr('Internet aloqasi yo‘q. Ulanishni tekshiring.'),
    'timeout': tr('Server javob bermadi. Qayta urinib ko‘ring.'),
  };
  for (final k in map.keys) {
    if (s.contains(k)) return map[k]!;
  }
  if (s.contains('SocketException') || s.contains('Failed host lookup')) {
    return map['offline']!;
  }
  return tr('Nimadir noto‘g‘ri ketdi. Qayta urinib ko‘ring.');
}
