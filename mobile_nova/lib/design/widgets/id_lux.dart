import 'package:flutter/material.dart';

import '../../l10n/gen/app_localizations.dart';
import '../theme/typography.dart';
import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';

// ═══════════════════════════════════════════════════════════════════
// PULLIK NFC ID — YAGONA PREMIUM DIZAYN TIZIMI
//
// Egasining talabi (2026-09): "Pullik ID'ni ko'rgan odam 'bu maxsus
// ID ekan' deb bir qarashda tushunsin". Katalog, profil, qidiruv,
// sovg'a sahifasi, NFC Center — hammasi SHU fayldan o'qiydi, shuning
// uchun bitta kod hamma joyda bir xil qimmat ko'rinadi.
//
// TOIFALAR ORASIDAGI FARQ — MATERIAL BILAN, NEON BILAN EMAS:
//
//   Gold       — iliq oltin varaq, bitta yumshoq yaltirash. Kirish
//                darajasidagi premium: chiroyli, lekin sokin.
//   Premium    — shampan-bronza, ingichka "brushed metal" chiziqlar,
//                grafit badge. Zamonaviy va ancha qimmat.
//   Exclusive  — qora oniks, oltin folga raqamlar, gravyura halqalar.
//                Eng noyob — ro'yxatda uni hech narsa bilan
//                adashtirib bo'lmaydi.
//
// Bepul (bronza) va kumush ID — SODDA: bu tizimga kirmaydi
// (`IdLux.of` -> null) va oddiy plastinka bo'lib qoladi.
//
// Glow/neon YO'Q: soya faqat pastga, past shaffoflikda (chuqurlik),
// yaltirash statik (animatsiyasiz — ro'yxatda o'nlab karta bo'lsa
// ham kadr og'irlashmaydi).
// ═══════════════════════════════════════════════════════════════════

/// Toifa nomi — hamma joyda bitta.
String idTierLabel(L l, String tier) => switch (tier) {
      'free' => l.idTierFree,
      'silver' => l.idTierSilver,
      'gold' => l.idTierGold,
      'premium' => l.idTierPremium,
      'exclusive' => l.idTierExclusive,
      _ => tier,
    };

enum LuxTexture { sheen, brushed, guilloche }

/// Bitta pullik toifaning "materiali".
class IdLux {
  const IdLux({
    required this.tier,
    required this.surface,
    required this.edge,
    required this.ink,
    required this.soft,
    required this.hairline,
    required this.badgeFill,
    required this.badgeInk,
    required this.icon,
    required this.texture,
    required this.textureColor,
    required this.depth,
    this.foil,
    this.badgeLine,
    this.dark = false,
  });

  final String tier;

  /// Karta yuzasi.
  final Gradient surface;

  /// Metall hoshiya (1.2 px).
  final Gradient edge;

  /// Raqam rangi (folga bo'lmasa).
  final Color ink;

  /// Raqam ustidagi folga — Premium/Exclusive.
  final Gradient? foil;

  /// Ikkinchi darajali matn shu yuzada.
  final Color soft;

  /// Ichki ingichka hoshiya va ajratgich.
  final Color hairline;

  final Gradient badgeFill;
  final Color badgeInk;
  final Color? badgeLine;
  final IconData icon;

  final LuxTexture texture;
  final Color textureColor;

  /// Yengil chuqurlik — faqat pastga, glow emas.
  final List<BoxShadow> depth;

  /// Yuza qorong'i (Exclusive) — ustidagi elementlar yorug' bo'ladi.
  final bool dark;

  static bool isPaid(String tier) =>
      tier == 'gold' || tier == 'premium' || tier == 'exclusive';

  /// Daraja ierarxiyasi: katalogda saralash va solishtirish uchun.
  static int rank(String tier) => switch (tier) {
        'exclusive' => 5,
        'premium' => 4,
        'gold' => 3,
        'silver' => 2,
        _ => 1,
      };

  /// `null` — bepul/kumush: sodda ko'rinish.
  static IdLux? of(NfcTokens t, String tier) {
    if (!isPaid(tier)) return null;
    if (t.id == 'mono') return _mono(tier, t.isDark);
    // MATERIAL HAR MAVZUDA BIR XIL (egasi, 2026-09: "har bir temada
    // o'z qiymatini yo'qotmasin va aniq ajralib tursin"). Qorong'i
    // mavzularda Oltin va Premium ham qorong'i bo'lsa, uchala toifa
    // qora fonda bir-biriga o'xshab qolardi. Endi:
    //   Oltin     — har doim yorqin oltin varaq;
    //   Premium   — har doim shampan-bronza metall;
    //   Eksklyuziv — har doim qora oniks + oltin folga.
    // Qorong'i fonda Oltin/Premium metall plastinkadek "yonadi",
    // Eksklyuziv esa oltin hoshiyasi bilan ajraladi.
    return switch (tier) {
      'gold' => _gold,
      'premium' => _premium,
      _ => t.isDark ? _exclusiveDark : _exclusive,
    };
  }

  static const _tl = Alignment(-1, -1);
  static const _br = Alignment(1, 1);

  // ─────────────────────────────── GOLD — iliq oltin varaq
  static const _gold = IdLux(
    tier: 'gold',
    surface: LinearGradient(begin: _tl, end: _br, colors: [
      Color(0xFFFFFCF3), Color(0xFFFBF0D2), Color(0xFFF2DFA8),
    ], stops: [0, .55, 1]),
    edge: LinearGradient(begin: _tl, end: _br, colors: [
      Color(0xFFF3DC92), Color(0xFFC9A13B), Color(0xFF9C7A22), Color(0xFFE8CB73),
    ]),
    ink: Color(0xFF3B2A06),
    soft: Color(0xFF6E5418),
    hairline: Color(0x40B8862B),
    badgeFill: LinearGradient(colors: [Color(0xFFF7E2A0), Color(0xFFD9B44A)]),
    badgeInk: Color(0xFF362606),
    badgeLine: Color(0x80B8862B),
    icon: Icons.star_rounded,
    texture: LuxTexture.sheen,
    textureColor: Color(0x66FFFFFF),
    depth: [
      BoxShadow(color: Color(0x24A07A1E), blurRadius: 18, offset: Offset(0, 8)),
    ],
  );

  // ─────────────────────── PREMIUM — shampan-bronza, brushed metal
  static const _premium = IdLux(
    tier: 'premium',
    surface: LinearGradient(begin: _tl, end: _br, colors: [
      Color(0xFFFBF7F2), Color(0xFFF0E4D6), Color(0xFFE0CAB3),
    ], stops: [0, .5, 1]),
    edge: LinearGradient(begin: _tl, end: _br, colors: [
      Color(0xFFEFD6B4), Color(0xFFB07A3C), Color(0xFF5E3E1C), Color(0xFFD9B489),
    ]),
    ink: Color(0xFF22160A),
    foil: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Color(0xFF3A2612), Color(0xFF1A1008), Color(0xFF5A3A18)]),
    soft: Color(0xFF6A4D30),
    hairline: Color(0x3D8A5E2E),
    badgeFill: LinearGradient(colors: [Color(0xFF2E2923), Color(0xFF141210)]),
    badgeInk: Color(0xFFEBCB98),
    badgeLine: Color(0x99B07A3C),
    icon: Icons.diamond_outlined,
    texture: LuxTexture.brushed,
    textureColor: Color(0x1A5E3E1C),
    depth: [
      BoxShadow(color: Color(0x2E5E3E1C), blurRadius: 22, offset: Offset(0, 10)),
    ],
  );

  // ─────────────────── EXCLUSIVE — qora oniks, oltin folga, gravyura
  static const _exclusive = IdLux(
    tier: 'exclusive',
    surface: LinearGradient(begin: _tl, end: _br, colors: [
      Color(0xFF2A2621), Color(0xFF161412), Color(0xFF0B0A09),
    ], stops: [0, .5, 1]),
    edge: LinearGradient(begin: _tl, end: _br, colors: [
      Color(0xFFF6DE8D), Color(0xFFB8862B), Color(0xFF5E4410),
      Color(0xFFD4AF37), Color(0xFFF6DE8D),
    ]),
    ink: Color(0xFFF1D98F),
    foil: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Color(0xFFFBEBB8), Color(0xFFD4AF37), Color(0xFFA8801F),
          Color(0xFFF1D98F)], stops: [0, .45, .7, 1]),
    soft: Color(0xFFCDB88A),
    hairline: Color(0x4DD4AF37),
    badgeFill: LinearGradient(colors: [
      Color(0xFFF8E6A6), Color(0xFFD4AF37), Color(0xFFAE8423),
    ]),
    badgeInk: Color(0xFF16130E),
    icon: Icons.workspace_premium_rounded,
    texture: LuxTexture.guilloche,
    textureColor: Color(0x2ED4AF37),
    depth: [
      BoxShadow(color: Color(0x47000000), blurRadius: 26, offset: Offset(0, 12)),
    ],
    dark: true,
  );

  static const _exclusiveDark = IdLux(
    tier: 'exclusive',
    surface: LinearGradient(begin: _tl, end: _br, colors: [
      Color(0xFF23201B), Color(0xFF100F0D), Color(0xFF060605),
    ]),
    edge: LinearGradient(begin: _tl, end: _br, colors: [
      Color(0xFFF6DE8D), Color(0xFFB8862B), Color(0xFF5E4410),
      Color(0xFFD4AF37), Color(0xFFF6DE8D),
    ]),
    ink: Color(0xFFF1D98F),
    foil: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Color(0xFFFBEBB8), Color(0xFFD4AF37), Color(0xFFA8801F),
          Color(0xFFF1D98F)], stops: [0, .45, .7, 1]),
    soft: Color(0xFFCDB88A),
    hairline: Color(0x4DD4AF37),
    badgeFill: LinearGradient(colors: [
      Color(0xFFF8E6A6), Color(0xFFD4AF37), Color(0xFFAE8423),
    ]),
    badgeInk: Color(0xFF16130E),
    icon: Icons.workspace_premium_rounded,
    texture: LuxTexture.guilloche,
    textureColor: Color(0x33D4AF37),
    depth: [
      BoxShadow(color: Color(0x80000000), blurRadius: 26, offset: Offset(0, 12)),
    ],
    dark: true,
  );

  /// OQ-QORA MAVZU — faqat oq va qora (egasining qat'iy talabi).
  /// Ierarxiya tonni almashtirish bilan: Gold oqish, Premium kulrang,
  /// Exclusive to'la qora.
  static IdLux _mono(String tier, bool isDark) {
    const tl = _tl, br = _br;
    return switch (tier) {
      'gold' => IdLux(
          tier: tier,
          surface: LinearGradient(begin: tl, end: br, colors: isDark
              ? const [Color(0xFF2A2A2A), Color(0xFF1C1C1C)]
              : const [Color(0xFFFFFFFF), Color(0xFFEDEDED)]),
          edge: const LinearGradient(colors: [Color(0xFFB5B5B5), Color(0xFF4A4A4A)]),
          ink: isDark ? const Color(0xFFF2F2F2) : const Color(0xFF151515),
          soft: isDark ? const Color(0xFFB0B0B0) : const Color(0xFF555555),
          hairline: const Color(0x33808080),
          badgeFill: const LinearGradient(colors: [Color(0xFFEDEDED), Color(0xFFCFCFCF)]),
          badgeInk: const Color(0xFF151515),
          icon: Icons.star_rounded,
          texture: LuxTexture.sheen,
          textureColor: const Color(0x33FFFFFF),
          depth: const [BoxShadow(color: Color(0x1F000000), blurRadius: 16, offset: Offset(0, 8))],
        ),
      'premium' => IdLux(
          tier: tier,
          surface: LinearGradient(begin: tl, end: br, colors: isDark
              ? const [Color(0xFF3A3A3A), Color(0xFF242424)]
              : const [Color(0xFFF1F1F1), Color(0xFFD2D2D2)]),
          edge: const LinearGradient(colors: [Color(0xFF8A8A8A), Color(0xFF151515)]),
          ink: isDark ? const Color(0xFFFFFFFF) : const Color(0xFF111111),
          soft: isDark ? const Color(0xFFBDBDBD) : const Color(0xFF4A4A4A),
          hairline: const Color(0x40707070),
          badgeFill: const LinearGradient(colors: [Color(0xFF2A2A2A), Color(0xFF0E0E0E)]),
          badgeInk: const Color(0xFFFFFFFF),
          icon: Icons.diamond_outlined,
          texture: LuxTexture.brushed,
          textureColor: const Color(0x14000000),
          depth: const [BoxShadow(color: Color(0x29000000), blurRadius: 20, offset: Offset(0, 10))],
        ),
      _ => IdLux(
          tier: tier,
          surface: const LinearGradient(begin: tl, end: br,
              colors: [Color(0xFF262626), Color(0xFF0A0A0A)]),
          edge: const LinearGradient(begin: tl, end: br,
              colors: [Color(0xFFFFFFFF), Color(0xFF7A7A7A), Color(0xFFFFFFFF)]),
          ink: const Color(0xFFFFFFFF),
          foil: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter,
              colors: [Color(0xFFFFFFFF), Color(0xFFBDBDBD), Color(0xFFFFFFFF)]),
          soft: const Color(0xFFBDBDBD),
          hairline: const Color(0x40FFFFFF),
          badgeFill: const LinearGradient(colors: [Color(0xFFFFFFFF), Color(0xFFD9D9D9)]),
          badgeInk: const Color(0xFF0A0A0A),
          icon: Icons.workspace_premium_rounded,
          texture: LuxTexture.guilloche,
          textureColor: const Color(0x26FFFFFF),
          depth: const [BoxShadow(color: Color(0x40000000), blurRadius: 24, offset: Offset(0, 12))],
          dark: true,
        ),
    };
  }
}

// ───────────────────────────────────────────────────────────── badge

/// TOIFA BELGISI — Gold / Premium / Exclusive.
///
/// Rang yolg'iz yetmaydi (rang ko'rmaydiganlar, oq-qora skrinshot):
/// belgi + so'z. Bepul/kumush uchun faqat sokin konturli yozuv
/// (`plain: true` bo'lsa) yoki hech narsa.
class IdTierBadge extends StatelessWidget {
  const IdTierBadge({
    super.key,
    required this.tier,
    this.dense = false,
    this.plain = false,
  });

  final String tier;
  final bool dense;

  /// Bepul/kumush toifani ham ko'rsatish (katalogda).
  final bool plain;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final lux = IdLux.of(t, tier);
    final label = idTierLabel(L.of(context), tier).toUpperCase();
    final fs = dense ? 8.5 : 9.5;
    final pad = dense
        ? const EdgeInsets.fromLTRB(7, 3, 8, 3)
        : const EdgeInsets.fromLTRB(9, 5, 11, 5);

    if (lux == null) {
      if (!plain || tier.isEmpty) return const SizedBox.shrink();
      return Container(
        padding: pad,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: t.border2),
        ),
        child: Text(label,
            maxLines: 1, style: AppType.eyebrow(color: t.text2, size: fs)),
      );
    }

    return Container(
      key: ValueKey('tier-badge-$tier'),
      padding: pad,
      decoration: BoxDecoration(
        gradient: lux.badgeFill,
        borderRadius: BorderRadius.circular(999),
        border: lux.badgeLine == null
            ? null
            : Border.all(color: lux.badgeLine!, width: .8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(lux.icon, size: fs + 3, color: lux.badgeInk),
          const SizedBox(width: 4),
          Text(
            label,
            maxLines: 1,
            style: AppType.eyebrow(color: lux.badgeInk, size: fs)
                .copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

// ───────────────────────────────────────────────────────── yuza

/// PULLIK ID YUZASI — metall hoshiya + material + tekstura + ichki
/// ingichka hoshiya. Bosilganda yengil kichrayadi va hoshiya
/// yorishadi (sifatli "press" hissi, lekin glow emas).
class LuxSurface extends StatefulWidget {
  const LuxSurface({
    super.key,
    required this.lux,
    required this.child,
    this.radius = 22,
    this.padding = const EdgeInsets.all(18),
    this.onTap,
    this.selected = false,
    this.textureScale = 1,
  });

  final IdLux lux;
  final Widget child;
  final double radius;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  /// Tanlangan (faol) — hoshiya qalinroq.
  final bool selected;
  final double textureScale;

  @override
  State<LuxSurface> createState() => _LuxSurfaceState();
}

class _LuxSurfaceState extends State<LuxSurface> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final lux = widget.lux;
    final r = widget.radius;
    final edgeW = widget.selected ? 1.8 : 1.2;

    final card = AnimatedContainer(
      duration: Motion.fast,
      curve: Curves.easeOut,
      padding: EdgeInsets.all(edgeW),
      decoration: BoxDecoration(
        gradient: lux.edge,
        borderRadius: BorderRadius.circular(r),
        boxShadow: _down ? const [] : lux.depth,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(r - edgeW),
        child: DecoratedBox(
          decoration: BoxDecoration(gradient: lux.surface),
          child: Stack(
            children: [
              Positioned.fill(
                child: IgnorePointer(
                  child: RepaintBoundary(
                    child: CustomPaint(
                      painter: LuxTexturePainter(
                        texture: lux.texture,
                        color: lux.textureColor,
                        scale: widget.textureScale,
                      ),
                    ),
                  ),
                ),
              ),
              // Ichki ingichka hoshiya — gravyura hissi.
              Positioned.fill(
                child: IgnorePointer(
                  child: Container(
                    margin: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(r - 6),
                      border: Border.all(color: lux.hairline, width: .7),
                    ),
                  ),
                ),
              ),
              Padding(padding: widget.padding, child: widget.child),
            ],
          ),
        ),
      ),
    );

    if (widget.onTap == null) return card;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? .975 : 1,
        duration: Motion.fast,
        curve: Motion.spring,
        child: card,
      ),
    );
  }
}

/// Statik tekstura — animatsiyasiz, `RepaintBoundary` ichida.
class LuxTexturePainter extends CustomPainter {
  const LuxTexturePainter({
    required this.texture,
    required this.color,
    this.scale = 1,
  });

  final LuxTexture texture;
  final Color color;
  final double scale;

  @override
  void paint(Canvas canvas, Size size) {
    switch (texture) {
      case LuxTexture.sheen:
        _sheen(canvas, size, color);
      case LuxTexture.brushed:
        // Ingichka diagonal chiziqlar — cho'tkalangan metall.
        final p = Paint()
          ..color = color
          ..strokeWidth = .6;
        final step = 5.0 * scale;
        for (var x = -size.height; x < size.width; x += step) {
          canvas.drawLine(Offset(x, size.height), Offset(x + size.height * .35, 0), p);
        }
        // Yaltirash — juda nozik: qorong'i yuzada oq chiziq "arzon"
        // ko'rinardi, shuning uchun u tekstura rangidan olinadi.
        _sheen(canvas, size, color.withValues(alpha: (color.a * 1.6).clamp(0, .16)));
      case LuxTexture.guilloche:
        // Gravyura halqalari o'ng-tepada + nozik yaltirash.
        final c = Offset(size.width * .86, size.height * .18);
        final p = Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = .6;
        final maxR = size.longestSide * .95;
        final step = 9.0 * scale;
        var i = 0;
        for (var r = 10.0 * scale; r < maxR; r += step, i++) {
          final fade = (1 - r / maxR).clamp(.0, 1.0);
          p.color = color.withValues(alpha: color.a * (.35 + .65 * fade));
          canvas.drawCircle(c, r, p);
        }
        _sheen(canvas, size, const Color(0x14FFF4D0));
    }
  }

  /// Bitta yumshoq diagonal yaltirash — statik.
  static void _sheen(Canvas canvas, Size size, Color c) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..shader = LinearGradient(
        begin: const Alignment(-1, -.6),
        end: const Alignment(1, .6),
        colors: [c.withValues(alpha: 0), c, c.withValues(alpha: 0)],
        stops: const [.28, .42, .56],
      ).createShader(rect);
    canvas.drawRect(rect, paint);
  }

  @override
  bool shouldRepaint(covariant LuxTexturePainter old) =>
      old.texture != texture || old.color != color || old.scale != scale;
}

// ──────────────────────────────────────────────────────────── raqam

/// ID RAQAMI — katta, kuchli, mono (ID shrift qoidasi: `0/O`, `1/I`
/// adashmasin). Premium/Exclusive'da folga (gradient) bilan.
class LuxIdNumber extends StatelessWidget {
  const LuxIdNumber({
    super.key,
    required this.code,
    required this.lux,
    this.size = 30,
  });

  final String code;
  final IdLux lux;
  final double size;

  @override
  Widget build(BuildContext context) {
    final text = Text(
      code,
      maxLines: 1,
      style: AppType.monoStyle(
        color: lux.foil == null ? lux.ink : Colors.white,
        size: size,
        weight: FontWeight.w600,
        letterSpacing: size * .11,
      ),
    );
    final number = lux.foil == null
        ? text
        : ShaderMask(
            blendMode: BlendMode.srcIn,
            shaderCallback: (r) => lux.foil!.createShader(r),
            child: text,
          );
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.centerLeft,
      child: number,
    );
  }
}

// ───────────────────────────────────────────────────── mahsulot kartasi

/// PULLIK ID — MAHSULOT KARTASI.
///
/// Qidiruv natijasi, ID sahifasi, sovg'a sahifasi — hammasi shu.
///
///   [NFC ID]                        [★ OLTIN]
///
///   V I P 0 0 1                     <- katta, mono, folga
///   ─────────────── metall chiziq
///   1 200 000 so'm          [Sotuvda]  /  footer
///
/// Bepul/kumush uchun `null` lux — oddiy, sodda karta chiziladi
/// (`IdProductCard` o'zi hal qiladi).
class IdProductCard extends StatelessWidget {
  const IdProductCard({
    super.key,
    required this.code,
    required this.tier,
    this.eyebrow = 'NFC ID',
    this.price,
    this.priceFrom = false,
    this.status,
    this.footer,
    this.onTap,
    this.hero = false,
  });

  final String code;
  final String tier;
  final String eyebrow;

  /// Formatlangan narx (masalan `1 200 000 so'm`).
  final String? price;
  final bool priceFrom;

  /// Holat kapsulasi: (yozuv, rang).
  final (String, Color)? status;

  /// Pastki qator (narx o'rniga yoki uning ostida).
  final Widget? footer;
  final VoidCallback? onTap;

  /// Katta ko'rinish — ID sahifasi va sovg'a sahifasi.
  final bool hero;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final lux = IdLux.of(t, tier);
    final numberSize = hero ? 38.0 : 30.0;

    if (lux == null) return _plain(context, t, numberSize);

    return LuxSurface(
      key: ValueKey('id-lux-$code'),
      lux: lux,
      onTap: onTap,
      radius: hero ? 26 : 22,
      padding: EdgeInsets.fromLTRB(20, hero ? 20 : 16, 18, hero ? 20 : 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  eyebrow.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.eyebrow(color: lux.soft, size: 9.5),
                ),
              ),
              IdTierBadge(tier: tier, dense: !hero),
            ],
          ),
          SizedBox(height: hero ? 26 : 18),
          LuxIdNumber(code: code, lux: lux, size: numberSize),
          SizedBox(height: hero ? 18 : 12),
          Container(
            height: 1,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [
                lux.hairline.withValues(alpha: .9),
                lux.hairline.withValues(alpha: 0),
              ]),
            ),
          ),
          if (price != null || status != null || footer != null)
            SizedBox(height: hero ? 16 : 12),
          if (price != null || status != null)
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (price != null)
                  Expanded(child: _Price(price: price!, from: priceFrom, lux: lux, hero: hero))
                else
                  const Spacer(),
                if (status != null) _StatusChip(status: status!, lux: lux),
              ],
            ),
          if (footer != null) ...[
            if (price != null || status != null) const SizedBox(height: 12),
            footer!,
          ],
        ],
      ),
    );
  }

  /// BEPUL / KUMUSH — SODDA: oddiy sirt, oddiy chegara, tekstura yo'q.
  Widget _plain(BuildContext context, NfcTokens t, double numberSize) {
    final body = Container(
      key: ValueKey('id-plain-$code'),
      padding: const EdgeInsets.fromLTRB(18, 16, 16, 16),
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: t.border2),
        boxShadow: t.shadowTiny,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(eyebrow.toUpperCase(),
                    maxLines: 1,
                    style: AppType.eyebrow(color: t.text3, size: 9.5)),
              ),
              IdTierBadge(tier: tier, dense: true, plain: true),
            ],
          ),
          const SizedBox(height: 14),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              code,
              maxLines: 1,
              style: AppType.monoStyle(
                color: t.text1,
                size: numberSize * .82,
                weight: FontWeight.w600,
                letterSpacing: 2.2,
              ),
            ),
          ),
          if (price != null || status != null) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                if (price != null)
                  Expanded(
                    child: Text(
                      priceFrom ? '${L.of(context).idPriceFrom} $price' : price!,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: t.text1,
                      ),
                    ),
                  )
                else
                  const Spacer(),
                if (status != null)
                  _StatusChip(status: status!, lux: null),
              ],
            ),
          ],
          if (footer != null) ...[
            const SizedBox(height: 12),
            footer!,
          ],
        ],
      ),
    );
    if (onTap == null) return body;
    return _Press(onTap: onTap!, child: body);
  }
}

class _Price extends StatelessWidget {
  const _Price({required this.price, required this.from, required this.lux, required this.hero});
  final String price;
  final bool from;
  final IdLux lux;
  final bool hero;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (from)
          Text(L.of(context).idPriceFrom,
              style: AppType.eyebrow(color: lux.soft, size: 8.5)),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            price,
            maxLines: 1,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: hero ? 24 : 19,
              fontWeight: FontWeight.w700,
              letterSpacing: -.2,
              color: lux.ink,
            ),
          ),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status, required this.lux});
  final (String, Color) status;
  final IdLux? lux;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final (label, color) = status;
    final dark = lux?.dark ?? t.isDark;
    // Holat nuqtasi — yuza qorong'i bo'lsa ham o'qiladi.
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 5, 10, 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: dark ? const Color(0x1FFFFFFF) : const Color(0x0F000000),
        border: Border.all(color: lux?.hairline ?? t.border2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(shape: BoxShape.circle, color: color),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            maxLines: 1,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: lux?.ink ?? t.text1,
            ),
          ),
        ],
      ),
    );
  }
}

class _Press extends StatefulWidget {
  const _Press({required this.onTap, required this.child});
  final VoidCallback onTap;
  final Widget child;

  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapUp: (_) => setState(() => _down = false),
        onTapCancel: () => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? .975 : 1,
          duration: Motion.fast,
          curve: Motion.spring,
          child: widget.child,
        ),
      );
}
