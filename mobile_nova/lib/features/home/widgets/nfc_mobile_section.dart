import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../design/theme/typography.dart';
import '../../../design/tokens/nfc_tokens.dart';
import '../../../design/tokens/shapes.dart';
import '../../../design/widgets/buttons.dart';
import '../../../design/widgets/surfaces.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../../routing/routes.dart';
import '../../demo/demo_data.dart';
import '../../social/media_frame.dart';

/// "NFC MOBILE" — bosh sahifadagi tanishtiruv bo'limi.
///
/// ## NIMA UCHUN KERAK
///
/// Ilovaga birinchi kirgan odam NFC ID nima, shaxsiy profil nima,
/// biznes profil nima — bilmaydi. Bosh sahifa esa unga darhol
/// o'zining BO'SH statistikasini ko'rsatadi. Bu bo'lim shu
/// bo'shliqni to'ldiradi: "mana shunday bo'ladi" deb KO'RSATADI.
///
/// ## KOMPOZITSIYA — HTML ETALONIDAN
///
/// Tuzilish `nfc_mobile_demo.html` prototipidan AYNAN ko'chirilgan:
/// bo'lim sarlavhasi va uning o'ng tomonidagi savol, 188 balandlikdagi
/// hero (sarlavha, matn, uchta chip ustun bo'lib, o'ng pastda surat),
/// keyin ikkita demo karta. Har bir karta: chapda nishon + ism +
/// rol + kod, o'ngda kvadrat surat; pastda uchta statistika qutisi,
/// kichik ko'rinishlar lentasi, to'liq kenglikdagi CTA va eslatma.
///
/// Matnlar ham prototipdan ko'chirilgan — o'zimdan qayta yozilmagan.
///
/// ## NIMA UCHUN RASM EMAS, ISHLAYDIGAN UI
///
/// Statik banner reklama bo'lib qoladi. Bu yerdagi har bir tugma
/// HAQIQIY ekranni ochadi — demo profil o'sha `ProfileScreen`, demo
/// do'kon o'sha `StorefrontScreen`.
///
/// ## RANG QAT'IY YOZILMAGAN
///
/// HTML'da mavzular CSS o'zgaruvchilari bilan almashardi
/// (`--surface`, `--accent`, `--line`, `--ink`). Bu yerda ularning
/// o'rnida `context.tokens` turadi, ya'ni mavzu almashganda fon,
/// sirt, hoshiya, nishon, statistika, CTA va yorug'lik BIRGA
/// o'zgaradi. Faylda birorta `Color(0x...)` yo'q.
class NfcMobileSection extends StatelessWidget {
  const NfcMobileSection({super.key});

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // HTML: <div class="section-head"><b>NFC MOBILE</b>
        //       <span>NFC bilan nimalar mumkin?</span></div>
        SectionHeader(title: l.demoSectionTitle, action: l.demoSectionHint),
        // HERO BANNER OLIB TASHLANDI.
        //
        // U ikkita kartaning ustida yana bir qatlam bo'lib turardi
        // va bo'limni cho'zib yuborardi. Endi bo'lim aynan ikkita
        // narsa: shaxsiy va biznes.
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: _PersonalCard(),
        ),
        const SizedBox(height: Gap.md),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: _BusinessCard(),
        ),
      ],
    );
  }
}

/// Bo'limning umumiy sirti — hero ham, kartalar ham bir xil ramkada.
///
/// HTML'da `.hero` va `.demo` bitta qoidani baham ko'rardi:
/// `linear-gradient(145deg, surface, surface2)`, 1px hoshiya,
/// 24 radius va yumshoq soya.
class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.padding, this.onTap});

  final Widget child;
  final EdgeInsets? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final body = Container(
      padding: padding ?? const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [t.surfaceSolid, t.surface2],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: t.border2),
        boxShadow: t.shadowSoft,
      ),
      child: child,
    );
    if (onTap == null) return body;
    return PressableScale(onTap: onTap!, child: body);
  }
}

// ------------------------------------------------------- demo kartalar

/// Nishon — HTML'dagi `.badge`.
class _Badge extends StatelessWidget {
  const _Badge(this.label, {this.mono = false, this.color});

  final String label;
  final bool mono;

  /// `null` — mavzuning asosiy matn rangi.
  ///
  /// HTML'da `.badge` `currentColor` ishlatardi, ya'ni HAMMA
  /// nishon matn rangida edi. Aksent rang berilganda ochiq
  /// mavzularda kontrast yetmay qolardi.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final c = color ?? t.text2;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.border2),
      ),
      child: Text(
        label,
        style: mono
            ? AppType.monoStyle(color: c, size: 11)
            : TextStyle(
                fontFamily: AppType.sans,
                fontSize: 9,
                fontWeight: FontWeight.w600,
                letterSpacing: .6,
                color: c,
              ),
      ),
    );
  }
}

/// Uchta statistika qutisi — HTML'dagi `.mini-stats`.
class _MiniStats extends StatelessWidget {
  const _MiniStats({required this.items});

  final List<(String, String)> items;

  // BITTA QATOR (2026-09-25). Ilgari har raqam alohida ramkali
  // qutida edi (HTML prototipidagi `.stats`) — ular joy olib,
  // ostidagi suratlar 44 px lik ingichka tasmaga qisilgan edi.
  // Demo kartada asosiysi — MAZMUN (suratlar), raqamlar faqat
  // ishora; shuning uchun ular bitta ixcham qatorga o'tdi.
  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final label = TextStyle(
      fontFamily: AppType.sans,
      fontSize: 11.5,
      color: t.text3,
    );
    return Text.rich(
      key: const ValueKey('demo-stats'),
      TextSpan(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) TextSpan(text: '   ·   ', style: label),
            TextSpan(
              text: items[i].$1,
              style: AppType.monoStyle(color: t.text1, size: 12.5),
            ),
            TextSpan(text: ' ${items[i].$2.toLowerCase()}', style: label),
          ],
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}

/// Kichik ko'rinishlar lentasi — HTML'dagi `.thumbs`.
///
/// Prototipda bular bo'sh gradient to'rtburchaklar edi. Bu yerda
/// ularning o'rnida DEMO PROFILNING HAQIQIY mazmuni turadi: odam
/// karta ichida allaqachon nimadir borligini ko'radi.
class _Thumbs extends StatelessWidget {
  const _Thumbs({required this.urls});

  final List<String> urls;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    // KVADRAT (2026-09-25): 44 px balandlikdagi tasmada surat
    // chetlaridan qirqilib, nima ekani tushunilmasdi. Endi har biri
    // to'liq kvadrat — post va tovar suratlari butun ko'rinadi.
    return Row(
      children: [
        for (var i = 0; i < urls.length; i++) ...[
          if (i > 0) const SizedBox(width: 7),
          Expanded(
            child: AspectRatio(
              aspectRatio: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: t.border2),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: mediaImage(context, urls[i], fit: BoxFit.cover),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Demo kartaning umumiy tanasi — ikkalasi bitta tuzilishda.
class _DemoCard extends StatelessWidget {
  const _DemoCard({
    required this.badge,
    required this.title,
    required this.role,
    required this.trailing,
    required this.image,
    required this.stats,
    required this.thumbs,
    required this.cta,
    required this.ctaIcon,
    required this.onTap,
  });

  final String badge;
  final String title;
  final String role;

  /// Ikkinchi nishon: shaxsiyda NFC kodi, bizneda "NFC ready".
  final Widget trailing;
  final String image;

  final List<(String, String)> stats;
  final List<String> thumbs;
  final String cta;
  final IconData ctaIcon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return _Panel(
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // HTML: `grid-template-columns: 1fr 126px`.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Badge(badge),
                    const SizedBox(height: Gap.sm),
                    Text(title, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 3),
                    Text(role, style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: Gap.md),
                    trailing,
                  ],
                ),
              ),
              const SizedBox(width: Gap.md),
              SizedBox(
                width: 118,
                height: 118,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: t.border2),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: mediaImage(context, image, fit: BoxFit.cover),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.md),
          _Thumbs(urls: thumbs),
          const SizedBox(height: 10),
          _MiniStats(items: stats),
          const SizedBox(height: Gap.md),
          NovaButton(label: cta, icon: ctaIcon, onPressed: onTap),
          const SizedBox(height: Gap.sm),
          Text(l.demoNotice, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

/// Raqamni bo'sh joy bilan ajratadi: `2840` → `2 840`.
String _n(int v) {
  final s = v.toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return '$b';
}

class _PersonalCard extends StatelessWidget {
  const _PersonalCard();

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return _DemoCard(
      badge: l.demoBadgePersonal,
      title: demoPersonalId.name,
      role: l.demoPersonalSubtitle,
      trailing: _Badge(demoPersonalId.code, mono: true, color: t.text1),
      image: kDemoPortrait,
      stats: [
        (_n(demoPersonalId.views), l.nfcViews),
        (_n(demoPersonalId.followers), l.profileFollowers),
        (_n(demoPersonalPosts.length), l.profilePosts),
      ],
      thumbs: demoPersonalPosts.map((p) => p.mediaUrls.first).toList(),
      cta: l.demoViewProfile,
      ctaIcon: Icons.arrow_forward_rounded,
      onTap: () => context.push(Routes.demoPersonal),
    );
  }
}

class _BusinessCard extends StatelessWidget {
  const _BusinessCard();

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);

    return _DemoCard(
      badge: l.demoBadgeBusiness,
      title: demoBusiness.displayName,
      role: l.demoBizSubtitle,
      // Biznes nishoni mavzuning BIZNES aksentida — shaxsiydan
      // farq qilishi ataylab, lekin u ham mavzudan keladi.
      trailing: _Badge(l.demoChipReady),
      image: kDemoStorefront,
      stats: [
        (_n(demoBusiness.views), l.nfcViews),
        (_n(demoBusiness.followers), l.profileFollowers),
        (_n(demoCatalog.length), l.bizCatalog),
      ],
      thumbs: demoCatalog.take(4).map((c) => c.imageUrl).toList(),
      cta: l.demoViewBusiness,
      ctaIcon: Icons.arrow_forward_rounded,
      onTap: () => context.push(Routes.demoBusiness),
    );
  }
}
