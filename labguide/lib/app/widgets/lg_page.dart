import 'package:flutter/rendering.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/tokens.dart';
import '../../design/widgets/collapse_hysteresis.dart';
import '../../features/settings/settings_controller.dart';
import '../../l10n/gen/app_localizations.dart';
import '../app_scope.dart';
import '../shell.dart';

/// Ilovadagi har bir ekran skeleti.
///
/// * Yuqori panel: brend (yoki orqaga tugmasi), til, profil.
/// * Katta sarlavha bloki: kontent pastga surilganda ixcham toolbar
///   holatiga o'tadi, yuqoriga qaytganda kengayadi ([CollapseHysteresis],
///   14 px). Animatsiya 200 ms; reduced motion'da darhol.
/// * Kontent: planshetda 640 px dan kengaymaydi, telefonda 24/18 px gutter.
class LgPage extends StatefulWidget {
  const LgPage({
    super.key,
    required this.title,
    required this.children,
    this.subtitle,
    this.eyebrow,
    this.showBrand = false,
    this.showProfile = true,
    this.leadingHero,
  });

  final String title;
  final String? subtitle;
  final String? eyebrow;
  final List<Widget> children;

  /// Tab ildiz ekranlarida: kengaytirilgan holatda brend ko'rinadi.
  final bool showBrand;
  final bool showProfile;

  /// Sarlavhadan oldingi dekorativ blok (masalan, welcome rasmi).
  final Widget? leadingHero;

  @override
  State<LgPage> createState() => _LgPageState();
}

class _LgPageState extends State<LgPage> {
  final _logic = CollapseHysteresis();
  final _scroll = ScrollController();
  ScrollDirection _userDirection = ScrollDirection.idle;
  double _largeTitleExtent = 120;

  /// Oxirgi joylashuv qarori. Klaviatura ochiq paytda qayta hisoblanmaydi:
  /// balandlik kamayib sarlavha ro'yxatga ko'chsa, fokus va kiritilayotgan
  /// matn boshqa maydonga o'tib ketardi.
  bool? _pinned;

  /// Katta sarlavha o'lchandi; balandlik o'zgarsa (shrift, kenglik) —
  /// joylashuv qarori (ustida qotirilganmi yoki ro'yxat ichidami) qayta
  /// ko'riladi.
  void _measured(double height) {
    if ((height - _largeTitleExtent).abs() < 0.5) return;
    _largeTitleExtent = height;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  /// Kontent o'lchami o'zgardi (masalan, qidiruv natijasi bo'shab qoldi):
  /// endi scroll qilib bo'lmasa yoki tepada bo'lsa, ixcham sarlavha
  /// kengaytiriladi — aks holda Android'da u “qotib” qolardi.
  bool _onMetrics(ScrollMetricsNotification n) {
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    final m = n.metrics;
    if (_logic.collapsed &&
        (m.maxScrollExtent <= 0 || m.pixels <= _logic.topSnap) &&
        _logic.reset()) {
      setState(() {});
    }
    return false;
  }

  TabMemory? _tabs;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final tabs = TabMemoryScope.maybeOf(context);
    if (!identical(tabs, _tabs)) {
      _tabs?.removeListener(_onReselect);
      _tabs = tabs?..addListener(_onReselect);
    }
  }

  /// Faol tab qayta bosildi: shu sahifa ko'rinib turgan tab ildizi bo'lsa,
  /// ro'yxat tepaga suriladi va sarlavha kengayadi.
  void _onReselect() {
    if (!mounted || !_scroll.hasClients || _scroll.offset <= 0) return;
    if (!TickerMode.valuesOf(context).enabled) return;
    if (!(ModalRoute.of(context)?.isCurrent ?? false)) return;
    final duration = LgMotion.of(context, LgMotion.header) * 2;
    if (duration == Duration.zero) {
      _scroll.jumpTo(0);
    } else {
      _scroll.animateTo(0, duration: duration, curve: Curves.easeOutCubic);
    }
    if (_logic.reset()) setState(() {});
  }

  @override
  void dispose() {
    _tabs?.removeListener(_onReselect);
    _scroll.dispose();
    super.dispose();
  }

  bool _onScroll(ScrollNotification n) {
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    if (n is UserScrollNotification) {
      _userDirection = n.direction;
      return false;
    }
    if (n is ScrollUpdateNotification) {
      final userDriven =
          n.dragDetails != null || _userDirection != ScrollDirection.idle;
      final metrics = n.metrics;
      bool changed;
      if (userDriven) {
        changed = _logic.onScroll(
          pixels: metrics.pixels,
          delta: n.scrollDelta ?? 0,
          maxScrollExtent: metrics.maxScrollExtent,
          collapsibleExtent: _largeTitleExtent,
        );
      } else {
        // Dasturiy scroll (masalan, tepaga qaytish) — faqat tepada kengaytirish.
        changed = metrics.pixels <= _logic.topSnap && _logic.reset();
      }
      if (changed) setState(() {});
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final collapsed = _logic.collapsed;
    final duration = LgMotion.of(context, LgMotion.header);
    final media = MediaQuery.of(context);
    final insideShell = StatefulNavigationShell.maybeOf(context) != null;
    final canPop = Navigator.of(context).canPop();

    final largeTitle = _LargeTitle(
      eyebrow: widget.eyebrow,
      title: widget.title,
      subtitle: widget.subtitle,
      leadingHero: widget.leadingHero,
    );

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final gutter = LgSpace.gutter(constraints.maxWidth);
            final side = (constraints.maxWidth - LgSpace.maxContentWidth) / 2;
            final horizontal = side > gutter ? side : gutter;
            // Rasmli (welcome) sahifada sarlavha kontent bilan birga
            // suriladi. Qolgan sahifalarda katta sarlavha ro'yxat ustida
            // turadi va scroll yo'nalishiga qarab ixchamlashadi — lekin
            // past ekranda (landshaft telefon, katta shrift) u joyning katta
            // qismini egallab, kontentni ko'rinmas qilardi: bunda sarlavha
            // ham ro'yxat ichiga o'tadi.
            // Klaviatura ochilganda qaror o'zgarmaydi (yuqoridagi [_pinned]).
            // Shell Scaffold'i ichida MediaQuery.viewInsets allaqachon
            // olib tashlangan — klaviatura oynaning o'zidan aniqlanadi.
            final keyboardOpen = View.of(context).viewInsets.bottom > 0;
            final available = constraints.maxHeight;
            if (!keyboardOpen || _pinned == null) {
              _pinned =
                  widget.leadingHero == null &&
                  available >= 420 &&
                  _largeTitleExtent <= available * 0.4;
            }
            final pinned = _pinned!;
            if (!pinned && _logic.collapsed) _logic.reset();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _TopBar(
                  horizontal: horizontal,
                  title: widget.title,
                  collapsed: pinned && collapsed,
                  showBack: canPop,
                  showBrand: widget.showBrand,
                  showProfile: widget.showProfile,
                  duration: duration,
                ),
                if (pinned)
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: horizontal),
                    child: _CollapsibleTitle(
                      collapsed: collapsed,
                      duration: duration,
                      onMeasured: _measured,
                      child: largeTitle,
                    ),
                  ),
                Expanded(
                  child: NotificationListener<ScrollMetricsNotification>(
                    onNotification: pinned ? _onMetrics : null,
                    child: NotificationListener<ScrollNotification>(
                      onNotification: pinned ? _onScroll : null,
                      child: Scrollbar(
                        controller: _scroll,
                        child: ListView(
                          controller: _scroll,
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          padding: EdgeInsets.fromLTRB(
                            horizontal,
                            pinned ? 4 : 0,
                            horizontal,
                            32 + (insideShell ? 0 : media.padding.bottom),
                          ),
                          // Birinchi o'rin doim band: qaror o'zgarganda
                          // kontent elementlarining indeksi (va holati —
                          // fokus, kiritilgan matn) siljimaydi.
                          children: [
                            if (!pinned)
                              largeTitle
                            else
                              const SizedBox.shrink(),
                            ...widget.children,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _LargeTitle extends StatelessWidget {
  const _LargeTitle({
    required this.title,
    this.eyebrow,
    this.subtitle,
    this.leadingHero,
  });

  final String title;
  final String? eyebrow;
  final String? subtitle;
  final Widget? leadingHero;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final narrow = MediaQuery.sizeOf(context).width <= 360;
    // Sarlavha allaqachon katta: juda katta shrift sozlamasida 1.3 dan
    // ortiq kattalashmaydi, qolgan matn to'liq masshtablanadi.
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3);
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (eyebrow != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                eyebrow!.toUpperCase(),
                style: text.labelSmall!.copyWith(
                  color: p.brand,
                  letterSpacing: 1.6,
                ),
              ),
            ),
          ?leadingHero,
          Semantics(
            header: true,
            child: FitLongWordText(
              title,
              textScaler: scaler,
              minFontSize: 24,
              style: text.displaySmall!.copyWith(fontSize: narrow ? 33 : 39),
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 10),
            Text(subtitle!, style: text.bodyMedium),
          ],
        ],
      ),
    );
  }
}

/// Katta sarlavhani balandligi bo'yicha yig'adi (Align.heightFactor) va
/// xiralashtiradi. Yig'ilganda semantik daraxtdan chiqariladi — sarlavha
/// toolbarda qoladi.
class _CollapsibleTitle extends StatelessWidget {
  const _CollapsibleTitle({
    required this.collapsed,
    required this.duration,
    required this.onMeasured,
    required this.child,
  });

  final bool collapsed;
  final Duration duration;
  final ValueChanged<double> onMeasured;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(end: collapsed ? 0 : 1),
      duration: duration,
      curve: Curves.easeOutCubic,
      builder: (context, t, child) => ExcludeSemantics(
        excluding: collapsed,
        child: IgnorePointer(
          ignoring: collapsed,
          child: ClipRect(
            child: Align(
              alignment: Alignment.bottomLeft,
              heightFactor: t,
              child: Opacity(opacity: t.clamp(0, 1), child: child),
            ),
          ),
        ),
      ),
      child: _MeasureHeight(onMeasured: onMeasured, child: child),
    );
  }
}

class _MeasureHeight extends SingleChildRenderObjectWidget {
  const _MeasureHeight({required this.onMeasured, super.child});

  final ValueChanged<double> onMeasured;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      _RenderMeasureHeight(onMeasured);

  @override
  void updateRenderObject(BuildContext context, _RenderMeasureHeight r) {
    r.onMeasured = onMeasured;
  }
}

class _RenderMeasureHeight extends RenderProxyBox {
  _RenderMeasureHeight(this.onMeasured);

  ValueChanged<double> onMeasured;

  @override
  void performLayout() {
    super.performLayout();
    onMeasured(size.height);
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.horizontal,
    required this.title,
    required this.collapsed,
    required this.showBack,
    required this.showBrand,
    required this.showProfile,
    required this.duration,
  });

  /// Kontent bilan bir xil gorizontal chegara (planshetda markazlashadi).
  final double horizontal;
  final String title;
  final bool collapsed;
  final bool showBack;
  final bool showBrand;
  final bool showProfile;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    final showTitle = collapsed || (!showBrand && !showBack);

    final Widget leading = showBack
        ? _IconCircle(
            icon: Icons.arrow_back_rounded,
            tooltip: l.actionBack,
            onTap: () => Navigator.of(context).maybePop(),
            filled: false,
          )
        : const _BrandMark();

    final Widget middle;
    if (showTitle) {
      middle = Semantics(
        header: collapsed,
        child: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: text.titleLarge,
        ),
      );
    } else if (!showBack && showBrand) {
      middle = const _BrandText();
    } else {
      middle = const SizedBox.shrink();
    }

    return ColoredBox(
      color: p.bg,
      child: Padding(
        padding: EdgeInsets.fromLTRB(horizontal - 6, 10, horizontal - 8, 8),
        child: Row(
          children: [
            leading,
            const SizedBox(width: 10),
            Expanded(
              child: AnimatedSwitcher(
                duration: duration,
                layoutBuilder: (current, previous) => Stack(
                  alignment: Alignment.centerLeft,
                  children: [...previous, ?current],
                ),
                child: KeyedSubtree(
                  key: ValueKey('$showTitle-$showBack'),
                  child: middle,
                ),
              ),
            ),
            const _LanguageButton(),
            if (showProfile)
              _IconCircle(
                icon: Icons.person_outline_rounded,
                tooltip: l.actionProfile,
                onTap: () => context.push('/profile'),
                filled: false,
              ),
          ],
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    return ExcludeSemantics(
      child: Container(
        width: 42,
        height: 42,
        margin: const EdgeInsets.only(left: 6),
        decoration: BoxDecoration(color: p.brand, shape: BoxShape.circle),
        child: Icon(Icons.science_outlined, color: p.onBrand, size: 21),
      ),
    );
  }
}

class _BrandText extends StatelessWidget {
  const _BrandText();

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final p = LgPalette.of(context);
    final taglineStyle = text.labelSmall!.copyWith(letterSpacing: 1.1);
    return LayoutBuilder(
      builder: (context, constraints) {
        // Tagline bir qatorga sig'masa ko'rsatilmaydi (11 px dan kichraytirish
        // yoki kesish o'rniga).
        final painter = TextPainter(
          text: TextSpan(text: l.appTagline, style: taglineStyle),
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
          maxLines: 1,
        )..layout(maxWidth: constraints.maxWidth);
        final fits = !painter.didExceedMaxLines;
        painter.dispose();
        // Brend sarlavha emas (sahifa sarlavhasi bitta bo'lsin); juda katta
        // shriftda 1.3 dan oshmaydi va sig'masa kichrayadi — kesilmaydi.
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                'LabGuide',
                maxLines: 1,
                textScaler: MediaQuery.textScalerOf(context)
                    .clamp(maxScaleFactor: 1.3),
                style: text.headlineSmall!.copyWith(
                  fontSize: 23,
                  letterSpacing: -1,
                  height: 1.1,
                  color: p.ink,
                ),
              ),
            ),
            if (fits) Text(l.appTagline, maxLines: 1, style: taglineStyle),
          ],
        );
      },
    );
  }
}

class _IconCircle extends StatelessWidget {
  const _IconCircle({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.filled = true,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final p = LgPalette.of(context);
    return Tooltip(
      message: tooltip,
      // onTap Semantics'da ham — excludeSemantics tap amalini olib tashlaydi.
      child: Semantics(
        button: true,
        label: tooltip,
        onTap: onTap,
        excludeSemantics: true,
        child: InkResponse(
          onTap: onTap,
          radius: 24,
          child: Container(
            width: kMinTap + 4,
            height: kMinTap + 4,
            alignment: Alignment.center,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: filled ? p.soft : Colors.transparent,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: p.ink, size: 23),
            ),
          ),
        ),
      ),
    );
  }
}

/// Yuqoridagi UZ/RU/EN tanlovchi. Til nomlari o'z tilida ko'rsatiladi.
class _LanguageButton extends StatelessWidget {
  const _LanguageButton();

  static const _native = {
    AppLanguage.uz: 'O‘zbekcha',
    AppLanguage.ru: 'Русский',
    AppLanguage.en: 'English',
  };

  @override
  Widget build(BuildContext context) {
    final settings = context.services.settings;
    final l = AppLocalizations.of(context);
    final p = LgPalette.of(context);
    final text = Theme.of(context).textTheme;
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) => PopupMenuButton<AppLanguage>(
        tooltip: l.actionLanguage,
        initialValue: settings.language,
        onSelected: settings.setLanguage,
        position: PopupMenuPosition.under,
        itemBuilder: (context) => [
          for (final lang in AppLanguage.values)
            CheckedPopupMenuItem<AppLanguage>(
              value: lang,
              checked: lang == settings.language,
              child: Text(_native[lang]!),
            ),
        ],
        child: Semantics(
          label: '${l.actionLanguage}: ${_native[settings.language]}',
          excludeSemantics: true,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: kMinTap + 4,
              minWidth: kMinTap + 4,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  settings.language.shortLabel,
                  style: text.labelMedium!.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Icon(Icons.expand_more_rounded, size: 18, color: p.sub),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Katta sarlavha: eng uzun so'z bir qatorga sig'maydigan bo'lsa (masalan,
/// "Аланинаминотрансфераза"), shrift [minFontSize] gacha kichrayadi — so'z
/// o'rtasidan bo'linmaydi. Qisqa so'zli matnga ta'sir qilmaydi.
class FitLongWordText extends StatelessWidget {
  const FitLongWordText(
    this.text, {
    super.key,
    required this.style,
    required this.minFontSize,
    this.textScaler,
  });

  final String text;
  final TextStyle style;
  final double minFontSize;
  final TextScaler? textScaler;

  @override
  Widget build(BuildContext context) {
    final scaler = textScaler ?? MediaQuery.textScalerOf(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final base = style.fontSize!;
        var widest = 0.0;
        for (final word in text.split(RegExp(r'\s+'))) {
          if (word.isEmpty) continue;
          final painter = TextPainter(
            text: TextSpan(text: word, style: style),
            textDirection: Directionality.of(context),
            textScaler: scaler,
            maxLines: 1,
          )..layout();
          if (painter.width > widest) widest = painter.width;
          painter.dispose();
        }
        var size = base;
        if (widest > constraints.maxWidth && widest > 0) {
          size = (base * constraints.maxWidth / widest).floorToDouble();
          if (size < minFontSize) size = minFontSize;
        }
        return Text(
          text,
          textScaler: scaler,
          style: size == base
              ? style
              : style.copyWith(
                  fontSize: size,
                  letterSpacing: (style.letterSpacing ?? 0) * size / base,
                ),
        );
      },
    );
  }
}
