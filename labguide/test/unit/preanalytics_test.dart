import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/features/content/content_model.dart';
import 'package:labguide/features/lab/preanalytics_info.dart';

void main() {
  int indexOf(String en) => drawOrder.indexWhere(
    (t) => t.name.of('en').toLowerCase().contains(en.toLowerCase()),
  );

  test('WHO 2010 Table 2.3 order is preserved', () {
    expect(drawOrder, hasLength(10));
    final order = [
      indexOf('blood culture'),
      indexOf('non-additive'),
      indexOf('sodium citrate'),
      indexOf('clot activator'),
      indexOf('serum separator'),
      indexOf('heparin (sodium or lithium'),
      indexOf('PST'),
      indexOf('EDTA'),
      indexOf('ACD'),
      indexOf('fluoride'),
    ];
    expect(order, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('every text has uz, ru and en; Uzbek uses ‘ and ’ only', () {
    final texts = <LocalizedText>[
      for (final t in drawOrder) ...[t.name, t.cap, ?t.note],
      ...drawOrderNotes,
      ...haemolysisCauses,
      ...tourniquetRules,
      ...identificationRules,
    ];
    for (final t in texts) {
      expect(t.values.keys, containsAll(['uz', 'ru', 'en']));
      expect(t.values['uz']!.contains("'"), isFalse, reason: t.values['uz']);
    }
  });
}
