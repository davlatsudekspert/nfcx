import 'package:flutter/widgets.dart';
import '../tokens.dart';
import '../type.dart';
import 'media.dart';
import 'press.dart';

/// Story halqasi.
///
/// Bu — ilovadagi YAGONA uzluksiz animatsiya (handoff byudjeti).
/// Ko'rilgan story'da halqa yassi `#35322c` bo'ladi va AYLANMAYDI:
/// aks holda ekranda bir vaqtda o'nlab aylanuvchi halqa bo'lib,
/// batareya ham, e'tibor ham behuda sarflanardi.
class StoryRing extends StatefulWidget {
  const StoryRing({
    super.key,
    required this.name,
    this.avatarUrl,
    this.seen = false,
    this.size = 60,
    this.onTap,
    this.addButton = false,
    this.showLabel = true,
  });

  final String name;
  final String? avatarUrl;
  final bool seen;
  final double size;
  final VoidCallback? onTap;

  /// "Qo'shish" varianti — o'z story'ingni joylash.
  final bool addButton;

  /// Halqa ostidagi nom. Profil sahifasida O'CHIRILADI: u yerda ism
  /// allaqachon avatar ostida katta harflarda turibdi va ikkinchi
  /// marta takrorlanishi maketni buzardi.
  final bool showLabel;

  @override
  State<StoryRing> createState() => _StoryRingState();
}

class _StoryRingState extends State<StoryRing> with SingleTickerProviderStateMixin {
  AnimationController? _c;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(StoryRing old) {
    super.didUpdateWidget(old);
    if (old.seen != widget.seen) _sync();
  }

  /// Kontroller FAQAT ko'rilmagan story uchun yaratiladi va ishga
  /// tushadi — ko'rilganida umuman yo'q.
  ///
  /// `AnimationBehavior.preserve` — MAJBURIY.
  ///
  /// Qurilmada halqa KO'RINARDI, lekin QOTIB turardi. Sabab:
  /// Android'da "Animator duration scale" o'chirilgan yoki batareya
  /// tejash rejimi yoqilgan bo'lsa, tizim ilovaga "animatsiyalarni
  /// o'chir" deb aytadi va Flutter'ning `AnimationController` i buni
  /// hurmat qilib animatsiyani DARHOL oxiriga tashlaydi. Halqa esa
  /// aylanishdan to'xtaydi.
  ///
  /// `preserve` aynan shu holat uchun: animatsiya BEZAK emas,
  /// ma'no tashiydi — u "bu profilda yangi istorya bor" deb turadi.
  /// Hujjat ham shuni aytadi: ma'noli animatsiyalar `preserve`
  /// bo'lishi kerak.
  void _sync() {
    if (widget.seen || widget.addButton) {
      _c?.dispose();
      _c = null;
      return;
    }
    _c ??= AnimationController(
      vsync: this,
      duration: M.storyRing,
      animationBehavior: AnimationBehavior.preserve,
    )..repeat();
  }

  @override
  void dispose() {
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // `RotationTransition` — `AnimatedBuilder` + `Transform.rotate`
    // O'RNIGA. Farqi: bu yerda bola HAR KADRDA QAYTA QURILMAYDI,
    // faqat burilish qatlami yangilanadi. Ya'ni `CustomPaint` bir
    // marta chiziladi va keyin shunchaki buriladi.
    final ring = _c == null
        ? _FlatRing(size: widget.size, color: widget.addButton ? C.hairline : const Color(0xFF35322C))
        : RotationTransition(
            turns: _c!,
            child: CustomPaint(
              size: Size.square(widget.size),
              painter: _ConicRingPainter(),
            ),
          );

    // `RepaintBoundary` — halqa AYLANADI. Usiz uning har kadri
    // butun gorizontal ro'yxatni qayta chizishga majburlaydi va
    // aylantirish tutila boshlaydi.
    return RepaintBoundary(
      child: Press(
      onTap: widget.onTap,
      child: SizedBox(
        width: widget.size + 8,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: widget.size, height: widget.size,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  ring,
                  // Halqa bilan avatar orasida fon rangidagi bo'shliq.
                  //
                  // 5 -> 8: halqa QALINLASHDI (2.4 -> 3.4) va eski
                  // bo'shliqda uning ichki yarmi avatar ostida
                  // qolib ketardi. Profil sarlavhasida, muqova
                  // rasmi ustida bu halqani oddiy chegaradan
                  // ajratib bo'lmasdi.
                  Container(
                    width: widget.size - 8, height: widget.size - 8,
                    decoration: BoxDecoration(color: C.obsidian, shape: BoxShape.circle),
                  ),
                  if (widget.addButton)
                    Container(
                      width: widget.size - 12, height: widget.size - 12,
                      decoration: BoxDecoration(color: C.graphite, shape: BoxShape.circle),
                      child: Center(
                        child: Text('+', style: TextStyle(
                          fontFamily: 'Manrope', fontSize: 24,
                          fontWeight: FontWeight.w400, color: C.champagne, height: 1,
                        )),
                      ),
                    )
                  else
                    Avatar(url: widget.avatarUrl, name: widget.name, size: widget.size - 12),
                ],
              ),
            ),
            if (widget.showLabel) ...[
              const SizedBox(height: 6),
              Text(
                widget.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: T.caption.copyWith(
                  fontSize: 10.5,
                  color: widget.seen ? C.muted : C.ash,
                ),
              ),
            ],
          ],
        ),
      ),
      ),
    );
  }
}

class _FlatRing extends StatelessWidget {
  const _FlatRing({required this.size, required this.color});
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        width: size, height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: color, width: 3),
        ),
      );
}

class _ConicRingPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final p = Paint()
      ..style = PaintingStyle.stroke
      // 2.4 -> 3.4 va och ranglar ustunligi.
      //
      // Telefonda sinovda halqa "umuman yo'q" deb baholandi: 2.4px
      // to'q oltin chiziq muqova rasmi ustida oddiy avatar
      // chegarasidan farq qilmasdi. Instagram'dagi halqa ham
      // taxminan shu qalinlikda.
      ..strokeWidth = 3.4
      // GRADIENT KONTRASTI — AYLANISH KO'RINISHI UCHUN.
      //
      // Halqa aylanadi, lekin AYLANAYOTGANI faqat rang o'zgarishi
      // orqali ko'rinadi: bir xil rangli doira aylansa ham qotib
      // turgandek. Oldingi to'plamda uchta och ton yonma-yon edi va
      // harakat deyarli bilinmasdi. Endi to'q va och qism aniq
      // almashadi — dizayn manbasidagi "shimmer" shunday ishlaydi.
      ..shader = SweepGradient(
        colors: [
          C.antiqueGold,
          C.champagne,
          Color(0xFFFFF4DC),
          C.champagne,
          C.antiqueGold,
        ],
        stops: [0, .22, .38, .58, 1],
      ).createShader(rect);
    canvas.drawCircle(rect.center, size.width / 2 - 1.7, p);
  }

  @override
  bool shouldRepaint(_ConicRingPainter old) => false;
}
