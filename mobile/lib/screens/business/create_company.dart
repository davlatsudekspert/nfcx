import 'dart:async';

import 'package:flutter/services.dart' show TextInputAction, TextInputType;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart' show openExternal;

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
///
/// Funksiya, `final` emas: kalitlar serverniki va o'zgarmaydi,
/// nomlar esa tarjima qilinadi va til almashganda qayta
/// hisoblanishi kerak.
Map<String, String> _categories() => <String, String>{
      'restaurant': tr('Restoran'),
      'cafe': tr('Kafe'),
      'market': tr('Market'),
      'shop': tr('Do‘kon'),
      'services': tr('Xizmatlar'),
      'construction': tr('Qurilish'),
      'clinic': tr('Klinika'),
      'pharmacy': tr('Dorixona'),
      'education': tr('Ta‘lim'),
      'other': tr('Boshqa'),
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

  /// Bandlik so'rovi TUSHDI. "Band emas" bilan adashtirmaslik
  /// uchun alohida: ilgari xato jimgina yutilar va qator umuman
  /// yo'qolardi — odam ID bo'shmi yoki yo'qmi bilmasdan qolardi.
  bool _checkFailed = false;
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
        _checkFailed = false;
      });
      return;
    }
    setState(() {
      _checking = true;
      _checkFailed = false;
    });
    _debounce = Timer(const Duration(milliseconds: 400), () => _runCheck(id));
  }

  Future<void> _runCheck(String id) async {
    try {
      final res = await AppScope.read(context).repo.checkCompanyId(id);
      if (!mounted) return;
      setState(() {
        _check = res;
        _checking = false;
        _checkFailed = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _check = null;
          _checking = false;
          _checkFailed = true;
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
          tr('Nom, shahar, telefon va kamida 20 belgilik tavsif to‘ldirilsin.'));
      return;
    }
    if (!_auto && _id.text.trim().length < 3) {
      setState(
          () => _error = tr('Company ID kamida 3 ta belgidan iborat bo‘lsin.'));
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
              'company_id_taken' => tr('Bu Company ID band.'),
              'company_id_reserved' => tr('Bu nom band qilingan ro‘yxatda.'),
              'bad_company_id' =>
                tr('Company ID faqat harf va raqamdan iborat bo‘lsin.'),
              'name_not_allowed' => tr('Bu nomni ishlatib bo‘lmaydi.'),
              'required_fields' =>
                tr('Nom, shahar, telefon va tavsif to‘liq to‘ldirilsin.'),
              'auto_id_failed' =>
                tr('Hozir bepul ID berib bo‘lmadi. Qayta urining.'),
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
    // Pullik nom tanlandimi — bo'sh va narxi bor.
    final paidName = !_auto && available && price > 0;

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, 0),
                children: [
                  ScreenTitle(
                    tr('Biznes hisob'),
                    subtitle: tr('Katalog, buyurtma va statistika'),
                  ),
                  Eyebrow(tr('Company ID')),
                  const SizedBox(height: S.x12),
                  _Choice(
                    title: tr('Bepul ID'),
                    hint: tr('Tasodifiy kod beriladi. To‘lov talab qilinmaydi.'),
                    selected: _auto,
                    onTap: _busy ? null : () => setState(() => _auto = true),
                  ),
                  const SizedBox(height: S.x8),
                  _Choice(
                    title: tr('O‘z nomim'),
                    hint: tr('Narxi harflar soniga qarab belgilanadi.'),
                    selected: !_auto,
                    onTap: _busy ? null : () => setState(() => _auto = false),
                  ),
                  if (!_auto) ...[
                    const SizedBox(height: S.x16),
                    Field(
                      label: tr('Company ID'),
                      controller: _id,
                      hint: 'MASALAN',
                      helper: tr('Kamida 3 ta belgi — harf va raqam.'),
                      onChanged: _onId,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: S.x12),
                    _CheckLine(
                      checking: _checking,
                      failed: _checkFailed,
                      check: check,
                      available: available,
                      price: price,
                    ),
                  ],
                  const SizedBox(height: S.x32),
                  SectionHeader(tr('Biznes haqida')),
                  const SizedBox(height: S.x16),
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
                    hint: tr('Kamida 20 ta belgi'),
                    maxLines: 4,
                  ),
                  const SizedBox(height: S.x20),
                  Eyebrow(tr('Turkum')),
                  const SizedBox(height: S.x12),
                  Wrap(
                    spacing: S.x8,
                    runSpacing: S.x8,
                    children: [
                      for (final e in _categories().entries)
                        FilterChip(
                          e.value,
                          active: _category == e.key,
                          onTap:
                              _busy ? null : () => setState(() => _category = e.key),
                        ),
                    ],
                  ),
                  const SizedBox(height: S.x20),
                  Field(
                    label: tr('Shahar'),
                    controller: _city,
                    hint: tr('Toshkent'),
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Telefon'),
                    controller: _phone,
                    hint: '+998 90 123 45 67',
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.done,
                    error: _error,
                  ),
                  const SizedBox(height: S.x16),
                  Text(
                    _auto || price == 0
                        ? tr('Hisob darhol ochiladi va admin ko‘rigidan o‘tadi.')
                        : tr('Pullik nom saytda sotib olinadi. To‘lovdan keyin '
                            'u shu hisobga biriktiriladi.'),
                    style: T.caption,
                  ),
                  SizedBox(height: StickyBar.inset(context)),
                ],
              ),
            ),
            Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: StickyBar(
                // PULLIK NOM TANLANGANDA ASOSIY TUGMA SAYTGA OLIB
                // BORADI, HISOB OCHMAYDI.
                //
                // Ilgari u hisob ochardi va hisob "to'lov kutilmoqda"
                // holatida qolib ketardi: ilovada to'lash yo'li yo'q
                // (server so'rovni rad etadi), ya'ni odam tugmani
                // bosib, hech narsa bo'lmaganini ko'rardi.
                child: paidName
                    ? PrimaryButton(
                        tr('Saytda sotib olish'),
                        icon: Ico.globe,
                        // MANZIL API MIJOZIDAN: ilova va sayt bitta
                        // manbadan o'qiydi, shuning uchun manzil
                        // ikkinchi marta yozilmaydi.
                        onTap: () => openExternal(
                          Uri.parse(
                            '${AppScope.read(context).api.baseUrl}'
                            '/company/create',
                          ),
                        ),
                      )
                    : PrimaryButton(
                        tr('Biznes ochish'),
                        loading: _busy,
                        onTap: _busy ? null : _submit,
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bandlik va narx qatori — SERVER javobidan.
///
/// Narx ham, bandlik ham shu yerda HISOBLANMAYDI: ikkalasi ham
/// `checkCompanyId` javobidan ko'chiriladi.
class _CheckLine extends StatelessWidget {
  const _CheckLine({
    required this.checking,
    required this.failed,
    required this.check,
    required this.available,
    required this.price,
  });

  final bool checking;

  /// So'rov tushdi — javob yo'q, "band emas" DEGANI EMAS.
  final bool failed;
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
          Text(tr('Tekshirilmoqda…'), style: T.caption),
        ],
      );
    }
    if (failed) {
      return Text(
        tr('Tekshirib bo‘lmadi. Ulanishni tekshiring.'),
        style: T.caption,
      );
    }
    if (check == null) return const SizedBox.shrink();
    if (!available) {
      return StatusChip(tr('Bu Company ID band.'), tone: StatusTone.fail);
    }
    if (price == 0) {
      return StatusChip(tr('Bo‘sh — bepul'), tone: StatusTone.ok);
    }

    // NARX KO'RINSIN, SOTIB OLISH ESA SAYTDA.
    //
    // EGASI: "narxini ko'rsatsin qanchaligini, sotib olish uchun
    // saytga kiring deb qo'y".
    //
    // Nima uchun aynan shunday: shaxsiy ID ni ilovaning o'zida
    // Payme yoki Click bilan olish mumkin, biznes nomi uchun esa
    // serverda to'lov oqimi hali ochilmagan — so'rov "kompaniya
    // tarifi belgilanmagan" deb rad etiladi. Ilovada "Sotib olish"
    // tugmasi turgani bilan u ishlamasdi va odam nima
    // bo'layotganini tushunmasdi.
    //
    // Endi ekran rostini aytadi: nom bo'sh, narxi shuncha, xarid
    // saytda. Narx SERVERDAN keladi — mijozda narx jadvali yo'q.
    return Surface(
      padding: const EdgeInsets.all(S.x16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusChip(tr('Bo‘sh'), tone: StatusTone.ok),
              const Spacer(),
              Text(som(price), style: T.amount),
              const SizedBox(width: 4),
              Text(tr('so‘m'), style: T.meta),
            ],
          ),
          const SizedBox(height: S.x12),
          Text(
            tr('Bu nomni sotib olish saytda amalga oshiriladi. '
                'Ilovada bepul ID bilan davom etishingiz mumkin.'),
            style: T.caption.copyWith(fontSize: 12.5),
          ),
        ],
      ),
    );
  }
}

/// IKKI YO'LDAN BIRI.
///
/// Tanlangani faqat RANG bilan emas, halqa ichidagi BELGI bilan
/// ham ko'rsatiladi — rang ko'rmaydigan odam ham qaysi yo'l
/// tanlanganini biladi.
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
  Widget build(BuildContext context) => Surface(
        onTap: onTap,
        border: Border.all(
          color: selected ? C.lineStrong : C.line,
          width: selected ? 1.4 : 1,
        ),
        child: Row(
          children: [
            _Radio(selected: selected),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: T.cardTitle),
                  const SizedBox(height: 3),
                  Text(hint, style: T.caption),
                ],
              ),
            ),
          ],
        ),
      );
}

class _Radio extends StatelessWidget {
  const _Radio({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: M.press,
        curve: M.curve,
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: selected ? C.actionFace : null,
          color: selected ? null : C.surfaceHigh,
          shape: BoxShape.circle,
          border: Border.all(
            color: selected ? const Color(0x00000000) : C.line,
          ),
        ),
        child: selected
            ? NIcon(Ico.check, size: 14, color: C.onAccent)
            : null,
      );
}
