import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/media.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';

/// UCH PANELLI TANISHTIRUV.
///
/// HAR PANELNING O'Z YORUG'LIGI BOR: birinchisi tepadan iliq,
/// ikkinchisi sovuq, uchinchisi pastdan. Shuning uchun varaqlash
/// "bir xil ekranning matni almashishi" emas, HARAKAT bo'lib
/// tuyuladi.
///
/// Rasm fayli ISHLATILMAYDI — har uch tasvir dizayn tizimining o'z
/// elementlaridan yig'ilgan (metall karta, shisha panel, kontakt
/// qatori). Shu sababli ular mavzu almashganda ham to'g'ri qoladi
/// va ilovaning haqiqiy ko'rinishini ko'rsatadi.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onDone});
  final VoidCallback onDone;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

/// Bitta panel.
@immutable
class _Slide {
  const _Slide({
    required this.aura,
    required this.lead,
    required this.accent,
    required this.body,
    required this.art,
  });

  /// Panelning yorug'lik imzosi.
  final Aura aura;

  /// Sarlavhaning oddiy qismi va KURSIV OLTIN urg'u so'zi.
  final String lead;
  final String accent;

  final String body;
  final Widget art;
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pager = PageController();
  int _page = 0;

  /// TARJIMA QILINGAN RO'YXAT `static final` BO'LMAYDI — til
  /// almashganda muzlab qolardi. Shuning uchun getter.
  List<_Slide> get _slides => [
        _Slide(
          // Tepadan iliq oltin — karta yuzasiga tushadigan nur.
          aura: Aura.home,
          lead: tr('Bitta tegish — '),
          accent: tr('butun profil'),
          body: tr('NFC kartani telefonga tegizing: ism, lavozim, aloqa va '
              'havolalar darhol ochiladi.'),
          art: const _TapArt(),
        ),
        _Slide(
          // SOVUQ nur — ikkinchi panel birinchisidan sezilarli farq
          // qiladi.
          aura: Aura.coolRight,
          lead: tr('Profil '),
          accent: tr('darhol'),
          body: tr('Story, post va Reels bilan tirik profil. Ilova o‘rnatish '
              'shart emas — havola brauzerda ham ishlaydi.'),
          art: const _ProfileArt(),
        ),
        _Slide(
          // Nur PASTDAN — muvaffaqiyat belgisini ostidan yoritadi.
          aura: Aura.reels,
          lead: tr('Kontakt '),
          accent: tr('bir bosishda'),
          body: tr('"Kontaktni saqlash" telefon kitobiga yozadi. NFC ishlamasa '
              'QR yoki havola bilan ulashiladi.'),
          art: const _ContactArt(),
        ),
      ];

  @override
  void dispose() {
    _pager.dispose();
    super.dispose();
  }

  void _next() {
    if (_page >= _slides.length - 1) {
      widget.onDone();
    } else {
      _pager.nextPage(duration: M.push, curve: M.curve);
    }
  }

  @override
  Widget build(BuildContext context) {
    final slides = _slides;
    final last = _page == slides.length - 1;

    return ScreenBackdrop(
      aura: slides[_page].aura,
      child: SafeArea(
        child: Column(
          children: [
            // O'TKAZIB YUBORISH — har doim o'ng tepada, o'rni
            // panellar orasida o'zgarmaydi.
            Padding(
              padding: const EdgeInsets.fromLTRB(S.gutter, S.x4, S.x12, 0),
              child: Align(
                alignment: Alignment.centerRight,
                child: GhostButton(
                  tr('O‘tkazib yuborish'),
                  size: BtnSize.s,
                  color: C.ink2,
                  onTap: widget.onDone,
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pager,
                itemCount: slides.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (context, i) => _Panel(slide: slides[i]),
              ),
            ),
            // KO'RSATKICH — faol nuqta 20 dp li oltin BAND.
            // Farq faqat rangda emas, SHAKLDA ham: rang
            // ko'rmaydigan odam ham qaysi panelda turganini
            // ko'radi.
            Padding(
              padding: const EdgeInsets.symmetric(vertical: S.x20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < slides.length; i++)
                    AnimatedContainer(
                      duration: M.fade,
                      curve: M.curve,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: i == _page ? 20 : 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: i == _page ? C.accent : C.line,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                S.gutter,
                0,
                S.gutter,
                S.x16,
              ),
              child: PrimaryButton(
                last ? tr('Boshlash') : tr('Keyingisi'),
                onTap: _next,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────

class _Panel extends StatelessWidget {
  const _Panel({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) {
          // ILLYUSTRATSIYA EKRANGA QARAB O'LCHANADI.
          //
          // Maketda (8b–8d) u ekranning qariyb yarmini oladi: 844 dp
          // da 380 dp. Qat'iy 250 dp qo'yilganda u 390×844 telefonda
          // kichrayib qolardi va tana matni bilan ko'rsatkich orasida
          // katta bo'sh maydon ochilardi — ekran tugallanmagan
          // ko'rinardi.
          //
          // NIMA UCHUN ULUSH, QAT'IY SON EMAS: matn 200% ga
          // kattalashtirilganda yoki ekran past bo'lganda birinchi
          // bo'lib RASM qisqarsin, sarlavha va tugma emas. Quyi
          // chegara 180 dp — undan kichigida illyustratsiya tanilmay
          // qoladi; yuqorigisi 380 dp — maketdagi o'lcham.
          final art = (box.maxHeight * .55).clamp(180.0, 380.0);

          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: S.x16),
                // `FittedBox` — illyustratsiyalar o'z tabiiy
                // o'lchamida chizilgan (300×250). Uni qo'lda qayta
                // o'lchash o'rniga butun kompozitsiya BIR XIL
                // nisbatda kattalashadi: kartaning burchagi, yoylar
                // va telefon bir-biriga nisbatan joyida qoladi.
                SizedBox(
                  height: art,
                  width: double.infinity,
                  child: FittedBox(
                    fit: BoxFit.contain,
                    child: slide.art,
                  ),
                ),
                const SizedBox(height: S.x32),
                // SARLAVHA — bitta so'z KURSIV va OLTIN.
                Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(text: slide.lead),
                      TextSpan(
                        text: slide.accent,
                        style: T.displayItalic.copyWith(color: C.accent),
                      ),
                    ],
                  ),
                  style: T.display,
                ),
                const SizedBox(height: S.x16),
                Text(slide.body, style: T.body),
                const SizedBox(height: S.x24),
              ],
            ),
          );
        },
      );
}

// ─────────────────────────────────────────────────────────────
// 1 — TEGIZISH
// ─────────────────────────────────────────────────────────────

/// Qiya metall karta, undan tarqaluvchi NFC yoylari va kichik
/// telefon shakli.
class _TapArt extends StatelessWidget {
  const _TapArt();

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 300,
        height: 250,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // NFC YOYLARI — kartaning o'ng chekkasidan tarqaladi.
            Positioned.fill(
              child: CustomPaint(
                painter: _ArcPainter(color: C.accent),
              ),
            ),
            // METALL KARTA — bir oz qiya.
            Align(
              alignment: const Alignment(-.25, -.1),
              child: Transform.rotate(
                angle: -.13,
                child: const SizedBox(
                  width: 232,
                  child: IdentityCard(
                    code: 'GLD777',
                    tier: Tier.gold,
                    holder: 'Aziz Karimov',
                    url: 'nfcstore.uz/gld777',
                    flippable: false,
                  ),
                ),
              ),
            ),
            // TELEFON — quyuq, kartadan kichik.
            Align(
              alignment: const Alignment(.92, .62),
              child: const _PhoneShape(),
            ),
          ],
        ),
      );
}

/// Kontsentrik NFC yoylari.
class _ArcPainter extends CustomPainter {
  _ArcPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    // Markaz — telefon turgan joy, ya'ni yoylar undan "chiqadi".
    final center = Offset(size.width * .82, size.height * .68);
    const alphas = [.55, .34, .18];
    const widths = [2.0, 1.6, 1.2];
    for (var i = 0; i < 3; i++) {
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = widths[i]
        ..color = color.withValues(alpha: alphas[i]);
      final r = 46.0 + i * 30;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: r),
        // Chapga va yuqoriga — kartaga qarab.
        math.pi * 1.06,
        math.pi * .62,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.color != color;
}

/// Telefon silueti — quyuq yuza, oltin hoshiya.
class _PhoneShape extends StatelessWidget {
  const _PhoneShape();

  @override
  Widget build(BuildContext context) => Container(
        width: 62,
        height: 112,
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(color: C.line),
          boxShadow: C.e2,
        ),
        child: Center(
          child: NIcon(Ico.nfc, size: 22, color: C.accent),
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// 2 — PROFIL
// ─────────────────────────────────────────────────────────────

/// Ko'tarilayotgan shisha panel: avatar, ism va havola qatori.
class _ProfileArt extends StatelessWidget {
  const _ProfileArt();

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 288,
        height: 250,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // ORQADAGI QATLAM — chuqurlik uchun, pastda va kichik.
            Align(
              alignment: const Alignment(0, .52),
              child: FractionallySizedBox(
                widthFactor: .82,
                child: GlassPanel(
                  padding: const EdgeInsets.all(S.x16),
                  child: Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: C.glass,
                          borderRadius: BorderRadius.circular(R.chip),
                        ),
                      ),
                      const SizedBox(width: S.x12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(height: 8, width: 92, color: C.glassHigh),
                            const SizedBox(height: 7),
                            Container(height: 7, width: 58, color: C.glass),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // OLDINDAGI PANEL — "ko'tarilgan".
            Align(
              alignment: const Alignment(0, -.34),
              child: GlassPanel(
                padding: const EdgeInsets.all(S.x16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Avatar(name: 'Aziz Karimov', size: 46),
                        const SizedBox(width: S.x12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(
                                      'Aziz Karimov',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: T.cardTitle,
                                    ),
                                  ),
                                  const SizedBox(width: 5),
                                  const VerifiedBadge(size: 14),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Text(tr('Direktor'), style: T.caption),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: S.x12),
                    const RowDivider(indent: 0),
                    const SizedBox(height: S.x12),
                    Row(
                      children: [
                        NIcon(Ico.link, size: 14, color: C.accent),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            'nfcstore.uz/gld777',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T.link,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// 3 — KONTAKT
// ─────────────────────────────────────────────────────────────

/// Kontakt qatori va YASHIL tasdiq belgisi.
class _ContactArt extends StatelessWidget {
  const _ContactArt();

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 288,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Surface(
              glow: true,
              child: Row(
                children: [
                  const Avatar(name: 'Aziz Karimov', size: 44),
                  const SizedBox(width: S.x12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Aziz Karimov',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.cardTitle,
                        ),
                        const SizedBox(height: 3),
                        Text('+998 90 123 45 67', style: T.meta),
                      ],
                    ),
                  ),
                  const SizedBox(width: S.x12),
                  // TASDIQ — rang + BELGI. Faqat yashil doira
                  // bo'lsa, rang ko'rmaydigan odam uchun hech
                  // nima demagan bo'lardi.
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: C.ok.withValues(alpha: .16),
                      shape: BoxShape.circle,
                      border: Border.all(color: C.ok.withValues(alpha: .5)),
                    ),
                    child: Center(
                      child: NIcon(Ico.check, size: 17, color: C.ok),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: S.x16),
            StatusChip(tr('Saqlandi'), tone: StatusTone.ok),
            const SizedBox(height: S.x16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _Fallback(icon: Ico.qr, label: tr('QR')),
                const SizedBox(width: S.x12),
                _Fallback(icon: Ico.link, label: tr('Havola')),
              ],
            ),
          ],
        ),
      );
}

/// NFC ishlamasa — zaxira yo'l.
class _Fallback extends StatelessWidget {
  const _Fallback({required this.icon, required this.label});

  final Ico icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: S.x12, vertical: 7),
        decoration: BoxDecoration(
          color: C.glass,
          borderRadius: BorderRadius.circular(R.chip),
          border: Border.all(color: C.lineCool),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            NIcon(icon, size: 13, color: C.ink2),
            const SizedBox(width: 6),
            Text(label, style: T.buttonSm.copyWith(color: C.ink2, fontSize: 12)),
          ],
        ),
      );
}
