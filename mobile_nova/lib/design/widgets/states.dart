import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/errors/app_error.dart';
import '../../core/utils/external_link.dart';
import '../../l10n/gen/app_localizations.dart';
import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'buttons.dart';
import 'surfaces.dart';
import 'brand_icon.dart';

/// Xato KALITINI joriy tildagi jumlaga aylantiradi.
///
/// Server kalitiga aniq javob bo'lsa o'sha ishlatiladi; bo'lmasa xato
/// TURIGA qarab umumiy jumla beriladi. Shu tartib tufayli backend yangi
/// kalit qo'shsa ham ilovada "bo'sh xato" chiqmaydi.
String describeError(L l, AppError e) => switch (e.code) {
      'bad_credentials' => l.errBadCredentials,
      'CANNOT_FOLLOW_SELF' => l.errFollowSelf,
      // Katalog / post / ko'tarish limiti — server `limit` beradi.
      'limit_reached' => switch (e.data?['limit']) {
          final num n => l.errLimitReachedN(n.toInt()),
          _ => l.errLimitReached,
        },
      'bad_promotion_price' => l.errPromotionPrice,
      'demo_business' => l.errDemoBusiness,
      'required_fields' => l.errRequiredFields,
      // Parolni almashtirish: JORIY parol xato (401, sessiya joyida).
      'bad_current_password' => l.errBadCurrentPassword,
      'email_taken' => l.errEmailTaken,
      // Telefon boshqa akkauntda. Ilgari kalit tanilmasdi va umumiy
      // "Bu ma'lumot allaqachon band" chiqardi — odam NIMA band
      // ekanini bilmasdi (egasi, 2026-09 surat).
      'phone_taken' => l.errPhoneTaken,
      'bad_email' => l.errBadEmail,
      // Server raqam uzunligini davlat bo'yicha tekshiradi
      // (hosting/api/contact-check.js): yetmasa — `phone_short`.
      'bad_phone' => e.detail == 'phone_short' ? l.errPhoneShort : l.errBadPhone,
      'email_typo' => l.errEmailTypo(e.detail ?? ''),
      'email_domain_invalid' => l.errEmailDomain,
      'bad_code' || 'bad_email_code' => l.verifyWrongCode,
      'unauthorized' => l.errUnauthorized,
      // Email xizmati kodni yubora olmadi (server 503). Ilgari
      // "Serverda xatolik" chiqardi — odam nima qilishni bilmasdi.
      // Sabab kodi (`http_403`, `http_429`...) oxirida qavsda — egasi
      // xatoni ko'rib, sababini darhol biladi (kalit, domen, limit).
      'email_send_failed' => (e.detail ?? '').isEmpty
          ? l.errEmailSendFailed
          : '${l.errEmailSendFailed} (${e.detail})',
      'name_not_allowed' => l.errNameNotAllowed,
      // Moderatsiya: admin hisobni vaqtincha bloklagan (serverdagi
      // `bannedUntil`). Umumiy "ruxsat yo'q" emas — sabab aytiladi.
      'BANNED' || 'banned' || 'account_suspended' => l.errBanned,
      // Hisob o'chirilgan (kirish — 403) yoki o'chirish navbatida (shu
      // email bilan qayta ro'yxat — 409). Ilgari "Ruxsat yo'q" va
      // "Bu ma'lumot allaqachon band" chiqardi.
      // Hisob o'chirish navbatida bo'lsa (parol to'g'ri) server butunlay
      // o'chirish sanasini beradi — odamga sana va bekor qilish yo'li aytiladi.
      'account_deleted' => _pendingDeletion(l, e.detail),
      'account_pending_deletion' => l.errAccountDeleted,
      // POST, ISTORIYA, REELS VA IZOH — HAMMAGA BEPUL (egasining
      // qarori, 2026-10-04). Ilova bu imkoniyatlarni hech kimdan
      // yopmaydi. Server eski qoidasi bilan hali `premium_required`
      // (izoh), `feature_locked` (post/video/istoriya) yoki
      // `plan_locked` (biznes post) qaytarsa — NEYTRAL xato: Premium,
      // daraja, tarif yoki "saytdan oling" degan so'z YO'Q. Aks holda
      // iPhone'da IAP'siz pullik qulf ko'rinardi (Apple 3.1.1).
      'premium_required' ||
      'feature_locked' ||
      'plan_locked' =>
        l.errPublishUnavailable,
      'rules_not_accepted' => l.rulesNotAccepted,
      // Video yuklash serverda vaqtincha yopiq (kalit
      // `videoUploadsBlocked`, 403) — odamga rasm yo'li aytiladi.
      'video_uploads_disabled' => l.errVideoUploadsDisabled,
      // Avtomatik tekshiruv navbatga yozilmadi (503) — fayl saqlanmadi.
      'moderation_unavailable' => l.errModerationUnavailable,
      // "(sayt orqali)" degan xarid ishorasi YO'Q — iPhone'da (Apple
      // 3.1.1) ham, Android'da ham (Google Play to'lov qoidasi,
      // 2026-10-08): `shop/store_policy.dart` dagi
      // `showDigitalSiteHints` izohi. Neytral matn ikkala platformada.
      'plan_limit_reached' => l.errPlanLimitIos,
      // Server 413 yoki ilovaning oldindan tekshiruvi (100 MB).
      'too_large' => l.errFileTooLarge,
      // AVTOMATIK FILTR rasm yoki videoni rad etdi — SABAB aytiladi, aks holda
      // odam "nega yuklanmayapti" deb o'ylaydi.
      'content_blocked' => l.errContentBlocked(switch (e.detail) {
          'violence' => l.blockViolence,
          'extremism' => l.blockExtremism,
          'political' => l.blockPolitical,
          'drugs' => l.blockDrugs,
          'hate' => l.blockHate,
          _ => l.blockSexual,
        }),
      _ => switch (e.kind) {
          AppErrorKind.offline => l.errOffline,
          AppErrorKind.timeout => l.errTimeout,
          AppErrorKind.server => l.errServer,
          AppErrorKind.unauthorized => l.errUnauthorized,
          AppErrorKind.forbidden => l.errForbidden,
          AppErrorKind.notFound => l.errNotFound,
          AppErrorKind.conflict => l.errConflict,
          AppErrorKind.validation => l.errUnknown,
          AppErrorKind.rateLimited => l.errRateLimited,
          AppErrorKind.endpointMissing => l.errEndpointMissing,
          AppErrorKind.unknown => l.errUnknown,
        },
    };

/// `FutureProvider` ushlagan istisnoni `AppError` ga keltiradi.
///
/// Repository'lar `AppError` otadi, lekin `AsyncValue.error` har qanday
/// obyektni bera oladi (masalan `TypeError`). Bu yordamchi ikkala holatni
/// ham bitta ko'rinishga keltiradi, shuning uchun ekranlarda `is` bilan
/// tekshirish takrorlanmaydi.
AppError asAppError(Object e) =>
    e is AppError ? e : AppError(AppErrorKind.unknown, detail: '$e');

/// Bo'sh / xato / oflayn — hammasi bitta kompozitsiya.
class StatePanel extends StatelessWidget {
  const StatePanel({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    this.technical,
    this.tone,
    this.onDark = false,
  });

  /// Xatodan to'g'ridan-to'g'ri panel yasaydi — har ekranda `switch`
  /// yozib o'tirmaslik uchun.
  factory StatePanel.fromError(
    BuildContext context,
    AppError e, {
    VoidCallback? onRetry,
    bool onDark = false,
  }) {
    final l = L.of(context);
    return StatePanel(
      icon: switch (e.kind) {
        AppErrorKind.offline => Icons.wifi_off_rounded,
        AppErrorKind.timeout => Icons.schedule_rounded,
        AppErrorKind.unauthorized => Icons.lock_outline_rounded,
        AppErrorKind.endpointMissing => Icons.construction_rounded,
        _ => Icons.error_outline_rounded,
      },
      title: e.kind == AppErrorKind.offline
          ? l.stateOfflineTitle
          : l.stateErrorTitle,
      message: describeError(l, e),
      actionLabel: onRetry == null ? null : l.actionRetry,
      onAction: onRetry,
      // Texnik qator faqat tuzatuvchi uchun: usiz "xatolik yuz berdi"
      // dan boshqa hech narsa bilinmasdi.
      technical: e.technical,
      onDark: onDark,
    );
  }

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final String? technical;
  final Color? tone;

  /// Panel QORA fonda (Reels, istorya) turibdi. Mavzu ranglari (Ivory:
  /// deyarli qora matn) u yerda ko'rinmasdi — sarlavha ~1.2:1.
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final accent = tone ?? (onDark ? Colors.white : t.accent2);
    final tt = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 34, vertical: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(
              excludeSemantics: true,
              child: Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: .10),
                  shape: BoxShape.circle,
                ),
                child: BrandAwareIcon(icon, size: 30, color: accent),
              ),
            ),
            const SizedBox(height: Gap.xl),
            Text(
              title,
              textAlign: TextAlign.center,
              style: onDark
                  ? tt.titleLarge?.copyWith(color: Colors.white)
                  : tt.titleLarge,
            ),
            if (message != null) ...[
              const SizedBox(height: Gap.sm),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: onDark
                    ? tt.bodyMedium?.copyWith(color: Colors.white70)
                    : tt.bodyMedium,
              ),
            ],
            if (actionLabel != null) ...[
              const SizedBox(height: Gap.xxl),
              NovaButton(
                label: actionLabel!,
                onPressed: onAction,
                tone: ButtonTone.quiet,
                expand: false,
              ),
            ],
            // TEXNIK QATOR ("unknown · HTTP 400") ODDIY ODAMGA
            // KO'RSATILMAYDI — u professional ko'rinmaydi va hech narsa
            // tushuntirmaydi. Sinov (debug/profile) nusxasida ochiq;
            // chiqarilgan ilovada belgini UZOQ bosganda chiqadi va
            // buferga ko'chadi (qo'llab-quvvatlashga yuborish uchun).
            if (technical != null) _Technical(text: technical!),
          ],
        ),
      ),
    );
  }
}

/// Yuklanish skeleti — kontent kelguncha shakl joyida turadi, shuning
/// uchun kelganda maket sakramaydi.
class Skeleton extends StatefulWidget {
  const Skeleton({
    super.key,
    this.width,
    this.height = 14,
    this.radius = R.tile,
    this.circle = false,
  });

  final double? width;
  final double height;
  final BorderRadius radius;
  final bool circle;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1250),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final still = reduceMotion(context);
    return SizedBox(
      width: widget.circle ? widget.height : widget.width,
      height: widget.height,
      child: still
          ? _box(t, .5)
          : AnimatedBuilder(
              animation: _c,
              builder: (_, __) => _box(t, _c.value),
            ),
    );
  }

  Widget _box(NfcTokens t, double p) => DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: widget.circle ? null : widget.radius,
          shape: widget.circle ? BoxShape.circle : BoxShape.rectangle,
          gradient: LinearGradient(
            // Yorug'lik chapdan o'ngga o'tadi.
            begin: Alignment(-1 + p * 2.4, 0),
            end: Alignment(-.4 + p * 2.4, 0),
            colors: [t.surface2, t.border2, t.surface2],
          ),
        ),
      );
}

/// Ro'yxat uchun tayyor skelet — takrorlanuvchi karta shakli.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 5, this.height = 84});

  final int count;
  final double height;

  @override
  Widget build(BuildContext context) => ListView.separated(
        // SKELET O'ZI SCROLL QILMAYDI.
        //
        // Bu ro'yxat ko'pincha BOSHQA scroll ichida turadi:
        // `CommentsSection` ning yuklanish holati `NovaScroll`
        // (u ham `ListView`) ichida chiziladi. `shrinkWrap`siz
        // ListView u yerda "Vertical viewport was given unbounded
        // height" xatosini berardi va izohlar yuklanayotgan payt
        // ekran buzilardi.
        //
        // Skelet — vaqtinchalik o'rin egallovchi, unga alohida
        // scroll kerak emas.
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(Gap.screenX),
        itemCount: count,
        separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
        itemBuilder: (_, __) => FloatingSurface(
          solid: true,
          padding: const EdgeInsets.all(Gap.lg),
          child: Row(
            children: [
              Skeleton(height: height * .55, circle: true),
              const SizedBox(width: Gap.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Skeleton(width: 140, height: 13),
                    const SizedBox(height: Gap.sm),
                    Skeleton(width: 90, height: 11),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}

class _Technical extends StatefulWidget {
  const _Technical({required this.text});
  final String text;

  @override
  State<_Technical> createState() => _TechnicalState();
}

class _TechnicalState extends State<_Technical> {
  bool _shown = !kReleaseMode;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onLongPress: () {
        setState(() => _shown = true);
        // Himoyalangan nusxa: kanal javob bermasa ham qotmaydi.
        copyToClipboard(widget.text);
      },
      child: Padding(
        padding: const EdgeInsets.only(top: Gap.lg),
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 200),
          opacity: _shown ? 1 : 0,
          child: Text(
            widget.text,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'IBMPlexMono',
              fontSize: 10.5,
              color: t.text3,
            ),
          ),
        ),
      ),
    );
  }
}

/// O'chirish navbatidagi hisob: "{sana} kuni butunlay o'chiriladi".
/// Sana kelmasa (eski server) — umumiy matn.
const _deletionContact = 'davlatsudekspert@gmail.com';
String _pendingDeletion(L l, String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso);
  if (d == null) return l.errAccountDeleted;
  final x = d.toLocal();
  String two(int v) => v.toString().padLeft(2, '0');
  return l.authAccountPendingDeletion('${two(x.day)}.${two(x.month)}.${x.year}', _deletionContact);
}
