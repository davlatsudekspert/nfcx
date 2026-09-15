import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';

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
  const ErrorState(this.message, {super.key, this.onRetry, this.icon, this.detail});

  final String message;
  final VoidCallback? onRetry;
  final Ico? icon;

  /// TEXNIK QATOR — kalit, HTTP holati va javob boshi.
  ///
  /// Kirish ekranida bu allaqachon bor edi va aynan u kirish
  /// muammosini bir suratda hal qildi. Qolgan ekranlarda esa xato
  /// "Topilmadi." dan nariga o'tmasdi: qaysi manzil, qaysi kod —
  /// bilib bo'lmasdi.
  final String? detail;

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
            if (detail != null) ...[
              const SizedBox(height: 6),
              Text(
                detail!,
                textAlign: TextAlign.center,
                style: T.meta.copyWith(fontSize: 10.5, color: C.ink3),
              ),
            ],
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
      return ErrorState(
        humanError(error),
        detail: errorDetail(error),
        onRetry: onRetry,
      );
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
    'phone_required': tr('Telefon raqamini kiriting.'),
    'phone_taken': tr('Bu telefon raqami allaqachon band.'),
    // `bad_code` — server email kodi uchun ham, sovg'a/aktivatsiya
    // kodi uchun ham shu kalitni ishlatadi.
    'bad_code': tr('Kod xato. Tekshirib, qaytadan kiriting.'),
    'code_required': tr('Emailga kelgan kodni kiriting.'),
    // SESSIYA TUGAGAN. 401 bo'yicha ham shu jumla chiqadi, lekin
    // kalit boshqa status bilan ham kelishi mumkin.
    'unauthorized': tr('Sessiya tugagan. Qaytadan kiring.'),
    // BAZA YO'Q (`server/index.js`, 503). Bu "serverda xatolik"dan
    // farq qiladi: server ishlayapti, bazasiga ulana olmayapti.
    'db_unavailable': tr('Server ma’lumotlar bazasiga ulana olmadi. '
        'Birozdan so‘ng qayta urining.'),
    'not_found': tr('Topilmadi.'),
    'forbidden': tr('Bu amal uchun ruxsat yo‘q.'),
    'orders_disabled': tr('Bu biznes hozir buyurtma qabul qilmayapti.'),
    'required_fields': tr('Barcha majburiy maydonlarni to‘ldiring.'),
    'offline': tr('Internet aloqasi yo‘q. Ulanishni tekshiring.'),
    'timeout': tr('Server javob bermadi. Qayta urinib ko‘ring.'),
    // SERVER SESSIYA OCHMADI. Javob 200 keldi, lekin ichida token
    // yo'q — ilova esa faqat token bilan ishlaydi (cookie emas).
    'no_token': tr('Server sessiya ochmadi. Ilova yangilanishi kerak '
        'bo‘lishi mumkin.'),
    // SERTIFIKAT. "Internet yo'q" bilan adashtirmaslik kerak:
    // bu yerda tarmoq bor, lekin xavfsiz ulanish tuzilmadi.
    'tls': tr('Xavfsiz ulanish o‘rnatilmadi. Telefondagi sana-vaqtni '
        'va tarmoqni tekshiring.'),
  };
  for (final k in map.keys) {
    if (s.contains(k)) return map[k]!;
  }
  if (s.contains('SocketException') || s.contains('Failed host lookup')) {
    return map['offline']!;
  }

  // STATUS BO'YICHA — kalit tanilmasa ham javobning ma'nosi ma'lum.
  if (e is ApiError) {
    final byStatus = {
      401: tr('Sessiya tugagan. Qaytadan kiring.'),
      403: tr('So‘rov rad etildi. Tarmoq yoki himoya qatlami to‘sgan '
          'bo‘lishi mumkin.'),
      404: tr('Bunday manzil topilmadi.'),
      408: map['timeout']!,
      429: map['too_many_requests']!,
    }[e.status];
    if (byStatus != null) return byStatus;
    if (e.status >= 500) {
      return tr('Serverda xatolik. Birozdan so‘ng qayta urining.');
    }
  }

  final key = e is ApiError ? e.key : s.split('\n').first;

  // SERVER TAYYOR JUMLA YUBORGAN BO'LSA — O'SHANI KO'RSATAMIZ.
  //
  // `error` maydoni har doim ham mashina kaliti emas: worker va
  // Express ba'zi tekshiruvlarda to'g'ridan-to'g'ri o'zbekcha jumla
  // yuboradi ("Parol kamida 6 belgidan iborat bo'lishi kerak.").
  // Uni kalit deb hisoblab "Kutilmagan xato: Parol kamida 6 belgi..."
  // deb yozish — tayyor, aniq javobni buzib ko'rsatish bo'lardi.
  //
  // FARQNI SHAKL HAL QILADI: kalit — qisqa, `snake_case`, probelsiz.
  // Jumlada probel bor va u odatda katta harf bilan boshlanadi.
  if (_looksLikeSentence(key)) return key;

  // ENG OXIRGI HOLAT — AMMO KO'R HOLAT EMAS.
  //
  // Ilgari bu yerda faqat "Nimadir noto'g'ri ketdi" turardi va u
  // HAQIQIY SABABNI YASHIRARDI: qurilmada xato ko'rgan odam ham,
  // tuzatuvchi ham nima bo'lganini bilmasdi. Endi tanilmagan
  // kalitning o'zi qavs ichida yoziladi — u qisqa, lekin aniq.
  final short = key.length <= 40 ? key : '${key.substring(0, 37)}...';
  return trf('Kutilmagan xato: {code}', {'code': short});
}

/// Server yuborgan `error` — mashina kalitimi yoki tayyor jumlami?
///
/// Kalit: `bad_credentials`, `too_many_requests` — qisqa, probelsiz,
/// faqat kichik harf va pastki chiziq.
/// Jumla: "Parol kamida 6 belgidan iborat bo'lishi kerak." — probelli
/// va nuqta bilan tugaydi.
///
/// Chegara ATAYLAB qat'iy: shubhali holat kalit deb hisoblanadi va
/// "Kutilmagan xato: ..." bo'lib chiqadi. Teskarisi xavfliroq bo'lardi
/// — ichki kalit odamga jumla sifatida ko'rsatilib qolardi.
bool _looksLikeSentence(String v) {
  final t = v.trim();
  if (t.length < 8 || t.length > 160) return false;
  if (!t.contains(' ')) return false;
  // Bitta so'zli kalitlar probel tutmaydi; `snake_case` da esa probel
  // umuman bo'lmaydi. Demak probel bor bo'lsa — bu matn.
  return !RegExp(r'^[a-z0-9_]+$').hasMatch(t);
}

/// XATONING TEXNIK QATORI — ekranda kichik kulrang yozuv uchun.
///
/// Odamga mo'ljallangan jumla sababni AYTMAYDI (va aytmasligi ham
/// kerak). Lekin xatoni surat qilib yuborgan odam bilan tuzatuvchi
/// o'rtasida aynan shu qator ko'prik bo'ladi: kalit, status va
/// javobning boshi. Hech qanday shaxsiy ma'lumot yo'q.
String? errorDetail(Object? e) {
  if (e is ApiError) return e.technical;
  if (e == null) return null;
  final s = e.toString();
  if (s.isEmpty) return null;
  return s.length <= 120 ? s : '${s.substring(0, 117)}...';
}

