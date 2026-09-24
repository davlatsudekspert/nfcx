import 'package:flutter/material.dart';

import '../theme/typography.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';

/// Logotipni qanday ko'rsatish.
enum BrandLogoStyle {
  /// ORIGINAL fayl o'z foni bilan, yumshoq burchakli plastina ichida.
  /// Splash, Welcome va Auth kabi logotip "qahramon" bo'lgan joylarda.
  plate,

  /// Dumaloq brend nishoni: qorong'i grafit doira, uning atrofida
  /// nozik oltin halqa, markazda belgi.
  ///
  /// KICHIK joylar uchun: sozlamalardagi brend nuqtasi, mavzu
  /// tanlagichi, avatar ustidagi muhr. Bu yerda belgi o'z-o'zidan
  /// tura olmaydi — atrofdagi sirt har xil rangda bo'lishi mumkin,
  /// shuning uchun nishon o'z fonini olib yuradi.
  badge,

  /// Faqat belgi — foni ham, doirasi ham yo'q.
  ///
  /// KATTA markaziy nuqtalar uchun: Home hero orbi, NFC markazi
  /// orbi, skanerlash orbi. U yerda orbning o'zi allaqachon doira —
  /// ichiga yana bir doira qo'yilsa, "doira ichida doira" hosil
  /// bo'lardi.
  markOnly,

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
    this.tint,
    this.semanticLabel = 'NFCSTORE',
  });

  /// Plastinaning tomoni (logotip 1:1 nisbatda ichiga joylanadi).
  final double size;
  final BrandLogoStyle style;

  /// Orqadagi yumshoq nur. Kichik o'lchamlarda (nav, ro'yxat) o'chiriladi.
  final bool halo;

  /// Belgini BITTA rangda chizadi — faqat `mark` uslubida.
  ///
  /// NIMA UCHUN KERAK: aksent sirti (NFC orb) ustida oltin belgi
  /// oltinda yo'qoladi. Ilgari buning yechimi plastina edi — u esa
  /// orbning organik shaklini kesib, ichida qattiq to'rtburchak hosil
  /// qilardi. Endi belgi o'sha sirt ustida `onAccent` siyohida
  /// chiziladi: shakl yaxlit qoladi, kontrast esa har mavzuda yetarli.
  ///
  /// ORIGINAL AKTIV O'ZGARMAYDI — rang faqat chizish vaqtida
  /// qo'llanadi (`BlendMode.srcIn`), fayl o'z holicha qoladi.
  final Color? tint;
  final String semanticLabel;

  static const assetLogo = 'assets/brand/nfcstore_logo.jpg';
  static const assetMark = 'assets/brand/nfcstore_mark.png';

  /// Nishon ranglari MAVZUGA BOG'LIQ EMAS.
  ///
  /// Brend nishoni beshala mavzuda ham bir xil ko'rinadi — xuddi
  /// jismoniy kartadagi muhr kabi. Mavzu bilan o'zgaradigan narsa
  /// uning ATROFI, o'zi emas.
  static const _ringGold = Color(0xFFD4B87C);
  static const _badgeInnerTop = Color(0xFF26242B);
  static const _badgeInnerBottom = Color(0xFF111015);

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;

    if (style == BrandLogoStyle.badge) {
      // Halqa qalinligi o'lchamga mutanosib, lekin chegaralangan:
      // 16px li nishonda 1px dan ingichka halqa yo'qoladi, 64px da
      // esa 3px dan qalini og'ir ko'rinadi.
      final ringWidth = (size * .045).clamp(1.0, 3.0);

      return Semantics(
        label: semanticLabel,
        image: true,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            // Yassi qora emas: yuqori chap tomondan yengil yorug'lik
            // tushgan grafit. "Soft premium depth" — 3D emas.
            gradient: const RadialGradient(
              center: Alignment(-.35, -.45),
              radius: 1.05,
              colors: [_badgeInnerTop, _badgeInnerBottom],
            ),
            border: Border.all(color: _ringGold, width: ringWidth),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: .22),
                blurRadius: size * .22,
                offset: Offset(0, size * .06),
              ),
            ],
          ),
          child: Center(
            // Belgi ORIGINAL oltinida — bo'yalmaydi. Qorong'i fon
            // ustida u o'z jilosi bilan turadi.
            child: Image.asset(
              assetMark,
              width: size * .62,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.medium,
            ),
          ),
        ),
      );
    }

    if (style == BrandLogoStyle.markOnly) {
      return Semantics(
        label: semanticLabel,
        image: true,
        child: Image.asset(
          assetMark,
          width: size,
          // Belgi keng lokap — balandligi kengligidan hisoblanadi,
          // shuning uchun `height` berilmaydi: cho'zilish imkonsiz.
          fit: BoxFit.contain,
          color: tint,
          colorBlendMode: tint == null ? null : BlendMode.srcIn,
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
        // BREND MUHRI — pastki navigatsiyaning markaziy tugmasi va NFC
        // markazidagi bilan AYNAN bir element. Egasining talabi: oltin
        // NFCSTORE belgisi Splash, Login va NFC markazida takrorlansin.
        BrandSeal(size: size),
        if (showWordmark) ...[
          const SizedBox(height: Gap.lg),
          Text(
            'NFCSTORE',
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: size * .155,
              fontWeight: // BREND YOZUVI ataylab og'irroq: logotip ilovaning
        // qolgan matnidan ajralib turishi kerak.
        FontWeight.w700,
              letterSpacing: size * .055,
              color: t.text1,
            ),
          ),
          // NIMA UCHUN BU YERDA "NOVA" YO'Q:
          //
          // `nova` — ilovaning ICHKI kod nomi (papka, paket yo'li,
          // CI ish nomi). Brend esa bitta: NFCSTORE. Odam ekranda
          // ikkita nom ko'rsa, qaysi biri ilova ekanini bilmaydi —
          // Play Market'da, saytda va kartada hamma joyda NFCSTORE
          // yozilgan. Ichki nom foydalanuvchiga ko'rinmaydi.
        ],
      ],
    );
  }
}


/// BREND MUHRI — oq disk, champagne halqa, markazda ASL oltin belgi.
///
/// Egasining talabi: markaziy NFC tugmasida generic contactless ikon
/// emas, NFCSTORE oltin belgisi turadi va u Splash, Login va NFC
/// markazida ham takrorlanadi. Shu vidjet o'sha BITTA element —
/// to'rt joyda bir xil ko'rinish uchun.
///
/// Belgi BO'YALMAYDI: brend aktivining o'z oltini. [selected] da disk
/// siyoh rangga o'tadi — oltin qora ustida eng yaxshi o'qiladi va
/// faol holat rang bilan emas, kontrast bilan bildiriladi.
///
/// Glow yo'q: faqat ingichka halqa va yumshoq soya.
class BrandSeal extends StatelessWidget {
  const BrandSeal({
    super.key,
    this.size = 56,
    this.selected = false,
    this.elevated = true,
    this.ink = false,
    this.semanticLabel = 'NFCSTORE',
  });

  final double size;
  final bool selected;

  /// Yorug' mavzuda disk tanlanmagan holda ham qora siyoh (pastki
  /// navigatsiya). Qorong'i mavzuda ta'siri yo'q.
  final bool ink;

  /// Pastki soya — sirt ustida "ko'tarilgan" muhr uchun.
  final bool elevated;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final ring = (size * .02).clamp(1.0, 1.6);
    return Semantics(
      label: semanticLabel,
      image: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: selected || (ink && !t.isDark) ? t.accent2 : t.surfaceSolid,
          border: Border.all(
            color: t.brand
                .withValues(alpha: selected || (ink && !t.isDark) ? .9 : .6),
            width: ring,
          ),
          boxShadow: elevated ? t.shadowFloat : null,
        ),
        child: Center(
          child: Image.asset(
            BrandLogo.assetMark,
            width: size * .58,
            fit: BoxFit.contain,
            filterQuality: FilterQuality.medium,
          ),
        ),
      ),
    );
  }
}
