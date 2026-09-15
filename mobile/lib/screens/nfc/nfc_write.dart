import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';

import '../../data/nfc.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import 'nfc_scan.dart';
import 'qr_share.dart';

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
///
/// UCH HOLAT BITTA EKRANDA: yozilmoqda · tayyor · uzildi. Ular
/// alohida ekran bo'lsa, odam kartani telefondan olib qo'yardi —
/// holat almashishi kartani ushlab turgan qo'l uchun ko'rinmay
/// qolardi.
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

  /// Bekor qilish belgisi. `Nfc.writeCode` ni to'xtatib bo'lmaydi —
  /// u o'z muddati bilan tugaydi. Shuning uchun bekor qilinganda
  /// SANOQ oshiriladi va kech kelgan javob e'tiborsiz qoldiriladi:
  /// aks holda odam bekor qilgandan keyin ekranda "tayyor" chiqib
  /// qolardi.
  int _attempt = 0;

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
    final attempt = ++_attempt;
    setState(() => _phase = _Phase.writing);

    final ok = await Nfc.writeCode(code, company: _company);
    if (!mounted || attempt != _attempt) return;

    HapticFeedback.mediumImpact();
    setState(() => _phase = ok ? _Phase.done : _Phase.failed);
  }

  /// Bekor qilish — sessiyani yopamiz va javobni e'tiborsiz
  /// qoldiramiz.
  Future<void> _cancel() async {
    _attempt++;
    setState(() => _phase = _Phase.idle);
    await Nfc.stop();
  }

  /// Kartaga AYNAN shu havola yoziladi (`Nfc.writeCode`).
  String get _writtenUrl => 'nfcstore.uz/${(_code ?? '').toLowerCase()}';

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);

    // Tanlash ro'yxati: faqat EGALIK QILINADIGAN ID'lar va kompaniyalar.
    final options = <({String code, String label, String sub, bool company, Tier tier})>[
      for (final r in state.cards)
        (
          code: r.code,
          label: r.code,
          sub: r.name.isEmpty ? tr('Shaxsiy') : r.name,
          company: false,
          tier: r.tier,
        ),
      for (final c in state.companies)
        (
          code: c.id,
          label: c.id.toUpperCase(),
          sub: c.name,
          company: true,
          tier: TierStyle.parse(c.tier),
        ),
    ];

    // Birinchi ochilishda faol ID tanlangan bo'lsin.
    if (_code == null && options.isNotEmpty) {
      final active = state.active;
      final match = options.where((o) => o.code == active?.code);
      final pick = match.isNotEmpty ? match.first : options.first;
      _code = pick.code;
      _company = pick.company;
    }

    return ScreenBackdrop(
      aura: Aura.nfc,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(title: tr('Kartaga yozish')),
            Expanded(
              child: switch (_phase) {
                _Phase.writing => _WritingView(
                    code: _code ?? '',
                    onCancel: _cancel,
                  ),
                _Phase.done => _DoneView(
                    url: _writtenUrl,
                    onVerify: () => push<void>(
                      context,
                      (_) => const NfcScanScreen(),
                    ),
                    onAgain: () => setState(() => _phase = _Phase.idle),
                  ),
                _Phase.failed => _FailedView(
                    onRetry: _write,
                    onQr: state.active == null
                        ? null
                        : () => push<void>(
                              context,
                              (_) => QrShareScreen(identity: state.active!),
                            ),
                  ),
                _ => _PickView(
                    options: options,
                    selected: _code,
                    unsupported: _phase == _Phase.unsupported,
                    onPick: (o) => setState(() {
                      _code = o.code;
                      _company = o.company;
                    }),
                    onWrite: _phase == _Phase.unsupported || options.isEmpty
                        ? null
                        : _write,
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 1 — ID TANLASH
// ─────────────────────────────────────────────────────────────

typedef _Option = ({String code, String label, String sub, bool company, Tier tier});

class _PickView extends StatelessWidget {
  const _PickView({
    required this.options,
    required this.selected,
    required this.unsupported,
    required this.onPick,
    required this.onWrite,
  });

  final List<_Option> options;
  final String? selected;
  final bool unsupported;
  final ValueChanged<_Option> onPick;
  final VoidCallback? onWrite;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
              children: [
                // QAYTARIB BO'LMAYDIGAN AMAL — ogohlantirish
                // tugmadan OLDIN turadi, keyin emas.
                Surface(
                  padding: const EdgeInsets.all(S.x16),
                  border: Border.all(color: C.warn.withValues(alpha: .38)),
                  shadow: C.e1,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      NIcon(Ico.warning, size: 18, color: C.warn),
                      const SizedBox(width: S.x12),
                      Expanded(
                        child: Text(
                          tr('Yozish kartadagi eski havolani butunlay '
                              'almashtiradi. NFCSTORE‘dan kelgan karta '
                              'allaqachon yozilgan — uni qayta yozish '
                              'shart emas.'),
                          style: T.caption,
                        ),
                      ),
                    ],
                  ),
                ),
                if (unsupported) ...[
                  const SizedBox(height: S.x12),
                  Surface(
                    padding: const EdgeInsets.all(S.x16),
                    border: Border.all(color: C.fail.withValues(alpha: .38)),
                    shadow: C.e1,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        NIcon(Ico.ban, size: 18, color: C.fail),
                        const SizedBox(width: S.x12),
                        Expanded(
                          child: Text(
                            tr('Bu qurilmada NFC yo‘q yoki o‘chirilgan.'),
                            style: T.caption.copyWith(color: C.fail),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: S.x24),
                if (options.isEmpty)
                  Text(tr('Yozish uchun ID‘ingiz yo‘q.'), style: T.body)
                else ...[
                  Eyebrow(tr('Qaysi ID yozilsin')),
                  const SizedBox(height: S.x12),
                  for (var i = 0; i < options.length; i++) ...[
                    if (i > 0) const SizedBox(height: S.x8),
                    _OptionRow(
                      option: options[i],
                      selected: options[i].code == selected,
                      onTap: () => onPick(options[i]),
                    ),
                  ],
                ],
              ],
            ),
          ),
          StickyBar(
            child: PrimaryButton(tr('Kartaga yozish'), onTap: onWrite),
          ),
        ],
      );
}

class _OptionRow extends StatelessWidget {
  const _OptionRow({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final _Option option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Surface(
        onTap: onTap,
        padding: const EdgeInsets.all(S.x12),
        border: Border.all(
          color: selected ? C.lineStrong : C.line,
          width: selected ? 1.4 : 1,
        ),
        shadow: C.e1,
        child: Row(
          children: [
            TierDot(option.tier, size: 14),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(option.label, style: T.code(15)),
                  const SizedBox(height: 3),
                  Text(
                    option.sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.caption.copyWith(fontSize: 12.5),
                  ),
                ],
              ),
            ),
            // Tanlangan holat halqa bilan ham, belgi bilan ham
            // bildiriladi — faqat rang bilan emas.
            if (selected) const VerifiedBadge(size: 20),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// 2 — YOZILMOQDA
// ─────────────────────────────────────────────────────────────

/// Kutish aylanasi va uning markazida foiz.
///
/// FOIZ NIMANI O'LCHAYDI: `Nfc.writeCode` yozish jarayonini bosqichma
/// bosqich xabar qilmaydi — u faqat oxirida `true`/`false` qaytaradi.
/// Shuning uchun aylana O'QISH OYNASINI ko'rsatadi: 20 soniyalik
/// muddatning qanchasi o'tgani. Bu yolg'on emas — odam aynan shuncha
/// vaqt kartani ushlab turishi kerak.
class _WritingView extends StatefulWidget {
  const _WritingView({required this.code, required this.onCancel});

  final String code;
  final VoidCallback onCancel;

  @override
  State<_WritingView> createState() => _WritingViewState();
}

class _WritingViewState extends State<_WritingView>
    with SingleTickerProviderStateMixin {
  /// `Nfc.writeCode` ning standart muddati.
  static const _window = Duration(seconds: 20);

  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: _window,
  )..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            RepaintBoundary(
              child: SizedBox(
                width: 168,
                height: 168,
                child: AnimatedBuilder(
                  animation: _c,
                  builder: (context, _) => CustomPaint(
                    painter: _RingPainter(_c.value, C.accent),
                    child: Center(
                      child: Text(
                        '${(_c.value * 100).round()}%',
                        style: T.code(26, color: C.ink),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: S.x32),
            Text(
              tr('Kartani ushlab turing'),
              textAlign: TextAlign.center,
              style: T.section,
            ),
            const SizedBox(height: S.x8),
            Text(
              trf('{kod} kartaga yozilmoqda. Telefonni olmang.',
                  {'kod': widget.code}),
              textAlign: TextAlign.center,
              style: T.caption,
            ),
            const SizedBox(height: S.x32),
            GhostButton(tr('BEKOR QILISH'), onTap: widget.onCancel),
          ],
        ),
      );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.t, this.color);

  final double t;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide - 8) / 2;

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..color = color.withValues(alpha: .16),
    );

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -1.5707963,
      6.2831853 * t.clamp(0.0, 1.0),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.t != t || old.color != color;
}

// ─────────────────────────────────────────────────────────────
// 3 — TAYYOR
// ─────────────────────────────────────────────────────────────

class _DoneView extends StatelessWidget {
  const _DoneView({
    required this.url,
    required this.onVerify,
    required this.onAgain,
  });

  final String url;
  final VoidCallback onVerify;
  final VoidCallback onAgain;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 104,
              height: 104,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: C.ok.withValues(alpha: .12),
                border: Border.all(color: C.ok.withValues(alpha: .5), width: 2),
              ),
              alignment: Alignment.center,
              child: NIcon(Ico.check, size: 44, color: C.ok),
            ),
            const SizedBox(height: S.x32),
            Text(tr('Karta tayyor'), textAlign: TextAlign.center, style: T.section),
            const SizedBox(height: S.x8),
            Text(
              trf('Endi bu kartani tegizgan odam {url} profilini ko‘radi.',
                  {'url': url}),
              textAlign: TextAlign.center,
              style: T.caption,
            ),
            const SizedBox(height: S.x32),
            PrimaryButton(tr('Tekshirib ko‘rish'), onTap: onVerify),
            const SizedBox(height: S.x12),
            SecondaryButton(tr('Yana yozish'), onTap: onAgain),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// 4 — UZILDI
// ─────────────────────────────────────────────────────────────

class _FailedView extends StatelessWidget {
  const _FailedView({required this.onRetry, required this.onQr});

  final VoidCallback onRetry;
  final VoidCallback? onQr;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 104,
              height: 104,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: C.fail.withValues(alpha: .10),
                border: Border.all(color: C.fail.withValues(alpha: .45), width: 2),
              ),
              alignment: Alignment.center,
              child: NIcon(Ico.close, size: 40, color: C.fail),
            ),
            const SizedBox(height: S.x32),
            Text(tr('Yozish uzildi'), textAlign: TextAlign.center, style: T.section),
            const SizedBox(height: S.x8),
            Text(
              tr('Karta yozish paytida uzoqlashdi yoki himoyalangan. '
                  'Karta o‘zgarmadi.'),
              textAlign: TextAlign.center,
              style: T.caption,
            ),
            const SizedBox(height: S.x32),
            PrimaryButton(tr('Qayta urinish'), onTap: onRetry),
            const SizedBox(height: S.x12),
            SecondaryButton(tr('QR bilan ulashish'), onTap: onQr),
          ],
        ),
      );
}
