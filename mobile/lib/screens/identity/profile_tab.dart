import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/chart.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/media.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/share.dart';
import '../content/compose.dart';
import '../nfc/id_catalog.dart';
import '../settings/settings_screen.dart';
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
  FollowStats? _follow;
  List<Post> _posts = const [];
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

    if (!active.isBusiness) {
      try {
        analytics = await state.repo.analytics(active.code, days: 7);
      } catch (_) {}
    }
    try {
      follow = await state.repo.followStats(active.code);
    } catch (_) {}
    try {
      posts = active.isBusiness
          ? const []
          : await state.repo.recordPosts(active.code);
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _analytics = analytics;
      _follow = follow;
      _posts = posts;
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
      // IKKI XIL BO'SHLIKNI ARALASHTIRMASLIK KERAK.
      //
      // `active == null` ikki butunlay boshqa holatda yuz beradi:
      //
      //   1. Odamning haqiqatan profili yo'q — yangi foydalanuvchi.
      //   2. Sessiya tekshirilmay qolgan — token bor, lekin ilova
      //      ochilganda server javob bermagan va ro'yxatlar bo'sh
      //      qolgan.
      //
      // Ilgari ikkalasiga ham "Hali profil yo'q" chiqardi. Ikkinchi
      // holatda bu YOLG'ON edi va undan chiqish yo'li ham yo'q edi:
      // odamning profili, biznesi va buyurtmalari bor, lekin ilova
      // ularni ko'rmasdi va "sizda hech narsa yo'q" deb turardi.
      // Egasi buni shunday xabar qildi: "profilda hech narsa yo'q,
      // holbuki mening boshqa biznes va profillarim bor".
      if (state.sessionUnverified) {
        return ScreenBackdrop(
          aura: Aura.profile,
          child: SafeArea(
            child: Center(
              child: EmptyState(
                tr('Ilova ochilganda serverga ulanib bo‘lmadi, '
                    'shuning uchun profillaringiz yuklanmadi.'),
                title: tr('Sessiya tekshirilmadi'),
                icon: Ico.refresh,
                actionLabel: tr('Qayta urinish'),
                onAction: () => AppScope.read(context).retrySession(),
              ),
            ),
          ),
        );
      }

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

    final views = (_analytics?['totalViews'] as num?)?.round() ?? 0;
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
              // SARLAVHA — avatar, ism, manzil, menyu.
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x12,
                  S.gutter,
                  0,
                ),
                child: Row(
                  children: [
                    // AVATAR — SHU EKRANNING BOSH ELEMENTI.
                    //
                    // Ilgari u 56 px edi va yonidagi ism bilan bir
                    // xil og'irlikda turardi, ya'ni ko'z hech
                    // qayerda to'xtamasdi. Egasi: "avatarni chiroyli
                    // ko'rinishga keltir, kattaroq qilib".
                    //
                    // Endi 76 px va atrofida nozik oltin halqa —
                    // xuddi jismoniy kartaning gardishi kabi.
                    // Halqa `Avatar` ning O'ZIGA qo'shilmadi: u
                    // ro'yxatlarda va izohlarda ham ishlatiladi,
                    // u yerda halqa ortiqcha shovqin bo'lardi.
                    Container(
                      padding: const EdgeInsets.all(2.5),
                      decoration: BoxDecoration(
                        shape: active.isBusiness
                            ? BoxShape.rectangle
                            : BoxShape.circle,
                        borderRadius: active.isBusiness
                            ? BorderRadius.circular(R.tile + 3)
                            : null,
                        border: Border.all(
                          color: C.accent.withValues(alpha: .55),
                          width: 1.2,
                        ),
                      ),
                      child: Avatar(
                        url: active.avatarUrl,
                        name: active.name,
                        size: 76,
                        square: active.isBusiness,
                      ),
                    ),
                    const SizedBox(width: S.x16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  active.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: T.h2,
                                ),
                              ),
                              if (active.verified) ...[
                                const SizedBox(width: 5),
                                const VerifiedBadge(size: 15),
                              ],
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            profileHandle(
                              context,
                              active.code,
                              company: active.isBusiness,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: T.link,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: S.x8),
                    RoundButton(
                      Ico.more,
                      onTap: () => _menu(active),
                    ),
                  ],
                ),
              ),

              // ID ALMASHTIRGICH.
              const SizedBox(height: S.x20),
              // BIZNES PROFILLAR HAM SHU QATORDA.
              //
              // Ilgari bu yerga faqat `state.cards` berilardi, ya'ni
              // shaxsiy ID'lar. Biznes profillar (`state.companies`)
              // ro'yxatga UMUMAN tushmasdi va ularga o'tishning
              // ko'rinadigan yo'li yo'q edi — egasi buni "mening
              // biznes profillarim ko'rinmayapti" deb xabar qildi.
              //
              // Tartib ataylab shunday: avval shaxsiy ID'lar, keyin
              // biznes. Ikkalasi bitta qatorda, chunki bu "faol
              // shaxsni tanlash" — odam uchun ular bir xil narsa.
              _IdStrip(
                items: [
                  for (final r in state.cards) Identity.personal(r),
                  for (final c in state.companies) Identity.business(c),
                ],
                activeCode: active.code,
                onSelect: state.switchIdentity,
                onAdd: () =>
                    push<void>(context, (_) => const IdCatalogScreen()),
              ),

              // STATISTIKA.
              const SizedBox(height: S.x24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: _loading && _analytics == null && _follow == null
                    ? const Skeleton(height: 72, radius: R.tile)
                    : StatRow(
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
              ),

              // 7 KUNLIK GRAFIK.
              if (series != null && series.length > 1) ...[
                const SizedBox(height: S.x12),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  // GRAFIK ATAYLAB KICHIK.
                  //
                  // Ilgari u ekranning eng katta bloki edi va
                  // profilning o'zidan ko'proq joy egallardi. Egasi:
                  // "ko'rishlar 7 kunini kichikroq qil". To'g'ri
                  // e'tiroz: bu tabning asosiy vazifasi shaxsni
                  // ko'rsatish, statistika esa ikkinchi darajali —
                  // batafsili baribir bosilganda alohida ekranda
                  // ochiladi.
                  child: Surface(
                    padding: const EdgeInsets.all(S.x12),
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
                        Row(
                          children: [
                            Text(
                              tr('Ko‘rishlar · 7 kun'),
                              style: T.cardTitle.copyWith(fontSize: 12.5),
                            ),
                            const Spacer(),
                            _Delta(series: series),
                          ],
                        ),
                        const SizedBox(height: S.x8),
                        BarChart(
                          values: series,
                          labels: [tr('Dush'), tr('Yak')],
                          height: 54,
                        ),
                      ],
                    ),
                  ),
                ),
              ],

              // KONTENT QO'SHISH — IKKI ALOHIDA TUGMA.
              const SizedBox(height: S.x24),
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
            label: tr('Profilni tahrirlash'),
            icon: Ico.edit,
            onTap: () => Navigator.of(context).pop('edit'),
          ),
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
        if (active.record != null) {
          final saved = await push<bool>(
            context,
            (_) => EditProfileScreen(record: active.record!),
          );
          if (saved == true && mounted) await _load();
        }
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

/// SHAXS ALMASHTIRGICH — shaxsiy ID va biznes profillar bitta
/// qatorda, faol bo'lgani oltin halqa bilan.
///
/// Ilgari bu yerga faqat shaxsiy ID'lar (`Record`) berilardi va
/// biznes profillar ro'yxatga umuman tushmasdi. Endi qator
/// `Identity` bilan ishlaydi — u ikkalasini ham bir xil ko'rsata
/// oladi, ya'ni yangi tur qo'shilsa ham bu widget o'zgarmaydi.
class _IdStrip extends StatelessWidget {
  const _IdStrip({
    required this.items,
    required this.activeCode,
    required this.onSelect,
    required this.onAdd,
  });

  final List<Identity> items;
  final String activeCode;
  final ValueChanged<Identity> onSelect;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 44,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          itemCount: items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(width: S.x8),
          itemBuilder: (context, i) {
            if (i == items.length) {
              return Press(
                onTap: onAdd,
                minSize: 0,
                scale: .95,
                child: Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: S.x16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(R.chip),
                    border: Border.all(color: C.line),
                  ),
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      NIcon(Ico.plus, size: 14, color: C.accent),
                      const SizedBox(width: 6),
                      Text(
                        tr('ID qo‘shish'),
                        style: T.buttonSm.copyWith(color: C.ink2),
                      ),
                    ],
                  ),
                ),
              );
            }

            final item = items[i];
            final active = item.code == activeCode;
            return Press(
              onTap: active ? null : () => onSelect(item),
              minSize: 0,
              scale: .95,
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: S.x12),
                decoration: BoxDecoration(
                  gradient: active ? C.raisedSurface : null,
                  borderRadius: BorderRadius.circular(R.chip),
                  border: Border.all(
                    color: active ? C.accent.withValues(alpha: .7) : C.line,
                    width: active ? 1.4 : 1,
                  ),
                ),
                alignment: Alignment.center,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Biznesda tarif nuqtasi yo'q — uning o'rniga
                    // belgi turadi, aks holda ikki tur bir xil
                    // ko'rinib, qaysi biri kompaniya ekani
                    // bilinmasdi.
                    if (item.isBusiness)
                      NIcon(Ico.building, size: 12, color: C.accent)
                    else
                      TierDot(item.record!.tier, size: 12),
                    const SizedBox(width: 7),
                    Text(
                      item.isBusiness ? item.name : item.code,
                      style: T.code(
                        13,
                        color: active ? C.ink : C.ink2,
                      ),
                    ),
                  ],
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
