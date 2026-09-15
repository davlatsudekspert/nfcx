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
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/story_ring.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../../state/seen_stories.dart';
import '../content/compose.dart';
import '../content/post_detail.dart';
import '../content/report_sheet.dart';
import '../content/story_viewer.dart';
import '../identity/profile_screen.dart';
import '../identity/switcher.dart';
import '../nfc/gift_offers.dart';
import '../nfc/id_catalog.dart';
import '../nfc/nfc_scan.dart';
import '../nfc/order_card.dart';
import '../nfc/qr_share.dart';
import '../orders/my_orders.dart';

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

      if (!mounted) return;
      setState(() {
        _feed = feed.items;
        _stories = stories;
        _pending = pending;
        _gifts = gifts;
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
              SliverToBoxAdapter(child: _Header(identity: active)),

              // SALOMLASHUV.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Eyebrow(
                        [
                          if ((active?.record?.city ?? '').isNotEmpty)
                            active!.record!.city,
                          monthDay(DateTime.now()),
                        ].join(' · '),
                      ),
                      const SizedBox(height: 6),
                      _Greeting(name: firstName),
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

              // OGOHLANTIRISHLAR — kutilayotgan to'lov va sovg'a.
              if (_pending.isNotEmpty || _gifts > 0)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      S.gutter,
                      S.x16,
                      S.gutter,
                      0,
                    ),
                    child: Column(
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
                            onAction: () => push<void>(
                              context,
                              (_) => const MyOrdersScreen(),
                            ),
                          ),
                        if (_pending.isNotEmpty && _gifts > 0)
                          const SizedBox(height: S.x8),
                        if (_gifts > 0)
                          _Notice(
                            icon: Ico.gift,
                            tone: StatusTone.accent,
                            title: tr('Sizga ID sovg‘a qilindi'),
                            message: tr(
                              'Qabul qilmaguningizcha ID sizga o‘tmaydi.',
                            ),
                            actionLabel: tr('Ko‘rish'),
                            onAction: () async {
                              await push<void>(
                                context,
                                (_) => const GiftOffersScreen(),
                              );
                              if (mounted) await _load(force: true);
                            },
                          ),
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
  const _Header({this.identity});

  final Identity? identity;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, 0),
        child: Row(
          children: [
            const BrandMark(size: 42),
            const SizedBox(width: S.x12),
            const Wordmark(),
            const Spacer(),
            // SHAXS ALMASHTIRGICH — bir nechta ID egasi uchun eng
            // tez yo'l. Bitta ID bo'lsa ham bosiladi: ichida
            // "ID qo'shish" turadi.
            Press(
              onTap: () => showIdentitySwitcher(context),
              minSize: S.tap,
              scale: .92,
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: C.accent.withValues(alpha: .45),
                    width: 1.2,
                  ),
                ),
                child: Avatar(
                  url: identity?.avatarUrl,
                  name: identity?.name ?? '',
                  size: 36,
                ),
              ),
            ),
          ],
        ),
      );
}

/// "Assalom, *Dilshod*" — kursiv urg'u so'zi oltin rangda.
class _Greeting extends StatelessWidget {
  const _Greeting({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    if (name.isEmpty) {
      return Text(tr('Assalom'), style: T.title);
    }
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '${tr('Assalom')}, ', style: T.title),
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
            icon: Ico.card,
            label: tr('Karta'),
            onTap: () => push<void>(
              context,
              (_) => record != null
                  ? OrderCardScreen(record: record)
                  : const IdCatalogScreen(),
            ),
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
          height: 76,
          padding: const EdgeInsets.symmetric(horizontal: S.x8),
          decoration: BoxDecoration(
            gradient: C.raisedSurface,
            borderRadius: BorderRadius.circular(R.tile),
            border: Border.all(color: C.line),
            boxShadow: C.e1,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              NIcon(icon, size: 21, color: onTap == null ? C.ink3 : C.accent),
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
    required this.onAuthor,
    required this.onOpen,
    this.onMenu,
  });

  final FeedEntry item;
  final VoidCallback onLike;
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
  });

  final bool liked;
  final int count;
  final VoidCallback onTap;
  final double size;
  final Color? color;

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
    return Press(
      onTap: widget.onTap,
      haptic: true,
      minSize: S.tap,
      scale: .9,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
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
            ),
          ),
          const SizedBox(width: 7),
          Text(
            '${widget.count}',
            style: T.meta.copyWith(
              color: tint,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
