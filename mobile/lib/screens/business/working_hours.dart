import 'package:flutter/material.dart' show showTimePicker, TimeOfDay;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

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
        (opening ? const TimeOfDay(hour: 9, minute: 0)
                 : const TimeOfDay(hour: 18, minute: 0));

    final picked = await showTimePicker(context: context, initialTime: current);
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

  static TimeOfDay? _parse(String hhmm) {
    final parts = hhmm.split(':');
    if (parts.length != 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return TimeOfDay(hour: h, minute: m);
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

    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: Column(
          children: [
            TopBar(title: tr('Ish vaqti'), subtitle: widget.company.name),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  Surface(
                    padding: EdgeInsets.zero,
                    shadow: E.e1,
                    child: Column(
                      children: [
                        for (var i = 0; i < 7; i++)
                          _DayRow(
                            name: names[i],
                            day: _days[i],
                            last: i == 6,
                            onToggle: () => setState(() {
                              final d = _days[i];
                              _days[i] = d.closed
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
                    ),
                  ),
                  const SizedBox(height: S.x16),
                  Text(
                    tr('Tungacha cho‘zilgan vaqt ham qabul qilinadi: '
                        '18:00–02:00 to‘g‘ri hisoblanadi.'),
                    style: T.caption.copyWith(fontSize: 11),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: S.x12),
                    Text(_error!, style: T.caption.copyWith(color: C.signal)),
                  ],
                  const SizedBox(height: S.x24),
                  PrimaryButton(tr('Saqlash'),
                      loading: _busy, onTap: _busy ? null : _save),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({
    required this.name,
    required this.day,
    required this.last,
    required this.onToggle,
    required this.onOpen,
    required this.onClose,
  });

  final String name;
  final DayHours day;
  final bool last;
  final VoidCallback onToggle;
  final VoidCallback onOpen;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x12),
        decoration: BoxDecoration(
          border: last ? null : Border(bottom: BorderSide(color: C.hairline)),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 96,
              child: Text(name, style: T.cardTitle.copyWith(fontSize: 13)),
            ),
            Expanded(
              child: day.closed
                  ? Text(tr('Dam olish'),
                      style: T.caption.copyWith(fontSize: 11.5))
                  : Row(
                      children: [
                        _TimeChip(day.open, onTap: onOpen),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          child: Text('–', style: T.caption),
                        ),
                        _TimeChip(day.close, onTap: onClose),
                      ],
                    ),
            ),
            Press(
              haptic: true,
              onTap: onToggle,
              child: Padding(
                padding: const EdgeInsets.only(left: S.x8),
                child: _Switch(on: !day.closed),
              ),
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
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(R.status),
            color: C.graphite,
            border: Border.all(color: C.hairline),
          ),
          child: Text(value.isEmpty ? '--:--' : value,
              style: T.code.copyWith(fontSize: 12.5)),
        ),
      );
}

class _Switch extends StatelessWidget {
  const _Switch({required this.on});
  final bool on;

  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: M.fade,
        curve: M.curve,
        width: 40,
        height: 24,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: on ? C.champagne.withValues(alpha: .28) : C.graphite,
          border: Border.all(
            color: on ? C.champagne.withValues(alpha: .5) : C.hairline,
          ),
        ),
        alignment: on ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          width: 18,
          height: 18,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: on ? C.champagne : C.muted,
          ),
        ),
      );
}
