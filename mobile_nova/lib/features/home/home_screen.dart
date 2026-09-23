
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/utils/sharing.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/motion/motion.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/id_plate.dart';
import '../../design/widgets/nfc_id_hero.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../profile/music_player.dart';
import '../social/feed_card.dart';
import '../social/media_frame.dart' show decodeWidth, isAssetMedia;
import '../nfc/qr_sheet.dart';
import '../shop/nfc_id_market.dart' show tierLabel;
import 'widgets/avatar.dart';
import 'widgets/nfc_mobile_section.dart';
import 'widgets/identity_card.dart';
import 'widgets/mode_switch.dart';
import '../../app/profile_context.dart';
import '../../data/repositories/business_repository.dart';
import '../profile/profile_switcher.dart';
import '../social/visible_fraction.dart';
import '../../routing/shell.dart';

/// Faol NFC ID ning story'lari.
final homeStoriesProvider = FutureProvider.autoDispose<List<StoryItem>>((
  ref,
) async {
  final p = ref.watch(activeProfileProvider);
  if (p == null) return const [];
  // Kompaniya istoryalari boshqa jadvalda va boshqa manzilda
  // (`/api/companies/:id/stories`). Shaxsiy yo'lni kompaniya kodi
  // bilan chaqirish bo'sh ro'yxat qaytarardi.
  final res = p.isBusiness
      ? await ref.watch(businessRepositoryProvider).stories(p.code)
      : await ref.watch(socialRepositoryProvider).storiesOf(p.code);
  final own = res.when(ok: (v) => v, err: (e) => throw e);

  // OBUNA BO'LGANLARNING ISTORYALARI HAM QO'SHILADI.
  //
  // Ilgari bu qator FAQAT o'z profilingni ko'rsatardi: obuna
  // bo'lganing odam istorya qo'ysa, ilovada uni ko'rishning iloji
  // yo'q edi. Server uchun `GET /api/stories/feed` allaqachon bor
  // edi — ilova uni chaqirmasdi.
  //
  // Xatosi YUTILADI: obuna lentasi kelmasa ham o'z istoryang
  // ko'rinaverishi kerak, butun qator yo'qolib qolmasin.
  final followed = await ref.watch(socialRepositoryProvider).followedStories();
  return [...own, ...followed.valueOrNull ?? const <StoryItem>[]];
});

/// Lentaning boshidagi postlar.
final homeFeedProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  final res = await ref.watch(socialRepositoryProvider).feed();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Faol (tanlangan) shaxsiy NFC ID — NFC yozish, post qo'shish,
/// profilni tahrirlash shu ID bilan ishlaydi.
final activeIdProvider = Provider<NfcId?>(
  // YAGONA MANBA: foydalanuvchi TANLAGAN shaxsiy ID
  // (`activePersonalProvider`). Ilgari bu yerda o'z mantig'i bor edi
  // (rejim + `kind` + "asosiy"), ya'ni Tohir tanlansa ham lenta, post
  // qo'shish, profilni tahrirlash va NFC markazi VIP001 bilan
  // ishlardi (egasi, 2026-09: "ID almashmayapti").
  (ref) => ref.watch(activePersonalProvider),
);

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  /// Ro'yxat kontrolleri — "Asosiy" qayta bosilganda tepaga
  /// qaytarish uchun. Boshqa hech qayerda ishlatilmaydi.
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// Eng tepaga — animatsiya bilan.
  void _toTop() {
    if (!_scroll.hasClients) return;
    // Allaqachon tepada bo'lsa hech narsa qilinmaydi: keraksiz
    // animatsiya ham, `jumpTo` sakrashi ham bo'lmaydi.
    if (_scroll.offset <= 0) return;
    _scroll.animateTo(
      0,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    // "Asosiy" tugmasi Home'da turib bosilganda signal keladi.
    ref.listen<int>(homeReselectProvider, (_, __) => _toTop());

    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final mode = ref.watch(modeProvider);
    final active = ref.watch(activeProfileProvider);
    final noBusiness = ref.watch(businessMissingProvider);

    // Identifikatsiya kartasi, QR va ulashish FAQAT NFC yozuvida
    // ma'noli — kompaniyaning QR kodi shaxsiy yozuvniki emas.
    final business = active?.isBusiness ?? false;
    final id = active != null && !active.isBusiness ? active.id : null;

    if (user == null) return const SizedBox.shrink();

    return NovaScaffold(
      // Asosiy tab: pastki bo'shliq `navSafeBottom` da (suzuvchi menyu).
      padBottom: false,
      body: RefreshIndicator(
        color: t.accent2,
        backgroundColor: t.surfaceSolid,
        onRefresh: () async {
          await ref.read(sessionProvider.notifier).refresh();
          ref.invalidate(homeStoriesProvider);
          ref.invalidate(homeFeedProvider);
        },
        child: NovaScroll(
          controller: _scroll,
          padding: EdgeInsets.only(bottom: navSafeBottom(context)),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                Gap.screenX,
                Gap.sm,
                Gap.screenX,
                0,
              ),
              child: Row(
                children: [
                  // BREND IMZOSI — sarlavha emas.
                  //
                  // "Xayrli tong" va hisob login nomi (`ali77099`) bu
                  // yerga QAYTMAYDI: ism pastdagi portret qatorida
                  // bir marta, to'g'ri ko'rinishda turadi.
                  const Expanded(child: _Wordmark()),
                  NovaIconButton(
                    icon: Icons.notifications_none_rounded,
                    tooltip: l.activityTitle,
                    onPressed: () => context.push(Routes.activity),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.settings_outlined,
                    tooltip: l.settings,
                    onPressed: () => context.push(Routes.settings),
                  ),
                ],
              ),
            ),
            const SizedBox(height: Gap.xl),
            if (active != null)
              _IdentityHero(
                user: user,
                profile: active,
                // Portret NFC SKANERGA OLIB BORMAYDI — faqat o'z
                // profilini (story bo'lsa — story'ni) ochadi. NFC
                // pastki navigatsiyaning markaziy tugmasida va NFC
                // markazida.
                onTap: () => context.push(
                  active.isBusiness
                      ? Routes.business
                      : Routes.nfcId(active.code),
                ),
              ),
            const SizedBox(height: Gap.lg),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: ModeSwitch(
                mode: mode,
                onChanged: (m) => m == AppMode.business
                    ? switchToBusiness(context, ref)
                    : switchToPersonal(context, ref),
              ),
            ),
            const SizedBox(height: Gap.lg),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              // BIZNES REJIMIDA KOMPANIYA KARTASI CHIQADI.
              //
              //   * kompaniyasi BOR odamga — uning manzil kartasi;
              //   * kompaniyasi YO'Q odamga — taklif (intro va demo),
              //     "shaxsiy rejimga qayting" emas.
              //
              // Biznes rejimida `id` ATAYLAB `null`: kompaniyaning QR'i
              // shaxsiy karta QR'i emas.
              child: business
                  ? (noBusiness
                      ? _BizPitchCard(
                          onCreate: () =>
                              context.push(Routes.businessIntro),
                          onDemo: () => context.push(Routes.demoBusiness),
                        )
                      : _BizIdentityCard(
                          company: active!.business!,
                          onTap: () => context.push(Routes.business),
                        ))
                  : id == null
                      ? _NoIdCard(onShop: () => context.push(Routes.shop))
                      // NFC ID — EKRANNING QAHRAMONI.
                      //
                      // Kod katta serifda, pastida ochiq manzil (mono).
                      // Ism bu yerda TAKRORLANMAYDI — u tepadagi portret
                      // qatorida.
                      : NfcIdHeroCard(
                          code: id.code,
                          eyebrow: 'NFC ID · ${l.modePersonal}',
                          name: _bareUrl(id.publicUrl(kApiBase)),
                          technical: true,
                          tier: IdPlate.isPrecious(id.tier)
                              ? tierLabel(l, id.tier)
                              : null,
                          // Holat faqat ISTISNO bo'lganda: hammada
                          // "Faol" turishi shovqin.
                          statusLabel: id.active ? null : l.nfcInactive,
                          statusOk: id.active,
                          onTap: () => context.push(Routes.nfcId(id.code)),
                          actions: [
                            NfcIdHeroAction(
                              icon: Icons.qr_code_2_rounded,
                              tooltip: l.nfcShowQr,
                              onTap: () => showQrSheet(context, id),
                            ),
                            NfcIdHeroAction(
                              icon: Icons.ios_share_rounded,
                              tooltip: l.actionShare,
                              onTap: () =>
                                  shareLink(id.publicUrl(kApiBase)),
                            ),
                          ],
                        ),
            ),
            const SizedBox(height: Gap.lg),
            _QuickActions(mode: mode),
            if (!business && id != null) _HomeStats(id: id),
            _StoriesRow(user: user),
            // BOSH EKRAN TARTIBI:
            //   faol NFC ID karta → tezkor amallar → storylar →
            //   NFC Mobile.
            //
            // "NFC ID'larim" va "So'nggi harakatlar" bu yerdan
            // OLIB TASHLANDI — o'chirilmadi:
            //
            //   * ID'lar ro'yxati endi PROFIL ichida turadi va u
            //     yerdan to'liq boshqaruvga o'tiladi. Yo'l NFC
            //     markazi, Sozlamalar va tezkor amallardan ham
            //     ochiq — hech bir kirish nuqtasi yo'qolmadi;
            //   * harakatlar ekrani tepadagi qo'ng'iroq
            //     tugmasidan ochiladi (o'sha joyda turibdi).
            //
            // Bo'shagan joyni tanishtiruv bo'limi egallaydi:
            // ilovaga birinchi kirgan odam pastga tushmasdan
            // "bu ilova nima beradi" degan savolga javob olsin.
            const NfcMobileSection(),

            // HAQIQIY LENTA — tanishtiruv bo'limidan KEYIN.
            //
            // TARTIB ATAYLAB SHUNDAY. Tanishtiruv bo'limi yangi
            // odam uchun: u "bu ilova nima beradi" degan savolga
            // javob beradi va uni pastga tushishga undaydi. Lenta
            // esa QAYTIB KELGAN odam uchun — u har kuni yangi
            // narsa ko'rish uchun keladi.
            //
            // `homeFeedProvider` allaqachon e'lon qilingan va
            // yangilanganda invalidate qilinardi, LEKIN hech
            // qayerda chizilmasdi: ya'ni so'rov yuborilmasdi ham,
            // bosh sahifada post umuman ko'rinmasdi.
            const _HomeFeed(),
            const SizedBox(height: Gap.xxl),
          ],
        ),
      ),
    );
  }
}

/// Brend yozuvi — keng harf oralig'i, sarlavha emas, imzo.
class _Wordmark extends StatelessWidget {
  const _Wordmark();

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        'NFCSTORE',
        maxLines: 1,
        style: TextStyle(
          fontFamily: AppType.sans,
          fontSize: 13,
          fontWeight: FontWeight.w700,
          letterSpacing: 13 * .32,
          color: t.text1,
        ),
      ),
    );
  }
}

/// Ismdan ikki bosh harf: `Mohira Mansurova` -> `MM`.
String _initialsOf(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  if (parts.isEmpty) return '';
  if (parts.length == 1) {
    final p = parts.first;
    return (p.length >= 2 ? p.substring(0, 2) : p).toUpperCase();
  }
  return (parts.first[0] + parts.elementAt(1)[0]).toUpperCase();
}

/// `https://nfcstore.uz/VIP001` -> `nfcstore.uz/VIP001`.
String _bareUrl(String url) => url.replaceFirst(RegExp(r'^https?://'), '');

/// Home'ning PORTRET QATORI — kim ekanligi.
///
/// Soft editorial: chapda katta serif ism va lavozim, o'ngda surat.
/// Kod bu yerda EMAS — u pastdagi hero kartada, ekranning eng katta
/// obyekti bo'lib turadi. Ikki joyda ko'rsatilsa, ierarxiya emas,
/// takror bo'lardi.
class _IdentityHero extends ConsumerWidget {
  const _IdentityHero({required this.user, required this.profile, this.onTap});

  final User user;

  /// Faol kontekst — shaxsiy yozuv yoki kompaniya.
  final ActiveProfile profile;

  /// Suratni bosish O'Z PROFILINI ochadi (story bo'lsa — story'ni).
  /// NFC skaneri ATAYLAB emas.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final width = MediaQuery.sizeOf(context).width;

    final title = profile.name.isNotEmpty
        ? profile.name
        : (profile.isBusiness ? '' : user.displayName);
    final subtitle = profile.subtitle;

    // Biznes kontekstida hisob egasining suratiga QAYTILMAYDI.
    final avatar = profile.avatarUrl.isNotEmpty
        ? profile.avatarUrl
        : (profile.isBusiness ? '' : user.avatarUrl);

    // Story halqasi FAQAT haqiqiy ma'lumotdan: yuklanayotgan bo'lsa
    // ham, xato bo'lsa ham halqa chizilmaydi.
    final mine = ref
        .watch(homeStoriesProvider)
        .maybeWhen(
          data: (all) => all
              .where((s) => s.code.isEmpty || s.code == profile.code)
              .toList(),
          orElse: () => const <StoryItem>[],
        );
    final ring = mine.isEmpty
        ? null
        : _StoryRingState(count: mine.length, unseen: mine.any((s) => !s.seen));

    // 360 da 28, 430 da 32 — uzun ism ikki qatorga bo'linadi,
    // kesilmaydi.
    final nameSize = (width * .078).clamp(26.0, 32.0);
    // PORTRET MARKAZDA VA KATTA (egasining talabi, 2026-09): 360 da
    // ~97, 430 da ~116. Istoriya bo'lsa atrofida Instagramdagidek
    // aniq oltin halqa.
    final photo = (width * .27).clamp(92.0, 116.0);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _PortraitAvatar(
            key: const ValueKey('home-portrait'),
            url: avatar,
            initials: user.initials,
            business: profile.isBusiness,
            ownerName: title,
            music: profile.musicUrls,
            ring: ring,
            photoSize: photo,
            onTap: ring == null
                ? onTap
                : () => context.push(Routes.story(profile.code)),
          ),
          const SizedBox(height: Gap.md),
          Text(
            title,
            maxLines: 2,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: AppType.displayStyle(color: t.text1, size: nameSize)
                .copyWith(height: 1.04),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              subtitle,
              maxLines: 1,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
                color: t.text2,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Foydalanuvchining o'z story'lari haqidagi HAQIQIY holat.
class _StoryRingState {
  const _StoryRingState({required this.count, required this.unseen});

  /// Nechta story bor — halqa shuncha bo'lakka bo'linadi.
  final int count;

  /// Hech bo'lmasa bittasi ko'rilmaganmi.
  final bool unseen;
}

/// Portret surati: champagne hoshiya, story halqasi va musiqa nishoni.
///
/// Surat yo'q bo'lsa — brend belgisi, bo'sh kulrang doira HECH QACHON.
class _PortraitAvatar extends StatelessWidget {
  const _PortraitAvatar({
    super.key,
    required this.url,
    required this.initials,
    required this.business,
    this.ownerName = '',
    this.music = const [],
    this.ring,
    this.onTap,
    this.photoSize = 62,
  });

  final String ownerName;
  final String url;
  final String initials;
  final bool business;
  final List<String> music;

  /// `null` — story yo'q, halqa CHIZILMAYDI.
  final _StoryRingState? ring;
  final VoidCallback? onTap;

  /// Surat diametri (halqasiz).
  final double photoSize;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final size = photoSize;
    // Halqa katta portretda ham ANIQ bilinsin: ko'rilmagani qalin.
    // Qalin, butun halqa (Instagram kabi): katta portretda ~6 px.
    final stroke = ring != null && ring!.unseen
        ? (size >= 90 ? 6.0 : 3.6)
        : 1.8;
    const gap = 3.5;
    final outer = size + (gap + stroke) * 2;

    Widget mark() => ColoredBox(
          color: t.surface2,
          child: Center(
            child: BrandLogo(
              size: size * .56,
              style: BrandLogoStyle.markOnly,
              tint: t.brandInk,
            ),
          ),
        );

    final photo = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: t.surfaceSolid,
        border: ring == null
            ? Border.all(color: t.brand.withValues(alpha: .55))
            : null,
        boxShadow: t.shadowTiny,
      ),
      child: ClipOval(
        child: url.isEmpty
            ? mark()
            : isAssetMedia(url)
                // Demo profillar surati ilova ichida.
                ? Image.asset(url,
                    fit: BoxFit.cover, errorBuilder: (_, __, ___) => mark())
                : CachedNetworkImage(
                    imageUrl: url,
                    fit: BoxFit.cover,
                    memCacheWidth: decodeWidth(context, size),
                    fadeInDuration: Motion.med,
                    placeholder: (_, __) => mark(),
                    errorWidget: (_, __, ___) => mark(),
                  ),
      ),
    );

    return Semantics(
      button: onTap != null,
      image: true,
      child: PressableScale(
        onTap: onTap,
        child: SizedBox(
          width: outer + 4,
          height: outer + 4,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              if (ring != null)
                CustomPaint(
                  size: Size.square(outer),
                  painter:
                      _StoryRingPainter(t: t, state: ring!, stroke: stroke),
                ),
              photo,
              // SURAT YONIDA FAQAT BITTA NISHON — MUSIQA. Musiqa
              // bo'lmasa `MusicControl` bo'sh widget qaytaradi.
              Positioned(
                right: -2,
                bottom: -2,
                child: MusicControl(
                  urls: music,
                  size: size >= 90 ? 30 : 26,
                  ownerName: ownerName,
                  ownerAvatar: url,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Story halqasi — OLTIN + ZUMRAD, butun va qalin (Instagram kabi).
///
/// Ranglar `IdPlate.storyRing` da — istoriyalar qatori va profil
/// halqasi ham AYNAN shu gradientni oladi.
class _StoryRingPainter extends CustomPainter {
  _StoryRingPainter({
    required this.t,
    required this.state,
    required this.stroke,
  });

  final NfcTokens t;
  final _StoryRingState state;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = (size.width - stroke) / 2;
    final rect = Rect.fromCircle(center: c, radius: r);

    // OLTIN + ZUMRAD (egasining tanlovi, 2026-09): Instagramdagidek
    // butun, qalin halqa. Ko'rilgani — ingichka kulrang (Instagram).
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    if (state.unseen) {
      p.shader = IdPlate.storyRing.createShader(rect);
    } else {
      p.color = t.border1;
    }
    canvas.drawCircle(c, r, p);
  }

  @override
  bool shouldRepaint(_StoryRingPainter old) =>
      old.state.count != state.count ||
      old.state.unseen != state.unseen ||
      old.t.id != t.id ||
      old.stroke != stroke;
}

/// NFC ID hali yo'q — do'konga yo'naltiruvchi holat.
/// Biznes rejimi tanlangan, lekin hisobda kompaniya yo'q.
///
/// Bu holat ATAYLAB ko'rsatiladi. Jimgina shaxsiy profilga qaytish
/// aynan avvalgi xatoning o'zi bo'lardi: tugma "Biznes" da turib,

class _NoIdCard extends StatelessWidget {
  const _NoIdCard({required this.onShop});
  final VoidCallback onShop;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return FloatingSurface(
      // Blur'siz: Home har kadrda qayta chiziladi (tezlik, 2026-09).
      solid: true,
      borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // BRENDIMIZNING BELGISI — MATERIAL IKONKASI EMAS.
          //
          // Bu yerda `Icons.nfc_rounded` turgan edi: Android'ning
          // standart NFC belgisi. U har ilovada bir xil va
          // NFCSTORE'ga hech qanday aloqasi yo'q — odam birinchi
          // marta ko'radigan kartada begona belgi turardi.
          //
          // `badge` uslubi tanlandi, chunki bu karta yuzasining
          // rangi mavzuga qarab o'zgaradi: nishon o'z fonini olib
          // yuradi va hamma mavzuda bir xil o'qiladi.
          const BrandLogo(style: BrandLogoStyle.badge, size: 44, halo: false),
          const SizedBox(height: Gap.md),
          Text(l.homeNoId, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l.homeNoIdHint, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: Gap.xl),
          NovaButton(
            label: l.homeShop,
            onPressed: onShop,
            icon: Icons.storefront_rounded,
          ),
        ],
      ),
    );
  }
}

/// Tezkor amallar — to'rtta teng plitka.
///
/// Soft editorial: oq plitka, ingichka chegara, yengil soya. Bosilganda
/// plitka biroz kichrayadi (`PressableScale`) — barmoq javobni sezadi.
/// Uzun yorliq (rus tili) qisqarmaydi, kichrayib sig'adi.
class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.mode});
  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);

    // Biznes rejimida tezkor amallar BOSHQACHA — bu rejim almashuvi
    // shunchaki rang o'zgarishi emasligining amaliy isboti.
    final actions = mode == AppMode.business
        ? [
            (Icons.dashboard_outlined, l.bizDashboard, Routes.businessDashboard),
            (Icons.inventory_2_outlined, l.bizCatalog, Routes.businessCatalog),
            (Icons.insights_rounded, l.bizAnalytics, Routes.businessAnalytics),
            (Icons.storefront_outlined, l.bizStorefront, Routes.business),
          ]
        : [
            (Icons.center_focus_weak_rounded, l.nfcScanShort, Routes.nfcScan),
            (Icons.credit_card_rounded, l.nfcWriteShort, Routes.nfcWrite),
            // ID QIDIRISH — NFC Markazdagi AYNAN O'SHA ekran.
            (Icons.search_rounded, l.idSearchShort, Routes.nfcMarket),
            (Icons.add_rounded, l.postCreate, Routes.postCreate),
          ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
      child: Row(
        children: [
          for (var i = 0; i < actions.length; i++) ...[
            if (i > 0) const SizedBox(width: Gap.sm + 2),
            Expanded(
              child: _ActionTile(
                icon: actions[i].$1,
                label: actions[i].$2,
                onTap: () => context.push(actions[i].$3),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final style = TextStyle(
      fontFamily: AppType.sans,
      fontSize: 11.5,
      height: 1.15,
      fontWeight: FontWeight.w600,
      color: t.text1,
    );
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: onTap,
        scale: .94,
        child: Container(
          height: 82,
          padding: const EdgeInsets.symmetric(horizontal: 5),
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: t.border2),
            boxShadow: t.shadowTiny,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: t.text1),
              const SizedBox(height: 7),
              // Bir so'z ("Skanerlash") hech qachon so'z o'rtasidan
              // bo'linmaydi — kerak bo'lsa biroz kichrayadi. Ikki so'z
              // ("Kartaga yozish") ikki qatorga tushadi.
              if (label.contains(' '))
                Text(
                  label,
                  maxLines: 2,
                  textAlign: TextAlign.center,
                  overflow: TextOverflow.ellipsis,
                  style: style,
                )
              else
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(label, maxLines: 1, style: style),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Faol NFC ID ning HAQIQIY ko'rsatkichlari: postlar, ko'rishlar,
/// obunachilar.
///
/// "Tegishlar" soni ATAYLAB yo'q: server uni hisoblamaydi, to'qilgan
/// raqam ko'rsatilmaydi. Obunachilar soni profildagi bilan bir xil
/// manbadan (server o'chirilgan/yashirin hisoblarni sanamaydi).
class _HomeStats extends StatelessWidget {
  const _HomeStats({required this.id});
  final NfcId id;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final cells = [
      (id.posts, l.profilePosts),
      (id.views, l.nfcViews),
      (id.followers, l.profileFollowers),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          Gap.screenX, Gap.lg, Gap.screenX, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: t.border2),
          boxShadow: t.shadowTiny,
        ),
        child: IntrinsicHeight(
          child: Row(
            children: [
              for (var i = 0; i < cells.length; i++) ...[
                if (i > 0) VerticalDivider(width: 1, color: t.border2),
                Expanded(
                  child: Column(
                    children: [
                      Text(
                        formatCount(cells[i].$1),
                        maxLines: 1,
                        style: AppType.displayStyle(color: t.text1, size: 30)
                            .copyWith(height: 1.05),
                      ),
                      const SizedBox(height: 4),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            cells[i].$2.toUpperCase(),
                            maxLines: 1,
                            style: AppType.eyebrow(color: t.text3, size: 9.5),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StoriesRow extends ConsumerWidget {
  const _StoriesRow({required this.user});
  final User user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final stories = ref.watch(homeStoriesProvider);
    final id = ref.watch(activeIdProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: l.homeStories),
        SizedBox(
          height: 92,
          child: stories.when(
            loading: () => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              itemCount: 5,
              separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
              itemBuilder: (_, __) => const Skeleton(height: 62, circle: true),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (all) {
              // BITTA ODAM — BITTA DOIRACHA.
              //
              // Server istoryalarni odam bo'yicha guruhlab beradi,
              // bu yerda esa ular yassi ro'yxat bo'lib keladi. Agar
              // har bir istoryaga alohida doiracha chizilsa, uchta
              // istorya qo'ygan bitta odam qatorda uch marta
              // takrorlanardi. Doiracha bosilganda baribir o'sha
              // odamning HAMMA istoryasi ochiladi.
              final seenCodes = <String>{};
              final items = <StoryItem>[];
              for (final s in all) {
                if (seenCodes.add(s.code)) items.add(s);
              }
              return ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                itemCount: items.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
                itemBuilder: (context, i) {
                  if (i == 0) {
                    return _StoryBubble(
                      label: l.homeYourStory,
                      avatarUrl: user.avatarUrl,
                      initials: user.initials,
                      add: true,
                      onTap: () => context.push(Routes.storyCreate),
                    );
                  }
                  final s = items[i - 1];
                  return _StoryBubble(
                    label: s.authorName.isEmpty
                        ? (id?.name ?? '')
                        : s.authorName,
                    avatarUrl: s.authorAvatar.isEmpty
                        ? s.mediaUrl
                        : s.authorAvatar,
                    // Begona odamning bosh harflari — O'ZIMIZNIKI emas.
                    initials: _initialsOf(s.authorName),
                    seen: s.seen,
                    onTap: () => context.push(
                      Routes.story(s.code.isEmpty ? (id?.code ?? '') : s.code),
                    ),
                  );
                },
              );
            },
          ),
        ),
        if (stories.hasError) const SizedBox(height: Gap.sm),
      ],
    );
  }
}

class _StoryBubble extends StatelessWidget {
  const _StoryBubble({
    required this.label,
    required this.avatarUrl,
    required this.initials,
    this.add = false,
    this.seen = false,
    this.onTap,
  });

  final String label;
  final String avatarUrl;
  final String initials;
  final bool add;
  final bool seen;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return PressableScale(
      onTap: onTap,
      child: SizedBox(
        width: 66,
        child: Column(
          children: [
            Stack(
              children: [
                Avatar(
                  url: avatarUrl,
                  initials: initials,
                  size: 64,
                  // Ko'rilmagan — qalin OLTIN + ZUMRAD halqa (Instagram
                  // kabi), ko'rilgan — ingichka kulrang chiziq.
                  // "Sizning story" (qo'shish) — istoriya EMAS: halqa
                  // ingichka neytral chiziq, Instagramdagidek.
                  ringGradient: seen || add ? null : IdPlate.storyRing,
                  ringColor: seen || add ? t.border1 : null,
                  ringWidth: seen || add ? 1.4 : 3.2,
                ),
                if (add)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 21,
                      height: 21,
                      decoration: BoxDecoration(
                        gradient: t.accentGradient,
                        shape: BoxShape.circle,
                        border: Border.all(color: t.bg1, width: 2),
                      ),
                      child: Icon(
                        Icons.add_rounded,
                        size: 12,
                        color: t.onAccent,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                color: t.text2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}


/// Bosh sahifadagi lenta.
///
/// MANBA — `/api/feed`, ya'ni Reels va Kashfiyot bilan AYNAN bir
/// xil. Uchala joy uchun uchta so'rov yozilganda biri maxfiylik
/// filtrini yo'qotib qo'yishi mumkin edi.
///
/// Pullik ko'tarilgan kontent (`featured`) shu ro'yxatning
/// boshida keladi — server shunday tartiblaydi. Ilova uni qayta
/// saralamaydi: tartib SERVER qaroridir, aks holda to'lovning
/// ma'nosi ilova versiyasiga bog'liq bo'lib qolardi.
class _HomeFeed extends ConsumerWidget {
  const _HomeFeed();

  /// Bosh sahifada nechta post ko'rsatiladi.
  ///
  /// Bu LENTA EMAS, uning BOSHI: to'liq oqim Kashfiyotda. Bosh
  /// sahifa cheksiz uzaymasligi kerak — pastda NFC bo'limi va
  /// boshqa narsalar bor.
  static const _limit = 5;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final feed = ref.watch(homeFeedProvider);

    return feed.when(
      // Yuklanayotganda BO'SHLIQ emas, skelet: ekran sakramaydi.
      loading: () => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: l.homeFeed),
          const SkeletonList(count: 2, height: 108),
        ],
      ),
      // Lenta kelmasa bosh sahifa YIQILMAYDI — qolgan hamma narsa
      // joyida turadi va faqat shu bo'lim o'rniga sabab chiqadi.
      error: (e, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: l.homeFeed),
          StatePanel.fromError(
            context,
            asAppError(e),
            onRetry: () => ref.invalidate(homeFeedProvider),
          ),
        ],
      ),
      data: (posts) {
        if (posts.isEmpty) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionHeader(title: l.homeFeed),
              FloatingSurface(
                solid: true,
                child: Text(
                  l.homeFeedEmpty,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ],
          );
        }
        final shown = posts.take(_limit).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(
              title: l.homeFeed,
              action: posts.length > _limit ? l.homeFeedMore : null,
              onAction: () => context.go(Routes.discover),
            ),
            _AutoplayFeed(posts: shown),
          ],
        );
      },
    );
  }
}


/// LENTADAGI VIDEO — INSTAGRAM KABI.
///
/// ## QOIDA
///
/// Ekranning yetarli qismi ko'ringan BITTA video o'ynaydi. U
/// "dominant" deb ataladi: ulushi eng katta va `_kThreshold` dan
/// yuqori bo'lgan karta. Dominant almashganda avvalgisi DARHOL
/// to'xtaydi.
///
/// ## NIMA UCHUN OVOZ REYESTRI BILAN
///
/// To'xtatishni bu yer O'ZI qilmaydi — `InlineVideo` dominant
/// bo'lganda `AudioOwner.take()` chaqiradi va reyestr avvalgi
/// egasini to'xtatadi. Ya'ni video, profil musiqasi va istorya
/// BITTA navbatda turadi; bu yerda parallel tizim yo'q.
///
/// Bu vidjet faqat ARIFMETIKA qiladi: kim qancha ko'rinyapti va
/// kim dominant.
///
/// ## CHEGARA NIMA UCHUN IKKITA EMAS
///
/// Bitta chegara (0.65) yetarli, chunki tanlov `argmax` orqali
/// boradi: ikkita karta bir vaqtda chegaradan o'tsa ham, faqat
/// ulushi kattarog'i dominant bo'ladi. "Ikkalasi ham o'ynab
/// ketdi" holati tuzilish jihatidan mumkin emas.
class _AutoplayFeed extends StatefulWidget {
  const _AutoplayFeed({required this.posts});

  final List<Post> posts;

  @override
  State<_AutoplayFeed> createState() => _AutoplayFeedState();
}

class _AutoplayFeedState extends State<_AutoplayFeed> {
  /// Ekranning kamida shuncha qismi ko'rinsa — ijroga nomzod.
  static const _kThreshold = 0.65;

  final _fraction = <int, double>{};
  int? _dominant;

  void _report(int i, double f) {
    _fraction[i] = f;
    final best = dominantIndex(_fraction, threshold: _kThreshold);
    if (best == _dominant) return;
    // O'lchov kadr chizilayotganda keladi — `setState` ni keyingi
    // kadrga suramiz, aks holda "setState during build" chiqadi.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && best != _dominant) setState(() => _dominant = best);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < widget.posts.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: Gap.md),
            child: widget.posts[i].isVideo
                ? VisibleFraction(
                    onChanged: (f) => _report(i, f),
                    child: FeedCard(
                      post: widget.posts[i],
                      activeVideo: _dominant == i,
                    ),
                  )
                : FeedCard(post: widget.posts[i]),
          ),
      ],
    );
  }
}

/// BIZNES MANZILI KARTASI — shaxsiy "FAOL NFC ID" ning juftligi.
///
/// Biznes rejimida odam o'z kompaniyasining ommaviy manzilini va
/// sonlarini ko'rishi kerak. Ilgari bu yerda "NFC ID hali yo'q"
/// turardi, ya'ni ilova kompaniyani ko'rmayotgandek edi.
class _BizIdentityCard extends StatelessWidget {
  const _BizIdentityCard({required this.company, required this.onTap});

  final Business company;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final url = 'nfcstore.uz/c/${company.companyId.toLowerCase()}';

    return FloatingSurface(
      solid: true,
      onTap: onTap,
      borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.homeBizAddress,
              style: AppType.monoStyle(color: t.text3, size: 10.5)
                  .copyWith(letterSpacing: 1.6)),
          const SizedBox(height: Gap.sm),
          // Kompaniya identifikatori ham PLASTINKA — shaxsiy kod
          // bilan bir tilda. Daraja tushunchasi kompaniyada yo'q.
          IdPlate(code: company.companyId, size: IdPlateSize.large),
          const SizedBox(height: Gap.sm),
          Text(url, style: AppType.monoStyle(color: t.text2, size: 12)),
          const SizedBox(height: Gap.lg),
          Row(
            children: [
              for (final (value, label) in [
                (formatCount(company.views), l.nfcViews),
                (formatCount(company.followers), l.profileFollowers),
              ])
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(value,
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 2),
                      Text(label,
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              NovaIconButton(
                icon: Icons.ios_share_rounded,
                onPressed: () => shareLink('https://$url'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// BIZNESI YO'Q ODAMGA TAKLIF — "qaytib ket" emas.
///
/// Ilgari bu yerda `_NoBusinessCard` turardi va uning yagona
/// tugmasi "Shaxsiy rejim" edi: ya'ni ilova imkoniyatni taklif
/// qilish o'rniga eshikni yopardi.
///
/// Endi ikkita yo'l: DEMO ni ko'rish va yaratish. Demo birinchi
/// turadi — odam gapni emas, natijani ko'rsa ishonadi.
class _BizPitchCard extends StatelessWidget {
  const _BizPitchCard({required this.onCreate, required this.onDemo});

  final VoidCallback onCreate;
  final VoidCallback onDemo;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return FloatingSurface(
      // Blur'siz: Home har kadrda qayta chiziladi (tezlik, 2026-09).
      solid: true,
      borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.storefront_rounded, size: 26, color: t.accent2),
          const SizedBox(height: Gap.md),
          Text(l.homeBizPitchTitle,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l.homeBizPitchHint,
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: Gap.xl),
          NovaButton(
            label: l.bizPitchDemo,
            icon: Icons.visibility_outlined,
            onPressed: onDemo,
          ),
          const SizedBox(height: Gap.sm),
          NovaButton(
            label: l.bizCreate,
            icon: Icons.add_business_rounded,
            tone: ButtonTone.quiet,
            onPressed: onCreate,
          ),
        ],
      ),
    );
  }
}
