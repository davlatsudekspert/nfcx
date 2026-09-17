import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'logo.dart';
import 'press.dart';
import 'sweep.dart';

/// NFC ID KARTASI — ilovaning qahramoni.
///
/// Bu shunchaki karta emas: mahsulotning o'zi. Foydalanuvchi uni
/// do'stiga ko'rsatadi, shuning uchun u eng nafis element bo'lishi
/// kerak.
///
/// METALL HIS QANDAY QURILGAN — to'rt qatlam:
/// 1. **Asos gradienti** — yetti to'xtash nuqta. Haqiqiy metallda
///    yorug'lik bir tekis tarqalmaydi: quyuq qirra → yorug' aks →
///    to'yingan rang → yana quyuq. Ikki nuqtali gradient
///    "plastmassa" bo'lib ko'rinadi.
/// 2. **Burchak yorug'ligi** — yuqori chapdan tushadigan radial oq
///    dog'. Butun ilovada yorug'lik bitta tomondan keladi.
/// 3. **Yorug'lik chizig'i** — 4.2 s da bir marta o'tadi.
/// 4. **Qirra va soya** — tepada 1 px yorug' chiziq (metall kesimi),
///    ostida issiq soya va oltin nur.
///
/// Ekslyuziv tarifda qirra IKKI QAVATLI — bu uning mahsulotdagi
/// eng yuqori daraja ekanini ko'rsatadi.
///
/// JISMONIY KARTA BILAN BIR XIL: old tomonda brend va kod, orqa
/// tomonda medalyon va profil manzili. Kartani bosganda u
/// o'giriladi (720 ms).

class IdentityCard extends StatefulWidget {
  const IdentityCard({
    super.key,
    required this.code,
    required this.tier,
    this.holder = '',
    this.url,
    this.onTap,
    this.flippable = true,
    this.sweep = true,
    this.aspect = 1.585,
  });

  /// ID kodi — `GLD777`.
  final String code;

  final Tier tier;

  /// Egasining ismi.
  final String holder;

  /// `nfcstore.uz/gld777`.
  final String? url;

  /// Berilsa — bosish kartani o'girmaydi, shu amalni bajaradi.
  final VoidCallback? onTap;

  /// Bosilganda orqa tomoni ochiladi.
  final bool flippable;

  final bool sweep;

  /// CR80 jismoniy kartaning nisbati — 85.6 × 54 mm.
  final double aspect;

  @override
  State<IdentityCard> createState() => _IdentityCardState();
}

class _IdentityCardState extends State<IdentityCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _flip = AnimationController(
    vsync: this,
    duration: M.flip,
  );

  @override
  void dispose() {
    _flip.dispose();
    super.dispose();
  }

  void _tap() {
    if (widget.onTap != null) {
      widget.onTap!();
      return;
    }
    if (!widget.flippable) return;
    if (_flip.status == AnimationStatus.completed ||
        _flip.status == AnimationStatus.forward) {
      _flip.reverse();
    } else {
      _flip.forward();
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(widget.tier);

    return Press(
      onTap: (widget.onTap != null || widget.flippable) ? _tap : null,
      minSize: 0,
      scale: .985,
      child: AspectRatio(
        aspectRatio: widget.aspect,
        child: AnimatedBuilder(
          animation: _flip,
          builder: (context, _) {
            final t = M.curve.transform(_flip.value);
            final angle = t * math.pi;
            final showBack = t > .5;

            return Transform(
              alignment: Alignment.center,
              transform: Matrix4.identity()
                // Perspektiva — busiz o'girilish yassi va sun'iy
                // ko'rinadi.
                ..setEntry(3, 2, .0012)
                ..rotateY(angle),
              child: showBack
                  // Orqa tomon teskari chizilmasligi uchun uni
                  // qayta o'giramiz.
                  ? Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.identity()..rotateY(math.pi),
                      child: _CardShell(
                        style: style,
                        sweep: false,
                        child: _BackFace(
                          url: widget.url,
                          style: style,
                        ),
                      ),
                    )
                  : _CardShell(
                      style: style,
                      sweep: widget.sweep && _flip.value == 0,
                      child: _FrontFace(
                        code: widget.code,
                        holder: widget.holder,
                        url: widget.url,
                        style: style,
                        tier: widget.tier,
                      ),
                    ),
            );
          },
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// KORPUS
// ─────────────────────────────────────────────────────────────

/// Metall yuza, qirra, soya — ikkala tomon uchun umumiy.
class _CardShell extends StatelessWidget {
  const _CardShell({
    required this.style,
    required this.child,
    this.sweep = true,
  });

  final TierStyle style;
  final Widget child;
  final bool sweep;

  @override
  Widget build(BuildContext context) {
    Widget face = Stack(
      fit: StackFit.expand,
      children: [
        // 1 — metall asos.
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: style.hasMaterial ? style.surface : C.raisedSurface,
            borderRadius: BorderRadius.circular(R.metalCard),
          ),
        ),

        // 2 — yuqori chap burchakdagi aks (specular).
        //
        // Gradient o'sha burchakda ATAYLAB quyuq: aks quyuq yuzaga
        // tushgandagina "yaltirash" bo'lib ko'rinadi. Yorug' joyga
        // tushsa, karta shunchaki oqarib ketadi.
        if (style.hasMaterial)
          DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.metalCard),
              gradient: const RadialGradient(
                center: Alignment(-.72, -.92),
                radius: .95,
                colors: [Color(0x42FFFFFF), Color(0x00FFFFFF)],
                stops: [0, .62],
              ),
            ),
          ),

        // 3 — pastki o'ng burchakdagi quyuqlashuv. Metall
        // yuzaning "og'irligi" shundan keladi.
        if (style.hasMaterial)
          DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.metalCard),
              gradient: const RadialGradient(
                center: Alignment(.9, 1),
                radius: .9,
                colors: [Color(0x54000000), Color(0x00000000)],
                stops: [0, .7],
              ),
            ),
          ),

        // 4 — kontent.
        //
        // KICHIK KARTA — KICHIK ICHKI MASOFA. Prototipda mini karta
        // (`.mcard.sm`) uchun alohida o'lchamlar berilgan: 20 dp
        // padding 132 dp enlikdagi kartada kontentga joy
        // qoldirmaydi va u toshib ketardi.
        LayoutBuilder(
          builder: (context, c) {
            final k = (c.maxWidth / 340).clamp(.34, 1.0);
            return Padding(
              padding: EdgeInsets.all(S.x20 * k),
              child: child,
            );
          },
        ),

        // 5 — tepadagi metall kesimi.
        Positioned(
          left: S.x20,
          right: S.x20,
          top: 0,
          child: Container(
            height: 1,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Color(0x00FFFFFF),
                  Color(0x8CFFFFFF),
                  Color(0x00FFFFFF),
                ],
              ),
            ),
          ),
        ),

        // 6 — EKSLYUZIVNING IKKI QAVATLI QIRRASI.
        //
        // Ustiga chiziladi, korpusni ichkariga surmaydi: aks holda
        // metall karta chekkasigacha yetmay, orada qora halqa
        // ko'rinib qolardi.
        if (style.doubleEdge)
          Padding(
            padding: const EdgeInsets.all(3.5),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(R.metalCard - 3.5),
                border: Border.all(
                  color: style.dark.withValues(alpha: .72),
                  width: 1,
                ),
              ),
            ),
          ),
      ],
    );

    if (sweep) {
      face = LightSweep(radius: R.metalCard, opacity: .55, child: face);
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(R.metalCard),
        boxShadow: [
          const BoxShadow(
            color: Color(0xD9000000),
            blurRadius: 44,
            spreadRadius: -20,
            offset: Offset(0, 26),
          ),
          if (style.hasMaterial)
            BoxShadow(
              color: style.base.withValues(alpha: .38),
              blurRadius: 30,
              spreadRadius: -10,
            ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(R.metalCard),
        child: Stack(
          fit: StackFit.expand,
          children: [
            face,
            // Tashqi qirra — metall kesimining yorug' chizig'i.
            IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(R.metalCard),
                  border: Border.all(
                    color: style.hasMaterial
                        ? style.light.withValues(alpha: .5)
                        : C.line,
                    width: 1,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// OLD TOMON
// ─────────────────────────────────────────────────────────────

class _FrontFace extends StatelessWidget {
  const _FrontFace({
    required this.code,
    required this.holder,
    required this.url,
    required this.style,
    required this.tier,
  });

  final String code;
  final String holder;
  final String? url;
  final TierStyle style;
  final Tier tier;

  /// Metall yuzada matn QUYUQ bo'ladi — oq matn oltin ustida
  /// o'qilmaydi (kontrast 4.5:1 dan past).
  Color get _ink =>
      style.hasMaterial ? const Color(0xFF17110A) : C.ink;

  /// Ikkilamchi matn ham yetarlicha quyuq: kumush yuzada ochroq
  /// rang 4.5:1 chegarasidan o'tmaydi.
  Color get _inkSoft =>
      style.hasMaterial ? const Color(0xCC17110A) : C.ink2;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, c) => _build(context, (c.maxWidth / 300).clamp(.34, 1.0)),
      );

  Widget _build(BuildContext context, double k) {
    // `k` — kartaning to'liq o'lchamga nisbati. Hamma o'lcham shunga
    // ko'paytiriladi, ya'ni mini karta kattasining aniq nusxasi
    // bo'ladi (prototipdagi `.mcard` va `.mcard.sm` munosabati).
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // LOGOTIP KARTANING OLD TOMONIDA (prototip: chap
            // yuqoridagi `[LOGO]`).
            //
            // Ilgari belgi faqat kartaning ORQA tomonida edi —
            // ya'ni odam kartani ag'darmaguncha brendni ko'rmasdi,
            // holbuki karta ilovaning eng ko'p ko'rinadigan
            // narsasi: bosh sahifada, profilda, do'konda.
            //
            // MEDALYON, YALANG'OCH BELGI EMAS: oltin belgi oltin
            // karta ustida ko'rinmaydi. Quyuq medalyon esa metall
            // yuzada aniq o'qiladi va jismoniy kartadagi chipga
            // hamohang.
            BrandMark(size: 18 * k, ring: false),
            SizedBox(width: 6 * k),
            Expanded(
              child: Text(
                style.hasMaterial
                    ? 'NFCSTORE · ${style.label.toUpperCase()}'
                    : 'NFCSTORE',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: T.meta.copyWith(
                  color: _inkSoft,
                  letterSpacing: 1.5 * k,
                  fontSize: 10.5 * k,
                ),
              ),
            ),
            // NFC belgisi — jismoniy kartadagi chip o'rni.
            Container(
              width: 30 * k,
              height: 30 * k,
              decoration: const BoxDecoration(
                color: Color(0x2E000000),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: NIcon(Ico.nfc, size: 17 * k, color: _ink),
            ),
          ],
        ),
        const Spacer(),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            code.toUpperCase(),
            style: T.code(30 * k, color: _ink, weight: FontWeight.w600),
          ),
        ),
        if (holder.isNotEmpty || (url ?? '').isNotEmpty) ...[
          SizedBox(height: 5 * k),
          Row(
            children: [
              if (holder.isNotEmpty)
                Flexible(
                  child: Text(
                    holder,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle.copyWith(color: _ink, fontSize: 14 * k),
                  ),
                ),
              if (holder.isNotEmpty && (url ?? '').isNotEmpty)
                Text('  ·  ', style: T.meta.copyWith(color: _inkSoft, fontSize: 11 * k)),
              if ((url ?? '').isNotEmpty)
                Flexible(
                  child: Text(
                    url!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.link.copyWith(color: _inkSoft, fontSize: 11 * k),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// ORQA TOMON
// ─────────────────────────────────────────────────────────────

class _BackFace extends StatelessWidget {
  const _BackFace({required this.url, required this.style});

  final String? url;
  final TierStyle style;

  @override
  Widget build(BuildContext context) {
    final ink = style.hasMaterial ? const Color(0xFF1C1405) : C.ink2;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const BrandMark(size: 44, ring: false),
        const SizedBox(height: S.x12),
        Text(
          'NFCSTORE',
          style: T.meta.copyWith(
            color: ink,
            fontSize: 11,
            letterSpacing: 3.2,
            fontWeight: FontWeight.w600,
          ),
        ),
        if ((url ?? '').isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            url!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.link.copyWith(
              color: ink.withValues(alpha: .7),
              fontSize: 11,
            ),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// KICHIK KARTA
// ─────────────────────────────────────────────────────────────

/// Ro'yxatdagi ixcham karta — "Mening ID'larim".
///
/// Kattasidan farqi: o'girilmaydi, yorug'lik chizig'i yo'q
/// (ro'yxatda bir nechta karta bo'ladi va hammasi harakatlansa
/// ekran bezovta bo'ladi).
class MiniIdCard extends StatelessWidget {
  const MiniIdCard({
    super.key,
    required this.code,
    required this.tier,
    this.onTap,
    this.active = false,
    this.width = 158,
  });

  final String code;
  final Tier tier;
  final VoidCallback? onTap;

  /// Faol ID — oltin halqa bilan belgilanadi.
  final bool active;

  final double width;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(tier);
    final ink = style.hasMaterial ? const Color(0xFF1C1405) : C.ink;

    return Press(
      onTap: onTap,
      minSize: 0,
      scale: .97,
      child: Container(
        width: width,
        padding: EdgeInsets.all(active ? 2 : 0),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(R.card + 2),
          border: active
              ? Border.all(color: C.accent.withValues(alpha: .85), width: 1.5)
              : null,
        ),
        child: Container(
          height: 84,
          padding: const EdgeInsets.all(S.x12),
          decoration: BoxDecoration(
            gradient: style.hasMaterial ? style.surface : C.raisedSurface,
            borderRadius: BorderRadius.circular(R.card),
            border: Border.all(
              color: style.hasMaterial
                  ? style.light.withValues(alpha: .45)
                  : C.line,
            ),
            boxShadow: C.e1,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                style.label.toUpperCase(),
                style: T.meta.copyWith(
                  color: ink.withValues(alpha: .72),
                  fontSize: 9.5,
                  letterSpacing: 1.5,
                ),
              ),
              const Spacer(),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  code.toUpperCase(),
                  style: T.code(19, color: ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tarif nuqtasi — ro'yxat va chiplarda materialni ko'rsatadi.
class TierDot extends StatelessWidget {
  const TierDot(this.tier, {super.key, this.size = 16});

  final Tier tier;
  final double size;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(tier);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: style.hasMaterial ? style.swatch : null,
        color: style.hasMaterial ? null : const Color(0x00000000),
        shape: BoxShape.circle,
        border: style.hasMaterial
            ? null
            : Border.all(color: C.ink3, width: 1),
      ),
    );
  }
}
