import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/tools/clinical_calculators.dart';

T ok<T>(CalcOutcome<T> o) => switch (o) {
  CalcOk(:final value) => value,
  CalcFail(:final issue, :final field) => throw TestFailure(
    'expected CalcOk, got $issue on $field',
  ),
};

CalcFail<T> fail<T>(CalcOutcome<T> o) => switch (o) {
  CalcOk() => throw TestFailure('expected CalcFail, got $o'),
  final CalcFail<T> f => f,
};

void main() {
  group('eGFR CKD-EPI 2021', () {
    // Kutilgan qiymatlar formuladan mustaqil (Python) hisoblangan.
    test('reference values (mg/dL)', () {
      final f50 = ok(
        egfrCkdEpi2021(
          creatinine: 1.0,
          unit: Units.creatMgDl,
          age: 50,
          sex: Sex.female,
        ),
      );
      expect(f50.egfr, closeTo(68.63, 0.01));
      expect(f50.category, GfrCategory.g2);

      final m60 = ok(
        egfrCkdEpi2021(
          creatinine: 1.2,
          unit: Units.creatMgDl,
          age: 60,
          sex: Sex.male,
        ),
      );
      expect(m60.egfr, closeTo(69.23, 0.01));

      // Scr/κ < 1 — α darajali tarmoq.
      final f30 = ok(
        egfrCkdEpi2021(
          creatinine: 0.6,
          unit: Units.creatMgDl,
          age: 30,
          sex: Sex.female,
        ),
      );
      expect(f30.egfr, closeTo(123.76, 0.01));
      expect(f30.category, GfrCategory.g1);

      final m80 = ok(
        egfrCkdEpi2021(
          creatinine: 4.0,
          unit: Units.creatMgDl,
          age: 80,
          sex: Sex.male,
        ),
      );
      expect(m80.egfr, closeTo(14.42, 0.01));
      expect(m80.category, GfrCategory.g5);
    });

    test('µmol/L input equals mg/dL input (88.4 µmol/L ≈ 1 mg/dL)', () {
      final si = ok(
        egfrCkdEpi2021(
          creatinine: 88.4,
          unit: Units.creatUmolL,
          age: 40,
          sex: Sex.male,
        ),
      );
      final conv = ok(
        egfrCkdEpi2021(
          creatinine: 1.0,
          unit: Units.creatMgDl,
          age: 40,
          sex: Sex.male,
        ),
      );
      expect(si.egfr, closeTo(conv.egfr, 0.01));
    });

    test('children are outside the equation validity', () {
      final f = fail(
        egfrCkdEpi2021(
          creatinine: 0.5,
          unit: Units.creatMgDl,
          age: 12,
          sex: Sex.female,
        ),
      );
      expect(f.issue, CalcIssue.outsideValidity);
      expect(f.field, CalcField.age);
    });

    test('µmol/L value typed as mg/dL is caught', () {
      final f = fail(
        egfrCkdEpi2021(
          creatinine: 88,
          unit: Units.creatMgDl,
          age: 40,
          sex: Sex.male,
        ),
      );
      expect(f.issue, CalcIssue.implausible);
      expect(f.field, CalcField.creatinine);
    });

    test('missing / zero / NaN / infinite inputs never produce a number', () {
      for (final v in [null, 0.0, -1.0, double.nan, double.infinity]) {
        expect(
          egfrCkdEpi2021(
            creatinine: v,
            unit: Units.creatMgDl,
            age: 40,
            sex: Sex.male,
          ),
          isA<CalcFail<EgfrResult>>(),
          reason: '$v',
        );
      }
      expect(
        fail(
          egfrCkdEpi2021(
            creatinine: 1,
            unit: Units.creatMgDl,
            age: 40,
            sex: null,
          ),
        ).field,
        CalcField.sex,
      );
    });

    test('KDIGO G categories use the rounded reported value', () {
      expect(GfrCategory.of(90), GfrCategory.g1);
      expect(GfrCategory.of(89.5), GfrCategory.g1);
      expect(GfrCategory.of(89.4), GfrCategory.g2);
      expect(GfrCategory.of(60), GfrCategory.g2);
      expect(GfrCategory.of(59), GfrCategory.g3a);
      expect(GfrCategory.of(45), GfrCategory.g3a);
      expect(GfrCategory.of(44), GfrCategory.g3b);
      expect(GfrCategory.of(30), GfrCategory.g3b);
      expect(GfrCategory.of(29), GfrCategory.g4);
      expect(GfrCategory.of(15), GfrCategory.g4);
      expect(GfrCategory.of(14), GfrCategory.g5);
    });
  });

  group('anion gap', () {
    test('basic, with K and albumin-corrected', () {
      final r = ok(
        anionGap(
          sodium: 140,
          chloride: 104,
          bicarbonate: 24,
          potassium: 4,
          albumin: 2.4,
          normalAlbumin: 4.4,
        ),
      );
      expect(r.gap, 12);
      expect(r.gapWithPotassium, 16);
      // Figge 1998: AG + 2.5 × (normal − observed), g/dL.
      expect(r.albuminCorrected, closeTo(12 + 2.5 * (4.4 - 2.4), 1e-9));
    });

    test('albumin correction needs the lab normal albumin', () {
      final f = fail(
        anionGap(sodium: 140, chloride: 104, bicarbonate: 24, albumin: 2.4),
      );
      expect(f.field, CalcField.normalAlbumin);
      expect(f.issue, CalcIssue.missing);
    });

    test('albumin in g/L gives the same correction', () {
      final gdl = ok(
        anionGap(
          sodium: 140,
          chloride: 104,
          bicarbonate: 24,
          albumin: 2.4,
          normalAlbumin: 4.0,
        ),
      );
      final gl = ok(
        anionGap(
          sodium: 140,
          chloride: 104,
          bicarbonate: 24,
          albumin: 24,
          normalAlbumin: 40,
          albuminUnit: Units.albGL,
        ),
      );
      expect(gl.albuminCorrected, closeTo(gdl.albuminCorrected!, 1e-9));
    });

    test('optional fields stay null; missing required field is reported', () {
      final r = ok(anionGap(sodium: 140, chloride: 104, bicarbonate: 24));
      expect(r.gapWithPotassium, isNull);
      expect(r.albuminCorrected, isNull);
      final f = fail(anionGap(sodium: 140, chloride: null, bicarbonate: 24));
      expect(f.field, CalcField.chloride);
      expect(f.issue, CalcIssue.missing);
      expect(
        fail(anionGap(sodium: 14, chloride: 104, bicarbonate: 24)).issue,
        CalcIssue.implausible,
      );
    });
  });

  group('corrected calcium (Payne 1973)', () {
    test('mg/dL: Ca − albumin + 4.0', () {
      expect(
        ok(
          correctedCalciumPayne(
            calcium: 8.0,
            calciumUnit: Units.caMgDl,
            albumin: 3.0,
            albuminUnit: Units.albGDl,
          ),
        ),
        closeTo(9.0, 1e-9),
      );
    });

    test('SI input converts through the molar mass and back', () {
      final r = ok(
        correctedCalciumPayne(
          calcium: 2.0,
          calciumUnit: Units.caMmolL,
          albumin: 30,
          albuminUnit: Units.albGL,
        ),
      );
      expect(r, closeTo(2.2495, 0.0001));
    });

    test('albumin of 4.0 g/dL leaves calcium unchanged', () {
      expect(
        ok(
          correctedCalciumPayne(
            calcium: 9.4,
            calciumUnit: Units.caMgDl,
            albumin: 4.0,
            albuminUnit: Units.albGDl,
          ),
        ),
        closeTo(9.4, 1e-9),
      );
    });

    test('mmol/L value typed as mg/dL is caught', () {
      // 2.2 mmol/L ni mg/dL deb kiritish — 2 mg/dL chegarasidan past emas,
      // lekin 0.5 mmol/L ni mg/dL deb kiritish ushlanadi.
      expect(
        fail(
          correctedCalciumPayne(
            calcium: 0.5,
            calciumUnit: Units.caMgDl,
            albumin: 4,
            albuminUnit: Units.albGDl,
          ),
        ).issue,
        CalcIssue.implausible,
      );
    });
  });

  group('LDL-C and non-HDL', () {
    test('mg/dL reference values', () {
      final r = ok(
        ldlCholesterol(
          totalCholesterol: 200,
          hdl: 50,
          triglycerides: 150,
          cholesterolUnit: Units.lipidMgDl,
          tgUnit: Units.lipidMgDl,
        ),
      );
      expect(r.nonHdl, 150);
      expect(ok(r.friedewald), closeTo(120, 1e-9));
      expect(ok(r.sampson), closeTo(123.397, 0.001));
    });

    test('mmol/L inputs: computed in mg/dL, returned in mmol/L', () {
      final r = ok(
        ldlCholesterol(
          totalCholesterol: 5.2,
          hdl: 1.3,
          triglycerides: 1.7,
          cholesterolUnit: Units.cholMmolL,
          tgUnit: Units.tgMmolL,
        ),
      );
      expect(r.nonHdl, closeTo(3.9, 1e-9));
      expect(ok(r.friedewald), closeTo(3.1214, 0.0001));
      expect(ok(r.sampson), closeTo(3.2095, 0.0001));
    });

    test('Friedewald is withheld above TG 400 mg/dL; Sampson up to 800', () {
      final r = ok(
        ldlCholesterol(
          totalCholesterol: 260,
          hdl: 40,
          triglycerides: 500,
          cholesterolUnit: Units.lipidMgDl,
          tgUnit: Units.lipidMgDl,
        ),
      );
      final f = fail(r.friedewald);
      expect(f.issue, CalcIssue.outsideValidity);
      expect(f.limit!.max, 400);
      expect(r.sampson, isA<CalcOk<double>>());

      final high = ok(
        ldlCholesterol(
          totalCholesterol: 300,
          hdl: 40,
          triglycerides: 900,
          cholesterolUnit: Units.lipidMgDl,
          tgUnit: Units.lipidMgDl,
        ),
      );
      expect(fail(high.sampson).issue, CalcIssue.outsideValidity);
      // non-HDL TG dan qat'i nazar hisoblanadi.
      expect(high.nonHdl, 260);
    });

    test('TG limit is reported in the unit the user entered', () {
      final r = ok(
        ldlCholesterol(
          totalCholesterol: 7,
          hdl: 1,
          triglycerides: 5,
          cholesterolUnit: Units.cholMmolL,
          tgUnit: Units.tgMmolL,
        ),
      );
      expect(fail(r.friedewald).limit!.max, closeTo(4.52, 0.01));
    });

    test('HDL ≥ total cholesterol is inconsistent', () {
      expect(
        fail(
          ldlCholesterol(
            totalCholesterol: 100,
            hdl: 120,
            triglycerides: 100,
            cholesterolUnit: Units.lipidMgDl,
            tgUnit: Units.lipidMgDl,
          ),
        ).issue,
        CalcIssue.inconsistent,
      );
    });

    test('a non-positive LDL is not shown as a result', () {
      final r = ok(
        ldlCholesterol(
          totalCholesterol: 100,
          hdl: 90,
          triglycerides: 300,
          cholesterolUnit: Units.lipidMgDl,
          tgUnit: Units.lipidMgDl,
        ),
      );
      expect(fail(r.friedewald).issue, CalcIssue.inconsistent);
    });
  });

  group('calculated osmolality', () {
    test('SI: 2·Na + glucose + urea', () {
      final r = ok(
        calculatedOsmolality(
          sodium: 140,
          glucose: 5,
          glucoseUnit: Units.glucoseMmolL,
          urea: 5,
          ureaUnit: Units.ureaMmolL,
          measured: 300,
        ),
      );
      expect(r.calculated, 290);
      expect(r.gap, 10);
    });

    test('conventional units match 2·Na + glucose/18 + BUN/2.8', () {
      final r = ok(
        calculatedOsmolality(
          sodium: 140,
          glucose: 90,
          glucoseUnit: Units.glucoseMgDl,
          urea: 14,
          ureaUnit: Units.bunMgDl,
        ),
      );
      expect(r.calculated, closeTo(140 * 2 + 90 / 18 + 14 / 2.8, 1e-9));
      expect(r.gap, isNull);
    });
  });

  group('HbA1c', () {
    test('NGSP ↔ IFCC master equation', () {
      expect(ngspFromIfcc(48), closeTo(6.543, 0.001));
      expect(ifccFromNgsp(6.5), closeTo(47.53, 0.01));
      expect(ifccFromNgsp(ngspFromIfcc(53)), closeTo(53, 1e-9));
    });

    test('eAG matches ADAG table 2', () {
      for (final (a1c, mg, mmol) in [
        (5.0, 97.0, 5.4),
        (6.0, 126.0, 7.0),
        (7.0, 154.0, 8.6),
        (8.0, 183.0, 10.2),
        (9.0, 212.0, 11.8),
        (10.0, 240.0, 13.4),
        (12.0, 298.0, 16.5),
      ]) {
        final r = ok(hba1c(value: a1c, unit: Units.ngsp));
        final eag = ok(r.eag);
        expect(roundHalfUp(eag.mgDl, 0), mg, reason: 'A1C $a1c');
        expect(roundHalfUp(eag.mmolL, 1), mmol, reason: 'A1C $a1c');
      }
    });

    test('IFCC input gives eAG via NGSP', () {
      final r = ok(hba1c(value: 53, unit: Units.ifcc));
      expect(r.ngsp, closeTo(7.0, 0.01));
      expect(ok(r.eag).mgDl, closeTo(28.7 * r.ngsp - 46.7, 1e-9));
    });

    test('eAG withheld outside the ADAG range; conversion still given', () {
      final r = ok(hba1c(value: 14, unit: Units.ngsp));
      expect(fail(r.eag).issue, CalcIssue.outsideValidity);
      expect(r.ifcc, closeTo(129.5, 0.1));
      expect(
        fail(hba1c(value: 48, unit: Units.ngsp)).issue,
        CalcIssue.implausible,
      );
      expect(
        fail(hba1c(value: null, unit: Units.ngsp)).issue,
        CalcIssue.missing,
      );
    });
  });

  test('roundHalfUp', () {
    expect(roundHalfUp(125.49999999999999, 0), 126);
    expect(roundHalfUp(2.25, 1), 2.3);
    // Juda katta qiymatlar int64 ga sig'maydi — o'zgarishsiz qaytadi.
    expect(roundHalfUp(1e300, 3), 1e300);
    expect(roundHalfUp(-1e20, 2), -1e20);
    expect(roundHalfUp(double.infinity, 1), double.infinity);
    expect(roundHalfUp(-2.25, 1), -2.3);
    expect(roundHalfUp(1.24, 1), 1.2);
    expect(roundHalfUp(0, 2), 0);
  });

  group('urine albumin/creatinine ratio', () {
    test('mg/g and mg/mmol from conventional units', () {
      final r = ok(
        albuminCreatinineRatio(
          albumin: 30,
          albuminUnit: Units.uAlbMgL,
          creatinine: 100,
          creatinineUnit: Units.uCreatMgDl,
        ),
      );
      expect(r.mgPerG, closeTo(30, 1e-9));
      expect(r.mgPerMmol, closeTo(3.39, 0.01));
      expect(r.categorizedInSi, isFalse);
      expect(r.category, AlbuminuriaCategory.a2);
    });

    test('SI input is categorised on mg/mmol cut-offs', () {
      final r = ok(
        albuminCreatinineRatio(
          albumin: 20,
          albuminUnit: Units.uAlbMgL,
          creatinine: 10,
          creatinineUnit: Units.uCreatMmolL,
        ),
      );
      expect(r.mgPerMmol, 2);
      expect(r.categorizedInSi, isTrue);
      expect(r.category, AlbuminuriaCategory.a1);
    });

    test('category follows the reported (rounded) value', () {
      // 29.7 mg/g → hisobotda 30 → A2 (ko'rsatilgan son va toifa mos).
      final r = ok(
        albuminCreatinineRatio(
          albumin: 29.7,
          albuminUnit: Units.uAlbMgL,
          creatinine: 100,
          creatinineUnit: Units.uCreatMgDl,
        ),
      );
      expect(r.mgPerG, closeTo(29.7, 1e-9));
      expect(r.category, AlbuminuriaCategory.a2);
    });

    test('KDIGO A boundaries', () {
      expect(albuminuriaCategory(29.9, si: false), AlbuminuriaCategory.a1);
      expect(albuminuriaCategory(30, si: false), AlbuminuriaCategory.a2);
      expect(albuminuriaCategory(300, si: false), AlbuminuriaCategory.a2);
      expect(albuminuriaCategory(300.1, si: false), AlbuminuriaCategory.a3);
      expect(albuminuriaCategory(2.9, si: true), AlbuminuriaCategory.a1);
      expect(albuminuriaCategory(3, si: true), AlbuminuriaCategory.a2);
      expect(albuminuriaCategory(30.1, si: true), AlbuminuriaCategory.a3);
    });

    test('zero albumin is valid; zero creatinine is not', () {
      expect(
        ok(
          albuminCreatinineRatio(
            albumin: 0,
            albuminUnit: Units.uAlbMgL,
            creatinine: 8,
            creatinineUnit: Units.uCreatMmolL,
          ),
        ).category,
        AlbuminuriaCategory.a1,
      );
      expect(
        fail(
          albuminCreatinineRatio(
            albumin: 10,
            albuminUnit: Units.uAlbMgL,
            creatinine: 0,
            creatinineUnit: Units.uCreatMmolL,
          ),
        ).field,
        CalcField.urineCreatinine,
      );
    });
  });
}
