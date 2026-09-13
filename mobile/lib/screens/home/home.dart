import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/story_ring.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../content/compose.dart';
import '../content/story_viewer.dart';
import '../identity/id_chip.dart';
import '../identity/profile_screen.dart';
import '../nfc/gift_offers.dart';
import '../nfc/qr_share.dart';
import '../orders/my_orders.dart';
import '../settings/settings_screen.dart';

/// HOME — "menga o'z shaxsimni ko'rsat".
///
/// Ketma-ketlik handoff bo'yicha: faol ID kartasi, tezkor amallar,
/// story qatori, tasdiqlash eslatmasi (agar kerak bo'lsa), tavsiyalar.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Record>? _catalog;
  Map<String, dynamic>? _analytics;
  List<Order> _pending = const [];
  List<StoryFeedEntry> _feed = const [];
  int _gifts = 0;
  Object? _error;
  bool _loading = true;
  String? _loadedFor;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Shaxs almashsa ma'lumot qayta yuklanadi: Home faol shaxs
    // kontekstida ko'rsatiladi.
    final code = AppScope.of(context).active?.code;
    if (code != _loadedFor) {
      _loadedFor = code;
      _load();
    }
  }

  /// `force` — "tortib yangilash". Keshni chetlab o'tadi; oddiy
  /// ochilishda esa kesh ishlatiladi va so'rov takrorlanmaydi.
  /// O'z istoryasini qo'shish.
  ///
  /// "Siz" dumaloqchasi ilgari ISTORYA KO'RUVCHINI ochardi — istorya
  /// bo'lmasa esa bo'sh ekran chiqardi. Halqadagi "+" belgisi esa
  /// qo'shishni va'da qiladi.
  Future<void> _compose(String code) async {
    final done = await push<bool>(
      context,
      (_) => ComposeScreen(code: code, kind: ComposeKind.story),
    );
    if (done == true && mounted) await _load(force: true);
  }

  Future<void> _load({bool force = false}) async {
    final state = AppScope.read(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final catalog = await state.repo.catalog(force: force);
      // TUGALLANMAGAN TO'LOV — vaqtga bog'liq: kod 24 soat band
      // bo'lib turadi va shu muddatda to'lanmasa bekor qilinadi.
      // Shuning uchun u Home'da ko'rinadi, sozlamalar ichida
      // ko'milib qolmaydi.
      List<Order> pending = const [];
      try {
        pending = (await state.repo.orders()).where((o) => o.isPending).toList();
      } catch (_) {}
      // STORY LENTASI — obuna bo'lingan odamlarniki. Xatosi butun
      // bosh ekranni yiqitmaydi (repo ichida yutiladi).
      final feed = await state.repo.storyFeed();
      // KUTILAYOTGAN SOVG'A — tasdiqlanmasa ID o'tmaydi, ya'ni odam
      // o'ziga sovg'a qilingan ID borligini umuman bilmay qoladi.
      var gifts = 0;
      try {
        gifts = (await state.repo.giftOffers()).incoming.length;
      } catch (_) {}
      Map<String, dynamic>? analytics;
      final active = state.active;
      if (active != null && !active.isBusiness) {
        // Statistika ixtiyoriy: tarif past bo'lsa server rad etishi
        // mumkin va bu butun Home'ni yiqitmasligi kerak.
        try {
          analytics = await state.repo.analytics(active.code);
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _catalog = catalog;
        _analytics = analytics;
        _pending = pending;
        _feed = feed;
        _gifts = gifts;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final active = state.active;

    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: () => _load(force: true),
        color: C.champagne,
        backgroundColor: C.slate,
        displacement: 28,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _Header(name: state.user?.email ?? '', active: active)),
            if (active == null)
              SliverToBoxAdapter(
                child: EmptyState(
                  'Hali NFC ID‘ingiz yo‘q. NFC bo‘limidan o‘zingizga ID tanlang.',
                ),
              )
            else
              SliverToBoxAdapter(child: _ActiveCard(active: active, analytics: _analytics)),
            if (active != null) SliverToBoxAdapter(child: _QuickActions(active: active)),
            if (_pending.isNotEmpty)
              SliverToBoxAdapter(child: _PendingBanner(count: _pending.length)),
            if (_gifts > 0)
              SliverToBoxAdapter(child: _GiftBanner(count: _gifts, onDone: _load)),
            SliverToBoxAdapter(
              child: _Stories(
                feed: _feed,
                own: state.cards,
                onAdd: () => _compose(state.cards.first.code),
              ),
            ),
            if (active != null && !active.verified)
              const SliverToBoxAdapter(child: _VerifyPrompt()),
            SliverToBoxAdapter(
              child: _Recommended(
                loading: _loading,
                error: _error,
                items: _catalog,
                onRetry: _load,
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: S.x32)),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.name, required this.active});
  final String name;
  final Identity? active;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, S.x20),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Assalomu alaykum', style: T.caption.copyWith(color: C.ash)),
                  const SizedBox(height: 3),
                  Text(
                    active?.name.isNotEmpty == true ? active!.name : name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T.profileName.copyWith(fontSize: 19),
                  ),
                ],
              ),
            ),
            const SizedBox(width: S.x12),
            const IdChip(),
          ],
        ),
      );
}

class _ActiveCard extends StatelessWidget {
  const _ActiveCard({required this.active, required this.analytics});
  final Identity active;
  final Map<String, dynamic>? analytics;

  @override
  Widget build(BuildContext context) {
    final taps = analytics == null ? null : (analytics!['profileViews'] ?? analytics!['views']);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: S.gutter),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Eyebrow('Faol ID'),
          const SizedBox(height: S.x8),
          IdentityCard(
            code: active.code,
            holder: active.name,
            subtitle: active.isBusiness ? 'Biznes' : 'Shaxsiy',
            taps: taps is num ? taps.round() : null,
            tier: active.isBusiness ? Tier.gold : (active.record?.tier ?? Tier.free),
            active: true,
            dense: true,
            onTap: () => push(context, (_) => ProfileScreen(identity: active)),
          ),
        ],
      ),
    );
  }
}

/// Tezkor amallar — ikkitasi ENG MUHIMI (QR va Ulashish) birinchi.
class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.active});
  final Identity active;

  @override
  Widget build(BuildContext context) {
    final items = <({Ico icon, String label, VoidCallback onTap})>[
      (
        icon: Ico.qr,
        label: 'QR',
        onTap: () => push(context, (_) => QrShareScreen(identity: active)),
      ),
      (
        icon: Ico.share,
        label: 'Ulashish',
        onTap: () => shareIdentity(active),
      ),
      (
        icon: Ico.user,
        label: 'Profil',
        onTap: () => push(context, (_) => ProfileScreen(identity: active)),
      ),
      (
        icon: Ico.settings,
        label: 'Sozlamalar',
        onTap: () => push(context, (_) => const SettingsScreen()),
      ),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, S.x24),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: S.x8),
            Expanded(
              child: Press(
                onTap: items[i].onTap,
                child: Surface(
                  padding: const EdgeInsets.symmetric(vertical: S.x12),
                  shadow: E.e1,
                  child: Column(
                    children: [
                      NIcon(items[i].icon, size: 21, color: C.champagne),
                      const SizedBox(height: 7),
                      Text(items[i].label,
                          style: T.caption.copyWith(fontSize: 10.5, color: C.ash)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// STORY QATORI.
///
/// MUHIM TUZATISH (audit): bu yerda ilgari FOYDALANUVCHINING O'Z
/// ID'lari ko'rsatilardi. Ya'ni har bir dumaloqcha "yangi kontent
/// bor" degandek tilla halqa bilan yonardi, lekin ortida hech narsa
/// yo'q edi — bu soxta lenta. Endi qator SERVER bergan haqiqiy
/// lentadan quriladi (`GET /api/stories/feed`): obuna bo'lingan
/// odamlarning muddati o'tmagan istoryalari.
///
/// Birinchi dumaloqcha — "Siz": o'z istoryangizni ko'rish yoki
/// qo'shish. U har doim turadi, chunki bu AMAL, lenta emas.
///
/// Lenta bo'sh bo'lsa qator umuman ko'rsatilmaydi: bo'sh tilla
/// halqalar qatori ekranni to'ldiradi, lekin hech narsa aytmaydi.
class _Stories extends StatelessWidget {
  const _Stories({required this.feed, required this.own, required this.onAdd});

  final List<StoryFeedEntry> feed;
  final List<Record> own;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    if (own.isEmpty && feed.isEmpty) return const SizedBox.shrink();
    final mine = own.isEmpty ? null : own.first;

    return SizedBox(
      height: 94,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        itemCount: (mine == null ? 0 : 1) + feed.length,
        separatorBuilder: (_, __) => const SizedBox(width: S.x12),
        itemBuilder: (context, i) {
          if (mine != null && i == 0) {
            return StoryRing(
              name: 'Siz',
              avatarUrl: mine.avatarUrl,
              addButton: true,
              onTap: onAdd,
            );
          }
          final e = feed[i - (mine == null ? 0 : 1)];
          return StoryRing(
            name: e.name.isEmpty ? e.code : e.name,
            avatarUrl: e.avatarUrl,
            onTap: () => push(context, (_) => StoryViewerScreen(code: e.code)),
          );
        },
      ),
    );
  }
}

/// SIZGA SOVG'A QILINGAN ID eslatmasi.
///
/// Sovg'a taklifi tasdiqlanmaguncha ID o'tmaydi. Eslatma bo'lmasa
/// odam o'ziga ID sovg'a qilinganini umuman bilmay qoladi.
class _GiftBanner extends StatelessWidget {
  const _GiftBanner({required this.count, required this.onDone});
  final int count;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, 0),
        child: Press(
          haptic: true,
          onTap: () async {
            await push(context, (_) => const GiftOffersScreen());
            onDone();
          },
          child: Surface(
            padding: const EdgeInsets.all(S.x16),
            border: C.champagne.withValues(alpha: .35),
            shadow: E.e1,
            child: Row(
              children: [
                const NIcon(Ico.gift, size: 20, color: C.champagne),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        count == 1
                            ? 'Sizga ID sovg‘a qilindi'
                            : 'Sizga $count ta ID sovg‘a qilindi',
                        style: T.cardTitle,
                      ),
                      const SizedBox(height: 2),
                      Text('Qabul qilmaguningizcha ID sizga o‘tmaydi',
                          style: T.caption),
                    ],
                  ),
                ),
                const NIcon(Ico.chevronRight, size: 18, color: C.muted),
              ],
            ),
          ),
        ),
      );
}

/// TUGALLANMAGAN TO'LOV eslatmasi.
///
/// Bu shunchaki ma'lumot emas: to'lov tugallanmasa kod bekor qilinadi
/// va boshqa odam uni olib ketishi mumkin. Shuning uchun uslub
/// diqqatni tortadi (champagne chegara), lekin qizil emas — bu xato
/// emas, tugallanmagan ish.
class _PendingBanner extends StatelessWidget {
  const _PendingBanner({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x20),
        child: Press(
          haptic: true,
          onTap: () => push(context, (_) => const MyOrdersScreen()),
          child: Surface(
            border: C.champagne.withValues(alpha: .38),
            child: Row(
              children: [
                const NIcon(Ico.clock, size: 21, color: C.champagne),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        count == 1
                            ? 'To‘lov tugallanmagan'
                            : '$count ta to‘lov tugallanmagan',
                        style: T.cardTitle,
                      ),
                      const SizedBox(height: 3),
                      const Text(
                        'Band qilish muddati tugasa ID qaytadan sotuvga chiqadi',
                        style: T.caption,
                      ),
                    ],
                  ),
                ),
                const NIcon(Ico.chevronRight, size: 18, color: C.champagne),
              ],
            ),
          ),
        ),
      );
}

/// Profil tasdiqlash eslatmasi — faqat tasdiqlanmagan shaxsda.
///
/// Nishonning o'zi HECH QACHON bu yerda berilmaydi: holat serverdan
/// keladi, bu shunchaki Telegram oqimiga yo'l ko'rsatuvchi kartochka.
class _VerifyPrompt extends StatelessWidget {
  const _VerifyPrompt();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x24, S.gutter, 0),
        child: Press(
          onTap: () => push(context, (_) => const SettingsScreen()),
          child: Surface(
            child: Row(
              children: [
                const NIcon(Ico.telegram, size: 22, color: C.telegram),
                const SizedBox(width: S.x12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Profilni tasdiqlang', style: T.cardTitle),
                      SizedBox(height: 3),
                      Text('Telegram bot orqali tasdiqlang va nishonga ega bo‘ling',
                          style: T.caption),
                    ],
                  ),
                ),
                const NIcon(Ico.chevronRight, size: 18, color: C.muted),
              ],
            ),
          ),
        ),
      );
}

/// Tavsiya — katalogdagi eng ko'p ko'rilgan profillar.
///
/// "TOP foydalanuvchilar" maketdagi raqamlar o'rniga HAQIQIY
/// ko'rishlar soni bo'yicha tartiblangan ro'yxat.
class _Recommended extends StatelessWidget {
  const _Recommended({
    required this.loading,
    required this.error,
    required this.items,
    required this.onRetry,
  });

  final bool loading;
  final Object? error;
  final List<Record>? items;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: S.x32),
        const SectionHeader('Mashhur profillar'),
        AsyncView<List<Record>>(
          loading: loading,
          error: error,
          data: items,
          onRetry: onRetry,
          isEmpty: (d) => d.isEmpty,
          emptyMessage: 'Katalog hozircha bo‘sh.',
          skeleton: const Padding(
            padding: EdgeInsets.symmetric(horizontal: S.gutter),
            child: Column(children: [SkeletonRow(), SkeletonRow(), SkeletonRow()]),
          ),
          builder: (data) {
            final top = [...data]..sort((a, b) => b.views.compareTo(a.views));
            final list = top.take(6).toList();
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: S.gutter),
              child: Column(
                children: [
                  for (var i = 0; i < list.length; i++) ...[
                    if (i > 0) const SizedBox(height: S.x8),
                    _TopRow(record: list[i], rank: i + 1),
                  ],
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _TopRow extends StatelessWidget {
  const _TopRow({required this.record, required this.rank});
  final Record record;
  final int rank;

  @override
  Widget build(BuildContext context) => Press(
        onTap: () => push(context, (_) => ProfileScreen(code: record.code)),
        child: Surface(
          padding: const EdgeInsets.all(S.x12),
          shadow: E.e1,
          child: Row(
            children: [
              SizedBox(
                width: 18,
                child: Text('$rank', style: T.meta.copyWith(color: C.muted)),
              ),
              Avatar(url: record.avatarUrl, name: record.name, size: 40),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(record.name.isEmpty ? record.code : record.name,
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: T.cardTitle),
                        ),
                        if (record.verified) ...[
                          const SizedBox(width: 5),
                          const VerifiedBadge(size: 13),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        if (record.role.isNotEmpty) record.role,
                        if (record.city.isNotEmpty) record.city,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.caption.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: S.x8),
              Text(compact(record.views), style: T.meta.copyWith(color: C.ash)),
            ],
          ),
        ),
      );
}
