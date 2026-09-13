import 'dart:math' as math;

import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';

import '../../data/nfc.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import '../identity/profile_screen.dart';

/// NFC SKANER — begona kartani telefonga tegizib, profilini ochish.
///
/// NIMA UCHUN KERAK: ilova NFCSTORE deb ataladi. Kartani tegizganda
/// nima bo'lishini ilovaning O'ZI ko'rsatmasa, mahsulotning asosiy
/// harakati ilovadan tashqarida qolardi.
///
/// XULQ: bitta o'qishdan keyin sessiya yopiladi va profil ochiladi.
/// Ochilganda `/api/tap/:code` chaqiriladi — statistika serverda
/// hisoblanadi, mijoz tomonda emas.
class NfcScanScreen extends StatefulWidget {
  const NfcScanScreen({super.key});

  @override
  State<NfcScanScreen> createState() => _NfcScanScreenState();
}

enum _Phase { checking, unsupported, waiting, unknown, error }

class _NfcScanScreenState extends State<NfcScanScreen> {
  _Phase _phase = _Phase.checking;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    // Ochiq qolgan sessiya keyingi o'qishni bloklaydi.
    Nfc.stop();
    super.dispose();
  }

  Future<void> _start() async {
    if (_busy) return;
    _busy = true;
    setState(() => _phase = _Phase.checking);

    final ok = await Nfc.available();
    if (!mounted) return;
    if (!ok) {
      _busy = false;
      setState(() => _phase = _Phase.unsupported);
      return;
    }

    setState(() => _phase = _Phase.waiting);
    final link = await Nfc.readLink();
    _busy = false;
    if (!mounted) return;

    if (link == null) {
      setState(() => _phase = _Phase.unknown);
      return;
    }

    HapticFeedback.mediumImpact();
    _open(link);
  }

  void _open(NfcLink link) {
    final state = AppScope.read(context);
    // Statistika serverda: natijani kutmaymiz, xatosi profilni yopmaydi.
    if (!link.company) {
      state.repo.tap(link.code).catchError((_) {});
    }
    Navigator.of(context).pushReplacement(
      SlidePage<void>(
        builder: (_) => link.company
            ? ProfileScreen(companyId: link.code)
            : ProfileScreen(code: link.code),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Column(
          children: [
            const TopBar(title: 'Kartani o‘qish'),
            Expanded(child: Center(child: _body())),
          ],
        ),
      );

  Widget _body() {
    switch (_phase) {
      case _Phase.checking:
        return const Spinner(size: 24);

      case _Phase.unsupported:
        // BOSHI BERK KO'CHA BO'LMASIN: NFC ko'pincha shunchaki
        // O'CHIRILGAN bo'ladi. Foydalanuvchi tizim sozlamalaridan
        // yoqib qaytadi — shu yerdayoq qayta tekshira olsin.
        return _Message(
          title: 'Bu qurilmada NFC yo‘q',
          text: 'NFC o‘chirilgan yoki qurilma uni qo‘llab-quvvatlamaydi. '
              'Sozlamalardan NFC‘ni yoqib, qayta tekshiring.',
          actionLabel: 'Qayta tekshirish',
          onAction: _start,
        );

      case _Phase.unknown:
        return _Message(
          title: 'Karta tanilmadi',
          text: 'Bu karta NFCSTORE kartasi emas yoki hali faollashtirilmagan.',
          actionLabel: 'Qayta urinish',
          onAction: _start,
        );

      case _Phase.error:
        return _Message(
          title: 'O‘qib bo‘lmadi',
          text: 'Kartani telefon orqasiga yaqinroq tuting.',
          actionLabel: 'Qayta urinish',
          onAction: _start,
        );

      case _Phase.waiting:
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _Pulse(),
              const SizedBox(height: S.x32),
              Text('Kartani telefonga tegizing',
                  textAlign: TextAlign.center, style: T.section),
              const SizedBox(height: S.x8),
              Text(
                'Kartani telefon orqasining yuqori qismiga yaqinlashtiring '
                'va bir necha soniya ushlab turing.',
                textAlign: TextAlign.center,
                style: T.caption,
              ),
              const SizedBox(height: S.x32),
              SizedBox(
                width: 200,
                child: GhostButton('Bekor qilish',
                    onTap: () => Navigator.of(context).maybePop()),
              ),
            ],
          ),
        );
    }
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.title,
    required this.text,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(title, textAlign: TextAlign.center, style: T.section),
            const SizedBox(height: S.x8),
            Text(text, textAlign: TextAlign.center, style: T.caption),
            if (actionLabel != null) ...[
              const SizedBox(height: S.x20),
              SizedBox(
                width: 200,
                child: SecondaryButton(actionLabel!, onTap: onAction),
              ),
            ],
          ],
        ),
      );
}

/// Kutish belgisi — markazda NFC ikonkasi, atrofida tarqaladigan ikki halqa.
///
/// `RepaintBoundary` ichida: uzluksiz animatsiya butun ekranni qayta
/// chizishga majburlamasin.
class _Pulse extends StatefulWidget {
  const _Pulse();

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RepaintBoundary(
        child: SizedBox(
          width: 180,
          height: 180,
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedBuilder(
                animation: _c,
                builder: (_, __) => CustomPaint(
                  size: const Size(180, 180),
                  painter: _PulsePainter(_c.value),
                ),
              ),
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [C.slate, C.graphite],
                  ),
                ),
                alignment: Alignment.center,
                child: const NIcon(Ico.nfc, size: 30, color: C.champagne),
              ),
            ],
          ),
        ),
      );
}

class _PulsePainter extends CustomPainter {
  _PulsePainter(this.t);
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    const minR = 40.0;
    final maxR = size.shortestSide / 2;

    for (var i = 0; i < 2; i++) {
      final p = (t + i * .5) % 1.0;
      final r = minR + (maxR - minR) * p;
      // Chetga borgan sari yo'qoladi — "tarqalish" hissi.
      final a = (1 - p) * .45;
      if (a <= 0) continue;
      canvas.drawCircle(
        center,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = C.champagne.withValues(alpha: math.max(0, a)),
      );
    }
  }

  @override
  bool shouldRepaint(_PulsePainter old) => old.t != t;
}
