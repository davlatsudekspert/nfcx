import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/utils/external_link.dart';
import '../../data/models/contact_info.dart';
import '../../l10n/gen/app_localizations.dart';
import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import 'surfaces.dart';

/// ALOQA TUGMALARI — saytdagi biznes sahifasidek logoli DUMALOQ
/// tugmalar (egasi, 2026-09: "linklar saytning biznes sahifasidek
/// dumaloq button bo'lsin, hamma linklar logosi bilan").
///
/// Logotiplar saytdagi `src/components/Icons.jsx` dagi AYNAN o'sha
/// SVG chizmalar va o'sha brend ranglari (`CompanyQuickProfilePage`):
/// sayt va ilova bir xil ko'rinadi. Rasm fayli yo'q — vektor, har
/// o'lchamda tiniq.
class ContactButtons extends StatelessWidget {
  const ContactButtons({super.key, required this.actions});

  final List<ContactAction> actions;

  /// Bitta tugma katagining eni va tugmalar orasidagi masofa.
  static const _cell = 68.0;
  static const _gap = 8.0;

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) return const SizedBox.shrink();
    // MARKAZDA, TENG ORALIQ BILAN (egasi, 2026-09-24: "markazga
    // tekislangan, oraliq teng, chapga yoki o'ngga surilmasin").
    //
    // Ilgari gorizontal ro'yxat edi — qator doim CHAP chetdan
    // boshlanardi. Endi:
    //   * sig'sa — bitta qator, ekran markazida;
    //   * sal sig'masa — katak biroz torayadi (doira o'lchami saqlanadi);
    //   * umuman sig'masa — TENG qatorlarga bo'linadi (6 -> 3 + 3), har
    //     qator markazda. Hech qanday tugma ekrandan tashqarida qolmaydi.
    return LayoutBuilder(
      key: const ValueKey('contact-buttons'),
      builder: (context, c) {
        final n = actions.length;
        final max = c.maxWidth;
        double need(double cell) => n * cell + (n - 1) * _gap;

        Widget row(List<ContactAction> items, double cell) => Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(width: _gap),
                  _ContactButton(action: items[i], width: cell),
                ],
              ],
            );

        if (need(_cell) <= max) return row(actions, _cell);
        final tight = (max - (n - 1) * _gap) / n;
        if (tight >= 60) return row(actions, tight);

        final perRow = ((max + _gap) / (_cell + _gap)).floor().clamp(1, n);
        final rows = (n / perRow).ceil();
        final each = (n / rows).ceil();
        return Column(
          children: [
            for (var r = 0; r < rows; r++) ...[
              if (r > 0) const SizedBox(height: 10),
              row(
                actions.sublist(
                    r * each, ((r + 1) * each).clamp(0, n)),
                _cell,
              ),
            ],
          ],
        );
      },
    );
  }
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({required this.action, this.width = 68});
  final ContactAction action;
  final double width;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final ink = !t.isDark;
    final l = L.of(context);
    final spec = _specs[action.kind]!;
    final label = action.kind == ContactKind.link && action.label.isNotEmpty
        ? action.label
        : spec.label(l);
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: PressableScale(
        key: ValueKey('contact-${action.kind.name}'),
        // Hech qachon qotmaydi: `openLink` 5 soniyada to'xtaydi va
        // ochilmasa havolani buferga ko'chiradi — odamga shuni aytamiz.
        onTap: () async {
          final ok = await openLink(action.url);
          if (ok || !context.mounted) return;
          ScaffoldMessenger.maybeOf(context)
            ?..hideCurrentSnackBar()
            ..showSnackBar(SnackBar(content: Text(l.shareCopied)));
        },
        child: SizedBox(
          width: width,
          child: Column(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: ink
                    // PREMIUM OQ-QORA (2026-09-24): oq sirt, aniq siyoh
                    // chegara va yumshoq soya — doira "yuvilib" ketmaydi.
                    // Brend rangi faqat LOGOTIPDA qoladi.
                    ? BoxDecoration(
                        shape: BoxShape.circle,
                        color: t.surfaceSolid,
                        border: Border.all(
                            color: t.text1.withValues(alpha: .16), width: 1.1),
                        boxShadow: t.shadowSoft,
                      )
                    : BoxDecoration(
                        shape: BoxShape.circle,
                        // Brend rangining juda nozik foni.
                        gradient: RadialGradient(colors: [
                          spec.color.withValues(alpha: .10),
                          spec.color.withValues(alpha: .04),
                        ]),
                        border: Border.all(
                            color: spec.color.withValues(alpha: .16)),
                        boxShadow: [
                          BoxShadow(
                            color: spec.color.withValues(alpha: .10),
                            blurRadius: 14,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                alignment: Alignment.center,
                child: SvgPicture.string(
                  spec.svg,
                  width: 25,
                  height: 25,
                  colorFilter: ColorFilter.mode(spec.color, BlendMode.srcIn),
                ),
              ),
              const SizedBox(height: 7),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 11.5,
                  fontWeight: ink ? FontWeight.w600 : FontWeight.w500,
                  color: ink ? t.text1 : t.text2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Spec {
  const _Spec(this.color, this.svg, this.label);
  final Color color;
  final String svg;
  final String Function(L) label;
}

// Ranglar — saytdagi `CompanyQuickProfilePage.jsx` `quick` ro'yxatidan.
final _specs = <ContactKind, _Spec>{
  ContactKind.phone: _Spec(const Color(0xFF0E7A3D), _phone, (l) => l.contactCall),
  ContactKind.telegram: _Spec(const Color(0xFF0F7AB0), _telegram, (_) => 'Telegram'),
  ContactKind.whatsapp: _Spec(const Color(0xFF0B8A3C), _whatsapp, (_) => 'WhatsApp'),
  ContactKind.instagram: _Spec(const Color(0xFFB3175A), _instagram, (_) => 'Instagram'),
  ContactKind.facebook: _Spec(const Color(0xFF0D4FA8), _facebook, (_) => 'Facebook'),
  ContactKind.x: _Spec(const Color(0xFF1F1D1A), _x, (_) => 'X'),
  ContactKind.linkedin: _Spec(const Color(0xFF0A66C2), _linkedin, (_) => 'LinkedIn'),
  ContactKind.email: _Spec(const Color(0xFF8A5A12), _mail, (_) => 'Email'),
  ContactKind.map: _Spec(const Color(0xFFB83A1E), _pin, (l) => l.contactMap),
  ContactKind.website: _Spec(const Color(0xFF5A4410), _globe, (l) => l.contactWebsite),
  ContactKind.link: _Spec(const Color(0xFF5A4410), _link, (l) => l.contactLink),
};

// ── Saytdagi `src/components/Icons.jsx` chizmalari ───────────────────
const _phone =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/></svg>';
const _telegram =
    '<svg viewBox="0 0 24 24" fill="#000"><path d="M21.5 3.5 2.7 10.8c-1.2.5-1.2 1.2-.2 1.5l4.8 1.5 1.9 5.7c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.5 1.4.2 1.6-.7l2.9-13.5c.3-1.2-.4-1.7-1.5-1.3ZM8.6 13l9.4-5.9c.4-.3.8-.1.5.2l-7.7 6.9-.3 3.2z"/></svg>';
const _whatsapp =
    '<svg viewBox="0 0 24 24" fill="#000"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.3.3-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.8 2.9 4.5 4 .6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';
const _instagram =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="#000" stroke="none"/></svg>';
const _facebook =
    '<svg viewBox="0 0 24 24" fill="#000"><path d="M13.5 21v-7h2.6l.5-3h-3.1V9.1c0-.9.3-1.6 1.7-1.6h1.5V4.8c-.3 0-1.2-.1-2.3-.1-2.4 0-4 1.4-4 4V11H7.8v3h2.6v7z"/></svg>';
const _x =
    '<svg viewBox="0 0 24 24" fill="#000"><path d="M17.8 3h3l-6.7 7.7L22 21h-6.2l-4.8-6.3L5.4 21h-3l7.2-8.2L2 3h6.3l4.4 5.8zm-1 16.2h1.7L7.3 4.7H5.5z"/></svg>';
const _linkedin =
    '<svg viewBox="0 0 24 24" fill="#000"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3zM9.5 9H13v1.8h.05c.5-.9 1.7-1.8 3.5-1.8 3.7 0 4.4 2.4 4.4 5.6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.15 1.4-2.15 2.9V21h-4z"/></svg>';
const _mail =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="m3 6.5 9 6 9-6"/></svg>';
const _pin =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.5s7-6.1 7-11.2A7 7 0 0 0 5 10.3c0 5.1 7 11.2 7 11.2z"/><circle cx="12" cy="10" r="2.6"/></svg>';
const _globe =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.7 2.6 4 5.7 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.7-4-9s1.3-6.4 4-9Z"/></svg>';
const _link =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 12.6 4.9a3.7 3.7 0 0 1 5.2 5.2L16.2 11.7"/><path d="M13 17.5 11.4 19.1a3.7 3.7 0 0 1-5.2-5.2L7.8 12.3"/></svg>';
