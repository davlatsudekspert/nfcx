import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import 'surfaces.dart';

/// Orb MARKAZIDAGI brend belgisining kengligi — orb widget o'lchamiga
/// nisbatan.
///
/// NIMA UCHUN 0.40, 0.68 EMAS: orbning KO'RINADIGAN oltin yadrosi
/// widget qutisining hammasi emas. `_OrbPainter` da yadro radiusi
/// `size * .30 * (.95..1.01)`, ustiga organik wobble ±5%. Ya'ni
/// yadro diametri widget o'lchamining ~0.54–0.64 qismi; qolgani
/// halo va pulse halqalariga ketadi.
///
/// 0.40 * size — bu YADRO diametrining ~68% i. Belgi 1.955:1
/// nisbatda bo'lgani uchun balandligi 0.205 * size, eng uzoq
/// burchagi markazdan 0.222 * size uzoqlikda. Yadroning eng tor
/// holatidagi radiusi esa 0.270 * size — ya'ni har doim ~18%
/// zaxira qoladi va belgi nafas/wobble paytida ham chetga chiqmaydi.
const double kOrbMarkRatio = .40;

/// Orb qanday holatda.
enum OrbState { idle, scanning, success, error }

/// NFC markazining yuragi: nafas oluvchi organik shakl, yumshoq halo va
/// uchta ketma-ket chiqadigan pulse halqasi.
///
/// TEXNIK QAROR: hamma narsa BITTA `CustomPainter` ichida chiziladi.
/// Har halqa alohida widget bo'lganda 4 ta `AnimationController` va
/// 4 ta layout o'tishi kerak bo'lardi; bu yerda bitta kontroller va
/// bitta repaint. 60fps'da farqi sezilarli.
class NfcOrb extends StatefulWidget {
  const NfcOrb({
    super.key,
    this.size = 260,
    this.state = OrbState.idle,
    this.onTap,
    this.child,
  });

  final double size;
  final OrbState state;
  final VoidCallback? onTap;

  /// Markazdagi belgi — odatda `BrandLogo` yoki NFC ikonkasi.
  final Widget? child;

  @override
  State<NfcOrb> createState() => _NfcOrbState();
}

class _NfcOrbState extends State<NfcOrb> with TickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(
    vsync: this,
    duration: Motion.breathe,
  );
  late final AnimationController _waves = AnimationController(
    vsync: this,
    duration: Motion.wave,
  );

  @override
  void initState() {
    super.initState();
    _breath.repeat(reverse: true);
    _waves.repeat();
  }

  @override
  void didUpdateWidget(covariant NfcOrb old) {
    super.didUpdateWidget(old);
    // Skanerlashda to'lqinlar tezlashadi — foydalanuvchi "ilova eshitmoqda"
    // ekanini ko'radi. Yakunlanganda esa tinchiydi.
    final wantFast = widget.state == OrbState.scanning;
    final target = wantFast ? const Duration(milliseconds: 1500) : Motion.wave;
    if (_waves.duration != target) {
      _waves
        ..duration = target
        ..repeat();
    }
  }

  @override
  void dispose() {
    _breath.dispose();
    _waves.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final still = reduceMotion(context);

    final accent = switch (widget.state) {
      OrbState.success => t.success,
      OrbState.error => t.error,
      _ => t.accent2,
    };

    return PressableScale(
      onTap: widget.onTap,
      scale: .95,
      child: SizedBox(
        width: widget.size,
        height: widget.size,
        child: AnimatedBuilder(
          animation: Listenable.merge([_breath, _waves]),
          builder: (context, child) => CustomPaint(
            painter: _OrbPainter(
              t: t,
              accent: accent,
              breath: still ? .5 : Curves.easeInOut.transform(_breath.value),
              wave: still ? 0 : _waves.value,
              showWaves: !still,
            ),
            child: child,
          ),
          child: Center(child: widget.child),
        ),
      ),
    );
  }
}

class _OrbPainter extends CustomPainter {
  _OrbPainter({
    required this.t,
    required this.accent,
    required this.breath,
    required this.wave,
    required this.showWaves,
  });

  final NfcTokens t;
  final Color accent;

  /// 0..1 — nafas fazasi.
  final double breath;

  /// 0..1 — to'lqin fazasi.
  final double wave;
  final bool showWaves;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final base = size.width * .30;

    // --- pulse halqalari: uchtasi siklning 1/3 qismiga surilgan ---------
    if (showWaves) {
      for (var i = 0; i < 3; i++) {
        final p = (wave + i / 3) % 1.0;
        final r = base * (1 + p * 1.55);
        // Chiqib borgan sari so'nadi; boshida ham to'liq emas — "portlash"
        // taassuroti bo'lmasligi uchun.
        final o = (1 - p) * .45 * math.min(1, p * 6);
        canvas.drawCircle(
          c,
          r,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5
            ..color = accent.withValues(alpha: o),
        );
      }
    }

    // --- halo: markazdan tarqaladigan yumshoq nur ------------------------
    final haloR = base * (1.34 + breath * .12);
    canvas.drawCircle(
      c,
      haloR,
      Paint()
        ..shader = RadialGradient(
          colors: [t.glow, t.glow.withValues(alpha: 0)],
          stops: const [.35, 1],
        ).createShader(Rect.fromCircle(center: c, radius: haloR))
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18),
    );

    // --- organik yadro ---------------------------------------------------
    // Doira EMAS: radius burchak bo'ylab ikkita sinus bilan biroz
    // o'zgaradi, shuning uchun shakl "tirik" ko'rinadi va nafas bilan
    // sekin aylanadi.
    final r = base * (.95 + breath * .06);
    final path = Path();
    const steps = 72;
    for (var i = 0; i <= steps; i++) {
      final a = i / steps * 2 * math.pi;
      final wobble = 1 +
          math.sin(a * 3 + breath * math.pi * 2) * .035 +
          math.sin(a * 5 - breath * math.pi) * .018;
      final p = c + Offset(math.cos(a) * r * wobble, math.sin(a) * r * wobble);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    path.close();

    canvas.drawPath(
      path,
      Paint()
        ..shader = LinearGradient(
          begin: const Alignment(-.7, -1),
          end: const Alignment(.7, 1),
          // Kartadan bir pog'ona CHUQURROQ. Ilgari bu yerda ham
          // `[accent1, accent2]` turardi — ya'ni orb va identity karta
          // aynan bir xil oltinda edi va oltin aksent bo'lishdan
          // to'xtagandi. Holat rangi (muvaffaqiyat/xato) berilganda
          // esa o'sha rang saqlanadi.
          colors: accent == t.accent2
              ? [t.accent2, t.goldDeep]
              : [t.accent1, accent],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );

    // Yuqori chetdagi nozik yorug'lik — shakl yassi qog'oz emas, hajmli.
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.white.withValues(alpha: .45), Colors.white.withValues(alpha: 0)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
  }

  @override
  bool shouldRepaint(_OrbPainter old) =>
      old.breath != breath ||
      old.wave != wave ||
      old.accent != accent ||
      old.t.id != t.id ||
      old.showWaves != showWaves;
}

/// Orb atrofida aylanma joylashgan tezkor amallar — Concept B "orbit".
class OrbitActions extends StatefulWidget {
  const OrbitActions({
    super.key,
    required this.size,
    required this.actions,
  });

  final double size;
  final List<OrbitAction> actions;

  @override
  State<OrbitActions> createState() => _OrbitActionsState();
}

class _OrbitActionsState extends State<OrbitActions>
    with SingleTickerProviderStateMixin {
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: Motion.orbit,
  );

  /// NIMA UCHUN `didChangeDependencies`, `initState` EMAS:
  /// `reduceMotion` `MediaQuery` dan o'qiydi. `initState` ichida
  /// `MediaQuery` ga murojaat qilish mumkin emas, qolaversa
  /// foydalanuvchi tizim sozlamasini ILOVA OCHIQ TURGANDA ham
  /// o'zgartirishi mumkin — bu chaqiruv o'shanda qayta ishlaydi.
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      // Harakatni kamaytirish yoqilgan: aylanish butunlay to'xtaydi va
      // chiplar boshlang'ich holatiga QAYTADI. Yarim yo'lda muzlab
      // qolgan tartib tasodifiy ko'rinardi.
      _spin.stop();
      _spin.value = 0;
    } else if (!_spin.isAnimating) {
      _spin.repeat();
    }
  }

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // .40 emas, .36: chip DOIRASI emas, uning YOZUVI eng chekka nuqta.
    // 390px ekranda orbit ~360 => radius 130; chip qutisi 92 kenglikda
    // eng chetki nuqta 130+46=176 < 180 — ya'ni yozuv Stack qirrasiga
    // borib kesilmaydi. Avval radius .40 (=144) edi va 74px li yozuv
    // ham 181 ga chiqib, o'ng/chap chiplarda qirqilardi.
    final radius = widget.size * .36;
    final tones = [t.accent2, t.accentBDark, t.accentCDark, t.accentDDark];
    final n = widget.actions.length;

    // Chiplar bir marta quriladi: har kadrda faqat ularning O'RNI
    // qayta hisoblanadi, ichidagi matn va bezak emas.
    final chips = [
      for (var i = 0; i < n; i++)
        _OrbitChip(action: widget.actions[i], tone: tones[i % tones.length]),
    ];

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _spin,
        builder: (context, _) => Stack(
          alignment: Alignment.center,
          // Yozuvning bir necha piksel chetga chiqishi qirqilishdan
          // ko'ra yaxshiroq — lekin yuqoridagi radius buni ham oldini
          // oladi.
          clipBehavior: Clip.none,
          children: [
            for (var i = 0; i < n; i++)
              Builder(builder: (context) {
                // Yuqoridan boshlab teng taqsimlanadi, keyin butun
                // halqa sekin buriladi.
                final a = -math.pi / 2 +
                    i * 2 * math.pi / n +
                    _spin.value * 2 * math.pi;
                // FAQAT ko'chirish, BURISH emas: shuning uchun ikonka
                // ham, yozuv ham aylanish davomida tik turadi.
                return Transform.translate(
                  offset: Offset(math.cos(a) * radius, math.sin(a) * radius),
                  child: chips[i],
                );
              }),
          ],
        ),
      ),
    );
  }
}

class OrbitAction {
  const OrbitAction({required this.icon, required this.label, this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
}

class _OrbitChip extends StatelessWidget {
  const _OrbitChip({required this.action, required this.tone});

  final OrbitAction action;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      label: action.label,
      child: PressableScale(
        onTap: action.onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: t.surfaceSolid,
                shape: BoxShape.circle,
                border: Border.all(color: tone.withValues(alpha: .5), width: 1.4),
                boxShadow: t.shadowTiny,
              ),
              child: Icon(action.icon, size: 21, color: tone),
            ),
            const SizedBox(height: 7),
            // 92px — rus tilidagi eng uzun yorliq ("Безопасность")
            // 10px/700 Manrope'da ~70px joy egallaydi. Avval quti 74px
            // edi va o'sha yorliq "Безопасн..." bo'lib qirqilardi.
            // Qo'shni chiplar orasidagi yoy masofasi ~200px, shuning
            // uchun kengaytirish ularni bir-biriga tekkizmaydi.
            SizedBox(
              width: 92,
              child: Text(
                action.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Manrope',
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  height: 1.2,
                  color: t.text2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
