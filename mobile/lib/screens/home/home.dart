import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/logo.dart';
import '../../design/components/media.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/story_ring.dart';
import '../../design/components/surface.dart';
import '../../design/components/toast.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../../state/seen_stories.dart';
import '../content/compose.dart';
import '../content/post_detail.dart';
import '../content/comments_sheet.dart';
import '../content/report_sheet.dart';
import '../content/story_viewer.dart';
import '../identity/profile_screen.dart';
import '../identity/switcher.dart';
import '../nfc/gift_offers.dart';
import '../nfc/gift_id.dart';
import '../orders/my_orders.dart';
import '../shell.dart';
import '../nfc/id_catalog.dart';
import '../nfc/nfc_scan.dart';
import '../nfc/qr_share.dart';

/// BOSH SAHIFA — "men kimman va nima bo'lyapti".
///
/// TARTIB (dizayn 2a): salomlashuv → story qatori → MENING
/// KARTAM → tezkor amallar → lenta. Karta ekranning qahramoni va u
/// birinchi ekranda turishi kerak: ilova ochilganda odam avvalo
/// o'z ID'sini ko'radi.
///
/// YORUG'LIK TEPADAN va ISSIQ — salomlashuv shu yerda turadi.
/// Qidiruv va NFC markazida yorug'lik boshqa joydan tushadi,
/// shuning uchun ekranlar bir-biriga o'xshamaydi.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  /// Qaysi istorya ko'rilgani — QURILMADA saqlanadi (serverda
  /// bunday jadval yo'q). Halqaning rangi shunga qarab belgilanadi.
  late final SeenStories _seen = SeenStories();

  List<StoryFeedEntry> _stories = const [];
  List<FeedEntry> _feed = const [];
  List<Order> _pending = const [];
  int _gifts = 0;

  /// Haftaning kompaniyasi — sana bo'yicha tanlanadi.
  Company? _featured;

  /// Faol kartaning statistikasi — sarlavha ostidagi qator uchun.
  CardStats? _stats;

  Object? _error;
  bool _loading = true;
  bool _loadedOnce = false;
  String? _loadedFor;

  /// Oxirgi marta qachon yuklangan — fondan qaytganda qaytadan
  /// so'rash kerakmi, shundan bilinadi.
  DateTime? _loadedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _seen.addListener(_onSeenChanged);
    _seen.load();
  }

  /// FONDAN QAYTGANDA LENTA YANGILANADI.
  ///
  /// Sayt va ilova bitta bazadan o'qiydi. Odam saytda post yoki story
  /// joylab, ilovaga qaytsa — eski lentani ko'rib turardi va uni
  /// qo'lda tortib yangilashi kerak edi.
  ///
  /// HAR QAYTISHDA EMAS: ilovani bir daqiqada o'n marta ochib-yopish
  /// odatiy hol va har safar so'rov yuborish tarmoqni ham, batareyani
  /// ham bekorga sarflardi. Bir daqiqadan eski bo'lsa — yangilanadi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state != AppLifecycleState.resumed) return;
    final at = _loadedAt;
    if (at != null && DateTime.now().difference(at) < const Duration(minutes: 1)) {
      return;
    }
    _load(force: true);
  }

  void _onSeenChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _seen.removeListener(_onSeenChanged);
    _seen.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Shaxs almashsa ma'lumot qayta yuklanadi: Bosh sahifa faol
    // shaxs kontekstida ko'rsatiladi.
    final code = AppScope.of(context).active?.code;
    if (!_loadedOnce || code != _loadedFor) {
      _loadedOnce = true;
      _loadedFor = code;
      _load();
    }
  }

  Future<void> _load({bool force = false}) async {
    final state = AppScope.read(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (force) state.repo.invalidateCatalog();

      // LENTA — asosiy kontent, xatosi ekranni yiqitadi.
      final feed = await state.repo.feed(page: 1);

      // QOLGANLARI IXTIYORIY. Ularning har biri o'z sababi bilan
      // yiqilishi mumkin (tarif, ruxsat, tarmoq) va bu butun Bosh
      // sahifani bo'sh qoldirmasligi kerak.
      List<StoryFeedEntry> stories = const [];
      try {
        stories = await state.repo.storyFeed();
      } catch (_) {}

      // TUGALLANMAGAN TO'LOV vaqtga bog'liq: kod 24 soat band
      // bo'lib turadi va shu muddatda to'lanmasa bekor qilinadi.
      // Shuning uchun u Bosh sahifada ko'rinadi.
      List<Order> pending = const [];
      try {
        pending = (await state.repo.orders()).where((o) => o.isPending).toList();
      } catch (_) {}

      // KUTILAYOTGAN SOVG'A — tasdiqlanmasa ID o'tmaydi, ya'ni odam
      // o'ziga sovg'a qilingan ID borligini bilmay qoladi.
      var gifts = 0;
      try {
        gifts = (await state.repo.giftOffers()).incoming.length;
      } catch (_) {}

      // HAFTANING KOMPANIYASI (prototip: "Haftaning kompaniyasi").
      //
      // TASODIFIY EMAS, SANA BO'YICHA: kun davomida hamma bitta
      // kompaniyani ko'radi. Tasodifiy tanlov har ochilganda
      // boshqasini ko'rsatib, ro'yxatni "qaltis" qilib qo'yardi va
      // kompaniyaning o'zi "men qachon chiqdim?" degan savolga
      // javob ololmasdi.
      // BUGUNGI TEGISHLAR (prototip: "Bugun 14 kishi kartangizga
      // tegdi"). Jami ko'rish emas, AYNAN BUGUNGI son: odam
      // ilovani ochganda "bugun nima bo'ldi?" degan savolga javob
      // oladi. Jami son esa profil ichida, statistika bo'limida.
      CardStats? stats;
      final activeCode = state.active?.code;
      if (activeCode != null && activeCode.isNotEmpty) {
        try {
          stats = await state.repo.cardStats(activeCode, days: 7);
        } catch (_) {}
      }

      Company? featured;
      try {
        final all = (await state.repo.companies())
            .where((c) => c.status == 'active')
            .toList();
        if (all.isNotEmpty) {
          final day = DateTime.now().difference(DateTime(2026)).inDays;
          featured = all[day % all.length];
        }
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _feed = feed.items;
        _stories = stories;
        _pending = pending;
        _gifts = gifts;
        _featured = featured;
        _stats = stats;
        _loading = false;
        _loadedAt = DateTime.now();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  /// SARLAVHA OSTIDAGI QATOR.
  ///
  /// Prototipda: "Bugun 14 kishi kartangizga tegdi". Bugun hech kim
  /// tegmagan bo'lsa bu qator YOLG'ON bo'lib qolmasin deb, jami
  /// ko'rishga o'tadi. Ikkalasi ham bo'lmasa — umuman
  /// ko'rsatilmaydi: "Bugun 0 kishi tegdi" degan yozuv yangi
  /// foydalanuvchini bekorga xafa qiladi.
  String? _subtitle(Identity? active) {
    final today = _stats?.today ?? 0;
    if (today > 0) {
      return trf('Bugun {n} kishi kartangizga tegdi', {'n': som(today)});
    }
    final views = active?.record?.views ?? 0;
    if (views > 0) {
      return trf('Profilingiz {n} marta ko‘rilgan', {'n': som(views)});
    }
    return null;
  }

  /// BILDIRISHNOMALAR — qo'ng'iroq ostidagi varaqa.
  ///
  /// Prototipda bosh sahifada ogohlantirish kartalari YO'Q, lekin
  /// tepada nuqtali qo'ng'iroq bor. Ikkala muhim xabar — tugallanmagan
  /// to'lov va kutilayotgan sovg'a — shu yerga ko'chdi: ular bir
  /// bosishda qoladi, ekranni esa egallamaydi.
  Future<void> _openNotifications() async {
    if (_pending.isEmpty && _gifts == 0) {
      showToast(context, tr('Yangi bildirishnoma yo‘q'));
      return;
    }
    await showSheet<void>(
      context,
      title: tr('Bildirishnomalar'),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_pending.isNotEmpty)
            _Notice(
              icon: Ico.clock,
              tone: StatusTone.pending,
              title: tr('To‘lov tugallanmagan'),
              message: trf(
                '{code} kodi band qilingan. To‘lov tasdiqlanmasa, '
                'kod boshqa odamga o‘tadi.',
                {'code': _pending.first.code},
              ),
              actionLabel: tr('Davom etish'),
              onAction: () {
                Navigator.of(context).pop();
                push<void>(context, (_) => const MyOrdersScreen());
              },
            ),
          if (_pending.isNotEmpty && _gifts > 0) const SizedBox(height: S.x8),
          if (_gifts > 0)
            _Notice(
              icon: Ico.gift,
              tone: StatusTone.accent,
              title: tr('Sizga ID sovg‘a qilindi'),
              message: tr('Qabul qilmaguningizcha ID sizga o‘tmaydi.'),
              actionLabel: tr('Ko‘rish'),
              onAction: () {
                Navigator.of(context).pop();
                push<void>(context, (_) => const GiftOffersScreen())
                    .then((_) => mounted ? _load(force: true) : null);
              },
            ),
        ],
      ),
    );
  }

  Future<void> _addStory(String code) async {
    final done = await push<bool>(
      context,
      (_) => ComposeScreen(code: code, kind: ComposeKind.story),
    );
    if (done == true && mounted) await _load(force: true);
  }

  /// KO'RILMAGANLAR OLDINDA.
  ///
  /// Qator uzun bo'lsa, yangi istorya o'ntanchi bo'lib qolishi
  /// mumkin edi va odam uni umuman ko'rmasdi. Tartib ichida
  /// serverning tartibi saqlanadi — faqat ikki guruhga ajraladi.
  List<StoryFeedEntry> get _orderedStories => [
        ..._stories.where(_seen.hasUnseen),
        ..._stories.where((e) => !_seen.hasUnseen(e)),
      ];

  Future<void> _openStory(StoryFeedEntry e) async {
    await push<void>(context, (_) => StoryViewerScreen(code: e.code));
    // KO'RILDI DEB SHU YERDA BELGILANADI — ekran YOPILGANDA.
    //
    // Ochilish paytida belgilansa, odam adashib bosib darhol
    // chiqqanida ham halqa so'nardi.
    await _seen.markSeen(e.ids);
  }

  /// LENTADAGI "⋯" MENYUSI.
  ///
  /// Reels va post ekranidagi bilan bir xil: o'zining kontenti
  /// bo'lsa "O'chirish", begonasida "Shikoyat qilish" va
  /// "Obunani bekor qilish". O'chirilgan yozuv lentadan darhol
  /// ketadi — qayta yuklash kutilmaydi.
  Future<void> _menu(FeedEntry item) async {
    final state = AppScope.read(context);
    final mine = item.isCompany
        ? state.ownsCompany(item.code)
        : state.ownsRecord(item.code);

    await showContentMenu(
      context,
      targetKind: item.isStory
          ? (item.isCompany ? 'company_story' : 'story')
          : (item.isCompany ? 'company_post' : 'post'),
      targetId: '${item.id}',
      ownerCode: item.code,
      owned: mine,
      onDeleted: () {
        if (!mounted) return;
        setState(() => _feed = [..._feed]..removeWhere(
              (e) => e.id == item.id && e.kind == item.kind,
            ));
      },
    );
  }

  /// IZOHLAR VARAQASI — lentadagi kadr uchun.
  ///
  /// Varaqa yopilganda server bergan jami son bilan lentadagi hisob
  /// yangilanadi: odam izoh yozib qaytgach, eski raqamni ko'rmasin.
  Future<void> _openComments(FeedEntry item) async {
    final total = await showCommentsSheet(
      context,
      targetKind: item.commentTarget,
      targetId: item.id,
      initialCount: item.commentCount,
    );
    if (!mounted || total == null) return;
    setState(() {
      _feed = [
        for (final e in _feed)
          e.id == item.id && e.kind == item.kind ? e.copyWith(commentCount: total) : e,
      ];
    });
  }

  Future<void> _toggleLike(FeedEntry item) async {
    final repo = AppScope.read(context).repo;
    // OPTIMISTIK: yurak darhol to'ladi, so'rov fonda ketadi.
    // Server rad etsa holat qaytariladi.
    final before = item;
    setState(() {
      _feed = [
        for (final e in _feed)
          e.id == item.id && e.kind == item.kind
              ? e.copyWith(
                  liked: !e.liked,
                  likeCount: e.likeCount + (e.liked ? -1 : 1),
                )
              : e,
      ];
    });
    try {
      final r = item.isStory
          ? await repo.likeStory(item.id)
          : await repo.likePost(item.id);
      if (!mounted) return;
      setState(() {
        _feed = [
          for (final e in _feed)
            e.id == item.id && e.kind == item.kind
                ? e.copyWith(liked: r.liked, likeCount: r.count)
                : e,
        ];
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _feed = [
          for (final e in _feed)
            e.id == item.id && e.kind == item.kind ? before : e,
        ];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final active = state.active;
    final firstName = (active?.name ?? '').split(' ').first;

    return ScreenBackdrop(
      aura: Aura.home,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _load(force: true),
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _Header(
                  identity: active,
                  unread: _gifts + _pending.length,
                  onSearch: () => ShellScope.maybeOf(context)?.goTab(1),
                  onBell: _openNotifications,
                ),
              ),

              // SALOMLASHUV.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // PROTOTIPDA SHAHAR VA SANA YO'Q: ular hech
                      // qanday savolga javob bermaydi (sanani odam
                      // telefonining tepasida ko'rib turibdi).
                      // O'rniga — bitta JONLI qator.
                      _Greeting(name: firstName),
                      if (_subtitle(active) != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          _subtitle(active)!,
                          style: T.body.copyWith(fontSize: 13.5, color: C.ink2),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // STORY QATORI.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: S.x20),
                  child: _StoryStrip(
                    entries: _orderedStories,
                    loading: _loading && _stories.isEmpty,
                    unseen: _seen.hasUnseen,
                    onAdd: active == null ? null : () => _addStory(active.code),
                    onOpen: _openStory,
                  ),
                ),
              ),

              // MENING KARTAM — ekranning qahramoni.
              if (active != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      S.gutter,
                      S.x20,
                      S.gutter,
                      0,
                    ),
                    child: _ActiveCard(identity: active),
                  ),
                ),

              // TEZKOR AMALLAR.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x16,
                    S.gutter,
                    0,
                  ),
                  child: _QuickActions(identity: active),
                ),
              ),

              // HAFTANING KOMPANIYASI — katta rasmli karta.
              //
              // TUGALLANMAGAN TO'LOV VA SOVG'A KARTALARI BU YERDAN
              // OLIB TASHLANDI (prototipda ular yo'q). Ma'lumot
              // yo'qolmadi: ikkalasi ham sarlavhadagi qo'ng'iroq
              // ostida, nuqta bilan belgilanadi — ya'ni ular hali
              // ham BIR BOSISHDA, lekin bosh sahifani egallamaydi.
              if (_featured != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(S.gutter, S.x32, S.gutter, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SectionHeader(
                          tr('Haftaning kompaniyasi'),
                          actionLabel: tr('Hammasi'),
                          onAction: () => ShellScope.maybeOf(context)?.goTab(1),
                        ),
                        const SizedBox(height: S.x12),
                        _FeaturedCompany(company: _featured!),
                      ],
                    ),
                  ),
                ),

              // LENTA.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x32,
                    S.gutter,
                    S.x12,
                  ),
                  child: SectionHeader(tr('Lenta')),
                ),
              ),

              if (_loading && _feed.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: Column(
                      children: List.generate(3, (_) => const SkeletonRow()),
                    ),
                  ),
                )
              else if (_error != null && _feed.isEmpty)
                SliverToBoxAdapter(
                  child: ErrorState(
                    humanError(_error),
                    detail: errorDetail(_error),
                    onRetry: _load,
                  ),
                )
              else if (_feed.isEmpty)
                SliverToBoxAdapter(
                  child: EmptyState(
                    tr('Obuna bo‘lgan odamlaringiz post qo‘shsa, shu yerda '
                        'ko‘rinadi.'),
                    title: tr('Lenta hozircha bo‘sh'),
                    icon: Ico.image,
                    actionLabel: tr('Odamlarni topish'),
                    onAction: () => push<void>(
                      context,
                      (_) => const IdCatalogScreen(),
                    ),
                  ),
                )
              else
                SliverList.separated(
                  itemCount: _feed.length,
                  separatorBuilder: (_, __) => const SizedBox(height: S.x12),
                  itemBuilder: (context, i) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: FeedCard(
                      item: _feed[i],
                      onLike: () => _toggleLike(_feed[i]),
                      onComment: () => _openComments(_feed[i]),
                      onMenu: () => _menu(_feed[i]),
                      onAuthor: () => push<void>(
                        context,
                        (_) => _feed[i].isCompany
                            ? ProfileScreen(companyId: _feed[i].code)
                            : ProfileScreen(code: _feed[i].code),
                      ),
                      onOpen: _feed[i].isStory
                          ? () => push<void>(
                                context,
                                (_) => StoryViewerScreen(code: _feed[i].code),
                              )
                          : () => push<void>(
                                context,
                                (_) => PostDetailScreen(
                                  post: Post(
                                    id: '${_feed[i].id}',
                                    caption: _feed[i].caption,
                                    images: [
                                      if ((_feed[i].imageUrl ?? '').isNotEmpty)
                                        _feed[i].imageUrl!,
                                    ],
                                    videoUrl: _feed[i].videoUrl,
                                    createdAt: _feed[i].createdAt,
                                    likes: _feed[i].likeCount,
                                    liked: _feed[i].liked,
                                    authorName: _feed[i].name,
                                    authorAvatar: _feed[i].avatarUrl,
                                    authorCode: _feed[i].code,
                                  ),
                                  commentKind: _feed[i].commentTarget,
                                ),
                              ),
                    ),
                  ),
                ),

              SliverToBoxAdapter(
                child: SizedBox(height: NavBar.inset(context)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// TEPA QATOR
// ─────────────────────────────────────────────────────────────

class _Header extends StatelessWidget {
  const _Header({this.identity, this.unread = 0, this.onSearch, this.onBell});

  final Identity? identity;

  /// Bildirishnoma nuqtasi — sovg'a taklifi va tugallanmagan to'lov.
  final int unread;
  final VoidCallback? onSearch;
  final VoidCallback? onBell;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, 0),
        child: Row(
          children: [
            // BREND — PUNKTIR CHEGARALI YORLIQ (prototip: `.logo`).
            //
            // Medalyon bu yerdan olib tashlandi: markaziy tab endi
            // NFC orbi va ekranda ikkita "brend nishoni" bir-biriga
            // xalaqit berardi.
            Press(
              onTap: () => showIdentitySwitcher(context),
              minSize: S.tap,
              scale: .96,
              child: const BrandTag(),
            ),
            const Spacer(),
            _IconButton(icon: Ico.search, onTap: onSearch),
            const SizedBox(width: S.x8),
            _IconButton(icon: Ico.bell, onTap: onBell, dot: unread > 0),
          ],
        ),
      );
}

/// Sarlavha qatoridagi dumaloq tugma (prototip: `.icobtn`).
class _IconButton extends StatelessWidget {
  const _IconButton({required this.icon, this.onTap, this.dot = false});

  final Ico icon;
  final VoidCallback? onTap;
  final bool dot;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: S.tap,
        scale: .92,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: C.surface,
                border: Border.all(color: C.line),
              ),
              alignment: Alignment.center,
              child: NIcon(icon, size: 18, color: C.ink),
            ),
            if (dot)
              Positioned(
                right: 8,
                top: 8,
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: C.fail,
                    shape: BoxShape.circle,
                    border: Border.all(color: C.surface, width: 2),
                  ),
                ),
              ),
          ],
        ),
      );
}

/// "Salom, *Dilshod*" — kursiv urg'u so'zi urg'u rangida
/// (prototip: `h1.hero` va uning ichidagi `em`).
class _Greeting extends StatelessWidget {
  const _Greeting({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    if (name.isEmpty) {
      return Text(tr('Salom'), style: T.title);
    }
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '${tr('Salom')}, ', style: T.title),
          TextSpan(
            text: name,
            style: T.title.copyWith(
              fontStyle: FontStyle.italic,
              color: C.accent,
            ),
          ),
        ],
      ),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// STORY QATORI
// ─────────────────────────────────────────────────────────────

class _StoryStrip extends StatelessWidget {
  const _StoryStrip({
    required this.entries,
    required this.loading,
    required this.unseen,
    required this.onAdd,
    required this.onOpen,
  });

  final List<StoryFeedEntry> entries;
  final bool loading;

  /// Shu odamda ko'rilmagan istorya bormi — halqa shunga qarab
  /// yonadi yoki so'nadi.
  final bool Function(StoryFeedEntry) unseen;

  final VoidCallback? onAdd;
  final ValueChanged<StoryFeedEntry> onOpen;

  @override
  Widget build(BuildContext context) {
    if (loading) return const SkeletonStories();

    return SizedBox(
      height: 88,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        itemCount: entries.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: S.x12),
        itemBuilder: (context, i) {
          if (i == 0) {
            return StoryRing(addButton: true, onTap: onAdd);
          }
          final e = entries[i - 1];
          return StoryRing(
            avatarUrl: e.avatarUrl,
            name: e.name,
            // KO'RILGAN BO'LSA HALQA SO'NADI va aylanishi to'xtaydi:
            // ma'no rangda, harakat esa faqat YANGI kontent uchun.
            seen: !unseen(e),
            onTap: () => onOpen(e),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// FAOL KARTA
// ─────────────────────────────────────────────────────────────

class _ActiveCard extends StatelessWidget {
  const _ActiveCard({required this.identity});

  final Identity identity;

  @override
  Widget build(BuildContext context) {
    final record = identity.record;
    return IdentityCard(
      code: identity.code,
      tier: record?.tier ?? Tier.free,
      holder: identity.name,
      url: identity.publicUrl.replaceFirst('https://', ''),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// TEZKOR AMALLAR
// ─────────────────────────────────────────────────────────────

class _QuickActions extends StatelessWidget {
  const _QuickActions({this.identity});

  final Identity? identity;

  @override
  Widget build(BuildContext context) {
    final record = identity?.record;
    return Row(
      children: [
        Expanded(
          child: _ActionTile(
            icon: Ico.scan,
            label: tr('Skanerlash'),
            onTap: () => push<void>(context, (_) => const NfcScanScreen()),
          ),
        ),
        const SizedBox(width: S.x8),
        Expanded(
          child: _ActionTile(
            icon: Ico.qr,
            label: tr('QR ulashish'),
            onTap: identity == null
                ? null
                : () => push<void>(
                      context,
                      (_) => QrShareScreen(identity: identity!),
                    ),
          ),
        ),
        const SizedBox(width: S.x8),
        Expanded(
          child: _ActionTile(
            icon: Ico.bag,
            label: tr('Do‘kon'),
            onTap: () => push<void>(context, (_) => const IdCatalogScreen()),
          ),
        ),
        const SizedBox(width: S.x8),
        Expanded(
          child: _ActionTile(
            icon: Ico.gift,
            label: tr('Sovg‘a'),
            onTap: record == null
                ? null
                : () => push<void>(context, (_) => GiftIdScreen(record: record)),
          ),
        ),
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.label, this.onTap});

  final Ico icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .96,
        child: Container(
          height: 92,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: C.surface,
            borderRadius: BorderRadius.circular(R.tile),
            border: Border.all(color: C.line),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // IKONKA YUMALOQ KVADRAT ICHIDA (prototip:
              // `.quick button .ic`) — plita ichida ikkinchi daraja
              // hosil qiladi va yorliq bilan chalkashmaydi.
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: (onTap == null ? C.ink3 : C.accent).withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: NIcon(icon, size: 20, color: onTap == null ? C.ink3 : C.accent),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: T.buttonSm.copyWith(
                  fontSize: 12.5,
                  color: onTap == null ? C.ink3 : C.ink,
                ),
              ),
            ],
          ),
        ),
      );
}

/// HAFTANING KOMPANIYASI — 4:3 rasmli karta (prototip: `.feat`).
///
/// Rasm ustidagi matn har doim o'qilishi kerak, shuning uchun
/// pastdan yuqoriga qorayadigan scrim qo'yiladi: rasm yorug' bo'lsa
/// ham oq yozuv yo'qolmaydi.
class _FeaturedCompany extends StatelessWidget {
  const _FeaturedCompany({required this.company});

  final Company company;

  @override
  Widget build(BuildContext context) => Press(
        onTap: () => push<void>(
          context,
          (_) => ProfileScreen(companyId: company.id),
        ),
        minSize: 0,
        scale: .98,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(R.card),
          child: AspectRatio(
            aspectRatio: 4 / 3,
            child: Stack(
              fit: StackFit.expand,
              children: [
                NetImage(company.coverUrl ?? company.logoUrl, radius: 0),
                const Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x00000000), Color(0xCC000000)],
                        stops: [.35, 1],
                      ),
                    ),
                  ),
                ),
                if (company.verified)
                  Positioned(
                    left: S.x12,
                    top: S.x12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0x2EFFFFFF),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0x40FFFFFF)),
                      ),
                      child: Text(
                        '${tr('Admin tasdiqlagan')} ✓',
                        style: T.caption.copyWith(color: const Color(0xFFFFFFFF)),
                      ),
                    ),
                  ),
                Positioned(
                  left: S.x16,
                  right: S.x16,
                  bottom: S.x12,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (company.city.isNotEmpty) ...[
                        Text(
                          company.city.toUpperCase(),
                          style: T.statLabel.copyWith(color: const Color(0xD9FFFFFF)),
                        ),
                        const SizedBox(height: 4),
                      ],
                      Text(
                        company.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.section.copyWith(color: const Color(0xFFFFFFFF)),
                      ),
                      Text(
                        company.id,
                        style: T.meta.copyWith(color: const Color(0xB3FFFFFF)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// OGOHLANTIRISH KARTASI
// ─────────────────────────────────────────────────────────────

class _Notice extends StatelessWidget {
  const _Notice({
    required this.icon,
    required this.tone,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final Ico icon;
  final StatusTone tone;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  Color get _tint => switch (tone) {
        StatusTone.pending => C.warn,
        StatusTone.fail => C.fail,
        StatusTone.ok => C.ok,
        _ => C.accent,
      };

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x16),
        border: Border.all(color: _tint.withValues(alpha: .3)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: _tint.withValues(alpha: .14),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: NIcon(icon, size: 17, color: _tint),
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: T.cardTitle),
                  const SizedBox(height: 4),
                  Text(
                    message,
                    style: T.caption.copyWith(fontSize: 12.5),
                  ),
                  const SizedBox(height: S.x12),
                  GhostButton(
                    actionLabel,
                    size: BtnSize.s,
                    color: _tint,
                    onTap: onAction,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// LENTA KARTASI
// ─────────────────────────────────────────────────────────────

/// Lentadagi bitta element — post yoki story.
///
/// IZOH SONI KO'RSATILMAYDI: serverda izoh tizimi yo'q, ya'ni
/// ko'rsatiladigan son ham yo'q. Bor narsani ko'rsatamiz — layk.
class FeedCard extends StatelessWidget {
  const FeedCard({
    super.key,
    required this.item,
    required this.onLike,
    required this.onComment,
    required this.onAuthor,
    required this.onOpen,
    this.onMenu,
  });

  final FeedEntry item;
  final VoidCallback onLike;

  /// Izohlar varaqasini ochadi. Yoqtirishdan farqli o'laroq HAMMA
  /// kontent turida ishlaydi — kompaniya postida ham.
  final VoidCallback onComment;
  final VoidCallback onAuthor;
  final VoidCallback onOpen;

  /// "⋯" — o'z kontentini o'chirish, begonasiga shikoyat qilish,
  /// obunani bekor qilish. Lentada bu yo'l BO'LISHI SHART: odam
  /// ko'rgan joyida chora ko'ra olsin.
  final VoidCallback? onMenu;

  @override
  Widget build(BuildContext context) {
    final media = (item.imageUrl ?? '').isNotEmpty;

    return Surface(
      padding: EdgeInsets.zero,
      onTap: onOpen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(S.x12, S.x12, S.x12, S.x12),
            child: Row(
              children: [
                Press(
                  onTap: onAuthor,
                  minSize: 0,
                  scale: .95,
                  child: Avatar(
                    url: item.avatarUrl,
                    name: item.name,
                    size: 44,
                    square: item.isCompany,
                  ),
                ),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        item.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.cardTitle,
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          if (item.isStory) ...[
                            Text(
                              'STORY',
                              style: T.meta.copyWith(
                                fontSize: 9.5,
                                color: C.accent,
                                letterSpacing: 1.2,
                              ),
                            ),
                            Text(' · ', style: T.meta),
                          ],
                          Text(ago(item.createdAt).toUpperCase(),
                              style: T.meta.copyWith(fontSize: 10)),
                        ],
                      ),
                    ],
                  ),
                ),
                if (onMenu != null)
                  Press(
                    onTap: onMenu,
                    minSize: S.tap,
                    scale: .9,
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: NIcon(Ico.more, size: 18, color: C.ink3),
                    ),
                  ),
              ],
            ),
          ),
          if (media)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: S.x12),
              // RASM QIRQILMAYDI: ramka rasmning o'z nisbatiga
              // moslashadi. Ilgari bu yerda qat'iy 4:3 turardi va
              // telefonda olingan tik rasmning yarmi kesilardi.
              child: AutoImage(item.imageUrl, radius: R.tile),
            ),
          if (item.caption.trim().isNotEmpty)
            Padding(
              padding: EdgeInsets.fromLTRB(S.x12, media ? S.x12 : 0, S.x12, 0),
              child: Text(
                item.caption,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: T.body.copyWith(fontSize: 14, height: 1.45),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(S.x12, S.x12, S.x12, S.x12),
            child: Row(
              children: [
                if (item.likeable)
                  LikeButton(
                    liked: item.liked,
                    count: item.likeCount,
                    onTap: onLike,
                  )
                else
                  Row(
                    children: [
                      NIcon(Ico.heart, size: 17, color: C.ink3),
                      const SizedBox(width: 6),
                      Text('${item.likeCount}', style: T.meta),
                    ],
                  ),
                const SizedBox(width: S.x20),
                CommentButton(count: item.commentCount, onTap: onComment),
                const Spacer(),
                NIcon(Ico.chevronRight, size: 16, color: C.ink3),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// IZOH TUGMASI — yurakning yonida turadigan pufak va son.
///
/// NIMA UCHUN ALOHIDA WIDGET: lenta, Reels va post ekrani — uchala
/// joyda bir xil ko'rinishi kerak. Nusxa ko'chirilsa, biri
/// o'zgarganda qolgani ortda qolardi.
///
/// SONI NOL BO'LSA HAM KO'RINADI: "0" — bu taklif ("birinchi bo'l"),
/// yashirilgan tugma esa imkoniyat borligini umuman bildirmasdi.
class CommentButton extends StatelessWidget {
  const CommentButton({
    super.key,
    required this.count,
    required this.onTap,
    this.size = 20,
    this.color,
    this.onMedia = false,
    this.vertical = false,
  });

  final int count;
  final VoidCallback onTap;
  final double size;
  final Color? color;
  final bool onMedia;

  /// Reels ustunida belgi TEPADA, son PASTDA turadi (prototip).
  final bool vertical;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? C.ink2;
    final icon = NIcon(Ico.comment, size: size, color: tint, onMedia: onMedia);
    final label = Text(
      '$count',
      style: T.meta.copyWith(
        color: tint,
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
        shadows: onMedia ? C.mediaText : null,
      ),
    );
    return Press(
      onTap: onTap,
      haptic: true,
      minSize: S.tap,
      scale: .9,
      child: vertical
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [icon, const SizedBox(height: 5), label],
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [icon, const SizedBox(width: 7), label],
            ),
    );
  }
}

/// LAYK TUGMASI — 220 ms spring bilan 1 → 1.25 → 1.
///
/// Dizayn shuni aniq belgilaydi. Kichik detal, lekin aynan shu
/// harakat bosishni "sezilarli" qiladi.
class LikeButton extends StatefulWidget {
  const LikeButton({
    super.key,
    required this.liked,
    required this.count,
    required this.onTap,
    this.size = 20,
    this.color,
    this.onMedia = false,
    this.vertical = false,
  });

  final bool liked;
  final int count;
  final VoidCallback onTap;
  final double size;
  final Color? color;
  final bool onMedia;

  /// Reels ustunida belgi TEPADA, son PASTDA turadi (prototip).
  final bool vertical;

  @override
  State<LikeButton> createState() => _LikeButtonState();
}

class _LikeButtonState extends State<LikeButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: M.like,
  );

  @override
  void didUpdateWidget(LikeButton old) {
    super.didUpdateWidget(old);
    // Faqat LAYK QO'YILGANDA sakraydi. Olib tashlanganda tinch
    // qaytadi — bekor qilish nishonlanadigan hodisa emas.
    if (!old.liked && widget.liked) _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tint = widget.liked ? C.accent : (widget.color ?? C.ink2);
    final icon = AnimatedBuilder(
            animation: _c,
            builder: (context, child) {
              // 1 → 1.25 → 1: birinchi yarmida kattayadi, keyin
              // spring bilan qaytadi.
              final t = _c.value;
              final scale = t == 0
                  ? 1.0
                  : 1 + .25 * (t < .5 ? t * 2 : (1 - t) * 2);
              return Transform.scale(scale: scale, child: child);
            },
      child: NIcon(
        Ico.heart,
        size: widget.size,
        color: tint,
        filled: widget.liked,
        onMedia: widget.onMedia,
      ),
    );

    final label = Text(
      '${widget.count}',
      style: T.meta.copyWith(
        color: tint,
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
        shadows: widget.onMedia ? C.mediaText : null,
      ),
    );

    return Press(
      onTap: widget.onTap,
      haptic: true,
      minSize: S.tap,
      scale: .9,
      child: widget.vertical
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [icon, const SizedBox(height: 5), label],
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [icon, const SizedBox(width: 7), label],
            ),
    );
  }
}
