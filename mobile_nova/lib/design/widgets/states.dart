import 'package:flutter/material.dart';

import '../../core/errors/app_error.dart';
import '../../l10n/gen/app_localizations.dart';
import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'buttons.dart';
import 'surfaces.dart';

/// Xato KALITINI joriy tildagi jumlaga aylantiradi.
///
/// Server kalitiga aniq javob bo'lsa o'sha ishlatiladi; bo'lmasa xato
/// TURIGA qarab umumiy jumla beriladi. Shu tartib tufayli backend yangi
/// kalit qo'shsa ham ilovada "bo'sh xato" chiqmaydi.
String describeError(L l, AppError e) => switch (e.code) {
      'bad_credentials' => l.errBadCredentials,
      'email_taken' => l.errEmailTaken,
      'bad_email' => l.errBadEmail,
      'bad_phone' => l.errBadPhone,
      'bad_code' || 'bad_email_code' => l.verifyWrongCode,
      'unauthorized' => l.errUnauthorized,
      // Email xizmati kodni yubora olmadi (server 503). Ilgari
      // "Serverda xatolik" chiqardi — odam nima qilishni bilmasdi.
      'email_send_failed' => l.errEmailSendFailed,
      'name_not_allowed' => l.errNameNotAllowed,
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
  });

  /// Xatodan to'g'ridan-to'g'ri panel yasaydi — har ekranda `switch`
  /// yozib o'tirmaslik uchun.
  factory StatePanel.fromError(
    BuildContext context,
    AppError e, {
    VoidCallback? onRetry,
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
    );
  }

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final String? technical;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final accent = tone ?? t.accent2;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 34, vertical: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: .12),
                shape: BoxShape.circle,
                border: Border.all(color: accent.withValues(alpha: .3)),
              ),
              child: Icon(icon, size: 31, color: accent),
            ),
            const SizedBox(height: Gap.xl),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (message != null) ...[
              const SizedBox(height: Gap.sm),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
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
            if (technical != null) ...[
              const SizedBox(height: Gap.lg),
              Text(
                technical!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'IBMPlexMono',
                  fontSize: 10.5,
                  color: t.text3,
                ),
              ),
            ],
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
