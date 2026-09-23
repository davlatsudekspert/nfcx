import 'package:flutter/material.dart';

import '../../data/models/contact_info.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';

/// "ALOQA VA HAVOLALAR" — profil va biznes tahririda bitta muharrir
/// (egasi, 2026-09: "profilni tahrirlash sayt bilan bir xil bo'lsin").
///
/// Ilgari ilovada telefon, Telegram, Instagram, havolalar umuman
/// tahrirlanmasdi — faqat saytda. Maydonlar serverdagi kalitlar bilan
/// bir xil (`ContactInfo.toRecordJson` / `toCompanyJson`), ya'ni
/// ilovada yozilgani saytda ham, saytda yozilgani ilovada ham
/// ko'rinadi.
class ContactEditor extends StatefulWidget {
  const ContactEditor({
    super.key,
    required this.initial,
    required this.onChanged,
    this.business = false,
    this.enabled = true,
  });

  final ContactInfo initial;
  final ValueChanged<ContactInfo> onChanged;

  /// Biznes: WhatsApp bor, email/X/LinkedIn yo'q, havolalar 8 tagacha.
  /// Shaxsiy: aksincha, havolalar 20 tagacha (server chegaralari).
  final bool business;
  final bool enabled;

  @override
  State<ContactEditor> createState() => _ContactEditorState();
}

class _ContactEditorState extends State<ContactEditor> {
  late final _phone = TextEditingController(text: widget.initial.phone);
  late final _tg = TextEditingController(text: widget.initial.telegram);
  late final _wa = TextEditingController(text: widget.initial.whatsapp);
  late final _email = TextEditingController(text: widget.initial.email);
  late final _ig = TextEditingController(text: widget.initial.instagram);
  late final _fb = TextEditingController(text: widget.initial.facebook);
  late final _x = TextEditingController(text: widget.initial.twitter);
  late final _li = TextEditingController(text: widget.initial.linkedin);
  late final _web = TextEditingController(text: widget.initial.website);
  late final _addr = TextEditingController(text: widget.initial.address);
  late bool _hidePhone = widget.initial.hidePhone;
  late final List<(TextEditingController, TextEditingController)> _links = [
    for (final l in widget.initial.extraLinks)
      (TextEditingController(text: l.label), TextEditingController(text: l.url)),
  ];

  int get _maxLinks => widget.business ? 8 : 20;

  @override
  void dispose() {
    for (final c in [_phone, _tg, _wa, _email, _ig, _fb, _x, _li, _web, _addr]) {
      c.dispose();
    }
    for (final (a, b) in _links) {
      a.dispose();
      b.dispose();
    }
    super.dispose();
  }

  void _emit() {
    widget.onChanged(widget.initial.copyWith(
      phone: _phone.text.trim(),
      hidePhone: _hidePhone,
      telegram: _tg.text.trim(),
      whatsapp: _wa.text.trim(),
      email: _email.text.trim(),
      instagram: _ig.text.trim(),
      facebook: _fb.text.trim(),
      twitter: _x.text.trim(),
      linkedin: _li.text.trim(),
      website: _web.text.trim(),
      address: _addr.text.trim(),
      extraLinks: [
        for (final (a, b) in _links)
          if (b.text.trim().isNotEmpty)
            ExtraLink(label: a.text.trim(), url: b.text.trim()),
      ],
    ));
  }

  Widget _field(String label, TextEditingController c,
          {TextInputType? type, String? key}) =>
      Padding(
        padding: const EdgeInsets.only(bottom: Gap.md),
        child: NovaField(
          key: key == null ? null : ValueKey(key),
          label: label,
          controller: c,
          keyboardType: type,
          enabled: widget.enabled,
          onChanged: (_) => _emit(),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l.editContactHint,
            style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: Gap.lg),
        _field(l.fieldPhone, _phone, type: TextInputType.phone, key: 'edit-phone'),
        if (!widget.business)
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            value: _hidePhone,
            onChanged: widget.enabled
                ? (v) {
                    setState(() => _hidePhone = v);
                    _emit();
                  }
                : null,
            title: Text(l.fieldHidePhone,
                style: Theme.of(context).textTheme.bodyMedium),
          ),
        _field(l.fieldTelegram, _tg, key: 'edit-telegram'),
        if (widget.business)
          _field(l.fieldWhatsapp, _wa, type: TextInputType.phone, key: 'edit-whatsapp'),
        _field(l.fieldInstagram, _ig, key: 'edit-instagram'),
        _field(l.fieldFacebook, _fb, key: 'edit-facebook'),
        if (!widget.business) ...[
          _field(l.fieldX, _x, key: 'edit-x'),
          _field(l.fieldLinkedin, _li, key: 'edit-linkedin'),
          _field(l.fieldEmail, _email, type: TextInputType.emailAddress, key: 'edit-email'),
        ],
        _field(l.fieldWebsite, _web, type: TextInputType.url, key: 'edit-website'),
        _field(l.fieldAddress, _addr, key: 'edit-address'),
        const SizedBox(height: Gap.sm),
        Text(l.extraLinksTitle.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall),
        const SizedBox(height: Gap.md),
        for (var i = 0; i < _links.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.md),
            child: FloatingSurface(
              solid: true,
              padding: const EdgeInsets.fromLTRB(Gap.lg, Gap.md, Gap.sm, Gap.md),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        NovaField(
                          label: l.extraLinkLabel,
                          controller: _links[i].$1,
                          enabled: widget.enabled,
                          onChanged: (_) => _emit(),
                        ),
                        const SizedBox(height: Gap.sm),
                        NovaField(
                          label: l.extraLinkUrl,
                          controller: _links[i].$2,
                          keyboardType: TextInputType.url,
                          enabled: widget.enabled,
                          onChanged: (_) => _emit(),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: MaterialLocalizations.of(context).deleteButtonTooltip,
                    icon: Icon(Icons.close_rounded, color: t.text3),
                    onPressed: widget.enabled
                        ? () {
                            final (a, b) = _links.removeAt(i);
                            a.dispose();
                            b.dispose();
                            setState(() {});
                            _emit();
                          }
                        : null,
                  ),
                ],
              ),
            ),
          ),
        if (_links.length < _maxLinks)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              key: const ValueKey('extra-link-add'),
              onPressed: widget.enabled
                  ? () => setState(() => _links.add(
                      (TextEditingController(), TextEditingController())))
                  : null,
              icon: Icon(Icons.add_rounded, color: t.accent2),
              label: Text(
                l.extraLinkAdd,
                style: TextStyle(
                  fontFamily: AppType.sans,
                  fontWeight: FontWeight.w600,
                  color: t.accent2,
                ),
              ),
              style: TextButton.styleFrom(
                shape: const RoundedRectangleBorder(borderRadius: R.pill),
              ),
            ),
          ),
      ],
    );
  }
}
