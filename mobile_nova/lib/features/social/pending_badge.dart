import 'package:flutter/material.dart';

import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../l10n/gen/app_localizations.dart';

/// "TEKSHIRUV KUTILMOQDA" — o'z postim, media hali avtomatik
/// tekshirilmagan (server `pending: true` faqat EGASIGA beradi;
/// boshqalar bu postni umuman ko'rmaydi).
///
/// [compact] — profil to'ri katakchasi: faqat belgi, yozuv ekran
/// o'quvchi uchun.
class PendingBadge extends StatelessWidget {
  const PendingBadge({super.key, this.compact = false, this.onDark = false});

  final bool compact;

  /// Qora fon (Ko'rgazma) ustida.
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final bg = onDark || compact
        ? Colors.black.withValues(alpha: .6)
        : t.warn.withValues(alpha: .14);
    final fg = onDark || compact ? Colors.white : t.warn;
    return Semantics(
      key: const ValueKey('pending-badge'),
      label: l.pendingReview,
      excludeSemantics: true,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: compact ? 5 : 8, vertical: 3),
        decoration: BoxDecoration(color: bg, borderRadius: R.pill),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.hourglass_top_rounded,
              size: compact ? 12 : 13,
              color: fg,
            ),
            if (!compact) ...[
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  l.pendingReview,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: fg,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
