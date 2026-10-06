import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/utils/external_link.dart';
import '../../data/models/contact_info.dart';
import '../../l10n/gen/app_localizations.dart';
import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import 'card_number_sheet.dart';
import 'surfaces.dart';

/// ALOQA TUGMALARI — iPhone ish stolidagi ILOVA BELGILARI kabi.
///
/// Egasi (2026-09-27): "profildagi Telegram, Instagram — hammasi
/// to'lib, iPhone'da rabochiy stolda ko'rinadigandek bo'lsin;
/// kattaligi emas, ko'rinishi". Endi har tugma o'z brendining
/// rangidagi (Instagram — o'z gradienti) silliq burchakli plitka,
/// ichida OQ logotip. Oq fondagi rangli logotip qorong'i mavzularda
/// yuvilib ketardi — to'la plitka har mavzuda bir xil o'qiladi.
/// O'lcham avvalgidek (56 → 40, tor qatorda kichrayadi).
///
/// (Ilgari: saytdagi biznes sahifasidek oq doira ichida rangli logo —
/// egasi, 2026-09.)
///
/// Logotiplar saytdagi `src/components/Icons.jsx` dagi AYNAN o'sha
/// SVG chizmalar va o'sha brend ranglari (`CompanyQuickProfilePage`):
/// sayt va ilova bir xil ko'rinadi. Rasm fayli yo'q — vektor, har
/// o'lchamda tiniq.
class ContactButtons extends StatelessWidget {
  const ContactButtons({super.key, required this.actions});

  final List<ContactAction> actions;

  /// Katak eni (to'liq o'lcham) va tugmalar orasidagi masofa.
  static const _cell = 68.0;
  static const _gap = 6.0;

  /// Bitta qatorda katak shundan torayib ketmaydi.
  static const _minCell = 44.0;

  @override
  Widget build(BuildContext context) {
    if (actions.isEmpty) return const SizedBox.shrink();
    // BITTA QATOR, MARKAZDA, TENG ORALIQ BILAN (egasi, 2026-09-24:
    // "markazga tekislangan, oraliq teng, sociallar bir qatorda").
    //
    // Ilgari gorizontal ro'yxat edi — qator doim CHAP chetdan
    // boshlanardi. Endi katak eni tugmalar soniga qarab hisoblanadi:
    // 5-6 ta tugma ham bitta qatorga sig'adi (doira biroz kichrayadi,
    // brend logotipi o'z rangida qoladi). Juda ko'p bo'lsa (7+) qator
    // surib ko'riladi — hech bir tugma yashirinmaydi.
    return LayoutBuilder(
      key: const ValueKey('contact-buttons'),
      builder: (context, c) {
        final n = actions.length;
        final fit = (c.maxWidth - (n - 1) * _gap) / n;
        final cell = fit.clamp(_minCell, _cell);
        final row = Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < n; i++) ...[
              if (i > 0) const SizedBox(width: _gap),
              _ContactButton(action: actions[i], width: cell),
            ],
          ],
        );
        if (fit >= _minCell) return Center(child: row);
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: row,
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
    // Tor katakda doira ham kichrayadi (56 -> 40), nisbat saqlanadi.
    final circle = (width - 8).clamp(40.0, 56.0);
    final l = L.of(context);
    final spec = _specs[action.kind]!;
    final label = (action.kind == ContactKind.link ||
                action.kind == ContactKind.card) &&
            action.label.isNotEmpty
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
          // KARTA — havola emas: QR va raqam oynasi.
          if (action.kind == ContactKind.card) {
            await showCardNumberSheet(context,
                number: action.url, label: action.label);
            return;
          }
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
                width: circle,
                height: circle,
                // iPHONE BELGISI: brend rangidagi superellips plitka
                // (burchak ~22.4% — iOS belgisi nisbati), yuqoridan
                // yorug'roq gradient, ostida o'z rangidagi yumshoq soya.
                decoration: ShapeDecoration(
                  shape: RoundedSuperellipseBorder(
                    borderRadius: BorderRadius.circular(circle * .2237),
                  ),
                  gradient: spec.gradient,
                  shadows: [
                    BoxShadow(
                      color: spec.gradient.colors.last.withValues(alpha: .30),
                      blurRadius: circle * .22,
                      offset: Offset(0, circle * .07),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: SvgPicture.string(
                  spec.svg,
                  width: circle * .5,
                  height: circle * .5,
                  colorFilter:
                      const ColorFilter.mode(Colors.white, BlendMode.srcIn),
                ),
              ),
              const SizedBox(height: 7),
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  maxLines: 1,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: width < 60 ? 10.5 : 11.5,
                    fontWeight: FontWeight.w600,
                    color: t.text1,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Aloqa turining BIR RANGLI belgisi — [ContactButtons] dagi AYNAN o'sha
/// SVG chizma (biznes postidagi "Bog'lanish" kapsulalari uchun). Sayt
/// va profil tugmalari bilan bir xil logotip, mavzu rangida.
Widget contactGlyph(ContactKind kind,
        {required double size, required Color color}) =>
    SvgPicture.string(
      _specs[kind]!.svg,
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    );

/// Aloqa turining qisqa nomi ("Qo'ng'iroq", "Telegram", "Xarita"...).
String contactKindLabel(L l, ContactKind kind) => _specs[kind]!.label(l);

class _Spec {
  const _Spec(this.gradient, this.svg, this.label);

  /// iPhone belgisidagidek: yuqorisi yorug'roq, pasti to'qroq.
  final LinearGradient gradient;
  final String svg;
  final String Function(L) label;
}

/// Yuqoridan pastga ikki rangli gradient — iOS belgilarining uslubi.
LinearGradient _v(int top, int bottom) => LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [Color(top), Color(bottom)],
    );

// Ranglar — brendlarning iPhone belgilaridagi rangi (Telegram ko'ki,
// WhatsApp va Telefon yashili, Instagram gradienti va h.k.).
final _specs = <ContactKind, _Spec>{
  ContactKind.phone: _Spec(_v(0xFF5FE06A, 0xFF1DB93A), _phone,
      (l) => l.contactCall),
  ContactKind.telegram: _Spec(_v(0xFF3FC1FB, 0xFF0A87D1), _telegram,
      (_) => 'Telegram'),
  ContactKind.whatsapp: _Spec(_v(0xFF5EF07D, 0xFF23C04A), _whatsapp,
      (_) => 'WhatsApp'),
  ContactKind.instagram: _Spec(
    const LinearGradient(
      begin: Alignment.bottomLeft,
      end: Alignment.topRight,
      colors: [
        Color(0xFFFDC468),
        Color(0xFFF77737),
        Color(0xFFE1306C),
        Color(0xFFC13584),
        Color(0xFF833AB4),
      ],
      stops: [0, .25, .5, .72, 1],
    ),
    _instagram,
    (_) => 'Instagram',
  ),
  ContactKind.facebook: _Spec(_v(0xFF2DB0FF, 0xFF0866FF), _facebook,
      (_) => 'Facebook'),
  ContactKind.x: _Spec(_v(0xFF3A3A3C, 0xFF000000), _x, (_) => 'X'),
  ContactKind.linkedin: _Spec(_v(0xFF2A8BE0, 0xFF0A66C2), _linkedin,
      (_) => 'LinkedIn'),
  ContactKind.email: _Spec(_v(0xFF49A6FF, 0xFF1666F2), _mail,
      (_) => 'Email'),
  ContactKind.map: _Spec(_v(0xFFFF7A59, 0xFFE0352B), _pin,
      (l) => l.contactMap),
  ContactKind.website: _Spec(_v(0xFF636366, 0xFF2C2C2E), _globe,
      (l) => l.contactWebsite),
  // PLASTIK KARTA (egasi, 2026-09-28: "bu qatorda plastik karta ham
  // qo'yiladi, unga ham shularga moslab logo qilib qo'y"). Bank yo'q —
  // NFCSTORE oltini (issiq tilla → to'q oltin), ichida oq karta.
  ContactKind.card: _Spec(_v(0xFFF2D08A, 0xFFB8862B), _card,
      (l) => l.contactCard),
  ContactKind.link: _Spec(_v(0xFF636366, 0xFF2C2C2E), _link,
      (l) => l.contactLink),
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
// Saytdagi `IconBankCard`: karta, magnit tasma, raqam chizig'i.
const _card =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.8"/><path d="M2.5 9.6h19"/><path d="M6 14.4h3.4"/></svg>';
const _link =
    '<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5 14.5 9.5"/><path d="M11 6.5 12.6 4.9a3.7 3.7 0 0 1 5.2 5.2L16.2 11.7"/><path d="M13 17.5 11.4 19.1a3.7 3.7 0 0 1-5.2-5.2L7.8 12.3"/></svg>';
