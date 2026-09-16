import 'package:flutter/widgets.dart';

/// DIZAYN TOKENLARI — "Yorug' metall, jonli chuqurlik".
///
/// Token nomlari VAZIFANI ifodalaydi, rangni emas: `background.*`,
/// `surface.*`, `text.*`, `action.*`, `border.*`, `state.*`. Shu
/// sababli mavzu almashganda kod o'zgarmaydi — faqat qiymat
/// almashadi.
///
/// UCH QAT'IY QOIDA:
/// 1. Ekranda BITTA asosiy urg'u rangi. Ikkilamchi rang faqat
///    holat, badge va gradient chekkasi uchun.
/// 2. Tarif — bu MATERIAL (metall), rang mavzusi emas. Mavzu
///    almashsa ham Gold Gold bo'lib qoladi.
/// 3. Chuqurlik yorqinlikdan emas, QATLAMLARDAN keladi: fon nuri →
///    yuza → qirra → soya.

// ─────────────────────────────────────────────────────────────
// MAVZU
// ─────────────────────────────────────────────────────────────

/// Mavzu — urg'u oilasi va fon yorug'ligi.
///
/// NIMA ALMASHADI: urg'u rangi, fon gradientining issiqligi va
/// ambient nur dog'ining rangi. NIMA ALMASHMAYDI: tarif
/// materiallari, matn darajalari, muvaffaqiyat/xato ranglari va
/// Payme/Click brend ranglari.
@immutable
class Palette {
  const Palette({
    required this.id,
    required this.label,
    required this.light,
    required this.accent,
    required this.accentHigh,
    required this.accentDeep,
    required this.accentSecondary,
    required this.aura,
    required this.baseTop,
    required this.baseMid,
    required this.baseBottom,
    required this.raised,
    required this.raisedHigh,
    required this.ink,
    required this.ink2,
    required this.ink3,
    required this.onAccent,
  });

  /// Saqlanadigan kalit (`app_theme`). Hech qachon o'zgarmasin —
  /// foydalanuvchining tanlovi shu satr orqali qaytadi.
  final String id;

  /// Sozlamalarda ko'rinadigan nom.
  final String label;

  /// YORUG'MI YOKI TO'QMI. Bu bitta bayroq butun ilovaga ta'sir
  /// qiladi: status bar ikonkalari, shisha to'ldirishi (yorug'da
  /// qora, to'qda oq), pastki scrim yo'nalishi va soyalar kuchi.
  /// Palitrani yorug' qilish uchun shuni `true` qilish yetadi —
  /// ekranlar kodi o'zgarmaydi.
  final bool light;

  /// `action.primary` va urg'u matn rangi.
  final Color accent;

  /// Gradientning YORUG' uchi.
  final Color accentHigh;

  /// Gradientning QUYUQ uchi va bosilgan holat.
  final Color accentDeep;

  /// Ikkilamchi jonli rang — faqat holat, badge va gradient
  /// chekkasi uchun. Hech qachon asosiy CTA emas.
  final Color accentSecondary;

  /// Ambient nur dog'ining rangi (shaffofligi joyida beriladi).
  final Color aura;

  /// Fon gradienti: tepa → o'rta → past.
  final Color baseTop;
  final Color baseMid;
  final Color baseBottom;

  /// Ko'tarilgan yuza (karta, tile) gradienti.
  final Color raised;
  final Color raisedHigh;

  /// Matnning uch darajasi. YORUG' PALITRADA BULAR QORA TOMONDA —
  /// shuning uchun ular palitra ichida, `C` da qotirilgan emas.
  final Color ink;
  final Color ink2;
  final Color ink3;

  /// Urg'u yuzasida turadigan matn (tugma ichi).
  final Color onAccent;

  // ── A · OPAL ────────────────────────────────────────────────
  //
  // Asosiy yo'nalish: yorug', sof, hi-tech. Fon deyarli oq,
  // chuqurlik qatlamlar va yumshoq soyalardan keladi, urg'u —
  // to'yingan indigo-ko'k. Kunduzi ko'chada o'qish oson; metall
  // kartalar oq fonda haqiqiy mahsulot fotosi kabi ko'rinadi.
  static const opal = Palette(
    id: 'opal',
    label: 'Opal',
    light: true,
    accent: Color(0xFF3A62CC),
    accentHigh: Color(0xFF6179D1),
    accentDeep: Color(0xFF2C4CA6),
    accentSecondary: Color(0xFFD98A2B),
    aura: Color(0xFF9DB4E8),
    baseTop: Color(0xFFFFFFFF),
    baseMid: Color(0xFFF7F8FB),
    baseBottom: Color(0xFFF2F4F7),
    raised: Color(0xFFFFFFFF),
    raisedHigh: Color(0xFFE8ECF3),
    ink: Color(0xFF0D1117),
    ink2: Color(0xFF596372),
    ink3: Color(0xFF8C95A3),
    onAccent: Color(0xFFFFFFFF),
  );

  // ── B · TUN ─────────────────────────────────────────────────
  //
  // Kechki variant. Qora emas — ko'kimtir grafit, shuning uchun
  // "o'lik" ko'rinmaydi. Urg'u — och ko'k, to'q fonda yumshoq
  // yonadi.
  static const night = Palette(
    id: 'night',
    label: 'Tun',
    light: false,
    accent: Color(0xFF87A9EB),
    accentHigh: Color(0xFFBCD2F8),
    accentDeep: Color(0xFF5C82C9),
    accentSecondary: Color(0xFFE0A75A),
    aura: Color(0xFF6E8FD6),
    baseTop: Color(0xFF12151B),
    baseMid: Color(0xFF0C0E13),
    baseBottom: Color(0xFF080A0E),
    raised: Color(0xFF12151B),
    raisedHigh: Color(0xFF1D222B),
    ink: Color(0xFFF2F4F7),
    ink2: Color(0xFFA8B1C1),
    ink3: Color(0xFF6D798C),
    onAccent: Color(0xFF080A0E),
  );

  // ── C · DUNA ────────────────────────────────────────────────
  //
  // Iliq qum va mis. Yorug', lekin oq emas — teri va tosh hissi.
  // Bronza va oltin kartalar aynan shu fonda eng qimmat ko'rinadi.
  static const dune = Palette(
    id: 'dune',
    label: 'Duna',
    light: true,
    accent: Color(0xFF8C5F32),
    accentHigh: Color(0xFFB9936C),
    accentDeep: Color(0xFF6B4623),
    accentSecondary: Color(0xFF2F6B5E),
    aura: Color(0xFFC9A87F),
    baseTop: Color(0xFFF3E7D5),
    baseMid: Color(0xFFEBDCC6),
    baseBottom: Color(0xFFE7D7C1),
    raised: Color(0xFFF7EEE1),
    raisedHigh: Color(0xFFDDCDB6),
    ink: Color(0xFF332E27),
    ink2: Color(0xFF756C60),
    ink3: Color(0xFF9F9589),
    onAccent: Color(0xFFFFF7EA),
  );

  // ── D · ZUMRAD ──────────────────────────────────────────────
  //
  // To'q zargarlik yashili. Tun bilan bir oilada emas: u ko'k,
  // bu yashil-toshli. Reels va NFC ekranlarida chuqur ko'rinadi.
  static const jade = Palette(
    id: 'jade',
    label: 'Zumrad',
    light: false,
    accent: Color(0xFF4FC79A),
    accentHigh: Color(0xFF8FE3C2),
    accentDeep: Color(0xFF2F8A68),
    accentSecondary: Color(0xFFD9A441),
    aura: Color(0xFF3FA57F),
    baseTop: Color(0xFF0C1A16),
    baseMid: Color(0xFF08130F),
    baseBottom: Color(0xFF06100D),
    raised: Color(0xFF0C1A16),
    raisedHigh: Color(0xFF163027),
    ink: Color(0xFFEAF4F0),
    ink2: Color(0xFF9DB5AC),
    ink3: Color(0xFF6B837B),
    onAccent: Color(0xFF06100D),
  );

  static const List<Palette> all = [opal, night, dune, jade];

  static Palette byId(String? id) {
    for (final p in all) {
      if (p.id == id) return p;
    }
    return opal;
  }
}

// ─────────────────────────────────────────────────────────────
// RANG TOKENLARI
// ─────────────────────────────────────────────────────────────

/// Rang va material tokenlari.
///
/// MAVZUGA BOG'LIQ QIYMATLAR `static get` — `const` EMAS.
/// Sabab: `const` qiymat kompilyatsiya paytida muzlab qoladi va
/// mavzu almashganda o'zgarmaydi. Shu sababli `C.accent` o'qigan
/// widget ham `const` bo'la olmaydi — bu xato emas, bu mavzu
/// almashishining o'zagi.
class C {
  const C._();

  static Palette _p = Palette.opal;

  /// Mavzuni qo'llash. `AppPrefs.load()` va `setPalette()` chaqiradi,
  /// keyin ildizda bitta `setState` butun daraxtni qayta quradi.
  static void apply(Palette p) => _p = p;

  static Palette get palette => _p;

  // ── Fon va yuzalar ──────────────────────────────────────────

  /// `background.primary` — eng chuqur qatlam.
  static Color get bg => _p.baseBottom;

  /// Fon gradientining tepa va o'rta nuqtalari.
  static Color get bgTop => _p.baseTop;
  static Color get bgMid => _p.baseMid;

  /// YORUG' PALITRAMI. Ekranlar shuni o'qib, faqat yorug'likka
  /// bog'liq qarorlarni almashtiradi (masalan rasm ustidagi matn
  /// uchun scrim yo'nalishi). Rang tanlash uchun emas.
  static bool get isLight => _p.light;

  /// `background.cool` — sovuq asos (NFC markazi, Qidiruv).
  /// Bu ekranlarning o'z yorug'lik manbai bor va ular Home'dan
  /// ATAYLAB farq qiladi: urg'u tomonga bir oz siljigan asos.
  static Color get bgCool => Color.lerp(
        _p.baseBottom,
        _p.accent,
        _p.light ? .05 : .04,
      )!;
  static Color get bgCoolTop => Color.lerp(
        _p.baseTop,
        _p.accent,
        _p.light ? .09 : .07,
      )!;

  /// Modal orqa fon — sheet ostidagi xiralik. Yorug' palitrada ham
  /// xiralik QUYUQ bo'ladi: sheet oldinga chiqishi kerak.
  static Color get backdrop =>
      _p.light ? const Color(0xFF2A3038) : const Color(0xFF050508);

  /// `surface.raised` — kartalar va tile'lar.
  static Color get surface => _p.raised;
  static Color get surfaceHigh => _p.raisedHigh;

  /// `surface.glass` — shisha panel to'ldirishi (blur ustiga).
  ///
  /// YORUG' PALITRADA OQ EMAS. Oq fon ustidagi oq shaffoflik
  /// ko'rinmaydi — panel fonga yopishib qoladi va qatlam hissi
  /// yo'qoladi. Shuning uchun yorug'da to'ldirish oq, lekin
  /// QUYUQROQ tomonga surilgan yuza rangidan olinadi.
  static Color get glass => _p.light
      ? const Color(0xE6FFFFFF)
      : const Color(0x0FFFFFFF);
  static Color get glassHigh => _p.light
      ? const Color(0xF2FFFFFF)
      : const Color(0x12FFFFFF);

  /// Shisha blur radiusi — dizayn spetsifikatsiyasi: 16 (panel),
  /// 22 (sheet).
  static const double blurPanel = 16;
  static const double blurSheet = 22;

  // ── Matn ────────────────────────────────────────────────────

  // MATN RANGLARI HAM SAYTDAN. Ilgari ular SOVUQ kulrang edi
  // (`#98918A`, `#5F5A55`) va oltin fon ustida begona ko'rinardi —
  // ko'z buni "ranglar bir-biriga yopishmayapti" deb o'qiydi.
  // Saytda esa matn ham iliq tomonda: `#f2ece0`, `#8f887c`,
  // `#777166`. Farq kichik, lekin butun ekranning "mayin"ligi
  // aynan shundan.

  /// `text.primary` — sarlavha va asosiy matn.
  static Color get ink => _p.ink;

  /// `text.secondary` — tana matni, izoh.
  static Color get ink2 => _p.ink2;

  /// `text.muted` — meta, eyebrow, o'chiq holat.
  static Color get ink3 => _p.ink3;

  /// Urg'u yuzada turadigan matn (tugma ichi).
  static Color get onAccent => _p.onAccent;

  /// TO'Q YUZADA turadigan matn — rasm, video va metall ustidagi
  /// yozuvlar. Palitra yorug' bo'lsa ham bu oq qoladi: rasm
  /// palitrani bilmaydi.
  static const Color onDark = Color(0xFFF7F9FC);
  static const Color onDark2 = Color(0xCCF7F9FC);

  // ── Chiziq ──────────────────────────────────────────────────

  /// `border.subtle` — yumshoq chegara.
  ///
  /// Yorug' palitrada urg'u rangining shaffofi oq fonda deyarli
  /// ko'rinmaydi, shuning uchun u yerda chegara MATN tomonidan
  /// olinadi — nozik, lekin aniq.
  static Color get line => _p.light
      ? _p.ink.withValues(alpha: .10)
      : _p.accent.withValues(alpha: .12);

  /// Kuchliroq chegara — tanlangan holat, fokus halqasi.
  static Color get lineStrong => _p.accent.withValues(alpha: _p.light ? .55 : .42);

  /// Neytral hairline — shisha va sovuq yuzalarda.
  static Color get lineCool => _p.light
      ? const Color(0x14000000)
      : const Color(0x14FFFFFF);

  // ── Urg'u ───────────────────────────────────────────────────

  /// `action.primary` — bitta asosiy urg'u.
  static Color get accent => _p.accent;
  static Color get accentHigh => _p.accentHigh;
  static Color get accentDeep => _p.accentDeep;

  /// `accent.secondary` — jonli ikkilamchi. Faqat holat, badge va
  /// gradient chekkasi.
  static Color get accentSecondary => _p.accentSecondary;

  /// PLATINA — NFC tabi va texnik urg'ular.
  ///
  /// Bu "sovuq metall" urg'usi: asosiy urg'udan farq qilishi kerak,
  /// aks holda ekranda ikkita bir xil rang bo'ladi. Lekin u
  /// palitradan BUTUNLAY uzilib qolmasligi ham kerak: iliq qum
  /// palitrada sof ko'kimtir kulrang begona ko'rinadi. Shuning
  /// uchun u ikkilamchi matn rangidan olinadi va urg'u tomonga
  /// 18% suriladi — neytral, lekin oilaga tegishli.
  static Color get platinum => Color.lerp(_p.ink2, _p.accent, .18)!;

  // ── Holat ───────────────────────────────────────────────────

  /// `state.success` / `state.error`. HECH QACHON mavzuga bog'liq
  /// emas: yashil doim yashil, qizil doim qizil.
  /// Holat ranglari. Yorug' fonda ochiq yashil/sariq o'qilmaydi
  /// (kontrast 4.5:1 dan past), shuning uchun yorug' palitrada
  /// ularning quyuq varianti olinadi. Ma'no o'zgarmaydi.
  static Color get ok =>
      _p.light ? const Color(0xFF1E8F5E) : const Color(0xFF63D694);
  static Color get fail =>
      _p.light ? const Color(0xFFC0392B) : const Color(0xFFE2685F);
  static Color get warn =>
      _p.light ? const Color(0xFFA9711A) : const Color(0xFFE2B845);

  // ── Brend ranglari — o'zgarmaydi ────────────────────────────

  static const Color payme = Color(0xFF00CEC8);
  static const Color click = Color(0xFF00A0E3);
  static const Color telegram = Color(0xFF2AABEE);
  static const Color whatsapp = Color(0xFF25D366);

  // ── Joy egallovchi (media kelmaguncha) ──────────────────────

  static Color get placeholder => _p.raisedHigh;
  static Color get placeholderAlt => _p.raised;

  // ─────────────────────────────────────────────────────────
  // GRADIENTLAR
  // ─────────────────────────────────────────────────────────

  /// EKRAN FONI — iliq asos.
  ///
  /// Uch to'xtash nuqtasi: tepada iliq, o'rtada quyuqlashadi,
  /// pastda eng chuqur. Keskin chegara bo'lmasligi uchun o'rta
  /// nuqta 62% da — CSS maketidagi bilan bir xil.
  static LinearGradient get screenBase => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [_p.baseTop, _p.baseMid, _p.baseBottom],
        stops: const [0, .62, 1],
      );

  /// EKRAN FONI — sovuq asos (NFC markazi, Qidiruv).
  static LinearGradient get screenBaseCool => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [bgCoolTop, bgCool],
      );

  /// KO'TARILGAN YUZA — karta va tile.
  ///
  /// 140° — yorug'lik yuqori chapdan tushadi degani. Butun ilovada
  /// bitta burchak ishlatiladi, aks holda yuzalar bir-biriga mos
  /// kelmaydi.
  static LinearGradient get raisedSurface => LinearGradient(
        begin: const Alignment(-.85, -1),
        end: const Alignment(.85, 1),
        colors: [_p.raisedHigh, _p.raised],
      );

  /// SHISHA PANEL — blur ustiga qo'yiladigan nozik yorug'lik.
  ///
  /// Yorug' palitrada panel deyarli xira oq bo'ladi: blur ostidagi
  /// kontent sezilib turadi, lekin matn to'liq o'qiladi.
  static LinearGradient get glassSurface => _p.light
      ? const LinearGradient(
          begin: Alignment(-.5, -1),
          end: Alignment(.5, 1),
          colors: [Color(0xF0FFFFFF), Color(0xE0FFFFFF)],
        )
      : const LinearGradient(
          begin: Alignment(-.5, -1),
          end: Alignment(.5, 1),
          colors: [Color(0x12FFFFFF), Color(0x05FFFFFF)],
        );

  /// ASOSIY TUGMA YUZASI — metall oltin.
  ///
  /// Yuqorida deyarli oq (#FFF0C2), o'rtada to'yingan oltin,
  /// pastda quyuq. Shu uch nuqta tugmani "bo'yalgan" emas,
  /// "quyilgan metall" qilib ko'rsatadi.
  static LinearGradient get actionFace => LinearGradient(
        begin: const Alignment(-.7, -1),
        end: const Alignment(.7, 1),
        colors: [_p.accentHigh, _p.accent, _p.accentDeep],
        stops: const [0, .4, 1],
      );

  /// Bosilgan holat — bir oz quyuqlashadi (yorug'lik "so'nadi").
  static LinearGradient get actionFacePressed => LinearGradient(
        begin: const Alignment(-.7, -1),
        end: const Alignment(.7, 1),
        colors: [_p.accent, _p.accentDeep],
      );

  /// METALL MATN — sarlavhadagi oltin so'z uchun `ShaderMask`.
  static LinearGradient get accentText => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [_p.accentHigh, _p.accent, _p.accentDeep],
        stops: const [0, .45, 1],
      );

  /// DUMALOQ MEDALYON — logotip ortidagi oltin halqa.
  static RadialGradient get medallion => RadialGradient(
        center: const Alignment(-.35, -.45),
        radius: 1.1,
        colors: [
          _p.accentHigh.withValues(alpha: .34),
          _p.accent.withValues(alpha: .10),
          const Color(0x00000000),
        ],
        stops: const [0, .55, 1],
      );

  /// STORY HALQASI — oltin.
  static SweepGradient get storyRing => SweepGradient(
        colors: [
          _p.accentHigh,
          _p.accentSecondary,
          _p.accent,
          _p.accentHigh,
        ],
        stops: const [0, .35, .7, 1],
        transform: const GradientRotation(.35),
      );

  /// REELS HALQASI — yashil-oltin (dizayn qoidasi: yashil halqa =
  /// Reels bor).
  static SweepGradient get reelsRing => SweepGradient(
        colors: [
          ok,
          _p.accent,
          const Color(0xFF9BE8BE),
          ok,
        ],
        stops: const [0, .4, .7, 1],
        transform: const GradientRotation(.44),
      );

  /// PASTKI SCRIM — yopishgan tugma ostidagi kontentni yumshoq
  /// yashiradi. Keskin chegara bo'lmasligi uchun 40% da to'yinadi.
  static LinearGradient get bottomScrim => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        // TO'RT TO'XTAM — IKKITA EMAS.
        //
        // Ikki to'xtamda shaffoflik TEKIS o'sadi va ko'z uning
        // boshlanish chizig'ini ilg'aydi: rasm ustida yupqa "chegara"
        // bo'lib ko'rinadi. Yumshoq egri (sekin boshlanib, o'rtada
        // tezlashib, oxirida yana sekinlashadi) bunday chiziq
        // qoldirmaydi — o'tish sezilmaydi, matn esa baribir o'qiladi.
        colors: [
          _p.baseBottom.withValues(alpha: 0),
          _p.baseBottom.withValues(alpha: .18),
          _p.baseBottom.withValues(alpha: .62),
          _p.baseBottom.withValues(alpha: .94),
        ],
        stops: const [0, .16, .34, .52],
      );

  /// TAB BAR foni — pastga qarab quyuqlashadi.
  ///
  /// SHAFFOFMAS: panel ostidan o'tayotgan kontent panel ICHIDA
  /// ko'rinib qolmasligi kerak. Yumshoq o'tish esa panel ustidagi
  /// alohida scrim bilan beriladi (`nav_bar.dart`).
  static LinearGradient get navBar => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [_p.baseMid, _p.baseBottom],
      );

  /// YORUG'LIK CHIZIG'I — metall yuzadan o'tuvchi aks. Bu HAR DOIM
  /// oq: u metall yuzadan qaytayotgan yorug'lik, palitra emas.
  static const LinearGradient sweep = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [Color(0x00FFFFFF), Color(0x9EFFFFFF), Color(0x00FFFFFF)],
    stops: [0, .5, 1],
  );

  // ─────────────────────────────────────────────────────────
  // SOYALAR
  // ─────────────────────────────────────────────────────────

  // SOYA PALITRAGA BOG'LIQ — FAQAT RANGI EMAS, SHAKLI HAM.
  //
  // To'q fonda soya quyuq va yig'ilgan bo'lishi kerak, aks holda
  // ko'rinmaydi. Yorug' fonda esa AYNAN O'SHA soya kartaning
  // ostidagi "kulrang plita" bo'lib chiqadi: siljishi katta,
  // yoyilishi kichik — ko'z uning chetini ilg'aydi.
  //
  // Shuning uchun yorug'da uchta narsa birdan o'zgaradi:
  //   • shaffoflik uch baravar kamayadi,
  //   • yoyilish (blur) ikki baravar oshadi,
  //   • siljish (offset) yarmiga tushadi.
  // Natija: chekkasi yo'q, faqat yumshoq "havo" — karta suzib
  // turgandek ko'rinadi.
  static Color _sh(double darkAlpha, double lightAlpha) => _p.light
      ? const Color(0xFF2B3440).withValues(alpha: lightAlpha)
      : const Color(0xFF000000).withValues(alpha: darkAlpha);

  static BoxShadow _lift({
    required double darkAlpha,
    required double lightAlpha,
    required double blur,
    required double dy,
    double spread = 0,
  }) =>
      BoxShadow(
        color: _sh(darkAlpha, lightAlpha),
        blurRadius: _p.light ? blur * 2 : blur,
        spreadRadius: _p.light ? spread - 2 : spread,
        offset: Offset(0, _p.light ? dy * .5 : dy),
      );

  /// e1 — tile, chip. Yengil ko'tarilish.
  static List<BoxShadow> get e1 =>
      [_lift(darkAlpha: .25, lightAlpha: .05, blur: 12, dy: 4)];

  /// e2 — karta. Kontentni fondan ajratadi.
  static List<BoxShadow> get e2 =>
      [_lift(darkAlpha: .35, lightAlpha: .07, blur: 22, dy: 10)];

  /// e3 — yopishgan panel, FAB.
  static List<BoxShadow> get e3 =>
      [_lift(darkAlpha: .45, lightAlpha: .10, blur: 34, dy: 16)];

  /// Sheet — yuqoriga qaragan soya.
  static List<BoxShadow> get sheetShadow => [
        BoxShadow(
          color: _sh(.55, .12),
          blurRadius: _p.light ? 60 : 40,
          offset: Offset(0, _p.light ? -8 : -14),
        ),
      ];

  /// METALL KARTA SOYASI — issiq. Ostida qora soya, atrofida oltin
  /// nur. Ikkisi birga karta "yorug'lik sochayotgandek" ko'rinadi.
  static List<BoxShadow> get metalShadow => [
        // Karta OG'IR jism: soyasi boshqa yuzalarnikidan kuchliroq.
        // Lekin yorug' fonda u ham yoyiladi — aks holda kartaning
        // ostida quyuq plita ko'rinadi.
        BoxShadow(
          color: _sh(.85, .20),
          blurRadius: _p.light ? 72 : 44,
          spreadRadius: _p.light ? -26 : -20,
          offset: Offset(0, _p.light ? 16 : 26),
        ),
        // Atrofdagi nur — yorug' fonda kuchsizroq, aks holda karta
        // atrofida rangli halqa bo'lib qoladi.
        BoxShadow(
          color: _p.accent.withValues(alpha: _p.light ? .18 : .40),
          blurRadius: 30,
          spreadRadius: -8,
        ),
      ];

  /// Asosiy tugma ostidagi issiq nur.
  static List<BoxShadow> get actionGlow => [
        BoxShadow(
          color: _p.accent.withValues(alpha: _p.light ? .34 : .58),
          blurRadius: 24,
          spreadRadius: -10,
          offset: const Offset(0, 12),
        ),
      ];

  /// RIM-GLOW — kartaning oltin qirrasi. Saytdan kelgan imzo
  /// effekti: `0 0 18px -6px`.
  static List<BoxShadow> get rimGlow => [
        BoxShadow(
          color: _p.accent.withValues(alpha: .34),
          blurRadius: 18,
          spreadRadius: -6,
        ),
      ];
}

// ─────────────────────────────────────────────────────────────
// TARIF MATERIALLARI — MAVZUGA BOG'LIQ EMAS
// ─────────────────────────────────────────────────────────────

/// Tarif darajalari. Bu mahsulot darajasi — bezak emas.
///
/// `free` — ro'yxatdan o'tganda beriladigan 8 xonali kod. Uning
/// materiali YO'Q: katalogda punktir chegara bilan ko'rsatiladi.
enum Tier { free, bronze, silver, gold, premium, exclusive }

/// Tarif materiali — metall.
///
/// Har material to'rt to'xtash nuqtali 130° gradient: quyuq qirra →
/// yorug' aks → to'yingan asosiy rang → quyuq past. Bu naqsh
/// haqiqiy metallning yorug'lik ostidagi ko'rinishi: yorug'lik
/// bitta chiziqda to'planadi, qolgan joyda so'nadi.
@immutable
class TierStyle {
  const TierStyle({
    required this.label,
    required this.base,
    required this.dark,
    required this.light,
    required this.mid,
    required this.edge,
    required this.face,
    this.doubleEdge = false,
    this.hasMaterial = true,
  });

  /// Katalogdagi nom.
  final String label;

  /// Token jadvalidagi HEX (ko'rsatiladi: "#F0C419 · Pure Gold").
  final Color base;

  /// Gradient nuqtalari.
  final Color dark;
  final Color light;
  final Color mid;

  /// Qirra chizig'i.
  final Color edge;

  /// KATTA YUZA UCHUN YETTI TO'XTASH NUQTA.
  ///
  /// Haqiqiy metallda yorug'lik bir tekis tarqalmaydi. Naqsh doim
  /// bir xil: quyuq burchak → yorug' yoy → eng yorug' band →
  /// to'yingan rang → quyuq bel → ikkinchi yorug' → quyuq qirra.
  /// Ikki nuqtali gradient "plastmassa" bo'lib ko'rinadi, shuning
  /// uchun qiymatlar maketdan aynan ko'chirilgan.
  final List<Color> face;

  /// Ekslyuziv — ikki qavatli qirra.
  final bool doubleEdge;

  /// Bepul 8 xonali kodda material yo'q.
  final bool hasMaterial;

  static const List<double> _faceStops = [0, .18, .32, .46, .62, .82, 1];

  /// Katta metall yuza — karta, katalog qatori.
  LinearGradient get surface => LinearGradient(
        begin: const Alignment(-.9, -1),
        end: const Alignment(.9, 1),
        colors: face,
        stops: _faceStops,
      );

  /// Kichik namuna (chip, nuqta, mini karta) uchun ixchamroq
  /// gradient — to'rt nuqta yetarli, kichik yuzada ettitasi
  /// "chiziqli" bo'lib ko'rinadi.
  LinearGradient get swatch => LinearGradient(
        begin: const Alignment(-.9, -1),
        end: const Alignment(.9, 1),
        colors: [dark, light, mid, dark],
        stops: const [0, .34, .62, 1],
      );

  /// Ekslyuzivning aylanma qirrasi — ikki qavatli metall.
  SweepGradient get rim => SweepGradient(
        colors: [base, light, base, dark, base],
        stops: const [0, .25, .5, .75, 1],
      );

  static const Map<Tier, TierStyle> map = {
    Tier.free: TierStyle(
      label: 'Bepul',
      base: Color(0xFF5F5A55),
      dark: Color(0xFF232019),
      light: Color(0xFF3A362E),
      mid: Color(0xFF2A2620),
      edge: Color(0xFF5F5A55),
      face: [
        Color(0xFF1C1915),
        Color(0xFF2A2620),
        Color(0xFF322D26),
        Color(0xFF2A2620),
        Color(0xFF1F1C17),
        Color(0xFF2A2620),
        Color(0xFF1C1915),
      ],
      hasMaterial: false,
    ),
    Tier.bronze: TierStyle(
      label: 'Bronza',
      base: Color(0xFFC58A55),
      dark: Color(0xFF8A5A2E),
      light: Color(0xFFE2AE80),
      mid: Color(0xFFC58A55),
      edge: Color(0xFF94643A),
      face: [
        Color(0xFF63401D),
        Color(0xFFCE9668),
        Color(0xFFEFC59B),
        Color(0xFFC58A55),
        Color(0xFF7A4E27),
        Color(0xFFD9A377),
        Color(0xFF94643A),
      ],
    ),
    Tier.silver: TierStyle(
      label: 'Silver',
      base: Color(0xFF9AA3AD),
      dark: Color(0xFF6E747C),
      light: Color(0xFFE3E8ED),
      mid: Color(0xFF9AA3AD),
      edge: Color(0xFF7C838C),
      face: [
        Color(0xFF474C53),
        Color(0xFFBEC6CE),
        Color(0xFFEFF3F7),
        Color(0xFFA8B1BA),
        Color(0xFF5E646C),
        Color(0xFFCBD2D9),
        Color(0xFF7C838C),
      ],
    ),
    Tier.gold: TierStyle(
      label: 'Gold',
      base: Color(0xFFF0C419),
      dark: Color(0xFFA87B1C),
      light: Color(0xFFFFF3C6),
      mid: Color(0xFFF0C419),
      edge: Color(0xFFC1912A),
      // Maketdan aynan: 128° · 7 nuqta.
      face: [
        Color(0xFF8E6A16),
        Color(0xFFF3D585),
        Color(0xFFFFF3C6),
        Color(0xFFE2B845),
        Color(0xFFA87B1C),
        Color(0xFFF0D089),
        Color(0xFFC1912A),
      ],
    ),
    Tier.premium: TierStyle(
      label: 'Premium',
      base: Color(0xFFD8A34A),
      dark: Color(0xFF96701E),
      light: Color(0xFFF6E0A8),
      mid: Color(0xFFD8A34A),
      edge: Color(0xFFA37B26),
      face: [
        Color(0xFF775714),
        Color(0xFFE9CF95),
        Color(0xFFF6E0A8),
        Color(0xFFD8A34A),
        Color(0xFF8A661B),
        Color(0xFFE4C78A),
        Color(0xFFA37B26),
      ],
    ),
    Tier.exclusive: TierStyle(
      label: 'Ekslyuziv',
      base: Color(0xFFD4AF37),
      dark: Color(0xFF8C6E1C),
      light: Color(0xFFFFF3C6),
      mid: Color(0xFFD4AF37),
      edge: Color(0xFFB08A2A),
      // Titanium Gold — Gold'dan sezilarli QUYUQROQ va og'irroq.
      // Ekslyuziv eng yuqori daraja: u yorqinligi bilan emas,
      // chuqurligi bilan ajralib turishi kerak.
      face: [
        Color(0xFF473609),
        Color(0xFFC6A954),
        Color(0xFFF2DFA0),
        Color(0xFFBE982C),
        Color(0xFF624C10),
        Color(0xFFD3B96B),
        Color(0xFF8F6E1E),
      ],
      doubleEdge: true,
    ),
  };

  static TierStyle of(Tier t) => map[t]!;

  /// Serverdan kelgan satrni tarifga aylantiradi.
  ///
  /// DIQQAT: server `'free'` deganda ikki xil narsa bo'lishi mumkin
  /// — 8 xonali bepul kod yoki Bronza (49 000). Farqni KOD SHAKLI
  /// hal qiladi va u `Record.tier` da qilingan; bu yerda satr
  /// qanday kelsa shunday o'giriladi.
  static Tier parse(String? raw) {
    switch ((raw ?? '').trim().toLowerCase()) {
      case 'exclusive':
      case 'ekslyuziv':
        return Tier.exclusive;
      case 'premium':
        return Tier.premium;
      case 'gold':
        return Tier.gold;
      case 'silver':
        return Tier.silver;
      case 'bronze':
      case 'bronza':
        return Tier.bronze;
      default:
        return Tier.free;
    }
  }

  /// Taqqoslash uchun daraja (katalogni saralashda).
  static int rank(Tier t) => Tier.values.indexOf(t);
}

// ─────────────────────────────────────────────────────────────
// MASOFA · RADIUS · HARAKAT
// ─────────────────────────────────────────────────────────────

/// Masofa shkalasi. Oraliq qiymat ishlatilmaydi — shkaladan
/// chiqish ritmni buzadi.
class S {
  const S._();
  static const double x4 = 4;
  static const double x8 = 8;
  static const double x12 = 12;
  static const double x16 = 16;
  static const double x20 = 20;
  static const double x24 = 24;
  static const double x32 = 32;
  static const double x44 = 44;

  /// Ekran chekkasidan masofa. Dizaynda 20–22 dp; 22 tanlandi —
  /// kontent kengroq nafas oladi.
  static const double gutter = 22;

  /// Eng kichik bosish maydoni. Dizayn 48 dp ni talab qiladi va bu
  /// eski 44 minimumini ALMASHTIRADI.
  static const double tap = 48;
}

/// Radius shkalasi.
class R {
  const R._();
  static const double status = 9;
  static const double chip = 11;
  static const double tile = 14;
  static const double input = 16;
  static const double button = 16;
  static const double card = 18;
  static const double hero = 22;
  static const double sheet = 30;

  /// Metall NFC kartaning radiusi — jismoniy CR80 kartaga mos.
  static const double metalCard = 20;
}

/// HARAKAT BUDJETI.
///
/// Hech bir o'tish 400 ms dan oshmaydi (uzun sikllardan tashqari:
/// yorug'lik chizig'i va story halqasi — ular dekorativ, kutish
/// emas).
class M {
  const M._();

  /// Bosish — darhol javob.
  static const Duration press = Duration(milliseconds: 120);

  /// Xiralik.
  static const Duration fade = Duration(milliseconds: 200);

  /// Rasm paydo bo'lishi.
  static const Duration image = Duration(milliseconds: 240);

  /// Ekranlar orasidagi o'tish — 280 ms fade + 8 dp siljish.
  static const Duration push = Duration(milliseconds: 280);

  /// Sheet ochilishi.
  static const Duration sheet = Duration(milliseconds: 280);

  /// Mavzu almashishi.
  static const Duration theme = Duration(milliseconds: 420);

  /// Kartaning orqa tomoniga o'girilishi.
  static const Duration flip = Duration(milliseconds: 720);

  /// Layk — spring bilan 1 → 1.25 → 1.
  static const Duration like = Duration(milliseconds: 220);

  /// Yorug'lik chizig'ining to'liq sikli.
  static const Duration sweep = Duration(milliseconds: 4200);

  /// Story halqasining bir aylanishi.
  static const Duration ring = Duration(seconds: 9);

  /// Story bir kadrining davomiyligi.
  static const Duration storySegment = Duration(seconds: 5);

  /// NFC to'lqinining tarqalishi.
  static const Duration wave = Duration(milliseconds: 1600);

  /// Standart egri — tez boshlanadi, yumshoq to'xtaydi.
  /// cubic-bezier(.22, .7, .2, 1)
  static const Cubic curve = Cubic(.22, .7, .2, 1);

  /// Spring — chetdan bir oz oshib qaytadi. Faqat layk va tasdiq
  /// belgisi uchun.
  /// cubic-bezier(.34, 1.56, .64, 1)
  static const Cubic spring = Cubic(.34, 1.56, .64, 1);

  /// Ekran o'tishidagi siljish masofasi.
  static const double shift = 8;
}

/// HARAKATNI KAMAYTIRISH REJIMI.
///
/// Tizim sozlamalarida "animatsiyalarni kamaytirish" yoqilgan
/// bo'lsa, DOIMIY takrorlanadigan harakatlar (yorug'lik chizig'i,
/// story halqasining aylanishi, NFC to'lqini, konfetti) to'xtaydi.
/// Ekran o'tishi va bosish javobi QOLADI — ularsiz ilova buzilgandek
/// tuyuladi, ular esa qisqa va bir martalik.
bool reduceMotion(BuildContext context) =>
    MediaQuery.maybeDisableAnimationsOf(context) ?? false;
