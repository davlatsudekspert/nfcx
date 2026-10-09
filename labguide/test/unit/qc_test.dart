import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/core/storage/kv_store.dart';
import 'package:labguide/features/qc/qc_controller.dart';
import 'package:labguide/features/qc/qc_model.dart';
import 'package:labguide/features/qc/qc_rules.dart';

void main() {
  group('QcStats', () {
    test('sample mean, SD (n − 1) and CV', () {
      final s = QcStats.of([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(s.n, 8);
      expect(s.mean, 5);
      // Σ(x − x̄)² = 32 → SD = √(32/7)
      expect(s.sd, closeTo(math.sqrt(32 / 7), 1e-12));
      expect(s.cv, closeTo(math.sqrt(32 / 7) / 5 * 100, 1e-9));
    });

    test('empty and single value', () {
      expect(QcStats.of(const []).n, 0);
      final one = QcStats.of(const [3.2]);
      expect(one.mean, 3.2);
      expect(one.sd, isNull);
      expect(one.cv, isNull);
    });
  });

  group('QcController', () {
    var t = DateTime(2026, 10, 8, 9);
    DateTime clock() => t = t.add(const Duration(minutes: 1));

    Future<(QcController, MemoryKeyValueStore, QcSet)> setup() async {
      final store = MemoryKeyValueStore();
      final c = QcController(store, clock: clock, random: math.Random(1));
      final set = await c.addSet(
        name: ' Glucose ',
        unit: 'mmol/L',
        targetSource: QcTargetSource.laboratory,
        levels: [
          (label: '', lot: 'A1', mean: 5.0, sd: 0.2),
          (label: 'High', lot: 'B2', mean: 15.0, sd: 0.5),
        ],
      );
      return (c, store, set);
    }

    test('adds a set with trimmed name and default level labels', () async {
      final (_, _, set) = await setup();
      expect(set.name, 'Glucose');
      expect(set.levels.map((l) => l.label), ['1', 'High']);
      expect(set.levels.first.z(5.4), closeTo(2, 1e-12));
    });

    test('runs are persisted, sorted by time and survive restart', () async {
      final (c, store, set) = await setup();
      await c.addRun(set.id, {'L1': 5.1, 'L2': 15.2});
      await c.addRun(
        set.id,
        {'L1': 4.9},
        at: DateTime(2026, 10, 1),
        note: '  ',
      );
      final reopened = QcController(store);
      final runs = reopened.data.runsOf(set.id);
      expect(runs, hasLength(2));
      expect(runs.first.at, DateTime(2026, 10, 1)); // vaqt bo'yicha
      expect(runs.first.note, isNull); // bo'sh izoh saqlanmaydi
      expect(reopened.data.set(set.id)!.levels.last.lot, 'B2');
    });

    test('invalid input is rejected, nothing is saved', () async {
      final (c, _, set) = await setup();
      await expectLater(
        c.addSet(
          name: 'X',
          unit: '',
          targetSource: QcTargetSource.manufacturer,
          levels: [(label: '1', lot: '', mean: 1, sd: 0)],
        ),
        throwsArgumentError,
      );
      await expectLater(c.addRun(set.id, const {}), throwsArgumentError);
      await expectLater(
        c.addRun(set.id, {'L1': double.nan}),
        throwsArgumentError,
      );
      await expectLater(c.addRun(set.id, {'L9': 1}), throwsArgumentError);
      expect(c.data.sets, hasLength(1));
      expect(c.data.runsOf(set.id), isEmpty);
    });

    test(
      'target change keeps history; past runs keep their own target',
      () async {
        final (c, store, set) = await setup();
        final early = await c.addRun(set.id, {'L1': 5.3}); // z = +1.5 (5.0/0.2)
        await c.changeTarget(set.id, 'L1', lot: 'A2', mean: 5.4, sd: 0.1);
        final late = await c.addRun(set.id, {'L1': 5.3}); // z = −1.0 (5.4/0.1)
        final reopened = QcController(store);
        final level = reopened.data.set(set.id)!.level('L1')!;
        expect(level.lot, 'A2');
        expect(level.previous.single.lot, 'A1');
        expect(level.targetAt(early.at).mean, 5.0);
        expect(level.targetAt(late.at).mean, 5.4);
        expect(level.since, isNotNull);
        // Boshqa daraja tegilmagan.
        expect(reopened.data.set(set.id)!.level('L2')!.previous, isEmpty);
        await expectLater(
          c.changeTarget(set.id, 'L1', lot: '', mean: 5, sd: 0),
          throwsArgumentError,
        );
        await expectLater(
          c.changeTarget(
            set.id,
            'L1',
            lot: '',
            mean: 5,
            sd: 1,
            from: DateTime(2000),
          ),
          throwsArgumentError,
        );
      },
    );

    test('legacy saved data without target history still loads', () {
      final legacy = QcLevel.fromJson({
        'id': 'L1',
        'label': '1',
        'lot': 'X',
        'mean': 2,
        'sd': 0.5,
      });
      expect(legacy.since, isNull);
      expect(legacy.previous, isEmpty);
      expect(legacy.targetAt(DateTime(1990)).mean, 2);
    });

    test('delete run and set', () async {
      final (c, _, set) = await setup();
      final run = await c.addRun(set.id, {'L1': 5.0});
      await c.deleteRun(set.id, run.id);
      expect(c.data.runsOf(set.id), isEmpty);
      await c.deleteSet(set.id);
      expect(c.data.sets, isEmpty);
    });

    test(
      'corrupt stored data is reported, never silently overwritten',
      () async {
        final store = MemoryKeyValueStore();
        await store.setString(StoreKeys.qcData, '{"version": 99}');
        final c = QcController(store);
        expect(c.loadError, isNotNull);
        await expectLater(
          c.addSet(
            name: 'X',
            unit: '',
            targetSource: QcTargetSource.laboratory,
            levels: [(label: '1', lot: '', mean: 1, sd: 1)],
          ),
          throwsStateError,
        );
        expect(store.getString(StoreKeys.qcData), '{"version": 99}');
        // Foydalanuvchi o'qib bo'lmagan matnni nusxalab olishi mumkin.
        expect(c.unreadableRaw, '{"version": 99}');
        await c.discardUnreadable();
        expect(c.loadError, isNull);
        expect(store.getString(StoreKeys.qcData), isNull);
      },
    );

    test('entered verdict is kept as an audit trail', () async {
      final (c, store, set) = await setup();
      // L1: x̄ 5.0, SD 0.2. +2.5 SD ikki marta → ikkinchisi 2-2s rad.
      final first = await c.addRun(set.id, {'L1': 5.5});
      final second = await c.addRun(set.id, {'L1': 5.5});
      expect(first.enteredVerdict, 'warning');
      expect(second.enteredVerdict, 'reject');
      expect(second.enteredRules, containsAll(['1-2s', '2-2s']));
      // Birinchisi o'chirilsa — joriy baho o'zgaradi, kiritilgandagi qaror yo'q
      // bo'lib ketmaydi (va qayta ishga tushganda ham saqlanadi).
      await c.deleteRun(set.id, first.id);
      final reloaded = QcController(store).data.runsOf(set.id).single;
      expect(reloaded.enteredVerdict, 'reject');
      expect(reloaded.enteredRules, contains('2-2s'));
    });

    test('a mistaken target change can be undone', () async {
      final (c, _, set) = await setup();
      await c.changeTarget(set.id, 'L1', lot: 'X', mean: 50, sd: 2);
      expect(c.data.set(set.id)!.level('L1')!.mean, 50);
      await c.undoTargetChange(set.id, 'L1');
      final level = c.data.set(set.id)!.level('L1')!;
      expect(level.mean, 5.0);
      expect(level.sd, 0.2);
      expect(level.lot, 'A1');
      expect(level.previous, isEmpty);
      await expectLater(c.undoTargetChange(set.id, 'L1'), throwsArgumentError);
    });

    test('a failed write leaves memory unchanged', () async {
      final store = _FailingStore();
      final c = QcController(store, clock: clock);
      await expectLater(
        c.addSet(
          name: 'X',
          unit: '',
          targetSource: QcTargetSource.laboratory,
          levels: [(label: '1', lot: '', mean: 1, sd: 1)],
        ),
        throwsA(isA<StateError>()),
      );
      expect(c.data.sets, isEmpty);
    });

    test('backup round trip and validation', () async {
      final (c, _, set) = await setup();
      await c.addRun(set.id, {'L1': 5.1, 'L2': 15.2}, note: 'ok');
      final json = c.exportJson();
      expect(json, contains('"entered":{"verdict":"accept","rules":[]}'));
      final parsed = QcController.parseBackup(json);
      expect(parsed.sets.single.name, 'Glucose');
      expect(parsed.runsOf(set.id).single.note, 'ok');

      for (final v in QcVerdict.values) {
        final run = QcRun.fromJson({
          'id': 'r',
          'at': '2026-10-08T09:00:00.000',
          'values': {'L1': 5.0},
          'entered': {'verdict': v.name, 'rules': <String>[]},
        });
        expect(run.enteredVerdict, v.name);
      }

      final other = QcController(MemoryKeyValueStore());
      await other.restore(parsed);
      expect(other.data.runsOf(set.id), hasLength(1));

      for (final bad in [
        'not json',
        '[]',
        '{"version": 1, "sets": [], "runs": {"x": []}}',
        json.replaceFirst('"sd":0.2', '"sd":0'),
        json.replaceFirst('"L1":5.1', '"L9":5.1'),
        // Audit izi ham tekshiriladi: buzuq qiymat keyin ekranda
        // (lazy cast) yiqitmasin yoki noma'lum xulosa “qabul” bo'lib
        // ko'rinmasin.
        json.replaceFirst('"rules":[]', '"rules":[1]'),
        json.replaceFirst('"rules":[]', '"rules":"1-3s"'),
        json.replaceFirst('"verdict":"accept"', '"verdict":"bogus"'),
        json.replaceFirst('"verdict":"accept"', '"verdict":3'),
      ]) {
        expect(
          () => QcController.parseBackup(bad),
          throwsFormatException,
          reason: bad,
        );
      }
    });

    test('target change keeps its own source; clock skew is clamped', () async {
      var now = DateTime(2026, 10, 8, 9);
      final store = MemoryKeyValueStore();
      final c = QcController(store, clock: () => now);
      final set = await c.addSet(
        name: 'K',
        unit: 'mmol/L',
        targetSource: QcTargetSource.manufacturer,
        levels: [(label: '1', lot: 'A', mean: 4.0, sd: 0.1)],
      );
      // Qurilma soati orqaga ketdi — xato emas, oldingi davr boshidan.
      now = DateTime(2026, 10, 7);
      await c.changeTarget(
        set.id,
        'L1',
        lot: 'A',
        mean: 4.1,
        sd: 0.08,
        source: QcTargetSource.laboratory,
      );
      final updated = c.data.set(set.id)!;
      final level = updated.levels.single;
      expect(level.since, set.createdAt);
      expect(updated.sourceOf(level.current), QcTargetSource.laboratory);
      expect(
        updated.sourceOf(level.previous.single),
        QcTargetSource.manufacturer,
      );
      // Saqlangan va qayta o'qilgan holda ham.
      final reloaded = QcController(store).data.set(set.id)!;
      expect(
        reloaded.sourceOf(reloaded.levels.single.current),
        QcTargetSource.laboratory,
      );
    });
  });
}

class _FailingStore extends MemoryKeyValueStore {
  @override
  Future<void> setString(String key, String value) async =>
      throw StateError('disk full');
}
