import 'dart:async';

import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// BIZNES HISOB OCHISH.
///
/// IKKI YO'L, IKKALASI HAM HAQIQIY:
///
///   BEPUL — server tasodifiy Company ID beradi (`auto: true`).
///           To'lov talab qilinmaydi (2026-09 qarori).
///   NOM    — o'zi tanlagan nom. Narxi HARFLAR SONIGA qarab
///           serverda hisoblanadi va to'lovdan keyin faollashadi.
///
/// NARX MIJOZDA HISOBLANMAYDI: `GET /api/companies/check` bandlikni
/// ham, narxni ham serverdan beradi. Ilovada jadval yozilsa, saytda
/// narx o'zgarganda ikkalasi bir-biriga to'g'ri kelmay qolardi.
class CreateCompanyScreen extends StatefulWidget {
  const CreateCompanyScreen({super.key});

  @override
  State<CreateCompanyScreen> createState() => _CreateCompanyScreenState();
}

/// Backend qabul qiladigan turkumlar (`COMPANY_CATEGORIES`).
const _categories = <String, String>{
  'restaurant': 'Restoran',
  'cafe': 'Kafe',
  'market': 'Market',
  'shop': 'Do‘kon',
  'services': 'Xizmatlar',
  'construction': 'Qurilish',
  'clinic': 'Klinika',
  'pharmacy': 'Dorixona',
  'education': 'Ta‘lim',
  'other': 'Boshqa',
};

class _CreateCompanyScreenState extends State<CreateCompanyScreen> {
  final _id = TextEditingController();
  final _name = TextEditingController();
  final _about = TextEditingController();
  final _city = TextEditingController();
  final _phone = TextEditingController();

  String _category = 'other';

  /// `true` — bepul, tasodifiy ID.
  bool _auto = true;

  Timer? _debounce;
  Map<String, dynamic>? _check;
  bool _checking = false;

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    for (final c in [_id, _name, _about, _city, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  void _onId(String v) {
    _debounce?.cancel();
    final id = v.trim();
    if (id.length < 3) {
      setState(() {
        _check = null;
        _checking = false;
      });
      return;
    }
    setState(() => _checking = true);
    _debounce = Timer(const Duration(milliseconds: 400), () => _runCheck(id));
  }

  Future<void> _runCheck(String id) async {
    try {
      final res = await AppScope.read(context).repo.checkCompanyId(id);
      if (!mounted) return;
      setState(() {
        _check = res;
        _checking = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _check = null;
          _checking = false;
        });
      }
    }
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final city = _city.text.trim();
    final phone = _phone.text.trim();
    final about = _about.text.trim();

    if (name.isEmpty || city.isEmpty || phone.isEmpty || about.length < 20) {
      setState(() => _error =
          'Nom, shahar, telefon va kamida 20 belgilik tavsif to‘ldirilsin.');
      return;
    }
    if (!_auto && _id.text.trim().length < 3) {
      setState(() => _error = 'Company ID kamida 3 ta belgidan iborat bo‘lsin.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state = AppScope.read(context);
      final res = await state.repo.createCompany({
        if (_auto) 'auto': true else 'companyId': _id.text.trim(),
        'displayName': name,
        'city': city,
        'phone': phone,
        'description': about,
        'category': _category,
      });
      successHaptic();
      // YANGI BIZNES DARHOL SHAXSLAR RO'YXATIGA TUSHSIN: aks holda
      // odam "yaratildi" degan yozuvni ko'radi-yu, uni hech qayerdan
      // topa olmaydi.
      await state.refreshIdentities();
      if (mounted) Navigator.of(context).pop(res);
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = switch (e.key) {
              'company_id_taken' => 'Bu Company ID band.',
              'company_id_reserved' => 'Bu nom band qilingan ro‘yxatda.',
              'bad_company_id' => 'Company ID faqat harf va raqamdan iborat bo‘lsin.',
              'name_not_allowed' => 'Bu nomni ishlatib bo‘lmaydi.',
              'required_fields' =>
                'Nom, shahar, telefon va tavsif to‘liq to‘ldirilsin.',
              'auto_id_failed' => 'Hozir bepul ID berib bo‘lmadi. Qayta urining.',
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
    final check = _check;
    final available = check?['available'] == true;
    final price = (check?['price'] as num?)?.round() ?? 0;

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        child: Column(
          children: [
            const TopBar(
              title: 'Biznes hisob',
              subtitle: 'Katalog, buyurtma va statistika',
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  const Eyebrow('Company ID'),
                  const SizedBox(height: S.x8),
                  _Choice(
                    title: 'Bepul ID',
                    hint: 'Tasodifiy kod beriladi. To‘lov talab qilinmaydi.',
                    selected: _auto,
                    onTap: _busy ? null : () => setState(() => _auto = true),
                  ),
                  const SizedBox(height: S.x8),
                  _Choice(
                    title: 'O‘z nomim',
                    hint: 'Narxi harflar soniga qarab belgilanadi.',
                    selected: !_auto,
                    onTap: _busy ? null : () => setState(() => _auto = false),
                  ),
                  if (!_auto) ...[
                    const SizedBox(height: S.x16),
                    Field(
                      label: 'Company ID',
                      controller: _id,
                      hint: 'MASALAN',
                      onChanged: _onId,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: S.x8),
                    _CheckLine(
                      checking: _checking,
                      check: check,
                      available: available,
                      price: price,
                    ),
                  ],
                  const SizedBox(height: S.x24),
                  const Eyebrow('Biznes haqida'),
                  const SizedBox(height: S.x12),
                  Field(
                    label: 'Nomi',
                    controller: _name,
                    hint: 'Biznes nomi',
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: 'Tavsif',
                    controller: _about,
                    hint: 'Kamida 20 ta belgi',
                    maxLines: 4,
                  ),
                  const SizedBox(height: S.x16),
                  const Eyebrow('Turkum'),
                  const SizedBox(height: S.x8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final e in _categories.entries)
                        Chip(
                          e.value,
                          active: _category == e.key,
                          onTap: _busy ? null : () => setState(() => _category = e.key),
                        ),
                    ],
                  ),
                  const SizedBox(height: S.x20),
                  Field(
                    label: 'Shahar',
                    controller: _city,
                    hint: 'Toshkent',
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: 'Telefon',
                    controller: _phone,
                    hint: '+998 90 123 45 67',
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.done,
                    error: _error,
                  ),
                  const SizedBox(height: S.x24),
                  PrimaryButton(
                    _auto || price == 0 ? 'Biznes ochish' : 'Davom etish',
                    loading: _busy,
                    onTap: _busy ? null : _submit,
                  ),
                  const SizedBox(height: S.x12),
                  Text(
                    _auto
                        ? 'Hisob darhol ochiladi va admin ko‘rigidan o‘tadi.'
                        : 'Tanlangan nom to‘lovdan keyin faollashadi.',
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

/// Bandlik va narx qatori — SERVER javobidan.
class _CheckLine extends StatelessWidget {
  const _CheckLine({
    required this.checking,
    required this.check,
    required this.available,
    required this.price,
  });

  final bool checking;
  final Map<String, dynamic>? check;
  final bool available;
  final int price;

  @override
  Widget build(BuildContext context) {
    if (checking) {
      return Row(
        children: [
          const Spinner(size: 14),
          const SizedBox(width: S.x8),
          Text('Tekshirilmoqda…', style: T.caption.copyWith(fontSize: 11.5)),
        ],
      );
    }
    if (check == null) return const SizedBox.shrink();
    if (!available) {
      return Text('Bu Company ID band.',
          style: T.caption.copyWith(fontSize: 11.5, color: C.signal));
    }
    return Text(
      price == 0 ? 'Bo‘sh — bepul' : 'Bo‘sh — ${som(price)}',
      style: T.caption.copyWith(fontSize: 11.5, color: C.verdant),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({
    required this.title,
    required this.hint,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String hint;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          border: selected ? C.champagne.withValues(alpha: .35) : null,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: T.cardTitle.copyWith(fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text(hint, style: T.caption.copyWith(fontSize: 11)),
                  ],
                ),
              ),
              if (selected) const NIcon(Ico.check, size: 16, color: C.champagne),
            ],
          ),
        ),
      );
}
