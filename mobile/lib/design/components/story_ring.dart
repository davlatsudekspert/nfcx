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

  /// Oltin halqa qalinligi. Kichik avatarda 4px halqa rasmni bo'g'ib
  /// qo'yardi, kattasida esa 3px ko'rinmay qolardi.
  double get _goldWidth => widget.size >= 70 ? 4 : 3;

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
                  // Rangli halqa bilan oltin halqa orasidagi qora
                  // bo'shliq — ikkalasi bir-biriga qo'shilib ketmasin.
                  Container(
                    width: widget.size - 7, height: widget.size - 7,
                    decoration: BoxDecoration(color: C.obsidian, shape: BoxShape.circle),
                  ),
                  // OLTIN HALQA — saytdagi avatar gardishining aynan
                  // o'zi. U to'ldirilgan metall doira sifatida
                  // chiziladi, ustiga esa avatar qo'yiladi: ko'rinib
                  // qoladigan chekkasi halqaga aylanadi. Flutter'da
                  // `Border` gradient qabul qilmaydi, shuning uchun
                  // usul shu.
                  Container(
                    width: widget.size - 11, height: widget.size - 11,
                    decoration: BoxDecoration(gradient: C.metalCoin, shape: BoxShape.circle),
                  ),
                  if (widget.addButton)
                    Container(
                      width: widget.size - 11 - _goldWidth * 2,
                      height: widget.size - 11 - _goldWidth * 2,
                      decoration: BoxDecoration(color: C.graphite, shape: BoxShape.circle),
                      child: Center(
                        child: Text('+', style: TextStyle(
                          fontFamily: 'Manrope', fontSize: 24,
                          fontWeight: FontWeight.w400, color: C.champagne, height: 1,
                        )),
                      ),
                    )
                  else
                    Avatar(
                      url: widget.avatarUrl,
                      name: widget.name,
                      size: widget.size - 11 - _goldWidth * 2,
                    ),
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
                  fontSize: 12,
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
      // INSTAGRAM USLUBIDAGI RANGLI HALQA.
      //
      // Ilgari bu yerda faqat oltin tonlar bor edi. Muammo ikkita:
      // (1) halqa avatarning oltin gardishidan farq qilmasdi va
      // "istorya bor" degan belgi yo'qolardi; (2) bir xil oilaning
      // ranglari aylanganda harakat deyarli bilinmasdi.
      //
      // Ranglar saytdagi `.story-ring-glow` konik gradientidan AYNAN
      // olingan — ilova va sayt bir xil belgi ko'rsatishi kerak.
      // Oltin nuqta boshida va oxirida: halqa avatarning oltin
      // gardishiga ulanib, undan rangga o'sib chiqadi.
      ..shader = const SweepGradient(
        colors: [
          Color(0xFFFFD76E),
          Color(0xFFFF7A45),
          Color(0xFFE04EA0),
          Color(0xFF8B5CF6),
          Color(0xFF3FA9FF),
          Color(0xFFFFD76E),
        ],
        stops: [0, .2, .4, .6, .8, 1],
      ).createShader(rect);
    canvas.drawCircle(rect.center, size.width / 2 - 1.7, p);
  }

  @override
  bool shouldRepaint(_ConicRingPainter old) => false;
}
