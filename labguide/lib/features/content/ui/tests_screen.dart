import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../app/widgets/lg_page.dart';
import '../../../design/tokens.dart';
import '../../../design/widgets/lg_widgets.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../analyte_search.dart';
import '../content_model.dart';
import 'content_widgets.dart';

class TestsScreen extends StatefulWidget {
  const TestsScreen({super.key});

  @override
  State<TestsScreen> createState() => _TestsScreenState();
}

class _TestsScreenState extends State<TestsScreen> {
  final _query = TextEditingController();
  String? _group;
  AnalyteSearch? _search;

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _clear() {
    _query.clear();
    setState(() => _group = null);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    return LgPage(
      title: l.testsTitle,
      subtitle: l.testsSubtitle,
      showBrand: true,
      children: [
        _SearchBox(
          controller: _query,
          label: l.testsSearchLabel,
          hint: l.testsSearchHint,
          onChanged: (_) => setState(() {}),
        ),
        ContentGate(
          builder: (context, pack) {
            final search = _search?.pack == pack
                ? _search!
                : _search = AnalyteSearch(pack);
            final results = search.search(
              _query.text,
              groupId: _group,
              lang: lang,
            );
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _GroupFilter(
                  groups: pack.groups,
                  selected: _group,
                  lang: lang,
                  allLabel: l.testsFilterAll,
                  onSelect: (g) => setState(() => _group = g),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 6, bottom: 2),
                  child: Semantics(
                    liveRegion: true,
                    child: Text(
                      l.testsResultCount(results.length),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ),
                if (results.isEmpty)
                  LgStateView(
                    kind: StateKind.empty,
                    title: l.testsEmptyTitle,
                    message: l.testsEmptyBody,
                    actionLabel: l.testsClearSearch,
                    onAction: _clear,
                  )
                else
                  for (var i = 0; i < results.length; i++)
                    AnalyteRow(
                      analyte: results[i],
                      divider: i < results.length - 1,
                      onTap: () =>
                          context.push('/tests/analyte/${results[i].id}'),
                    ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SearchBox extends StatelessWidget {
  const _SearchBox({
    required this.controller,
    required this.label,
    required this.hint,
    required this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 10),
      child: Semantics(
        label: label,
        textField: true,
        child: TextField(
          controller: controller,
          onChanged: onChanged,
          textInputAction: TextInputAction.search,
          style: text.bodyLarge,
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(Icons.search_rounded, color: p.sub),
            suffixIcon: ValueListenableBuilder(
              valueListenable: controller,
              builder: (context, value, _) => value.text.isEmpty
                  ? const SizedBox.shrink()
                  : IconButton(
                      tooltip: AppLocalizations.of(context).testsClearSearch,
                      icon: Icon(Icons.close_rounded, color: p.sub),
                      onPressed: () {
                        controller.clear();
                        onChanged('');
                      },
                    ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(LgRadius.button),
              borderSide: BorderSide.none,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(LgRadius.button),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(LgRadius.button),
              borderSide: BorderSide(color: p.brand, width: 2),
            ),
          ),
        ),
      ),
    );
  }
}

class _GroupFilter extends StatelessWidget {
  const _GroupFilter({
    required this.groups,
    required this.selected,
    required this.lang,
    required this.allLabel,
    required this.onSelect,
  });

  final List<AnalyteGroup> groups;
  final String? selected;
  final String lang;
  final String allLabel;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      child: Row(
        children: [
          LgChoiceChip(
            label: allLabel,
            selected: selected == null,
            onTap: () => onSelect(null),
          ),
          for (final g in groups) ...[
            const SizedBox(width: 6),
            LgChoiceChip(
              label: g.names.of(lang),
              selected: selected == g.id,
              onTap: () => onSelect(selected == g.id ? null : g.id),
            ),
          ],
        ],
      ),
    );
  }
}
