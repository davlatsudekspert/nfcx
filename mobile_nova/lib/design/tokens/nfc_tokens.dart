import 'dart:math';
import 'package:flutter/material.dart';

import 'palette.dart';

/// Ilovadagi BARCHA rang va soya qiymatlari shu bitta kengaytmadan olinadi.
///
/// NIMA UCHUN `ThemeExtension`: mavzu almashganda Flutter ikkita
/// `NfcTokens` orasida `lerp` qiladi, ya'ni 5 ta mavzu o'rtasidagi o'tish
/// bepul animatsiyalanadi. Agar ranglar global `const` bo'lganida,
/// almashish keskin "chaqnab" ketardi.
@immutable
class NfcTokens extends ThemeExtension<NfcTokens> {
  const NfcTokens({
    required this.id,
    required this.isDark,
    required this.bg1,
    required this.bg2,
    required this.bgVignette,
    required this.surface,
    required this.surface2,
    required this.surfaceSolid,
    required this.text1,
    required this.text2,
    required this.text3,
    required this.accent1,
    required this.accent2,
    required this.accent3,
    required this.goldDeep,
    required this.accentB,
    required this.accentBDark,
    required this.accentC,
    required this.accentCDark,
    required this.accentD,
    required this.accentDDark,
    required this.glow,
    required this.glowB,
    required this.border1,
    required this.border2,
    required this.error,
    required this.success,
    required this.warn,
    required this.ambient1,
    required this.ambient2,
    required this.shadowFloat,
    required this.shadowSoft,
    required this.shadowTiny,
    required this.brand,
    required this.brandSoft,
    required this.brandInk,
  });

  /// Saqlashda ishlatiladigan barqaror kalit (`pearl`, `midnight`, ...).
  final String id;

  /// Matn ustidagi status paneli piktogrammalari uchun. Pearl'dan boshqa
  /// hamma mavzu qorong'i.
  final bool isDark;

  final Color bg1, bg2, bgVignette;
  final Color surface, surface2, surfaceSolid;
  final Color text1, text2, text3;
  final Color accent1, accent2, accent3;

  /// Aksentning CHUQURROQ ohangi — faqat katta, yaxlit aksent yuzalar
  /// uchun (hozircha NFC orbning yadrosi).
  ///
  /// NIMA UCHUN ALOHIDA TOKEN: orb ham, identity karta ham bir xil
  /// `[accent1, accent2]` gradientidan foydalanardi. Natijada bitta
  /// ekranda ikkita katta yuza AYNAN bir xil oltinda turardi va
  /// oltin aksent bo'lishdan to'xtab, fon rangiga aylanardi.
  ///
  /// Endi karta yumshoq shampan ohangida (`accent1 -> accent2`)
  /// qoladi, orb esa undan bir pog'ona chuqurroq
  /// (`accent2 -> goldDeep`) — ierarxiya rang bilan ham o'qiladi.
  final Color goldDeep;
  final Color accentB, accentBDark;
  final Color accentC, accentCDark;
  final Color accentD, accentDDark;
  final Color glow, glowB;
  final Color border1, border2;
  final Color error, success, warn;
  final Color ambient1, ambient2;
  final List<BoxShadow> shadowFloat, shadowSoft, shadowTiny;

  /// BREND CHAMPAGNE — aksentdan ALOHIDA.
  ///
  /// `ivory` da aksent QORA: asosiy tugma, faol tab, tanlangan chip
  /// siyoh rangida. Champagne esa juda kam joyda — NFC ID kartaning
  /// ichki hoshiyasi, tier belgisi, story halqasi, markaziy NFC
  /// tugmaning halqasi. Agar u aksentga ulanganida, oltin butun
  /// tugmalarga tarqalib, "juda kam" bo'lishdan to'xtardi.
  ///
  /// `brand` — chiziq va halqa; `brandSoft` — och tus (plita foni,
  /// hoshiya); `brandInk` — shu oiladagi O'QILADIGAN matn rangi.
  final Color brand, brandSoft, brandInk;

  /// Ekran orqa foni — yuqoridan pastga yumshoq gradient.
  LinearGradient get backdrop => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [bg1, bg2],
      );

  /// Asosiy aksent gradienti: tugma, NFC orb va faol nav elementi.
  LinearGradient get accentGradient => LinearGradient(
        begin: const Alignment(-0.7, -1),
        end: const Alignment(0.7, 1),
        colors: [accent1, accent2],
      );

  /// Aksent SIRTI ustidagi matn/ikonka rangi.
  ///
  /// Beshala mavzuda ham aksent OCHIQ rang (champagne, platina, muz,
  /// siyohrang, oltin), shuning uchun ustida oq emas, QORONG'I siyoh
  /// o'qiladi. Bu qiymat mavzu bilan o'zgarmaydi — aynan shu sababdan.
  /// AKSENT SIRTI USTIDAGI SIYOH — tugma va nishon yozuvi.
  ///
  /// Ilgari QOTIRILGAN quyuq rang edi. Bu hamma mavzuda ishlardi,
  /// chunki aksent har doim oltin (yorug') edi. `mono` (oq-qora)
  /// mavzusida aksent QORA bo'ldi va quyuq siyoh qora ustida
  /// umuman o'qilmasdi — kontrast 1.2, sinov ushladi.
  ///
  /// Endi siyoh AKSENTNING YORUG'LIGIDAN hisoblanadi. Yangi mavzu
  /// qo'shilganda bu yerni qo'lda yangilash kerak emas.
  Color get onAccent {
    // Chegara ("yorug'ligi 0.45 dan katta bo'lsa") YETARLI EMAS:
    // `ocean` aksenti chegaradan sal yuqori turib, quyuq siyoh
    // bilan atigi 2.3 kontrast berardi. Shuning uchun ikkala
    // siyoh ham O'LCHANADI va yaxshirog'i tanlanadi.
    //
    // `accent1` ham, `accent2` ham hisobga olinadi: siyoh ikkala
    // sirt ustida ham o'qilishi kerak.
    double lum(Color c) => c.computeLuminance();
    double ratio(Color a, Color b) {
      final x = lum(a), y = lum(b);
      return (max(x, y) + .05) / (min(x, y) + .05);
    }
    const dark = Color(0xFF1A1A1F);
    final darkScore = min(ratio(dark, accent1), ratio(dark, accent2));
    final lightScore = min(ratio(Colors.white, accent1), ratio(Colors.white, accent2));
    return darkScore >= lightScore ? dark : Colors.white;
  }

  /// Logotip orqasidagi plastina rangi.
  ///
  /// Brend logotipi QORA fonli JPG. Yorug' mavzuda uni to'g'ridan-to'g'ri
  /// oq fonga qo'yib bo'lmaydi — qora kvadrat bo'lib ko'rinadi. Shuning
  /// uchun logotipning O'ZI emas, ATROFIDAGI plastina mavzuga moslashadi.
  Color get logoPlate => isDark ? surfaceSolid : const Color(0xFF14131A);

  /// BEZAK YUVINDISINING KUCHI (0..1).
  ///
  /// Muqova atmosferasi, avatar to'ldirmasi va rejim kapsulasi
  /// aksent rangini SHAFFOFLIK bilan fon ustiga suradi. Uzoq vaqt
  /// bu joylarda alfa qattiq yozilgan edi (.34, .26, .20) va
  /// oltin aksentli mavzularda yumshoq tus berardi.
  ///
  /// `mono` kelgach o'sha qiymatlar BUZILDI. Sabab alfa emas,
  /// AKSENT: oq-qora mavzuda u qoraga aylandi, qoraning 26%
  /// esa yumshoq tus emas — KULRANG DOG'. Ekranning yuqorisida
  /// iflos chiziq, avatar o'rnida kulrang doira paydo bo'ldi.
  ///
  /// Demak alfani har bir joyda alohida tuzatish noto'g'ri
  /// bo'lardi: kasallik uchta joyda emas, BITTA — aksent fondan
  /// qanchalik quyuq bo'lsa, o'sha alfa shunchalik iflos
  /// ko'rinadi. Shuning uchun kuch shu farqdan olinadi.
  ///
  /// Qorong'i mavzularda yuvindi fonni YORITADI, iflos qilmaydi,
  /// shuning uchun ular 1.0 da qoladi va o'zgarmaydi.
  ///
  /// Quyi chegara .35: butunlay yo'qolsa avatar doirasi va
  /// kapsula ko'rinmay qoladi — yumshoq boshqa, yo'q boshqa.
  double get washScale {
    // QORONG'I MAVZULAR HAM YUMShATILADI, LEKIN KAMROQ.
    //
    // Avval bu yerda `if (isDark) return 1` turgan edi: qorong'i
    // fonda yuvindi FONNI YORITADI, iflos qilmaydi degan mantiq
    // bilan. Mantiq to'g'ri, lekin "iflos emas" degani "yumshoq"
    // degani emas. Oltita mavzu yonma-yon qo'yilganda `noir` dagi
    // "Shaxsiy" kapsulasi va avatar to'ldirmasi qolganlaridan
    // sezilarli OG'IR ko'rindi.
    //
    // .78 — to'liq kuchning uchdan ikki qismidan sal ko'prog'i.
    // Element hamon ko'rinadi va bosilgani bilinadi, lekin u
    // endi "plastina" emas, TUS.
    if (isDark) return .78;
    final drop = (bg1.computeLuminance() - accent1.computeLuminance())
        .clamp(0.0, 1.0);
    return (1 - drop * .85).clamp(.35, 1.0);
  }

  /// Aksentning bezak uchun yumshatilgan ko'rinishi.
  Color wash(Color c, double alpha) =>
      c.withValues(alpha: alpha * washScale);

  @override
  NfcTokens copyWith({String? id, bool? isDark}) => this;

  @override
  NfcTokens lerp(covariant NfcTokens? other, double t) {
    if (other == null) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    List<BoxShadow> s(List<BoxShadow> a, List<BoxShadow> b) =>
        BoxShadow.lerpList(a, b, t) ?? b;
    return NfcTokens(
      id: t < 0.5 ? id : other.id,
      isDark: t < 0.5 ? isDark : other.isDark,
      bg1: c(bg1, other.bg1),
      bg2: c(bg2, other.bg2),
      bgVignette: c(bgVignette, other.bgVignette),
      surface: c(surface, other.surface),
      surface2: c(surface2, other.surface2),
      surfaceSolid: c(surfaceSolid, other.surfaceSolid),
      text1: c(text1, other.text1),
      text2: c(text2, other.text2),
      text3: c(text3, other.text3),
      accent1: c(accent1, other.accent1),
      accent2: c(accent2, other.accent2),
      accent3: c(accent3, other.accent3),
      goldDeep: c(goldDeep, other.goldDeep),
      accentB: c(accentB, other.accentB),
      accentBDark: c(accentBDark, other.accentBDark),
      accentC: c(accentC, other.accentC),
      accentCDark: c(accentCDark, other.accentCDark),
      accentD: c(accentD, other.accentD),
      accentDDark: c(accentDDark, other.accentDDark),
      glow: c(glow, other.glow),
      glowB: c(glowB, other.glowB),
      border1: c(border1, other.border1),
      border2: c(border2, other.border2),
      error: c(error, other.error),
      success: c(success, other.success),
      warn: c(warn, other.warn),
      ambient1: c(ambient1, other.ambient1),
      ambient2: c(ambient2, other.ambient2),
      shadowFloat: s(shadowFloat, other.shadowFloat),
      shadowSoft: s(shadowSoft, other.shadowSoft),
      shadowTiny: s(shadowTiny, other.shadowTiny),
      brand: c(brand, other.brand),
      brandSoft: c(brandSoft, other.brandSoft),
      brandInk: c(brandInk, other.brandInk),
    );
  }

  // ------------------------------------------------------------ 0 IVORY
  //
  // SOFT EDITORIAL LUXURY — STANDART MAVZU (2026-09, egasining qarori).
  //
  // Egasi oq-qora variantni qorong'idan yaxshiroq topdi, lekin u
  // "chiroyli template"dek ko'rindi — NFCSTORE ruhi sezilmadi. Bu
  // mavzu o'sha oq-qora asosni oladi va unga BITTA narsa qo'shadi:
  // juda kam champagne (`brand`). Qolgani o'zgarmaydi:
  //
  //   fon      #F6F5F2  iliq oq, sof oq emas — kartalar ajralsin
  //   karta    #FFFFFF  sof oq, SHAFFOF EMAS (blur yo'q, arzon)
  //   matn     #141414  qora siyoh
  //   aksent   #141414  asosiy tugma va faol holat ham siyoh
  //   brend    #B39566  champagne — faqat hoshiya/halqa/belgi
  //
  // Chuqurlik soya bilan: tepada 1px yorug' chiziq, pastda keng va
  // juda xira iliq soya. Glow ham, gradient fon ham yo'q.
  static final ivory = NfcTokens(
    id: 'ivory',
    isDark: false,
    bg1: hex('#F6F5F2'),
    bg2: hex('#F1EFEA'),
    bgVignette: rgba(0, 0, 0, .025),
    surface: hex('#FFFFFF'),
    surface2: hex('#F1EFEA'),
    surfaceSolid: hex('#FFFFFF'),
    // KUCHLI, LEKIN ILIQ SIYOH (egasi, 2026-09: "juda oq va ayrim
    // yozuvlar xira — asosiy matn va ikonlar deyarli qora, ikkinchi
    // darajali o'rtacha kulrang, juda och kulrangdan voz kech").
    // Fon iliq ivory bo'lib qoladi; kontrast matn orqali.
    // Ierarxiya (egasining aniq talabi): asosiy matn va faol belgilar
    // #171716 (grafit), ikkinchi darajali #575550, faol bo'lmagan
    // navigatsiya/belgilar #6E6C68 (~#707070). #AAA–#CCC dagi muhim
    // yozuv yo'q.
    text1: hex('#171716'),
    text2: hex('#575550'),
    text3: hex('#6E6C68'),
    accent1: hex('#252422'),
    accent2: hex('#171716'),
    accent3: hex('#57544E'),
    goldDeep: hex('#8A6D42'),
    // Biznes va boshqa rejim aksentlari — siyohning darajalari,
    // rang bilan emas, QUYUQLIK bilan ajraladi (xuddi `mono` kabi).
    accentB: hex('#2A2A27'),
    accentBDark: hex('#141414'),
    accentC: hex('#4A4741'),
    accentCDark: hex('#2A2824'),
    accentD: hex('#6E6A62'),
    accentDDark: hex('#3D3A35'),
    glow: rgba(179, 149, 102, .16),
    glowB: rgba(0, 0, 0, .06),
    border1: rgba(20, 20, 20, .12),
    border2: rgba(20, 20, 20, .075),
    error: hex('#9B3B30'),
    success: hex('#3F6B4A'),
    warn: hex('#86672A'),
    ambient1: rgba(179, 149, 102, .05),
    ambient2: rgba(0, 0, 0, .02),
    shadowFloat: [
      BoxShadow(color: rgba(40, 30, 12, .16), blurRadius: 30, spreadRadius: -12, offset: const Offset(0, 16)),
      BoxShadow(color: rgba(40, 30, 12, .05), blurRadius: 3, offset: const Offset(0, 1)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(40, 30, 12, .12), blurRadius: 24, spreadRadius: -12, offset: const Offset(0, 12)),
      BoxShadow(color: rgba(40, 30, 12, .045), blurRadius: 2, offset: const Offset(0, 1)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(40, 30, 12, .06), blurRadius: 6, offset: const Offset(0, 2)),
    ],
    brand: hex('#B39566'),
    brandSoft: hex('#E7DCC6'),
    brandInk: hex('#7A5F38'),
  );

  // ---------------------------------------------------------------- PUDRA
  /// PUDRA — iliq pushti-krem fon, oq kartalar, rose-gold urg'u
  /// (brendning oltini pushtiga moyil). Tugmalar to'q rose.
  static final pudra = NfcTokens(
    id: 'pudra',
    isDark: false,
    bg1: hex('#F8F1EE'),
    bg2: hex('#F1E4DF'),
    bgVignette: rgba(74, 36, 44, .05),
    surface: hex('#FFFFFF'),
    surface2: hex('#F1E4DF'),
    surfaceSolid: hex('#FFFFFF'),
    text1: hex('#2B1B1E'),
    text2: hex('#634B50'),
    text3: hex('#7A6468'),
    accent1: hex('#A35A6A'),
    accent2: hex('#8E4656'),
    accent3: hex('#6E4A50'),
    goldDeep: hex('#8A4E45'),
    accentB: hex('#A35A6A'),
    accentBDark: hex('#8E4656'),
    accentC: hex('#6E4A50'),
    accentCDark: hex('#2B1B1E'),
    accentD: hex('#634B50'),
    accentDDark: hex('#2B1B1E'),
    glow: rgba(192, 138, 125, .18),
    glowB: rgba(74, 36, 44, .06),
    border1: rgba(74, 36, 44, .14),
    border2: rgba(74, 36, 44, .085),
    error: hex('#A8333F'),
    success: hex('#3F6B4A'),
    warn: hex('#8A6320'),
    ambient1: rgba(192, 138, 125, .07),
    ambient2: rgba(74, 36, 44, .02),
    shadowFloat: [
      BoxShadow(color: rgba(74, 36, 44, .16), blurRadius: 30, spreadRadius: -12, offset: const Offset(0, 16)),
      BoxShadow(color: rgba(74, 36, 44, .05), blurRadius: 3, offset: const Offset(0, 1)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(74, 36, 44, .12), blurRadius: 24, spreadRadius: -12, offset: const Offset(0, 12)),
      BoxShadow(color: rgba(74, 36, 44, .045), blurRadius: 2, offset: const Offset(0, 1)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(74, 36, 44, .06), blurRadius: 6, offset: const Offset(0, 2)),
    ],
    brand: hex('#C08A7D'),
    brandSoft: hex('#F2DDD6'),
    brandInk: hex('#8A4E45'),
  );

  // ---------------------------------------------------------------- SAKURA
  /// SAKURA — sovuqroq, yorqinroq pushti: och gulobi fon, oq
  /// kartalar, rezavor (berry) tugmalar.
  static final sakura = NfcTokens(
    id: 'sakura',
    isDark: false,
    bg1: hex('#FBF2F6'),
    bg2: hex('#F5E3EC'),
    bgVignette: rgba(70, 20, 50, .05),
    surface: hex('#FFFFFF'),
    surface2: hex('#F5E3EC'),
    surfaceSolid: hex('#FFFFFF'),
    text1: hex('#2A1622'),
    text2: hex('#634558'),
    text3: hex('#7A5E6E'),
    accent1: hex('#C0507F'),
    accent2: hex('#A63C6A'),
    accent3: hex('#7A4262'),
    goldDeep: hex('#9A3A66'),
    accentB: hex('#C0507F'),
    accentBDark: hex('#A63C6A'),
    accentC: hex('#7A4262'),
    accentCDark: hex('#2A1622'),
    accentD: hex('#634558'),
    accentDDark: hex('#2A1622'),
    glow: rgba(208, 122, 160, .18),
    glowB: rgba(70, 20, 50, .06),
    border1: rgba(70, 20, 50, .14),
    border2: rgba(70, 20, 50, .085),
    error: hex('#A8333F'),
    success: hex('#3F6B4A'),
    warn: hex('#8A6320'),
    ambient1: rgba(208, 122, 160, .07),
    ambient2: rgba(70, 20, 50, .02),
    shadowFloat: [
      BoxShadow(color: rgba(70, 20, 50, .16), blurRadius: 30, spreadRadius: -12, offset: const Offset(0, 16)),
      BoxShadow(color: rgba(70, 20, 50, .05), blurRadius: 3, offset: const Offset(0, 1)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(70, 20, 50, .12), blurRadius: 24, spreadRadius: -12, offset: const Offset(0, 12)),
      BoxShadow(color: rgba(70, 20, 50, .045), blurRadius: 2, offset: const Offset(0, 1)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(70, 20, 50, .06), blurRadius: 6, offset: const Offset(0, 2)),
    ],
    brand: hex('#D07AA0'),
    brandSoft: hex('#F7DCE9'),
    brandInk: hex('#9A3A66'),
  );

  // ---------------------------------------------------------------- 1 PEARL
  static final pearl = NfcTokens(
    id: 'pearl',
    isDark: false,
    bg1: hex('#FAF7F2'),
    bg2: hex('#EFE7DA'),
    bgVignette: rgba(196, 164, 124, .14),
    surface: rgba(253, 251, 247, .82),
    surface2: rgba(253, 251, 247, .55),
    surfaceSolid: hex('#FDFBF7'),
    text1: hex('#2A2A2E'),
    text2: hex('#5A5A62'),
    text3: hex('#9A9AA2'),
    accent1: hex('#E4D2AB'),
    accent2: hex('#CBAA78'),
    accent3: hex('#8E7550'),
    goldDeep: hex('#B89552'),
    accentB: hex('#C5D8CB'),
    accentBDark: hex('#6E8A7A'),
    accentC: hex('#D5CFE4'),
    accentCDark: hex('#8E7FB8'),
    accentD: hex('#CBDCE8'),
    accentDDark: hex('#6B8FA8'),
    glow: rgba(203, 170, 120, .33),
    glowB: rgba(159, 184, 168, .35),
    border1: rgba(255, 255, 255, .95),
    border2: rgba(196, 164, 124, .22),
    error: hex('#D88A8A'),
    success: hex('#8FB89A'),
    warn: hex('#DDB878'),
    ambient1: rgba(228, 210, 171, .44),
    ambient2: rgba(197, 216, 203, .4),
    shadowFloat: [
      BoxShadow(color: rgba(160, 140, 110, .12), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(160, 140, 110, .06), blurRadius: 29, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(160, 140, 110, .08), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(160, 140, 110, .05), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(160, 140, 110, .06), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    brand: hex('#B89552'),
    brandSoft: hex('#E4D2AB'),
    brandInk: hex('#8E7550'),
  );

  // ------------------------------------------------------------- 2 GRAPHITE
  //
  // SOVUQ GRAPHITE + PLATINA (egasi, 2026-09: "Graphite va Onyx bir-
  // biriga o'xshab ketmasin"). Aksent ilgari iliq bej-kulrang
  // (`#C0BBB2`) edi va Onyx'ning iliq qorasi yonida farqi sezilmasdi;
  // endi sovuq kumush-platina. Onyx — iliq qora + oltin.
  //
  // `text3` — hamma qorong'i mavzuda karta ustida ham >= 5:1 kontrast
  // ("xira kulrang matn bo'lmasin").
  static final graphite = NfcTokens(
    id: 'graphite',
    isDark: true,
    bg1: hex('#1A1B1F'),
    bg2: hex('#0A0B0E'),
    bgVignette: rgba(200, 200, 210, .08),
    surface: rgba(38, 40, 46, .72),
    surface2: rgba(38, 40, 46, .45),
    surfaceSolid: hex('#22232A'),
    text1: hex('#F0EFEB'),
    text2: hex('#B8B8BE'),
    text3: hex('#9396A1'),
    accent1: hex('#E6E9EE'),
    accent2: hex('#BCC3CD'),
    accent3: hex('#8A919C'),
    goldDeep: hex('#9AA2AD'),
    accentB: hex('#8FA0B0'),
    accentBDark: hex('#A8BDD0'),
    accentC: hex('#A8B0C4'),
    accentCDark: hex('#8A94B0'),
    accentD: hex('#8898A8'),
    accentDDark: hex('#A0B4C4'),
    glow: rgba(200, 208, 220, .18),
    glowB: rgba(143, 160, 176, .22),
    border1: rgba(255, 255, 255, .14),
    border2: rgba(200, 200, 210, .14),
    error: hex('#E09494'),
    success: hex('#94C4A0'),
    warn: hex('#E0C088'),
    ambient1: rgba(180, 180, 190, .14),
    ambient2: rgba(143, 160, 176, .14),
    shadowFloat: [
      BoxShadow(color: rgba(0, 0, 0, .43), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(0, 0, 0, .27), blurRadius: 29, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 0, 0, .31), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(0, 0, 0, .16), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 0, 0, .23), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    brand: hex('#BCC3CD'),
    brandSoft: rgba(188, 195, 205, .26),
    brandInk: hex('#E6E9EE'),
  );

  // ---------------------------------------------------------------- 3 OCEAN
  static final ocean = NfcTokens(
    id: 'ocean',
    isDark: true,
    bg1: hex('#0F1E30'),
    bg2: hex('#04101C'),
    bgVignette: rgba(111, 199, 224, .14),
    surface: rgba(30, 54, 82, .7),
    surface2: rgba(30, 54, 82, .45),
    surfaceSolid: hex('#152B44'),
    text1: hex('#E8F0F8'),
    text2: hex('#A8C0D8'),
    text3: hex('#89A5C2'),
    accent1: hex('#AFD6E0'),
    accent2: hex('#6FB3C6'),
    accent3: hex('#4A8FB0'),
    goldDeep: hex('#4E8FA6'),
    accentB: hex('#A8D4C4'),
    accentBDark: hex('#88C0B0'),
    accentC: hex('#B8C8E8'),
    accentCDark: hex('#8AA4CC'),
    accentD: hex('#D0E8F4'),
    accentDDark: hex('#A8C8E0'),
    glow: rgba(111, 199, 224, .3),
    glowB: rgba(168, 212, 196, .3),
    border1: rgba(200, 230, 255, .15),
    border2: rgba(111, 199, 224, .2),
    error: hex('#E09494'),
    success: hex('#94C4A0'),
    warn: hex('#E0C088'),
    ambient1: rgba(111, 199, 224, .28),
    ambient2: rgba(168, 212, 196, .22),
    shadowFloat: [
      BoxShadow(color: rgba(0, 10, 25, .47), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(0, 10, 25, .31), blurRadius: 29, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 10, 25, .35), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(0, 10, 25, .20), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 10, 25, .27), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    brand: hex('#6FB3C6'),
    brandSoft: rgba(111, 179, 198, .28),
    brandInk: hex('#AFD6E0'),
  );

  // --------------------------------------------------------------- 4 AURORA
  static final aurora = NfcTokens(
    id: 'aurora',
    isDark: true,
    bg1: hex('#1E1832'),
    bg2: hex('#0A0716'),
    bgVignette: rgba(184, 160, 224, .16),
    surface: rgba(50, 38, 78, .72),
    surface2: rgba(50, 38, 78, .45),
    surfaceSolid: hex('#2A2040'),
    text1: hex('#F4EDF8'),
    text2: hex('#C8B8E0'),
    text3: hex('#A698C3'),
    accent1: hex('#D3C6E4'),
    accent2: hex('#AE9BCB'),
    accent3: hex('#8A6FB0'),
    goldDeep: hex('#927CB0'),
    accentB: hex('#9ED8E0'),
    accentBDark: hex('#7EC0CC'),
    accentC: hex('#E0B8D8'),
    accentCDark: hex('#C090B8'),
    accentD: hex('#B8C4E8'),
    accentDDark: hex('#8A9AC8'),
    glow: rgba(184, 160, 224, .35),
    glowB: rgba(158, 216, 224, .3),
    border1: rgba(220, 200, 240, .15),
    border2: rgba(184, 160, 224, .22),
    error: hex('#E09494'),
    success: hex('#94C4A0'),
    warn: hex('#E0C088'),
    ambient1: rgba(184, 160, 224, .32),
    ambient2: rgba(158, 216, 224, .24),
    shadowFloat: [
      BoxShadow(color: rgba(10, 5, 25, .47), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(10, 5, 25, .31), blurRadius: 29, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(10, 5, 25, .35), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(10, 5, 25, .20), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(10, 5, 25, .27), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    brand: hex('#AE9BCB'),
    brandSoft: rgba(174, 155, 203, .28),
    brandInk: hex('#D3C6E4'),
  );

  // ------------------------------------------------------------- 5 MIDNIGHT
  // Brend logotipi aynan shu mavzu uchun yaratilgandek: chuqur ko'k fon,
  // champagne oltin aksent. `shadowFloat` ichidagi uchinchi qatlam —
  // juda yengil oltin nur; usiz mavzu shunchaki "qorong'i ko'k" bo'lardi.
  // ------------------------------------------------------------- 5 MONO
  //
  // OQ-QORA. Egasining so'rovi: "oq mayin fon, harflar tim qora,
  // boxlar chegarasi ham qora — faqat oq va qora".
  //
  // `midnight` o'rnini egalladi: u ham qorong'i mavzu edi va
  // `noir` bilan deyarli bir xil ko'rinardi, ya'ni tanlovda
  // ma'nosi yo'q edi.
  //
  // FON SOF OQ EMAS. `#F7F6F3` — juda yengil iliq kulrang. Sof
  // `#FFFFFF` ekranda ko'zni qamashtiradi va ustidagi oq kartalar
  // umuman ajralmaydi. Kartalar esa SOF OQ — shunda ular fondan
  // ko'tarilib turadi, chegara ham, soya ham kerak bo'lmaydi.
  //
  // AKSENT HAM QORA. Bu yagona mavzu bo'lib, unda oltin yo'q:
  // "faqat oq va qora" degani aynan shu. Holat ranglari (xato,
  // ogohlantirish) ham kulrangning quyuq darajalari — ular
  // bo'yoq bilan emas, MATN bilan tushuntiriladi.
  static final mono = NfcTokens(
    id: 'mono',
    isDark: false,
    bg1: hex('#F7F6F3'),
    bg2: hex('#EFEEEA'),
    // Vinyetka deyarli sezilmaydi — oq fonda har qanday quyuq
    // dog' iflos ko'rinadi.
    bgVignette: rgba(0, 0, 0, .04),
    surface: rgba(255, 255, 255, .92),
    surface2: rgba(255, 255, 255, .70),
    surfaceSolid: hex('#FFFFFF'),
    text1: hex('#0A0A0A'),
    text2: hex('#3D3D3D'),
    text3: hex('#6B6B6B'),
    accent1: hex('#111111'),
    accent2: hex('#000000'),
    accent3: hex('#4A4A4A'),
    // Rejim va mahsulot aksentlari — hammasi qoraning darajalari.
    // "Faqat oq va qora" degani aynan shu: biznes rejimi ham,
    // boshqa aksentlar ham rang bilan emas, QUYUQLIK bilan
    // ajraladi.
    goldDeep: hex('#000000'),
    accentB: hex('#111111'),
    accentBDark: hex('#000000'),
    accentC: hex('#2A2A2A'),
    accentCDark: hex('#141414'),
    accentD: hex('#3D3D3D'),
    accentDDark: hex('#1F1F1F'),
    glow: rgba(0, 0, 0, .10),
    glowB: rgba(0, 0, 0, .08),
    // CHEGARALAR QORA — egasining aniq so'rovi. Sof qora chiziq
    // juda qattiq ko'rinadi, shuning uchun shaffoflik bilan:
    // ko'z uni qora deb o'qiydi, lekin u ekranni to'rga
    // aylantirmaydi.
    //
    // .55 dan .38 ga TUShIRILDI. Oltita mavzuning chegarasi
    // o'lchab chiqilganda ma'lum bo'ldi: qolganlarida .14-.15,
    // bu yerda esa .55 — TO'RT BAROBAR qattiq. Shuning uchun
    // oq-qora mavzu boshqalaridan ko'ra "chizilgan" bo'lib
    // ko'rinardi. .38 hamon aniq qora, lekin endi qolgan
    // mavzular bilan bir oilada.
    border1: rgba(0, 0, 0, .38),
    border2: rgba(0, 0, 0, .22),
    error: hex('#8A1F1F'),
    success: hex('#1F5A2E'),
    warn: hex('#7A5A10'),
    ambient1: rgba(0, 0, 0, .05),
    ambient2: rgba(0, 0, 0, .03),
    shadowFloat: [
      BoxShadow(color: rgba(0, 0, 0, .10), blurRadius: 24, offset: const Offset(0, 8)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 0, 0, .07), blurRadius: 14, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 0, 0, .06), blurRadius: 6, offset: const Offset(0, 2)),
    ],
    // Oq-qora mavzuda oltin yo'q — "brend" ham kulrang daraja.
    brand: hex('#3D3D3D'),
    brandSoft: rgba(0, 0, 0, .10),
    brandInk: hex('#141414'),
  );

  // ------------------------------------------------------------- 5 MIDNIGHT
  // Brend logotipi aynan shu mavzu uchun yaratilgandek: chuqur ko'k fon,
  // champagne oltin aksent. `shadowFloat` ichidagi uchinchi qatlam —
  // juda yengil oltin nur; usiz mavzu shunchaki "qorong'i ko'k" bo'lardi.
  static final midnight = NfcTokens(
    id: 'midnight',
    isDark: true,
    bg1: hex('#0C1526'),
    bg2: hex('#070C18'),
    bgVignette: rgba(212, 179, 106, .10),
    surface: rgba(22, 34, 52, .72),
    surface2: rgba(22, 34, 52, .45),
    surfaceSolid: hex('#121F34'),
    text1: hex('#F5EFE2'),
    text2: hex('#B8B4A6'),
    text3: hex('#6E6A60'),
    accent1: hex('#E8D4A0'),
    accent2: hex('#C9A96A'),
    accent3: hex('#8E7340'),
    goldDeep: hex('#B08F4E'),
    accentB: hex('#A8B8C4'),
    accentBDark: hex('#C4D0D8'),
    accentC: hex('#B8B0C8'),
    accentCDark: hex('#8E88A0'),
    accentD: hex('#C4C8D0'),
    accentDDark: hex('#9AA0A8'),
    glow: rgba(201, 169, 106, .32),
    glowB: rgba(168, 184, 196, .22),
    border1: rgba(212, 179, 106, .14),
    border2: rgba(201, 169, 106, .24),
    error: hex('#E0A0A0'),
    success: hex('#A8C4A8'),
    warn: hex('#E0C088'),
    ambient1: rgba(201, 169, 106, .22),
    ambient2: rgba(50, 90, 140, .24),
    shadowFloat: [
      BoxShadow(color: rgba(0, 5, 15, .55), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(0, 5, 15, .39), blurRadius: 29, offset: const Offset(0, 8)),
      BoxShadow(color: rgba(201, 169, 106, .08), blurRadius: 60),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 5, 15, .43), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(0, 5, 15, .27), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 5, 15, .31), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    brand: hex('#C9A96A'),
    brandSoft: rgba(201, 169, 106, .26),
    brandInk: hex('#E8D4A0'),
  );

  /// ONYX — SAYTDAGI BIZNES PROFILNING O'ZI.
  ///
  /// Ranglar taxmin qilinmadi, saytning haqiqiy ekranidan
  /// o'lchab olindi: fon `#0D0C0A` dan `#1D1A15` gacha, ya'ni
  /// ILIQ ko'mir-qora (qizil > yashil > ko'k). `midnight` esa
  /// sovuq ko'k-qora (`#0C1526`) — butunlay boshqa oila.
  ///
  /// Oltin `midnight` dagidan olingan: u allaqachon saytdagi
  /// oltinga mos edi, faqat foni boshqa edi.
  static final onyx = NfcTokens(
    id: 'onyx',
    isDark: true,
    bg1: hex('#141210'),
    bg2: hex('#0C0B09'),
    bgVignette: rgba(212, 179, 106, .10),
    surface: rgba(32, 29, 24, .74),
    surface2: rgba(32, 29, 24, .46),
    surfaceSolid: hex('#1D1A15'),
    text1: hex('#F5EFE2'),
    text2: hex('#B5AC99'),
    text3: hex('#9C927E'),
    accent1: hex('#E8D4A0'),
    accent2: hex('#C9A96A'),
    accent3: hex('#8E7340'),
    goldDeep: hex('#B08F4E'),
    accentB: hex('#C0B49C'),
    accentBDark: hex('#D6CCB6'),
    accentC: hex('#C2B39A'),
    accentCDark: hex('#9A8D76'),
    accentD: hex('#CCC4B4'),
    accentDDark: hex('#A39B8B'),
    glow: rgba(201, 169, 106, .32),
    glowB: rgba(192, 180, 156, .20),
    border1: rgba(212, 179, 106, .14),
    border2: rgba(201, 169, 106, .24),
    error: hex('#E0A0A0'),
    success: hex('#A8C4A8'),
    warn: hex('#E0C088'),
    ambient1: rgba(201, 169, 106, .22),
    ambient2: rgba(120, 96, 58, .20),
    shadowFloat: [
      BoxShadow(color: rgba(6, 5, 3, .58), blurRadius: 72, offset: const Offset(0, 23)),
      BoxShadow(color: rgba(6, 5, 3, .40), blurRadius: 29, offset: const Offset(0, 8)),
      BoxShadow(color: rgba(201, 169, 106, .08), blurRadius: 60),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(6, 5, 3, .45), blurRadius: 46, offset: const Offset(0, 13)),
      BoxShadow(color: rgba(6, 5, 3, .28), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(6, 5, 3, .32), blurRadius: 17, offset: const Offset(0, 4)),
    ],
    brand: hex('#C9A96A'),
    brandSoft: rgba(201, 169, 106, .26),
    brandInk: hex('#E8D4A0'),
  );

  // ------------------------------------------------------------ 7 NOIR
  //
  // NFCSTORE PREMIUM — LUXURY BLUE-BLACK + CHAMPAGNE.
  //
  // ## "QORA ICHIDA JUDA TO'Q KO'K"
  //
  // Qiymatlar egasi bergan reference asosida. Ikki marta
  // to'g'rilandi va ikkala xato ham yozib qo'yilgan, chunki ular
  // oson qaytadi:
  //
  //   1-urinish: fon saytdagi `#0a0805` dan olingandi (R=10,
  //      B=5) va ustiga oltin tumanlik tushardi -> butun ilova
  //      "tim jigarrang" bo'lib ko'rindi;
  //   2-urinish: fon neytral ko'mir qilindi -> jigarranglik
  //      ketdi, lekin "premium" hissi ham ketdi, oddiy kulrang
  //      qoldi.
  //
  // To'g'ri javob — MIDNIGHT NAVY: sof qora emas, jigarrang ham
  // emas, qoraga juda yaqin sovuq ko'k. Ko'k YORQIN ko'rinmaydi,
  // faqat chuqurlik beradi.
  //
  //     fon         #07111F      karta        #0E1A2A
  //     chuqur fon  #050B14      ko'tarilgan  #142337
  //     chegara     #2A3B52      matn         #F4F1E8
  //     shampan     #D6B25E      yumshoq      #E4C97A
  //
  // ## OLTIN — 10-15%, FON EMAS
  //
  // Oltin faqat aksentda: faol tab, ikonka halqasi, ingichka
  // chegara, NFC ID, tasdiq belgisi va asosiy tugma. Katta
  // yuzalar HECH QACHON to'la oltin bo'lmaydi.
  static final noir = NfcTokens(
    id: 'noir',
    isDark: true,
    bg1: hex('#07111F'),
    bg2: hex('#050B14'),
    // Pastki vinyetka NAVY, oltin emas: oltin tuman butun
    // ekranni sariq qilardi.
    bgVignette: rgba(5, 11, 20, .55),
    // YUZALAR FONDAN 1-2 TON OCHROQ NAVY.
    //
    // Shaffoflik emas, ANIQ rang: shaffof yuza fon gradientiga
    // qarab "suzib" ketardi va kartaning chegarasi ekranning
    // qaysi joyida turganiga qarab yo'qolardi.
    //
    // Qiymat ko'z bilan emas, O'LCHOV bilan tanlangan. Reference
    // bergan `#0E1A2A` fondan atigi 0.0045 yorqinroq — qora
    // ekranda bu deyarli sezilmaydi va karta fonga singib
    // ketadi. `#16283E` esa 0.0149 beradi: hali ham juda to'q
    // navy, lekin chegarasi aniq. `theme_test.dart` shu farqni
    // qo'riqlaydi.
    surface: hex('#16283E'),
    surface2: hex('#0E1A2A'),
    surfaceSolid: hex('#142337'),
    text1: hex('#F4F1E8'),
    text2: hex('#AAB4C3'),
    text3: hex('#8A96A9'),
    accent1: hex('#E4C97A'),
    accent2: hex('#D6B25E'),
    accent3: hex('#A8853F'),
    goldDeep: hex('#8A6C30'),
    // Ikkilamchi — platina va yashil "ochiq" holati.
    accentB: hex('#7FB28E'),
    accentBDark: hex('#5E8E6C'),
    accentC: hex('#C9CDD2'),
    accentCDark: hex('#8E949A'),
    accentD: hex('#E2E4E7'),
    accentDDark: hex('#AFB4B9'),
    glow: rgba(228, 201, 122, .20),
    glowB: rgba(201, 205, 210, .10),
    // Chegara — reference'dagi `#2A3B52`, ya'ni navy, oltin emas.
    // Oltin chegara faqat AKSENT elementlarda.
    border1: rgba(214, 178, 94, .30),
    border2: hex('#2A3B52'),
    error: hex('#C9573F'),
    success: hex('#7FB28E'),
    warn: hex('#E0B458'),
    // O'RTADA JUDA YENGIL NAVY KO'TARILISH.
    //
    // Reference'da fon tekis qora emas: chetlarda va o'rtada
    // yumshoq navy nur bor (o'lchandi: `#142838` atrofida),
    // pastga tomon esa deyarli qoraga tushadi. Shusiz ekran
    // "yassi qora" bo'lib ko'rinardi.
    //
    // OLTIN AMBIENT — .05 DAN .13 GA.
    //
    // .05 da u amalda YO'Q edi: navy chuqurlik bor, iliqlik esa
    // yo'q, shuning uchun fon "toza, lekin oddiy" ko'rinardi.
    // Boshqa mavzularda bu qiymat .14-.32 — ya'ni `noir`, aynan
    // STANDART va brend mavzusi, eng tekis fonli bo'lib qolgan
    // ekan.
    //
    // .13 fonni sarg'aytirmaydi (buni rang sinovi qo'riqlaydi:
    // fon sovuq, ko'k kanal qizildan katta bo'lib qolishi kerak),
    // lekin oltin aksent bilan fon o'rtasida BOG'LIQLIK paydo
    // qiladi — premium hissi shundan keladi, aksentning
    // yorqinligidan emas.
    ambient1: rgba(214, 178, 94, .13),
    ambient2: rgba(32, 56, 86, .55),
    shadowFloat: [
      BoxShadow(color: rgba(0, 0, 0, .55), blurRadius: 28, offset: const Offset(0, 10)),
    ],
    shadowSoft: [
      BoxShadow(color: rgba(0, 0, 0, .42), blurRadius: 18, offset: const Offset(0, 6)),
    ],
    shadowTiny: [
      BoxShadow(color: rgba(0, 0, 0, .32), blurRadius: 9, offset: const Offset(0, 3)),
    ],
    brand: hex('#D6B25E'),
    brandSoft: rgba(214, 178, 94, .26),
    brandInk: hex('#E4C97A'),
  );

  // TANLASH MUMKIN BO'LGAN MAVZULAR — HAMMASI QORONG'I.
  //
  // `pearl` (oq-krem fon) ro'yxatdan OLIB TASHLANDI. U ta'rifi
  // bilan qoladi, chunki sinovlar undan yorug' palitra namunasi
  // sifatida foydalanadi — lekin foydalanuvchi uni tanlay olmaydi.
  //
  // NIMA UCHUN: qurilmada butun ilova oqarib turgan edi. Sabab
  // mavzu emas, SAQLANGAN TANLOV: `pearl` eski o'rnatishdan
  // xotirada qolgan va `byId()` uni tiklab berardi. Noir standart
  // bo'lgani bilan hech narsa o'zgarmagan edi.
  //
  // Ro'yxatdan chiqarilgani bilan tuzalish O'ZI keladi: `byId()`
  // topa olmagan id uchun `fallback` (noir) qaytaradi, ya'ni eski
  // tanlov saqlangan qurilmalar keyingi ochilishda Noir'ga
  // o'tadi. Alohida migratsiya kodi shart emas.
  //
  // `mono` ("Oq qora") ham 2026-09 da xuddi shu yo'l bilan OLIB
  // TASHLANDI: egasi Sozlamalarda ikkita oq mavzuni ko'rdi va
  // bittasi qolsin dedi — `ivory` qoldi. `mono` ta'rifi sinovlar
  // uchun qoladi; uni tanlagan qurilma keyingi ochilishda
  // `fallback` (ivory) ga o'tadi.
  static final all = <NfcTokens>[ivory, noir, ocean, graphite, aurora, onyx];

  /// SOZLAMALARDAGI TANLOV — HAMMA MAVZU (egasi, 2026-09: "rangli
  /// temalarni yashirma"). `ivory` standart va birinchi. Barcha
  /// mavzularda UI, komponent va joylashuv BIR XIL — faqat rang
  /// tokenlari o'zgaradi.
  static List<NfcTokens> get choices => all;

  /// STANDART MAVZU — `noir`.
  ///
  /// Foydalanuvchi hali tanlamagan bo'lsa (birinchi ochilish yoki
  /// saqlangan qiymat noma'lum bo'lsa) shu ishlatiladi.
  ///
  /// Ilgari `ocean` edi. Egasining qarori (2026-09): ilova
  /// birinchi ochilganda NFCSTORE brend rangida ko'rinsin, ya'ni
  /// sayt bilan bir xil qora-shampan palitrada. `ocean`
  /// O'CHIRILMADI — u Sozlamalarda muqobil mavzu bo'lib qoladi
  /// va uni tanlagan odamda hech narsa o'zgarmaydi.
  ///
  /// 2026-09 (ikkinchi qaror): standart `ivory` ga o'tdi — egasi oq
  /// editorial yo'nalishni tanladi. `noir` O'CHIRILMADI: uni
  /// Sozlamalarda ANIQ tanlagan odamda u saqlanib qoladi, chunki
  /// mavzu faqat tanlanganda yoziladi (`ThemeController.select`).
  /// Hech narsa tanlamagan odam esa keyingi ochilishda ivory'ni
  /// ko'radi — alohida migratsiya kerak emas.
  static NfcTokens get fallback => ivory;

  static NfcTokens byId(String? id) =>
      choices.firstWhere((t) => t.id == id, orElse: () => fallback);
}

/// `context.tokens` — har widget ichida `Theme.of(context).extension<...>()`
/// yozmaslik uchun.
extension NfcTokensX on BuildContext {
  NfcTokens get tokens =>
      Theme.of(this).extension<NfcTokens>() ?? NfcTokens.fallback;
}
