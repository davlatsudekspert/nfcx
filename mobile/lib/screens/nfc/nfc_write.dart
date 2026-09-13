import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';

import '../../data/nfc.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// BO'SH KARTAGA YOZISH — o'z ID havolasini NFC kartaga yozish.
///
/// NIMA UCHUN ALOHIDA EKRAN VA OGOHLANTIRISH BILAN: yozish kartadagi
/// eski ma'lumotni butunlay almashtiradi. NFCSTORE'dan kelgan karta
/// allaqachon yozilgan bo'ladi — bu ekran FAQAT bo'sh yoki o'zining
/// eski kartasi uchun.
///
/// XAVFSIZLIK: faqat `https://nfcstore.uz/<kod>` yoziladi va faqat
/// FOYDALANUVCHI EGALIK QILADIGAN ID'lar ro'yxatdan tanlanadi.
/// Ixtiyoriy matn yozish imkoni yo'q.
class NfcWriteScreen extends StatefulWidget {
  const NfcWriteScreen({super.key});

  @override
  State<NfcWriteScreen> createState() => _NfcWriteScreenState();
}

enum _Phase { idle, unsupported, writing, done, failed }

class _NfcWriteScreenState extends State<NfcWriteScreen> {
  _Phase _phase = _Phase.idle;
  String? _code;
  bool _company = false;

  @override
  void initState() {
    super.initState();
    _check();
  }

  @override
  void dispose() {
    Nfc.stop();
    super.dispose();
  }

  Future<void> _check() async {
    final ok = await Nfc.available();
    if (!mounted || ok) return;
    setState(() => _phase = _Phase.unsupported);
  }

  Future<void> _write() async {
    final code = _code;
    if (code == null || _phase == _Phase.writing) return;
    setState(() => _phase = _Phase.writing);

    final ok = await Nfc.writeCode(code, company: _company);
    if (!mounted) return;

    HapticFeedback.mediumImpact();
    setState(() => _phase = ok ? _Phase.done : _Phase.failed);
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);

    // Tanlash ro'yxati: faqat EGALIK QILINADIGAN ID'lar va kompaniyalar.
    final options = <({String code, String label, String sub, bool company})>[
      for (final r in state.cards)
        (
          code: r.code,
          label: r.code,
          sub: r.name.isEmpty ? 'Shaxsiy' : r.name,
          company: false,
        ),
      for (final c in state.companies)
        (code: c.id, label: c.id.toUpperCase(), sub: c.name, company: true),
    ];

    // Birinchi ochilishda faol ID tanlangan bo'lsin.
    if (_code == null && options.isNotEmpty) {
      final active = state.active;
      final match = options.where((o) => o.code == active?.code);
      final pick = match.isNotEmpty ? match.first : options.first;
      _code = pick.code;
      _company = pick.company;
    }

    return SafeArea(
      child: Column(
        children: [
          const TopBar(title: 'Kartaga yozish'),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
              children: [
                Surface(
                  padding: const EdgeInsets.all(S.x16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const NIcon(Ico.nfc, size: 20, color: C.champagne),
                      const SizedBox(width: S.x12),
                      Expanded(
                        child: Text(
                          'Yozish kartadagi eski havolani butunlay almashtiradi. '
                          'NFCSTORE‘dan kelgan karta allaqachon yozilgan — uni '
                          'qayta yozish shart emas.',
                          style: T.caption,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: S.x20),
                if (options.isEmpty)
                  Text('Yozish uchun ID‘ingiz yo‘q.', style: T.body)
                else ...[
                  const Eyebrow('Qaysi ID yozilsin'),
                  const SizedBox(height: S.x8),
                  for (var i = 0; i < options.length; i++) ...[
                    if (i > 0) const SizedBox(height: S.x8),
                    _Option(
                      label: options[i].label,
                      sub: options[i].sub,
                      selected: options[i].code == _code,
                      onTap: _phase == _Phase.writing
                          ? null
                          : () => setState(() {
                                _code = options[i].code;
                                _company = options[i].company;
                                if (_phase != _Phase.unsupported) {
                                  _phase = _Phase.idle;
                                }
                              }),
                    ),
                  ],
                  const SizedBox(height: S.x20),
                  _status(),
                  const SizedBox(height: S.x12),
                  PrimaryButton(
                    _phase == _Phase.done ? 'Yana yozish' : 'Kartaga yozish',
                    loading: _phase == _Phase.writing,
                    onTap: _phase == _Phase.unsupported ? null : _write,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _status() {
    final (String text, Color color) = switch (_phase) {
      _Phase.unsupported => (
          'Bu qurilmada NFC yo‘q yoki o‘chirilgan.',
          C.signal,
        ),
      _Phase.writing => ('Kartani telefonga tegizib turing…', C.ash),
      _Phase.done => ('Yozildi. Kartani tekshirib ko‘ring.', C.verdant),
      _Phase.failed => (
          'Yozib bo‘lmadi — karta himoyalangan yoki juda tez olindi.',
          C.signal,
        ),
      _Phase.idle => (
          'Tugmani bosing, keyin kartani telefon orqasiga tegizing.',
          C.muted,
        ),
    };
    return Text(text, style: T.caption.copyWith(color: color));
  }
}

class _Option extends StatelessWidget {
  const _Option({
    required this.label,
    required this.sub,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String sub;
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
                    Text(label, style: T.code.copyWith(fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text(sub,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.caption.copyWith(fontSize: 11)),
                  ],
                ),
              ),
              if (selected)
                const NIcon(Ico.check, size: 16, color: C.champagne),
            ],
          ),
        ),
      );
}
