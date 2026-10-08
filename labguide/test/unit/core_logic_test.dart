import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/design/widgets/collapse_hysteresis.dart';
import 'package:labguide/features/learn/quiz_session.dart';
import 'package:labguide/features/content/content_model.dart';
import 'package:labguide/features/tools/calculators.dart';

void main() {
  group('CollapseHysteresis', () {
    // maxScrollExtent katta: ixchamlashgandan keyin ham scroll qilinadi.
    bool step(CollapseHysteresis h, double pixels, double delta) => h.onScroll(
      pixels: pixels,
      delta: delta,
      maxScrollExtent: 2000,
      collapsibleExtent: 120,
    );

    test('collapses only after 14 px in one direction', () {
      final h = CollapseHysteresis();
      expect(step(h, 20, 6), isFalse);
      expect(step(h, 27, 7), isFalse); // jami 13 px
      expect(h.collapsed, isFalse);
      expect(step(h, 28, 1), isTrue); // jami 14 px
      expect(h.collapsed, isTrue);
    });

    test('expands after 14 px back; small jitter does not toggle', () {
      final h = CollapseHysteresis();
      step(h, 100, 30);
      expect(h.collapsed, isTrue);
      // Tebranish: ±5 px — holat o'zgarmaydi.
      for (var i = 0; i < 10; i++) {
        step(h, 95, -5);
        step(h, 100, 5);
      }
      expect(h.collapsed, isTrue);
      step(h, 90, -10);
      expect(h.collapsed, isTrue);
      expect(step(h, 85, -5), isTrue); // jami 15 px teskari
      expect(h.collapsed, isFalse);
    });

    test('direction change resets accumulated distance', () {
      final h = CollapseHysteresis();
      step(h, 30, 10);
      step(h, 25, -5);
      expect(step(h, 35, 10), isFalse); // 10 < 14 — yangi yo'nalishda
      expect(h.collapsed, isFalse);
    });

    test('always expanded at the top', () {
      final h = CollapseHysteresis();
      step(h, 200, 40);
      expect(h.collapsed, isTrue);
      expect(
        h.onScroll(
          pixels: 0,
          delta: -2,
          maxScrollExtent: 2000,
          collapsibleExtent: 120,
        ),
        isTrue,
      );
      expect(h.collapsed, isFalse);
    });

    test('does not collapse short content (prevents oscillation)', () {
      final h = CollapseHysteresis();
      // Kontent 100 px dan oshmaydi, sarlavha 120 px: ixchamlashsa scroll
      // qilinmay qoladi — demak ixchamlashtirilmaydi.
      h.onScroll(
        pixels: 60,
        delta: 60,
        maxScrollExtent: 100,
        collapsibleExtent: 120,
      );
      expect(h.collapsed, isFalse);
    });

    test('NaN input is ignored', () {
      final h = CollapseHysteresis();
      expect(step(h, double.nan, 50), isFalse);
      expect(step(h, 50, double.nan), isFalse);
      expect(h.collapsed, isFalse);
    });

    test('threshold must stay within 12–16 px', () {
      expect(() => CollapseHysteresis(threshold: 8), throwsAssertionError);
      expect(() => CollapseHysteresis(threshold: 20), throwsAssertionError);
    });
  });

  group('parseDecimal', () {
    test('accepts dot and comma decimals, spaces as thousands', () {
      expect(parseDecimal('2.5'), 2.5);
      expect(parseDecimal('2,5'), 2.5);
      expect(parseDecimal(' 1 000,25 '), 1000.25);
      expect(parseDecimal('1e3'), 1000);
      expect(parseDecimal('.5'), 0.5);
      expect(parseDecimal('0,500'), 0.5);
      expect(parseDecimal('1,50'), 1.5);
      expect(parseDecimal('1500'), 1500);
    });

    test('“1,500” is ambiguous (1500 or 1.5) and is not guessed', () {
      for (final amb in ['1,500', '12,345', '-1,500', '1,500,000']) {
        expect(parseDecimal(amb), isNull, reason: amb);
      }
    });

    test('rejects garbage, empty, NaN and Infinity text', () {
      for (final bad in ['', ' ', 'abc', '1.2.3', 'NaN', 'Infinity', '--1']) {
        expect(parseDecimal(bad), isNull, reason: bad);
      }
    });

    test('overflowing literal parses to infinity, not NaN', () {
      expect(parseDecimal('1e400'), double.infinity);
    });
  });

  group('solveDilution (C1V1 = C2V2)', () {
    test('prototype example: 10 → 2 in 100 mL needs 20 mL stock', () {
      final r = solveDilution(
        stockConcentration: 10,
        targetConcentration: 2,
        finalVolume: 100,
      );
      expect(r.isOk, isTrue);
      expect(r.stockVolume, closeTo(20, 1e-12));
      expect(r.diluentVolume, closeTo(80, 1e-12));
    });

    test('equal concentrations: no dilution needed', () {
      final r = solveDilution(
        stockConcentration: 5,
        targetConcentration: 5,
        finalVolume: 50,
      );
      expect(r.noDilutionNeeded, isTrue);
      expect(r.stockVolume, 50);
    });

    test('zero, negative and missing values are rejected', () {
      for (final (c1, c2, v2) in [
        (0.0, 1.0, 10.0),
        (10.0, 0.0, 10.0),
        (10.0, 1.0, 0.0),
        (-10.0, 1.0, 10.0),
        (10.0, -1.0, 10.0),
        (10.0, 1.0, -10.0),
      ]) {
        final r = solveDilution(
          stockConcentration: c1,
          targetConcentration: c2,
          finalVolume: v2,
        );
        expect(r.error, DilutionError.invalidInput, reason: '$c1 $c2 $v2');
      }
      expect(
        solveDilution(
          stockConcentration: null,
          targetConcentration: 1,
          finalVolume: 1,
        ).error,
        DilutionError.invalidInput,
      );
    });

    test('NaN and infinity are out of range', () {
      expect(
        solveDilution(
          stockConcentration: double.nan,
          targetConcentration: 1,
          finalVolume: 1,
        ).error,
        DilutionError.outOfRange,
      );
      expect(
        solveDilution(
          stockConcentration: double.infinity,
          targetConcentration: 1,
          finalVolume: 1,
        ).error,
        DilutionError.outOfRange,
      );
    });

    test('target above stock is rejected', () {
      expect(
        solveDilution(
          stockConcentration: 1,
          targetConcentration: 2,
          finalVolume: 10,
        ).error,
        DilutionError.targetAboveStock,
      );
    });

    test('huge values do not overflow (ratio computed first)', () {
      final r = solveDilution(
        stockConcentration: 1e308,
        targetConcentration: 1e308,
        finalVolume: 1e308,
      );
      expect(r.isOk, isTrue);
      expect(r.stockVolume, 1e308);
    });

    test('underflow to zero is reported, not shown as 0 mL', () {
      final r = solveDilution(
        stockConcentration: 1e308,
        targetConcentration: 1e-308,
        finalVolume: 1e-10,
      );
      expect(r.error, DilutionError.outOfRange);
    });
  });

  group('convertConcentration (analyte-specific)', () {
    const glucose = 180.156;

    test('glucose 100 mg/dL ≈ 5.55 mmol/L and back', () {
      final r = convertConcentration(
        value: 100,
        from: MassUnit.mgPerDl,
        molarMass: glucose,
      );
      expect(r.value, closeTo(5.5507, 1e-4));
      final back = convertConcentration(
        value: r.value,
        from: MassUnit.mmolPerL,
        molarMass: glucose,
      );
      expect(back.value, closeTo(100, 1e-9));
    });

    test('µmol/L scale: creatinine 1 mg/dL ≈ 88.4 µmol/L and back', () {
      final r = convertConcentration(
        value: 1,
        from: MassUnit.mgPerDl,
        molarMass: 113.12,
        siPerMmol: 1000,
      );
      expect(r.value, closeTo(88.40, 0.01));
      final back = convertConcentration(
        value: r.value,
        from: MassUnit.mmolPerL,
        molarMass: 113.12,
        siPerMmol: 1000,
      );
      expect(back.value, closeTo(1, 1e-12));
      // Bilirubin: 1 mg/dL ≈ 17.1 µmol/L.
      expect(
        convertConcentration(
          value: 1,
          from: MassUnit.mgPerDl,
          molarMass: 584.673,
          siPerMmol: 1000,
        ).value,
        closeTo(17.10, 0.01),
      );
    });

    test('different molar mass gives a different factor', () {
      final creatinine = convertConcentration(
        value: 1,
        from: MassUnit.mgPerDl,
        molarMass: 113.12,
      );
      final glu = convertConcentration(
        value: 1,
        from: MassUnit.mgPerDl,
        molarMass: glucose,
      );
      expect(creatinine.value, isNot(closeTo(glu.value!, 1e-6)));
    });

    test('no molar mass → unsupported (no shared factor)', () {
      for (final m in [null, 0.0, -1.0, double.nan]) {
        expect(
          convertConcentration(
            value: 1,
            from: MassUnit.mgPerDl,
            molarMass: m,
          ).error,
          ConversionError.unsupported,
        );
      }
    });

    test('zero ok; negative, missing, NaN, overflow rejected', () {
      expect(
        convertConcentration(
          value: 0,
          from: MassUnit.mgPerDl,
          molarMass: glucose,
        ).value,
        0,
      );
      expect(
        convertConcentration(
          value: -1,
          from: MassUnit.mgPerDl,
          molarMass: glucose,
        ).error,
        ConversionError.invalidInput,
      );
      expect(
        convertConcentration(
          value: null,
          from: MassUnit.mgPerDl,
          molarMass: glucose,
        ).error,
        ConversionError.invalidInput,
      );
      expect(
        convertConcentration(
          value: double.nan,
          from: MassUnit.mgPerDl,
          molarMass: glucose,
        ).error,
        ConversionError.outOfRange,
      );
      expect(
        convertConcentration(
          value: 1e307,
          from: MassUnit.mmolPerL,
          molarMass: glucose,
        ).error,
        ConversionError.outOfRange,
      );
    });
  });

  group('QuizSession', () {
    QuizQuestion q(String id, int correct) => QuizQuestion(
      id: id,
      prompt: const LocalizedText({'en': 'Q'}),
      options: const [
        QuizOption(
          text: LocalizedText({'en': 'A'}),
          explanation: LocalizedText({'en': 'a'}),
        ),
        QuizOption(
          text: LocalizedText({'en': 'B'}),
          explanation: LocalizedText({'en': 'b'}),
        ),
      ],
      correctIndex: correct,
      basis: const LocalizedText({'en': 'basis'}),
      refs: const [],
      reviewState: ReviewState.pending,
    );

    test('score is computed from real answers only', () {
      final s = QuizSession([q('1', 0), q('2', 1), q('3', 0)]);
      s.next(); // javobsiz o'tib bo'lmaydi
      expect(s.index, 0);
      s.answer(0);
      s.answer(1); // qayta javob e'tiborsiz
      s.next();
      s.answer(0); // noto'g'ri
      s.next();
      s.answer(0);
      s.next();
      expect(s.finished, isTrue);
      expect(s.correctCount, 2);
      expect(s.mistakes.single.$1.id, '2');
      expect(s.mistakes.single.$2, 0);
    });

    test('invalid option index throws', () {
      final s = QuizSession([q('1', 0)]);
      expect(() => s.answer(5), throwsRangeError);
    });

    test('pending questions are drafts', () {
      expect(q('1', 0).isDraft, isTrue);
    });
  });
}
