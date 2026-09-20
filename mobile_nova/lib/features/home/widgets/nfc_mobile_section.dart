import 'dart:math' as math;

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
/// biznes profil nima — bilmaydi. Bosh sahifa esa unga DARHOL
/// o'zining bo'sh statistikasini ko'rsatadi. Bu bo'lim shu
/// bo'shliqni to'ldiradi: "mana shunday bo'ladi" deb KO'RSATADI.
///
/// ## NIMA UCHUN RASM EMAS, ISHLAYDIGAN UI
///
/// Statik banner reklama bo'lib qoladi. Bu yerdagi har bir tugma
/// HAQIQIY ekranni ochadi — demo profil o'sha `ProfileScreen`,
/// demo do'kon o'sha `StorefrontScreen`. Ya'ni odam ko'rgan narsa
/// mahsulotning o'zi, uning rasmi emas.
///
/// ## TELEFON MAKETLARI NIMA UCHUN CHIZILGAN, YUKLANMAGAN
///
/// iPhone 18 va Samsung S26 maketlari Flutter ichida chiziladi.
/// Sabablari: ekran zichligi qanday bo'lsa ham tiniq chiqadi,
/// APK og'irlashmaydi, mavzu o'zgarganda rangi ham o'zgaradi va
/// birovning mahsulot rasmi ishlatilmaydi.
class NfcMobileSection extends StatelessWidget {
  const NfcMobileSection({super.key});

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: l.demoSectionTitle),
        Padding(
          padding: const EdgeInsets.fromLTRB(Gap.screenX, 0, Gap.screenX, Gap.md),
          child: Text(l.demoSectionHint,
              style: Theme.of(context).textTheme.bodySmall),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: _Hero(),
        ),
        const SizedBox(height: Gap.md),
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

// ------------------------------------------------------------ hero

class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    final text = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l.demoHeroTitle,
            style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(height: Gap.sm),
        Text(l.demoHeroBody, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: Gap.lg),
        Wrap(
          spacing: Gap.sm,
          runSpacing: Gap.sm,
          children: [
            Capsule(label: l.demoChipIphone, dense: true),
            Capsule(label: l.demoChipSamsung, dense: true),
            Capsule(label: l.demoChipReady, dense: true, selected: true),
          ],
        ),
      ],
    );

    return FloatingSurface(
      elevated: true,
      padding: const EdgeInsets.all(Gap.xl),
      borderRadius: R.organic(a: 34, b: 34, c: 34, d: 16),
      child: Stack(
        children: [
          // Yumshoq oltin yorug'lik — kartani "premium" qiladi,
          // lekin matnni bosib qo'ymaydi.
          Positioned(
            right: -60,
            top: -70,
            child: IgnorePointer(
              child: Container(
                width: 190,
                height: 190,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [t.glow.withValues(alpha: .40), Colors.transparent],
                  ),
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tor ekranda matn va maketlar YONMA-YON sig'maydi;
              // keng ekranda esa ustma-ust qo'yish joy isrof qiladi.
              LayoutBuilder(
                builder: (context, c) => c.maxWidth >= 460
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(child: text),
                          const SizedBox(width: Gap.lg),
                          const _PhonePair(),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          text,
                          const SizedBox(height: Gap.xl),
                          const Center(child: _PhonePair()),
                        ],
                      ),
              ),
              // TUGMALAR BU YERDA YO'Q.
              //
              // Ilgari hero ichida "Personal demo" va "Business
              // demo" turardi va pastdagi kartalarda ham o'sha
              // ikki amal takrorlanardi. Tor ekranda ikkala yorliq
              // ham qirqilib ("Personal ...") ko'rinardi. Endi
              // amal BITTA joyda — o'z kartasida.
            ],
          ),
        ],
      ),
    );
  }
}

/// Ikki telefon — biri shaxsiy profil, ikkinchisi biznes profil
/// ko'rsatadi. Aynan shu ikkitasi: "bu ilova ikkalasiga ham
/// yaraydi" degan fikr bitta qarashda yetib borsin.
class _PhonePair extends StatelessWidget {
  const _PhonePair();

  @override
  Widget build(BuildContext context) {
    // BALANDLIK YORLIQNI HAM O'Z ICHIGA OLADI.
    //
    // Ilgari bu yerda 216 turardi, telefon esa 110*2 = 220 edi —
    // ya'ni "iPhone 18" va "Samsung S26" yozuvlari quti tashqarisiga
    // chiqib, KESILIB qolardi. Suratda ular umuman ko'rinmasdi.
    return SizedBox(
      width: 210,
      height: 252,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            left: 0,
            top: 22,
            child: Transform.rotate(
              angle: -math.pi / 40,
              child: const _PhoneMock(
                // Mahsulot nomi — tarjima qilinmaydi. Ilgari bu
                // yerda `l.demoChipSamsung.split(' ').last` turardi
                // va u "ishlaydi" so'zini chiqarardi.
                label: 'Samsung S26',
                android: true,
                business: true,
                width: 96,
              ),
            ),
          ),
          Positioned(
            right: 0,
            top: 0,
            child: Transform.rotate(
              angle: math.pi / 34,
              child: const _PhoneMock(
                label: 'iPhone 18',
                android: false,
                business: false,
                width: 110,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bitta telefon maketi.
///
/// Ichidagi "ekran" — ilovaning soddalashtirilgan ko'rinishi:
/// muqova, avatar, ism satri, statistika va to'r. Maqsad aniq
/// piksel-aniq nusxa emas, bir qarashda tanilishi.
class _PhoneMock extends StatelessWidget {
  const _PhoneMock({
    required this.label,
    required this.android,
    required this.business,
    required this.width,
  });

  final String label;

  /// Android — teshikli kamera; iOS — cho'ziq "orolcha".
  final bool android;

  /// Ekranda biznes ko'rinishimi (katalog to'ri) yoki shaxsiy.
  final bool business;
  final double width;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final h = width * 2.0;
    final r = BorderRadius.circular(width * 0.18);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: width,
          height: h,
          padding: EdgeInsets.all(width * 0.035),
          decoration: BoxDecoration(
            color: t.onAccent,
            borderRadius: r,
            border: Border.all(color: t.border1, width: 1.2),
            boxShadow: t.shadowFloat,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(width * 0.15),
            child: Stack(
              children: [
                Positioned.fill(
                  child: Image.asset(
                    business ? 'assets/demo/b_cover.jpg' : 'assets/demo/p_cover.jpg',
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        DecoratedBox(decoration: BoxDecoration(gradient: t.accentGradient)),
                  ),
                ),
                Positioned.fill(
                  child: ColoredBox(color: Colors.black.withValues(alpha: .42)),
                ),
                Padding(
                  padding: EdgeInsets.all(width * 0.08),
                  child: _MiniApp(width: width, business: business),
                ),
                // Kamera: Android'da teshik, iOS'da orolcha.
                Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: EdgeInsets.only(top: width * 0.05),
                    child: Container(
                      width: android ? width * 0.07 : width * 0.3,
                      height: width * 0.07,
                      decoration: BoxDecoration(
                        color: Colors.black,
                        borderRadius: BorderRadius.circular(width * 0.05),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: Gap.sm),
        Text(label, style: AppType.monoStyle(color: t.text2, size: 10)),
      ],
    );
  }
}

class _MiniApp extends StatelessWidget {
  const _MiniApp({required this.width, required this.business});

  final double width;
  final bool business;

  @override
  Widget build(BuildContext context) {
    final u = width / 100;
    Widget bar(double w, double h, double o) => Container(
          width: w * u,
          height: h * u,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: o),
            borderRadius: BorderRadius.circular(2 * u),
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(height: 18 * u),
        Row(
          children: [
            Container(
              width: 16 * u,
              height: 16 * u,
              decoration: BoxDecoration(
                shape: business ? BoxShape.rectangle : BoxShape.circle,
                borderRadius: business ? BorderRadius.circular(4 * u) : null,
                image: DecorationImage(
                  image: AssetImage(business
                      ? 'assets/demo/b_logo.jpg'
                      : 'assets/demo/p_avatar.jpg'),
                  fit: BoxFit.cover,
                ),
              ),
            ),
            SizedBox(width: 5 * u),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                bar(30, 4, .92),
                SizedBox(height: 3 * u),
                bar(20, 3, .5),
              ],
            ),
          ],
        ),
        SizedBox(height: 7 * u),
        Row(
          children: [
            bar(17, 7, .22),
            SizedBox(width: 3 * u),
            bar(17, 7, .22),
            SizedBox(width: 3 * u),
            bar(17, 7, .22),
          ],
        ),
        SizedBox(height: 6 * u),
        // Biznes ekranida katalog to'ri, shaxsiyda post to'ri —
        // ikkalasi boshqacha ko'rinishi ATAYLAB.
        Expanded(
          child: GridView.count(
            crossAxisCount: business ? 2 : 3,
            mainAxisSpacing: 3 * u,
            crossAxisSpacing: 3 * u,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            children: List.generate(
              business ? 4 : 6,
              (i) => Container(
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: i.isEven ? .26 : .16),
                  borderRadius: BorderRadius.circular(3 * u),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ------------------------------------------------------- demo kartalar
//
// IKKI KATTA VERTIKAL KARTA.
//
// Ular bir-biridan ATAYLAB farq qiladi — shaxsiy va biznes ikki
// xil narsa ekani bir qarashda bilinsin:
//
//   shaxsiy | dumaloq avatar | aksent gradienti | post lentasi
//   biznes  | kvadrat logotip | biznes aksenti  | katalog to'ri
//
// Lekin ikkalasi bitta dizayn tilida: bir xil sirt, bir xil
// radius, bir xil kapsulalar.
//
// ## RANG QAT'IY YOZILMAGAN
//
// Bu yerda birorta `Color(0x...)` yo'q. Hamma narsa `context.tokens`
// dan olinadi, shuning uchun mavzu almashganda fon, sirt, hoshiya,
// nishon, ikonka, tugma va yorug'lik BIRGA o'zgaradi. Yagona
// istisno — rasm ustidagi qora niqob: u matnni o'qilarli qilish
// uchun, rang emas, SOYA.

/// Demo kartaning umumiy ramkasi.
class _DemoCard extends StatelessWidget {
  const _DemoCard({
    required this.cover,
    required this.accent,
    required this.badge,
    required this.head,
    required this.strip,
    required this.stats,
    required this.cta,
    required this.onTap,
  });

  final String cover;

  /// Shu kartaning aksent rangi — MAVZUDAN keladi.
  final Color accent;
  final String badge;
  final Widget head;
  final Widget strip;
  final Widget stats;
  final Widget cta;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return FloatingSurface(
      solid: true,
      padding: EdgeInsets.zero,
      borderRadius: R.organic(a: 30, b: 30, c: 30, d: 30),
      onTap: onTap,
      child: ClipRRect(
        borderRadius: R.organic(a: 30, b: 30, c: 30, d: 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 104,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  mediaImage(context, cover, fit: BoxFit.cover),
                  // Matn o'qilarli bo'lishi uchun — rang emas, soya.
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: .10),
                          t.surfaceSolid.withValues(alpha: .92),
                        ],
                      ),
                    ),
                  ),
                  Align(
                    alignment: Alignment.topRight,
                    child: Padding(
                      padding: const EdgeInsets.all(Gap.md),
                      child: Capsule(label: badge, dense: true, tone: accent),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  Gap.lg, 0, Gap.lg, Gap.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Transform.translate(
                    offset: const Offset(0, -26),
                    child: head,
                  ),
                  Transform.translate(
                    offset: const Offset(0, -14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        stats,
                        const SizedBox(height: Gap.md),
                        strip,
                        const SizedBox(height: Gap.lg),
                        cta,
                        const SizedBox(height: Gap.sm),
                        Text(l.demoNotice,
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Uchta kapsulali statistika — profil ekranidagi bilan bir xil til.
class _Stats extends StatelessWidget {
  const _Stats({required this.items, required this.accent});

  final List<(String, String)> items;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: Gap.sm),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: Gap.sm),
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: t.border2),
              ),
              child: Column(
                children: [
                  Text(items[i].$1,
                      style: AppType.monoStyle(color: accent, size: 13)),
                  const SizedBox(height: 2),
                  Text(items[i].$2,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppType.monoStyle(color: t.text3, size: 9)),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

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
    final accent = t.accent2;

    return _DemoCard(
      cover: demoPersonalId.coverUrl,
      accent: accent,
      badge: l.demoBadge,
      onTap: () => context.push(Routes.demoPersonal),
      head: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Container(
            padding: const EdgeInsets.all(2.5),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: t.accentGradient,
            ),
            child: Container(
              padding: const EdgeInsets.all(2.5),
              decoration:
                  BoxDecoration(shape: BoxShape.circle, color: t.surfaceSolid),
              child: ClipOval(
                child: Image.asset(demoPersonalId.avatarUrl,
                    width: 58, height: 58, fit: BoxFit.cover),
              ),
            ),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: Gap.xs),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(demoPersonalId.name,
                      style: Theme.of(context).textTheme.titleLarge),
                  Text(l.demoPersonalSubtitle,
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.xs),
            child: Capsule(
                label: demoPersonalId.code, dense: true, selected: true),
          ),
        ],
      ),
      stats: _Stats(accent: accent, items: [
        (_n(demoPersonalId.views), l.nfcViews),
        (_n(demoPersonalId.followers), l.profileFollowers),
        (_n(demoPersonalPosts.length), l.profilePosts),
      ]),
      strip: _MiniStrip(
        urls: demoPersonalPosts.map((p) => p.mediaUrls.first).toList(),
        radius: 16,
      ),
      cta: NovaButton(
        label: l.demoViewProfile,
        icon: Icons.arrow_forward_rounded,
        onPressed: () => context.push(Routes.demoPersonal),
      ),
    );
  }
}

class _BusinessCard extends StatelessWidget {
  const _BusinessCard();

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    // Biznes aksenti — mavzuning O'Z biznes rangi. Shaxsiydan
    // farq qilishi ATAYLAB, lekin u ham mavzudan keladi.
    final accent = t.accentB;

    return _DemoCard(
      cover: demoBusiness.coverUrl,
      accent: accent,
      badge: l.demoBadge,
      onTap: () => context.push(Routes.demoBusiness),
      head: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Container(
            padding: const EdgeInsets.all(2.5),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: LinearGradient(
                colors: [t.accentB, t.accentBDark],
              ),
            ),
            child: Container(
              padding: const EdgeInsets.all(2.5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                color: t.surfaceSolid,
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(15),
                child: Image.asset(demoBusiness.logoUrl,
                    width: 58, height: 58, fit: BoxFit.cover),
              ),
            ),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: Gap.xs),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(demoBusiness.displayName,
                      style: Theme.of(context).textTheme.titleLarge),
                  Text(l.demoBizSubtitle,
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.xs),
            child: Capsule(
                label: l.demoChipReady, dense: true, tone: accent),
          ),
        ],
      ),
      stats: _Stats(accent: accent, items: [
        (_n(demoBusiness.views), l.nfcViews),
        (_n(demoBusiness.followers), l.profileFollowers),
        (_n(demoCatalog.length), l.bizCatalog),
      ]),
      strip: _MiniStrip(
        urls: demoCatalog.take(4).map((c) => c.imageUrl).toList(),
        radius: 12,
      ),
      cta: NovaButton(
        label: l.demoViewBusiness,
        icon: Icons.storefront_rounded,
        onPressed: () => context.push(Routes.demoBusiness),
      ),
    );
  }
}

/// Kichik ko'rinishlar lentasi — "bu profil bo'sh emas" degan
/// fikrni bir qarashda beradi.
class _MiniStrip extends StatelessWidget {
  const _MiniStrip({required this.urls, this.radius = 14});

  final List<String> urls;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 74,
      child: Row(
        children: [
          for (var i = 0; i < urls.length; i++) ...[
            if (i > 0) const SizedBox(width: Gap.sm),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(radius),
                child: mediaImage(context, urls[i], fit: BoxFit.cover),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
