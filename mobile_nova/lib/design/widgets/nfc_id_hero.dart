import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'id_lux.dart';
import '../motion/motion.dart';
import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';

/// NFC ID — BOSH SAHIFANING ASOSIY QAHRAMONI.
///
/// Soft editorial yo'nalishida ekranning eng katta obyekti — ism ham,
/// orb ham emas, aynan KOD. NFCSTORE identity platforma: odam bu
/// yerga o'z ID'sini ko'rish uchun keladi.
///
/// ## Shakl
///
/// Banknot va bank kartasidan olingan uchta tafsilot, lekin ularning
/// hech biri nusxa emas:
///
///   * IKKI QAVAT HOSHIYA — tashqi chegara va 7px ichkarida ikkinchi,
///     xiraroq champagne chiziq. NFCSTORE'ning brend imzosi: shu
///     "ichki ramka" boshqa joylarda ham (ID plitasi, markaziy tugma)
///     takrorlanadi;
///   * GRAVYURA HALQALARI — o'ng tomonda ingichka konsentrik
///     doiralar. Ular NFC to'lqinini eslatadi va juda sekin tashqariga
///     suriladi (bitta sikl 9 soniya);
///   * KATTA SERIF KOD — [AppType.heroId], raqamlar to'liq balandlikda.
///
/// ## Harakat
///
///   * ochilganda karta 10px pastdan va shaffoflikdan chiqadi;
///   * barmoq bosganda karta o'sha nuqtaga qarab 2.5° gacha egiladi,
///     halqalar qatlami esa KODGA TESKARI suriladi — chuqurlik
///     (parallax) shu farqdan seziladi;
///   * qo'yib yuborilganda prujina bilan joyiga qaytadi.
///
/// Hammasi "harakatni kamaytirish" yoqilganda o'chadi va ilova fonga
/// ketganda yoki tab ko'rinmaganda to'xtaydi (`TickerMode`).
///
/// ## Nima YO'Q
///
/// Glow, radial nur, qora gradient, chaqnash — egasining aniq talabi.
/// Chuqurlik FAQAT soya va ikki qavat hoshiya bilan.
class NfcIdHeroCard extends StatefulWidget {
  const NfcIdHeroCard({
    super.key,
    required this.code,
    required this.eyebrow,
    required this.name,
    this.subtitle = '',
    this.tier,
    this.tierCode = '',
    this.statusLabel,
    this.statusOk = true,
    this.technical = false,
    this.onTap,
    this.actions = const [],
  });

  /// NFC ID kodi. `null` — hali ID yo'q (chiziqcha chiziladi).
  final String? code;

  /// Yuqori chapdagi kichik yozuv: `NFC ID · SHAXSIY`.
  final String eyebrow;
  final String name;
  final String subtitle;

  /// Toifa belgisi (`EXCLUSIVE`, `PREMIUM`...). `null` — ko'rsatilmaydi.
  final String? tier;

  /// Toifa kodi (`gold`/`premium`/`exclusive`). Pullik bo'lsa yozuv
  /// o'rniga umumiy metall belgi (`IdTierBadge`) chiziladi — profil,
  /// katalog va qidiruvdagi bilan AYNAN bir xil.
  final String tierCode;

  /// Pastki o'ngdagi holat (`Faol`). `null` — ko'rsatilmaydi.
  final String? statusLabel;

  /// Holat nuqtasi rangi: yashil (`true`) yoki ogohlantirish.
  final bool statusOk;

  /// `name` texnik matnmi (ochiq manzil) — unda IBM Plex Mono bilan
  /// chiziladi: `0/O` va `1/I` adashmasin.
  final bool technical;
  final VoidCallback? onTap;

  /// Pastki o'ngdagi kichik doira tugmalar (QR, ulashish).
  final List<NfcIdHeroAction> actions;

  @override
  State<NfcIdHeroCard> createState() => _NfcIdHeroCardState();
}

class NfcIdHeroAction {
  const NfcIdHeroAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;
}

class _NfcIdHeroCardState extends State<NfcIdHeroCard>
    with TickerProviderStateMixin {
  /// Kirish animatsiyasi — bir marta.
  late final AnimationController _enter = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 620),
  );

  /// Halqalarning sekin tashqariga surilishi — bir marta.
  late final AnimationController _rings = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 9),
  );

  /// Egilish: barmoq nuqtasi (-1..1) va uning "kuchi" (0..1).
  Offset _tilt = Offset.zero;
  bool _pressed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      _enter.value = 1;
      _rings.stop();
    } else {
      if (_enter.value == 0 && !_enter.isAnimating) _enter.forward();
      // Halqalar ochilganda IKKI marta suriladi va to'xtaydi. Doimiy
      // takrorlash ekranni har kadrda qayta chizdirardi va ustidagi
      // shisha effektlarni ham qayta hisoblatardi (TEZLIK, 2026-09:
      // "ilova qotib ishlayapti").
      //
      // Endi BIR marta (2026-09, o'lchov): emulyatorda Home ochilgach
      // 18 soniya davomida har kadr qayta chizilayotgani ko'rindi —
      // aynan rasmlar yuklanib, odam aylantira boshlagan paytda.
      if (!_rings.isAnimating && _rings.value == 0) _rings.forward();
    }
  }

  @override
  void dispose() {
    _enter.dispose();
    _rings.dispose();
    super.dispose();
  }

  void _press(Offset local, Size size) {
    if (reduceMotion(context)) return;
    final dx = (local.dx / size.width * 2 - 1).clamp(-1.0, 1.0);
    final dy = (local.dy / size.height * 2 - 1).clamp(-1.0, 1.0);
    setState(() {
      _tilt = Offset(dx, dy);
      _pressed = true;
    });
  }

  void _release() {
    if (!_pressed) return;
    setState(() {
      _tilt = Offset.zero;
      _pressed = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final still = reduceMotion(context);

    return LayoutBuilder(
      builder: (context, box) {
        final width = box.maxWidth;
        // 360 da ~46, 390 da ~50, 430 da 52 — kod bitta qatorda
        // turadi, lekin ekran kichiklashsa ham "qahramon" bo'lib
        // qoladi. Juda uzun kod baribir `FittedBox` bilan sig'adi.
        final idSize = (width * .145).clamp(40.0, 54.0);
        final size = Size(width, 212);

        final card = _CardBody(
          t: t,
          widget: widget,
          idSize: idSize,
          rings: _rings,
          tilt: _tilt,
        );

        final tilted = TweenAnimationBuilder<Offset>(
          tween: Tween(end: _tilt),
          duration: _pressed ? Motion.fast : Motion.med,
          curve: _pressed ? Motion.smooth : Motion.spring,
          builder: (context, v, child) {
            const maxAngle = 2.5 * math.pi / 180;
            return Transform(
              alignment: Alignment.center,
              transform: Matrix4.identity()
                ..setEntry(3, 2, 0.0012)
                ..rotateX(-v.dy * maxAngle)
                ..rotateY(v.dx * maxAngle),
              child: AnimatedScale(
                scale: _pressed ? .985 : 1,
                duration: Motion.fast,
                curve: Motion.spring,
                child: child,
              ),
            );
          },
          child: card,
        );

        final interactive = GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (d) => _press(d.localPosition, size),
          onTapUp: (_) => _release(),
          onTapCancel: _release,
          onTap: widget.onTap,
          child: tilted,
        );

        if (still) return interactive;
        return AnimatedBuilder(
          animation: _enter,
          builder: (context, child) {
            final v = Curves.easeOutCubic.transform(_enter.value);
            return Opacity(
              opacity: v,
              child: Transform.translate(
                offset: Offset(0, (1 - v) * 10),
                child: child,
              ),
            );
          },
          child: interactive,
        );
      },
    );
  }
}

class _CardBody extends StatelessWidget {
  const _CardBody({
    required this.t,
    required this.widget,
    required this.idSize,
    required this.rings,
    required this.tilt,
  });

  final NfcTokens t;
  final NfcIdHeroCard widget;
  final double idSize;
  final Animation<double> rings;
  final Offset tilt;

  static const _radius = BorderRadius.all(Radius.circular(26));
  static const _inner = BorderRadius.all(Radius.circular(20));

  @override
  Widget build(BuildContext context) {
    final ink = _CardInk.of(t);
    final code = widget.code;

    return Semantics(
      button: widget.onTap != null,
      label: '${widget.eyebrow}: ${code ?? ''}',
      child: Container(
        height: 212,
        decoration: BoxDecoration(
          borderRadius: _radius,
          gradient: LinearGradient(
            begin: const Alignment(-.9, -1),
            end: const Alignment(1, 1),
            colors: ink.bg,
            stops: ink.stops,
          ),
          // Aniqroq oltin chiziq va champagne tusli chuqur soya —
          // karta sirtdan ko'tarilgan qimmat buyumdek (redizayn 2026-09-24).
          border: Border.all(color: ink.border),
          boxShadow: ink.shadow,
        ),
        child: ClipRRect(
          borderRadius: _radius,
          child: Stack(
            children: [
              // GRAVYURA — kodga TESKARI suriladi (parallax).
              Positioned(
                right: -70 - tilt.dx * 6,
                top: -54 - tilt.dy * 6,
                width: 300,
                height: 300,
                child: IgnorePointer(
                  child: RepaintBoundary(
                    child: CustomPaint(
                      painter: _GuillochePainter(
                        progress: rings,
                        color: ink.rings,
                      ),
                    ),
                  ),
                ),
              ),
              // YUQORI CHETDAGI YORUG'LIK — metall/sirlangan qirra.
              Positioned(
                left: 24,
                right: 24,
                top: 0,
                height: 1.2,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [
                        Colors.white.withValues(alpha: 0),
                        Colors.white.withValues(alpha: ink.edge),
                        Colors.white.withValues(alpha: 0),
                      ]),
                    ),
                  ),
                ),
              ),
              // Ichki hoshiya — brend imzosi.
              Positioned.fill(
                child: IgnorePointer(
                  child: Container(
                    margin: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      borderRadius: _inner,
                      border: Border.all(color: ink.inner),
                    ),
                  ),
                ),
              ),
              Transform.translate(
                offset: Offset(tilt.dx * 2, tilt.dy * 2),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 22, 20, 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              widget.eyebrow.toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppType.eyebrow(color: ink.eyebrow),
                            ),
                          ),
                          if (widget.tier != null) ...[
                            const SizedBox(width: Gap.sm),
                            if (IdLux.isPaid(widget.tierCode))
                              IdTierBadge(tier: widget.tierCode)
                            else
                              _TierChip(label: widget.tier!, ink: ink),
                          ],
                        ],
                      ),
                      const Spacer(),
                      SizedBox(
                        width: double.infinity,
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            code ?? '—',
                            maxLines: 1,
                            style: AppType.heroId(
                                color: ink.text1, size: idSize),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        height: 1,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [
                            ink.rule,
                            ink.rule.withValues(alpha: 0),
                          ]),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  widget.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: widget.technical
                                      ? AppType.monoStyle(
                                          color: ink.text2,
                                          size: 12,
                                          weight: FontWeight.w500,
                                          letterSpacing: .2,
                                        )
                                      : TextStyle(
                                          fontFamily: AppType.sans,
                                          fontSize: 14.5,
                                          fontWeight: FontWeight.w600,
                                          height: 1.3,
                                          color: ink.text1,
                                        ),
                                ),
                                if (widget.subtitle.isNotEmpty)
                                  Text(
                                    widget.subtitle,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontFamily: AppType.sans,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      height: 1.35,
                                      color: ink.text2,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          if (widget.statusLabel != null) ...[
                            _Status(
                                label: widget.statusLabel!,
                                ok: widget.statusOk,
                                t: t,
                                ink: ink),
                            if (widget.actions.isNotEmpty)
                              const SizedBox(width: Gap.md),
                          ],
                          for (var i = 0; i < widget.actions.length; i++) ...[
                            if (i > 0) const SizedBox(width: Gap.sm),
                            _RoundAction(action: widget.actions[i], ink: ink),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TierChip extends StatelessWidget {
  const _TierChip({required this.label, required this.ink});

  final String label;
  final _CardInk ink;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.fromLTRB(9, 4, 8, 3),
        decoration: BoxDecoration(
          borderRadius: R.pill,
          border: Border.all(color: ink.chipBorder),
        ),
        child: Text(
          label.toUpperCase(),
          style: AppType.eyebrow(color: ink.eyebrow, size: 9),
        ),
      );
}

class _Status extends StatelessWidget {
  const _Status(
      {required this.label, required this.ok, required this.t, required this.ink});

  final String label;
  final bool ok;
  final NfcTokens t;
  final _CardInk ink;

  Color get _dot => ok ? t.success : t.warn;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _dot,
              boxShadow: [
                BoxShadow(
                  color: _dot.withValues(alpha: .18),
                  spreadRadius: 3,
                ),
              ],
            ),
          ),
          const SizedBox(width: 7),
          Text(
            label,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: ink.text2,
            ),
          ),
        ],
      );
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({required this.action, required this.ink});

  final NfcIdHeroAction action;
  final _CardInk ink;

  @override
  Widget build(BuildContext context) => Tooltip(
        message: action.tooltip,
        child: Semantics(
          button: true,
          label: action.tooltip,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: action.onTap,
            // Barmoq nishoni 44px, ko'rinadigan doira 34px.
            child: SizedBox(
              width: 44,
              height: 44,
              child: Center(
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ink.actionBg,
                    border: Border.all(color: ink.actionBorder),
                    boxShadow: ink.actionShadow,
                  ),
                  child: Icon(action.icon, size: 16, color: ink.text1),
                ),
              ),
            ),
          ),
        ),
      );
}

/// Kartaning ranglari.
///
/// IVORY'DA KARTA QORA (egasi, 2026-09-26: "saytdagi qora qilingan kartani
/// ilovada ham qilish kerak"). Sayt Pearl mavzusidagi namuna karta bilan
/// AYNAN bir xil: grafit #2C2B28 → #151514 → #22211F, iliq oq yozuv
/// #F4F1E8, oq 16% hoshiya (src/themes.css `--showcase-card-*`). Oq fonda
/// qora karta — ekrandagi eng aniq obyekt; champagne halqa va ichki ramka
/// qora ustida ham brend imzosi bo'lib qoladi. Porlash va nur yo'q.
///
/// Boshqa mavzularda karta avvalgidek mavzu yuzasidan chiziladi.
class _CardInk {
  const _CardInk({
    required this.bg,
    required this.stops,
    required this.border,
    required this.shadow,
    required this.rings,
    required this.edge,
    required this.inner,
    required this.eyebrow,
    required this.chipBorder,
    required this.rule,
    required this.text1,
    required this.text2,
    required this.actionBg,
    required this.actionBorder,
    required this.actionShadow,
  });

  final List<Color> bg;
  final List<double> stops;
  final Color border;
  final List<BoxShadow> shadow;
  final Color rings;
  final double edge;
  final Color inner;
  final Color eyebrow;
  final Color chipBorder;

  /// ID ostidagi ingichka chiziq.
  final Color rule;
  final Color text1;
  final Color text2;
  final Color actionBg;
  final Color actionBorder;
  final List<BoxShadow> actionShadow;

  static const _fg = Color(0xFFF4F1E8);

  factory _CardInk.of(NfcTokens t) {
    if (t.id == 'ivory') {
      return _CardInk(
        bg: const [Color(0xFF2C2B28), Color(0xFF151514), Color(0xFF22211F)],
        stops: const [0, .52, 1],
        border: Colors.white.withValues(alpha: .16),
        shadow: const [
          BoxShadow(color: Color(0x52171716), blurRadius: 45, offset: Offset(0, 20)),
          BoxShadow(color: Color(0x33171716), blurRadius: 8, offset: Offset(0, 2)),
        ],
        // FAQAT OQ-QORA — saytdagi namuna karta (`src/themes.css`
        // `--showcase-card-*`): oltin ham, jigarrang ham yo'q (egasi,
        // 2026-09-26: "karta qora, yozuvlari oq mayin bo'lsin").
        rings: Colors.white.withValues(alpha: .07),
        edge: .10,
        inner: Colors.white.withValues(alpha: .08),
        eyebrow: _fg.withValues(alpha: .60),
        chipBorder: Colors.white.withValues(alpha: .28),
        rule: Colors.white.withValues(alpha: .22),
        text1: _fg,
        text2: _fg.withValues(alpha: .60),
        actionBg: Colors.white.withValues(alpha: .08),
        actionBorder: Colors.white.withValues(alpha: .18),
        actionShadow: const [],
      );
    }
    // Sirt: yuqori chapda sof karta rangi, pastki o'ngda unga
    // champagne tusi aralashgan. Yorug' mavzuda bu fil suyagi rangini
    // beradi; qorong'ida esa mavzu yuzalari orasida qoladi.
    final warm = Color.lerp(t.surfaceSolid, t.brandSoft, t.isDark ? .18 : .42)!;
    return _CardInk(
      bg: [t.surfaceSolid, t.surfaceSolid, warm],
      stops: const [0, .45, 1],
      border: t.brand.withValues(alpha: t.isDark ? .38 : .55),
      shadow: [
        ...t.shadowFloat,
        if (!t.isDark)
          BoxShadow(
            color: t.brand.withValues(alpha: .18),
            blurRadius: 34,
            spreadRadius: -16,
            offset: const Offset(0, 20),
          ),
      ],
      rings: t.brand.withValues(alpha: t.isDark ? .22 : .30),
      edge: t.isDark ? .18 : .95,
      inner: t.brand.withValues(alpha: .22),
      eyebrow: t.brandInk,
      chipBorder: t.brand.withValues(alpha: .6),
      rule: t.brand.withValues(alpha: .55),
      text1: t.text1,
      text2: t.text2,
      actionBg: t.surfaceSolid,
      actionBorder: t.border1,
      actionShadow: t.shadowTiny,
    );
  }
}

/// Konsentrik ingichka halqalar — NFC to'lqini, gravyura uslubida.
///
/// Halqalar orasidagi masofa doimiy, faqat hammasi birga juda sekin
/// tashqariga suriladi: eng tashqisi xiralashib yo'qoladi, markazda
/// yangisi paydo bo'ladi. Ko'z buni "harakat" deb emas, "tirik" deb
/// o'qiydi — aynan shu kerak.
class _GuillochePainter extends CustomPainter {
  _GuillochePainter({required this.progress, required this.color})
      : super(repaint: progress);

  final Animation<double> progress;
  final Color color;

  static const _step = 16.0;
  static const _count = 9;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final maxR = _step * (_count + 1);
    final shift = progress.value * _step;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = .7;
    for (var i = 0; i <= _count; i++) {
      final r = 22 + i * _step + shift;
      // Markazga yaqin va eng chetdagi halqalar xiraroq — chegara
      // "kesilgan" emas, erib ketgandek ko'rinadi.
      final edge = (r / maxR).clamp(0.0, 1.0);
      final fade = math.sin(edge * math.pi).clamp(0.0, 1.0);
      paint.color = color.withValues(alpha: color.a * fade);
      canvas.drawCircle(c, r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GuillochePainter old) =>
      old.color != color || old.progress != progress;
}
