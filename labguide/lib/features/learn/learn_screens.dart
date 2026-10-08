import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/app_scope.dart';
import '../../app/widgets/lg_page.dart';
import '../../design/tokens.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/ui/welcome_screen.dart';
import '../content/content_model.dart';
import '../content/ui/content_widgets.dart';
import 'quiz_session.dart';
import '../../app/shell.dart';

class LearnScreen extends StatelessWidget {
  const LearnScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final quizCount = context.services.content.pack?.quiz.length ?? 0;
    return LgPage(
      title: l.learnTitle,
      showBrand: true,
      children: [
        LgHeroCard(
          image: kHeroImage,
          tag: l.learnHeroTag,
          title: l.learnHeroTitle,
          body: l.learnHeroBody,
          action: LgButton(
            label: l.learnHeroCta,
            onPressed: () => openInTab(context, '/tests'),
          ),
        ),
        // Dars mavzulari kontent paketidan keladi (hozircha bo'sh — domla
        // materiallari kelib, tekshirilgach qo'shiladi).
        ContentGate(
          builder: (context, pack) {
            if (pack.lessons.isEmpty) return const SizedBox.shrink();
            final lang = Localizations.localeOf(context).languageCode;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LgSectionTitle(l.lessonsTitle),
                for (final lesson in pack.lessons)
                  LgRow(
                    title: lesson.title.of(lang),
                    subtitle: lesson.reviewState == ReviewState.approved
                        ? null
                        : l.quizDraftTag,
                    icon: Icons.menu_book_outlined,
                  ),
              ],
            );
          },
        ),
        LgRow(
          title: l.classesTitle,
          subtitle: l.learnClassesSub,
          icon: Icons.groups_outlined,
          onTap: () => context.push('/learn/classes'),
        ),
        LgRow(
          title: l.learnQuiz,
          subtitle: l.learnQuizSub(quizCount),
          icon: Icons.quiz_outlined,
          onTap: () => context.push('/learn/quiz'),
        ),
        LgRow(
          title: l.learnExam,
          subtitle: l.learnExamSub,
          icon: Icons.timer_outlined,
          onTap: () => context.push('/learn/exam'),
        ),
        LgRow(
          title: l.micTitle,
          subtitle: l.labMicroscopySub,
          icon: Icons.biotech_outlined,
          onTap: () => openInTab(context, '/lab/microscopy'),
        ),
        LgRow(
          title: l.learnLessonPlan,
          subtitle: l.learnLessonPlanSub,
          icon: Icons.co_present_outlined,
          onTap: () => context.push('/learn/lesson'),
          divider: false,
        ),
      ],
    );
  }
}

/// Mashq to'plami: mavzu (guruh yoki bitta analit), umumiy laboratoriya
/// hisoblari yoki aralash tasodifiy savollar.
class QuizScope {
  const QuizScope(this.title, this.questions, {this.redraw});

  final String title;
  final List<QuizQuestion> questions;

  /// Qayta boshlashda yangi to'plam (aralash rejim — yangi tasodifiy savollar).
  final QuizScope Function()? redraw;
}

/// Aralash rejimdagi savollar soni.
const kMixedQuizSize = 10;

/// Analitning guruhi bo'yicha savollar (savolning `topic_ids` i orqali).
List<QuizQuestion> questionsForGroup(ContentPack pack, String groupId) {
  final ids = {
    for (final a in pack.analytes)
      if (a.group == groupId) a.id,
  };
  return [
    for (final q in pack.quiz)
      if (q.topicIds.any(ids.contains)) q,
  ];
}

List<QuizQuestion> questionsForAnalyte(ContentPack pack, String analyteId) => [
  for (final q in pack.quiz)
    if (q.topicIds.contains(analyteId)) q,
];

class QuizScreen extends StatefulWidget {
  const QuizScreen({super.key, this.analyteId});

  /// Berilsa — faqat shu analit savollari (analit kartasidan ochilganda).
  final String? analyteId;

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  QuizScope? _scope;
  QuizSession? _session;

  // Bir analit testidan boshqasiga o'tilganda State qayta ishlatilishi
  // mumkin — sessiya yangi analit uchun qaytadan yig'iladi.
  @override
  void didUpdateWidget(QuizScreen old) {
    super.didUpdateWidget(old);
    if (old.analyteId != widget.analyteId) {
      _scope = null;
      _session = null;
    }
  }

  void _start(QuizScope scope) => setState(() {
    _scope = scope;
    _session = QuizSession(scope.questions);
  });

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final content = context.services.content;
    // Paket yuklanishi kutilsa ham sarlavha (analit nomi) yangilanadi.
    return ListenableBuilder(
      listenable: content,
      builder: (context, _) {
        final analyteId = widget.analyteId;
        final loaded = content.pack;
        if (analyteId != null && _session == null && loaded != null) {
          _scope = QuizScope(
            loaded.analyte(analyteId)?.names.of(lang) ?? analyteId,
            questionsForAnalyte(loaded, analyteId),
          );
          _session = QuizSession(_scope!.questions);
        }
        return _page(context, l);
      },
    );
  }

  Widget _page(BuildContext context, AppLocalizations l) {
    final analyteId = widget.analyteId;
    return LgPage(
      title: l.learnQuiz,
      subtitle: _scope?.title,
      children: [
        ContentGate(
          builder: (context, pack) {
            final session = _session;
            if (session == null) {
              return _TopicPicker(pack: pack, onPick: _start);
            }
            if (session.questions.isEmpty) {
              return LgStateView(kind: StateKind.empty, title: l.learnQuiz);
            }
            return session.finished
                ? _QuizResult(
                    session: session,
                    onRestart: () => _start(_scope!.redraw?.call() ?? _scope!),
                    onOtherTopic: analyteId == null
                        ? () => setState(() {
                            _scope = null;
                            _session = null;
                          })
                        : null,
                  )
                : _QuizQuestion(
                    session: session,
                    onChanged: () => setState(() {}),
                  );
          },
        ),
      ],
    );
  }
}

class _TopicPicker extends StatelessWidget {
  const _TopicPicker({required this.pack, required this.onPick});

  final ContentPack pack;
  final ValueChanged<QuizScope> onPick;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final general = [
      for (final q in pack.quiz)
        if (q.topicIds.isEmpty) q,
    ];
    final groups = [
      for (final g in pack.groups) (g, questionsForGroup(pack, g.id)),
    ].where((e) => e.$2.isNotEmpty).toList();
    final mixedSize = pack.quiz.length < kMixedQuizSize
        ? pack.quiz.length
        : kMixedQuizSize;
    final progress = context.services.quizProgress;
    String sub(List<QuizQuestion> qs) {
      final n = qs.length;
      final m = progress.mastered(qs.map((q) => q.id));
      return m == 0
          ? l.quizQuestionCount(n)
          : '${l.quizQuestionCount(n)} · ${l.quizMastered(m, n)}';
    }

    final mistakes = {
      ...progress.mistakes([for (final q in pack.quiz) q.id]),
    };
    QuizScope mixed() => QuizScope(
      l.quizTopicMixed(mixedSize),
      (List.of(pack.quiz)..shuffle()).take(mixedSize).toList(),
      redraw: mixed,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LgSectionTitle(l.quizChooseTopic),
        if (mistakes.isNotEmpty)
          LgRow(
            title: l.quizTopicMistakes,
            subtitle: l.quizQuestionCount(mistakes.length),
            icon: Icons.replay_rounded,
            onTap: () => onPick(
              QuizScope(l.quizTopicMistakes, [
                for (final q in pack.quiz)
                  if (mistakes.contains(q.id)) q,
              ]),
            ),
          ),
        LgRow(
          title: l.quizTopicMixed(mixedSize),
          subtitle: l.quizQuestionCount(pack.quiz.length),
          icon: Icons.shuffle_rounded,
          onTap: () => onPick(mixed()),
        ),
        if (general.isNotEmpty)
          LgRow(
            title: l.quizTopicGeneral,
            subtitle: sub(general),
            icon: Icons.calculate_outlined,
            onTap: () => onPick(QuizScope(l.quizTopicGeneral, general)),
          ),
        for (final (i, (group, questions)) in groups.indexed)
          LgRow(
            title: group.names.of(lang),
            subtitle: sub(questions),
            icon: groupIcon(group.id),
            onTap: () => onPick(QuizScope(group.names.of(lang), questions)),
            divider: i < groups.length - 1,
          ),
        const SizedBox(height: 14),
        Text(l.quizReviewNote, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _QuizQuestion extends StatelessWidget {
  const _QuizQuestion({required this.session, required this.onChanged});

  final QuizSession session;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    final q = session.current;
    final answer = session.answerFor(session.index);
    final answered = answer != null;
    final total = session.questions.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            LgEyebrow(l.quizProgress(session.index + 1, total)),
            if (q.isDraft) LgTag(l.quizDraftTag, tone: LgTone.warning),
          ],
        ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: (session.index + 1) / total,
              minHeight: 6,
              semanticsLabel: l.quizProgress(session.index + 1, total),
            ),
          ),
        ),
        Semantics(
          header: true,
          child: Text(q.prompt.of(lang), style: text.headlineSmall),
        ),
        const SizedBox(height: 14),
        for (var i = 0; i < q.options.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _OptionButton(
              label: q.options[i].text.of(lang),
              state: !answered
                  ? _OptionState.idle
                  : i == q.correctIndex
                  ? _OptionState.correct
                  : i == answer
                  ? _OptionState.wrong
                  : _OptionState.disabled,
              onTap: answered
                  ? null
                  : () {
                      session.answer(i);
                      onChanged();
                      // Natija faqat qurilmada — “xatolar ustida ishlash” uchun.
                      context.services.quizProgress.record(
                        q.id,
                        correct: i == q.correctIndex,
                      );
                    },
            ),
          ),
        if (answered) ...[
          LgNotice(
            [
              q.options[answer].explanation.of(lang),
              if (answer != q.correctIndex)
                q.options[q.correctIndex].explanation.of(lang),
            ].join('\n\n'),
            title: answer == q.correctIndex ? l.quizCorrect : l.quizIncorrect,
            kind: answer == q.correctIndex
                ? NoticeKind.info
                : NoticeKind.warning,
          ),
          Text(
            l.quizBasis(q.basis.of(lang)),
            style: text.bodySmall!.copyWith(color: p.sub),
          ),
          const SizedBox(height: 14),
          LgButton(
            label: session.isLast ? l.quizFinish : l.quizNext,
            onPressed: () {
              session.next();
              onChanged();
            },
          ),
        ],
        const SizedBox(height: 14),
        Text(l.quizReviewNote, style: text.bodySmall),
      ],
    );
  }
}

enum _OptionState { idle, correct, wrong, disabled }

class _OptionButton extends StatelessWidget {
  const _OptionButton({
    required this.label,
    required this.state,
    required this.onTap,
  });

  final String label;
  final _OptionState state;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final (
      Color bg,
      Color border,
      IconData? icon,
      String? suffix,
    ) = switch (state) {
      _OptionState.idle => (p.paper, p.line, null, null),
      _OptionState.correct => (
        p.soft,
        p.brand,
        Icons.check_circle_rounded,
        l.quizCorrectAnswer,
      ),
      _OptionState.wrong => (
        p.amberBg,
        p.amber,
        Icons.cancel_rounded,
        l.quizYourAnswer,
      ),
      _OptionState.disabled => (p.paper, p.line, null, null),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(LgRadius.button),
        border: Border.all(
          color: border,
          width: state == _OptionState.idle ? 1 : 2,
        ),
      ),
      child: LgPressable(
        onTap: onTap,
        color: bg,
        borderRadius: BorderRadius.circular(LgRadius.button),
        semanticLabel: suffix == null ? label : '$label. $suffix',
        child: ExcludeSemantics(
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 52),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label, style: text.bodyLarge),
                        if (suffix != null)
                          Text(
                            suffix,
                            style: text.bodySmall!.copyWith(
                              fontWeight: FontWeight.w600,
                              color: state == _OptionState.wrong
                                  ? p.amber
                                  : p.brand,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (icon != null) ...[
                    const SizedBox(width: 8),
                    Icon(
                      icon,
                      color: state == _OptionState.wrong ? p.amber : p.brand,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _QuizResult extends StatelessWidget {
  const _QuizResult({
    required this.session,
    required this.onRestart,
    this.onOtherTopic,
  });

  final QuizSession session;
  final VoidCallback onRestart;
  final VoidCallback? onOtherTopic;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    final mistakes = session.mistakes;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        LgStateView(
          kind: StateKind.success,
          title: l.quizDoneTitle,
          message: l.quizScore(session.correctCount, session.questions.length),
        ),
        LgSectionTitle(l.quizMistakes),
        if (mistakes.isEmpty)
          Text(l.quizNoMistakes, style: text.bodyMedium)
        else
          for (final (QuizQuestion q, int chosen) in mistakes)
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(q.prompt.of(lang), style: text.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    '${l.quizYourAnswer}: ${q.options[chosen].text.of(lang)}',
                    style: text.bodyMedium,
                  ),
                  Text(
                    '${l.quizCorrectAnswer}: ${q.options[q.correctIndex].text.of(lang)}',
                    style: text.titleSmall,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    q.options[q.correctIndex].explanation.of(lang),
                    style: text.bodyMedium,
                  ),
                ],
              ),
            ),
        const SizedBox(height: 16),
        LgButton(label: l.quizRestart, onPressed: onRestart),
        if (onOtherTopic != null) ...[
          const SizedBox(height: 10),
          LgButton.secondary(label: l.quizOtherTopic, onPressed: onOtherTopic),
        ],
      ],
    );
  }
}

class ExamScreen extends StatelessWidget {
  const ExamScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return LgPage(
      title: l.examTitle,
      children: [
        LgStateView(
          kind: StateKind.unavailable,
          title: l.plannedStage('D'),
          message: l.examBody,
          actionLabel: l.examOpenPractice,
          onAction: () => context.push('/learn/quiz'),
        ),
      ],
    );
  }
}

class ClassesScreen extends StatelessWidget {
  const ClassesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final auth = context.services.auth;
    return LgPage(
      title: l.classesTitle,
      children: [
        ListenableBuilder(
          listenable: auth,
          builder: (context, _) => auth.hasAccount
              ? LgStateView(
                  kind: StateKind.unavailable,
                  title: l.classesUnavailableTitle,
                  message: l.classesUnavailableBody,
                )
              : LgStateView(
                  kind: StateKind.empty,
                  title: l.classesSignInTitle,
                  message: l.classesSignInBody,
                  actionLabel: l.classesSignIn,
                  onAction: () => context.push('/profile/auth'),
                ),
        ),
        Center(child: LgTag(l.plannedStage('D'), tone: LgTone.neutral)),
      ],
    );
  }
}
