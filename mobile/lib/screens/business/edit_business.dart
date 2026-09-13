import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/media_picker.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import '../../l10n/strings.dart';

/// BIZNES PROFILINI TAHRIRLASH.
///
/// NIMA UCHUN KERAK EDI: biznes egasi ilovadan profilining HECH
/// NARSASINI o'zgartira olmasdi — nom, tavsif, manzil, telefon,
/// logotip uchun saytga chiqishi shart edi. Auditda bu eng katta
/// P0 bo'shliq deb belgilangan.
///
/// FAQAT YUBORILGAN MAYDONLAR O'ZGARADI: server `PATCH` da
/// `body[key] == null` bo'lsa joriy qiymatni qoldiradi. Shuning
/// uchun bu yerda ko'rsatilmagan narsalar (musiqa, galereya, o'z
/// domeni, koordinatalar) TEGILMAYDI — ular saytdan sozlanadi va
/// bu ekran ularni jimgina tozalab yubormaydi.
class EditBusinessScreen extends StatefulWidget {
  const EditBusinessScreen({super.key, required this.company});
  final Company company;

  @override
  State<EditBusinessScreen> createState() => _EditBusinessScreenState();
}

class _EditBusinessScreenState extends State<EditBusinessScreen> {
  late final _name = TextEditingController(text: widget.company.name);
  late final _about = TextEditingController(text: widget.company.about);
  late final _city = TextEditingController(text: widget.company.city);
  late final _address = TextEditingController(text: widget.company.address);
  late final _phone = TextEditingController(text: widget.company.phone);
  late final _tg = TextEditingController(text: widget.company.tg);
  late final _instagram = TextEditingController(text: widget.company.instagram);
  late final _website = TextEditingController(text: widget.company.website);

  /// Yuklangan yangi rasmlar. `null` — o'zgarmagan.
  String? _logo;
  String? _cover;

  late bool _orders = widget.company.ordersEnabled;

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _about, _city, _address, _phone, _tg, _instagram, _website]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = tr('Nomi bo‘sh bo‘lmasin.'));
      return;
    }
    if (_about.text.trim().length < 20) {
      setState(() => _error = tr('Tavsif kamida 20 ta belgidan iborat bo‘lsin.'));
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state = AppScope.read(context);
      await state.repo.updateCompany(widget.company.id, {
        'displayName': name,
        'description': _about.text.trim(),
        'city': _city.text.trim(),
        'address': _address.text.trim(),
        'phone': _phone.text.trim(),
        'telegram': _tg.text.trim(),
        'instagram': _instagram.text.trim(),
        'website': _website.text.trim(),
        'ordersEnabled': _orders,
        // FAQAT ALMASHTIRILGAN BO'LSA yuboriladi: `null` yuborilsa
        // server joriy rasmni qoldiradi, bo'sh satr esa O'CHIRARDI.
        if (_logo != null) 'logoUrl': _logo,
        if (_cover != null) 'coverUrl': _cover,
      });
      successHaptic();
      // Shaxslar ro'yxatidagi nom va logotip ham yangilansin.
      await state.refreshIdentities();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = switch (e.key) {
              'name_not_allowed' => tr('Bu nomni ishlatib bo‘lmaydi.'),
              'required_fields' => tr('Nom, shahar, telefon va tavsif to‘ldirilsin.'),
              'forbidden' => tr('Bu biznes sizga tegishli emas.'),
              _ => humanError(e),
            });
      }
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        child: Column(
          children: [
            TopBar(title: tr('Biznesni tahrirlash'), subtitle: widget.company.id),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  MediaPickField(
                    label: tr('Muqova'),
                    repo: repo,
                    url: widget.company.coverUrl,
                    aspect: 16 / 7,
                    hint: tr('Keng rasm — profil tepasida ko‘rinadi.'),
                    onUploaded: (u) => setState(() => _cover = u),
                  ),
                  const SizedBox(height: S.x20),
                  MediaPickField(
                    label: tr('Logotip'),
                    repo: repo,
                    url: widget.company.logoUrl,
                    circle: true,
                    hint: tr('Kvadrat rasm eng yaxshi ko‘rinadi.'),
                    onUploaded: (u) => setState(() => _logo = u),
                  ),
                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Asosiy')),
                  const SizedBox(height: S.x12),
                  Field(
                    label: tr('Nomi'),
                    controller: _name,
                    hint: tr('Biznes nomi'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Tavsif'),
                    controller: _about,
                    hint: tr('Nima bilan shug‘ullanasiz'),
                    maxLines: 5,
                  ),
                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Manzil')),
                  const SizedBox(height: S.x12),
                  Field(
                    label: tr('Shahar'),
                    controller: _city,
                    hint: tr('Toshkent'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Manzil'),
                    controller: _address,
                    hint: tr('Ko‘cha, uy'),
                    maxLines: 2,
                  ),
                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Aloqa')),
                  const SizedBox(height: S.x12),
                  Field(
                    label: tr('Telefon'),
                    controller: _phone,
                    hint: '+998 90 123 45 67',
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: 'Telegram',
                    controller: _tg,
                    hint: 'foydalanuvchi',
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: 'Instagram',
                    controller: _instagram,
                    hint: 'foydalanuvchi',
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Veb-sayt'),
                    controller: _website,
                    hint: 'https://',
                    keyboardType: TextInputType.url,
                    textInputAction: TextInputAction.done,
                    error: _error,
                  ),
                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Buyurtmalar')),
                  const SizedBox(height: S.x12),
                  _Toggle(
                    label: tr('Katalogdan buyurtma qabul qilish'),
                    hint: tr('O‘chirilsa mahsulotlar ko‘rinadi, lekin ') +
                        tr('buyurtma tugmasi bo‘lmaydi.'),
                    value: _orders,
                    onChanged: _busy ? null : (v) => setState(() => _orders = v),
                  ),
                  const SizedBox(height: S.x24),
                  PrimaryButton(tr('Saqlash'), loading: _busy, onTap: _busy ? null : _save),
                  const SizedBox(height: S.x12),
                  // HALOL BO'LISH: ilovada hamma narsa yo'q va bu
                  // ochiq aytiladi — odam yo'q tugmani qidirib
                  // vaqtini yo'qotmasin.
                  Text(
                    tr('Ish vaqti, katalog, galereya va o‘z domeni saytdan '
                        'sozlanadi.'),
                    textAlign: TextAlign.center,
                    style: T.caption.copyWith(fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Toggle extends StatelessWidget {
  const _Toggle({
    required this.label,
    required this.hint,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final String hint;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onChanged == null ? null : () => onChanged!(!value),
        child: Surface(
          padding: const EdgeInsets.all(S.x16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: T.cardTitle.copyWith(fontSize: 13.5)),
                    const SizedBox(height: 3),
                    Text(hint, style: T.caption.copyWith(fontSize: 11)),
                  ],
                ),
              ),
              const SizedBox(width: S.x12),
              AnimatedContainer(
                duration: M.fade,
                curve: M.curve,
                width: 44,
                height: 26,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(13),
                  color: value ? C.champagne.withValues(alpha: .28) : C.graphite,
                  border: Border.all(
                    color: value ? C.champagne.withValues(alpha: .5) : C.hairline,
                  ),
                ),
                alignment: value ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: value ? C.champagne : C.muted,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}
