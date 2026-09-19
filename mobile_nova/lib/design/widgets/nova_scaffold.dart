import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';
import '../tokens/nfc_tokens.dart';
import '../tokens/shapes.dart';
import 'backdrop.dart';
import 'buttons.dart';

/// Ilovaning har bir ekrani shu karkasdan foydalanadi.
///
/// U uchta narsani kafolatlaydi: ambient fon, to'g'ri status paneli
/// ranglari va `SafeArea`. Har ekranda buni qo'lda takrorlash bitta
/// ekranda unutilishiga va o'sha yerda kontent "notch" ostiga kirib
/// ketishiga olib kelardi.
class NovaScaffold extends StatelessWidget {
  const NovaScaffold({
    super.key,
    required this.body,
    this.title,
    this.leading,
    this.actions,
    this.bottomNav,
    this.showBack = false,
    this.onBack,
    this.floating,
    this.padBottom = true,
    this.animateBackdrop = true,
  });

  final Widget body;
  final String? title;
  final Widget? leading;
  final List<Widget>? actions;
  final Widget? bottomNav;
  final bool showBack;
  final VoidCallback? onBack;
  final Widget? floating;

  /// Bottom nav ostida kontent qolib ketmasligi uchun pastki bo'shliq.
  final bool padBottom;
  final bool animateBackdrop;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final hasBar = title != null || showBack || leading != null || actions != null;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: overlayFor(t),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        extendBody: true,
        resizeToAvoidBottomInset: true,
        body: AmbientBackdrop(
          animate: animateBackdrop,
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                if (hasBar) _Bar(
                  title: title,
                  leading: leading,
                  actions: actions,
                  showBack: showBack,
                  onBack: onBack,
                ),
                Expanded(child: body),
              ],
            ),
          ),
        ),
        floatingActionButton: floating,
        bottomNavigationBar: bottomNav == null
            ? (padBottom ? null : null)
            : SafeArea(top: false, child: bottomNav!),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({
    this.title,
    this.leading,
    this.actions,
    required this.showBack,
    this.onBack,
  });

  final String? title;
  final Widget? leading;
  final List<Widget>? actions;
  final bool showBack;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Gap.md, Gap.sm, Gap.md, Gap.xs),
      child: Row(
        children: [
          if (showBack)
            NovaIconButton(
              icon: Icons.arrow_back_rounded,
              tooltip: MaterialLocalizations.of(context).backButtonTooltip,
              onPressed: onBack ?? () => Navigator.of(context).maybePop(),
            )
          else if (leading != null)
            leading!
          else
            const SizedBox(width: Gap.sm),
          Expanded(
            child: title == null
                ? const SizedBox.shrink()
                : Padding(
                    padding: const EdgeInsets.symmetric(horizontal: Gap.md),
                    child: Text(
                      title!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
          ),
          ...?actions,
        ],
      ),
    );
  }
}

/// Ekran ichidagi oddiy scroll — hamma joyda bir xil padding va
/// "bounce" xatti-harakati bilan.
class NovaScroll extends StatelessWidget {
  const NovaScroll({
    super.key,
    required this.children,
    this.padding,
    this.controller,
  });

  final List<Widget> children;
  final EdgeInsets? padding;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) => ListView(
        controller: controller,
        padding: padding ??
            const EdgeInsets.fromLTRB(Gap.screenX, Gap.sm, Gap.screenX, 120),
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        children: children,
      );
}
