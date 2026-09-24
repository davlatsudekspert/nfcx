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
    this.animateBackdrop = false,
  });

  final Widget body;
  final String? title;
  final Widget? leading;
  final List<Widget>? actions;
  final Widget? bottomNav;
  final bool showBack;
  final VoidCallback? onBack;
  final Widget? floating;

  /// Telefonning TIZIM paneli (jest chizig'i yoki 3 tugma) ostida
  /// kontent qolib ketmasligi uchun pastki bo'shliq.
  ///
  /// Ilgari bu maydon HECH NARSA qilmasdi (`padBottom ? null : null`)
  /// va karkas pastki inset'ni umuman hisobga olmasdi. Android 15
  /// ilovani chetdan-chetga chizadi, shuning uchun ro'yxatdan o'tish
  /// ekranidagi "Keyingi" tugmasi tizim tugmalari ostida qolib
  /// ketardi (egasi, 2026-09 surat).
  ///
  /// Asosiy tablar (`false` beradi) o'z pastki bo'shlig'ini
  /// `navSafeBottom` bilan o'zi hisoblaydi — ular suzuvchi menyu
  /// ostida turadi.
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
                Expanded(
                  child: bottomNav == null && padBottom
                      ? SafeArea(top: false, child: body)
                      : body,
                ),
                // PASTKI PANEL ("Saqlash") KLAVIATURA USTIDA.
                //
                // `Scaffold.bottomNavigationBar` klaviaturaga qaramaydi —
                // ekran pastiga mixlanadi va klaviatura ochilganda uning
                // ORTIDA qolardi: maydonni to'ldirgan odam saqlash uchun
                // klaviaturani yopishi kerak edi. Tana esa klaviatura
                // ustida tugaydi, shuning uchun panel shu yerda.
                if (bottomNav != null) SafeArea(top: false, child: bottomNav!),
              ],
            ),
          ),
        ),
        floatingActionButton: floating,
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

/// Suzuvchi pastki navigatsiya ostida kontent qolib ketmasligi uchun
/// kerakli pastki bo'shliq.
///
/// `NovaBottomNav` 64px, uning ostida `Gap.md` hoshiya bor va hammasi
/// `SafeArea` ichida — ya'ni haqiqiy balandlik 76px + QURILMANING jest
/// paneli. Bu inset brauzerda NOL, shuning uchun suratlarda muammo
/// ko'rinmaydi; jest panelli Android'da esa 34–48px bo'ladi va qat'iy
/// 120px bo'shliq yetmay qoladi.
///
/// 120 — dizayndagi "nafas" oralig'i, uning ustiga qurilma inset'i
/// qo'shiladi. Inset nol bo'lsa natija o'zgarmaydi.
double navSafeBottom(BuildContext context) =>
    120 + MediaQuery.viewPaddingOf(context).bottom;

/// Ekran ichidagi oddiy scroll — hamma joyda bir xil padding va
/// "bounce" xatti-harakati bilan.
class NovaScroll extends StatelessWidget {
  const NovaScroll({
    super.key,
    required this.children,
    this.padding,
    this.controller,
    this.tail,
  });

  final List<Widget> children;
  final EdgeInsets? padding;
  final ScrollController? controller;

  /// [children] dan keyin keladigan SLIVER (masalan, profil
  /// postlari to'ri) — o'sha padding ichida.
  ///
  /// Uzun to'rni oddiy vidjet qilib `children` ga qo'yib bo'lmaydi:
  /// u bitta element bo'lib, ekranga yaqinlashishi bilan ICHIDAGI
  /// HAMMA katakchani birdan quradi. Sliver esa faqat ko'rinadiganini.
  /// `null` bo'lsa — avvalgi `ListView`, hech narsa o'zgarmaydi.
  final Widget? tail;

  @override
  Widget build(BuildContext context) {
    final pad = padding ??
        EdgeInsets.fromLTRB(
          Gap.screenX,
          Gap.sm,
          Gap.screenX,
          navSafeBottom(context),
        );
    const physics = BouncingScrollPhysics(
      parent: AlwaysScrollableScrollPhysics(),
    );
    final tail = this.tail;
    if (tail == null) {
      return ListView(
        controller: controller,
        padding: pad,
        physics: physics,
        children: children,
      );
    }
    return CustomScrollView(
      controller: controller,
      physics: physics,
      slivers: [
        SliverPadding(
          padding: pad,
          sliver: SliverMainAxisGroup(slivers: [
            SliverList.list(children: children),
            tail,
          ]),
        ),
      ],
    );
  }
}
