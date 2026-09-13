import 'package:flutter/material.dart' show RefreshIndicator, DefaultTabController, TabBar, TabBarView, Tab;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../business/business_stats.dart';
import '../business/product_detail.dart';
import '../content/compose.dart';
import '../orders/owner_orders.dart';
import 'edit_profile.dart';
import 'follow_list.dart';
import 'profile_stats.dart';
import '../common/contact_actions.dart';
import '../common/top_bar.dart';
import '../content/post_detail.dart';
import '../content/photo_viewer.dart';
import '../nfc/qr_share.dart';
import '../business/edit_business.dart';
import '../../l10n/strings.dart';

/// PROFIL — bitta skelet, to'rt kombinatsiya.
///
/// Ikki o'q handoff bo'yicha:
///   TIP    — shaxsiy (bio, kasb, havolalar) yoki biznes (muqova,
///            ish vaqti, manzil, katalog);
///   KO'RUVCHI — ega (Tahrirlash, Statistika, Post, Story; biznesda
///            yana Mahsulot va Buyurtmalar) yoki ommaviy (Obuna,
///            Ulashish va kontakt amallari).
///
/// EGA VOSITALARI OMMAVIY AMALLAR BILAN BIR XIL JOYDA turadi, shuning
/// uchun rol o'zgarganda maket qayta oqmaydi.
///
/// RUXSAT: bu yerdagi `isOwner` faqat KO'RINISH uchun. Har bir
/// o'zgartirish so'rovini server o'zi qaytadan tekshiradi.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.identity, this.code, this.companyId});

  /// O'z shaxsi bo'lsa — tayyor obyekt.
  final Identity? identity;

  /// Ommaviy shaxsiy profil.
  final String? code;

  /// Ommaviy biznes profil.
  final String? companyId;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Record? _record;
  Company? _company;
  List<Post> _posts = const [];
  List<Post> _stories = const [];
  List<Product> _catalog = const [];
  FollowStats _follow = const FollowStats();
  bool _loading = true;
  Object? _error;
  bool _busyFollow = false;

  bool get _isBusiness =>
      widget.companyId != null || (widget.identity?.isBusiness ?? false) || _company != null;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Yaratish ekranini ochadi va joylangandan keyin profilni
  /// yangilaydi.
  ///
  /// Yangilamasak, joylangan post faqat ilova qayta ochilganda
  /// ko'rinardi — odam esa "joylanmadi" deb o'ylardi.
  Future<void> _compose(String code, ComposeKind kind) async {
    final done = await push<bool>(
      context,
      (_) => ComposeScreen(code: code, kind: kind, company: _isBusiness),
    );
    if (done == true && mounted) await _load();
  }

  Future<void> _load() async {
    final state = AppScope.read(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final id = widget.identity;
      final businessId = widget.companyId ?? (id?.isBusiness == true ? id!.code : null);
      if (businessId != null) {
        final company = await state.repo.company(businessId);
        // Qolganlari ixtiyoriy: biri tushmasa ham profil ochilishi kerak.
        final results = await Future.wait([
          state.repo.companyCatalog(businessId).catchError((_) => <Product>[]),
          state.repo.companyPosts(businessId).catchError((_) => <Post>[]),
          state.repo.companyStories(businessId).catchError((_) => <Post>[]),
        ]);
        state.repo.companyEvent(businessId);
        if (!mounted) return;
        setState(() {
          _company = company;
          _catalog = company.items.isNotEmpty ? company.items : results[0] as List<Product>;
          _posts = results[1] as List<Post>;
          _stories = results[2] as List<Post>;
          _follow = FollowStats(followers: company.followers, isFollowing: company.following);
          _loading = false;
        });
        return;
      }

      final code = widget.code ?? id?.code;
      if (code == null || code.isEmpty) throw Exception('no_code');
      final record = await state.repo.record(code);
      final results = await Future.wait([
        state.repo.recordPosts(code).catchError((_) => <Post>[]),
        state.repo.recordStories(code).catchError((_) => <Post>[]),
        state.repo.followStats(code).catchError((_) => const FollowStats()),
      ]);
      // Ko'rishlar hisobi — FAQAT begona profilda. O'z profilingni
      // ochish statistikani shishirmasligi kerak.
      if (!state.ownsRecord(code)) state.repo.markView(code);
      if (!mounted) return;
      setState(() {
        _record = record;
        _posts = results[0] as List<Post>;
        _stories = results[1] as List<Post>;
        _follow = results[2] as FollowStats;
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

  Future<void> _toggleFollow() async {
    final code = _company?.id ?? _record?.code;
    if (code == null || _busyFollow) return;
    final wasFollowing = _follow.isFollowing;
    setState(() {
      _busyFollow = true;
      // Optimistik yangilanish — tugma darhol javob beradi. Xato
      // bo'lsa pastda qaytariladi.
      _follow = FollowStats(
        followers: _follow.followers + (wasFollowing ? -1 : 1),
        following: _follow.following,
        isFollowing: !wasFollowing,
      );
    });
    try {
      final repo = AppScope.read(context).repo;
      if (wasFollowing) {
        await repo.unfollow(code);
      } else {
        await repo.follow(code);
      }
    } catch (_) {
      if (mounted) {
        setState(() => _follow = FollowStats(
              followers: _follow.followers + (wasFollowing ? 1 : -1),
              following: _follow.following,
              isFollowing: wasFollowing,
            ));
      }
    } finally {
      if (mounted) setState(() => _busyFollow = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final code = _company?.id ?? _record?.code ?? widget.code ?? widget.companyId ?? '';
    final isOwner = _isBusiness ? state.ownsCompany(code) : state.ownsRecord(code);

    if (_loading && _record == null && _company == null) {
      return _Frame(code: code, child: const _ProfileSkeleton());
    }
    if (_error != null && _record == null && _company == null) {
      return _Frame(
        code: code,
        child: ErrorState(humanError(_error), onRetry: _load),
      );
    }

    // TARJIMA QILINADI: bo'lim nomlari ham interfeys matni. Ular
    // o'zbekcha qolsa, rus va ingliz tilidagi ekran yarim tarjima
    // bo'lib ko'rinardi. «Story» uch tilda ham shunday yoziladi.
    // BOSH HARFLAR — dizayn tili shunday: bo'lim nomlari kichik
    // va keng oraliqli bosh harflarda. Tarjima ham shu qolipga
    // tushadi.
    final tabs = _isBusiness
        ? [tr('Katalog'), tr('Postlar'), 'Story', tr('Haqida')]
            .map((t) => t.toUpperCase())
            .toList()
        : [tr('Postlar'), 'Story', tr('Haqida')]
            .map((t) => t.toUpperCase())
            .toList();

    return _Frame(
      code: code,
      child: DefaultTabController(
        length: tabs.length,
        child: RefreshIndicator(
          onRefresh: _load,
          color: C.champagne,
          backgroundColor: C.slate,
          child: NestedScrollView(
            headerSliverBuilder: (_, __) => [
              SliverToBoxAdapter(
                child: _Header(
                  record: _record,
                  company: _company,
                  follow: _follow,
                  isOwner: isOwner,
                  busyFollow: _busyFollow,
                  onFollow: _toggleFollow,
                  onShare: () {
                    final id = _company != null
                        ? Identity.business(_company!)
                        : Identity.personal(_record!);
                    shareIdentity(id);
                  },
                  onRefresh: _load,
                ),
              ),
              SliverToBoxAdapter(
                child: TabBar(
                  isScrollable: false,
                  indicatorColor: C.champagne,
                  indicatorWeight: 2,
                  dividerColor: C.hairline,
                  labelColor: C.offWhite,
                  unselectedLabelColor: C.muted,
                  labelStyle: T.statusLabel.copyWith(fontSize: 10.5, fontWeight: FontWeight.w700),
                  unselectedLabelStyle: T.statusLabel.copyWith(fontSize: 10.5),
                  tabs: [for (final t in tabs) Tab(height: 42, text: t)],
                ),
              ),
            ],
            body: TabBarView(
              children: [
                if (_isBusiness) _CatalogGrid(items: _catalog),
                // KONTENT QO'SHISH — EGADA, shaxsiyda ham biznesda
                // ham. Yaratish ekrani bitta (`ComposeScreen`),
                // faqat so'rov boshqa endpointga ketadi.
                _PostGrid(
                  posts: _posts,
                  onAdd: isOwner ? () => _compose(code, ComposeKind.post) : null,
                ),
                _PostGrid(
                  posts: _stories,
                  empty: tr('Hali story yo‘q'),
                  emptyHint: tr('Story 24 soat turadi. Hozir bu yerda hech narsa yo‘q.'),
                  emptyIcon: Ico.camera,
                  addLabel: tr('Story qo‘shish'),
                  onAdd: isOwner ? () => _compose(code, ComposeKind.story) : null,
                ),
                _About(record: _record, company: _company),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Profil skeleton'i — HAQIQIY maketning silueti: muqova, avatar,
/// uchta raqam, ism va amal tugmalari. Ma'lumot kelganda hech narsa
/// siljimaydi, chunki o'lchamlar bir xil.
class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        children: const [
          SkeletonCard(aspect: 16 / 7),
          SizedBox(height: S.x16),
          Row(
            children: [
              Skeleton(width: 66, height: 66, radius: 33),
              SizedBox(width: S.x16),
              Expanded(child: Skeleton(height: 34)),
            ],
          ),
          SizedBox(height: S.x16),
          Skeleton(width: 170, height: 21),
          SizedBox(height: S.x8),
          Skeleton(width: 110, height: 13),
          SizedBox(height: S.x16),
          Skeleton(height: 48, radius: R.button),
        ],
      );
}

class _Frame extends StatelessWidget {
  const _Frame({required this.code, required this.child});
  final String code;
  final Widget child;

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: C.obsidian,
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              TopBar(title: code),
              Expanded(child: child),
            ],
          ),
        ),
      );
}

class _Header extends StatelessWidget {
  const _Header({
    required this.record,
    required this.company,
    required this.follow,
    required this.isOwner,
    required this.busyFollow,
    required this.onFollow,
    required this.onShare,
    required this.onRefresh,
  });

  final Record? record;
  final Company? company;
  final FollowStats follow;
  final bool isOwner;
  final bool busyFollow;
  final VoidCallback onFollow;
  final VoidCallback onShare;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final name = company?.name ?? record?.name ?? '';
    final code = company?.id ?? record?.code ?? '';
    final avatar = company?.logoUrl ?? record?.avatarUrl;
    final cover = company?.coverUrl ?? record?.bgUrl;
    final verified = company?.verified ?? record?.verified ?? false;
    final about = company?.about ?? record?.about ?? '';
    final role = company == null
        ? record?.role ?? ''
        : [company!.city, company!.address].where((s) => s.isNotEmpty).join(' · ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // MUQOVA VA AVATAR USTMA-UST.
        //
        // Ilgari muqova va avatar alohida qatorlarda turardi va
        // o'rtada bo'sh joy qolib, sahifa "yig'ilmagan" ko'rinardi.
        // Avatar muqovaning pastki chetiga chiqib turishi — profil
        // sahifalarining tanish shakli va ikkalasini bitta blokka
        // bog'laydi.
        Stack(
          clipBehavior: Clip.none,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: S.gutter),
              child: AspectRatio(
                aspectRatio: 16 / 7,
                child: NetImage(cover, slotLabel: tr('COVER 16:7'), radius: R.card),
              ),
            ),
            // Muqova ostidagi yumshoq qorong'ilashuv — avatar va
            // yozuvlar har qanday rasm ustida o'qiladi.
            Positioned(
              left: S.gutter, right: S.gutter, bottom: 0,
              child: IgnorePointer(
                child: Container(
                  height: 54,
                  decoration: const BoxDecoration(
                    borderRadius: BorderRadius.vertical(bottom: Radius.circular(R.card)),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter, end: Alignment.bottomCenter,
                      colors: [Color(0x00000000), Color(0x8C0A0805)],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: S.gutter + S.x4,
              bottom: -26,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(color: C.obsidian, shape: BoxShape.circle),
                child: Avatar(url: avatar, name: name, size: 72),
              ),
            ),
          ],
        ),
        const SizedBox(height: 34),
        Padding(
          padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, 0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Obunachi va obuna raqamlari BOSILADI — ro'yxatni
                    // ochadi. Ko'rishlar soni esa bosilmaydi: uning
                    // ortida ro'yxat yo'q (tashrifchi kimligi
                    // saqlanmaydi) va bosilsa hech narsa bo'lmasligi
                    // odamni chalg'itardi.
                    _Stat(
                      value: follow.followers,
                      label: 'obunachi',
                      onTap: () => push(
                        context,
                        (_) => FollowListScreen(code: code, title: name),
                      ),
                    ),
                    if (company != null)
                      _Stat(value: company!.itemCount, label: 'mahsulot')
                    else
                      _Stat(
                        value: follow.following,
                        label: 'obuna',
                        onTap: () => push(
                          context,
                          (_) => FollowListScreen(
                            code: code,
                            title: name,
                            startWithFollowing: true,
                          ),
                        ),
                      ),
                    _Stat(value: company?.views ?? record?.views ?? 0, label: tr('ko‘rish')),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(S.gutter, S.x20, S.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: T.profileName),
                  ),
                  if (verified) ...[
                    const SizedBox(width: 6),
                    const VerifiedBadge(),
                  ],
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  // ID kodi — mahsulotning o'zi, shuning uchun u
                  // shunchaki matn emas, belgi shaklida.
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: S.x8, vertical: 3),
                    decoration: BoxDecoration(
                      color: C.champagne.withValues(alpha: .1),
                      borderRadius: BorderRadius.circular(R.status),
                      border: Border.all(color: C.champagne.withValues(alpha: .25)),
                    ),
                    child: Text(code, style: T.code.copyWith(fontSize: 11.5)),
                  ),
                  if (company?.isOpen != null) ...[
                    const SizedBox(width: S.x8),
                    StatusChip(
                      company!.isOpen! ? tr('Ochiq') : tr('Yopiq'),
                      tone: company!.isOpen! ? StatusTone.ok : StatusTone.neutral,
                    ),
                    if (company!.hoursLabel.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Text(company!.hoursLabel, style: T.meta.copyWith(fontSize: 11)),
                    ],
                  ],
                ],
              ),
              if (role.isNotEmpty) ...[
                const SizedBox(height: 5),
                Text(role, style: T.caption),
              ],
              if (about.isNotEmpty) ...[
                const SizedBox(height: S.x12),
                // Uch qator — uzun bio amal tugmalarini ekrandan
                // surib yubormasin.
                Text(about, style: T.body, maxLines: 3, overflow: TextOverflow.ellipsis),
              ],
            ],
          ),
        ),
        const SizedBox(height: S.x20),
        // AMAL SLOTLARI — ega va mehmon uchun bir xil joyda.
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: isOwner
              ? _OwnerActions(
                  company: company,
                  record: record,
                  onShare: onShare,
                  onChanged: onRefresh,
                )
              : _PublicActions(
                  following: follow.isFollowing,
                  busy: busyFollow,
                  onFollow: onFollow,
                  onShare: onShare,
                  phone: company?.phone ?? record?.phone ?? '',
                  tg: company?.tg ?? record?.tg ?? '',
                  instagram: company?.instagram ?? record?.instagram ?? '',
                ),
        ),
        const SizedBox(height: S.x20),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label, this.onTap});
  final int value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        scale: onTap == null ? 1 : .95,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(compact(value), style: T.cardTitle.copyWith(fontSize: 16)),
              const SizedBox(height: 2),
              Text(label, style: T.caption.copyWith(fontSize: 10.5, color: C.muted)),
            ],
          ),
        ),
      );
}

/// EGA VOSITALARI.
///
/// Ishlamaydigan tugma QO'YILMAYDI: backend qo'llab-quvvatlamaydigan
/// amal (post/story yaratish — rasm yuklash oqimi hali yo'q) umuman
/// ko'rsatilmaydi. Bosilganda hech narsa qilmaydigan tugma
/// foydalanuvchini ishonchdan mahrum qiladi.
class _OwnerActions extends StatelessWidget {
  const _OwnerActions({
    required this.company,
    required this.record,
    required this.onShare,
    required this.onChanged,
  });

  final Company? company;
  final Record? record;
  final VoidCallback onShare;
  final VoidCallback onChanged;

  bool get isBusiness => company != null;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Row(
            children: [
              Expanded(
                child: SecondaryButton(
                  tr('Tahrirlash'),
                  height: 44,
                  // Endi IKKALASI ham: biznes o'z ekraniga boradi
                  // (`PATCH /api/companies/:id`), shaxsiy — o'zinikiga.
                  onTap: () async {
                    final saved = await push<bool>(
                      context,
                      (_) => company != null
                          ? EditBusinessScreen(company: company!)
                          : EditProfileScreen(record: record!),
                    );
                    if (saved == true) onChanged();
                  },
                ),
              ),
              const SizedBox(width: S.x8),
              Expanded(
                child: SecondaryButton(
                  tr('Statistika'),
                  height: 44,
                  // Ikkala tur uchun ham ishlaydi: biznesda
                  // `/api/companies/:id/stats`, shaxsiyda
                  // `/api/records/:code/analytics`. Ikkalasi bir xil
                  // ko'rinishda — ilova ikki xil mahsulotdek
                  // his qilinmasin.
                  onTap: isBusiness
                      ? () => push(context, (_) => BusinessStatsScreen(companyId: company!.id))
                      : record == null
                          ? null
                          : () => push(
                                context,
                                (_) => ProfileStatsScreen(
                                  code: record!.code,
                                  name: record!.name,
                                ),
                              ),
                ),
              ),
            ],
          ),
          const SizedBox(height: S.x8),
          Row(
            children: [
              if (isBusiness) ...[
                Expanded(
                  child: GhostButton(
                    tr('Buyurtmalar'),
                    icon: NIcon(Ico.bag, size: 15, color: C.champagne),
                    onTap: () => push(
                      context,
                      (_) => OwnerOrdersScreen(
                        companyId: company!.id,
                        companyName: company!.name,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: S.x8),
              ],
              // Ulashish — ENDI TO'LIQ QATOR (biznesda yarim).
              //
              // Ilgari u alohida qatorda yolg'iz turgan 44×44 kvadrat
              // edi va o'ng tomonda katta bo'sh joy qolib, maket
              // "tugallanmagan" ko'rinardi.
              Expanded(
                child: GhostButton(
                  tr('Ulashish'),
                  icon: NIcon(Ico.share, size: 15, color: C.champagne),
                  onTap: onShare,
                ),
              ),
            ],
          ),
        ],
      );
}

class _PublicActions extends StatelessWidget {
  const _PublicActions({
    required this.following,
    required this.busy,
    required this.onFollow,
    required this.onShare,
    required this.phone,
    required this.tg,
    required this.instagram,
  });

  final bool following;
  final bool busy;
  final VoidCallback onFollow;
  final VoidCallback onShare;
  final String phone;
  final String tg;
  final String instagram;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Row(
            children: [
              Expanded(
                child: following
                    ? SecondaryButton(tr('Obuna bo‘lingan'), height: 48, onTap: busy ? null : onFollow)
                    : PrimaryButton(tr('Obuna bo‘lish'), loading: busy, onTap: busy ? null : onFollow),
              ),
              const SizedBox(width: S.x8),
              // Ikonkali kvadrat: "Obuna bo'lish" ekrandagi YAGONA
              // asosiy tugma bo'lib qolishi kerak, shuning uchun
              // ulashish yozuvsiz.
              Press(
                onTap: onShare,
                child: Container(
                  width: 48, height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: C.slate,
                    borderRadius: BorderRadius.circular(R.button),
                    border: Border.all(color: C.warmHairline),
                  ),
                  child: const NIcon(Ico.share, size: 19, color: C.offWhite),
                ),
              ),
            ],
          ),
          SizedBox(height: S.x12),
          // TASHQI KONTAKT — ichki messenjer YO'Q.
          ContactRow(phone: phone, telegram: tg, instagram: instagram),
        ],
      );
}

class _CatalogGrid extends StatelessWidget {
  const _CatalogGrid({required this.items});
  final List<Product> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return EmptyState(
        tr('Bu biznes hali mahsulot joylamagan. Keyinroq kirib ko‘ring.'),
        title: tr('Katalog bo‘sh'),
        icon: Ico.bag,
      );
    }
    return GridView.builder(
      padding: EdgeInsets.all(S.gutter),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: S.x12,
        mainAxisSpacing: S.x12,
        childAspectRatio: .74,
      ),
      itemCount: items.length,
      itemBuilder: (context, i) => ProductCard(product: items[i]),
    );
  }
}

class _PostGrid extends StatelessWidget {
  // Standart matnlar TILGA BOG'LIQ, ya'ni `const` standart qiymat
  // bo'la olmaydi. `null` -> build ichida joriy tilda olinadi.
  const _PostGrid({
    required this.posts,
    this.empty,
    this.emptyHint,
    this.emptyIcon = Ico.image,
    this.onAdd,
    this.addLabel,
  });
  final List<Post> posts;

  /// Bo'sh holat sarlavhasi.
  final String? empty;

  /// MEHMONGA ko'rsatiladigan izoh (egada boshqacha yoziladi).
  final String? emptyHint;
  final Ico emptyIcon;

  /// Faqat EGADA bo'ladi. `null` — mehmon ko'rinishi.
  final VoidCallback? onAdd;
  final String? addLabel;

  @override
  Widget build(BuildContext context) {
    if (posts.isEmpty) {
      // Bo'sh to'rda amal SHU YERDA bo'lishi kerak: ega profilini
      // ochib "bo'sh" yozuvini ko'rsa, keyingi qadam nima ekani
      // ko'rinmasdi va kontent qo'shish yo'li umuman yo'q edi.
      return EmptyState(
        // MEHMONGA va EGAGA boshqa izoh: mehmon hech narsa qila
        // olmaydi, egaga esa keyingi qadam aytiladi.
        onAdd == null
            ? (emptyHint ?? tr('Bu profilda hali post joylanmagan.'))
            : tr('Birinchisini joylang — profilingiz shu bilan jonlanadi.'),
        title: empty ?? tr('Hali post yo‘q'),
        icon: emptyIcon,
        actionLabel: onAdd == null ? null : (addLabel ?? tr('Post qo‘shish')),
        onAction: onAdd,
      );
    }
    return GridView.builder(
      // Oraliq 3 -> 2 va nisbat 4:5 (dizayndagi POST MEDIA bilan bir
      // xil). Ilgari 0.8 nisbat rasmlarni qirqib, to'r notekis
      // ko'rinardi.
      padding: const EdgeInsets.all(2),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 2,
        mainAxisSpacing: 2,
        childAspectRatio: 4 / 5,
      ),
      itemCount: posts.length + (onAdd == null ? 0 : 1),
      itemBuilder: (context, i) => onAdd != null && i == 0
          ? _AddTile(label: addLabel ?? tr('Post qo‘shish'), onTap: onAdd!)
          : _tile(context, posts[i - (onAdd == null ? 0 : 1)]),
    );
  }

  Widget _tile(BuildContext context, Post post) => RepaintBoundary(
        child: Press(
          onTap: () => push(context, (_) => PostDetailScreen(post: post)),
          child: NetImage(
            post.images.isEmpty ? null : post.images.first,
            radius: 4,
            // Uch ustunli to'rda har rasm ~130px — undan kattaroq
            // dekodlash xotirani behuda yeydi.
            cacheWidth: 160,
            slotLabel: 'POST',
          ),
        ),
      );
}

/// To'rdagi birinchi katak — "qo'shish".
///
/// NIMA UCHUN SUZUVCHI TUGMA EMAS: suzuvchi tugma oxirgi qatorni
/// to'sib qoladi va dizayn tilida bunday element yo'q. Katak esa
/// to'rning o'z ritmida turadi.
class _AddTile extends StatelessWidget {
  const _AddTile({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        haptic: true,
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: C.placeholder,
            border: Border.all(color: C.warmHairline),
          ),
          alignment: Alignment.center,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              NIcon(Ico.plus, size: 22, color: C.champagne),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: T.caption.copyWith(fontSize: 10),
                ),
              ),
            ],
          ),
        ),
      );
}

/// GALEREYA LENTASI — «Ma'lumot» bo'limining tepasida.
///
/// NIMA UCHUN SHU YERDA: bu bo'lim biznes HAQIDA. Rasm ham shu
/// haqda gapiradi — postlar esa yangilik oqimi, ular bilan
/// aralashsa, ikkalasi ham ma'nosini yo'qotardi.
class _GalleryStrip extends StatelessWidget {
  const _GalleryStrip({required this.images, required this.title});
  final List<String> images;
  final String title;

  @override
  Widget build(BuildContext context) {
    // Katak 104px — ikki barobari kifoya, undan ortig'ini
    // dekodlash xotirani behuda yeydi.
    final dpr = MediaQuery.devicePixelRatioOf(context);
    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: images.length,
        separatorBuilder: (_, __) => const SizedBox(width: S.x8),
        itemBuilder: (_, i) => Press(
          haptic: true,
          onTap: () => push(
            context,
            (_) => PhotoViewerScreen(images: images, initial: i, title: title),
          ),
          child: SizedBox(
            width: 104,
            child: NetImage(images[i],
                radius: R.tile, cacheWidth: (104 * dpr).round()),
          ),
        ),
      ),
    );
  }
}

class _About extends StatelessWidget {
  const _About({required this.record, required this.company});
  final Record? record;
  final Company? company;

  @override
  Widget build(BuildContext context) {
    final rows = <({String label, String value})>[
      if ((company?.address ?? record?.address ?? '').isNotEmpty)
        (label: tr('Manzil'), value: company?.address ?? record!.address),
      if ((company?.city ?? record?.city ?? '').isNotEmpty)
        (label: tr('Shahar'), value: company?.city ?? record!.city),
      if ((company?.hoursLabel ?? '').isNotEmpty)
        (label: tr('Ish vaqti'), value: company!.hoursLabel),
      if ((company?.phone ?? record?.phone ?? '').isNotEmpty)
        (label: tr('Telefon'), value: company?.phone ?? record!.phone),
      if ((company?.website ?? record?.website ?? '').isNotEmpty)
        (label: tr('Veb-sayt'), value: company?.website ?? record!.website),
    ];
    final about = company?.about ?? record?.about ?? '';
    final gallery = company?.gallery ?? const <String>[];

    if (rows.isEmpty && about.isEmpty && gallery.isEmpty) {
      return EmptyState(
        tr('Manzil, ish vaqti va aloqa ma‘lumotlari hali kiritilmagan.'),
        title: tr('Ma‘lumot yo‘q'),
        icon: Ico.user,
      );
    }
    return ListView(
      padding: const EdgeInsets.all(S.gutter),
      children: [
        if (gallery.isNotEmpty) ...[
          _GalleryStrip(images: gallery, title: company?.name ?? ''),
          const SizedBox(height: S.x12),
        ],
        if (about.isNotEmpty) ...[
          Surface(child: Text(about, style: T.body)),
          const SizedBox(height: S.x12),
        ],
        for (final r in rows) ...[
          Surface(
            padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x12),
            shadow: E.e1,
            child: Row(
              children: [
                SizedBox(width: 96, child: Text(r.label, style: T.caption)),
                Expanded(
                  child: Text(r.value, style: T.cardTitle.copyWith(fontSize: 13)),
                ),
              ],
            ),
          ),
          const SizedBox(height: S.x8),
        ],
      ],
    );
  }
}
