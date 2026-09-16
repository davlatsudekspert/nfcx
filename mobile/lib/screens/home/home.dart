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
import '../../design/components/story_ring.dart';
import '../shell.dart';
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
import '../content/report_sheet.dart';
import '../identity/profile_screen.dart';
import '../identity/switcher.dart';
import '../nfc/gift_id.dart';
import '../nfc/gift_offers.dart';
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

  /// Egasining FAOL istoryasi bormi.
  ///
  /// Sarlavhadagi halqa shunga qarab aylanadi: bor bo'lsa oltin va
  /// harakatda, yo'q bo'lsa so'ngan. Bu ilovadagi umumiy qoida —
  /// halqa bezak emas, holat.
  bool _ownStory = false;
  int _gifts = 0;

  /// BIZNESNING MAHSULOTLARI — ALOHIDA SO'ROV BILAN.
  ///
  /// HAQIQIY XATO: `/api/companies/mine` (shaxslar ro'yxati)
  /// kompaniyani katalogisiz qaytaradi — katalog faqat
  /// `/api/companies/:id` da bo'ladi. Ya'ni `active.company.items`
  /// HAR DOIM bo'sh edi va "Xizmatlar" qatori hech qachon
  /// ko'rinmasdi, garchi kompaniyada mahsulot bo'lsa ham. Egasi
  /// buni "bu yerda mahsulot yo xizmatlari ko'rinishi kerak
  /// emasmi" deb ikki marta aytdi.
  List<Product> _items = const [];

  /// LENTA — obuna bo'lingan profillarning postlari.
  ///
  /// PROTOTIPDA BOSH SAHIFANING PASTKI YARMI SHU. Ilgari bu yer
  /// bo'sh edi: karta va tezkor amallardan keyin ekran tugardi va
  /// qaytib kelish uchun sabab qolmasdi. Lenta — ilovani har kuni
  /// ochadigan yagona narsa.
  List<FeedItem> _feed = const [];

  /// HAFTANING KOMPANIYASI — lentadan oldingi katta karta.
  ///
  /// Tasdiqlangan kompaniyalardan birinchisi. Kun bo'yi
  /// o'zgarmasligi uchun sana bo'yicha tanlanadi: bir kunda bitta
  /// kompaniya ko'rinadi va u tasodifan sakramaydi.
  Company? _featured;

  /// SALOMLASHUV OSTIDAGI QATOR — profil ko'rishlari.
  ///
  /// Prototipda bu yerda "bugun N kishi kartangizga tegdi" degan
  /// jumla turibdi. Serverda KUNLIK tegishlar soni yo'q: faqat
  /// profilning umumiy ko'rishlari bor (`Record.views`). Shuning
  /// uchun raqam to'qilmadi — jumla borga moslandi. Nol bo'lsa
  /// qator umuman chiqmaydi.
  int _taps = 0;

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


      // KUTILAYOTGAN SOVG'A — tasdiqlanmasa ID o'tmaydi, ya'ni odam
      // o'ziga sovg'a qilingan ID borligini bilmay qoladi.
      var gifts = 0;
      try {
        gifts = (await state.repo.giftOffers()).incoming.length;
      } catch (_) {}

      // LENTA — prototipdagi Bosh sahifaning pastki yarmi.
      //
      // Birinchi sahifa yetarli: qolganini odam pastga surganda
      // emas, Lentaning o'z ekranida ko'radi. Bosh sahifa —
      // boshlanish nuqtasi, cheksiz ro'yxat emas.
      List<FeedItem> feed = const [];
      try {
        feed = await state.repo.feed(limit: 6);
      } catch (_) {}

      // HAFTANING KOMPANIYASI.
      //
      // Tasodifiy emas, SANA bo'yicha: bir kun ichida bitta
      // kompaniya ko'rinadi. Tasodifiy bo'lsa har yangilashda
      // boshqa kompaniya chiqardi va ro'yxat "sakrab" turardi.
      Company? featured;
      try {
        final all = (await state.repo.companies())
            .where((c) => (c.coverUrl ?? '').isNotEmpty || (c.logoUrl ?? '').isNotEmpty)
            .toList();
        if (all.isNotEmpty) {
          final day = DateTime.now();
          final n = day.year * 1000 + day.month * 40 + day.day;
          featured = all[n % all.length];
        }
      } catch (_) {}

      // BIZNES KATALOGI — faqat biznes tanlangan bo'lsa.
      List<Product> items = const [];
      if (me != null && me.isBusiness) {
        try {
          items = await state.repo.companyCatalog(me.code);
        } catch (_) {}
      }

      if (!mounted) return;
      setState(() {
        _stories = stories;
        _taps = me?.record?.views ?? 0;
        _feed = feed;
        _featured = featured;
        _ownStory = ownStory;
        _items = items;
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

  /// Lenta muallifining profilini ochish.
  void _openFeedAuthor(FeedItem it) => push<void>(
        context,
        (_) => it.isCompany
            ? ProfileScreen(companyId: it.code)
            : ProfileScreen(code: it.code),
      );

  /// YURAK — DARHOL, SO'NG SERVER.
  ///
  /// Tugma bosilishi bilan holat o'zgaradi: tarmoqni kutish
  /// "ishlamadi" degan taassurot qoldiradi. Server javobi kelgach
  /// haqiqiy son ustiga yoziladi; xato bo'lsa holat qaytariladi.
  Future<void> _likeFeed(int i) async {
    final before = _feed[i];
    setState(() {
      _feed = [..._feed]..[i] = before.copyWith(
          liked: !before.liked,
          likes: before.likes + (before.liked ? -1 : 1),
        );
    });
    try {
      final r = await AppScope.read(context).repo.likePost(before.id);
      if (!mounted) return;
      setState(() {
        _feed = [..._feed]..[i] =
            _feed[i].copyWith(liked: r.liked, likes: r.count);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _feed = [..._feed]..[i] = before);
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
                  onSearch: () => Shell.goTab(context, 1),
                  onBell: _gifts > 0
                      ? () => push<void>(context, (_) => const GiftOffersScreen())
                      : null,
                  badge: _gifts,
                ),
              ),

              // SALOMLASHUV.
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, S.x16, S.gutter, 0),
                  // CHAPGA — PROTOTIPDAGIDEK.
                  //
                  // Markazlashtirish katta avatar ostida mantiqli
                  // edi. Avatar olingach, markazdagi matn ekranni
                  // "afisha" qilib qo'yadi: o'qish chapdan
                  // boshlanadi va sarlavha ham shu yerdan
                  // boshlanishi kerak.
                  // PROTOTIPDA: "Salom, <ism>" va ostida BITTA
                  // jonli qator. Shahar va sana olib tashlandi —
                  // ular hech qanday qaror qabul qilishga yordam
                  // bermaydi, faqat joy egallaydi. O'rniga odam
                  // uchun qimmatli yagona raqam: kartasiga necha
                  // marta tegishgani.
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Greeting(name: firstName),
                      if (_taps > 0) ...[
                        const SizedBox(height: 6),
                        Text(
                          trf('Profilingiz {n} marta ko‘rildi', {'n': som(_taps)}),
                          style: T.body.copyWith(fontSize: 13.5),
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
                    ownAvatarUrl: active?.avatarUrl,
                    ownHasStory: _ownStory,
                    onOwnLongPress: () => showIdentitySwitcher(context),
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
                    child: _ActiveCard(
                      identity: active,
                      onTap: () => showIdentitySwitcher(context),
                    ),
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
                  _items.isNotEmpty) ...[
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
                        som(_items.length),
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
                      itemCount: _items.length,
                      separatorBuilder: (_, __) => const SizedBox(width: S.x12),
                      itemBuilder: (context, i) => SizedBox(
                        width: 150,
                        child: ProductCard(
                          product: _items[i],
                          companyId: active.code,
                          companyName: active.name,
                        ),
                      ),
                    ),
                  ),
                ),
              ],

              // OGOHLANTIRISHLAR BOSH SAHIFADA EMAS.
              //
              // Prototipda Bosh sahifa: sarlavha → story → karta →
              // tezkor amallar → kompaniya → lenta. Boshqa hech
              // narsa yo'q, va bu ataylab: har qo'shilgan karta
              // ekranni "boshqaruv paneli" tomonga suradi.
              //
              // Ma'lumot YO'QOLMADI. Tugallanmagan to'lov —
              // "Buyurtmalarim" da (u yerda holat va muddat ham
              // bor), kelgan sovg'a esa tepadagi qo'ng'iroq
              // belgisida sanoq bilan turibdi va bosilsa sovg'a
              // takliflarini ochadi.

              // ── HAFTANING KOMPANIYASI ────────────────────
              //
              // PROTOTIPDA BOSH SAHIFA SHU YERDAN BURILADI: tepasi
              // egasi haqida, pastki yarmi boshqalar haqida. Katta
              // rasm bu burilishni ko'z bilan ko'rsatadi va ekran
              // "shaxsiy kabinet" bo'lib qolmaydi.
              if (_featured != null) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      S.gutter,
                      S.x24,
                      S.gutter,
                      S.x12,
                    ),
                    child: SectionHeader(
                      tr('Haftaning kompaniyasi'),
                      actionLabel: tr('Hammasi'),
                      onAction: () => Shell.goTab(context, 1),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    child: _FeaturedCompany(
                      company: _featured!,
                      onTap: () => push<void>(
                        context,
                        (_) => ProfileScreen(companyId: _featured!.id),
                      ),
                    ),
                  ),
                ),
              ],

              // ── LENTA ────────────────────────────────────
              //
              // Obuna bo'lingan profillarning postlari. Egasi
              // ilgari "nega kerak bosh sahifaga boshqalarning
              // postlari" degan edi va lenta olib tashlangandi —
              // lekin o'shanda u REELS nusxasi edi. Prototipda esa
              // lenta boshqa narsa: to'liq ekran video emas, rasmli
              // KARTA, izohi va yuragi bilan. Ikkisi bir-birini
              // takrorlamaydi.
              if (_feed.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      S.gutter,
                      S.x24,
                      S.gutter,
                      S.x12,
                    ),
                    child: SectionHeader(
                      tr('Lenta'),
                      actionLabel: tr('Hammasi'),
                      onAction: () => Shell.goTab(context, 1),
                    ),
                  ),
                ),
                SliverList.separated(
                  itemCount: _feed.length,
                  separatorBuilder: (_, __) => const SizedBox(height: S.x12),
                  itemBuilder: (context, i) {
                    final it = _feed[i];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                      child: _FeedCard(
                        item: it,
                        onOpen: () => _openFeedAuthor(it),
                        onLike: it.likeable ? () => _likeFeed(i) : null,
                        onMore: () => showReportSheet(
                          context,
                          targetKind: 'post',
                          targetId: '${it.id}',
                          ownerCode: it.code,
                        ),
                      ),
                    );
                  },
                ),
              ],

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

/// YUQORI PANEL — PROTOTIPDAGI IXCHAM QATOR.
///
/// NIMA UCHUN AVATAR OLIB TASHLANDI: ilgari bu yerda 124 dp li
/// dumaloq avatar ekranning butun tepasini egallardi. Prototipda
/// esa tepa BO'SH qoldiriladi va ekranning qahramoni pastdagi
/// METALL KARTA bo'ladi — ikkita katta dumaloq/to'rtburchak
/// bir-biri bilan raqobatlashmasin. Avatar yo'qolmadi: u story
/// qatorining birinchi elementida ("Sizning story") turadi va
/// bosilganda shaxs almashtirgichni ochadi.
///
/// Chapda brend, o'ngda ikkita amal: qidiruv va bildirishnoma.
class _Header extends StatelessWidget {
  const _Header({this.onSearch, this.onBell, this.badge = 0});

  final VoidCallback? onSearch;
  final VoidCallback? onBell;

  /// O'qilmagan sovg'a takliflari soni — 0 bo'lsa belgi yo'q.
  final int badge;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x12, S.gutter, 0),
        child: Row(
          children: [
            const Wordmark(size: 12),
            const Spacer(),
            RoundButton(Ico.search, onTap: onSearch, size: 40),
            const SizedBox(width: S.x8),
            RoundButton(Ico.bell, onTap: onBell, size: 40, badge: badge),
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
    this.ownAvatarUrl,
    this.ownHasStory = false,
    this.onOwnLongPress,
  });

  final List<StoryFeedEntry> entries;
  final bool loading;

  /// Shu odamda ko'rilmagan istorya bormi — halqa shunga qarab
  /// yonadi yoki so'nadi.
  final bool Function(StoryFeedEntry) unseen;

  final VoidCallback? onAdd;
  final ValueChanged<StoryFeedEntry> onOpen;

  /// EGASINING O'ZI — qatorning birinchi elementi.
  ///
  /// Yuqoridagi katta avatar olib tashlangach, egasining surati
  /// shu yerda qoldi: prototipdagi "Sizning story" elementi.
  /// Halqasi ham ma'no tashiydi — faol istoryasi bo'lsa yonadi.
  final String? ownAvatarUrl;
  final bool ownHasStory;

  /// Uzoq bosilsa shaxs almashtirgich ochiladi — bir nechta ID
  /// egasi uchun eng qisqa yo'l.
  final VoidCallback? onOwnLongPress;

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
            return StoryRing(
              avatarUrl: ownAvatarUrl,
              addButton: true,
              seen: !ownHasStory,
              onTap: onAdd,
              onLongPress: onOwnLongPress,
            );
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
  const _ActiveCard({required this.identity, this.onTap});

  final Identity identity;

  /// Karta — ekranning qahramoni, shuning uchun u BOSILADI:
  /// shaxs almashtirgichni ochadi. Ilgari bu amal faqat tepadagi
  /// katta avatarda edi; avatar olingach, uni karta oldi.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final record = identity.record;
    // BIZNES KARTASI HAM METALL BO'LADI.
    //
    // Ilgari bu yerda `record?.tier ?? Tier.free` turardi: biznes
    // tanlanganda `record` bo'lmaydi, ya'ni karta HAR DOIM "free"
    // — qop-qora va bo'sh — bo'lib chiqardi. Egasi buni surat
    // bilan ko'rsatdi. Kompaniyaning o'z tarifi bor, karta ham
    // o'sha materialda bo'lishi kerak.
    final tier = identity.isBusiness
        ? TierStyle.parse(identity.company?.tier ?? '')
        : (record?.tier ?? Tier.free);
    // KARTA SAL KICHRAYDI va markazda turadi.
    //
    // Egasi: "avatarni sal kattaroq qilsak-da, kartani
    // kichraytirib". Nisbat (1.585 — haqiqiy plastik karta
    // nisbati) O'ZGARMAYDI: faqat kengligi cheklanadi, aks holda
    // karta "cho'zilgan" ko'rinardi.
    return Center(
      child: FractionallySizedBox(
        widthFactor: .88,
        child: IdentityCard(
          onTap: onTap,
          code: identity.code,
          tier: tier,
          holder: identity.name,
          url: identity.publicUrl.replaceFirst('https://', ''),
        ),
      ),
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
            icon: Ico.bag,
            label: tr('Do‘kon'),
            // DO'KON TABIGA — yangi ekran ochilmaydi. Prototipdagi
            // tezkor amal aynan tabga olib boradi: pastki panelda
            // ham "Do'kon" tanlangan bo'lib turadi.
            onTap: () => Shell.goTab(context, 3),
          ),
        ),
        const SizedBox(width: S.x8),
        Expanded(
          child: _ActionTile(
            icon: Ico.gift,
            label: tr('Sovg‘a'),
            onTap: () => push<void>(
              context,
              (_) => record != null
                  ? GiftIdScreen(record: record)
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
          // TO'RT USTUN — YOZUV IKKI QATORGA SIG'ADI.
          //
          // Prototipda tezkor amallar to'rtta va ustun tor. Bitta
          // qatorda "Skanerlash" sig'maydi va "Skanerla…" bo'lib
          // qisqaradi — qisqargan yozuv nima qilishini aytmaydi.
          // Shuning uchun balandlik oshirildi va yozuv ikki
          // qatorga chiqadi.
          height: 84,
          padding: const EdgeInsets.symmetric(horizontal: 6),
          decoration: BoxDecoration(
            gradient: C.raisedSurface,
            borderRadius: BorderRadius.circular(R.tile),
            border: Border.all(color: C.line),
            boxShadow: C.e1,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              NIcon(icon, size: 20, color: onTap == null ? C.ink3 : C.accent),
              const SizedBox(height: 7),
              Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: T.buttonSm.copyWith(
                  fontSize: 11.5,
                  height: 1.2,
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

// ─────────────────────────────────────────────────────────────
// HAFTANING KOMPANIYASI
// ─────────────────────────────────────────────────────────────

/// KATTA MEDIA KARTA — prototipdagi "hero".
///
/// NIMA UCHUN KERAK: Bosh sahifaning yuqori yarmi o'z kartasi va
/// amallar bilan band — hammasi EGASI haqida. Pastki yarmi esa
/// boshqalar haqida bo'lishi kerak, aks holda ilova "shaxsiy
/// kabinet" bo'lib qoladi va qaytib kelishga sabab qolmaydi.
/// Katta rasm shu burilishni ko'z bilan ko'rsatadi.
class _FeaturedCompany extends StatelessWidget {
  const _FeaturedCompany({required this.company, this.onTap});

  final Company company;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final media = (company.coverUrl ?? '').isNotEmpty
        ? company.coverUrl!
        : (company.logoUrl ?? '');
    // META — shahar va holat. Kompaniya modelida soha nomi yo'q
    // (server uni `/api/companies` da qaytarmaydi), shuning uchun
    // taxmin qilinmaydi: bor narsa ko'rsatiladi.
    final meta = [
      if (company.city.isNotEmpty) company.city,
      if (company.isOpen == true) tr('Ochiq'),
    ].join(' · ');

    return Press(
      onTap: onTap,
      minSize: 0,
      scale: .985,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(R.hero),
        child: AspectRatio(
          aspectRatio: 4 / 3,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (media.isNotEmpty)
                NetImage(media, fit: BoxFit.cover)
              else
                DecoratedBox(decoration: BoxDecoration(gradient: C.raisedSurface)),

              // MATN O'QILISHI UCHUN PASTDAN QORAYTIRISH.
              // Rasm har xil bo'ladi — och rasm ustida oq yozuv
              // yo'qoladi, shuning uchun scrim RASMGA emas,
              // kartaga bog'langan va doim bor.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x00000000),
                      Color(0x33000000),
                      Color(0xCC000000),
                    ],
                    stops: [.35, .6, 1],
                  ),
                ),
              ),

              if (company.verified)
                Positioned(
                  left: S.x12,
                  top: S.x12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: S.x12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0x38FFFFFF),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: const Color(0x40FFFFFF)),
                    ),
                    child: Text(
                      tr('Admin tasdiqlagan'),
                      style: T.meta.copyWith(color: C.onDark, fontSize: 11.5),
                    ),
                  ),
                ),

              Positioned(
                left: S.x16,
                right: S.x16,
                bottom: S.x16,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (meta.isNotEmpty)
                      Text(
                        meta.toUpperCase(),
                        style: T.meta.copyWith(
                          color: C.onDark2,
                          letterSpacing: 1.4,
                          fontSize: 10.5,
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      company.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.cardTitle.copyWith(
                        fontFamily: 'PlayfairDisplay',
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        color: C.onDark,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        company.id.toUpperCase(),
                        if (company.hoursLabel.isNotEmpty) company.hoursLabel,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.caption.copyWith(color: C.onDark2),
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
}

// ─────────────────────────────────────────────────────────────
// LENTA KARTASI
// ─────────────────────────────────────────────────────────────

/// Bitta post — muallif, media, amallar, izoh.
///
/// MEDIA TO'LIQ KENGLIKDA: prototipda rasm kartaning ichida emas,
/// KARTANING O'ZI. Chekkasidan joy qoldirilsa, lenta "jadval"
/// bo'lib ko'rinadi va rasm kuchini yo'qotadi.
class _FeedCard extends StatelessWidget {
  const _FeedCard({required this.item, this.onOpen, this.onLike, this.onMore});

  final FeedItem item;
  final VoidCallback? onOpen;
  final VoidCallback? onLike;
  final VoidCallback? onMore;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(color: C.line),
          boxShadow: C.e1,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(S.x12, S.x12, S.x8, S.x12),
              child: Row(
                children: [
                  StoryRing(
                    avatarUrl: item.avatarUrl.isEmpty ? null : item.avatarUrl,
                    name: item.name,
                    size: 36,
                    seen: true,
                    showLabel: false,
                    onTap: onOpen,
                  ),
                  const SizedBox(width: S.x12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.cardTitle.copyWith(fontSize: 14),
                        ),
                        Text(
                          [
                            item.code,
                            if (item.createdAt != null) ago(item.createdAt),
                          ].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: T.caption.copyWith(fontSize: 11.5),
                        ),
                      ],
                    ),
                  ),
                  RoundButton(Ico.more, onTap: onMore, size: 36, iconSize: 16),
                ],
              ),
            ),
            if (item.hasMedia)
              Press(
                onTap: onOpen,
                minSize: 0,
                scale: .995,
                child: AspectRatio(
                  aspectRatio: 4 / 3,
                  child: item.imageUrl.isNotEmpty
                      ? NetImage(item.imageUrl, fit: BoxFit.cover)
                      : DecoratedBox(
                          decoration: BoxDecoration(gradient: C.raisedSurface),
                          child: Center(
                            child: NIcon(Ico.play, size: 34, color: C.ink2),
                          ),
                        ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(S.x12, S.x12, S.x12, S.x12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (item.likeable)
                    Row(
                      children: [
                        LikeButton(
                          liked: item.liked,
                          count: item.likes,
                          onTap: onLike ?? () {},
                        ),
                      ],
                    ),
                  if (item.caption.isNotEmpty) ...[
                    if (item.likeable) const SizedBox(height: S.x8),
                    Text(
                      item.caption,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: T.body.copyWith(fontSize: 14, color: C.ink),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}
