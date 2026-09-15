import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/logo.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/story_ring.dart';
import '../business/business_stats.dart';
import '../business/edit_catalog.dart';
import '../business/product_detail.dart';
import '../orders/owner_orders.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/refresh.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/dates.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../../state/seen_stories.dart';
import '../content/compose.dart';
import '../content/story_viewer.dart';
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
  List<Order> _pending = const [];

  /// Egasining FAOL istoryasi bormi.
  ///
  /// Sarlavhadagi halqa shunga qarab aylanadi: bor bo'lsa oltin va
  /// harakatda, yo'q bo'lsa so'ngan. Bu ilovadagi umumiy qoida —
  /// halqa bezak emas, holat.
  bool _ownStory = false;
  int _gifts = 0;

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
    });
    try {
      if (force) state.repo.invalidateCatalog();

      // HAMMASI IXTIYORIY. Ularning har biri o'z sababi bilan
      // yiqilishi mumkin (tarif, ruxsat, tarmoq) va bu butun Bosh
      // sahifani bo'sh qoldirmasligi kerak.
      //
      // Lenta so'rovi ham OLIB TASHLANDI: boshqalarning postlari
      // endi Reels tabida ko'rsatiladi, ya'ni Bosh sahifa ochilishi
      // uchun bitta so'rov kam — ekran tezroq chiqadi.
      List<StoryFeedEntry> stories = const [];
      try {
        stories = await state.repo.storyFeed();
      } catch (_) {}

      // EGASINING O'Z ISTORYASI — sarlavhadagi halqa uchun.
      var ownStory = false;
      final me = state.active;
      if (me != null) {
        try {
          final mine = me.isBusiness
              ? await state.repo.companyStories(me.code)
              : await state.repo.recordStories(me.code);
          ownStory = mine.isNotEmpty;
        } catch (_) {}
      }

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
        _stories = stories;
        _ownStory = ownStory;
        _pending = pending;
        _gifts = gifts;
        _loading = false;
        _loadedAt = DateTime.now();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
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
          // Belgi ro'yxatni uzoq ushlab turmasin — sababi va
          // o'lchovi `design/refresh.dart` da.
          onRefresh: () => pullRefresh(() => _load(force: true)),
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _Header(
                  identity: active,
                  hasStory: _ownStory,
                  onTap: () => showIdentitySwitcher(context),
                ),
              ),

              // SALOMLASHUV.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, 0),
                  // MARKAZGA — avatar o'rtada bo'lgach, chapga
                  // tekislangan matn undan "qochib" ketardi va
                  // ekran muvozanatini buzardi.
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
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

              // BIZNES XIZMATLARI — BIZNES TANLANGANDA.
              //
              // Egasi: "shu yerda tanlansa biznes profili, u
              // ochilib bo'limlari, menyu, xizmatlari bo'lsa".
              //
              // Ya'ni avatarni bosib biznesga o'tgach, Bosh sahifa
              // ham BIZNESNIKI bo'lishi kerak — shaxsiy profildagi
              // bilan bir xil qolmasligi kerak. Endi shunday:
              // biznes tanlansa bu qator chiqadi va uning
              // bo'limlariga bevosita olib boradi.
              if (active != null && active.isBusiness)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      S.gutter,
                      S.x12,
                      S.gutter,
                      0,
                    ),
                    child: _BusinessRow(identity: active),
                  ),
                ),

              // XIZMATLAR VA MAHSULOTLAR — BIZNES TANLANGANDA.
              //
              // Egasi: "bu yerda mahsulot yo xizmatlari ko'rinishi
              // kerak emasmi". To'g'ri: biznes tanlangan bo'lsa
              // Bosh sahifaning eng muhim mazmuni — o'sha
              // biznesning taklifi. Ilgari u yer bo'sh qolardi va
              // mahsulotlarni ko'rish uchun profilga kirib,
              // katalogni ochish kerak edi.
              //
              // Gorizontal qator ATAYLAB: Bosh sahifa ro'yxat emas,
              // boshqaruv paneli — mahsulotlar bu yerda ko'rinadi,
              // to'liq ro'yxat esa katalogda.
              if (active != null &&
                  active.isBusiness &&
                  (active.company?.items.isNotEmpty ?? false)) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      S.gutter,
                      S.x24,
                      S.gutter,
                      S.x12,
                    ),
                    child: SectionHeader(
                      tr('Xizmatlar'),
                      actionLabel: tr('Katalog'),
                      onAction: () => push<void>(
                        context,
                        (_) => EditCatalogScreen(company: active.company!),
                      ),
                      trailing: Text(
                        som(active.company!.items.length),
                        style: T.meta,
                      ),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 186,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(
                        horizontal: S.gutter,
                      ),
                      itemCount: active.company!.items.length,
                      separatorBuilder: (_, __) => const SizedBox(width: S.x12),
                      itemBuilder: (context, i) => SizedBox(
                        width: 150,
                        child: ProductCard(
                          product: active.company!.items[i],
                          companyId: active.code,
                          companyName: active.name,
                        ),
                      ),
                    ),
                  ),
                ),
              ],

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

              // BOSHQALARNING POSTLARI BU YERDA EMAS.
              //
              // Egasi: "nega kerak bosh sahifaga boshqalarning
              // postlari, unga alohida Reels bor-ku". To'g'ri
              // e'tiroz: bir xil kontent ikki joyda ko'rsatilardi
              // va Bosh sahifa Reels'ning qisqartirilgan nusxasiga
              // aylanib qolgandi.
              //
              // Endi Bosh sahifa — EGASINING joyi: o'z kartasi, tez
              // amallar, kutilayotgan to'lov va sovg'a, obuna
              // bo'lganlarning istoryalari. Boshqalarning postlari
              // esa Reels tabida, o'z ekranida, to'liq kattalikda.
              //
              // Yoqtirish, menyu va o'chirish mantig'i ham shu
              // bilan birga olib tashlandi — Reels o'zinikini
              // ishlatadi. O'lik kod qoldirilmadi.
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
  const _Header({this.identity, this.hasStory = false, this.onTap});

  final Identity? identity;

  /// Egasining FAOL istoryasi bormi — halqa shunga qarab aylanadi.
  final bool hasStory;

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, 0),
        child: Column(
          children: [
            // BRAND — endi yolg'iz, o'rtada.
            //
            // Ilgari bu qatorda IKKI CHETDA ikkita dumaloq turardi:
            // chapda brend belgisi, o'ngda kichkina avatar. Egasi:
            // "ikki tomonda tepada dumaloq bo'p qolyapti, avatar
            // o'rtada bo'lsin, chiroyli". Haq edi — ikkita teng
            // og'irlikdagi dumaloq bir-biri bilan raqobatlashardi
            // va ko'z hech qaysisida to'xtamasdi.
            // BREND — FAQAT YOZUV, medalyonsiz.
            //
            // Avval bu yerda brend medalyoni ham turardi. Lekin
            // pastda endi katta avatar bor va ikkita doira yana
            // bir-biri bilan raqobatlashardi — egasi aynan shundan
            // shikoyat qilgan edi. Yozuvning o'zi brendni
            // ko'rsatishga yetarli, yagona doira esa avatar
            // bo'lib qoladi va ko'z to'g'ri joyda to'xtaydi.
            const Wordmark(),

            const SizedBox(height: S.x20),

            // AVATAR — EKRANNING MARKAZI.
            //
            // Katta, o'rtada va atrofida istorya halqasi. Halqa
            // ma'no tashiydi: egasining faol istoryasi bo'lsa oltin
            // va AYLANADI, bo'lmasa so'ngan. Bu qoida butun ilovada
            // bir xil (`StoryRing`), shuning uchun bu yerda qayta
            // chizilmadi.
            //
            // Bosilsa shaxs tanlanadi: bir nechta ID va biznes
            // profil egasi uchun eng tez yo'l shu.
            StoryRing(
              avatarUrl: identity?.avatarUrl,
              name: identity?.name ?? '',
              size: 104,
              seen: !hasStory,
              showLabel: false,
              onTap: onTap,
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
      return Text(
        tr('Assalomu alaykum'),
        style: T.title,
        textAlign: TextAlign.center,
      );
    }
    // Avatar markazda bo'lgani uchun matn ham markazda —
    // aks holda ekran bir tomonga og'ib ko'rinardi.
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '${tr('Assalomu alaykum')}, ', style: T.title),
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
      textAlign: TextAlign.center,
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

/// BIZNES XIZMATLARI — Bosh sahifadagi ixcham qator.
///
/// Profil tabidagi to'liq ro'yxatning QISQARTIRILGANI: bu yerda
/// eng ko'p kerak bo'ladigan uchtasi. To'liq ro'yxat va sozlamalar
/// Profil tabida qoladi — ikkalasini bir xil qilsak, Bosh sahifa
/// yana uzayib ketardi.
class _BusinessRow extends StatelessWidget {
  const _BusinessRow({required this.identity});

  final Identity identity;

  @override
  Widget build(BuildContext context) {
    final c = identity.company;
    if (c == null) return const SizedBox.shrink();

    Widget tile(String label, Ico icon, VoidCallback onTap) => Expanded(
          child: Surface(
            padding: const EdgeInsets.symmetric(
              horizontal: S.x8,
              vertical: S.x12,
            ),
            onTap: onTap,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                NIcon(icon, size: 19, color: C.accent),
                const SizedBox(height: 7),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.buttonSm.copyWith(color: C.ink2),
                ),
              ],
            ),
          ),
        );

    return Row(
      children: [
        tile(
          tr('Katalog'),
          Ico.bag,
          () => push<void>(context, (_) => EditCatalogScreen(company: c)),
        ),
        const SizedBox(width: S.x8),
        tile(
          tr('Buyurtmalar'),
          Ico.doc,
          () => push<void>(
            context,
            (_) => OwnerOrdersScreen(
              companyId: identity.code,
              companyName: identity.name,
            ),
          ),
        ),
        const SizedBox(width: S.x8),
        tile(
          tr('Statistika'),
          Ico.chart,
          () => push<void>(
            context,
            (_) => BusinessStatsScreen(companyId: identity.code),
          ),
        ),
      ],
    );
  }
}

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
