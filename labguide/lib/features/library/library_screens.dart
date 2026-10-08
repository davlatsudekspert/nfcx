import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/app_scope.dart';
import '../../app/widgets/lg_page.dart';
import '../../core/storage/kv_store.dart';
import '../../design/tokens.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../content/content_model.dart';
import '../content/ui/analyte_screen.dart' show SourceTile, rightsLabel;
import '../content/ui/content_widgets.dart';

class LibraryScreen extends StatelessWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return LgPage(
      title: l.libTitle,
      subtitle: l.libSubtitle,
      showBrand: true,
      children: [
        LgRow(
          title: l.libBooks,
          subtitle: l.libBooksSub,
          icon: Icons.menu_book_outlined,
          onTap: () => context.push('/library/books'),
        ),
        LgRow(
          title: l.libPacks,
          subtitle: l.libPacksSub,
          icon: Icons.download_for_offline_outlined,
          onTap: () => context.push('/library/packs'),
        ),
        LgRow(
          title: l.featureSaved,
          subtitle: l.libSavedSub,
          icon: Icons.bookmark_outline,
          onTap: () => context.push('/library/saved'),
        ),
        LgRow(
          title: l.featureResearch,
          subtitle: l.libResearchSub,
          icon: Icons.edit_note_rounded,
          onTap: () => context.push('/library/research'),
        ),
        LgRow(
          title: l.libSources,
          subtitle: l.libSourcesSub,
          icon: Icons.fact_check_outlined,
          onTap: () => context.push('/library/sources'),
        ),
        LgRow(
          title: l.libReview,
          subtitle: l.libReviewSub,
          icon: Icons.rule_rounded,
          onTap: () => context.push('/library/review'),
          divider: false,
        ),
      ],
    );
  }
}

class SavedScreen extends StatelessWidget {
  const SavedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final bookmarks = context.services.bookmarks;
    return LgPage(
      title: l.featureSaved,
      children: [
        ContentGate(
          builder: (context, pack) => ListenableBuilder(
            listenable: bookmarks,
            builder: (context, _) {
              final saved = [
                for (final id in bookmarks.ids.reversed) ?pack.analyte(id),
              ];
              if (saved.isEmpty) {
                return LgStateView(
                  kind: StateKind.empty,
                  title: l.savedEmptyTitle,
                  message: l.savedEmptyBody,
                  actionLabel: l.featureTests,
                  onAction: () => context.go('/tests'),
                );
              }
              return Column(
                children: [
                  for (var i = 0; i < saved.length; i++)
                    AnalyteRow(
                      analyte: saved[i],
                      divider: i < saved.length - 1,
                      onTap: () =>
                          context.push('/library/saved/analyte/${saved[i].id}'),
                    ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

String formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  final kb = bytes / 1024;
  if (kb < 1024) return '${kb.toStringAsFixed(1)} KB';
  return '${(kb / 1024).toStringAsFixed(1)} MB';
}

class PacksScreen extends StatelessWidget {
  const PacksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final p = LgPalette.of(context);
    final content = context.services.content;
    return LgPage(
      title: l.libPacks,
      children: [
        ContentGate(
          builder: (context, pack) {
            final m = content.manifest!;
            return LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(l.packsCoreTitle, style: text.titleMedium),
                      ),
                      LgTag(l.packsInstalled, icon: Icons.check_rounded),
                    ],
                  ),
                  const SizedBox(height: 8),
                  for (final line in [
                    l.packsVersion(m.version),
                    l.packsSize(formatBytes(m.totalSize)),
                    l.packsLanguages(
                      m.languages.map((e) => e.toUpperCase()).join(' · '),
                    ),
                  ])
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text(line, style: text.bodyMedium),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      l.packsLicence(m.licence),
                      style: text.bodySmall,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(Icons.verified_rounded, size: 18, color: p.brand),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          l.packsVerified,
                          style: text.bodySmall!.copyWith(color: p.brand),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
        LgSectionTitle(l.packsUpcoming),
        Text(l.packsUpcomingBody, style: text.bodyMedium),
        const SizedBox(height: 8),
        for (final title in [
          l.packsBiochem,
          l.packsSpecimensQc,
          l.packsMicroscopy,
        ])
          LgPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.titleMedium),
                const SizedBox(height: 4),
                Text('UZ · RU · EN', style: text.bodySmall),
                const SizedBox(height: 10),
                LgTag(l.packsNotPublished, tone: LgTone.neutral),
                const SizedBox(height: 12),
                // Yuklab bo'lmaydigan tugma muvaffaqiyat ko'rsatmaydi:
                // u o'chirilgan va sababi yozilgan.
                LgButton.secondary(
                  label: l.notAvailableYet,
                  icon: Icons.download_rounded,
                  onPressed: null,
                ),
              ],
            ),
          ),
      ],
    );
  }
}

String categoryLabel(LibraryCategory c, AppLocalizations l) => switch (c) {
  LibraryCategory.biochemistry => l.catBiochemistry,
  LibraryCategory.clinicalLab => l.catClinicalLab,
  LibraryCategory.instruments => l.catInstruments,
  LibraryCategory.methods => l.catMethods,
  LibraryCategory.tests => l.catTests,
};

String kindLabel(LibraryItemKind k, AppLocalizations l) => switch (k) {
  LibraryItemKind.book => l.kindBook,
  LibraryItemKind.manual => l.kindManual,
  LibraryItemKind.method => l.kindMethod,
  LibraryItemKind.ifu => l.kindIfu,
  LibraryItemKind.article => l.kindArticle,
  LibraryItemKind.questionSet => l.kindQuestionSet,
};

/// Kitoblar, qo'llanmalar, metodikalar katalogi. Yangi adabiyot kontent
/// paketiga `library` yozuvi sifatida qo'shiladi — ilova kodi o'zgarmaydi.
class BooksScreen extends StatefulWidget {
  const BooksScreen({super.key});

  @override
  State<BooksScreen> createState() => _BooksScreenState();
}

class _BooksScreenState extends State<BooksScreen> {
  LibraryCategory? _category;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return LgPage(
      title: l.libBooks,
      children: [
        ContentGate(
          builder: (context, pack) {
            if (pack.library.isEmpty) {
              return LgStateView(
                kind: StateKind.empty,
                title: l.booksEmptyTitle,
                message: l.booksEmptyBody,
              );
            }
            final items = pack.library
                .where(
                  (i) => _category == null || i.categories.contains(_category),
                )
                .toList();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  clipBehavior: Clip.none,
                  child: Row(
                    children: [
                      LgChoiceChip(
                        label: l.testsFilterAll,
                        selected: _category == null,
                        onTap: () => setState(() => _category = null),
                      ),
                      for (final c in LibraryCategory.values) ...[
                        const SizedBox(width: 6),
                        LgChoiceChip(
                          label: categoryLabel(c, l),
                          selected: _category == c,
                          onTap: () => setState(
                            () => _category = _category == c ? null : c,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                if (items.isEmpty)
                  LgStateView(kind: StateKind.empty, title: l.testsEmptyTitle)
                else
                  for (final item in items) LibraryItemCard(item: item),
                LgNotice(l.booksEmptyBody, kind: NoticeKind.info),
              ],
            );
          },
        ),
      ],
    );
  }
}

class LibraryItemCard extends StatelessWidget {
  const LibraryItemCard({super.key, required this.item});

  final LibraryItem item;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final pack = context.services.content.pack;
    final older = item.supersedes == null
        ? null
        : pack?.libraryItem(item.supersedes!);
    final meta = [
      kindLabel(item.kind, l),
      if (item.authors.isNotEmpty) item.authors.join(', '),
      if (item.year != null) '${item.year}',
      if (item.edition != null) item.edition!,
      item.language.toUpperCase(),
    ].join(' · ');
    final shared = item.filePack != null && item.rights.allowsSharedPack;
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.title, style: text.titleMedium),
          const SizedBox(height: 4),
          Text(meta, style: text.bodySmall),
          if (older != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                l.libItemSupersedes(older.title),
                style: text.bodySmall,
              ),
            ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final c in item.categories)
                LgTag(categoryLabel(c, l), tone: LgTone.neutral),
              LgTag(
                rightsLabel(item.rights.distribution, l),
                tone: item.rights.allowsSharedPack
                    ? LgTone.brand
                    : LgTone.warning,
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Paket yuklash infratuzilmasi (C bosqich) ulanmaguncha tugma
          // o'chirilgan — muvaffaqiyat ko'rsatilmaydi.
          LgButton.secondary(
            label: shared
                ? '${l.libItemPack(formatBytes(item.filePack!.size))} · '
                      '${l.notAvailableYet}'
                : l.libItemNoPack,
            icon: Icons.download_rounded,
            onPressed: null,
          ),
        ],
      ),
    );
  }
}

/// Domla/tekshiruvchi uchun: manbalar orasidagi ochiq farqlar va
/// tasdiqlanmagan (draft) kontent soni.
class ReviewQueueScreen extends StatelessWidget {
  const ReviewQueueScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return LgPage(
      title: l.libReview,
      children: [
        ContentGate(
          builder: (context, pack) {
            final draftQuestions = pack.quiz.where((q) => q.isDraft).length;
            final draftCards = pack.analytes
                .where((a) => !a.isReviewerApproved)
                .length;
            final open = pack.openDiscrepancies;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LgPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l.reviewDraftCards(draftCards),
                        style: text.bodyLarge,
                      ),
                      Text(
                        l.reviewDraftQuestions(draftQuestions),
                        style: text.bodyLarge,
                      ),
                      Text(
                        l.reviewCatalog(pack.library.length),
                        style: text.bodyLarge,
                      ),
                    ],
                  ),
                ),
                LgSectionTitle(l.reviewDiscrepancies),
                Text(l.reviewDiscrepanciesBody, style: text.bodyMedium),
                const SizedBox(height: 8),
                if (open.isEmpty)
                  LgStateView(
                    kind: StateKind.empty,
                    title: l.reviewNoDiscrepancies,
                  )
                else
                  for (final d in open) _DiscrepancyCard(pack: pack, d: d),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _DiscrepancyCard extends StatelessWidget {
  const _DiscrepancyCard({required this.pack, required this.d});

  final ContentPack pack;
  final Discrepancy d;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final lang = Localizations.localeOf(context).languageCode;
    final subject =
        pack.analyte(d.subjectId)?.names.of(lang) ??
        pack.lessons
            .where((x) => x.id == d.subjectId)
            .firstOrNull
            ?.title
            .of(lang) ??
        d.subjectId;
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(subject, style: text.titleMedium),
          Text(l.reviewField(d.field), style: text.bodySmall),
          for (final pos in d.positions) ...[
            const SizedBox(height: 10),
            Text(
              [
                pack.source(pos.ref.sourceId)?.title ?? pos.ref.sourceId,
                if (pos.ref.pages != null) l.citePage(pos.ref.pages!),
              ].join(' · '),
              style: text.titleSmall,
            ),
            Text(pos.statement, style: text.bodyMedium),
          ],
        ],
      ),
    );
  }
}

class SourcesScreen extends StatelessWidget {
  const SourcesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return LgPage(
      title: l.sourcesTitle,
      children: [
        Text(l.sourcesBody, style: text.bodyMedium),
        const SizedBox(height: 8),
        ContentGate(
          builder: (context, pack) => LgPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < pack.sources.length; i++)
                  SourceTile(index: i + 1, source: pack.sources[i]),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Ilmiy ish / dars rejasi maydoni. Qoralama faqat shu qurilmada
/// saqlanadi; ilova natija yoki iqtibos yaratmaydi.
class ResearchScreen extends StatefulWidget {
  const ResearchScreen({super.key, this.lessonPlan = false});

  final bool lessonPlan;

  @override
  State<ResearchScreen> createState() => _ResearchScreenState();
}

class _ResearchScreenState extends State<ResearchScreen> {
  late final KeyValueStore _store = context.services.store;
  late final String _questionKey = widget.lessonPlan
      ? StoreKeys.lessonQuestion
      : StoreKeys.researchQuestion;
  late final String _notesKey = widget.lessonPlan
      ? StoreKeys.lessonNotes
      : StoreKeys.researchNotes;
  late final _question = TextEditingController(
    text: _store.getString(_questionKey) ?? '',
  );
  late final _notes = TextEditingController(
    text: _store.getString(_notesKey) ?? '',
  );
  bool _showOutline = false;

  @override
  void dispose() {
    _question.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final l = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    await _store.setString(_questionKey, _question.text);
    await _store.setString(_notesKey, _notes.text);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l.researchSaved)));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return LgPage(
      title: widget.lessonPlan ? l.learnLessonPlan : l.researchTitle,
      children: [
        LgField(
          label: l.researchQuestion,
          controller: _question,
          hint: l.researchQuestionHint,
          textInputAction: TextInputAction.next,
        ),
        LgField(
          label: l.researchNotes,
          controller: _notes,
          hint: l.researchNotesHint,
          maxLines: 6,
          keyboardType: TextInputType.multiline,
        ),
        const SizedBox(height: 16),
        LgButton(label: l.researchSave, onPressed: _save),
        const SizedBox(height: 10),
        LgButton.secondary(
          label: l.researchOutline,
          icon: _showOutline
              ? Icons.expand_less_rounded
              : Icons.expand_more_rounded,
          onPressed: () => setState(() => _showOutline = !_showOutline),
        ),
        if (_showOutline)
          LgPanel(
            child: LgSteps([
              l.researchStep1,
              l.researchStep2,
              l.researchStep3,
              l.researchStep4,
            ]),
          ),
        const SizedBox(height: 8),
        Text(l.researchNoFabrication, style: text.bodySmall),
      ],
    );
  }
}
