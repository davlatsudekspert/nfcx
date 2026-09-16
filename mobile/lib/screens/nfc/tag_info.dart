import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter/widgets.dart';

import '../../data/nfc.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/nfc_wave.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/toast.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import 'nfc_write.dart';

/// TEG MA'LUMOTI (prototip: "Teg ma'lumoti").
///
/// NIMA UCHUN KERAK: karta ishlamaganda sabab shu yerda ko'rinadi —
/// teg qulflangan, hajmi yetmaydi yoki umuman boshqa turdagi teg
/// ekan. Busiz odam "nega yozilmayapti?" degan savol bilan qolardi
/// va yordamga yozardi.
///
/// HECH NARSA TO'QILMAYDI: platforma bermagan maydon "—" bo'lib
/// qoladi. Soxta "NTAG215" yozib qo'yish eng yomon yo'l edi: odam
/// tegning boshqa turdaligini bilmay, qayta-qayta urinardi.
class TagInfoScreen extends StatefulWidget {
  const TagInfoScreen({super.key});

  @override
  State<TagInfoScreen> createState() => _TagInfoScreenState();
}

class _TagInfoScreenState extends State<TagInfoScreen> {
  TagInfo? _info;
  bool _scanning = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scan());
  }

  @override
  void dispose() {
    Nfc.stop();
    super.dispose();
  }

  Future<void> _scan() async {
    setState(() {
      _scanning = true;
      _done = false;
    });
    final info = await Nfc.readTagInfo();
    if (!mounted) return;
    setState(() {
      _info = info;
      _scanning = false;
      _done = true;
    });
    if (info != null) successHaptic();
  }

  @override
  Widget build(BuildContext context) {
    final info = _info;

    return ScreenBackdrop(
      aura: Aura.nfc,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(title: tr('Teg ma’lumoti')),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  if (_scanning)
                    const _Waiting()
                  else if (info == null)
                    EmptyState(
                      tr('Teg topilmadi. Kartani telefon orqasiga tegizib, '
                          'qayta urinib ko‘ring.'),
                      title: _done ? tr('Teg o‘qilmadi') : tr('Tegizing'),
                      icon: Ico.nfc,
                      actionLabel: tr('Qayta urinish'),
                      onAction: _scan,
                    )
                  else ...[
                    // HAQIQIYLIK — birinchi javob. Odam ko'pincha
                    // aynan shuni bilmoqchi: bu NFCSTORE kartasimi?
                    StatusChip(
                      info.isOurs
                          ? '${tr('Haqiqiy NFCSTORE kartasi')} ✓'
                          : tr('Begona teg'),
                      tone: info.isOurs ? StatusTone.ok : StatusTone.neutral,
                    ),
                    const SizedBox(height: S.x16),

                    // TEXNIK MAYDONLAR — ikkitadan qatorda
                    // (prototip: `.taginfo`).
                    Row(
                      children: [
                        Expanded(
                          child: _Field(
                            label: tr('Teg turi'),
                            value: info.kind,
                          ),
                        ),
                        const SizedBox(width: S.x8),
                        Expanded(
                          child: _Field(
                            label: tr('Hajmi'),
                            value: info.maxSize == null
                                ? null
                                : '${info.maxSize} ${tr('bayt')}',
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: S.x8),
                    Row(
                      children: [
                        Expanded(
                          child: _Field(
                            label: tr('Yozish'),
                            value: info.writable == null
                                ? null
                                : info.writable!
                                    ? tr('Mumkin')
                                    : tr('Mumkin emas'),
                          ),
                        ),
                        const SizedBox(width: S.x8),
                        Expanded(
                          child: _Field(
                            label: tr('Qulf'),
                            value: info.writable == null
                                ? null
                                : info.writable!
                                    ? tr('Ochiq')
                                    : tr('Qulflangan'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: S.x8),
                    _Field(
                      label: tr('Ichidagi yozuv'),
                      value: info.payload,
                      wide: true,
                    ),
                    const SizedBox(height: S.x8),
                    _Field(
                      label: tr('Seriya raqami'),
                      value: info.serial,
                      wide: true,
                    ),

                    const SizedBox(height: S.x20),
                    Row(
                      children: [
                        Expanded(
                          child: SecondaryButton(
                            tr('Nusxalash'),
                            icon: Ico.copy,
                            onTap: (info.payload ?? '').isEmpty
                                ? null
                                : () {
                                    Clipboard.setData(
                                      ClipboardData(text: info.payload!),
                                    );
                                    showToast(context, tr('Nusxalandi'));
                                  },
                          ),
                        ),
                        const SizedBox(width: S.x8),
                        Expanded(
                          child: PrimaryButton(
                            tr('Qayta yozish'),
                            onTap: () =>
                                push<void>(context, (_) => const NfcWriteScreen()),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: S.x12),
                    Center(
                      child: GhostButton(
                        tr('Boshqa tegni o‘qish'),
                        color: C.ink2,
                        onTap: _scan,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Waiting extends StatelessWidget {
  const _Waiting();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: S.x32),
        child: Column(
          children: [
            NfcWave(size: 120, active: true),
            const SizedBox(height: S.x24),
            Text(
              tr('Kartani telefon orqasiga tegizing'),
              textAlign: TextAlign.center,
              style: T.section,
            ),
            const SizedBox(height: 6),
            Text(
              tr('Teg o‘qilgach, uning turi va hajmi shu yerda chiqadi.'),
              textAlign: TextAlign.center,
              style: T.caption.copyWith(fontSize: 12.5),
            ),
          ],
        ),
      );
}

/// Bitta maydon — yorliq va qiymat (prototip: `.taginfo .k`).
///
/// Qiymat `null` bo'lsa "—": platforma bermagan narsani o'ylab
/// topib bo'lmaydi.
class _Field extends StatelessWidget {
  const _Field({required this.label, this.value, this.wide = false});

  final String label;
  final String? value;
  final bool wide;

  @override
  Widget build(BuildContext context) => Container(
        width: wide ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: S.x12, vertical: 10),
        decoration: BoxDecoration(
          color: C.surface,
          borderRadius: BorderRadius.circular(R.tile),
          border: Border.all(color: C.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: T.caption.copyWith(fontSize: 10.5)),
            const SizedBox(height: 2),
            Text(
              (value ?? '').isEmpty ? '—' : value!,
              maxLines: wide ? 2 : 1,
              overflow: TextOverflow.ellipsis,
              style: T.code(13, color: C.ink),
            ),
          ],
        ),
      );
}
