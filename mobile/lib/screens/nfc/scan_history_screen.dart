import 'package:flutter/widgets.dart';

import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/scan_history.dart';
import '../identity/profile_screen.dart';

/// TEGIZISHLAR TARIXI (prototip: "Tegizishlar tarixi").
///
/// FAQAT SHU TELEFONDA. Ro'yxat hech qayerga yuborilmaydi: unda
/// begona va bo'sh teglar ham bor va ularni serverga tashish
/// odamning yurishini kuzatish bo'lardi. Shuning uchun "Tozalash"
/// tugmasi ham bor va u haqiqatan hammasini o'chiradi.
class ScanHistoryScreen extends StatefulWidget {
  const ScanHistoryScreen({super.key});

  @override
  State<ScanHistoryScreen> createState() => _ScanHistoryScreenState();
}

class _ScanHistoryScreenState extends State<ScanHistoryScreen> {
  final _history = ScanHistory();

  @override
  void initState() {
    super.initState();
    _history.addListener(_onChange);
    _history.load();
  }

  @override
  void dispose() {
    _history.removeListener(_onChange);
    _history.dispose();
    super.dispose();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  Future<void> _clear() async {
    final ok = await confirmSheet(
      context,
      title: tr('Tarixni tozalash'),
      message: tr('Bu ro‘yxat faqat shu telefonda saqlanadi va butunlay '
          'o‘chadi.'),
      confirmLabel: tr('Tozalash'),
      danger: true,
    );
    if (!ok) return;
    await _history.clear();
  }

  @override
  Widget build(BuildContext context) {
    final items = _history.items;

    return ScreenBackdrop(
      aura: Aura.nfc,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(
              title: tr('Tegizishlar tarixi'),
              trailing: items.isEmpty
                  ? null
                  : RoundButton(
                      Ico.trash,
                      size: 40,
                      iconSize: 17,
                      onTap: _clear,
                    ),
            ),
            Expanded(
              child: !_history.loaded
                  ? const SizedBox()
                  : items.isEmpty
                      ? Center(
                          child: EmptyState(
                            tr('Kartani telefon orqasiga tegizsangiz, u shu '
                                'yerda qoladi.'),
                            title: tr('Hali hech narsa tegizilmagan'),
                            icon: Ico.nfc,
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(
                            S.gutter,
                            0,
                            S.gutter,
                            S.x32,
                          ),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: S.x8),
                          itemBuilder: (context, i) => _Row(entry: items[i]),
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.entry});

  final ScanEntry entry;

  @override
  Widget build(BuildContext context) {
    final known = entry.known;

    return Surface(
      padding: const EdgeInsets.all(S.x12),
      onTap: known
          ? () => push<void>(
                context,
                (_) => entry.isCompany
                    ? ProfileScreen(companyId: entry.code)
                    : ProfileScreen(code: entry.code),
              )
          : null,
      child: Row(
        children: [
          if (known)
            Avatar(name: entry.name, size: 38, square: entry.isCompany)
          else
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: C.ink3.withValues(alpha: .12),
                borderRadius: BorderRadius.circular(R.status),
              ),
              alignment: Alignment.center,
              child: NIcon(Ico.nfc, size: 18, color: C.ink3),
            ),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  known
                      ? '${entry.code}${entry.name.isEmpty ? '' : ' · ${entry.name}'}'
                      : tr('Noma’lum teg'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.cardTitle.copyWith(fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    ago(entry.at),
                    if (entry.kind.isNotEmpty) entry.kind,
                    if (entry.outcome.isNotEmpty) entry.outcome,
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.caption.copyWith(fontSize: 12),
                ),
              ],
            ),
          ),
          if (known)
            NIcon(Ico.chevronRight, size: 16, color: C.ink3),
        ],
      ),
    );
  }
}
