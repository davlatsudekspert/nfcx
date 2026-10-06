import 'package:flutter/material.dart';

import '../../core/utils/external_link.dart';
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/contact_buttons.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';

/// BIZNES POSTI OSTIDAGI "BOG'LANISH" — Qo'ng'iroq, Telegram, Xarita.
///
/// Faqat KOMPANIYA POSTIDA (istoriya va shaxsiy post — hech qachon) va
/// server `contact` bergan bo'lsa ([PostContact]). Hech bir maydon
/// bo'lmasa qator UMUMAN chizilmaydi — bo'sh joy ham qolmaydi.
///
/// Ma'lumot postning o'zi bilan keladi (alohida so'rov yo'q), shuning
/// uchun yuklanish paytida qator "sakrab" paydo bo'lmaydi.
List<ContactAction> postContactActions(Post p) {
  final c = p.contact;
  if (!p.isCompany || p.isStory || c == null) return const [];
  return c.actions();
}

/// Kichik kapsulalar qatori.
///
/// [onDark] — Reels: video ustidagi qora shisha (musiqa va NFC ID
/// kapsulalari bilan bir xil). Aks holda — lentadagi oddiy chip
/// (`Capsule(dense)` uslubi: sirt, nozik hoshiya, yengil soya) —
/// Ivory va Noir mavzularida tokenlardan.
///
/// TOR EKRAN: yozuvlar "Позво…" bo'lib kesilmaydi. Kapsulalar o'z
/// enida turadi; hammasi qatorga SIG'MASA (360 px, ruscha, katta
/// shrift, Reels'ning tor chap ustuni) — uchalasi ham faqat belgi
/// bo'lib qoladi (nomi ekran o'quvchida va bosib turganda). Qator hech
/// qachon ekrandan chiqmaydi.
class PostContactBar extends StatelessWidget {
  const PostContactBar({super.key, required this.post, this.onDark = false});

  final Post post;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final actions = postContactActions(post);
    if (actions.isEmpty) return const SizedBox.shrink();
    final l = L.of(context);
    final style = _ContactPill.textStyle(onDark: onDark, color: Colors.white);
    final scaler = MediaQuery.textScalerOf(context);
    return Semantics(
      container: true,
      label: l.postContactLabel,
      child: LayoutBuilder(
        key: const ValueKey('post-contact'),
        builder: (context, box) {
          // Yozuvli kapsulalarning tabiiy eni. Har kapsula qatorda shu
          // NISBATDA joy oladi (`flex`) — "Карта" bo'shatgan joy uzun
          // "Позвонить" ga o'tadi, teng ulushda esa u kesilardi.
          final widths = <double>[];
          for (final a in actions) {
            final tp = TextPainter(
              text: TextSpan(text: contactKindLabel(l, a.kind), style: style),
              maxLines: 1,
              textDirection: Directionality.of(context),
              textScaler: scaler,
            )..layout();
            widths.add(_ContactPill.chrome(onDark: onDark) + tp.width);
            tp.dispose();
          }
          final need =
              widths.fold<double>(0, (a, b) => a + b) + (actions.length - 1) * _gap;
          // Zaxira: shrift/hoshiya yaxlitlashi — "deyarli sig'adi" holati
          // ham kesilgan yozuv emas, belgi bo'lib chiqadi.
          final compact = need * 1.04 + 4 > box.maxWidth;
          return Row(
            children: [
              for (var i = 0; i < actions.length; i++) ...[
                if (i > 0) const SizedBox(width: _gap),
                Flexible(
                  flex: compact ? 1 : widths[i].ceil(),
                  child: _ContactPill(
                      action: actions[i], onDark: onDark, compact: compact),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  static const _gap = 6.0;
}

class _ContactPill extends StatelessWidget {
  const _ContactPill({
    required this.action,
    required this.onDark,
    required this.compact,
  });

  final ContactAction action;
  final bool onDark;

  /// Faqat belgi (yozuv sig'madi).
  final bool compact;

  static EdgeInsets padding({required bool onDark}) => onDark
      ? const EdgeInsets.fromLTRB(9, 5, 11, 5)
      : const EdgeInsets.symmetric(horizontal: 10, vertical: 7);

  static double iconSize({required bool onDark}) => onDark ? 14 : 13;

  /// Kapsulaning yozuvdan tashqari eni: hoshiya, belgi, oraliq, chegara.
  static double chrome({required bool onDark}) =>
      padding(onDark: onDark).horizontal + iconSize(onDark: onDark) + 5 + 2;

  static TextStyle textStyle({required bool onDark, required Color color}) =>
      TextStyle(
        fontFamily: AppType.sans,
        fontSize: onDark ? 12 : 11.5,
        fontWeight: FontWeight.w600,
        color: color,
      );

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final label = contactKindLabel(l, action.kind);
    final fg = onDark ? Colors.white : t.text1;
    final pad = padding(onDark: onDark);

    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Tooltip(
        message: compact ? label : '',
        child: PressableScale(
          key: ValueKey('post-contact-${action.kind.name}'),
          // `openLink` qotmaydi (5 s) va ochilmasa havolani buferga
          // ko'chiradi — profildagi aloqa tugmalari bilan bir xil.
          onTap: () async {
            final ok = await openLink(action.url);
            if (ok || !context.mounted) return;
            ScaffoldMessenger.maybeOf(context)
              ?..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(content: Text(l.shareCopied)));
          },
          child: Container(
            // Faqat belgi — hoshiya teng, kapsula yozuvlisi bilan bir
            // balandlikda.
            padding: compact
                ? EdgeInsets.symmetric(
                    horizontal: pad.top + 7, vertical: pad.top)
                : pad,
            decoration: onDark
                ? BoxDecoration(
                    color: Colors.black.withValues(alpha: .38),
                    borderRadius: R.pill,
                    border: Border.all(
                        color: Colors.white.withValues(alpha: .28), width: .8),
                  )
                : BoxDecoration(
                    color: t.surfaceSolid,
                    borderRadius: R.pill,
                    border: Border.all(color: t.border1),
                    boxShadow: t.shadowTiny,
                  ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                contactGlyph(action.kind,
                    size: iconSize(onDark: onDark), color: fg),
                if (!compact) ...[
                  const SizedBox(width: 5),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textStyle(onDark: onDark, color: fg),
                    ),
                  ),
                ] else
                  // Yozuvli kapsula bilan bir xil balandlik (matn qatori).
                  Text('', style: textStyle(onDark: onDark, color: fg)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
