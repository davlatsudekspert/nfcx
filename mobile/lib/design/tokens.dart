import 'package:flutter/widgets.dart';

/// NFCSTORE dizayn tokenlari — handoff README ning yagona manbasi.
///
/// Bu yerdagi qiymatlar dizayn hujjatidan AYNAN ko'chirilgan. Ekran
/// kodida "sehrli raqam" yozmang: rang yoki masofa kerak bo'lsa shu
/// yerdan oling. Aks holda bir necha oydan keyin ikkita "deyarli bir xil"
/// kulrang paydo bo'ladi va interfeys sekin-asta buziladi.
class C {
  C._();

  // ── Yuzalar ────────────────────────────────────────────────────────
  /// Ilova foni. Saytning theme-color'i bilan bir xil.
  static const obsidian = Color(0xFF0A0805);

  /// Eng chuqur yer — sheet orqasidagi scrim va kadr tashqarisi.
  static const backdrop = Color(0xFF050508);

  /// Karta asosi, input to'ldirmasi.
  static const graphite = Color(0xFF0E0D11);

  /// Karta yuqori nuqtasi, sheet, ikkilamchi tugma.
  static const slate = Color(0xFF141318);

  /// Standart chegara.
  static const hairline = Color(0xFF232028);

  /// Interaktiv/to'ldirilgan elementdagi chegara.
  static const warmHairline = Color(0xFF2A2620);

  // ── Urg'u ──────────────────────────────────────────────────────────
  /// Asosiy urg'u. EKRANDA BITTA. Ikkitadan ko'p ishlatsangiz dizayn
  /// "arzon" ko'rina boshlaydi — handoff buni alohida ta'kidlaydi.
  static const champagne = Color(0xFFE8CFA0);

  /// Eyebrow yozuvlari, meta ma'lumot, chuqur gardish.
  static const antiqueGold = Color(0xFFB99A5E);

  /// NFC tabi, tasdiqlangan nishon, ikkilamchi urg'u.
  static const platinum = Color(0xFFC9CCD2);

  // ── Matn ───────────────────────────────────────────────────────────
  static const offWhite = Color(0xFFFAF7F0);
  static const ash = Color(0xFF98918A);
  static const muted = Color(0xFF5F5A55);

  /// Champagne fon ustidagi siyoh (asosiy tugma yozuvi).
  static const ink = Color(0xFF1A1508);

  // ── Holat ──────────────────────────────────────────────────────────
  static const verdant = Color(0xFF63D694); // ochiq, muvaffaqiyat, to'langan
  static const signal = Color(0xFFE2685F); // xato, muvaffaqiyatsiz, o'qilmagan

  // ── Rasm o'rni ─────────────────────────────────────────────────────
  static const placeholder = Color(0xFF16151B);
  static const placeholderAlt = Color(0xFF101016);
  static final placeholderInk = champagne.withValues(alpha: .42);

  // ── Brend belgilari (faqat glif rangi) ─────────────────────────────
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
  static const cardSurface = LinearGradient(
    begin: Alignment(-0.18, -1), end: Alignment(0.18, 1),
    colors: [slate, graphite],
  );

  /// Metall ID kartasi — uchta to'xtash nuqtasi bor, shuning uchun
  /// alohida.
  static const metalSurface = LinearGradient(
    begin: Alignment(-1, -0.9), end: Alignment(1, 0.9),
    colors: [Color(0xFF2A2831), slate, Color(0xFF0D0C11)],
    stops: [0, .58, 1],
  );
  static const metalBorder = Color(0xFF3A3743);
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
