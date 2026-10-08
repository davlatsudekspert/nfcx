import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/app_scope.dart';
import '../../../app/widgets/lg_page.dart';
import '../../../design/tokens.dart';
import '../../../design/widgets/lg_widgets.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../content_model.dart';
import 'content_widgets.dart';

String sectionTitle(String id, AppLocalizations l) => switch (id) {
  'purpose' => l.sectionPurpose,
  'physiology' => l.sectionPhysiology,
  'high_result' => l.sectionHighResult,
  'low_result' => l.sectionLowResult,
  'preanalytics' => l.sectionPreanalytics,
  'interference' => l.sectionInterference,
  'related_tests' => l.analyteRelated,
  'limitations' => l.sectionLimitations,
  _ => id,
};

/// Raqamni ortiqcha nolsiz ko'rsatish (100 → "100", 5.55 → "5.55").
String formatNumber(double v) =>
    v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

String formatLimit(DecisionLimit d) {
  final unit = d.unit;
  if (d.low != null && d.high != null) {
    return '${formatNumber(d.low!)}–${formatNumber(d.high!)} $unit';
  }
  if (d.low != null) return '≥ ${formatNumber(d.low!)} $unit';
  if (d.high != null) return '≤ ${formatNumber(d.high!)} $unit';
  return unit;
}

class AnalyteScreen extends StatelessWidget {
  const AnalyteScreen({super.key, required this.analyteId});

  final String analyteId;

  @override
  Widget build(BuildContext context) {
    final content = context.services.content;
    return ListenableBuilder(
      listenable: content,
      builder: (context, _) {
        final l = AppLocalizations.of(context);
        final lang = Localizations.localeOf(context).languageCode;
        final pack = content.pack;
        final analyte = pack?.analyte(analyteId);
        if (pack == null || analyte == null) {
          // Yuklanmoqda / xato holatini ContentGate ko'rsatadi; paket tayyor
          // bo'lsa-yu analit topilmasa — "topilmadi".
          return LgPage(
            title: l.testsTitle,
            children: [
              ContentGate(
                builder: (context, _) => LgStateView(
                  kind: StateKind.empty,
                  title: l.analyteNotFound,
                  actionLabel: l.actionBack,
                  onAction: () => context.pop(),
                ),
              ),
            ],
          );
        }
        return LgPage(
          title: analyte.names.of(lang),
          subtitle:
              analyte.tagline?.of(lang) ??
              pack.group(analyte.group)?.names.of(lang),
          children: _AnalyteBody(
            pack: pack,
            analyte: analyte,
            lang: lang,
          ).build(context),
        );
      },
    );
  }
}

/// Karta tarkibini yig'uvchi (LgPage ro'yxatiga to'g'ridan-to'g'ri
/// elementlar sifatida beriladi — ichma-ich scroll yo'q).
class _AnalyteBody {
  _AnalyteBody({required this.pack, required this.analyte, required this.lang});

  final ContentPack pack;
  final Analyte analyte;
  final String lang;

  /// Manba raqami kartadagi tartib bo'yicha: [1], kitob bo'lsa sahifa
  /// bilan — [1, 45-bet].
  String cite(List<SourceRef> refs, AppLocalizations l) => refs
      .map((r) {
        final n = analyte.sourceIds.indexOf(r.sourceId) + 1;
        return r.pages == null ? '[$n]' : '[$n, ${l.citePage(r.pages!)}]';
      })
      .join('');

  List<Widget> build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final location = GoRouterState.of(context).matchedLocation;
    final base = location.substring(0, location.indexOf('/analyte/'));
    final structureOnly = analyte.contentState == ContentState.structureOnly;
    final group = pack.group(analyte.group);

    return [
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          LgTag(
            contentStateLabel(analyte, l),
            tone: contentStateTone(analyte),
            icon: structureOnly
                ? Icons.construction_rounded
                : Icons.menu_book_rounded,
          ),
          // Subtitle allaqachon guruh nomi bo'lsa, takrorlanmaydi.
          if (group != null && analyte.tagline != null)
            LgTag(group.names.of(lang), tone: LgTone.neutral),
        ],
      ),
      const SizedBox(height: 12),
      _BookmarkButton(analyteId: analyte.id),
      const SizedBox(height: 6),
      if (structureOnly)
        LgNotice(l.analyteStructureOnlyBody, title: l.analyteStructureOnlyTitle)
      else
        LgNotice(l.analyteSampleNotice),
      if (!structureOnly) _glance(context, l),
      if (structureOnly)
        _structureOutline(context, l)
      else
        for (final s in analyte.sections)
          if (s != 'related_tests') _section(context, l, s),
      if (!structureOnly) ...[
        _referenceIntervals(context, l),
        if (analyte.decisionLimits.isNotEmpty) _decisionLimits(context, l),
      ],
      LgNotice(l.analyteNoInterpretation, kind: NoticeKind.info),
      if (analyte.related.isNotEmpty) ...[
        LgSectionTitle(l.analyteRelated),
        for (final id in analyte.related)
          if (pack.analyte(id) case final related?)
            AnalyteRow(
              analyte: related,
              onTap: () => context.push('$base/analyte/${related.id}'),
            ),
      ],
      const SizedBox(height: 8),
      if (analyte.conversion != null)
        LgRow(
          title: l.analyteConvertUnits,
          subtitle: l.analyteConvertUnitsSub,
          icon: Icons.swap_vert_rounded,
          onTap: () => context.push('$location/units'),
        ),
      LgRow(
        title: l.analyteMethodCalibration,
        subtitle: l.analyteMethodCalibrationSub,
        icon: Icons.tune_rounded,
        onTap: () => context.go('/lab/calibration'),
      ),
      LgRow(
        title: l.analytePractice,
        subtitle: l.analytePracticeSub,
        icon: Icons.quiz_outlined,
        onTap: () => context.go('/learn/quiz'),
        divider: false,
      ),
      if (analyte.sourceIds.isNotEmpty) _sources(context, l),
      _review(context, l, text),
    ];
  }

  Widget _glance(BuildContext context, AppLocalizations l) {
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l.analyteAtAGlance,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          if (analyte.specimen != null)
            LgMetric(
              label: l.analyteSpecimen,
              value: analyte.specimen!.of(lang),
            ),
          if (analyte.population != null)
            LgMetric(
              label: l.analytePopulation,
              value: analyte.population!.of(lang),
            ),
          LgMetric(
            label: l.analyteMethod,
            value: analyte.method ?? l.analyteMethodNotSet,
          ),
          if (analyte.units.isNotEmpty)
            LgMetric(label: l.analyteUnits, value: analyte.units.join(' · ')),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, AppLocalizations l, String id) {
    final text = Theme.of(context).textTheme;
    final claims = analyte.claimsFor(id);
    final note = analyte.notes[id];
    final empty = claims.isEmpty && note == null;
    return _Expandable(
      title: sectionTitle(id, l),
      initiallyExpanded: !empty,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final c in claims)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '${c.text.of(lang)} ${cite(c.refs, l)}',
                style: text.bodyLarge,
              ),
            ),
          if (note != null) Text(note.of(lang), style: text.bodyMedium),
          if (empty) Text(l.analyteNotWritten, style: text.bodyMedium),
        ],
      ),
    );
  }

  Widget _structureOutline(BuildContext context, AppLocalizations l) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final s in [
            ...analyte.sections.where((s) => s != 'related_tests'),
          ])
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Icon(
                    Icons.radio_button_unchecked_rounded,
                    size: 18,
                    color: p.sub,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(sectionTitle(s, l), style: text.titleSmall),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(l.analyteNotWritten, style: text.bodySmall),
          ),
        ],
      ),
    );
  }

  Widget _referenceIntervals(BuildContext context, AppLocalizations l) {
    final text = Theme.of(context).textTheme;
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.analyteRefIntervals, style: text.titleMedium),
          const SizedBox(height: 6),
          if (analyte.referenceIntervals.isEmpty)
            Text(l.analyteRefIntervalNone, style: text.bodyMedium)
          else
            for (final r in analyte.referenceIntervals)
              LgMetric(
                label: '${r.population.of(lang)} · ${r.method}',
                value:
                    '${r.low == null ? '' : formatNumber(r.low!)}–'
                    '${r.high == null ? '' : formatNumber(r.high!)} ${r.unit} '
                    '${cite(r.refs, l)}',
              ),
        ],
      ),
    );
  }

  Widget _decisionLimits(BuildContext context, AppLocalizations l) {
    final text = Theme.of(context).textTheme;
    final allRefs = {
      for (final d in analyte.decisionLimits)
        for (final r in d.refs) r.sourceId: r,
    }.values.toList();
    final populations = {
      for (final d in analyte.decisionLimits) d.population.of(lang),
    };
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LgTag(analyte.names.of(lang)),
          const SizedBox(height: 10),
          Text(
            '${l.analyteDecisionLimits} ${cite(allRefs, l)}',
            style: text.titleMedium,
          ),
          for (final pop in populations)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(pop, style: text.bodyMedium),
            ),
          const SizedBox(height: 6),
          for (final d in analyte.decisionLimits)
            LgMetric(label: formatLimit(d), value: d.label.of(lang)),
          for (final d in analyte.decisionLimits)
            if (d.note != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  '${d.note!.of(lang)} ${cite(d.refs, l)}',
                  style: text.bodySmall,
                ),
              ),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              l.analyteDecisionNotRef,
              style: text.bodySmall!.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sources(BuildContext context, AppLocalizations l) {
    final text = Theme.of(context).textTheme;
    return LgPanel(
      margin: const EdgeInsets.only(top: 18, bottom: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.analyteSources, style: text.titleMedium),
          const SizedBox(height: 4),
          for (var i = 0; i < analyte.sourceIds.length; i++)
            if (pack.source(analyte.sourceIds[i]) case final s?)
              SourceTile(index: i + 1, source: s),
        ],
      ),
    );
  }

  Widget _review(BuildContext context, AppLocalizations l, TextTheme text) {
    final approved = analyte.isReviewerApproved;
    final translationsPending = analyte.translationReview.values.any(
      (v) => v != 'approved',
    );
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.analyteReview, style: text.titleMedium),
          const SizedBox(height: 6),
          LgMetric(
            label: l.analyteReview,
            value: approved ? l.analyteReviewApproved : l.analyteReviewPending,
          ),
          if (!approved)
            LgMetric(label: '—', value: l.analyteReviewerNotAssigned),
          if (translationsPending)
            LgMetric(label: 'UZ · RU · EN', value: l.analyteTranslationPending),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              l.analyteContentVersion(pack.contentVersion),
              style: text.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

/// Manba: raqam, nashriyot, sarlavha, sanalar, yurisdiksiya. Veb-manba
/// havolasini ochish yoki nusxalash mumkin; kitob/qo'llanma uchun
/// mualliflar, yil va til ko'rsatiladi.
class SourceTile extends StatelessWidget {
  const SourceTile({super.key, required this.index, required this.source});

  final int index;
  final ContentSource source;

  Future<void> _open(BuildContext context, String url) async {
    var opened = false;
    try {
      opened = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
    } on Object {
      opened = false;
    }
    if (!opened && context.mounted) await _copy(context, url);
  }

  Future<void> _copy(BuildContext context, String url) async {
    final l = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    await Clipboard.setData(ClipboardData(text: url));
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l.linkCopied)));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final item = source.libraryItemId == null
        ? null
        : context.services.content.pack?.libraryItem(source.libraryItemId!);
    final meta = [
      if (item != null) ...[
        if (item.authors.isNotEmpty) item.authors.join(', '),
        if (item.year != null) '${item.year}',
        item.language.toUpperCase(),
      ],
      if (source.accessed != null) l.analyteSourceAccessed(source.accessed!),
      ?source.sourceDate,
      ?source.jurisdiction,
    ].join(' · ');
    final url = source.url;
    final title = Text(
      '[$index] ${source.publisher} · ${source.title}',
      style: text.titleSmall!.copyWith(
        color: url == null ? null : p.brand,
        decoration: url == null ? null : TextDecoration.underline,
        decorationColor: p.brand.withValues(alpha: 0.5),
      ),
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (url == null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: title,
            )
          else
            InkWell(
              onTap: () => _open(context, url),
              onLongPress: () => _copy(context, url),
              borderRadius: BorderRadius.circular(8),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: kMinTap),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: title),
                      const SizedBox(width: 6),
                      Icon(Icons.open_in_new_rounded, size: 18, color: p.brand),
                    ],
                  ),
                ),
              ),
            ),
          if (meta.isNotEmpty) Text(meta, style: text.bodySmall),
          if (source.note != null) Text(source.note!, style: text.bodySmall),
          Text(
            item == null
                ? l.analyteReuseRightsVerify
                : rightsLabel(item.rights.distribution, l),
            style: text.bodySmall,
          ),
        ],
      ),
    );
  }
}

String rightsLabel(DistributionRights r, AppLocalizations l) => switch (r) {
  DistributionRights.unknown => l.rightsUnknown,
  DistributionRights.personalOnly => l.rightsPersonal,
  DistributionRights.permitted => l.rightsPermitted,
  DistributionRights.denied => l.rightsDenied,
};

class _BookmarkButton extends StatelessWidget {
  const _BookmarkButton({required this.analyteId});

  final String analyteId;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final bookmarks = context.services.bookmarks;
    return ListenableBuilder(
      listenable: bookmarks,
      builder: (context, _) {
        final saved = bookmarks.contains(analyteId);
        return Semantics(
          toggled: saved,
          child: LgButton.secondary(
            label: saved ? l.analyteSaved : l.analyteSave,
            icon: saved ? Icons.bookmark_rounded : Icons.bookmark_add_outlined,
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final added = await bookmarks.toggle(analyteId);
              messenger
                ..hideCurrentSnackBar()
                ..showSnackBar(
                  SnackBar(
                    content: Text(
                      added ? l.analyteSavedToast : l.analyteRemovedToast,
                    ),
                  ),
                );
            },
          ),
        );
      },
    );
  }
}

/// Ochiladigan bo'lim (HTML `<details>` analogi). Sarlavha 44 px dan
/// past emas; holat screen readerga "expanded/collapsed" sifatida beriladi.
class _Expandable extends StatefulWidget {
  const _Expandable({
    required this.title,
    required this.child,
    this.initiallyExpanded = true,
  });

  final String title;
  final Widget child;
  final bool initiallyExpanded;

  @override
  State<_Expandable> createState() => _ExpandableState();
}

class _ExpandableState extends State<_Expandable> {
  late bool _open = widget.initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final duration = LgMotion.of(context, const Duration(milliseconds: 180));
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: p.line.withValues(alpha: 0.7)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            expanded: _open,
            button: true,
            child: InkWell(
              onTap: () => setState(() => _open = !_open),
              borderRadius: BorderRadius.circular(10),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 52),
                child: Row(
                  children: [
                    Expanded(
                      child: Semantics(
                        header: true,
                        child: Text(widget.title, style: text.titleMedium),
                      ),
                    ),
                    AnimatedRotation(
                      turns: _open ? 0.5 : 0,
                      duration: duration,
                      child: Icon(Icons.expand_more_rounded, color: p.sub),
                    ),
                  ],
                ),
              ),
            ),
          ),
          AnimatedSize(
            duration: duration,
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: _open
                ? Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: widget.child,
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ),
    );
  }
}
