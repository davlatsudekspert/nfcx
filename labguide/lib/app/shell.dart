import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../design/tokens.dart';
import '../l10n/gen/app_localizations.dart';

/// Besh tabli qobiq. Har bir tab o'z navigation stackini va scroll
/// holatini saqlaydi (StatefulShellRoute.indexedStack). Pastki menyu
/// scroll paytida yashirilmaydi — bo'limlarga kirish doim ochiq.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  void _select(int index) {
    // Faol tab qayta bosilsa — shu tab ildiziga qaytadi.
    shell.goBranch(index, initialLocation: index == shell.currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final tabs = [
      _Tab(Icons.home_outlined, Icons.home_rounded, l.navHome),
      _Tab(Icons.biotech_outlined, Icons.biotech_rounded, l.navTests),
      _Tab(Icons.science_outlined, Icons.science_rounded, l.navLab),
      _Tab(
        Icons.local_library_outlined,
        Icons.local_library_rounded,
        l.navLibrary,
      ),
      _Tab(Icons.school_outlined, Icons.school_rounded, l.navLearn),
    ];
    // Android "orqaga": tab ildizida bo'lsa va bu Bosh tab bo'lmasa —
    // avval Bosh tabga qaytadi, keyin ilovadan chiqadi.
    final atBranchRoot = !GoRouter.of(context).canPop();
    return PopScope(
      canPop: shell.currentIndex == 0 || !atBranchRoot,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && shell.currentIndex != 0) shell.goBranch(0);
      },
      child: Scaffold(
        body: shell,
        bottomNavigationBar: _TabBar(
          tabs: tabs,
          currentIndex: shell.currentIndex,
          onSelect: _select,
        ),
      ),
    );
  }
}

class _Tab {
  const _Tab(this.icon, this.activeIcon, this.label);

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

class _TabBar extends StatelessWidget {
  const _TabBar({
    required this.tabs,
    required this.currentIndex,
    required this.onSelect,
  });

  final List<_Tab> tabs;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final margin = width <= 360 ? 8.0 : 12.0;
    // Tab nomlari iOS/Android tab bar kabi cheklangan masshtabda: juda katta
    // shrift sozlamasida ham 5 ta nom bir qatorga sig'ishi uchun.
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.15,
      child: ColoredBox(
        color: p.bg,
        child: SafeArea(
          top: false,
          minimum: const EdgeInsets.only(bottom: 8),
          child: Padding(
            padding: EdgeInsets.fromLTRB(margin, 6, margin, 4),
            child: Center(
              heightFactor: 1,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: p.paper,
                    borderRadius: BorderRadius.circular(LgRadius.card),
                    boxShadow: [
                      BoxShadow(
                        color: p.shadow.withValues(alpha: 0.08),
                        blurRadius: 25,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(5),
                    child: Semantics(
                      container: true,
                      explicitChildNodes: true,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final layout = _TabLayout.compute(
                            context,
                            labels: [for (final t in tabs) t.label],
                            width: constraints.maxWidth,
                          );
                          return Row(
                            children: [
                              for (var i = 0; i < tabs.length; i++)
                                Expanded(
                                  flex: layout.flex[i],
                                  child: _TabButton(
                                    tab: tabs[i],
                                    selected: i == currentIndex,
                                    onTap: () => onSelect(i),
                                    labelScaler: layout.scaler,
                                  ),
                                ),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

TextStyle tabLabelStyle(
  TextTheme text, {
  required bool selected,
  Color? color,
}) => text.labelSmall!.copyWith(
  color: color,
  letterSpacing: -0.1,
  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
);

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.tab,
    required this.selected,
    required this.onTap,
    required this.labelScaler,
  });

  final _Tab tab;
  final bool selected;
  final VoidCallback onTap;
  final TextScaler labelScaler;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final color = selected ? p.brand : p.sub;
    final duration = LgMotion.of(context, const Duration(milliseconds: 180));
    return Semantics(
      selected: selected,
      button: true,
      label: tab.label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: AnimatedContainer(
          duration: duration,
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 2),
          decoration: BoxDecoration(
            color: selected ? p.soft : Colors.transparent,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                selected ? tab.activeIcon : tab.icon,
                size: 23,
                color: color,
              ),
              const SizedBox(height: 4),
              Text(
                tab.label,
                maxLines: 1,
                softWrap: false,
                overflow: TextOverflow.fade,
                textAlign: TextAlign.center,
                textScaler: labelScaler,
                style: tabLabelStyle(text, selected: selected, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tab kengliklari va nom masshtabi.
///
/// * Joy yetsa — teng kenglik, nomlar 1.15 gacha kattalashadi.
/// * Biror nom teng ulushga sig'masa (masalan, 320 px da "Библиотека") —
///   kengliklar nom uzunligiga mutanosib taqsimlanadi, har tab ≥ 44 px.
/// * Shunda ham sig'masa — masshtab 1.0 (11 px) ga qaytadi. Matn hech
///   qachon 11 px dan kichraymaydi.
class _TabLayout {
  const _TabLayout(this.flex, this.scaler);

  final List<int> flex;
  final TextScaler scaler;

  static const _itemPadding = 4.0; // _TabButton gorizontal padding (2 + 2)
  static const _minItem = kMinTap + 4;

  static _TabLayout compute(
    BuildContext context, {
    required List<String> labels,
    required double width,
  }) {
    final text = Theme.of(context).textTheme;
    final style = tabLabelStyle(text, selected: true);
    final direction = Directionality.of(context);
    List<double> measure(TextScaler scaler) {
      final widths = <double>[];
      for (final l in labels) {
        final painter = TextPainter(
          text: TextSpan(text: l, style: style),
          textDirection: direction,
          textScaler: scaler,
          maxLines: 1,
        )..layout();
        widths.add(painter.width + _itemPadding);
        painter.dispose();
      }
      return widths;
    }

    final share = width / labels.length;
    for (final scaler in [
      MediaQuery.textScalerOf(context),
      TextScaler.noScaling,
    ]) {
      final widths = measure(scaler);
      if (widths.every((w) => w <= share)) {
        return _TabLayout(List.filled(labels.length, 1), scaler);
      }
      final needed = [for (final w in widths) w < _minItem ? _minItem : w];
      final total = needed.fold(0.0, (a, b) => a + b);
      if (total <= width) {
        return _TabLayout([for (final w in needed) (w * 10).round()], scaler);
      }
    }
    return _TabLayout(List.filled(labels.length, 1), TextScaler.noScaling);
  }
}
