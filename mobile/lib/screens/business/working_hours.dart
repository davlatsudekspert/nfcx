import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// ISH VAQTI — haftaning yetti kuni.
///
/// NIMA UCHUN ALOHIDA EKRAN: yetti kun × ikki vaqt × kalit = 21 ta
/// element. Ularni biznes tahririga qo'shsak, o'sha ekran ikki
/// barobar uzayardi va eng ko'p ishlatiladigan maydonlar (nom,
/// telefon) pastga siljib ketardi.
///
/// SERVER QOIDASI: ochilish yoki yopilish bo'sh bo'lsa kun YOPIQ
/// deb yoziladi (`normalizeHoursD1`). Shuning uchun bu yerda ham
/// "ochiq, lekin vaqtsiz" holat yaratib bo'lmaydi.
///
/// TUNGACHA CHO'ZILGAN VAQT QO'LLAB-QUVVATLANADI: 18:00–02:00
/// to'g'ri yoziladi va server "hozir ochiqmi?" ni to'g'ri
/// hisoblaydi.
class WorkingHoursScreen extends StatefulWidget {
  const WorkingHoursScreen({super.key, required this.company});

  final Company company;

  @override
  State<WorkingHoursScreen> createState() => _WorkingHoursScreenState();
}

/// Dushanbadan boshlanadi — O'zbekistonda hafta shunday boshlanadi.
List<String> _dayNames() => [
      tr('Dushanba'),
      tr('Seshanba'),
      tr('Chorshanba'),
      tr('Payshanba'),
      tr('Juma'),
      tr('Shanba'),
      tr('Yakshanba'),
    ];

class _WorkingHoursScreenState extends State<WorkingHoursScreen> {
  late final List<DayHours> _days = _initial();

  bool _busy = false;
  String? _error;

  /// Server har doim 7 ta kun beradi. Bermasa ham (eski yozuv)
  /// ro'yxat 7 tagacha to'ldiriladi — indeks bo'yicha murojaat
  /// hech qachon chegaradan chiqmasin.
  List<DayHours> _initial() {
    final src = widget.company.hours;
    return List<DayHours>.generate(
      7,
      (i) => i < src.length ? src[i] : const DayHours(),
    );
  }

  Future<void> _pick(int index, {required bool opening}) async {
    final day = _days[index];
    final current = _parse(opening ? day.open : day.close) ??
        (opening ? (hour: 9, minute: 0) : (hour: 18, minute: 0));

    final picked = await showTimeSheet(
      context,
      title: opening ? tr('Ochilish') : tr('Yopilish'),
      hour: current.hour,
      minute: current.minute,
    );
    if (picked == null || !mounted) return;

    final value = '${_two(picked.hour)}:${_two(picked.minute)}';
    setState(() {
      _days[index] = opening
          ? day.copyWith(open: value, closed: false)
          : day.copyWith(close: value, closed: false);
      // Ikkinchi vaqt hali yo'q bo'lsa, kun YOPIQ bo'lib qoladi —
      // serverning qoidasi shunday. Foydalanuvchi buni ko'rib
      // tursin, saqlaganda kutilmaganda yo'qolmasin.
      final d = _days[index];
      if (d.open.isEmpty || d.close.isEmpty) {
        _days[index] = d.copyWith(closed: true);
      }
    });
  }

  static String _two(int v) => v.toString().padLeft(2, '0');

  static ({int hour, int minute})? _parse(String hhmm) {
    final parts = hhmm.split(':');
    if (parts.length != 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return (hour: h, minute: m);
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state = AppScope.read(context);
      await state.repo.updateHours(widget.company.id, _days);
      successHaptic();
      await state.refreshIdentities();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final names = _dayNames();

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
                    tr('Ish vaqti'),
                    eyebrow: widget.company.name,
                    subtitle: tr('Har kun uchun ochilish va yopilish vaqti.'),
                  ),
                  for (var i = 0; i < 7; i++) ...[
                    if (i > 0) const SizedBox(height: S.x8),
                    _DayCard(
                      name: names[i],
                      day: _days[i],
                      onToggle: (open) => setState(() {
                        final d = _days[i];
                        _days[i] = open
                            // Ochayotganda standart vaqt: bo'sh
                            // qoldirsak server kunni yana yopib
                            // qo'yardi va kalit "ishlamagandek"
                            // ko'rinardi.
                            ? d.copyWith(
                                closed: false,
                                open: d.open.isEmpty ? '09:00' : d.open,
                                close: d.close.isEmpty ? '18:00' : d.close,
                              )
                            : d.copyWith(closed: true);
                      }),
                      onOpen: () => _pick(i, opening: true),
                      onClose: () => _pick(i, opening: false),
                    ),
                  ],
                  const SizedBox(height: S.x16),
                  Text(
                    tr('Tungacha cho‘zilgan vaqt ham qabul qilinadi: '
                        '18:00–02:00 to‘g‘ri hisoblanadi.'),
                    style: T.caption,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: S.x12),
                    Text(_error!, style: T.caption.copyWith(color: C.fail)),
                  ],
                  SizedBox(height: StickyBar.inset(context)),
                ],
              ),
            ),
            StickyBar(
              child: PrimaryButton(
                tr('Saqlash'),
                loading: _busy,
                onTap: _busy ? null : _save,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// BITTA KUN — nom, kalit va ikki vaqt.
class _DayCard extends StatelessWidget {
  const _DayCard({
    required this.name,
    required this.day,
    required this.onToggle,
    required this.onOpen,
    required this.onClose,
  });

  final String name;
  final DayHours day;
  final ValueChanged<bool> onToggle;
  final VoidCallback onOpen;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.fromLTRB(S.x16, S.x12, S.x12, S.x12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(name, style: T.cardTitle)),
                const SizedBox(width: S.x12),
                Toggle(value: !day.closed, onChanged: onToggle),
              ],
            ),
            const SizedBox(height: S.x4),
            if (day.closed)
              Text(tr('Dam olish'), style: T.caption)
            else
              Row(
                children: [
                  _TimeChip(day.open, onTap: onOpen),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.x8),
                    child: Text('–', style: T.meta),
                  ),
                  _TimeChip(day.close, onTap: onClose),
                ],
              ),
          ],
        ),
      );
}

class _TimeChip extends StatelessWidget {
  const _TimeChip(this.value, {required this.onTap});

  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        minSize: S.tap,
        scale: .95,
        child: Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: S.x16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: C.surface,
            borderRadius: BorderRadius.circular(R.chip),
            border: Border.all(color: C.line),
          ),
          child: Text(
            value.isEmpty ? '--:--' : value,
            style: T.code(15),
          ),
        ),
      );
}

/// VAQT TANLASH OYNASI.
///
/// Material'ning soat dialogi ISHLATILMAYDI: u boshqa dizayn
/// tilida gapiradi (dumaloq siferblat, boshqa shrift va ranglar) va
/// ilovaning qolgan qismidan ajralib turardi. Bu yerda esa oddiy
/// ikkita g'ildirak — daqiqa aniqligi to'liq saqlanadi.
Future<({int hour, int minute})?> showTimeSheet(
  BuildContext context, {
  required String title,
  required int hour,
  required int minute,
}) {
  var h = hour;
  var m = minute;

  return showSheet<({int hour, int minute})>(
    context,
    title: title,
    child: Column(
      children: [
        SizedBox(
          height: S.x44 * 4,
          child: Row(
            children: [
              Expanded(
                child: _Wheel(
                  count: 24,
                  initial: hour,
                  onChanged: (v) => h = v,
                ),
              ),
              Text(':', style: T.code(22, color: C.ink3)),
              Expanded(
                child: _Wheel(
                  count: 60,
                  initial: minute,
                  onChanged: (v) => m = v,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: S.x20),
        PrimaryButton(
          tr('Tayyor'),
          onTap: () => Navigator.of(context).pop((hour: h, minute: m)),
        ),
      ],
    ),
  );
}

class _Wheel extends StatelessWidget {
  const _Wheel({
    required this.count,
    required this.initial,
    required this.onChanged,
  });

  final int count;
  final int initial;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) => ListWheelScrollView.useDelegate(
        controller: FixedExtentScrollController(
          initialItem: initial.clamp(0, count - 1),
        ),
        itemExtent: S.x44,
        perspective: .002,
        physics: const FixedExtentScrollPhysics(),
        onSelectedItemChanged: onChanged,
        childDelegate: ListWheelChildBuilderDelegate(
          childCount: count,
          builder: (context, i) => Center(
            child: Text(
              i.toString().padLeft(2, '0'),
              style: T.code(22),
            ),
          ),
        ),
      );
}
