import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/business_hero.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/media.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/press.dart';
import '../../design/components/story_ring.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../content/story_viewer.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/share.dart';
import '../content/compose.dart';
import '../nfc/id_catalog.dart';
import '../settings/settings_screen.dart';
import '../business/business_stats.dart';
import '../business/edit_business.dart';
import '../orders/owner_orders.dart';
import 'edit_profile.dart';
import 'follow_list.dart';
import 'my_content.dart';
import 'profile_screen.dart';
import 'profile_stats.dart';
import 'switcher.dart';

/// PROFIL TABI — EGASINING BOSHQARUVI.
///
/// Bu TASHRIFCHI ko'radigan ochiq profil EMAS. Farqi shunda:
/// bu yerda ID almashtirgich, statistika, grafik va kontent
/// qo'shish tugmalari bor. Ochiq profilni ko'rish uchun alohida
/// tugma bor — egasi o'z sahifasini boshqalar qanday ko'rishini
/// bilishi kerak.
///
/// "STORY QO'SHISH" VA "POST QO'SHISH" — IKKI ALOHIDA TUGMA.
/// Dizayn buni qat'iy talab qiladi: story 24 soatlik, post esa
/// doimiy. Bitta "+" tugmasi ortida yashirilsa, odam qaysi birini
/// qo'shayotganini bilmay qoladi.
class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  Map<String, dynamic>? _analytics;

  /// Faol shaxs biznes bo'lsa — uning kompaniyasi. Sarlavha,
  /// raqamlar va "Biznesni tahrirlash" shundan o'qiydi.
  Company? _company;
  FollowStats? _follow;
  List<Post> _posts = const [];
  /// Faol shaxsning FAOL istoryalari — avatar atrofidagi
  /// oltin halqa shundan chiziladi.
  List<Post> _stories = const [];
  bool _loading = true;
  String? _loadedFor;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final code = AppScope.of(context).active?.code;
    if (code != _loadedFor) {
      _loadedFor = code;
      _load();
    }
  }

  /// BIZNESNI TAHRIRLASH.
  ///
  /// `EditBusinessScreen` to'liq `Company` obyektini kutadi, faol
  /// shaxsda esa faqat kod va nom bor — shuning uchun avval
  /// serverdan olinadi.
  /// TANLANGAN SHAXSNI TAHRIRLASH.
  ///
  /// Karuselda qaysi ID tanlangan bo'lsa, tugma AYNAN o'shani
  /// ochadi: shaxsiy ID — profil tahriri, kompaniya — biznes
  /// tahriri. Ilgari bu amal faqat menyu ostida edi va odam
  /// karuseldan ID tanlagach uni tahrirlash yo'lini topa olmasdi.
  Future<void> _edit(Identity active) async {
    if (active.isBusiness) {
      await _editBusiness(active);
    } else if (active.record != null) {
      final saved = await push<bool>(
        context,
        (_) => EditProfileScreen(record: active.record!),
      );
      if (saved == true && mounted) await _load();
    }
  }

  Future<void> _editBusiness(Identity active) async {
    final repo = AppScope.read(context).repo;
    Company? company;
    try {
      company = await repo.company(active.code);
    } catch (e) {
      if (!mounted) return;
      await showError(context, humanError(e));
      return;
    }
    if (!mounted) return;
    final saved = await push<bool>(
      context,
      (_) => EditBusinessScreen(company: company!),
    );
    if (saved == true && mounted) await _load();
  }

  Future<void> _load() async {
    final state = AppScope.read(context);
    final active = state.active;
    if (active == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() => _loading = true);

    // UCHALASI IXTIYORIY. Statistika tarifga bog'liq va server uni
    // rad etishi mumkin — bu butun ekranni bo'sh qoldirmasligi
    // kerak.
    Map<String, dynamic>? analytics;
    FollowStats? follow;
    List<Post> posts = const [];
    List<Post> stories = const [];
    Company? company;

    if (!active.isBusiness) {
      try {
        analytics = await state.repo.analytics(active.code, days: 7);
      } catch (_) {}
    } else {
      // BIZNES SONLARI KOMPANIYADAN. Karta statistikasi
      // (`/records/:code/analytics`) kompaniya kodini bilmaydi.
      try {
        company = await state.repo.company(active.code);
      } catch (_) {}
    }
    try {
      follow = await state.repo.followStats(active.code);
    } catch (_) {}
    try {
      // BIZNES O'Z POSTLARINI KO'RADI. Ilgari bu yerda biznes
      // uchun ataylab bo'sh ro'yxat qaytarilardi — egasi o'zi
      // joylagan postni ilovada umuman ko'ra olmasdi va
      // o'chira ham olmasdi.
      posts = active.isBusiness
          ? await state.repo.companyPosts(active.code)
          : await state.repo.recordPosts(active.code);
    } catch (_) {}
    try {
      stories = active.isBusiness
          ? await state.repo.companyStories(active.code)
          : await state.repo.recordStories(active.code);
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _analytics = analytics;
      _follow = follow;
      _posts = posts;
      _stories = stories;
      _company = company;
      _loading = false;
    });
  }

  Future<void> _compose(ComposeKind kind) async {
    final active = AppScope.read(context).active;
    if (active == null) return;
    final done = await push<bool>(
      context,
      (_) => ComposeScreen(
        code: active.code,
        kind: kind,
        company: active.isBusiness,
      ),
    );
    if (done == true && mounted) await _load();
  }

  /// 7 kunlik ko'rishlar — serverning `byDay` javobidan.
  ///
  /// Kengaytirilgan statistika faqat pullik tarifda keladi. Kelmasa
  /// grafik umuman chizilmaydi: bo'sh yoki o'ylab topilgan grafik
  /// ko'rsatishdan ko'ra ko'rsatmagan yaxshi.
  List<int>? get _series {
    final raw = _analytics?['byDay'];
    if (raw is! List || raw.isEmpty) return null;
    return [
      for (final e in raw)
        if (e is Map) (e['views'] as num?)?.round() ?? 0 else 0,
    ];
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final active = state.active;

    if (active == null) {
      return ScreenBackdrop(
        aura: Aura.profile,
        child: SafeArea(
          child: Center(
            child: EmptyState(
              tr('Ro‘yxatdan o‘tganda bepul 8 xonali ID beriladi.'),
              title: tr('Hali profil yo‘q'),
              icon: Ico.user,
              actionLabel: tr('ID katalogini ochish'),
              onAction: () =>
                  push<void>(context, (_) => const IdCatalogScreen()),
            ),
          ),
        ),
      );
    }

    final views = active.isBusiness
        ? (_company?.views ?? 0)
        : ((_analytics?['totalViews'] as num?)?.round() ?? 0);
    final contacts = _contactCount();
    final series = _series;

    return ScreenBackdrop(
      aura: Aura.profile,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _load,
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: NavBar.inset(context)),
            children: [
              // FOTO COVER — profil oddiy sozlama sahifasi emas,
              // shaxsning premium vitrinasiga o'xshab ochiladi.
              _ProfileCover(
                identity: active,
                handle: profileHandle(
                  context,
                  active.code,
                  company: active.isBusiness,
                ),
                onMenu: () => _menu(active),
                onEdit: () => _edit(active),
                onSwitch: () => showIdentitySwitcher(context),
                hasStory: _stories.isNotEmpty,
                onStory: _stories.isEmpty
                    ? null
                    : () => push<void>(
                          context,
                          (_) => StoryViewerScreen(
                            code: active.code,
                            isCompany: active.isBusiness,
                          ),
                        ),
              ),

              // KARTALAR — karusel (prototip).
              //
              // BIZNESDA KARTA YO'Q: u yerda kompaniyaning o'zi
              // ko'rsatiladi. Ilgari biznes egasi o'z profilida
              // begona shaxsiy kartalarni ko'rardi.
              const SizedBox(height: S.x20),
              if (active.isBusiness)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: _BusinessCard(
                    company: _company,
                    code: active.code,
                    name: active.name,
                    onEdit: () => _editBusiness(active),
                  ),
                )
              else
                _CardCarousel(
                  items: [
                    for (final c in state.cards) Identity.personal(c),
                    for (final c in state.companies) Identity.business(c),
                  ],
                  activeCode: active.code,
                  onSelect: state.switchIdentity,
                  onAdd: () =>
                      push<void>(context, (_) => const IdCatalogScreen()),
                ),

              // KONTENT QO'SHISH — IKKI ALOHIDA TUGMA
              // (prototip: kartalardan keyin darhol).
              const SizedBox(height: S.x20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Row(
                  children: [
                    Expanded(
                      child: PrimaryButton(
                        tr('Story qo‘shish'),
                        icon: Ico.plus,
                        size: BtnSize.m,
                        sweep: false,
                        onTap: () => _compose(ComposeKind.story),
                      ),
                    ),
                    const SizedBox(width: S.x8),
                    Expanded(
                      child: SecondaryButton(
                        tr('Post qo‘shish'),
                        icon: Ico.plus,
                        size: BtnSize.m,
                        onTap: () => _compose(ComposeKind.post),
                      ),
                    ),
                  ],
                ),
              ),

              // STATISTIKA — sarlavha, "7 kun" chipi va chiziqli
              // grafik (prototip).
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x32,
                  S.gutter,
                  S.x12,
                ),
                child: SectionHeader(
                  tr('Statistika'),
                  actionLabel: tr('Batafsil'),
                  onAction: () => push<void>(
                    context,
                    (_) => ProfileStatsScreen(
                      code: active.code,
                      name: active.name,
                    ),
                  ),
                  trailing: const StatusChip('7 kun'),
                ),
              ),

              if (_loading && _analytics == null)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: S.gutter),
                  child: Skeleton(height: 92, radius: R.card),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: Surface(
                    padding: const EdgeInsets.all(S.x16),
                    onTap: () => push<void>(
                      context,
                      (_) => ProfileStatsScreen(
                        code: active.code,
                        name: active.name,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // GRAFIK BU YERDA EMAS, "Batafsil" ortida.
                        //
                        // Tabda u ekranning eng katta bo'lagini
                        // egallardi va ko'rishlar kam bo'lganda
                        // deyarli BO'SH quti bo'lib turardi —
                        // profil ochilganda ko'z birinchi shunga
                        // tushardi. O'sish foizi esa raqamlar
                        // yonida qoladi: u bitta satrda ham
                        // ma'noni to'liq beradi.
                        if (series != null && series.length > 1) ...[
                          Row(
                            children: [
                              Text(
                                tr('Ko‘rishlar'),
                                style: T.cardTitle.copyWith(fontSize: 14),
                              ),
                              const Spacer(),
                              _Delta(series: series),
                            ],
                          ),
                          const SizedBox(height: S.x12),
                        ],

                        // RAQAMLAR — grafik ostida bitta qatorda
                        // (prototip: "96 saqlash · 14 tegish ·
                        // 412 obunachi · 284 ko'rish").
                        StatRow(
                          tiles: [
                            StatTile(
                              value: som(views),
                              label: tr('Ko‘rish'),
                              onTap: () => push<void>(
                                context,
                                (_) => ProfileStatsScreen(
                                  code: active.code,
                                  name: active.name,
                                ),
                              ),
                            ),
                            StatTile(
                              value: som(contacts),
                              label: tr('Kontakt'),
                            ),
                            StatTile(
                              value: som(_follow?.followers ?? 0),
                              label: tr('Obunachi'),
                              onTap: () => push<void>(
                                context,
                                (_) => FollowListScreen(
                                  code: active.code,
                                  title: tr('Obunachilar'),
                                  isCompany: active.isBusiness,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

              // POSTLAR.
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x32,
                  S.gutter,
                  S.x12,
                ),
                child: SectionHeader(
                  tr('Postlarim'),
                  actionLabel: _posts.isEmpty ? null : tr('Boshqarish'),
                  onAction: _posts.isEmpty
                      ? null
                      : () async {
                          await push<void>(
                            context,
                            (_) => const MyContentScreen(),
                          );
                          if (mounted) await _load();
                        },
                  trailing: _posts.isEmpty
                      ? null
                      : Text(som(_posts.length), style: T.meta),
                ),
              ),

              if (_loading && _posts.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: S.gutter),
                  child: SkeletonGrid(count: 6),
                )
              else if (_posts.isEmpty)
                EmptyState(
                  tr('Birinchi postingiz ochiq profilingizda ko‘rinadi.'),
                  title: tr('Hali post yo‘q'),
                  icon: Ico.image,
                  actionLabel: tr('Post qo‘shish'),
                  onAction: () => _compose(ComposeKind.post),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: GridView.builder(
                    physics: const NeverScrollableScrollPhysics(),
                    shrinkWrap: true,
                    padding: EdgeInsets.zero,
                    itemCount: _posts.length.clamp(0, 9),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 3,
                      mainAxisSpacing: 3,
                    ),
                    itemBuilder: (context, i) => Press(
                      onTap: () async {
                        await push<void>(
                          context,
                          (_) => const MyContentScreen(),
                        );
                        if (mounted) await _load();
                      },
                      minSize: 0,
                      scale: .98,
                      child: NetImage(
                        _posts[i].images.isEmpty ? null : _posts[i].images.first,
                        radius: 2,
                        slotIcon: Ico.image,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// KONTAKT SAQLASHLAR SONI — serverning hodisa taqsimotidan.
  int _contactCount() {
    final byType = _analytics?['byType'];
    if (byType is Map) {
      final v = byType['vcard'] ?? byType['contact'];
      if (v is num) return v.round();
    }
    return 0;
  }

  Future<void> _menu(Identity active) async {
    final choice = await showSheet<String>(
      context,
      title: active.name,
      subtitle: profileHandle(
        context,
        active.code,
        company: active.isBusiness,
      ),
      child: Column(
        children: [
          SheetAction(
            label: tr('Ochiq profilni ko‘rish'),
            icon: Ico.eye,
            subtitle: tr('Boshqalar qanday ko‘rishini tekshiring'),
            onTap: () => Navigator.of(context).pop('public'),
          ),
          SheetAction(
            label: active.isBusiness
                ? tr('Biznesni tahrirlash')
                : tr('Profilni tahrirlash'),
            icon: Ico.edit,
            subtitle: active.isBusiness
                ? tr('Logotip, muqova, ish vaqti, katalog')
                : null,
            onTap: () => Navigator.of(context).pop('edit'),
          ),

          // BIZNES AMALLARI.
          //
          // Bu uchta ekran ILOVADA YOZILGAN, lekin hech qayerdan
          // OCHILMASDI: biznes egasi kompaniya ochgandan keyin uni
          // tahrirlay ham, buyurtmalarini ko'ra ham olmasdi.
          if (active.isBusiness) ...[
            SheetAction(
              label: tr('Buyurtmalar'),
              icon: Ico.bag,
              subtitle: tr('Mijozlardan kelgan buyurtmalar'),
              onTap: () => Navigator.of(context).pop('orders'),
            ),
            SheetAction(
              label: tr('Biznes statistikasi'),
              icon: Ico.chart,
              onTap: () => Navigator.of(context).pop('bizstats'),
            ),
          ],
          SheetAction(
            label: tr('Mening kontentim'),
            icon: Ico.grid,
            onTap: () => Navigator.of(context).pop('content'),
          ),
          SheetAction(
            label: tr('Shaxsni almashtirish'),
            icon: Ico.refresh,
            onTap: () => Navigator.of(context).pop('switch'),
          ),
          const RowDivider(indent: 0),
          SheetAction(
            label: tr('Sozlamalar'),
            icon: Ico.settings,
            onTap: () => Navigator.of(context).pop('settings'),
          ),
        ],
      ),
    );
    if (!mounted || choice == null) return;

    switch (choice) {
      case 'public':
        await push<void>(
          context,
          (_) => active.isBusiness
              ? ProfileScreen(companyId: active.code)
              : ProfileScreen(code: active.code),
        );
      case 'edit':
        await _edit(active);
      case 'orders':
        await push<void>(
          context,
          (_) => OwnerOrdersScreen(
            companyId: active.code,
            companyName: active.name,
          ),
        );
      case 'bizstats':
        await push<void>(
          context,
          (_) => BusinessStatsScreen(companyId: active.code),
        );
      case 'content':
        await push<void>(context, (_) => const MyContentScreen());
        if (mounted) await _load();
      case 'switch':
        await showIdentitySwitcher(context);
      case 'settings':
        await push<void>(context, (_) => const SettingsScreen());
    }
  }
}

// ─────────────────────────────────────────────────────────────
/// EGA PROFILINING SARLAVHASI — prototip maketi.
///
/// Mayda "MENING PROFILIM" yozuvi, ostida ism, o'ngda sozlamalar
/// tugmasi. Foto cover bu yerdan olib tashlandi: o'z profilingizga
/// kirganda siz o'zingizni tomosha qilmaysiz — sizga BOSHQARUV
/// kerak (ID'lar, statistika, kontent). Cover esa OMMAVIY profilda
/// qoladi, u yerda uning vazifasi bor.
class _ProfileCover extends StatelessWidget {
  const _ProfileCover({
    required this.identity,
    required this.handle,
    required this.onMenu,
    required this.onEdit,
    required this.onSwitch,
    this.hasStory = false,
    this.onStory,
  });

  final Identity identity;
  final String handle;
  final VoidCallback onMenu;

  /// TANLANGAN shaxsni tahrirlash. Bu tab har doim EGASINIKI,
  /// shuning uchun tugma doim ko'rinadi — begona profil bu yerda
  /// umuman ochilmaydi (u `ProfileScreen` da ko'rsatiladi).
  final VoidCallback onEdit;

  /// Ism bosilganda ochiladigan shaxs almashtirish varaqasi.
  final VoidCallback onSwitch;

  /// Shu shaxsda ko'rilmagan istorya bormi — oltin halqa shunga
  /// qarab chiziladi.
  final bool hasStory;
  final VoidCallback? onStory;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
        child: Column(
          children: [
            // TEPA QATOR — yorliq chapda, sozlama o'ngda.
            Row(
              children: [
                Text(tr('Mening profilim').toUpperCase(), style: T.eyebrow),
                const Spacer(),
                RoundButton(Ico.settings, onTap: onMenu),
              ],
            ),

            // AVATAR — KATTA VA MARKAZDA.
            //
            // Ilgari profil sarlavhasi chapga tekislangan matn
            // qatori edi va yuz umuman ko'rinmasdi: ekran
            // ochilganda birinchi ko'zga kartalar tushardi.
            // Profil esa avvalo ODAM. Istorya bo'lsa atrofida
            // oltin halqa — xuddi lentadagidek, ya'ni bir belgi
            // ilovaning hamma joyida bitta ma'noni bildiradi.
            const SizedBox(height: S.x12),
            StoryRing(
              avatarUrl: identity.avatarUrl,
              name: identity.name,
              size: 128,
              // Halqa YONADI faqat ko'rilmagan istorya bo'lsa.
              seen: !hasStory,
              showLabel: false,
              onTap: hasStory ? onStory : null,
            ),
            const SizedBox(height: S.x12),

            // ISM BOSILSA — SHAXS ALMASHTIRISH.
            //
            // Karusel allaqachon ishlaydi, lekin u pastda. Ism
            // ekranning eng ko'zga tashlanadigan joyi: "men
            // kimman?" degan savol shu yerda tug'iladi, javobi
            // ham shu yerda bo'lsin.
            Press(
              onTap: onSwitch,
              minSize: 0,
              scale: .98,
              child: Column(
                children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(identity.name, maxLines: 1, style: T.title),
                  ),
                ),
                if (identity.verified) ...[
                  const SizedBox(width: 6),
                  const VerifiedBadge(size: 16),
                ],
              ],
            ),
            const SizedBox(height: 2),
            Text(
              handle,
              style: T.link.copyWith(color: C.accent, fontSize: 12),
            ),
                ],
              ),
            ),

            const SizedBox(height: S.x12),
            SecondaryButton(
              identity.isBusiness
                  ? tr('Biznesni tahrirlash')
                  : tr('Profilni tahrirlash'),
              icon: Ico.edit,
              size: BtnSize.m,
              onTap: onEdit,
            ),
          ],
        ),
      );
}


/// ID chiplari qatori — faol ID oltin halqa bilan.
/// KARTA KARUSELI (prototip: profil egasida kartalar yonma-yon).
///
/// NIMA UCHUN CHIP EMAS: karta — bu mahsulotning O'ZI. Uni kichkina
/// matnli chipga aylantirish "VIP001" degan qatorni qoldirardi va
/// odam o'zi sotib olgan oltin kartani ilovada umuman ko'rmasdi.
/// Bu yerda kartalar haqiqiy ko'rinishida, suriladigan qatorda.
///
/// Oxirgi katak — "ID qo'shish": ro'yxat tugagan joyda yangi karta
/// olish yo'li ochiq tursin.
class _CardCarousel extends StatelessWidget {
  const _CardCarousel({
    required this.items,
    required this.activeCode,
    required this.onSelect,
    required this.onAdd,
  });

  /// SHAXSIY VA BIZNES ID'LAR BIR QATORDA.
  ///
  /// Ilgari bu yerda faqat `state.cards` — shaxsiy kartalar —
  /// turardi. Kompaniyasi bor odam o'z profilida biznes
  /// profillarini UMUMAN ko'rmasdi: ular faqat menyu ostidagi
  /// varaqada bor edi va uni topish kerak edi. Egasining
  /// shikoyati ham shu: "business profillar ko'rinmayapti"
  /// (serverda ular joyida — `/api/companies/mine` uchtasini
  /// qaytaradi).
  final List<Identity> items;
  final String activeCode;
  final ValueChanged<Identity> onSelect;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) => SizedBox(
        // IXCHAMROQ, LEKIN MAYDA EMAS.
        //
        // 208 dp da karusel ekranning yarmini egallardi va uning
        // ostidagi hech narsa birinchi qarashda ko'rinmasdi.
        // 168 dp — karta hali ham o'qiladi (kod, ism, havola),
        // lekin sahifa boshi nafas oladi.
        height: 168,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          itemCount: items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(width: S.x12),
          itemBuilder: (context, i) {
            if (i == items.length) {
              return Press(
                onTap: onAdd,
                minSize: 0,
                scale: .97,
                child: Container(
                  width: 150,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(R.metalCard),
                    border: Border.all(color: C.line),
                  ),
                  alignment: Alignment.center,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      NIcon(Ico.plus, size: 22, color: C.accent),
                      const SizedBox(height: S.x8),
                      Text(
                        tr('ID qo‘shish'),
                        style: T.buttonSm.copyWith(color: C.ink2),
                      ),
                    ],
                  ),
                ),
              );
            }

            final id = items[i];
            final active = id.code == activeCode;
            return Opacity(
              // FAOL BO'LMAGANI SO'NADI: bosh sahifada va NFC da
              // aynan shu karta ishlatiladi, shuning uchun qaysi
              // biri tanlangani bir qarashda ko'rinsin.
              opacity: active ? 1 : .55,
              child: SizedBox(
                width: 250,
                // BOSISH KARTANING O'ZIGA BERILADI.
                //
                // `IdentityCard` ning ichida o'z bosish ishlovchisi
                // bor (kartani aylantirish) va u tashqi `Press` ga
                // hech narsa qoldirmasdi — shu sababli karuseldan
                // boshqa ID ni tanlab bo'lmasdi. Endi tanlash
                // kartaning o'z `onTap` iga uzatiladi, aylantirish
                // esa faqat ALLAQACHON tanlangan kartada qoladi:
                // bitta bosish ikki xil ish qilmasin.
                child: IdentityCard(
                  code: id.code,
                  tier: id.tier,
                  holder: id.name,
                  url: profileHandle(
                    context,
                    id.code,
                    company: id.isBusiness,
                  ),
                  sweep: active,
                  flippable: active,
                  onTap: active ? null : () => onSelect(id),
                ),
              ),
            );
          },
        ),
      );
}

/// O'sish foizi — oxirgi kun oldingi kunlarning o'rtachasiga
/// nisbatan.
class _Delta extends StatelessWidget {
  const _Delta({required this.series});

  final List<int> series;

  @override
  Widget build(BuildContext context) {
    if (series.length < 2) return const SizedBox.shrink();
    final last = series.last;
    final rest = series.sublist(0, series.length - 1);
    final avg = rest.reduce((a, b) => a + b) / rest.length;
    if (avg == 0) return const SizedBox.shrink();
    final delta = ((last - avg) / avg * 100).round();
    final up = delta >= 0;
    return StatusChip(
      '${up ? '+' : ''}$delta%',
      tone: up ? StatusTone.ok : StatusTone.neutral,
    );
  }
}

/// BIZNES KARTASI — profil egasidagi "mening biznesim".
///
/// Shaxsda o'rnida NFC kartalar karuseli turadi; biznesda esa
/// karta yo'q — mahsulot o'sha kompaniyaning O'ZI. Shuning uchun
/// bu yerda muqova, logotip, nom, kod va bitta amal:
/// "Biznesni tahrirlash".
class _BusinessCard extends StatelessWidget {
  const _BusinessCard({
    required this.company,
    required this.code,
    required this.name,
    required this.onEdit,
  });

  final Company? company;
  final String code;
  final String name;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final c = company;

    return Surface(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(R.card),
            ),
            child: AspectRatio(
              aspectRatio: 16 / 7,
              child: BusinessHero(imageUrl: c?.coverUrl ?? c?.logoUrl),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(S.x16),
            child: Row(
              children: [
                Avatar(
                  url: c?.logoUrl,
                  name: c?.name ?? name,
                  size: 46,
                  square: true,
                ),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              c?.name ?? name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: T.cardTitle,
                            ),
                          ),
                          if (c?.verified ?? false) ...[
                            const SizedBox(width: 6),
                            const VerifiedBadge(size: 15),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          code,
                          if ((c?.category ?? '').isNotEmpty) c!.category,
                          if ((c?.city ?? '').isNotEmpty) c!.city,
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.caption.copyWith(fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: S.x8),
                RoundButton(Ico.edit, size: 42, iconSize: 17, onTap: onEdit),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
