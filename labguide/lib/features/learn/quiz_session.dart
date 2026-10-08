import '../content/content_model.dart';

/// Mashq sessiyasi: natija faqat foydalanuvchining haqiqiy javoblaridan
/// hisoblanadi. Bir savolga javob bir marta beriladi (keyin izoh ochiladi).
class QuizSession {
  QuizSession(List<QuizQuestion> questions)
    : questions = List.unmodifiable(questions),
      _answers = List<int?>.filled(questions.length, null);

  final List<QuizQuestion> questions;
  final List<int?> _answers;
  int _index = 0;
  bool _finished = false;

  int get index => _index;
  bool get finished => _finished;
  QuizQuestion get current => questions[_index];
  bool get isLast => _index == questions.length - 1;

  int? answerFor(int i) => _answers[i];

  /// Joriy savolga javob. Qayta javob berish e'tiborsiz qoldiriladi.
  void answer(int option) {
    if (_finished || _answers[_index] != null) return;
    RangeError.checkValidIndex(option, current.options, 'option');
    _answers[_index] = option;
  }

  /// Javob berilmagan savoldan o'tib bo'lmaydi.
  void next() {
    if (_finished || _answers[_index] == null) return;
    if (isLast) {
      _finished = true;
    } else {
      _index++;
    }
  }

  int get correctCount {
    var n = 0;
    for (var i = 0; i < questions.length; i++) {
      if (_answers[i] == questions[i].correctIndex) n++;
    }
    return n;
  }

  /// Noto'g'ri javob berilgan savollar va tanlangan variant.
  List<(QuizQuestion, int)> get mistakes => [
    for (var i = 0; i < questions.length; i++)
      if (_answers[i] != null && _answers[i] != questions[i].correctIndex)
        (questions[i], _answers[i]!),
  ];
}
