/// Klinik-biokimyoviy kalkulyatorlar — faqat nashr etilgan formulalar,
/// birlamchi manbadan tekshirilgan koeffitsiyentlar bilan (manbalar
/// kontent paketida, `calc-*` id lari bilan).
///
/// Qoidalar:
/// - Formula manbadagi birliklarda hisoblanadi; SI kirish qiymatlari
///   avval moddaning molyar massasi bo'yicha o'tkaziladi (IUPAC standart
///   atom massalaridan), natija foydalanuvchi tanlagan birlikda qaytadi.
/// - Formula ishlab chiqilgan doiradan tashqarida (yosh, TG chegarasi va
///   h.k.) natija berilmaydi — `CalcIssue.outsideValidity`.
/// - Kirish qiymatlariga ilovaning o'z “qabul qilinadigan oralig'i” bor:
///   bu klinik chegara emas, birlik adashishini ushlash uchun
///   (masalan µmol/L qiymatni mg/dL deb kiritish).
/// - Hech qanday natija rang bilan “norma/patologiya” deb belgilanmaydi;
///   KDIGO toifasi faqat tasnif belgisi sifatida qaytadi.
library;

import 'dart:math' as math;

/// Hisobot uchun yaxlitlash (yarmi yuqoriga). Ikkilik suzuvchi nuqta
/// xatosini (28.7 × 6 − 46.7 = 125.4999…) tuzatadi, shunda natija manba
/// jadvalidagi qiymat bilan bir xil chiqadi (ADAG: A1C 6 % → 126 mg/dL).
///
/// `roundToDouble` — butun songa (int64) o'girmaydi, shuning uchun juda
/// katta qiymatlarda ham to'g'ri; cheksiz/NaN o'zgarishsiz qaytadi.
double roundHalfUp(double v, int decimals) {
  if (!v.isFinite) return v;
  final f = math.pow(10, decimals).toDouble();
  final scaled = v * f;
  // 2^52 dan katta sonlarda kasr qism yo'q — yaxlitlash kerak emas.
  if (!scaled.isFinite || scaled.abs() >= 4503599627370496) return v;
  final nudge = scaled.abs() * 1e-12 + 1e-9;
  return (scaled >= 0 ? (scaled + nudge) : (scaled - nudge)).roundToDouble() /
      f;
}

/// Kalkulyator maydonlari — UI xato xabarini aynan qaysi maydonga
/// tegishli ekanini ko'rsatishi uchun.
enum CalcField {
  creatinine,
  age,
  sex,
  sodium,
  chloride,
  bicarbonate,
  potassium,
  albumin,
  normalAlbumin,
  calcium,
  totalCholesterol,
  hdl,
  triglycerides,
  glucose,
  urea,
  measuredOsmolality,
  hba1c,
  urineAlbumin,
  urineCreatinine,
}

enum CalcIssue {
  /// Maydon bo'sh yoki son emas.
  missing,

  /// Ilova qabul qiladigan oraliqdan tashqarida — qiymat va birlikni
  /// tekshirish kerak.
  implausible,

  /// Formula bu holat uchun ishlab chiqilmagan (manbadagi cheklov).
  outsideValidity,

  /// Qiymatlar o'zaro mos emas (masalan HDL ≥ umumiy xolesterin).
  inconsistent,
}

sealed class CalcOutcome<T> {
  const CalcOutcome();
}

final class CalcOk<T> extends CalcOutcome<T> {
  const CalcOk(this.value);
  final T value;
}

final class CalcFail<T> extends CalcOutcome<T> {
  const CalcFail(this.issue, {this.field, this.limit});
  final CalcIssue issue;
  final CalcField? field;

  /// [CalcIssue.implausible] / [CalcIssue.outsideValidity] uchun:
  /// qabul qilinadigan oraliq (kiritilgan birlikda).
  final ValueRange? limit;
}

class ValueRange {
  const ValueRange(this.min, this.max);
  final double min;
  final double max;

  bool contains(double v) => v >= min && v <= max;

  ValueRange scaled(double factor) => ValueRange(min / factor, max / factor);
}

/// O'lchov birligi: [toCanonical] — kiritilgan qiymatni formula
/// birligiga o'tkazish ko'paytuvchisi.
class LabUnit {
  const LabUnit(this.label, this.toCanonical);
  final String label;
  final double toCanonical;

  @override
  String toString() => label;
}

/// Molyar massalar (g/mol), IUPAC qisqartirilgan standart atom
/// massalaridan: C 12.011, H 1.008, N 14.007, O 15.999, Ca 40.078.
/// Osmolyallikdagi glyukoza/18 va BUN/2.8 esa manbadagidek qoldirilgan.
abstract final class MolarMass {
  /// C₄H₇N₃O
  static const creatinine = 113.12;

  /// C₂₇H₄₆O
  static const cholesterol = 386.66;

  /// Triolein C₅₇H₁₀₄O₆ — triglitseridlar uchun an'anaviy model modda.
  static const triolein = 885.45;

  static const calcium = 40.078;
}

abstract final class Units {
  // Kreatinin — formula birligi mg/dL.
  static const creatMgDl = LabUnit('mg/dL', 1);
  static const creatUmolL = LabUnit('µmol/L', MolarMass.creatinine / 10000);

  // Lipidlar — formula birligi mg/dL.
  static const lipidMgDl = LabUnit('mg/dL', 1);
  static const cholMmolL = LabUnit('mmol/L', MolarMass.cholesterol / 10);
  static const tgMmolL = LabUnit('mmol/L', MolarMass.triolein / 10);

  // Albumin — formula birligi g/dL.
  static const albGDl = LabUnit('g/dL', 1);
  static const albGL = LabUnit('g/L', 0.1);

  // Kalsiy — formula birligi mg/dL.
  static const caMgDl = LabUnit('mg/dL', 1);
  static const caMmolL = LabUnit('mmol/L', MolarMass.calcium / 10);

  // Osmolyallik — hisob mmol/L da.
  // mg/dL bo'luvchilari manbadagidek: glyukoza/18, BUN/2.8 (Rasouli 2016).
  static const glucoseMmolL = LabUnit('mmol/L', 1);
  static const glucoseMgDl = LabUnit('mg/dL', 1 / 18);
  static const ureaMmolL = LabUnit('mmol/L', 1);
  static const bunMgDl = LabUnit('mg/dL (BUN)', 1 / 2.8);

  // HbA1c
  static const ngsp = LabUnit('%', 1);
  static const ifcc = LabUnit('mmol/mol', 1);

  // Siydik: albumin mg/L, kreatinin mmol/L (hisob shu birliklarda).
  static const uAlbMgL = LabUnit('mg/L', 1);
  static const uAlbMgDl = LabUnit('mg/dL', 10);
  static const uCreatMmolL = LabUnit('mmol/L', 1);
  static const uCreatMgDl = LabUnit('mg/dL', 10 / MolarMass.creatinine);
}

/// Birlik chalkashligiga shubha: qiymat tanlangan birlikda kam uchraydi,
/// boshqa birlikda esa odatiy (masalan glyukoza 90 “mmol/L” — aslida mg/dL).
/// Hisob to'xtatilmaydi, faqat “birlikni tekshiring” eslatmasi uchun.
/// Chegaralar klinik me'yor emas — faqat kiritishdagi xatoni tutish uchun.
bool unitLooksSwapped(CalcField field, LabUnit unit, double value) =>
    switch ((field, unit.label)) {
      (CalcField.creatinine, 'µmol/L') => value < 15,
      (CalcField.creatinine, 'mg/dL') => value > 20,
      (CalcField.glucose, 'mmol/L') => value > 50,
      (CalcField.glucose, 'mg/dL') => value < 10,
      (CalcField.calcium, 'mmol/L') => value > 4.5,
      (CalcField.calcium, 'mg/dL') => value < 4.5,
      (CalcField.albumin, 'g/L') => value < 10,
      (CalcField.totalCholesterol, 'mmol/L') => value > 25,
      (CalcField.totalCholesterol, 'mg/dL') => value < 40,
      (CalcField.urineCreatinine, 'mmol/L') => value > 50,
      (CalcField.urineCreatinine, 'mg/dL') => value < 5,
      (CalcField.hba1c, '%') => value > 15,
      (CalcField.hba1c, 'mmol/mol') => value < 15,
      _ => false,
    };

/// Qiymatni tekshirish: `null` → missing; chekli emas yoki [range] dan
/// tashqarida → implausible ([range] formula birligida).
CalcFail<T>? _guard<T>(
  CalcField field,
  double? value,
  LabUnit unit,
  ValueRange range,
) {
  if (value == null) return CalcFail(CalcIssue.missing, field: field);
  final canonical = value * unit.toCanonical;
  if (!value.isFinite || !canonical.isFinite || !range.contains(canonical)) {
    return CalcFail(
      CalcIssue.implausible,
      field: field,
      limit: range.scaled(unit.toCanonical),
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// eGFR — CKD-EPI 2021 (kreatinin, irqsiz). Inker LA va boshq., N Engl J Med
// 2021;385:1737–49. doi:10.1056/NEJMoa2102953
// ---------------------------------------------------------------------------

enum Sex { female, male }

enum GfrCategory {
  g1('G1'),
  g2('G2'),
  g3a('G3a'),
  g3b('G3b'),
  g4('G4'),
  g5('G5');

  const GfrCategory(this.code);
  final String code;

  /// KDIGO 2012 GFR toifalari (mL/min/1.73 m²). Hisobot qiymati butun
  /// songa yaxlitlanadi, toifa shu butun son bo'yicha.
  static GfrCategory of(double egfr) {
    final v = egfr.round();
    if (v >= 90) return g1;
    if (v >= 60) return g2;
    if (v >= 45) return g3a;
    if (v >= 30) return g3b;
    if (v >= 15) return g4;
    return g5;
  }
}

class EgfrResult {
  const EgfrResult(this.egfr, this.category);

  /// mL/min/1.73 m²
  final double egfr;
  final GfrCategory category;
}

abstract final class EgfrLimits {
  /// Formula kattalar uchun ishlab chiqilgan.
  static const minAge = 18.0;
  static const age = ValueRange(18, 120);
  static const creatinineMgDl = ValueRange(0.1, 30);
}

CalcOutcome<EgfrResult> egfrCkdEpi2021({
  required double? creatinine,
  required LabUnit unit,
  required double? age,
  required Sex? sex,
}) {
  final bad = _guard<EgfrResult>(
    CalcField.creatinine,
    creatinine,
    unit,
    EgfrLimits.creatinineMgDl,
  );
  if (bad != null) return bad;
  if (age == null || !age.isFinite) {
    return const CalcFail(CalcIssue.missing, field: CalcField.age);
  }
  if (age <= 0) {
    return const CalcFail(
      CalcIssue.implausible,
      field: CalcField.age,
      limit: EgfrLimits.age,
    );
  }
  if (age < EgfrLimits.minAge) {
    return const CalcFail(
      CalcIssue.outsideValidity,
      field: CalcField.age,
      limit: EgfrLimits.age,
    );
  }
  if (!EgfrLimits.age.contains(age)) {
    return const CalcFail(
      CalcIssue.implausible,
      field: CalcField.age,
      limit: EgfrLimits.age,
    );
  }
  if (sex == null) {
    return const CalcFail(CalcIssue.missing, field: CalcField.sex);
  }

  final scr = creatinine! * unit.toCanonical;
  final female = sex == Sex.female;
  final kappa = female ? 0.7 : 0.9;
  final alpha = female ? -0.241 : -0.302;
  final ratio = scr / kappa;
  var gfr =
      142 *
      math.pow(math.min(ratio, 1), alpha) *
      math.pow(math.max(ratio, 1), -1.200) *
      math.pow(0.9938, age);
  if (female) gfr *= 1.012;
  return CalcOk(EgfrResult(gfr.toDouble(), GfrCategory.of(gfr.toDouble())));
}

// ---------------------------------------------------------------------------
// Anion gap. Kraut JA, Madias NE. Clin J Am Soc Nephrol 2007;2:162–74.
// Albumin bo'yicha tuzatish: Figge J va boshq., Crit Care Med 1998;26:1807–10.
// ---------------------------------------------------------------------------

class AnionGapResult {
  const AnionGapResult({
    required this.gap,
    this.gapWithPotassium,
    this.albuminCorrected,
  });

  /// Na⁺ − (Cl⁻ + HCO₃⁻), mmol/L
  final double gap;

  /// (Na⁺ + K⁺) − (Cl⁻ + HCO₃⁻), mmol/L — K kiritilgan bo'lsa (`null` —
  /// kiritilmagan). Ixtiyoriy maydon xatosi faqat shu qatorga tegishli.
  final CalcOutcome<double>? gapWithPotassium;

  /// Albumin bo'yicha tuzatilgan (K siz) — albumin yoki “normal albumin”
  /// kiritilgan bo'lsa (`null` — ikkalasi ham bo'sh). Biri yetishmasa yoki
  /// noto'g'ri bo'lsa — faqat shu qatorda xato, asosiy AG baribir chiqadi.
  final CalcOutcome<double>? albuminCorrected;
}

abstract final class AnionGapLimits {
  static const sodium = ValueRange(100, 200);
  static const chloride = ValueRange(50, 150);
  static const bicarbonate = ValueRange(1, 60);
  static const potassium = ValueRange(1, 10);

  /// g/dL
  static const albumin = ValueRange(0.5, 7);

  /// Figge 1998: “adjusted anion gap = observed anion gap + 0.25 ×
  /// ([normal albumin] − [observed albumin]), albumin g/L; g/dL da
  /// koeffitsiyent 2.5”. “Normal albumin” qiymatini manba bermaydi — uni
  /// foydalanuvchi o'z laboratoriyasidan kiritadi (ilova to'qimaydi).
  static const albuminCoefficient = 2.5;

  /// g/dL — laboratoriyaning “normal albumin” qiymati uchun qabul oralig'i.
  static const normalAlbumin = ValueRange(2.5, 6);
}

CalcOutcome<AnionGapResult> anionGap({
  required double? sodium,
  required double? chloride,
  required double? bicarbonate,
  double? potassium,
  double? albumin,
  double? normalAlbumin,
  LabUnit albuminUnit = Units.albGDl,
}) {
  const mmol = LabUnit('mmol/L', 1);
  final bad =
      _guard<AnionGapResult>(
        CalcField.sodium,
        sodium,
        mmol,
        AnionGapLimits.sodium,
      ) ??
      _guard(CalcField.chloride, chloride, mmol, AnionGapLimits.chloride) ??
      _guard(
        CalcField.bicarbonate,
        bicarbonate,
        mmol,
        AnionGapLimits.bicarbonate,
      );
  if (bad != null) return bad;
  final gap = sodium! - (chloride! + bicarbonate!);

  CalcOutcome<double>? withK;
  if (potassium != null) {
    withK =
        _guard<double>(
          CalcField.potassium,
          potassium,
          mmol,
          AnionGapLimits.potassium,
        ) ??
        CalcOk(gap + potassium);
  }

  CalcOutcome<double>? corrected;
  if (albumin != null || normalAlbumin != null) {
    corrected =
        _guard<double>(
          CalcField.albumin,
          albumin,
          albuminUnit,
          AnionGapLimits.albumin,
        ) ??
        _guard<double>(
          CalcField.normalAlbumin,
          normalAlbumin,
          albuminUnit,
          AnionGapLimits.normalAlbumin,
        ) ??
        CalcOk(
          gap +
              AnionGapLimits.albuminCoefficient *
                  (normalAlbumin! - albumin!) *
                  albuminUnit.toCanonical,
        );
  }
  return CalcOk(
    AnionGapResult(
      gap: gap,
      gapWithPotassium: withK,
      albuminCorrected: corrected,
    ),
  );
}

// ---------------------------------------------------------------------------
// Albumin bo'yicha tuzatilgan kalsiy. Payne RB va boshq., Br Med J
// 1973;4:643–6: “Adjusted calcium = calcium − albumin + 4·0” (mg/100 ml,
// g/100 ml).
// ---------------------------------------------------------------------------

abstract final class CalciumLimits {
  /// mg/dL
  static const calcium = ValueRange(2, 20);

  /// g/dL
  static const albumin = ValueRange(0.5, 7);
}

/// Natija [calciumUnit] da qaytadi.
CalcOutcome<double> correctedCalciumPayne({
  required double? calcium,
  required LabUnit calciumUnit,
  required double? albumin,
  required LabUnit albuminUnit,
}) {
  final bad =
      _guard<double>(
        CalcField.calcium,
        calcium,
        calciumUnit,
        CalciumLimits.calcium,
      ) ??
      _guard(CalcField.albumin, albumin, albuminUnit, CalciumLimits.albumin);
  if (bad != null) return bad;
  final caMgDl = calcium! * calciumUnit.toCanonical;
  final albGDl = albumin! * albuminUnit.toCanonical;
  final adjusted = caMgDl - albGDl + 4.0;
  return CalcOk(adjusted / calciumUnit.toCanonical);
}

// ---------------------------------------------------------------------------
// LDL-xolesterin (hisoblangan) va non-HDL.
// Friedewald WT va boshq., Clin Chem 1972;18:499–502.
// Sampson M va boshq., JAMA Cardiol 2020;5:540–8.
// ---------------------------------------------------------------------------

class LipidResult {
  const LipidResult({
    required this.nonHdl,
    required this.friedewald,
    required this.sampson,
  });

  /// Kiritilgan xolesterin birligida.
  final double nonHdl;
  final CalcOutcome<double> friedewald;
  final CalcOutcome<double> sampson;
}

abstract final class LipidLimits {
  /// mg/dL
  static const totalCholesterol = ValueRange(20, 1500);
  static const hdl = ValueRange(2, 300);
  static const triglycerides = ValueRange(5, 10000);

  /// Friedewald: TG 400 mg/dL dan yuqori bo'lsa qo'llanmaydi.
  static const friedewaldMaxTg = 400.0;

  /// Sampson: TG 800 mg/dL gacha.
  static const sampsonMaxTg = 800.0;
}

/// [cholesterolUnit] — umumiy xolesterin va HDL birligi; [tgUnit] —
/// triglitseridlar birligi. LDL va non-HDL [cholesterolUnit] da qaytadi.
CalcOutcome<LipidResult> ldlCholesterol({
  required double? totalCholesterol,
  required double? hdl,
  required double? triglycerides,
  required LabUnit cholesterolUnit,
  required LabUnit tgUnit,
}) {
  final bad =
      _guard<LipidResult>(
        CalcField.totalCholesterol,
        totalCholesterol,
        cholesterolUnit,
        LipidLimits.totalCholesterol,
      ) ??
      _guard(CalcField.hdl, hdl, cholesterolUnit, LipidLimits.hdl) ??
      _guard(
        CalcField.triglycerides,
        triglycerides,
        tgUnit,
        LipidLimits.triglycerides,
      );
  if (bad != null) return bad;
  final tc = totalCholesterol! * cholesterolUnit.toCanonical;
  final h = hdl! * cholesterolUnit.toCanonical;
  final tg = triglycerides! * tgUnit.toCanonical;
  if (h >= tc) {
    return const CalcFail(CalcIssue.inconsistent, field: CalcField.hdl);
  }
  final nonHdl = tc - h;
  double back(double mgDl) => mgDl / cholesterolUnit.toCanonical;

  CalcOutcome<double> positive(double ldl) =>
      ldl > 0 ? CalcOk(back(ldl)) : const CalcFail(CalcIssue.inconsistent);

  final CalcOutcome<double> friedewald = tg > LipidLimits.friedewaldMaxTg
      ? CalcFail(
          CalcIssue.outsideValidity,
          field: CalcField.triglycerides,
          limit: const ValueRange(
            0,
            LipidLimits.friedewaldMaxTg,
          ).scaled(tgUnit.toCanonical),
        )
      : positive(tc - h - tg / 5);

  final CalcOutcome<double> sampson = tg > LipidLimits.sampsonMaxTg
      ? CalcFail(
          CalcIssue.outsideValidity,
          field: CalcField.triglycerides,
          limit: const ValueRange(
            0,
            LipidLimits.sampsonMaxTg,
          ).scaled(tgUnit.toCanonical),
        )
      : positive(
          tc / 0.948 -
              h / 0.971 -
              (tg / 8.56 + tg * nonHdl / 2140 - tg * tg / 16100) -
              9.44,
        );

  return CalcOk(
    LipidResult(nonHdl: back(nonHdl), friedewald: friedewald, sampson: sampson),
  );
}

// ---------------------------------------------------------------------------
// Hisoblangan osmolyallik. mg/dL: 2·Na + glyukoza/18 + BUN/2.8 (Rasouli M.
// Clin Biochem 2016;49:936–41); mmol/L: 2·Na + glyukoza + mochevina (Lynd LD
// va boshq. BMC Emerg Med 2008;8:5). Osmolyal farq = o'lchangan − hisoblangan.
// ---------------------------------------------------------------------------

class OsmolalityResult {
  const OsmolalityResult(this.calculated, {this.gap});

  /// mOsm/kg
  final double calculated;

  /// O'lchangan − hisoblangan, mOsm/kg (o'lchangan qiymat kiritilsa).
  final double? gap;
}

abstract final class OsmoLimits {
  static const sodium = ValueRange(100, 200);

  /// mmol/L
  static const glucose = ValueRange(0.5, 150);

  /// mmol/L (mochevina)
  static const urea = ValueRange(0.2, 150);

  /// mOsm/kg
  static const measured = ValueRange(150, 500);
}

CalcOutcome<OsmolalityResult> calculatedOsmolality({
  required double? sodium,
  required double? glucose,
  required LabUnit glucoseUnit,
  required double? urea,
  required LabUnit ureaUnit,
  double? measured,
}) {
  const mmol = LabUnit('mmol/L', 1);
  const mosm = LabUnit('mOsm/kg', 1);
  final bad =
      _guard<OsmolalityResult>(
        CalcField.sodium,
        sodium,
        mmol,
        OsmoLimits.sodium,
      ) ??
      _guard(CalcField.glucose, glucose, glucoseUnit, OsmoLimits.glucose) ??
      _guard(CalcField.urea, urea, ureaUnit, OsmoLimits.urea) ??
      (measured == null
          ? null
          : _guard(
              CalcField.measuredOsmolality,
              measured,
              mosm,
              OsmoLimits.measured,
            ));
  if (bad != null) return bad;
  final calc =
      2 * sodium! +
      glucose! * glucoseUnit.toCanonical +
      urea! * ureaUnit.toCanonical;
  return CalcOk(
    OsmolalityResult(calc, gap: measured == null ? null : measured - calc),
  );
}

// ---------------------------------------------------------------------------
// HbA1c: NGSP (%) ↔ IFCC (mmol/mol). NGSP master tenglamasi:
// NGSP = 0.09148 × IFCC + 2.152 (ngsp.org/ifcc.asp).
// eAG: Nathan DM va boshq. (ADAG), Diabetes Care 2008;31:1473–8:
// eAG (mg/dL) = 28.7 × A1C − 46.7; eAG (mmol/L) = 1.5944 × A1C − 2.594.
// ---------------------------------------------------------------------------

double ngspFromIfcc(double ifcc) => 0.09148 * ifcc + 2.152;

double ifccFromNgsp(double ngsp) => (ngsp - 2.152) / 0.09148;

class Hba1cResult {
  const Hba1cResult({
    required this.ngsp,
    required this.ifcc,
    required this.eag,
  });

  /// %
  final double ngsp;

  /// mmol/mol
  final double ifcc;

  /// ADAG eAG — A1C ADAG o'rganilgan oraliqda bo'lmasa `CalcFail`.
  final CalcOutcome<EagResult> eag;
}

class EagResult {
  const EagResult(this.mgDl, this.mmolL);
  final double mgDl;
  final double mmolL;
}

abstract final class Hba1cLimits {
  /// NGSP % — ilova qabul qiladigan oraliq.
  static const ngsp = ValueRange(3, 20);

  /// ADAG ma'lumotlari qamragan A1C oralig'i (%): regressiya va 2-jadval
  /// 4–12 % uchun.
  static const eag = ValueRange(4, 12);
}

CalcOutcome<Hba1cResult> hba1c({
  required double? value,
  required LabUnit unit,
}) {
  if (value == null || !value.isFinite) {
    return const CalcFail(CalcIssue.missing, field: CalcField.hba1c);
  }
  final ngsp = identical(unit, Units.ifcc) ? ngspFromIfcc(value) : value;
  if (!Hba1cLimits.ngsp.contains(ngsp)) {
    return CalcFail(
      CalcIssue.implausible,
      field: CalcField.hba1c,
      limit: identical(unit, Units.ifcc)
          ? ValueRange(
              ifccFromNgsp(Hba1cLimits.ngsp.min),
              ifccFromNgsp(Hba1cLimits.ngsp.max),
            )
          : Hba1cLimits.ngsp,
    );
  }
  final CalcOutcome<EagResult> eag = Hba1cLimits.eag.contains(ngsp)
      ? CalcOk(EagResult(28.7 * ngsp - 46.7, 1.5944 * ngsp - 2.594))
      : CalcFail(
          CalcIssue.outsideValidity,
          field: CalcField.hba1c,
          limit: identical(unit, Units.ifcc)
              ? ValueRange(
                  ifccFromNgsp(Hba1cLimits.eag.min),
                  ifccFromNgsp(Hba1cLimits.eag.max),
                )
              : Hba1cLimits.eag,
        );
  return CalcOk(Hba1cResult(ngsp: ngsp, ifcc: ifccFromNgsp(ngsp), eag: eag));
}

// ---------------------------------------------------------------------------
// Siydikda albumin/kreatinin nisbati (ACR) va KDIGO 2012 albuminuriya toifasi.
// ---------------------------------------------------------------------------

enum AlbuminuriaCategory {
  a1('A1'),
  a2('A2'),
  a3('A3');

  const AlbuminuriaCategory(this.code);
  final String code;
}

class AcrResult {
  const AcrResult({
    required this.mgPerG,
    required this.mgPerMmol,
    required this.category,
    required this.categorizedInSi,
  });

  final double mgPerG;
  final double mgPerMmol;
  final AlbuminuriaCategory category;

  /// Toifa mg/mmol chegaralari bo'yicha aniqlandi (kreatinin mmol/L da
  /// kiritilgan) — aks holda mg/g bo'yicha. KDIGO ikkala birlikdagi
  /// chegaralarni “taxminan teng” deb beradi, shuning uchun toifa
  /// foydalanuvchi kiritgan birlik tizimida aniqlanadi.
  final bool categorizedInSi;
}

abstract final class AcrLimits {
  /// mg/L
  static const albumin = ValueRange(0, 20000);

  /// mmol/L
  static const creatinine = ValueRange(0.1, 100);
}

AlbuminuriaCategory albuminuriaCategory(double acr, {required bool si}) {
  final (low, high) = si ? (3.0, 30.0) : (30.0, 300.0);
  if (acr < low) return AlbuminuriaCategory.a1;
  if (acr <= high) return AlbuminuriaCategory.a2;
  return AlbuminuriaCategory.a3;
}

CalcOutcome<AcrResult> albuminCreatinineRatio({
  required double? albumin,
  required LabUnit albuminUnit,
  required double? creatinine,
  required LabUnit creatinineUnit,
}) {
  final bad =
      _guard<AcrResult>(
        CalcField.urineAlbumin,
        albumin,
        albuminUnit,
        AcrLimits.albumin,
      ) ??
      _guard(
        CalcField.urineCreatinine,
        creatinine,
        creatinineUnit,
        AcrLimits.creatinine,
      );
  if (bad != null) return bad;
  final albMgL = albumin! * albuminUnit.toCanonical;
  final creatMmolL = creatinine! * creatinineUnit.toCanonical;
  final mgPerMmol = albMgL / creatMmolL;
  final creatGL = creatMmolL * MolarMass.creatinine / 1000;
  final mgPerG = albMgL / creatGL;
  final si = identical(creatinineUnit, Units.uCreatMmolL);
  // Toifa hisobotdagi (yaxlitlangan) qiymat bo'yicha: mg/mmol 0.1 gacha,
  // mg/g butun songacha — ko'rsatilgan son va toifa doim mos keladi.
  final reported = si ? roundHalfUp(mgPerMmol, 1) : roundHalfUp(mgPerG, 0);
  return CalcOk(
    AcrResult(
      mgPerG: mgPerG,
      mgPerMmol: mgPerMmol,
      category: albuminuriaCategory(reported, si: si),
      categorizedInSi: si,
    ),
  );
}
