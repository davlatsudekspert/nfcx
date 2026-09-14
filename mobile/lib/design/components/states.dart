import 'package:flutter/widgets.dart';

import '../../l10n/strings.dart';
import '../tokens.dart';
import '../type.dart';
import 'buttons.dart';
import 'icons.dart';

/// HOLATLAR — yuklanish · bo'sh · xato · offline.
///
/// DIZAYN QOIDASI (6d): "Har bo'sh holatda bitta aniq keyingi
/// harakat bor — hech biri boshi berk emas." Shuning uchun har
/// `EmptyState` da sarlavha, sabab va (egasi bo'lsa) BITTA amal
/// bo'ladi.
///
/// MEHMONDA AMAL YO'Q: begona profildagi "Post qo'shing" — bajarib
/// bo'lmaydigan taklif. Egalikni chaqiruvchi ekran hal qiladi.

class EmptyState extends StatelessWidget {
  const EmptyState(
    this.message, {
    super.key,
    this.title,
    this.icon,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  final String message;
  final String? title;
  final Ico? icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Ro'yxat ichida — kichikroq va kamroq masofa bilan.
  final bool compact;

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.symmetric(
          horizontal: S.gutter,
          vertical: compact ? S.x24 : S.x32,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              _Glyph(icon!, size: compact ? 58 : 76),
              SizedBox(height: compact ? S.x16 : S.x20),
            ],
            if (title != null) ...[
              Text(title!, textAlign: TextAlign.center, style: T.section),
              const SizedBox(height: S.x8),
            ],
            Text(
              message,
              textAlign: TextAlign.center,
              style: T.caption.copyWith(height: 1.55),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: S.x20),
              SecondaryButton(
                actionLabel!,
                size: BtnSize.m,
                expand: false,
                onTap: onAction,
              ),
            ],
          ],
        ),
      );
}

/// Bo'sh holat belgisi — ikki halqa ichidagi ikonka.
///
/// Rasm EMAS: dizayn bo'sh ekranga chizilgan odamni taqiqlaydi —
/// u ekranni to'ldirmaydi, faqat e'tiborni kerakli tugmadan
/// chalg'itadi. Belgi esa dizayn tilining bir qismi.
class _Glyph extends StatelessWidget {
  const _Glyph(this.icon, {this.size = 76});

  final Ico icon;
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: C.line),
              ),
              child: const SizedBox.expand(),
            ),
            Container(
              width: size * .72,
              height: size * .72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: C.raisedSurface,
                border: Border.all(color: C.line),
                boxShadow: C.e1,
              ),
            ),
            NIcon(icon, size: size * .3, color: C.accent),
          ],
        ),
      );
}

/// XATO holati — nima buzilgani so'z bilan, keyin "Qayta urinish".
///
/// Ekranga HECH QACHON xato kodi chiqarilmaydi ("500", "http_400"):
/// odam u bilan nima qilishini bilmaydi.
class ErrorState extends StatelessWidget {
  const ErrorState(this.message, {super.key, this.onRetry, this.icon});

  final String message;
  final VoidCallback? onRetry;
  final Ico? icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: S.gutter,
          vertical: S.x32,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Glyph(icon ?? Ico.warning),
            const SizedBox(height: S.x20),
            Text(
              message,
              textAlign: TextAlign.center,
              style: T.bodyStrong.copyWith(fontSize: 14.5),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: S.x20),
              GhostButton(
                tr('Qayta urinish'),
                icon: Ico.refresh,
                onTap: onRetry,
              ),
            ],
          ],
        ),
      );
}

/// OFFLINE — ekran tepasidagi ingichka chiziq.
///
/// Modal oyna EMAS: keshlangan tarkib o'qilishi kerak, odam esa
/// ma'lumot eski ekanini bilib tursin.
class OfflineBar extends StatelessWidget {
  const OfflineBar({super.key, this.text});

  final String? text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 7, horizontal: S.x12),
        color: C.fail.withValues(alpha: .16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            NIcon(Ico.ban, size: 13, color: C.fail),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                text ?? tr('Internet aloqasi yo‘q'),
                style: T.caption.copyWith(
                  color: C.fail,
                  fontWeight: FontWeight.w600,
                  fontSize: 12.5,
                ),
              ),
            ),
          ],
        ),
      );
}

/// Yuklash / bo'sh / xato / tarkib — to'rttasini bitta joyda hal
/// qiladi.
///
/// Har ekranda `if (loading) … else if (error) …` zanjirini qayta
/// yozish o'rniga shu widget ishlatiladi: holat mantiqi bitta joyda
/// turadi va biror ekran biror holatni unutib qoldirolmaydi.
///
/// MUHIM: `data != null` bo'lsa, yuklanish va xato KONTENTNI
/// ALMASHTIRMAYDI. Ya'ni keshdagi eski lenta ekranda qoladi va
/// yangilanish fonda ketadi — "tez ochilish" qoidasi shundan.
class AsyncView<Tv> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.loading,
    required this.error,
    required this.data,
    required this.builder,
    required this.skeleton,
    this.emptyMessage,
    this.emptyTitle,
    this.emptyIcon,
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
  final String? emptyTitle;
  final Ico? emptyIcon;
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
      return EmptyState(
        emptyMessage!,
        title: emptyTitle,
        icon: emptyIcon,
        actionLabel: emptyAction,
        onAction: onEmptyAction,
      );
    }
    return builder(d);
  }
}

/// Xatoni odam tilida yozish.
///
/// Backend `{error: 'bad_credentials'}` kabi KALIT qaytaradi — u
/// dasturchi uchun. Bu yer o'sha kalitni o'zbekcha jumlaga
/// aylantiradi. Noma'lum kalit ham xom holda chiqarilmaydi.
String humanError(Object? e) {
  final s = e?.toString() ?? '';
  // TILGA BOG'LIQ, ya'ni `const` bo'la olmaydi: jadval har
  // chaqiruvda joriy tilda quriladi.
  final map = {
    'bad_credentials': tr('Login yoki parol noto‘g‘ri.'),
    'bad_login': tr('Email yoki telefon raqamini tekshiring.'),
    'too_many_requests':
        tr('Juda ko‘p urinish. Bir necha daqiqadan so‘ng qayta urining.'),
    'account_suspended': tr('Hisob vaqtincha to‘xtatilgan.'),
    'account_deleted': tr('Bu hisob o‘chirilgan.'),
    'email_taken': tr('Bu email allaqachon ro‘yxatdan o‘tgan.'),
    'email_required': tr('Email kiriting.'),
    'email_code_required': tr('Emailga kelgan kodni kiriting.'),
    'bad_email_code': tr('Kod xato. Tekshirib, qaytadan kiriting.'),
    'email_send_failed':
        tr('Emailga kod yuborib bo‘lmadi. Birozdan so‘ng qayta urining.'),
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
