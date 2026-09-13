import 'package:flutter/widgets.dart';

/// NFCSTORE dizayn tokenlari — handoff README ning yagona manbasi.
///
/// Bu yerdagi qiymatlar dizayn hujjatidan AYNAN ko'chirilgan. Ekran
/// kodida "sehrli raqam" yozmang: rang yoki masofa kerak bo'lsa shu
/// yerdan oling. Aks holda bir necha oydan keyin ikkita "deyarli bir xil"
/// kulrang paydo bo'ladi va interfeys sekin-asta buziladi.
/// RANG MAVZUSI.
///
/// To'rtta mavzu bor va ular FAQAT URG'U OILASINI va yuzalarning
/// nozik tusini almashtiradi. Nima uchun shunchalik cheklangan:
///
///  1. NFCSTORE dizayn tili — near-black ustidagi metall. Fonni
///     yashil yoki ko'k qilish uni butunlay boshqa mahsulotga
///     aylantirardi;
///  2. TARIFLAR TEGILMAYDI. Bronza bronza bo'lib qoladi, Exclusive
///     oltin qirrali bo'lib qoladi — ular mahsulot darajalari,
///     bezak emas. Mavzu almashganda tarif farqi yo'qolsa, odam
///     nima uchun ko'proq to'laganini ko'rmay qolardi;
///  3. holat ranglari (yashil/qizil) va brend belgilari ham
///     tegilmaydi — ular ma'no tashiydi.
///
/// Ya'ni mavzu ilovaning KIYIMINI almashtiradi, suyagini emas.
class Palette {
  const Palette({
    required this.id,
    required this.label,
    required this.obsidian,
    required this.backdrop,
    required this.graphite,
    required this.slate,
    required this.hairline,
    required this.warmHairline,
    required this.accent,
    required this.accentDeep,
    required this.accentCool,
    required this.ink,
  });

  /// Saqlash uchun kalit — sozlama shu satr bo'lib yoziladi.
  final String id;

  /// Sozlamalarda ko'rinadigan nom.
  final String label;

  final Color obsidian;
  final Color backdrop;
  final Color graphite;
  final Color slate;
  final Color hairline;
  final Color warmHairline;

  /// Asosiy urg'u — tugma, faol holat, karta kodi.
  final Color accent;

  /// Chuqurroq urg'u — eyebrow yozuvlari, meta.
  final Color accentDeep;

  /// Sovuq ikkilamchi urg'u — NFC, tasdiqlangan nishon.
  final Color accentCool;

  /// Urg'u foni ustidagi matn rangi.
  final Color ink;

  /// ASL — hozirgi dizayn, hech narsa o'zgarmaydi.
  static const original = Palette(
    id: 'original',
    label: 'Asl',
    obsidian: Color(0xFF0A0805),
    backdrop: Color(0xFF050508),
    graphite: Color(0xFF0E0D11),
    slate: Color(0xFF141318),
    hairline: Color(0xFF232028),
    warmHairline: Color(0xFF2A2620),
    accent: Color(0xFFE8CFA0),
    accentDeep: Color(0xFFB99A5E),
    accentCool: Color(0xFFC9CCD2),
    ink: Color(0xFF1A1508),
  );

  /// CHAMPAGNE GOLD — issiqroq va boyroq oltin.
  ///
  /// Asldan farqi: urg'u to'yingannroq, yuzalarga juda zaif issiq
  /// tus qo'shilgan. Bu "ko'proq oltin" emas — handoff aynan
  /// shundan ogohlantiradi. Farq materialning haroratida.
  static const gold = Palette(
    id: 'gold',
    label: 'Champagne Gold',
    obsidian: Color(0xFF0B0805),
    backdrop: Color(0xFF060402),
    graphite: Color(0xFF110E09),
    slate: Color(0xFF181410),
    hairline: Color(0xFF2A2318),
    warmHairline: Color(0xFF332A1B),
    accent: Color(0xFFF0D089),
    accentDeep: Color(0xFFC9A257),
    accentCool: Color(0xFFD9CFBC),
    ink: Color(0xFF1C1506),
  );

  /// EMERALD LUXURY — chuqur zumrad.
  ///
  /// Yashil TO'YINGAN emas: neon yashil qorong'i interfeysda
  /// "terminal" ko'rinadi va qimmat tuyg'usini yo'qotadi.
  static const emerald = Palette(
    id: 'emerald',
    label: 'Emerald Luxury',
    obsidian: Color(0xFF050907),
    backdrop: Color(0xFF030605),
    graphite: Color(0xFF090F0C),
    slate: Color(0xFF0F1713),
    hairline: Color(0xFF1B2A22),
    warmHairline: Color(0xFF1F332A),
    accent: Color(0xFF8FD9B4),
    accentDeep: Color(0xFF4E9E77),
    accentCool: Color(0xFFC2D8CD),
    ink: Color(0xFF061410),
  );

  /// SAPPHIRE ROYAL — qirollik safiri.
  static const sapphire = Palette(
    id: 'sapphire',
    label: 'Sapphire Royal',
    obsidian: Color(0xFF05070C),
    backdrop: Color(0xFF03040A),
    graphite: Color(0xFF090C14),
    slate: Color(0xFF10141F),
    hairline: Color(0xFF1D2536),
    warmHairline: Color(0xFF222B3F),
    accent: Color(0xFF9CC1EE),
    accentDeep: Color(0xFF5683BC),
    accentCool: Color(0xFFC6D1E2),
    ink: Color(0xFF07101C),
  );

  static const all = <Palette>[original, gold, emerald, sapphire];

  static Palette byId(String? id) =>
      all.firstWhere((p) => p.id == id, orElse: () => original);
}

/// NFCSTORE dizayn tokenlari — handoff README ning yagona manbasi.
///
/// Bu yerdagi qiymatlar dizayn hujjatidan AYNAN ko'chirilgan. Ekran
/// kodida "sehrli raqam" yozmang: rang yoki masofa kerak bo'lsa shu
/// yerdan oling. Aks holda bir necha oydan keyin ikkita "deyarli bir
/// xil" kulrang paydo bo'ladi va interfeys sekin-asta buziladi.
///
/// MAVZUGA BOG'LIQ ranglar `static get` — ular `const` EMAS. Shuning
/// uchun ularni ishlatadigan widget ham `const` bo'la olmaydi va
/// mavzu almashganda QAYTA QURILADI. Bu tasodif emas, mexanizmning
/// o'zi: `const` widget hech qachon qayta qurilmaydi va eski rangda
/// qotib qolardi.
class C {
  C._();

  static Palette _palette = Palette.original;

  /// Joriy mavzu.
  static Palette get palette => _palette;

  /// Mavzuni almashtirish. Chaqirgandan keyin ildizda `setState`
  /// qilish SHART — aks holda ekran eski rangda qoladi.
  static void apply(Palette p) => _palette = p;

  // ── Yuzalar (MAVZUGA BOG'LIQ) ──────────────────────────────────────
  /// Ilova foni.
  static Color get obsidian => _palette.obsidian;

  /// Eng chuqur yer — sheet orqasidagi scrim va kadr tashqarisi.
  static Color get backdrop => _palette.backdrop;

  /// Karta asosi, input to'ldirmasi.
  static Color get graphite => _palette.graphite;

  /// Karta yuqori nuqtasi, sheet, ikkilamchi tugma.
  static Color get slate => _palette.slate;

  /// Standart chegara.
  static Color get hairline => _palette.hairline;

  /// Interaktiv/to'ldirilgan elementdagi chegara.
  static Color get warmHairline => _palette.warmHairline;

  // ── Urg'u (MAVZUGA BOG'LIQ) ────────────────────────────────────────
  /// Asosiy urg'u. EKRANDA BITTA. Ikkitadan ko'p ishlatsangiz dizayn
  /// "arzon" ko'rina boshlaydi — handoff buni alohida ta'kidlaydi.
  static Color get champagne => _palette.accent;

  /// Eyebrow yozuvlari, meta ma'lumot, chuqur gardish.
  static Color get antiqueGold => _palette.accentDeep;

  /// NFC tabi, tasdiqlangan nishon, ikkilamchi urg'u.
  static Color get platinum => _palette.accentCool;

  /// Urg'u foni ustidagi siyoh (asosiy tugma yozuvi).
  static Color get ink => _palette.ink;

  // ── Matn (O'ZGARMAYDI) ─────────────────────────────────────────────
  //
  // Matn ranglari mavzuga bog'liq emas: ular O'QILISHI uchun
  // tanlangan, bezak uchun emas.
  static const offWhite = Color(0xFFFAF7F0);
  static const ash = Color(0xFF98918A);
  static const muted = Color(0xFF5F5A55);

  // ── Holat (O'ZGARMAYDI) ────────────────────────────────────────────
  //
  // Yashil "ochiq/to'langan", qizil "xato" degani. Mavzuga qarab
  // o'zgarsa, ma'no yo'qolardi.
  static const verdant = Color(0xFF63D694);
  static const signal = Color(0xFFE2685F);

  // ── Rasm o'rni ─────────────────────────────────────────────────────
  static Color get placeholder => _palette.graphite;
  static Color get placeholderAlt => _palette.backdrop;
  static Color get placeholderInk => champagne.withValues(alpha: .42);

  // ── Brend belgilari (faqat glif rangi, O'ZGARMAYDI) ────────────────
  static const telegram = Color(0xFF2AABEE);
  static const whatsapp = Color(0xFF25D366);
  static const facebook = Color(0xFF1877F2);
  static const payme = Color(0xFF00C1C1);
  static const click = Color(0xFF1A73E8);
  static const instagram = <Color>[
    Color(0xFFFEDA75), Color(0xFFFA7E1E), Color(0xFFD62976), Color(0xFF8134AF),
  ];

  // ── Gradientlar ────────────────────────────────────────────────────
  /// Karta yuzasi. 170° — deyarli vertikal, lekin biroz og'ishi
  /// yassi to'rtburchakni "yuza" ga aylantiradi.
  static LinearGradient get cardSurface => LinearGradient(
        begin: const Alignment(-0.18, -1),
        end: const Alignment(0.18, 1),
        colors: [slate, graphite],
      );

  /// Metall ID kartasi — tarifi yo'q joylar uchun zaxira.
  static LinearGradient get metalSurface => LinearGradient(
        begin: const Alignment(-1, -0.9),
        end: const Alignment(1, 0.9),
        colors: [slate, graphite, backdrop],
        stops: const [0, .58, 1],
      );

  static Color get metalBorder => hairline;
}

/// NFC ID tarifi. Ranglar handoff dagi "tier metals" jadvalidan:
/// har biri ochiq→to'q radial, medal effekti uchun.
enum Tier { free, bronze, silver, gold, premium, exclusive }

class TierStyle {
  const TierStyle(
    this.light,
    this.dark,
    this.label, {
    required this.accent,
    required this.edge,
    required this.surface,
    this.sheen = 0x1A,
    this.innerRule = false,
  });

  /// Medal gradientining ochiq va to'q nuqtalari.
  final Color light;
  final Color dark;
  final String label;

  /// TARIFNING YAGONA URG'U RANGI.
  ///
  /// Kod yozuvi, tarif nishoni, karta qirrasi — hammasi shundan.
  /// Ekranning QOLGAN qismi tegilmaydi: fon, matn va tugmalar
  /// dizayn tizimidagidek qoladi. Tarif — MATERIAL farqi, rang
  /// mavzusi emas.
  final Color accent;

  /// Karta chegarasi — metallning qirrasi.
  final Color edge;

  /// Karta yuzasi. Hammasi near-black: farq issiq/sovuqlikda va
  /// yorug'likning qayerdan tushishida, umumiy yorqinlikda emas.
  final LinearGradient surface;

  /// ICHKI QIRRA CHIZIG'I — "yanada nafis material".
  ///
  /// Faqat Premium va Exclusive'da. Chegara ichida yana bitta ingichka
  /// chiziq — qimmat buyumlardagi ikki qavatli qirra. Bu rang emas,
  /// ISHLOV: shuning uchun Premium Silver'dan rangi bilan emas,
  /// tugallanganligi bilan ajralib turadi.
  final bool innerRule;

  /// Bir martalik yaltirash kuchi (0x00–0xFF).
  ///
  /// Bronza — mat, "cho'tkalangan" metall, shuning uchun eng zaif.
  /// Kumush — eng toza aks ettirish. Exclusive — deyarli yo'q:
  /// eng qimmat narsa eng kam yaltiraydi.
  final int sheen;

  static const _bronzeSurface = LinearGradient(
    begin: Alignment(-1, -0.9), end: Alignment(1, 0.9),
    colors: [Color(0xFF2E2620), Color(0xFF1C1815), Color(0xFF0D0B09)],
    stops: [0, .58, 1],
  );
  static const _silverSurface = LinearGradient(
    begin: Alignment(-1, -0.9), end: Alignment(1, 0.9),
    colors: [Color(0xFF2B2E33), Color(0xFF1A1C20), Color(0xFF0C0D0F)],
    stops: [0, .58, 1],
  );
  static const _goldSurface = LinearGradient(
    begin: Alignment(-1, -0.9), end: Alignment(1, 0.9),
    colors: [Color(0xFF342B19), Color(0xFF20190F), Color(0xFF0E0A06)],
    stops: [0, .58, 1],
  );
  /// PREMIUM — PLATINA asosida, binafsha EMAS.
  ///
  /// Birinchi urinishda bu yuza va urg'u lavanda tusga ketgan edi va
  /// karta "premium" emas, "o'yinchoq" ko'rinardi. Talab aniq:
  /// platina + tiyilgan chuqur urg'u. Shuning uchun to'yinganlik
  /// deyarli nolga tushirildi — farq FAQAT sovuq-binafsha ishorasi
  /// va qirraning chuqurligida qoladi.
  static const _premiumSurface = LinearGradient(
    begin: Alignment(-1, -0.9), end: Alignment(1, 0.9),
    colors: [Color(0xFF26252F), Color(0xFF17161D), Color(0xFF08080B)],
    stops: [0, .58, 1],
  );
  /// EXCLUSIVE — deyarli qora. Boshqa tariflarda yuza ko'rinadi,
  /// bu yerda esa faqat QIRRA ko'rinadi. Shu sababli u eng qimmat
  /// ko'rinadi: material emas, uning chegarasi gapiradi.
  static const _exclusiveSurface = LinearGradient(
    begin: Alignment(-1, -0.9), end: Alignment(1, 0.9),
    colors: [Color(0xFF17150F), Color(0xFF0E0D0A), Color(0xFF060505)],
    stops: [0, .58, 1],
  );
  static const _freeSurface = LinearGradient(
    begin: Alignment(-1, -0.9), end: Alignment(1, 0.9),
    colors: [Color(0xFF2A2831), Color(0xFF1B1A20), Color(0xFF0D0C11)],
    stops: [0, .58, 1],
  );

  static const map = <Tier, TierStyle>{
    Tier.free: TierStyle(
      Color(0xFF4A4750), Color(0xFF24222A), 'Free',
      accent: Color(0xFF9A949E), edge: Color(0xFF35333C),
      surface: _freeSurface, sheen: 0x10,
    ),
    // BRONZA — issiq, mat, cho'tkalangan metall.
    Tier.bronze: TierStyle(
      Color(0xFFE0B083), Color(0xFF7D4A1E), 'Bronze',
      accent: Color(0xFFCE9A6A), edge: Color(0xFF4A3526),
      surface: _bronzeSurface, sheen: 0x14,
    ),
    // KUMUSH — sovuq, eng toza aks ettirish.
    Tier.silver: TierStyle(
      Color(0xFFEEF2F6), Color(0xFF8B949C), 'Silver',
      accent: Color(0xFFC9CCD2), edge: Color(0xFF3E434A),
      surface: _silverSurface, sheen: 0x26,
    ),
    // OLTIN — issiq champagne, nozik metall yorqinligi.
    Tier.gold: TierStyle(
      Color(0xFFF0CF7A), Color(0xFFA87C0D), 'Gold',
      accent: Color(0xFFE8CFA0), edge: Color(0xFF4E421F),
      surface: _goldSurface, sheen: 0x1E,
    ),
    // PREMIUM — platina asosida, tiyilgan chuqur urg'u.
    Tier.premium: TierStyle(
      Color(0xFFDEDCE8), Color(0xFF4A4560), 'Premium',
      accent: Color(0xFFD6D3E0), edge: Color(0xFF443F52),
      surface: _premiumSurface, sheen: 0x18, innerRule: true,
    ),
    // EXCLUSIVE — qora yuza, oltin qirra. Eng kam effekt.
    Tier.exclusive: TierStyle(
      Color(0xFFF6EAD0), Color(0xFF5A4A22), 'Exclusive',
      accent: Color(0xFFE8CFA0), edge: Color(0xFF6E5A2C),
      surface: _exclusiveSurface, sheen: 0x0C, innerRule: true,
    ),
  };

  static TierStyle of(Tier t) => map[t]!;

  /// Tarif qanchalik "yuqori" — taqqoslash uchun.
  static int rank(Tier t) => Tier.values.indexOf(t);

  static Tier parse(String? raw) {
    switch ((raw ?? '').toLowerCase()) {
      case 'bronze': return Tier.bronze;
      case 'silver': return Tier.silver;
      case 'gold': return Tier.gold;
      case 'premium': return Tier.premium;
      case 'exclusive': return Tier.exclusive;
      default: return Tier.free;
    }
  }

  /// Medal effekti: markazdan biroz yuqori-chapdagi yorug'lik manbai.
  RadialGradient get gradient => RadialGradient(
        center: const Alignment(-0.36, -0.48),
        radius: .7,
        colors: [light, dark, light],
        stops: const [0, .62, 1],
      );
}

/// Masofa shkalasi. Oraliq qiymat O'YLAB TOPMANG — shkala tashqarisidagi
/// har bir raqam ritmni buzadi.
class S {
  S._();
  static const x4 = 4.0;
  static const x8 = 8.0;
  static const x12 = 12.0;
  static const x16 = 16.0;
  static const x20 = 20.0;
  static const x24 = 24.0;
  static const x32 = 32.0;
  static const x44 = 44.0;

  /// Ekran yon chekkasi.
  static const gutter = 20.0;
}

/// Radius. Bitta element sinfiga BITTA radius; bitta karta ichida
/// ikki xil radius aralashmasin.
class R {
  R._();
  static const chip = 9.0;
  static const status = 7.0;
  static const tile = 12.0;
  static const card = 16.0;
  static const hero = 20.0;
  static const sheet = 28.0;
  static const input = 14.0;
  static const button = 14.0;
}

/// Ko'tarilish. Chuqurlik soya + 1px chegaradan keladi, YORQINLIKDAN emas.
class E {
  E._();
  static const e1 = [BoxShadow(color: Color(0x66000000), blurRadius: 12, offset: Offset(0, 4))];
  static const e2 = [BoxShadow(color: Color(0x80000000), blurRadius: 24, offset: Offset(0, 10))];
  static const e3 = [BoxShadow(color: Color(0x99000000), blurRadius: 50, offset: Offset(0, 22))];
  static const sheet = [BoxShadow(color: Color(0x99000000), blurRadius: 50, offset: Offset(0, -20))];
}

/// Harakat. Byudjet: hech narsa 400ms dan oshmaydi va ekranda bir vaqtda
/// faqat BITTA uzluksiz animatsiya bo'ladi (story halqasi).
class M {
  M._();
  static const press = Duration(milliseconds: 120);
  static const fade = Duration(milliseconds: 200);
  static const image = Duration(milliseconds: 240);
  static const push = Duration(milliseconds: 280);
  static const sheet = Duration(milliseconds: 280);
  static const shared = Duration(milliseconds: 320);
  static const storyRing = Duration(seconds: 11);
  static const storySegment = Duration(seconds: 5);

  /// Handoff dagi yagona egri chiziq.
  static const curve = Cubic(.2, .8, .25, 1);
}
