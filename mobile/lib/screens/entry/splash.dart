import 'package:flutter/widgets.dart';

import '../../design/components/backdrop.dart';
import '../../design/components/logo.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';

/// SPLASH — medalyon markazda, nur markazdan.
///
/// Bu vaqt ichida sessiya tekshiriladi (`AppState.boot`), ya'ni bu
/// "sun'iy kutish" emas — haqiqiy ishning ustini yopadi. Shuning
/// uchun ekranning O'Z animatsiyasi 1.2 soniyadan oshmaydi: agar
/// sessiya tezroq ochilsa, ilova darhol almashadi va animatsiya
/// yarmida uzilib qolishi TABIIY.
///
/// Pastdagi 2 dp chiziq — bu progress EMAS (yuklanish qancha
/// qolganini hech kim bilmaydi), bu "ilova ishlayapti" belgisi.
/// Shuning uchun u bir marta to'ladi va joyida qoladi.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  /// Butun kirish animatsiyasi — 1.2 s dan kam.
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  /// Medalyon va yozuvlar — birinchi yarmida paydo bo'ladi.
  late final Animation<double> _in = CurvedAnimation(
    parent: _c,
    curve: const Interval(0, .38, curve: M.curve),
  );

  /// Chiziq — butun davomiylik bo'ylab to'ladi.
  late final Animation<double> _line = CurvedAnimation(
    parent: _c,
    curve: const Interval(.12, 1, curve: M.curve),
  );

  @override
  void initState() {
    super.initState();
    _c.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Harakat kamaytirilgan bo'lsa — hamma narsa darhol o'z
    // joyida turadi, hech narsa yo'qolmaydi.
    if (reduceMotion(context)) _c.value = 1;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.center,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, S.x32, S.gutter, S.x32),
            child: Column(
              children: [
                const Spacer(),
                FadeTransition(
                  opacity: _in,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // MEDALYON VA HALQALAR (maket 8a).
                      //
                      // Ikki halqa — 180 va 136 dp — logotipni fonga
                      // bog'laydi: usiz medalyon qorong'ida "osilib"
                      // turadi. Ular NFC markazidagi to'lqin bilan
                      // bir oilada, lekin STATIK: splash 1.2 s
                      // turadi va bu yerda harakat kutishni
                      // uzaytirgandek tuyulardi.
                      const _Halo(
                        size: 180,
                        rings: [180, 136],
                        child: BrandMark(size: 104, glow: true),
                      ),
                      const SizedBox(height: S.x24),
                      const Wordmark(size: 15),
                      const SizedBox(height: S.x12),
                      Text(
                        tr('Raqamli tashrif qog‘ozi'),
                        textAlign: TextAlign.center,
                        style: T.caption,
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                // YUKLANISH CHIZIG'I — 2 dp, 140 dp keng.
                SizedBox(
                  width: 140,
                  height: 2,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        ColoredBox(color: C.line),
                        AnimatedBuilder(
                          animation: _line,
                          builder: (context, _) => FractionallySizedBox(
                            alignment: Alignment.centerLeft,
                            widthFactor: _line.value,
                            child: ColoredBox(color: C.accent),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: S.x12),
                Text(tr('YUKLANMOQDA'), style: T.statusLabel),
                const SizedBox(height: S.x8),
              ],
            ),
          ),
        ),
      );
}

/// Markazdagi belgini o'rab turgan konsentrik halqalar.
///
/// Halqalar TASHQARIDAN ICHKARIGA quyuqlashadi: eng kattasi eng
/// zaif (12%), ichkarisi kuchliroq (20%). Teskarisi bo'lsa ko'z
/// markazdan chetga tortilardi — bu yerda esa e'tibor logotipga
/// yig'ilishi kerak.
class _Halo extends StatelessWidget {
  const _Halo({
    required this.size,
    required this.rings,
    required this.child,
  });

  /// Tashqi o'lcham — eng katta halqa shunga teng.
  final double size;

  /// Halqalar diametri, kattadan kichikka.
  final List<double> rings;

  final Widget child;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            for (var i = 0; i < rings.length; i++)
              SizedBox(
                width: rings[i],
                height: rings[i],
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: C.accent.withValues(
                        alpha: .12 + i * .08,
                      ),
                    ),
                  ),
                ),
              ),
            child,
          ],
        ),
      );
}
