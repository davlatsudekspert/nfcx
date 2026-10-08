import 'package:flutter_test/flutter_test.dart';
import 'package:labguide/core/storage/kv_store.dart';
import 'package:labguide/features/learn/quiz_progress.dart';

void main() {
  test('last answer decides mistakes; counts persist across restart', () async {
    final store = MemoryKeyValueStore();
    final p = QuizProgressController(store);
    await p.record('q1', correct: false);
    await p.record('q2', correct: true);
    await p.record('q3', correct: false);
    await p.record('q3', correct: true); // tuzatildi
    expect(p.mistakes(['q1', 'q2', 'q3', 'q4']).toList(), ['q1']);
    expect(p.mastered(['q1', 'q2', 'q3', 'q4']), 2);
    expect(p.statFor('q3')!.wrong, 1);
    expect(p.statFor('q3')!.correct, 1);

    final reopened = QuizProgressController(store);
    expect(reopened.mistakes(['q1', 'q2', 'q3']).toList(), ['q1']);
    reopened.resetInMemory();
    expect(reopened.mastered(['q2']), 0);
  });

  test('corrupt stored progress starts fresh instead of crashing', () {
    final store = MemoryKeyValueStore();
    store.setString(StoreKeys.quizProgress, 'not json');
    final p = QuizProgressController(store);
    expect(p.mistakes(['q1']), isEmpty);
  });
}
