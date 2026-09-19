import 'package:flutter/material.dart';

import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';

/// Logotipni qanday ko'rsatish.
enum BrandLogoStyle {
  /// ORIGINAL fayl o'z foni bilan, yumshoq burchakli plastina ichida.
  /// Splash, Welcome va Auth kabi logotip "qahramon" bo'lgan joylarda.
  plate,

  /// Faqat oltin belgi — foni shaffof. Atrofdagi sirt allaqachon
  /// qorong'i bo'lgan joylarda (masalan Midnight'dagi karta ustida).
  mark,
}

/// NFCSTORE brend logotipi.
///
/// ## Logotip QAT'IY o'zgarmaydi
///
/// `assets/brand/nfcstore_logo.jpg` — yakuniy brend aktivi. U:
///
/// * qayta chizilmaydi;
/// * cho'zilmaydi (har doim `BoxFit.contain`, nisbati 1:1);
/// * DUMALOQ QILIB KESILMAYDI — belgi keng, gorizontal lokap
///   (2000px kanvasda 1311x668), doira maskasi tashqi to'lqinlarni
///   kesib tashlardi;
/// * mavzu bo'yicha avtomatik ranglanmaydi.
///
/// ## Mavzuga moslashish ATROFDA bo'ladi
///
/// Aktiv qora fonli JPG. Uni Pearl'ning krem foniga to'g'ridan-to'g'ri
/// qo'yish qora kvadrat bo'lib ko'rinardi. Shuning uchun mavzu bilan
/// FAQAT shular o'zgaradi: plastina rangi, chegara, nur (halo) va soya.
/// Logotipning o'zi har mavzuda bir xil piksel.
class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.size = 96,
    this.style = BrandLogoStyle.plate,
    this.halo = true,
    this.semanticLabel = 'NFCSTORE',
  });

  /// Plastinaning tomoni (logotip 1:1 nisbatda ichiga joylanadi).
  final double size;
  final BrandLogoStyle style;

  /// Orqadagi yumshoq nur. Kichik o'lchamlarda (nav, ro'yxat) o'chiriladi.
  final bool halo;
  final String semanticLabel;

  static const assetLogo = 'assets/brand/nfcstore_logo.jpg';
  static const assetMark = 'assets/brand/nfcstore_mark.png';

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    if (style == BrandLogoStyle.mark) {
      return Semantics(
        label: semanticLabel,
        image: true,
        child: Image.asset(
          assetMark,
          width: size,
          // Belgi keng lokap — balandligi kengligidan hisoblanadi,
          // shuning uchun `height` berilmaydi: cho'zilish imkonsiz.
          fit: BoxFit.contain,
          filterQuality: FilterQuality.medium,
        ),
      );
    }

    // Plastina radiusi o'lchamga mutanosib: kichik logotip 44px radius
    // bilan deyarli doiraga aylanib qolardi.
    final radius = Radius.circular((size * .28).clamp(10.0, 34.0));

    return Semantics(
      label: semanticLabel,
      image: true,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          clipBehavior: Clip.none,
          children: [
            if (halo)
              Positioned.fill(
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.all(radius),
                      boxShadow: [
                        // Yorug' mavzuda plastina fonga singib ketmasligi
                        // uchun soya kuchliroq; qorong'ida esa aksentli nur
                        // chekkani yoritadi.
                        BoxShadow(
                          color: t.isDark
                              ? t.glow
                              : Colors.black.withValues(alpha: .16),
                          blurRadius: size * .34,
                          spreadRadius: size * .02,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            Container(
              decoration: BoxDecoration(
                color: t.logoPlate,
                borderRadius: BorderRadius.all(radius),
                border: Border.all(color: t.border2, width: 1),
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                assetLogo,
                width: size,
                height: size,
                // `contain` — nisbat hech qachon buzilmaydi.
                fit: BoxFit.contain,
                filterQuality: FilterQuality.medium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Logotip + so'z belgisi — Welcome va Splash sarlavhasi uchun.
class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key, this.size = 104, this.showWordmark = true});

  final double size;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        BrandLogo(size: size),
        if (showWordmark) ...[
          const SizedBox(height: Gap.lg),
          Text(
            'NFCSTORE',
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: size * .155,
              fontWeight: FontWeight.w800,
              letterSpacing: size * .055,
              color: t.text1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'NOVA',
            style: AppType.displayStyle(
              color: t.accent2,
              size: size * .19,
              letterSpacing: size * .04,
            ),
          ),
        ],
      ],
    );
  }
}
