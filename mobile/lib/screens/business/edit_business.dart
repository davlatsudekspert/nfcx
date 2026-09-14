import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/media_picker.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import 'edit_catalog.dart';
import 'edit_gallery.dart';
import 'working_hours.dart';
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
/// uchun bu yerda ko'rsatilmagan narsalar (musiqa, o'z domeni,
/// koordinatalar) TEGILMAYDI — bu ekran ularni jimgina tozalab
/// yubormaydi.
///
/// ISH VAQTI, KATALOG VA GALEREYA ALOHIDA EKRANDA va o'zlari
/// saqlanadi: ularning har biri kattaroq va bu shaklga sig'sa,
/// eng ko'p ishlatiladigan maydonlar (nom, telefon) pastga
/// tushib ketardi.
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

  /// SAQLANGAN HOLAT — shakl shunga solishtiriladi.
  ///
  /// `widget.company` ga solishtirib bo'lmaydi: u hech qachon
  /// yangilanmaydi, ya'ni bir marta saqlagandan keyin ham shakl
  /// abadiy "o'zgargan" bo'lib qolardi va har safar qayta saqlash
  /// so'ralardi.
  ///
  /// `late` EMAS, `initState` da: `late` birinchi MUROJAATDA
  /// hisoblanadi, ya'ni odam allaqachon yozib bo'lgandan keyin.
  /// U holda yozilgani "boshlang'ich holat" deb olinardi va
  /// o'zgarish umuman sezilmasdi.
  late final List<String> _base;

  @override
  void initState() {
    super.initState();
    _base = _snapshot();
  }

  List<String> _snapshot() => [
        _name.text.trim(),
        _about.text.trim(),
        _city.text.trim(),
        _address.text.trim(),
        _phone.text.trim(),
        _tg.text.trim(),
        _instagram.text.trim(),
        _website.text.trim(),
        '$_orders',
        _logo ?? '',
        _cover ?? '',
      ];

  /// Shaklda saqlanmagan o'zgarish bormi.
  ///
  /// NIMA UCHUN KERAK: ish vaqti / katalog / galereya ALOHIDA
  /// ekran. Odam nomni o'zgartirib, saqlamasdan o'sha ekranga
  /// o'tsa, qaytganda yozgani yo'qolgan bo'lardi.
  /// Muvaffaqiyatli saqlashdan keyingi holat. `null` — hali
  /// saqlanmagan.
  List<String>? _saved;

  bool get _dirty {
    final now = _snapshot();
    final base = _saved ?? _base;
    for (var i = 0; i < now.length; i++) {
      if (now[i] != base[i]) return true;
    }
    return false;
  }

  /// Boshqa bo'limga o'tish. Saqlanmagan o'zgarish bo'lsa —
  /// oldin so'raladi, jimgina yo'qotilmaydi.
  Future<void> _open(Widget Function(Company) screen) async {
    final company = _current;
    if (_dirty) {
      final go = await showSheet<bool>(
        context,
        title: tr('Saqlanmagan o‘zgarishlar'),
        subtitle: tr('Bu bo‘lim alohida saqlanadi. O‘tishdan oldin '
            'shakldagi o‘zgarishlarni saqlaysizmi?'),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
          child: Column(
            children: [
              PrimaryButton(tr('Saqlab, o‘tish'),
                  onTap: () => Navigator.of(context).pop(true)),
              const SizedBox(height: S.x8),
              SecondaryButton(tr('Bekor qilish'),
                  onTap: () => Navigator.of(context).pop(false)),
            ],
          ),
        ),
      );
      if (go != true || !mounted) return;
      final ok = await _save(close: false);
      if (!ok || !mounted) return;
    }
    if (!mounted) return;
    await push<bool>(context, (_) => screen(company));
  }

  Future<bool> _save({bool close = true}) async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = tr('Nomi bo‘sh bo‘lmasin.'));
      return false;
    }
    if (_about.text.trim().length < 20) {
      setState(() => _error = tr('Tavsif kamida 20 ta belgidan iborat bo‘lsin.'));
      return false;
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
      _saved = _snapshot();
      if (close && mounted) Navigator.of(context).pop(true);
      return true;
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
    return false;
  }

  /// ENG YANGI NUSXA: ish vaqti yoki galereya o'zgargandan keyin
  /// `widget.company` eskirgan bo'ladi. Alohida ekranlarga eski
  /// ma'lumot berilsa, odam o'zi kiritgan vaqtni yo'q holda ko'rardi.
  Company get _current {
    final list = AppScope.of(context).companies;
    for (final c in list) {
      if (c.id == widget.company.id) return c;
    }
    return widget.company;
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
                  PrimaryButton(tr('Saqlash'),
                      loading: _busy, onTap: _busy ? null : () => _save()),
                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Bo‘limlar')),
                  const SizedBox(height: S.x12),
                  Surface(
                    padding: EdgeInsets.zero,
                    shadow: E.e1,
                    child: Column(
                      children: [
                        _Link(
                          label: tr('Ish vaqti'),
                          hint: _hoursHint(_current),
                          icon: Ico.clock,
                          onTap: () => _open((c) => WorkingHoursScreen(company: c)),
                        ),
                        _Link(
                          label: tr('Katalog'),
                          hint: trf('{n} ta mahsulot',
                              {'n': '${_current.itemCount}'}),
                          icon: Ico.bag,
                          onTap: () => _open((c) => EditCatalogScreen(company: c)),
                        ),
                        _Link(
                          label: tr('Galereya'),
                          hint: trf('{n} ta rasm',
                              {'n': '${_current.gallery.length}'}),
                          icon: Ico.image,
                          last: true,
                          onTap: () => _open((c) => EditGalleryScreen(company: c)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x12),
                  // HALOL BO'LISH: ilovada hamma narsa yo'q va bu
                  // ochiq aytiladi — odam yo'q tugmani qidirib
                  // vaqtini yo'qotmasin.
                  Text(
                    tr('Musiqa va o‘z domeni saytdan sozlanadi.'),
                    textAlign: TextAlign.center,
                    style: T.caption.copyWith(fontSize: 12.5),
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

/// Ish vaqti qatoridagi qisqa izoh.
///
/// Kun soni ko'rsatiladi, chunki eng ko'p qilinadigan xato —
/// dam olish kunini belgilashni unutish.
String _hoursHint(Company c) {
  if (c.hours.isEmpty) return tr('Kiritilmagan');
  final open = c.hours.where((d) => !d.closed).length;
  if (open == 0) return tr('Hamma kun yopiq');
  return trf('Haftasiga {n} kun', {'n': '$open'});
}

/// Alohida ekranga olib boruvchi qator.
class _Link extends StatelessWidget {
  const _Link({
    required this.label,
    required this.hint,
    required this.icon,
    required this.onTap,
    this.last = false,
  });

  final String label;
  final String hint;
  final Ico icon;
  final VoidCallback onTap;
  final bool last;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x12),
          decoration: BoxDecoration(
            border: last ? null : Border(bottom: BorderSide(color: C.hairline)),
          ),
          child: Row(
            children: [
              NIcon(icon, size: 19, color: C.ash),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: T.cardTitle.copyWith(fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(hint, style: T.caption.copyWith(fontSize: 12.5)),
                  ],
                ),
              ),
              const SizedBox(width: S.x8),
              NIcon(Ico.chevronRight, size: 17, color: C.ash),
            ],
          ),
        ),
      );
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
                    Text(label, style: T.cardTitle.copyWith(fontSize: 15)),
                    const SizedBox(height: 3),
                    Text(hint, style: T.caption.copyWith(fontSize: 12.5)),
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
