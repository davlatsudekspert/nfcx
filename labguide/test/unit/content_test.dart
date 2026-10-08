import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/content/analyte_search.dart';
import 'package:labguide/features/content/content_model.dart';
import 'package:labguide/features/content/content_pack.dart';
import 'package:labguide/features/lab/ifu_matching.dart';

/// Ilova ichidagi haqiqiy paket (testlar repo ildizidan — labguide/ — ishlaydi).
Uint8List bundled(String name) =>
    File('assets/content/core/$name').readAsBytesSync();

Map<String, Object?> packJson() =>
    (jsonDecode(utf8.decode(bundled('pack.json'))) as Map)
        .cast<String, Object?>();

/// Berilgan pack JSON uchun mos manifest yasaydi.
(Uint8List, Map<String, Uint8List>) packWithManifest(
  Map<String, Object?> pack, {
  List<String> languages = const ['uz', 'ru', 'en'],
  int? minSchema,
}) {
  final bytes = Uint8List.fromList(utf8.encode(jsonEncode(pack)));
  final manifest = {
    'pack_id': pack['pack_id'],
    'version': pack['content_version'],
    'min_schema': minSchema ?? pack['schema_version'],
    'languages': languages,
    'licence': 'test',
    'files': [
      {
        'path': 'pack.json',
        'size': bytes.length,
        'sha256': sha256.convert(bytes).toString(),
      },
    ],
  };
  return (
    Uint8List.fromList(utf8.encode(jsonEncode(manifest))),
    {'pack.json': bytes},
  );
}

ContentPack parse(Map<String, Object?> json) => ContentPack.fromJson(json);

void main() {
  group('bundled core pack', () {
    test(
      'manifest matches pack.json (run tool/build_content_manifest.dart)',
      () {
        final verified = verifyPack(
          manifestBytes: bundled('manifest.json'),
          files: {'pack.json': bundled('pack.json')},
          expectedPackId: 'core',
        );
        expect(verified.pack.analytes.length, greaterThanOrEqualTo(35));
      },
    );

    test('covers every PRODUCT_PLAN group in three languages', () {
      final pack = parse(packJson());
      expect(pack.groups.map((g) => g.id), [
        'carbohydrate',
        'kidney',
        'liver',
        'lipids',
        'proteins',
        'electrolytes',
        'enzymes',
        'urine',
      ]);
      for (final a in pack.analytes) {
        for (final lang in ['uz', 'ru', 'en']) {
          expect(a.names.values[lang], isNotEmpty, reason: '${a.id} $lang');
        }
      }
    });

    test('every card is a sourced draft; nothing is reviewer-approved', () {
      final pack = parse(packJson());
      expect(pack.analytes, hasLength(35));
      for (final a in pack.analytes) {
        // Manbali o'quv namunasi — mustaqil review hali yo'q.
        expect(a.contentState, ContentState.sourcedSample, reason: a.id);
        expect(a.status, ContentStatus.draft, reason: a.id);
        expect(a.isReviewerApproved, isFalse, reason: a.id);
        expect(a.claims, isNotEmpty, reason: a.id);
        // Referens interval faqat laboratoriya blankidan — paketda yo'q.
        expect(a.referenceIntervals, isEmpty, reason: a.id);
        for (final c in a.claims) {
          expect(c.text.values.keys, containsAll(['uz', 'ru', 'en']));
          for (final r in c.refs) {
            expect(r.locator, isNotNull, reason: '${a.id} ${c.section}');
            expect(a.sourceIds, contains(r.sourceId), reason: a.id);
          }
        }
      }
    });

    test('quiz: every question is a draft with a source and a topic', () {
      final pack = parse(packJson());
      final analyteIds = {for (final a in pack.analytes) a.id};
      expect(pack.quiz.length, greaterThanOrEqualTo(70));
      for (final q in pack.quiz) {
        expect(q.isDraft, isTrue, reason: q.id);
        for (final t in q.topicIds) {
          expect(analyteIds, contains(t), reason: q.id);
        }
      }
      // Analit savollari: har birida manba va aniq bir analit mavzusi.
      final analyteQuestions = pack.quiz.where((q) => q.topicIds.isNotEmpty);
      expect(analyteQuestions.length, 68);
      for (final q in analyteQuestions) {
        expect(q.refs, isNotEmpty, reason: q.id);
      }
    });

    test('Uzbek text uses ‘ and ’, never ASCII apostrophes', () {
      final pack = parse(packJson());
      final texts = [
        for (final a in pack.analytes) ...[
          ?a.tagline?.values['uz'],
          for (final c in a.claims) c.text.values['uz']!,
        ],
        for (final q in pack.quiz) ...[
          q.prompt.values['uz']!,
          for (final o in q.options) o.explanation.values['uz']!,
        ],
      ];
      for (final t in texts) {
        expect(t.contains("'"), isFalse, reason: t);
      }
    });

    test('strict decision limits keep the source wording (< 60, > 30)', () {
      final pack = parse(packJson());
      final egfr = pack.analyte('egfr')!.decisionLimits;
      final lt60 = egfr.firstWhere((d) => d.high == 60);
      expect(lt60.highExclusive, isTrue);
      final acr = pack.analyte('urine-acr')!.decisionLimits;
      final gt30 = acr.firstWhere((d) => d.low == 30 && d.high == null);
      expect(gt30.lowExclusive, isTrue);
    });

    test('glucose: decision limits are separate from reference intervals', () {
      final g = parse(packJson()).analyte('glucose-plasma-fasting')!;
      expect(g.referenceIntervals, isEmpty);
      expect(g.decisionLimits.map((d) => (d.low, d.high)), [
        (100, 125),
        (126, null),
      ]);
      expect(g.decisionLimits.every((d) => d.sourceIds.isNotEmpty), isTrue);
      expect(g.conversion!.molarMass, closeTo(180.156, 1e-9));
    });

    test('teacher materials are not marked as received or imported', () {
      final pack = parse(packJson());
      expect(pack.library, isEmpty);
      expect(pack.lessons, isEmpty);
      expect(pack.discrepancies, isEmpty);
      expect(pack.sources.every((s) => s.kind == 'web'), isTrue);
      expect(pack.quiz.every((q) => q.isDraft), isTrue);
    });
  });

  group('verifyPack rejects', () {
    test('tampered bytes (hash mismatch)', () {
      final bytes = Uint8List.fromList(bundled('pack.json'));
      bytes[100] = bytes[100] ^ 0x01;
      expect(
        () => verifyPack(
          manifestBytes: bundled('manifest.json'),
          files: {'pack.json': bytes},
        ),
        throwsA(isA<PackRejected>()),
      );
    });

    test('truncated file (size mismatch)', () {
      final bytes = bundled('pack.json');
      expect(
        () => verifyPack(
          manifestBytes: bundled('manifest.json'),
          files: {'pack.json': bytes.sublist(0, bytes.length - 1)},
        ),
        throwsA(
          isA<PackRejected>().having(
            (e) => e.reason,
            'reason',
            contains('size'),
          ),
        ),
      );
    });

    test('missing file, garbage manifest, wrong pack id', () {
      expect(
        () => verifyPack(manifestBytes: bundled('manifest.json'), files: {}),
        throwsA(isA<PackRejected>()),
      );
      expect(
        () => verifyPack(
          manifestBytes: Uint8List.fromList(utf8.encode('{not json')),
          files: {'pack.json': bundled('pack.json')},
        ),
        throwsA(isA<PackRejected>()),
      );
      expect(
        () => verifyPack(
          manifestBytes: bundled('manifest.json'),
          files: {'pack.json': bundled('pack.json')},
          expectedPackId: 'other',
        ),
        throwsA(isA<PackRejected>()),
      );
    });

    test('newer schema than the app supports', () {
      final (m, f) = packWithManifest(packJson(), minSchema: 99);
      expect(
        () => verifyPack(manifestBytes: m, files: f),
        throwsA(
          isA<PackRejected>().having((e) => e.reason, 'r', contains('schema')),
        ),
      );
    });

    test('missing a required language', () {
      final (m, f) = packWithManifest(packJson(), languages: ['en']);
      expect(
        () => verifyPack(manifestBytes: m, files: f),
        throwsA(isA<PackRejected>()),
      );
    });

    test('valid hash but invalid content (claim without source)', () {
      final json = packJson();
      final analytes = (json['analytes']! as List).cast<Map<String, Object?>>();
      final glucose = analytes.firstWhere(
        (a) => a['id'] == 'glucose-plasma-fasting',
      );
      final claims = (glucose['claims']! as List).cast<Map<String, Object?>>();
      claims.first['source_ids'] = <String>[];
      final (m, f) = packWithManifest(json);
      expect(
        () => verifyPack(manifestBytes: m, files: f),
        throwsA(isA<PackRejected>()),
      );
    });
  });

  group('content integrity rules', () {
    Map<String, Object?> base() => packJson();

    Map<String, Object?> glucose(Map<String, Object?> json) =>
        (json['analytes']! as List).cast<Map<String, Object?>>().firstWhere(
          (a) => a['id'] == 'glucose-plasma-fasting',
        );

    test('published without an approved reviewer is rejected', () {
      final json = base();
      glucose(json)['status'] = 'published';
      expect(() => parse(json), throwsFormatException);
    });

    test('structure-only card with claims is rejected', () {
      final json = base();
      final alt = (json['analytes']! as List)
          .cast<Map<String, Object?>>()
          .firstWhere((a) => a['id'] == 'alt');
      alt['content_state'] = 'structure_only';
      expect(() => parse(json), throwsFormatException);
      alt['claims'] = const <Object>[];
      alt['decision_limits'] = const <Object>[];
      expect(
        parse(json).analyte('alt')!.contentState,
        ContentState.structureOnly,
      );
    });

    test('approved quiz question must cite a source', () {
      final json = base();
      final q = (json['quiz']! as List).cast<Map<String, Object?>>().first;
      q['review_state'] = 'approved';
      expect(() => parse(json), throwsFormatException);
    });
  });

  group('library / teacher materials schema', () {
    Map<String, Object?> book({
      String id = 'book-1',
      String importState = 'cataloged',
      Map<String, Object?>? rights,
      Map<String, Object?>? filePack,
      List<String> topics = const ['carbohydrate'],
    }) => {
      'id': id,
      'kind': 'book',
      'title': 'Clinical Biochemistry',
      'authors': ['Author A'],
      'year': 2020,
      'language': 'ru',
      'categories': ['biochemistry', 'clinical_lab'],
      'topics': topics,
      'provided_by': 'teacher',
      'import_state': importState,
      'rights': ?rights,
      'file_pack': ?filePack,
    };

    Map<String, Object?> withLibrary(
      List<Map<String, Object?>> items, {
      List<Map<String, Object?>> extraSources = const [],
      List<Map<String, Object?>> discrepancies = const [],
    }) {
      final json = packJson();
      json['library'] = items;
      json['sources'] = [...(json['sources']! as List), ...extraSources];
      json['discrepancies'] = discrepancies;
      return json;
    }

    final bookSource = {
      'id': 'src-book-1',
      'kind': 'book',
      'title': 'Clinical Biochemistry',
      'publisher': 'Publisher',
      'library_item_id': 'book-1',
      'reuse_rights': 'personal_only',
    };

    test('a catalogued book with page-level refs parses', () {
      final json = withLibrary([book()], extraSources: [bookSource]);
      final g = (json['analytes']! as List)
          .cast<Map<String, Object?>>()
          .firstWhere((a) => a['id'] == 'glucose-plasma-fasting');
      (g['source_ids']! as List).add('src-book-1');
      (g['claims']! as List).add({
        'section': 'physiology',
        'refs': [
          {'source_id': 'src-book-1', 'pages': '45–47'},
        ],
        'text': {'uz': 'x', 'ru': 'x', 'en': 'x'},
      });
      final pack = parse(json);
      final claim = pack
          .analyte('glucose-plasma-fasting')!
          .claimsFor('physiology')
          .single;
      expect(claim.refs.single.pages, '45–47');
      expect(pack.libraryItem('book-1')!.categories, [
        LibraryCategory.biochemistry,
        LibraryCategory.clinicalLab,
      ]);
    });

    test('citing a material that has not been received is rejected', () {
      final json = withLibrary(
        [book(importState: 'not_received')],
        extraSources: [bookSource],
      );
      expect(() => parse(json), throwsFormatException);
    });

    test('full-text pack requires recorded distribution permission', () {
      const pack = {
        'pack_id': 'book-1',
        'version': '1',
        'size': 1000,
        'sha256': 'abc',
      };
      // Ruxsat noma'lum — rad.
      expect(
        () => parse(withLibrary([book(filePack: pack)])),
        throwsFormatException,
      );
      // "Ruxsat bor" deyilgan, lekin sana/dalil yo'q — rad.
      expect(
        () => parse(
          withLibrary([
            book(filePack: pack, rights: {'distribution': 'permitted'}),
          ]),
        ),
        throwsFormatException,
      );
      // Faqat shaxsiy foydalanish — umumiy paket bo'lmaydi.
      expect(
        () => parse(
          withLibrary([
            book(
              filePack: pack,
              rights: {
                'distribution': 'personal_only',
                'recorded_at': '2026-10-09',
                'evidence': 'note',
              },
            ),
          ]),
        ),
        throwsFormatException,
      );
      // To'liq qayd etilgan ruxsat — qabul.
      final ok = parse(
        withLibrary([
          book(
            filePack: pack,
            rights: {
              'distribution': 'permitted',
              'recorded_at': '2026-10-09',
              'recorded_by': 'editor',
              'evidence': 'publisher letter #12',
            },
          ),
        ]),
      );
      expect(ok.library.single.rights.allowsSharedPack, isTrue);
    });

    test('unknown topic or category is rejected', () {
      expect(
        () => parse(
          withLibrary([
            book(topics: ['nope']),
          ]),
        ),
        throwsFormatException,
      );
      final bad = book()..['categories'] = ['astrology'];
      expect(() => parse(withLibrary([bad])), throwsFormatException);
    });

    test('discrepancy needs two positions; resolution needs a reviewer', () {
      final positions = [
        {'source_id': 'niddk-diagnosis', 'statement': '≥126 mg/dL'},
        {'source_id': 'src-book-1', 'pages': '112', 'statement': '≥140 mg/dL'},
      ];
      Map<String, Object?> d({List<Object?>? pos, Object? status}) => {
        'id': 'd1',
        'subject_id': 'glucose-plasma-fasting',
        'field': 'decision_limits',
        'positions': pos ?? positions,
        'status': ?status,
      };
      final ok = parse(
        withLibrary([book()], extraSources: [bookSource], discrepancies: [d()]),
      );
      expect(ok.openDiscrepancies.single.positions[1].ref.pages, '112');
      expect(
        () => parse(
          withLibrary(
            [book()],
            extraSources: [bookSource],
            discrepancies: [
              d(pos: [positions.first]),
            ],
          ),
        ),
        throwsFormatException,
      );
      expect(
        () => parse(
          withLibrary(
            [book()],
            extraSources: [bookSource],
            discrepancies: [d(status: 'resolved')],
          ),
        ),
        throwsFormatException,
      );
    });

    test('docs/content_templates example parses against the schema', () {
      final example = (jsonDecode(
        File('docs/content_templates/teacher_material_example.json')
            .readAsStringSync(),
      ) as Map).cast<String, Object?>();
      final json = packJson();
      for (final key in ['library', 'lessons', 'discrepancies']) {
        json[key] = example[key];
      }
      json['sources'] = [
        ...(json['sources']! as List),
        ...(example['sources']! as List),
      ];
      json['quiz'] = [
        ...(json['quiz']! as List),
        ...(example['quiz']! as List),
      ];
      final pack = parse(json);
      expect(pack.library, isNotEmpty);
      expect(pack.quiz.last.isDraft, isTrue);
    });
  });

  group('PackInstaller (atomic install)', () {
    late Directory root;
    late PackInstaller installer;

    setUp(() {
      root = Directory.systemTemp.createTempSync('labguide_packs');
      installer = PackInstaller(root);
    });

    tearDown(() => root.deleteSync(recursive: true));

    Future<VerifiedPack> installVersion(String version) {
      final json = packJson()..['content_version'] = version;
      final (m, f) = packWithManifest(json);
      return installer.install(packId: 'core', manifestBytes: m, files: f);
    }

    test('installs and reloads a verified pack', () async {
      await installVersion('v1');
      expect(await installer.activeVersion('core'), 'v1');
      final loaded = await installer.loadActive('core');
      expect(loaded!.pack.contentVersion, 'v1');
    });

    test('corrupt update is rejected and previous pack stays active', () async {
      await installVersion('v1');
      final json = packJson()..['content_version'] = 'v2';
      final (m, f) = packWithManifest(json);
      final broken = Uint8List.fromList(f['pack.json']!);
      broken[10] ^= 0xff;
      await expectLater(
        installer.install(
          packId: 'core',
          manifestBytes: m,
          files: {'pack.json': broken},
        ),
        throwsA(isA<PackRejected>()),
      );
      expect(await installer.activeVersion('core'), 'v1');
      expect((await installer.loadActive('core'))!.pack.contentVersion, 'v1');
      // Vaqtinchalik papkalar qolmaydi.
      final leftovers = Directory('${root.path}/core')
          .listSync()
          .where((e) => e.path.contains('.staging-'));
      expect(leftovers, isEmpty);
    });

    test('keeps the last two good versions', () async {
      await installVersion('v1');
      await installVersion('v2');
      await installVersion('v3');
      final dirs = Directory('${root.path}/core')
          .listSync()
          .whereType<Directory>()
          .map((d) => d.uri.pathSegments.where((s) => s.isNotEmpty).last)
          .toSet();
      expect(dirs, {'v2', 'v3'});
    });

    test('on-disk tampering is detected on load', () async {
      await installVersion('v1');
      final file = File('${root.path}/core/v1/pack.json');
      final bytes = file.readAsBytesSync();
      bytes[5] ^= 0x01;
      file.writeAsBytesSync(bytes);
      expect(await installer.loadActive('core'), isNull);
    });

    test('path traversal in version is neutralised or rejected', () async {
      final json = packJson()..['content_version'] = '../../evil';
      final (m, f) = packWithManifest(json);
      await installer.install(packId: 'core', manifestBytes: m, files: f);
      expect(File('${root.parent.path}/evil/pack.json').existsSync(), isFalse);
      final inside = Directory('${root.path}/core')
          .listSync()
          .whereType<Directory>()
          .single;
      expect(inside.path.startsWith(root.path), isTrue);
    });
  });

  group('AnalyteSearch', () {
    late AnalyteSearch search;

    setUpAll(() => search = AnalyteSearch(parse(packJson())));

    List<String> ids(String q, {String lang = 'uz', String? group}) =>
        search.search(q, lang: lang, groupId: group).map((a) => a.id).toList();

    test('finds by name in any language and by synonym', () {
      expect(ids('glyukoza').first, 'glucose-plasma-fasting');
      expect(ids('глюкоза', lang: 'ru').first, 'glucose-plasma-fasting');
      expect(ids('FPG').first, 'glucose-plasma-fasting');
      expect(ids('АЛТ').first, 'alt');
      expect(ids('alat').first, 'alt');
      expect(ids('sgot').first, 'ast');
      expect(ids('СРБ').first, 'crp');
      expect(ids('hba1c').first, 'hba1c');
      expect(ids('креатинин', lang: 'ru').first, 'creatinine');
    });

    test('ignores case, apostrophe variants, ё and hyphens', () {
      expect(ids('To‘g‘ri bilirubin').first, 'bilirubin-direct');
      expect(ids("to'g'ri bilirubin").first, 'bilirubin-direct');
      expect(ids('togri bilirubin').first, 'bilirubin-direct');
      expect(ids('non hdl').first, 'non-hdl-c');
      expect(ids('nonhdl').first, 'non-hdl-c');
      expect(normalizeForSearch('Ёлка  ‐  ТЕСТ'), 'елка тест');
    });

    test('group filter and empty query', () {
      expect(ids('', group: 'liver'), [
        'alt',
        'ast',
        'alp',
        'ggt',
        'bilirubin-total',
        'bilirubin-direct',
      ]);
      expect(ids('kreatinin', group: 'liver'), isEmpty);
      expect(ids('').length, 35);
    });

    test('no results for unknown terms', () {
      expect(ids('xyzzy'), isEmpty);
    });
  });

  group('IFU matching', () {
    const record = IfuRecord(
      analyteId: 'glucose-plasma-fasting',
      binding: InstrumentBinding(
        manufacturer: 'Mindray',
        model: 'BS-240',
        reagentRef: 'REF-1',
        ifuRevision: 'v3',
        calibratorLot: 'LOT9',
      ),
    );

    IfuQuery q({String? maker = 'Mindray', String lot = 'LOT9'}) => IfuQuery(
      manufacturer: maker,
      model: ' bs-240 ',
      reagentRef: 'ref-1',
      ifuRevision: 'V3',
      calibratorLot: lot,
    );

    test('empty catalog → no parameters', () {
      expect(matchIfu(const [], q()).record, isNull);
    });

    test('exact match only (case/space-insensitive)', () {
      expect(matchIfu(const [record], q()).record, same(record));
      expect(matchIfu(const [record], q(lot: 'LOT1')).record, isNull);
      expect(matchIfu(const [record], q(maker: 'HUMAN')).record, isNull);
      expect(matchIfu(const [record], q(maker: null)).record, isNull);
    });

    test('incomplete query never matches', () {
      const partial = IfuQuery(
        manufacturer: 'Mindray',
        model: 'BS-240',
        reagentRef: '',
        ifuRevision: 'v3',
      );
      expect(partial.isComplete, isFalse);
      expect(matchIfu(const [record], partial).record, isNull);
    });
  });
}
