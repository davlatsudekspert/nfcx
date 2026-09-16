import 'dart:convert' show utf8;

import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';
import 'package:share_plus/share_plus.dart' show Share, XFile;

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/logo.dart';
import '../../design/components/media.dart';
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
import '../../design/refresh.dart';
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
            TopBar(
              center: _EntryChip(entry: widget.entry, owned: _owned),
              trailing: RoundButton(Ico.more, onTap: _menu),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => pullRefresh(_load),
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
                    ? Row(
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
                              profileUrl(context, _code, company: _isCompany),
                            ),
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

  List<Widget> _personBody() {
    final r = _record!;
    final style = TierStyle.of(r.tier);

    return [
      const SizedBox(height: S.x8),

      // AVATAR — story bo'lsa halqa bilan.
      Center(
        child: StoryRing(
          avatarUrl: r.avatarUrl,
          name: r.name,
          size: 104,
          showLabel: false,
          seen: _stories.isEmpty,
          onTap: _stories.isEmpty
              ? null
              : () => push<void>(
                    context,
                    (_) => StoryViewerScreen(code: _code),
                  ),
        ),
      ),
      const SizedBox(height: S.x20),

      Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: Text(
                    r.name,
                    textAlign: TextAlign.center,
                    style: T.profileName,
                  ),
                ),
                if (r.verified) ...[
                  const SizedBox(width: 6),
                  const VerifiedBadge(size: 17),
                ],
              ],
            ),
            if (r.role.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                r.role,
                textAlign: TextAlign.center,
                style: T.caption.copyWith(color: C.ink2),
              ),
            ],
            const SizedBox(height: S.x12),

            // TARIF — material nomi bilan.
            _TierBadge(tier: r.tier, label: style.label, code: r.code),

            const SizedBox(height: S.x20),
            StatRow(
              tiles: [
                StatTile(value: som(r.views), label: tr('Ko‘rish')),
                StatTile(
                  value: som(_posts.length),
                  label: tr('Post'),
                ),
                StatTile(
                  value: som(_follow?.followers ?? 0),
                  label: tr('Obunachi'),
                  onTap: () => push<void>(
                    context,
                    (_) => FollowListScreen(
                      code: _code,
                      title: tr('Obunachilar'),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: S.x20),
            ContactRow(
              phone: r.phone,
              telegram: r.tg,
              instagram: r.instagram,
              website: r.website,
              address: r.address,
            ),

            if (widget.entry == ProfileEntry.search && !_owned) ...[
              const SizedBox(height: S.x16),
              _Note(
                tr('Kontaktni saqlash faqat NFC kartani tegizganda yoki QR '
                    'skanerlaganda ochiladi — shunda karta egasi '
                    'ulashishni tasdiqlagan bo‘ladi.'),
              ),
            ],

            if (r.about.isNotEmpty) ...[
              const SizedBox(height: S.x24),
              Align(
                alignment: Alignment.centerLeft,
                child: Eyebrow(tr('Haqida')),
              ),
              const SizedBox(height: S.x8),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(r.about, style: T.body),
              ),
            ],
          ],
        ),
      ),

      ..._postsSection(),
    ];
  }

  // ── BIZNES PROFIL ───────────────────────────────────────────

  List<Widget> _companyBody() {
    final c = _company!;
    final cover = (c.coverUrl ?? '').isNotEmpty
        ? c.coverUrl!
        : (c.gallery.isNotEmpty ? c.gallery.first : '');

    return [
      // MUQOVA — SAYTDAGI BIZNES PROFILDAGIDEK.
      //
      // Egasi: "biznes profillar premium ko'rinishi kerak".
      // Saytdagi `/c/:id` bilan solishtirganda eng katta farq shu
      // edi: u yerda tepada katta muqova turadi va pastga qarab
      // to'liq so'nadi, ilovada esa umuman chizilmasdi —
      // `coverUrl` modelda BOR edi, lekin hech qayerda
      // ishlatilmagan.
      //
      // MUQOVA HAR DOIM BO'LADI. Saytda ham shunday: rasm
      // yuklanmagan bo'lsa `fallbackCover` chiziladi, ya'ni
      // sarlavha hech qachon "yalang'och" turmaydi. Ilovaga tayyor
      // surat solinmadi (u har biznesga yolg'on muhit yasardi va
      // paketni og'irlashtirardi) — o'rniga brend gradiyenti
      // chiziladi.
      //
      // Rasm ATAYLAB so'nadi (`ShaderMask`): tagida matn turadi va
      // to'q rasm ustida oq yozuv o'qilmay qolardi. Saytda ham
      // xuddi shu usul — `mask-image: linear-gradient(...)`.
      SizedBox(
        height: 190,
        width: double.infinity,
        child: ShaderMask(
          shaderCallback: (r) => const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xE6000000),
              Color(0x8C000000),
              Color(0x2E000000),
              Color(0x00000000),
            ],
            stops: [0, .38, .68, 1],
          ).createShader(r),
          blendMode: BlendMode.dstIn,
          // MUQOVA MANBAI — UCH BOSQICH. Saytdagi tartib bilan
          // bir xil: o'z muqovasi, bo'lmasa galereyaning birinchi
          // surati (saytda ham galereya `coverUrl` ga qaytadi),
          // ikkalasi ham bo'lmasa brend gradiyenti.
          child: cover.isNotEmpty
              ? NetImage(cover, fit: BoxFit.cover)
              : const _BrandCover(),
        ),
      ),

      Padding(
        padding: const EdgeInsets.symmetric(horizontal: S.gutter),
        // MARKAZGA — SAYTDAGI BIZNES PROFIL KABI.
        //
        // Egasi saytdagi `/c/:id` sahifasining suratini yubordi:
        // u yerda logotip, nom, tavsif va belgilar MARKAZDA
        // turadi. Ilovada esa hammasi chapga tekislangan edi va
        // ikkisi bir mahsulotning ikki xil yuzi bo'lib
        // ko'rinardi.
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // LOGOTIP KVADRAT — shaxsiy profildagi dumaloq
            // avatardan ATAYLAB farq qiladi.
            //
            // Muqova bo'lsa logotip unga QISMAN CHIQIB turadi va
            // atrofida oltin hoshiya bo'ladi — saytdagi kabi.
            // Bu ikki qatlamni bog'laydi: aks holda rasm va
            // kontent bir-biriga yopishmagan ikki blok bo'lib
            // ko'rinardi.
            Transform.translate(
              offset: const Offset(0, -34),
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(R.tile + 4),
                  border: Border.all(
                    color: C.accent.withValues(alpha: .5),
                    width: 1.2,
                  ),
                  color: C.bg,
                ),
                child: Avatar(
                  url: c.logoUrl,
                  name: c.name,
                  size: 84,
                  square: true,
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Flexible(
                  child: Text(
                    c.name,
                    textAlign: TextAlign.center,
                    style: T.profileName,
                  ),
                ),
                if (c.verified) ...[
                  const SizedBox(width: 6),
                  const VerifiedBadge(size: 17),
                ],
              ],
            ),
            const SizedBox(height: 4),
            Text(
              [
                if (c.about.isNotEmpty) c.about.split('\n').first,
                if (c.city.isNotEmpty) c.city,
              ].take(2).join(' · '),
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: T.caption.copyWith(color: C.ink2),
            ),

            const SizedBox(height: S.x12),
            Wrap(
              spacing: S.x8,
              runSpacing: S.x8,
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (c.isOpen != null)
                  StatusChip(
                    c.isOpen!
                        ? (c.hoursLabel.isEmpty
                            ? tr('Hozir ochiq')
                            : trf('Hozir ochiq · {time}', {
                                'time': c.hoursLabel,
                              }))
                        : tr('Hozir yopiq'),
                    tone: c.isOpen! ? StatusTone.ok : StatusTone.neutral,
                  ),
                if (c.tier.isNotEmpty)
                  _TierBadge(
                    tier: TierStyle.parse(c.tier),
                    label: TierStyle.of(TierStyle.parse(c.tier)).label,
                    code: c.id,
                  ),
              ],
            ),

            const SizedBox(height: S.x20),
            StatRow(
              tiles: [
                StatTile(
                  value: som(c.itemCount),
                  label: tr('Mahsulot'),
                ),
                StatTile(value: som(c.views), label: tr('Ko‘rish')),
                StatTile(
                  value: som(_follow?.followers ?? c.followers),
                  label: tr('Obunachi'),
                  onTap: () => push<void>(
                    context,
                    (_) => FollowListScreen(
                      code: _code,
                      title: tr('Obunachilar'),
                      isCompany: true,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: S.x20),
            ContactRow(
              phone: c.phone,
              telegram: c.tg,
              instagram: c.instagram,
              website: c.website,
              address: c.address,
            ),
          ],
        ),
      ),

      // KATALOG — biznes profilida ustun bo'lim.
      if (c.items.isNotEmpty) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            S.gutter,
            S.x32,
            S.gutter,
            S.x12,
          ),
          child: SectionHeader(
            tr('Katalog'),
            trailing: Text(
              trf('{n} mahsulot', {'n': '${c.items.length}'}),
              style: T.meta,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: GridView.builder(
            physics: const NeverScrollableScrollPhysics(),
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            itemCount: c.items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: S.x12,
              mainAxisSpacing: S.x12,
              childAspectRatio: .78,
            ),
            itemBuilder: (context, i) => ProductCard(
              product: c.items[i],
              companyId: c.id,
              companyName: c.name,
            ),
          ),
        ),
      ],

      // ISH VAQTI.
      if (c.hours.isNotEmpty) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            S.gutter,
            S.x32,
            S.gutter,
            S.x12,
          ),
          child: SectionHeader(tr('Ish vaqti')),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: _Hours(hours: c.hours),
        ),
      ],

      // MANZIL.
      if (c.address.isNotEmpty) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            S.gutter,
            S.x32,
            S.gutter,
            S.x12,
          ),
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
                      Text(c.address, style: T.cardTitle.copyWith(
                        fontSize: 14,
                      )),
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

      // GALEREYA.
      if (c.gallery.isNotEmpty) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            S.gutter,
            S.x32,
            S.gutter,
            S.x12,
          ),
          child: SectionHeader(tr('Galereya')),
        ),
        SizedBox(
          height: 120,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: S.gutter),
            itemCount: c.gallery.length,
            separatorBuilder: (_, __) => const SizedBox(width: S.x8),
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
              child: SizedBox(
                width: 120,
                child: NetImage(c.gallery[i], radius: R.tile),
              ),
            ),
          ),
        ),
      ],

      ..._postsSection(),
    ];
  }

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

/// Qanday kirilgani — tepadagi kichik chip.
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

/// MUQOVA RASMI YO'Q BO'LGANDA — BREND GRADIYENTI.
///
/// Saytda bunday holatda tayyor surat (`fallbackCover`)
/// chiziladi. Ilovaga surat solinmadi: u har bir biznesga
/// begona muhit yasardi (qurilish suratlari barberga ham
/// tushardi) va paketni og'irlashtirardi.
///
/// O'rniga brendning o'z yorug'ligi: issiq gradiyent, burchakdan
/// nur va xira medalyon. Ustidan baribir so'nish niqobi tushadi,
/// shuning uchun bu qatlam ORQA FON bo'lib qoladi va matnni
/// hech qachon bosmaydi.
class _BrandCover extends StatelessWidget {
  const _BrandCover();

  @override
  Widget build(BuildContext context) => DecoratedBox(
        // MUQOVA PALITRADAN OLINADI. Ilgari bu yerda eski to'q
        // jigarrang qiymatlar qotirilgan edi: yorug' palitrada
        // ekranning tepasida begona quyuq blok bo'lib turardi.
        // Endi u yuza ranglaridan quriladi va har palitrada
        // "brend foni" bo'lib ko'rinadi.
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              C.surfaceHigh,
              Color.lerp(C.surfaceHigh, C.accent, C.isLight ? .10 : .06)!,
              C.surface,
            ],
            stops: const [0, .55, 1],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(.5, -.7),
                  radius: 1.0,
                  colors: [
                    C.accent.withValues(alpha: .3),
                    C.accent.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
            Positioned(
              right: -14,
              top: -6,
              child: Opacity(
                opacity: .18,
                child: BrandMark(size: 150, ring: false),
              ),
            ),
          ],
        ),
      );
}
