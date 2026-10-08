import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../../app/app_scope.dart';
import '../../../app/shell.dart';
import '../../../app/widgets/lg_page.dart';
import '../../../app/widgets/links.dart';
import '../../../design/tokens.dart';
import '../../../design/widgets/lg_widgets.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../tools/calc_info.dart';
import '../../tools/clinical_calc_screens.dart';
import '../../tools/clinical_calculators.dart';
import '../../tools/tool_screens.dart';
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

String formatLimit(DecisionLimit d) => formatLimitWith(d, formatNumber, d.unit);

/// Chegarani [number] formatlovchi va [unit] bilan yozish (SI ekvivalenti
/// uchun ham — belgilar va qamrov bir xil).
String formatLimitWith(
  DecisionLimit d,
  String Function(double) number,
  String unit,
) {
  final lowSign = d.lowExclusive ? '>' : '≥';
  final highSign = d.highExclusive ? '<' : '≤';
  if (d.low != null && d.high != null) {
    if (!d.lowExclusive && !d.highExclusive) {
      return '${number(d.low!)}–${number(d.high!)} $unit';
    }
    return '$lowSign ${number(d.low!)}, $highSign ${number(d.high!)} $unit';
  }
  if (d.low != null) return '$lowSign ${number(d.low!)} $unit';
  if (d.high != null) return '$highSign ${number(d.high!)} $unit';
  return unit;
}

/// Oraliq: ikkala chegara — “a–b”, bittasi — “≥ a” yoki “≤ b”
/// (avval bir chegarali oraliq “–5” ko'rinishida chiqardi).
String formatRange(double? low, double? high, String unit) {
  if (low != null && high != null) {
    return '${formatNumber(low)}–${formatNumber(high)} $unit';
  }
  if (low != null) return '≥ ${formatNumber(low)} $unit';
  if (high != null) return '≤ ${formatNumber(high)} $unit';
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
  /// Bir manba bir da'voda ikki bo'limdan keltirilsa ham bir marta: [1].
  String cite(List<SourceRef> refs, AppLocalizations l) {
    final seen = <String>{};
    return refs
        .map((r) {
          final n = analyte.sourceIds.indexOf(r.sourceId) + 1;
          return r.pages == null ? '[$n]' : '[$n, ${l.citePage(r.pages!)}]';
        })
        .where(seen.add)
        .join('');
  }

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
      for (final c
          in calculatorsByAnalyte[analyte.id] ?? const <ClinicalCalc>[])
        LgRow(
          title: calcTitle(c, l),
          subtitle: l.analyteCalculatorSub,
          icon: calcIcon(c),
          onTap: () => openInTab(context, '/lab/calculators/${calcRoute(c)}'),
        ),
      LgRow(
        title: l.analyteMethodCalibration,
        subtitle: l.analyteMethodCalibrationSub,
        icon: Icons.tune_rounded,
        onTap: () => openInTab(context, '/lab/calibration'),
      ),
      // Shu analit bo'yicha savollar bo'lsa — o'sha joyning o'zida (tab
      // stacki saqlanadi); bo'lmasa — umumiy mashq bo'limi.
      if (pack.quiz.where((q) => q.topicIds.contains(analyte.id)).length
          case final n when n > 0)
        LgRow(
          title: l.analytePractice,
          subtitle: l.quizQuestionCount(n),
          icon: Icons.quiz_outlined,
          onTap: () => context.push('$location/quiz'),
          divider: false,
        )
      else
        LgRow(
          title: l.analytePractice,
          subtitle: l.analytePracticeSub,
          icon: Icons.quiz_outlined,
          onTap: () => openInTab(context, '/learn/quiz'),
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
                    '${formatRange(r.low, r.high, r.unit)} ${cite(r.refs, l)}',
              ),
        ],
      ),
    );
  }

  /// Har bir chegara alohida blokda: qiymat, nomi, qaysi aholiga tegishli,
  /// izoh va o'z manbasi. (Avval aholi va izohlar umumiy ro'yxatda edi —
  /// qaysi chegara qaysi aholiga tegishli ekani adashtirardi.)
  Widget _decisionLimits(BuildContext context, AppLocalizations l) {
    final text = Theme.of(context).textTheme;
    final p = LgPalette.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final limits = analyte.decisionLimits;
    final conversion = analyte.conversion;
    // mg/dL chegarasining SI ekvivalenti (O'zbekiston laboratoriyalari
    // asosan mmol/L beradi). Manbada yo'q — hisoblangan, belgilanadi.
    String? si(DecisionLimit d) {
      if (conversion == null || d.unit != 'mg/dL') return null;
      final micro = conversion.siUnit == 'µmol/L';
      final factor = (micro ? 10000 : 10) / conversion.molarMass;
      final digits = micro ? 0 : 1;
      final f = NumberFormat.decimalPatternDigits(
        locale: locale,
        decimalDigits: digits,
      );
      String n(double v) => f.format(roundHalfUp(v * factor, digits));
      return l.analyteSiApprox(formatLimitWith(d, n, conversion.siUnit));
    }

    final anySi = limits.any((d) => si(d) != null);
    return LgPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LgTag(analyte.names.of(lang)),
          const SizedBox(height: 10),
          Text(l.analyteDecisionLimits, style: text.titleMedium),
          for (final (i, d) in limits.indexed)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                border: i == limits.length - 1
                    ? null
                    : Border(
                        bottom: BorderSide(
                          color: p.line.withValues(alpha: 0.7),
                        ),
                      ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    spacing: 12,
                    runSpacing: 2,
                    children: [
                      Text(d.label.of(lang), style: text.bodyMedium),
                      Text(
                        '${formatLimit(d)} ${cite(d.refs, l)}',
                        style: text.titleSmall,
                      ),
                    ],
                  ),
                  if (si(d) case final siText?)
                    Align(
                      alignment: Alignment.centerRight,
                      child: Text(siText, style: text.bodyMedium),
                    ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(d.population.of(lang), style: text.bodySmall),
                  ),
                  if (d.note != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(d.note!.of(lang), style: text.bodySmall),
                    ),
                ],
              ),
            ),
          if (anySi)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                l.analyteSiNote(
                  conversion!.siUnit,
                  formatResult(conversion.molarMass, locale, maxDecimals: 3),
                ),
                style: text.bodySmall,
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
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
              onTap: () => openExternalLink(context, url),
              onLongPress: () => copyLink(context, url),
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
