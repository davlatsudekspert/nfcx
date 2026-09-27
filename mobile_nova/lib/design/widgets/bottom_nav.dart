import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'brand_logo.dart';
import 'surfaces.dart';

class NavItem {
  const NavItem({
    required this.icon,
    required this.label,
    required this.route,
    this.activeIcon,
  });

  /// Faol emas — chiziqli (outlined) belgi.
  final IconData icon;

  /// Faol — to'la belgi. Berilmasa [icon].
  final IconData? activeIcon;
  final String label;
  final String route;
}

/// Nav pillining balandligi.
///
/// PROPORSIYA (2026-09 audit, egasi: "ikonlar kichik va kuchsiz"):
/// belgi 24-25 dp + faol kapsula 30 dp + yorliq 11 dp — Material 3 va
/// iOS tab bar bilan bir o'lchamda. Ilgari 22 dp belgi va 9.5 dp yorliq
/// markaziy 54 dp tugma yonida yo'qolib ketardi.
const double kNavHeight = 66;

/// Markaziy NFC tugmasining diametri.
const double kNavCenterSize = 56;

/// Markaziy tugma pill QIRRASIDAN qancha yuqoriga chiqishi.
///
/// Ataylab pill markaziga emas, QIRRASIGA nisbatan o'lchanadi: ko'z
/// aynan shu masofani ko'radi. Markazga nisbatan o'lchansa, tugma
/// diametri o'zgarganda ko'rinadigan ko'tarilish ham beixtiyor
/// o'zgarib ketardi.
const double kNavCenterLift = 12;

/// IXCHAM (KICHRAYGAN) PANEL — Instagram kabi (egasi, 2026-09-27,
/// iPhone surati bilan: "tepaga tortsangiz kattalashadi, pastga
/// tortganingizda kichrayadi"; "APK'da ham, iOS'da ham ishlasin").
///
/// Lenta pastga aylantirilganda kapsula pastlashadi va torayadi,
/// yorliqlar yashirinadi, markaziy muhr kichrayib kapsula ICHIGA
/// tushadi. Tepaga qaytilganda — asl holi. Qarorni [NavMinimizer]
/// qabul qiladi.
const double kNavCompactHeight = 50;

/// Ixcham holatdagi markaziy muhr diametri.
const double kNavCenterCompactSize = 40;

/// Ixcham kapsula eni — to'liq enining shu ulushi, lekin
/// [kNavCompactMaxWidth] dan keng emas (katta ekranda ham ixcham).
const double kNavCompactWidthFactor = .8;
const double kNavCompactMaxWidth = 300;

/// Suzuvchi pastki navigatsiya — markazda ko'tarilgan NFC tugmasi.
///
/// Concept B'da nav ekran tubiga yopishmaydi, u ustida SUZADI va
/// orqasidan kontent xiralashib ko'rinadi. `extendBody: true` bilan
/// birga ishlaydi.
///
/// ## Nima uchun ikki qatlam
///
/// Avval hammasi bitta `ClipRRect` ichida edi: blur, pill va beshala
/// tugma. Markaziy tugma esa `Matrix4.translationValues(0, -14, 0)`
/// bilan yuqoriga chiqarilardi — ya'ni u o'zini o'rab turgan
/// CLIPDAN TASHQARIGA chiqmoqchi bo'lardi. `ClipRRect` esa aynan
/// shuni qilishga yo'l qo'ymaydi: tugmaning yuqori qismi va uning
/// nuri qirqilib, tugma dumaloq emas, kesilgandek ko'rinardi.
///
/// Endi ikki qatlam bor:
///
/// 1. **Pill** — `ClipRRect` + `BackdropFilter`. Blur va yumaloq
///    burchak faqat shu yerda. Markaziy joy BO'SH qoldiriladi,
///    lekin kengligi saqlanadi, shuning uchun qolgan to'rtta yorliq
///    o'z joyida turadi.
/// 2. **Markaziy tugma** — clipdan TASHQARIDA, `Stack` ning ustki
///    qatlamida. Endi uni hech narsa kesmaydi.
///
/// `Stack` o'lchamini pill belgilaydi (`kNavHeight`), shuning uchun
/// tugma yuqoriga chiqsa ham LAYOUT o'zgarmaydi — `navSafeBottom`
/// hisobi va safe-area o'z holicha qoladi.
class NovaBottomNav extends StatelessWidget {
  const NovaBottomNav({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onSelect,
    this.centerIndex = 2,
    this.onVideo = false,
    this.compact = false,
  });

  final List<NavItem> items;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  /// Qaysi element ko'tarilgan dumaloq tugma bo'lishi.
  final int centerIndex;

  /// VIDEO USTIDA (Reels) — Instagram uslubi (egasi, 2026-09-24:
  /// "instagramga o'xshasin"). Qora shaffof shisha kapsula, oq
  /// belgilar; video butun ekranni egallaydi va panel orqasidan
  /// ko'rinadi. Markaziy muhr kapsula ICHIDA turadi — tepaga chiqsa
  /// aylantirish chizig'ini to'sardi.
  final bool onVideo;

  /// Ixcham holat ([NavMinimizer]). Video ustida (Reels) hisobga
  /// olinmaydi — u yerda panel doim to'liq.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    // "Harakatni kamaytirish" yoqilgan bo'lsa — animatsiyasiz.
    final still = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(end: compact && !onVideo ? 1 : 0),
      duration: still ? Duration.zero : Motion.fast,
      curve: Motion.smooth,
      builder: (context, k, _) => _bar(context, k),
    );
  }

  /// [k]: 0 — to'liq, 1 — ixcham.
  Widget _bar(BuildContext context, double k) {
    final t = context.tokens;

    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.lg, 0, Gap.lg, Gap.md),
      // TASHQI O'LCHAM O'ZGARMAYDI — kichrayish faqat ichkarida.
      // `extendBody` bilan Scaffold panel balandligini kontentning
      // pastki hoshiyasiga qo'shadi: balandlik animatsiyada har kadrda
      // o'zgarsa, butun ekran har kadrda qayta joylashardi (qotish).
      child: SizedBox(
        height: kNavHeight,
        child: LayoutBuilder(
          builder: (context, box) {
            final full = box.maxWidth;
            final narrow = math.min(
              full,
              math.min(full * kNavCompactWidthFactor, kNavCompactMaxWidth),
            );
            final w = lerpDouble(full, narrow, k)!;
            final h = lerpDouble(kNavHeight, kNavCompactHeight, k)!;
            final seal = lerpDouble(kNavCenterSize, kNavCenterCompactSize, k)!;
            final sealTop = onVideo
                ? (kNavHeight - kNavCenterSize) / 2
                : lerpDouble(
                    -kNavCenterLift,
                    (kNavCompactHeight - kNavCenterCompactSize) / 2,
                    k,
                  )!;
            return Align(
              // Pastki qirra joyida qoladi — kapsula pastga "o'tiradi".
              alignment: Alignment.bottomCenter,
              child: SizedBox(
                key: const ValueKey('nav-capsule'),
                width: w,
                height: h,
                child: _capsule(t, k, h, seal, sealTop),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _capsule(
    NfcTokens t,
    double k,
    double h,
    double seal,
    double sealTop,
  ) {
    return Stack(
      // Tugma pill qirrasidan yuqoriga chiqadi — bu ataylab.
      clipBehavior: Clip.none,
      children: [
        // 1-QATLAM: pill — TO'Q (blur'siz) sirt.
        //
        // Ilgari bu yerda `BackdropFilter` (blur 22) turardi. Menyu
        // HAR ekranda va aylantirish paytida HAR kadrda ostidagi
        // kontentni qayta xiralashtirardi — telefonda bu eng qimmat
        // effekt edi. Samsung One UI va Apple'ning o'z ilovalari
        // kabi endi oddiy to'q sirt: ko'rinishi deyarli bir xil,
        // narxi esa nol.
        //
        // O'lchamni ota `SizedBox` beradi (ixchamlashda har kadrda);
        // `AnimatedContainer` faqat rangni (Reels'ga o'tish) silliqlaydi.
        Positioned.fill(
          child: RepaintBoundary(
            child: AnimatedContainer(
              duration: Motion.theme,
              curve: Motion.smooth,
              decoration: BoxDecoration(
                color: onVideo
                    ? Colors.black.withValues(alpha: .55)
                    : t.surfaceSolid,
                borderRadius: R.pill,
                border: Border.all(
                  color: onVideo
                      ? Colors.white.withValues(alpha: .16)
                      : t.border2,
                ),
                boxShadow: onVideo ? null : t.shadowFloat,
              ),
              child: Row(
                children: [
                  for (var i = 0; i < items.length; i++)
                    Expanded(
                      child: i == centerIndex
                          // Joy band qilinadi, lekin bo'sh: tugma
                          // ustki qatlamda chiziladi.
                          ? const SizedBox.expand()
                          : _NavButton(
                              item: items[i],
                              selected: i == currentIndex,
                              onVideo: onVideo,
                              k: k,
                              height: h,
                              onTap: () => onSelect(i),
                            ),
                    ),
                ],
              ),
            ),
          ),
        ),

        // 2-QATLAM: markaziy tugma — clipdan tashqarida.
        //
        // Qator pilldagi bilan BIR XIL tuzilgan (teng `Expanded`
        // kataklar), shuning uchun tugma har qanday element sonida
        // ham aynan o'z katagining markazida turadi. Ixcham holatda
        // muhr kichrayib kapsula ichiga tushadi.
        Positioned(
          left: 0,
          right: 0,
          top: sealTop,
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: i == centerIndex
                      ? Center(
                          child: _CenterNavButton(
                            item: items[i],
                            selected: i == currentIndex,
                            size: seal,
                            onTap: () => onSelect(i),
                          ),
                        )
                      : SizedBox(height: seal),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Markaziy NFC tugmasi — mukammal doira, hech qayerdan kesilmaydi.
class _CenterNavButton extends StatelessWidget {
  const _CenterNavButton({
    required this.item,
    required this.selected,
    required this.onTap,
    this.size = kNavCenterSize,
  });

  final NavItem item;
  final bool selected;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: PressableScale(
        onTap: onTap,
        scale: .92,
        // BREND MUHRI — generic NFC ikonkasi ham, oltin gradient disk
        // ham emas. Egasining talabi: markaziy tugma NFCSTORE brend
        // imzosi bo'lsin. Xuddi shu muhr Splash, Login va NFC
        // markazida ham turadi (`BrandSeal`).
        child: BrandSeal(
          size: size,
          selected: selected,
          // Yorug' mavzuda muhr doim QORA: oltin belgi qora diskda —
          // oq panel ustidagi yagona to'q nuqta, brend imzosi.
          ink: true,
          semanticLabel: item.label,
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.onTap,
    this.onVideo = false,
    this.k = 0,
    this.height = kNavHeight,
  });

  final NavItem item;
  final bool selected;
  final bool onVideo;
  final VoidCallback onTap;

  /// 0 — to'liq, 1 — ixcham (yorliqsiz, kichikroq belgi).
  final double k;
  final double height;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // 360 dp va undan tor ekranda bir pog'ona kichik — yorliqlar
    // (ru: "Главная", "Профиль") katakka sig'adi.
    final small = MediaQuery.sizeOf(context).width < 375;
    final iconSize = lerpDouble(small ? 24.0 : 25.0, 22, k)!;
    final labelSize = small ? 10.5 : 11.0;
    // Yorliq ixchamlashda so'nadi va balandligi yig'iladi.
    final show = (1 - k).clamp(0.0, 1.0);

    // PREMIUM (egasi, 2026-09-24: "ikonkalar qoraroq, aniqroq,
    // qimmatroq; faol holat premium" va "hamma temalarda ham").
    //
    // Faol tab — mavzuning ASOSIY MATN rangidagi kapsula (Ivory'da qora
    // siyoh, qorong'i mavzularda yorug'), ichidagi belgi sirt rangida.
    // Faol emaslari — `text1` ga yaqin to'q ton (kulrang emas).
    final idle = onVideo
        ? Colors.white.withValues(alpha: .78)
        : Color.lerp(t.text1, t.text2, .35)!;
    final ink = onVideo ? Colors.white : t.text1;
    final color = selected ? ink : idle;
    // Video ustida faol kapsula — yarim shaffof oq (Instagram), belgi oq.
    final iconColor = selected && !onVideo ? t.surfaceSolid : color;
    final capsule = onVideo ? Colors.white.withValues(alpha: .2) : t.text1;
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: PressableScale(
        onTap: onTap,
        child: SizedBox(
          height: height,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // O'lcham — ixchamlashda har kadrda (SizedBox); tanlanish
              // rangi — `AnimatedContainer` silliqlaydi.
              SizedBox(
                width: lerpDouble(small ? 50 : 54, 42, k),
                height: lerpDouble(30, 28, k),
                child: AnimatedContainer(
                  duration: Motion.fast,
                  curve: Motion.smooth,
                  decoration: BoxDecoration(
                    color: selected ? capsule : capsule.withValues(alpha: 0),
                    borderRadius: BorderRadius.circular(15),
                    boxShadow: selected && !onVideo
                        ? [
                            BoxShadow(
                              color: t.text1.withValues(alpha: .22),
                              blurRadius: 10,
                              spreadRadius: -3,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    selected ? (item.activeIcon ?? item.icon) : item.icon,
                    // Kapsula ichida belgi biroz kichik — "nafas" oladi.
                    size: selected ? iconSize - 3 : iconSize,
                    color: iconColor,
                  ),
                ),
              ),
              // Ixcham holatda yorliq umuman qurilmaydi (ekran
              // o'quvchisiga nom baribir `Semantics` dan boradi).
              if (show > .01) ...[
                SizedBox(height: 3 * show),
                ClipRect(
                  child: Align(
                    alignment: Alignment.topCenter,
                    heightFactor: show,
                    child: Opacity(
                      opacity: show,
                      child: AnimatedDefaultTextStyle(
                        duration: Motion.fast,
                        style: TextStyle(
                          fontFamily: 'Manrope',
                          fontSize: labelSize,
                          height: 1.15,
                          letterSpacing: .1,
                          fontWeight: selected
                              ? FontWeight.w700
                              : FontWeight.w600,
                          color: color,
                        ),
                        child: Text(
                          item.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          // Tizim shrifti kattalashtirilsa ham yorliq
                          // katakdan chiqmaydi (1.15 dan keyin o'smaydi).
                          textScaler: MediaQuery.textScalerOf(
                            context,
                          ).clamp(maxScaleFactor: 1.15),
                        ),
                      ),
                    ),
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

/// PASTKI MENYU OSTIDAGI SO'NISH.
///
/// Menyu suzib turadi (`extendBody`) va uning ostidagi uy chizig'i
/// hududida (iPhone'da 34 pt) kontent — story qatori, ro'yxat
/// oxiri — ko'rinib qolardi. Egasi (2026-09-27, iPhone surati):
/// "pastdagi ikonkalar tepada bo'lib ketmaganmi?" — menyu joyida edi,
/// lekin ostidagi kontent uni "ko'tarilgan" qilib ko'rsatardi.
///
/// Endi menyu orqasida fon rangidagi silliq so'nish: yuqori qirrasi
/// shaffof (kontent menyu tepasigacha ko'rinadi), pastga qarab to'liq
/// fon — iPhone ilovalaridagidek toza. Reels'da O'CHIQ: video butun
/// ekranni egallaydi.
class NavScrim extends StatelessWidget {
  const NavScrim({super.key, required this.child, this.enabled = true});

  final Widget child;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    final bg = context.tokens.bg2;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: const [0, .42, .7, 1],
          colors: [
            bg.withValues(alpha: 0),
            bg.withValues(alpha: .78),
            bg.withValues(alpha: .96),
            bg,
          ],
        ),
      ),
      child: child,
    );
  }
}

/// PANEL QACHON IXCHAM BO'LADI — aylantirish yo'nalishidan.
///
/// Instagram (iOS 26) kabi (egasi, 2026-09-27): lenta pastga
/// aylantirilsa panel kichrayadi, tepaga qaytilsa kattalashadi.
/// Karkas (`HomeShell`, `NavPage`) tab kontentini
/// `NotificationListener<ScrollNotification>(onNotification: handle)`
/// bilan o'raydi va qiymatni [NovaBottomNav.compact] ga beradi.
///
/// Qoidalar:
///   * faqat VERTIKAL aylantirish (story qatori, gorizontal karusellar
///     panelga ta'sir qilmaydi);
///   * ro'yxat boshiga [topZone] dan yaqin — doim to'liq;
///   * bir yo'nalishda [threshold] dan ko'p surilganda almashadi —
///     barmoq titrashi panelni "pirpiratmaydi";
///   * iOS'dagi "prujina" (ro'yxat chetidan chiqib qaytish) hisobga
///     olinmaydi — aks holda pastda turib panel o'zi ochilib ketardi;
///   * tab almashganda karkas [expand] chaqiradi.
class NavMinimizer extends ValueNotifier<bool> {
  NavMinimizer() : super(false);

  static const double threshold = 18;
  static const double topZone = 64;

  double _run = 0;

  /// `NotificationListener` uchun: bildirishnomani to'xtatmaydi.
  bool handle(ScrollNotification n) {
    if (n is! ScrollUpdateNotification) return false;
    final m = n.metrics;
    if (m.axis != Axis.vertical) return false;
    if (m.pixels <= m.minScrollExtent + topZone) {
      expand();
      return false;
    }
    if (m.outOfRange) return false;
    final d = n.scrollDelta ?? 0;
    if (d == 0) return false;
    if ((d > 0) != (_run > 0)) _run = 0;
    _run += d;
    if (_run > threshold) {
      value = true;
    } else if (_run < -threshold) {
      value = false;
    }
    return false;
  }

  void expand() {
    _run = 0;
    value = false;
  }
}
