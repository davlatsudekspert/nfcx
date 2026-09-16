import 'dart:convert' show utf8;

import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';
import 'package:share_plus/share_plus.dart' show Share, XFile;

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/music_bar.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/story_ring.dart';
import '../../design/components/surface.dart';
import '../../design/components/toast.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../business/product_detail.dart';
import '../common/contact_actions.dart';
import '../common/share.dart';
import '../content/photo_viewer.dart';
import '../content/post_detail.dart';
import '../content/report_sheet.dart';
import '../content/story_viewer.dart';
import 'follow_list.dart';
import 'lead_sheet.dart';

/// PROFILGA QANDAY KIRILDI.
///
/// Bu SHUNCHAKI BELGI EMAS — mahsulot qoidasi. "Kontaktni saqlash"
/// faqat NFC kartani tegizganda yoki QR skanerlaganda ochiladi:
/// shunda karta egasi ulashishni O'ZI tasdiqlagan bo'ladi.
/// Qidiruvdan ochilgan profilda bu tugma bo'lmaydi va sababi
/// ekranda yozilgan.
enum ProfileEntry { tap, search }

/// OCHIQ PROFIL — bitta skelet, to'rt holat.
///
/// shaxsiy / biznes × tashrifchi / egasi. Har kombinatsiya uchun
/// alohida ekran yozilsa, to'rttasi bir-biridan asta uzoqlashib
/// ketardi.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    this.code,
    this.companyId,
    this.entry = ProfileEntry.search,
  });

  /// Shaxsiy yoki biznes KARTA kodi.
  final String? code;

  /// Kompaniya ID'si.
  final String? companyId;

  final ProfileEntry entry;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  /// Biznes profilidagi faol bo'lim.
  String _tab = 'catalog';

  /// Katalogdagi faol soha chipi (bo'sh — "Asosiy", hammasi).
  String _catalogCat = '';

  Record? _record;
  Company? _company;
  List<Post> _posts = const [];
  List<Post> _stories = const [];
  FollowStats? _follow;

  bool _loading = true;
  Object? _error;
  bool _busyFollow = false;

  bool get _isCompany => (widget.companyId ?? '').isNotEmpty;

  String get _code => widget.companyId ?? widget.code ?? '';

  bool get _owned {
    final state = AppScope.read(context);
    return _isCompany ? state.ownsCompany(_code) : state.ownsRecord(_code);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final repo = AppScope.read(context).repo;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (_isCompany) {
        final company = await repo.company(_code);
        List<Post> posts = const [];
        List<Post> stories = const [];
        try {
          posts = await repo.companyPosts(_code);
        } catch (_) {}
        try {
          stories = await repo.companyStories(_code);
        } catch (_) {}
        FollowStats? follow;
        try {
          follow = await repo.followStats(_code);
        } catch (_) {}
        if (!mounted) return;
        setState(() {
          _company = company;
          _posts = posts;
          _stories = stories;
          _follow = follow;
          _loading = false;
        });
        // KO'RISH HODISASI — egasining statistikasi uchun. Xatosi
        // ekranni buzmaydi.
        repo.companyEvent(_code).catchError((_) {});
      } else {
        final record = await repo.record(_code);
        List<Post> posts = const [];
        List<Post> stories = const [];
        try {
          posts = await repo.recordPosts(_code);
        } catch (_) {}
        try {
          stories = await repo.recordStories(_code);
        } catch (_) {}
        FollowStats? follow;
        try {
          follow = await repo.followStats(_code);
        } catch (_) {}
        if (!mounted) return;
        setState(() {
          _record = record;
          _posts = posts;
          _stories = stories;
          _follow = follow;
          _loading = false;
        });
        repo.markView(_code).catchError((_) {});
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _toggleFollow() async {
    final stats = _follow;
    if (stats == null || _busyFollow) return;
    final repo = AppScope.read(context).repo;
    setState(() => _busyFollow = true);
    try {
      if (stats.isFollowing) {
        await repo.unfollow(_code);
      } else {
        await repo.follow(_code);
        successHaptic();
      }
      final fresh = await repo.followStats(_code);
      if (!mounted) return;
      setState(() => _follow = fresh);
    } catch (e) {
      if (mounted) showError(context, humanError(e));
    } finally {
      if (mounted) setState(() => _busyFollow = false);
    }
  }

  /// KONTAKTNI SAQLASH — vCard fayl sifatida ulashiladi.
  ///
  /// NIMA UCHUN PLAGIN EMAS: kontaktlarga to'g'ridan-to'g'ri yozish
  /// `READ/WRITE_CONTACTS` ruxsatini talab qiladi va bu ruxsat
  /// qurilish quvuridagi tekshiruvda ATAYLAB taqiqlangan — ilova
  /// odamning telefon kitobini o'qishi uchun hech qanday sabab
  /// yo'q.
  ///
  /// vCard fayl esa tizimning o'z oynasiga beriladi va Android uni
  /// "Kontaktlar" ilovasiga import qilishni o'zi taklif etadi.
  Future<void> _saveContact() async {
    final r = _record;
    final c = _company;
    final name = r?.name ?? c?.name ?? '';
    if (name.isEmpty) return;

    final url = profileUrl(context, _code, company: _isCompany);
    final vcard = StringBuffer()
      ..writeln('BEGIN:VCARD')
      ..writeln('VERSION:3.0')
      ..writeln('FN:$name');
    if ((r?.role ?? '').isNotEmpty) vcard.writeln('TITLE:${r!.role}');
    if ((c?.name ?? '').isNotEmpty) vcard.writeln('ORG:${c!.name}');
    final phone = r?.phone ?? c?.phone ?? '';
    if (phone.isNotEmpty) vcard.writeln('TEL;TYPE=CELL:$phone');
    final email = r?.email ?? '';
    if (email.isNotEmpty) vcard.writeln('EMAIL:$email');
    vcard
      ..writeln('URL:$url')
      ..writeln('END:VCARD');

    try {
      await Share.shareXFiles([
        XFile.fromData(
          // vCard UTF-8 da yoziladi: o'zbekcha ismlarda `o'` va
          // `g'` bor va ular ASCII emas.
          utf8.encode(vcard.toString()),
          name: '${_code.toLowerCase()}.vcf',
          mimeType: 'text/vcard',
        ),
      ]);
      if (!mounted) return;
      successHaptic();
      showToast(context, tr('Kontakt saqlandi'));
    } catch (e) {
      if (mounted) showError(context, humanError(e));
    }
  }

  Future<void> _menu() async {
    await showContentMenu(
      context,
      targetKind: _isCompany ? 'company' : 'record',
      targetId: _code,
      ownerCode: _code,
      owned: _owned,
      title: _record?.name ?? _company?.name ?? _code,
      onUnfollow: (_follow?.isFollowing ?? false) ? _toggleFollow : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _record == null && _company == null) {
      return const _ProfileSkeleton();
    }
    if (_error != null && _record == null && _company == null) {
      return ScreenBackdrop(
        aura: Aura.profile,
        child: SafeArea(
          child: Column(
            children: [
              const TopBar(),
              Expanded(
                child: Center(
                  child: ErrorState(humanError(_error), detail: errorDetail(_error), onRetry: _load),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final viaTap = widget.entry == ProfileEntry.tap;

    return ScreenBackdrop(
      aura: Aura.profile,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            if (!_isCompany)
              TopBar(
                center: _EntryChip(entry: widget.entry, owned: _owned),
                trailing: RoundButton(Ico.more, onTap: _menu),
              ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                color: C.accent,
                backgroundColor: C.surface,
                displacement: 28,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: EdgeInsets.only(bottom: StickyBar.inset(context)),
                  children: _isCompany ? _companyBody() : _personBody(),
                ),
              ),
            ),

            // YOPISHGAN PASTKI PANEL.
            //
            // NFC/QR orqali kelinganda — "Kontaktni saqlash".
            // Qidiruvdan kelinganda — obuna va ulashish, hamda
            // sababi yozilgan izoh (u kontent ichida turadi).
            if (!_owned)
              StickyBar(
                child: viaTap
                    ? Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // KONTAKT QOLDIRISH — teskari yo'nalish.
                          //
                          // "Kontaktni saqlash" karta egasining
                          // ma'lumotini OLADI; bu tugma esa
                          // ochgan odam O'ZINI qoldirishi uchun.
                          // Faqat egasi buni yoqqan bo'lsa
                          // (serverda tarifga bog'liq).
                          if (_record?.leadCapture ?? false) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: SecondaryButton(
                                    tr('Kontakt qoldirish'),
                                    icon: Ico.reply,
                                    onTap: _leaveContact,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: S.x8),
                          ],
                          Row(
                            children: [
                              Expanded(
                                child: PrimaryButton(
                                  tr('Kontaktni saqlash'),
                                  onTap: _saveContact,
                                ),
                              ),
                              const SizedBox(width: S.x8),
                              RoundButton(
                                Ico.share,
                                size: 54,
                                iconSize: 20,
                                onTap: () => shareText(
                                  context,
                                  profileUrl(context, _code,
                                      company: _isCompany),
                                ),
                              ),
                            ],
                          ),
                        ],
                      )
                    : Row(
                        children: [
                          Expanded(
                            child: PrimaryButton(
                              (_follow?.isFollowing ?? false)
                                  ? tr('Obuna')
                                  : tr('Obuna bo‘lish'),
                              loading: _busyFollow,
                              onTap: _toggleFollow,
                            ),
                          ),
                          const SizedBox(width: S.x8),
                          RoundButton(
                            Ico.share,
                            size: 54,
                            iconSize: 20,
                            onTap: () => shareText(
                              context,
                              profileUrl(context, _code, company: _isCompany),
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

  // ── SHAXSIY PROFIL ──────────────────────────────────────────

  /// Kontakt qoldirish varaqasi.
  Future<void> _leaveContact() async {
    final sent = await showLeadSheet(context, _code);
    if (!mounted || !sent) return;
    leadSentToast(context);
  }

  List<Widget> _personBody() {
    final r = _record!;
    final style = TierStyle.of(r.tier);

    // PROTOTIP MAKETI (`.cover` → `.idhead` → `.pname` → `.acts4`):
    //
    // Markazga tekislangan ustun o'rniga — COVER RASMI va uning
    // ustiga chiqib turgan avatar, hamma matn CHAPDA. Sabab oddiy:
    // markazlashgan profil "anketa" bo'lib ko'rinadi, chapga
    // tekislangani esa o'qiladigan sahifa — ism, kasb, havola
    // birin-ketin tushadi va ko'z bitta chiziqdan yuradi.
    return [
      // COVER — 230 dp. Rasm bo'lmasa, tarif materialining yumshoq
      // gradienti: bo'sh kulrang maydon o'rniga profil baribir
      // "kiyingan" ko'rinadi.
      SizedBox(
        height: 230,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if ((r.bgUrl ?? '').isNotEmpty)
              NetImage(r.bgUrl, radius: 0)
            else
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: style.hasMaterial
                      ? style.surface
                      : LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [C.surfaceHigh, C.surface],
                        ),
                ),
              ),
            // Pastga qarab fonga singiydi — avatar va ism rasm
            // ustida emas, sahifaning o'zida turgandek bo'ladi.
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      C.bg.withValues(alpha: .25),
                      C.bg.withValues(alpha: 0),
                      C.bg,
                    ],
                    stops: const [0, .35, 1],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),

      // AVATAR VA TARIF — cover ustiga chiqadi (prototip: -58 dp).
      Transform.translate(
        offset: const Offset(0, -58),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StoryRing(
                    avatarUrl: r.avatarUrl,
                    name: r.name,
                    size: 96,
                    showLabel: false,
                    seen: _stories.isEmpty,
                    onTap: _stories.isEmpty
                        ? null
                        : () => push<void>(
                              context,
                              (_) => StoryViewerScreen(code: _code),
                            ),
                  ),
                  const Spacer(),
                  _TierBadge(tier: r.tier, label: style.label, code: r.code),
                ],
              ),
              const SizedBox(height: S.x12),
              Row(
                children: [
                  Flexible(child: Text(r.name, style: T.profileName)),
                  if (r.verified) ...[
                    const SizedBox(width: 6),
                    const VerifiedBadge(size: 17),
                  ],
                ],
              ),
              if (r.role.isNotEmpty || (r.city).isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  [r.role, r.city].where((v) => v.isNotEmpty).join(' · '),
                  style: T.body.copyWith(fontSize: 14, color: C.ink2),
                ),
              ],
              const SizedBox(height: 6),
              Text(
                'nfcstore.uz/${r.code.toLowerCase()}',
                style: T.link.copyWith(color: C.accent, fontSize: 12),
              ),

              // ALOQA — to'rtta dumaloq tugma (prototip: `.acts4`).
              const SizedBox(height: S.x16),
              ContactRow(
                phone: r.phone,
                telegram: r.tg,
                instagram: r.instagram,
                website: r.website,
                address: r.address,
              ),

              // STATISTIKA — bitta qatorda, raqam serif bilan
              // (prototip: `.stats`).
              const SizedBox(height: S.x16),
              _InlineStats(
                items: [
                  (value: som(r.views), label: tr('ko‘rish'), onTap: null),
                  (
                    value: som(_follow?.followers ?? 0),
                    label: tr('obunachi'),
                    onTap: () => push<void>(
                      context,
                      (_) => FollowListScreen(code: _code, title: tr('Obunachilar')),
                    ),
                  ),
                  (value: som(_posts.length), label: tr('post'), onTap: null),
                ],
              ),

              if (widget.entry == ProfileEntry.search && !_owned) ...[
                const SizedBox(height: S.x16),
                _Note(
                  tr('Kontaktni saqlash faqat NFC kartani tegizganda yoki QR '
                      'skanerlaganda ochiladi — shunda karta egasi '
                      'ulashishni tasdiqlagan bo‘ladi.'),
                ),
              ],

              // PROFIL MUSIQASI (prototip: "Yulduzlar ostida ·
              // Profil musiqasi · 1/3"). Faqat egasi qo'shiq
              // qo'ygan bo'lsa ko'rinadi.
              if (r.musicUrls.isNotEmpty) ...[
                const SizedBox(height: S.x16),
                MusicBar(urls: r.musicUrls, title: r.name),
              ],

              if (r.about.isNotEmpty) ...[
                const SizedBox(height: S.x20),
                Text(r.about, style: T.body),
              ],
            ],
          ),
        ),
      ),

      // Cover ustiga chiqqan blok tepadan 58 dp "o'g'irlagani" uchun
      // pastdagi kontent ham shuncha yuqoriga suriladi.
      Transform.translate(
        offset: const Offset(0, -58),
        child: Column(children: _postsSection()),
      ),
    ];
  }

  // ── BIZNES PROFIL ───────────────────────────────────────────

  /// Biznes profilidagi bo'limlar (prototip: Katalog · Galereya ·
  /// Lenta · Biz haqimizda).
  ///
  /// NIMA UCHUN TAB: biznesning katalogi, rasmlari, yangiliklari va
  /// ma'lumoti — TO'RT XIL savol. Bitta uzun ro'yxatda odam
  /// katalogni ko'rish uchun galereyani aylantirib o'tishi kerak
  /// edi. Bo'sh bo'lim UMUMAN ko'rsatilmaydi: bosilganda "hech narsa
  /// yo'q" chiqadigan tab — bekorga umid.
  List<Widget> _companyBody() {
    final c = _company!;

    final tabs = <({String key, String label})>[
      if (c.items.isNotEmpty) (key: 'catalog', label: tr('Katalog')),
      if (c.gallery.isNotEmpty) (key: 'gallery', label: tr('Galereya')),
      if (_posts.isNotEmpty || _loading) (key: 'feed', label: tr('Lenta')),
      (key: 'about', label: tr('Biz haqimizda')),
    ];
    final active = tabs.any((t) => t.key == _tab) ? _tab : tabs.first.key;

    return [
      _BusinessCinematicHeader(
        company: c,
        followers: _follow?.followers ?? c.followers,
        onFollowers: () => push<void>(context, (_) => FollowListScreen(
          code: _code, title: tr('Obunachilar'), isCompany: true,
        )),
        onMenu: _menu,
      ),

      const SizedBox(height: S.x20),
      _ProfileTabs(
        tabs: tabs,
        active: active,
        onSelect: (k) => setState(() => _tab = k),
      ),

      if (active == 'catalog') ..._catalogTab(c),
      if (active == 'gallery') ..._galleryTab(c),
      if (active == 'feed') ..._postsSection(),
      if (active == 'about') ..._aboutTab(c),
    ];
  }

  /// KATALOG — soha chiplari va mahsulot gridi.
  List<Widget> _catalogTab(Company c) {
    // Chiplar mahsulotlarning O'Z bo'limlaridan yig'iladi: qo'lda
    // yozilgan ro'yxat biznes bo'lim qo'shganda eskirib qolardi.
    final cats = <String>[];
    for (final p in c.items) {
      final n = p.categoryName.trim();
      if (n.isNotEmpty && !cats.contains(n)) cats.add(n);
    }

    final shown = _catalogCat.isEmpty
        ? c.items
        : c.items.where((p) => p.categoryName.trim() == _catalogCat).toList();

    return [
      if (cats.length > 1) ...[
        const SizedBox(height: S.x16),
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            itemCount: cats.length + 1,
            separatorBuilder: (_, __) => const SizedBox(width: S.x8),
            itemBuilder: (context, i) {
              if (i == 0) {
                return FilterChip(
                  tr('Asosiy'),
                  active: _catalogCat.isEmpty,
                  onTap: () => setState(() => _catalogCat = ''),
                );
              }
              final name = cats[i - 1];
              return FilterChip(
                name,
                active: _catalogCat == name,
                onTap: () => setState(() => _catalogCat = name),
              );
            },
          ),
        ),
      ],
      const SizedBox(height: S.x16),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        child: shown.isEmpty
            ? EmptyState(
                tr('Bu bo‘limda hozircha mahsulot yo‘q.'),
                title: tr('Bo‘sh'),
                icon: Ico.bag,
                compact: true,
              )
            : GridView.builder(
                physics: const NeverScrollableScrollPhysics(),
                shrinkWrap: true,
                padding: EdgeInsets.zero,
                itemCount: shown.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: S.x12,
                  mainAxisSpacing: S.x12,
                  childAspectRatio: .78,
                ),
                itemBuilder: (context, i) => ProductCard(
                  product: shown[i],
                  companyId: c.id,
                  companyName: c.name,
                ),
              ),
      ),
    ];
  }

  /// GALEREYA — uch ustunli grid (gorizontal lenta emas: rasmni
  /// qidirib surish o'rniga hammasi bir ko'rinishda tursin).
  List<Widget> _galleryTab(Company c) => [
        const SizedBox(height: S.x16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: GridView.builder(
            physics: const NeverScrollableScrollPhysics(),
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            itemCount: c.gallery.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 4,
              mainAxisSpacing: 4,
            ),
            itemBuilder: (context, i) => Press(
              onTap: () => push<void>(
                context,
                (_) => PhotoViewerScreen(
                  images: c.gallery,
                  initial: i,
                  title: c.name,
                ),
              ),
              minSize: 0,
              scale: .97,
              child: NetImage(c.gallery[i], radius: R.tile),
            ),
          ),
        ),
      ];

  /// BIZ HAQIMIZDA — tavsif, ish vaqti va manzil.
  List<Widget> _aboutTab(Company c) => [
        if (c.about.trim().isNotEmpty) ...[
          const SizedBox(height: S.x20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: Text(c.about, style: T.body),
          ),
        ],

        if (c.hours.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, S.x32, S.gutter, S.x12),
            child: SectionHeader(tr('Ish vaqti')),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: _Hours(hours: c.hours),
          ),
        ],

        if (c.address.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(S.gutter, S.x32, S.gutter, S.x12),
            child: SectionHeader(tr('Manzil')),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: Surface(
              padding: const EdgeInsets.all(S.x16),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: C.accent.withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(R.status),
                    ),
                    alignment: Alignment.center,
                    child: NIcon(Ico.pin, size: 19, color: C.accent),
                  ),
                  const SizedBox(width: S.x12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          c.address,
                          style: T.cardTitle.copyWith(fontSize: 14),
                        ),
                        if (c.city.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(c.city, style: T.caption.copyWith(fontSize: 12)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ];

  // ── POSTLAR ─────────────────────────────────────────────────

  List<Widget> _postsSection() {
    if (_loading && _posts.isEmpty) {
      return [
        const Padding(
          padding: EdgeInsets.fromLTRB(S.gutter, S.x32, S.gutter, 0),
          child: SkeletonGrid(count: 6),
        ),
      ];
    }
    if (_posts.isEmpty) {
      return [
        EmptyState(
          _owned
              ? tr('Birinchi postingiz shu yerda ko‘rinadi.')
              : tr('Bu profilda hali post yo‘q.'),
          title: tr('Post yo‘q'),
          icon: Ico.image,
          compact: true,
        ),
      ];
    }

    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x32, S.gutter, S.x12),
        child: SectionHeader(
          tr('Postlar'),
          trailing: Text(som(_posts.length), style: T.meta),
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        child: GridView.builder(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          itemCount: _posts.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            crossAxisSpacing: 3,
            mainAxisSpacing: 3,
          ),
          itemBuilder: (context, i) {
            final post = _posts[i];
            return Press(
              onTap: () async {
                await push<void>(
                  context,
                  (_) => PostDetailScreen(post: post, canDelete: _owned),
                );
                if (mounted) await _load();
              },
              minSize: 0,
              scale: .98,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  NetImage(
                    post.images.isEmpty ? null : post.images.first,
                    radius: 2,
                    slotIcon: Ico.image,
                  ),
                  if (post.likes > 0)
                    Positioned(
                      left: 5,
                      bottom: 5,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          NIcon(
                            Ico.heart,
                            size: 11,
                            color: C.accent,
                            filled: true,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            som(post.likes),
                            style: T.meta.copyWith(
                              fontSize: 9.5,
                              color: C.ink,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    ];
  }
}

// ─────────────────────────────────────────────────────────────
/// BIZNES PROFIL SARLAVHASI — prototip maketi.
///
/// Cover rasmi, uning ustiga chiqqan KVADRAT logotip (kompaniya
/// belgisi dumaloq emas — u brend, odam emas), o'ngda tasdiq
/// nishoni. Pastda nom, bir qatorlik meta (soha · reyting · shahar)
/// va ochiq/yopiq holati.
///
/// ILGARI BU YERDA "kinematik" qatlam turardi: to'q gradient,
/// rasm ustidagi oq matn va o'zaro ustma-ust tushgan bloklar.
/// Yorug' mavzuda u o'qilmas bo'lib qoldi — matn oq fonda oq
/// chiqardi. Prototipda esa cover RASM, matn esa uning OSTIDA.
class _BusinessCinematicHeader extends StatelessWidget {
  const _BusinessCinematicHeader({
    required this.company,
    required this.followers,
    required this.onFollowers,
    required this.onMenu,
  });

  final Company company;
  final int followers;
  final VoidCallback onFollowers;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final meta = [
      if (company.category.isNotEmpty) company.category,
      if (company.city.isNotEmpty) company.city,
      if (company.address.isNotEmpty) company.address,
    ].join(' · ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 230,
          child: Stack(
            fit: StackFit.expand,
            children: [
              NetImage(company.coverUrl ?? company.logoUrl, radius: 0),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        C.bg.withValues(alpha: .25),
                        C.bg.withValues(alpha: 0),
                        C.bg,
                      ],
                      stops: const [0, .4, 1],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Transform.translate(
          offset: const Offset(0, -46),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // KVADRAT LOGOTIP — kompaniya belgisi dumaloq
                    // emas (prototip): dumaloq ramka odamning
                    // avatariga tegishli, brend esa kvadratda.
                    Container(
                      width: 84,
                      height: 84,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(R.card),
                        border: Border.all(color: C.bg, width: 3),
                        boxShadow: C.e1,
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(R.card - 3),
                        child: Avatar(
                          url: company.logoUrl,
                          name: company.name,
                          size: 78,
                          square: true,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (company.verified)
                      StatusChip(
                        tr('Admin tasdiqlagan'),
                        tone: StatusTone.ok,
                      ),
                  ],
                ),
                const SizedBox(height: S.x12),
                Text(company.name, style: T.profileName),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    meta,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: T.body.copyWith(fontSize: 13.5, color: C.ink2),
                  ),
                ],
                const SizedBox(height: 6),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        'nfcstore.uz/c/${company.id.toLowerCase()}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: T.link.copyWith(color: C.accent, fontSize: 12),
                      ),
                    ),
                    if (company.hoursLabel.isNotEmpty) ...[
                      const SizedBox(width: S.x8),
                      Text(
                        '· ${company.hoursLabel}',
                        style: T.meta.copyWith(
                          color: (company.isOpen ?? false) ? C.ok : C.ink3,
                        ),
                      ),
                    ],
                  ],
                ),

                // ALOQA — dumaloq tugmalar qatori.
                const SizedBox(height: S.x16),
                ContactRow(
                  phone: company.phone,
                  telegram: company.tg,
                  instagram: company.instagram,
                  website: company.website,
                  address: company.address,
                ),

                const SizedBox(height: S.x16),
                _InlineStats(
                  items: [
                    (
                      value: som(company.itemCount),
                      label: tr('mahsulot'),
                      onTap: null,
                    ),
                    (value: som(company.views), label: tr('ko‘rish'), onTap: null),
                    (
                      value: som(followers),
                      label: tr('obunachi'),
                      onTap: onFollowers,
                    ),
                  ],
                ),

                // TAVSIF SARLAVHADA EMAS — "Biz haqimizda" tabida.
                //
                // Ilgari u shu yerda ham, tabda ham chiqib, bir
                // matn ikki marta ko'rinardi va tablargacha
                // bo'lgan yo'l uzayib ketardi.
              ],
            ),
          ),
        ),
      ],
    );
  }
}
class _EntryChip extends StatelessWidget {
  const _EntryChip({required this.entry, required this.owned});

  final ProfileEntry entry;
  final bool owned;

  @override
  Widget build(BuildContext context) {
    if (owned) {
      return Text(tr('SIZNING PROFILINGIZ'), style: T.meta.copyWith(
        letterSpacing: 1.4,
      ));
    }
    final tap = entry == ProfileEntry.tap;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: S.x12, vertical: 6),
      decoration: BoxDecoration(
        color: tap ? C.accent.withValues(alpha: .12) : null,
        borderRadius: BorderRadius.circular(R.status),
        border: Border.all(color: tap ? C.lineStrong : C.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          NIcon(
            tap ? Ico.nfc : Ico.search,
            size: 13,
            color: tap ? C.accent : C.ink3,
          ),
          const SizedBox(width: 6),
          Text(
            tap ? tr('NFC TEGIZISHDAN') : tr('QIDIRUVDAN'),
            style: T.meta.copyWith(
              fontSize: 10,
              letterSpacing: 1.3,
              color: tap ? C.accent : C.ink3,
            ),
          ),
        ],
      ),
    );
  }
}

/// Tarif belgisi — kod + material nomi.
/// BITTA QATORDAGI STATISTIKA (prototip: `.stats`).
///
/// Raqam serif va katta, yozuv kichik va kulrang — ko'z avval
/// raqamni ko'radi. Uchta alohida karta o'rniga bitta qator:
/// prototipda profil "hisobot" emas, tashrif qog'ozi.
class _InlineStats extends StatelessWidget {
  const _InlineStats({required this.items});

  final List<({String value, String label, VoidCallback? onTap})> items;

  @override
  Widget build(BuildContext context) => Wrap(
        // WRAP, ROW EMAS: uzun raqamlar (12 480 · 1 843 · 9) va
        // uzunroq tilda ("подписчиков") qator eniga sig'may
        // qolardi. Wrap ularni keyingi qatorga tushiradi — matn
        // qirqilmaydi.
        spacing: S.x20,
        runSpacing: S.x8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          for (final it in items)
            Press(
              onTap: it.onTap,
              minSize: 0,
              scale: .96,
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: it.value,
                      style: T.section.copyWith(fontSize: 19, color: C.ink),
                    ),
                    TextSpan(
                      text: ' ${it.label}',
                      style: T.caption.copyWith(fontSize: 12.5),
                    ),
                  ],
                ),
              ),
            ),
        ],
      );
}

class _TierBadge extends StatelessWidget {
  const _TierBadge({
    required this.tier,
    required this.label,
    required this.code,
  });

  final Tier tier;
  final String label;
  final String code;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(tier);
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 4, S.x12, 4),
      decoration: BoxDecoration(
        gradient: C.raisedSurface,
        borderRadius: BorderRadius.circular(R.chip),
        border: Border.all(
          color: style.hasMaterial
              ? style.base.withValues(alpha: .45)
              : C.line,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
            decoration: BoxDecoration(
              gradient: style.hasMaterial ? style.swatch : null,
              color: style.hasMaterial ? null : C.surfaceHigh,
              borderRadius: BorderRadius.circular(R.status - 2),
            ),
            child: Text(
              code.toUpperCase(),
              style: T.code(
                12,
                color: style.hasMaterial ? const Color(0xFF17110A) : C.ink2,
              ),
            ),
          ),
          const SizedBox(width: S.x8),
          Text(label, style: T.buttonSm.copyWith(color: C.ink2)),
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NIcon(Ico.info, size: 16, color: C.ink3),
            const SizedBox(width: S.x12),
            Expanded(
              child: Text(text, style: T.caption.copyWith(fontSize: 12.5)),
            ),
          ],
        ),
      );
}

/// Ish vaqti jadvali.
class _Hours extends StatelessWidget {
  const _Hours({required this.hours});

  final List<DayHours> hours;

  static List<String> get _days => [
        tr('Dushanba'),
        tr('Seshanba'),
        tr('Chorshanba'),
        tr('Payshanba'),
        tr('Juma'),
        tr('Shanba'),
        tr('Yakshanba'),
      ];

  @override
  Widget build(BuildContext context) {
    final names = _days;
    return RowGroup(
      children: [
        for (var i = 0; i < hours.length && i < names.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: S.x16,
              vertical: S.x12,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    names[i],
                    style: T.bodyStrong.copyWith(fontSize: 14),
                  ),
                ),
                Text(
                  hours[i].closed
                      ? tr('Yopiq')
                      : '${hours[i].open} — ${hours[i].close}',
                  style: T.amount.copyWith(
                    fontSize: 13,
                    color: hours[i].closed ? C.ink3 : C.ink,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// Profil skeleti — haqiqiy tartibning o'lchamlarida.
class _ProfileSkeleton extends StatelessWidget {
  const _ProfileSkeleton();

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.profile,
        child: SafeArea(
          child: Column(
            children: [
              const TopBar(),
              const SizedBox(height: S.x8),
              const Skeleton(height: 104, circle: true),
              const SizedBox(height: S.x20),
              const Skeleton(width: 180, height: 24, radius: 8),
              const SizedBox(height: S.x12),
              const Skeleton(width: 120, height: 14, radius: 6),
              const SizedBox(height: S.x24),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: S.gutter),
                child: Row(
                  children: [
                    Expanded(child: Skeleton(height: 66, radius: R.tile)),
                    SizedBox(width: S.x8),
                    Expanded(child: Skeleton(height: 66, radius: R.tile)),
                    SizedBox(width: S.x8),
                    Expanded(child: Skeleton(height: 66, radius: R.tile)),
                  ],
                ),
              ),
              const SizedBox(height: S.x24),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: S.gutter),
                child: SkeletonGrid(count: 6),
              ),
            ],
          ),
        ),
      );
}

/// PROFIL BO'LIMLARI — Katalog · Galereya · Lenta · Biz haqimizda.
///
/// Material `TabBar` EMAS: u o'z mavzusi, o'z indikatori va o'z
/// balandligi bilan keladi va bu dizaynda begona ko'rinadi. Bu
/// yerda faol bo'lim ostida ingichka urg'u chizig'i turadi —
/// prototipdagidek.
class _ProfileTabs extends StatelessWidget {
  const _ProfileTabs({
    required this.tabs,
    required this.active,
    required this.onSelect,
  });

  final List<({String key, String label})> tabs;
  final String active;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 44,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          itemCount: tabs.length,
          separatorBuilder: (_, __) => const SizedBox(width: S.x20),
          itemBuilder: (context, i) {
            final t = tabs[i];
            final on = t.key == active;
            return Press(
              onTap: () => onSelect(t.key),
              minSize: 0,
              scale: .97,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    t.label,
                    style: T.cardTitle.copyWith(
                      fontSize: 15,
                      color: on ? C.accent : C.ink2,
                      fontWeight: on ? FontWeight.w700 : FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  AnimatedContainer(
                    duration: M.fade,
                    height: 2.5,
                    width: on ? 26 : 0,
                    decoration: BoxDecoration(
                      color: C.accent,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      );
}
