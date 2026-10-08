import 'package:material_ui/material_ui.dart';

import '../../../app/app_scope.dart';
import '../../../design/widgets/lg_widgets.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../content_controller.dart';
import '../content_model.dart';

IconData groupIcon(String groupId) => switch (groupId) {
  'carbohydrate' => Icons.bubble_chart_outlined,
  'kidney' => Icons.water_drop_outlined,
  'liver' => Icons.healing_outlined,
  'lipids' => Icons.opacity_outlined,
  'proteins' => Icons.hub_outlined,
  'electrolytes' => Icons.bolt_outlined,
  'enzymes' => Icons.auto_awesome_outlined,
  'urine' => Icons.science_outlined,
  _ => Icons.biotech_outlined,
};

/// Kartaning tayyorlik holati — har doim matn bilan (rangga tayanmaydi).
String contentStateLabel(Analyte a, AppLocalizations l) =>
    switch (a.contentState) {
      ContentState.structureOnly => l.statusStructureOnly,
      ContentState.sourcedSample => l.statusSourcedSample,
      ContentState.reviewed => switch (a.status) {
        ContentStatus.published => l.statusPublished,
        ContentStatus.verified => l.statusVerified,
        ContentStatus.draft => l.statusDraft,
      },
    };

LgTone contentStateTone(Analyte a) => switch (a.contentState) {
  ContentState.structureOnly => LgTone.neutral,
  ContentState.sourcedSample => LgTone.warning,
  ContentState.reviewed => LgTone.brand,
};

class AnalyteRow extends StatelessWidget {
  const AnalyteRow({
    super.key,
    required this.analyte,
    required this.onTap,
    this.divider = true,
  });

  final Analyte analyte;
  final VoidCallback onTap;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final pack = context.services.content.pack;
    final group = pack?.group(analyte.group)?.names.of(lang);
    return LgRow(
      title: analyte.names.of(lang),
      subtitle: [?group, contentStateLabel(analyte, l)].join(' · '),
      icon: groupIcon(analyte.group),
      onTap: onTap,
      divider: divider,
    );
  }
}

/// Kontent paketi holatiga qarab: loading → spinner, failed → xato va
/// "qayta urinish", ready → [builder]. Tekshiruvdan o'tmagan ma'lumot hech
/// qachon ko'rsatilmaydi.
class ContentGate extends StatelessWidget {
  const ContentGate({super.key, required this.builder});

  final Widget Function(BuildContext context, ContentPack pack) builder;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final content = context.services.content;
    return ListenableBuilder(
      listenable: content,
      builder: (context, _) {
        final pack = content.pack;
        if (pack != null) return builder(context, pack);
        if (content.state == ContentLoadState.failed) {
          return LgStateView(
            kind: StateKind.error,
            title: l.contentErrorTitle,
            message: l.contentErrorBody,
            actionLabel: l.actionRetry,
            onAction: content.load,
          );
        }
        return LgStateView(kind: StateKind.loading, title: l.contentLoading);
      },
    );
  }
}
