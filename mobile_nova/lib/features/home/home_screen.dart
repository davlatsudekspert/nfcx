import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/utils/sharing.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nfc_orb.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../nfc/qr_sheet.dart';
import 'widgets/avatar.dart';
import 'widgets/identity_card.dart';
import 'widgets/mode_switch.dart';

/// Faol NFC ID ning story'lari.
final homeStoriesProvider =
    FutureProvider.autoDispose<List<StoryItem>>((ref) async {
  final id = ref.watch(activeIdProvider);
  if (id == null) return const [];
  final res = await ref.watch(socialRepositoryProvider).storiesOf(id.code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Lentaning boshidagi postlar.
final homeFeedProvider = FutureProvider.autoDispose<List<Post>>((ref) async {
  final res = await ref.watch(socialRepositoryProvider).feed();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Joriy rejimga mos NFC ID.
///
/// Biznes rejimida biznes ID'si, shaxsiyda shaxsiysi tanlanadi; mos
/// keladigani bo'lmasa asosiy ID qaytadi.
final activeIdProvider = Provider<NfcId?>((ref) {
  final ids = ref.watch(myIdsProvider);
  if (ids.isEmpty) return null;
  final mode = ref.watch(modeProvider);
  final want =
      mode == AppMode.business ? NfcIdKind.business : NfcIdKind.personal;
  final match = ids.where((e) => e.kind == want);
  if (match.isNotEmpty) {
    return match.firstWhere((e) => e.primary, orElse: () => match.first);
  }
  return ids.firstWhere((e) => e.primary, orElse: () => ids.first);
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final mode = ref.watch(modeProvider);
    final id = ref.watch(activeIdProvider);

    if (user == null) return const SizedBox.shrink();

    return NovaScaffold(
      body: RefreshIndicator(
        color: t.accent2,
        backgroundColor: t.surfaceSolid,
        onRefresh: () async {
          await ref.read(sessionProvider.notifier).refresh();
          ref.invalidate(homeStoriesProvider);
          ref.invalidate(homeFeedProvider);
        },
        child: NovaScroll(
          padding: const EdgeInsets.only(bottom: 120),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(Gap.screenX, Gap.sm, Gap.screenX, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_greeting(l), style: Theme.of(context).textTheme.bodySmall),
                        Text(
                          user.displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ],
                    ),
                  ),
                  NovaIconButton(
                    icon: Icons.notifications_none_rounded,
                    tooltip: l.activityTitle,
                    onPressed: () => context.push(Routes.activity),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.settings_outlined,
                    tooltip: l.settings,
                    onPressed: () => context.push(Routes.settings),
                  ),
                ],
              ),
            ),
            const SizedBox(height: Gap.lg),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: ModeSwitch(
                mode: mode,
                onChanged: (m) => ref.read(modeProvider.notifier).set(m),
              ),
            ),
            const SizedBox(height: Gap.xl),
            if (id != null)
              _IdentityHero(
                user: user,
                id: id,
                onTap: () => context.push(Routes.nfcScan),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: id == null
                  ? _NoIdCard(onShop: () => context.push(Routes.shop))
                  : IdentityCard(
                      user: user,
                      id: id,
                      mode: mode,
                      onTap: () => context.push(Routes.nfcId(id.code)),
                      onQr: () => showQrSheet(context, id),
                      onShare: () => shareLink(id.publicUrl(kApiBase)),
                    ),
            ),
            const SizedBox(height: Gap.xxl),
            _QuickActions(mode: mode),
            _StoriesRow(user: user),
            SectionHeader(
              title: l.homePosts,
              action: l.actionSeeAll,
              onAction: () => context.go(Routes.discover),
            ),
            const _FeedPreview(),
            SectionHeader(title: l.homeActivity, action: l.actionSeeAll,
                onAction: () => context.push(Routes.activity)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: _ActivityPreview(id: id),
            ),
          ],
        ),
      ),
    );
  }

  String _greeting(L l) {
    final h = DateTime.now().hour;
    if (h < 12) return l.homeGreetingMorning;
    if (h < 18) return l.homeGreetingDay;
    return l.homeGreetingEvening;
  }
}

/// Home'ning IDENTITY OBYEKTI — markazlashgan NFC orb.
///
/// Concept B'da Home dashboard emas: uning markazida NFC orb turadi
/// va ism, rol, NFC ID undan pastda ierarxiya hosil qiladi. Shu
/// tartibda ekran "boshqaruv paneli" emas, "raqamli shaxs" bo'lib
/// o'qiladi.
///
/// Orb markazida FAQAT belgi — plastina yo'q, shakl yaxlit qoladi.
class _IdentityHero extends StatelessWidget {
  const _IdentityHero({required this.user, required this.id, this.onTap});

  final User user;
  final NfcId id;

  /// Tegilganda skanerlash ekrani ochiladi — orb ayni shu amalning
  /// jismoniy ko'rinishi.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final width = MediaQuery.sizeOf(context).width;

    // 360 da ~208, 390 da ~226, 430 da ~249 — ekranni egallab
    // ketmaydi, lekin baribir ekranning eng katta obyekti.
    final orb = (width * .58).clamp(200.0, 260.0);

    final title = id.name.isNotEmpty ? id.name : user.displayName;
    final subtitle = id.role;

    return Column(
      children: [
        NfcOrb(
          size: orb,
          onTap: onTap,
          child: Icon(
            Icons.nfc_rounded,
            size: orb * .30,
            color: t.onAccent,
          ),
        ),
        const SizedBox(height: Gap.lg),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.xxl),
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppType.displayStyle(color: t.text1, size: 27),
          ),
        ),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.xxl),
            child: Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
        // NFC ID bu yerda TAKRORLANMAYDI: u darhol pastdagi kartada,
        // katta monospace bilan turadi va ierarxiyani davom ettiradi
        // (orb -> ism -> rol -> kod). Ikki joyda ko'rsatilsa, u
        // ierarxiya emas, takror bo'lardi.
        const SizedBox(height: Gap.lg),
      ],
    );
  }
}

/// NFC ID hali yo'q — do'konga yo'naltiruvchi holat.
class _NoIdCard extends StatelessWidget {
  const _NoIdCard({required this.onShop});
  final VoidCallback onShop;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return FloatingSurface(
      borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.nfc_rounded, size: 30, color: t.accent2),
          const SizedBox(height: Gap.md),
          Text(l.homeNoId, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(l.homeNoIdHint, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: Gap.xl),
          NovaButton(label: l.homeShop, onPressed: onShop, icon: Icons.storefront_rounded),
        ],
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.mode});
  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    // Biznes rejimida tezkor amallar BOSHQACHA — bu rejim almashuvi
    // shunchaki rang o'zgarishi emasligining amaliy isboti.
    final actions = mode == AppMode.business
        ? [
            (Icons.dashboard_rounded, l.bizDashboard, Routes.businessDashboard, t.accentB),
            (Icons.inventory_2_rounded, l.bizCatalog, Routes.businessCatalog, t.accentC),
            (Icons.insights_rounded, l.bizAnalytics, Routes.businessAnalytics, t.accentD),
            (Icons.storefront_rounded, l.bizStorefront, Routes.business, t.accent1),
          ]
        : [
            (Icons.nfc_rounded, l.nfcScanShort, Routes.nfcScan, t.accent1),
            (Icons.badge_rounded, l.nfcMyIds, Routes.nfcIds, t.accentB),
            (Icons.add_circle_outline_rounded, l.postCreate, Routes.postCreate, t.accentC),
            (Icons.storefront_rounded, l.homeShop, Routes.shop, t.accentD),
          ];

    return SizedBox(
      height: 98,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        itemCount: actions.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
        itemBuilder: (context, i) {
          final (icon, label, route, tone) = actions[i];
          return PressableScale(
            onTap: () => context.push(route),
            child: Container(
              // 104px — uch tilning eng uzun yorlig'i ("Сканировать")
              // ikki qatorga kesilmasdan sig'adigan kenglik.
              width: 104,
              padding: const EdgeInsets.all(Gap.md),
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: R.gentle,
                border: Border.all(color: t.border2),
                boxShadow: t.shadowTiny,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: tone.withValues(alpha: .22),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, size: 19, color: t.isDark ? tone : t.text1),
                  ),
                  const SizedBox(height: Gap.sm),
                  Text(
                    label,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Manrope',
                      fontSize: 10,
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                      color: t.text2,
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
}

class _StoriesRow extends ConsumerWidget {
  const _StoriesRow({required this.user});
  final User user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final stories = ref.watch(homeStoriesProvider);
    final id = ref.watch(activeIdProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: l.homeStories),
        SizedBox(
          height: 92,
          child: stories.when(
            loading: () => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              itemCount: 5,
              separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
              itemBuilder: (_, __) => const Skeleton(height: 62, circle: true),
            ),
            error: (_, __) => const SizedBox.shrink(),
            data: (items) => ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              itemCount: items.length + 1,
              separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
              itemBuilder: (context, i) {
                if (i == 0) {
                  return _StoryBubble(
                    label: l.homeYourStory,
                    avatarUrl: user.avatarUrl,
                    initials: user.initials,
                    add: true,
                    onTap: () => context.push(Routes.storyCreate),
                  );
                }
                final s = items[i - 1];
                return _StoryBubble(
                  label: s.authorName.isEmpty ? (id?.name ?? '') : s.authorName,
                  avatarUrl: s.authorAvatar.isEmpty ? s.mediaUrl : s.authorAvatar,
                  initials: user.initials,
                  seen: s.seen,
                  onTap: () => context.push(Routes.story(s.code.isEmpty ? (id?.code ?? '') : s.code)),
                );
              },
            ),
          ),
        ),
        if (stories.hasError) const SizedBox(height: Gap.sm),
      ],
    );
  }
}

class _StoryBubble extends StatelessWidget {
  const _StoryBubble({
    required this.label,
    required this.avatarUrl,
    required this.initials,
    this.add = false,
    this.seen = false,
    this.onTap,
  });

  final String label;
  final String avatarUrl;
  final String initials;
  final bool add;
  final bool seen;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return PressableScale(
      onTap: onTap,
      child: SizedBox(
        width: 66,
        child: Column(
          children: [
            Stack(
              children: [
                Avatar(
                  url: avatarUrl,
                  initials: initials,
                  size: 62,
                  ringColor: seen ? t.border2 : null,
                ),
                if (add)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 21,
                      height: 21,
                      decoration: BoxDecoration(
                        gradient: t.accentGradient,
                        shape: BoxShape.circle,
                        border: Border.all(color: t.bg1, width: 2),
                      ),
                      child: const Icon(Icons.add_rounded, size: 12, color: kOnAccent),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 9.5,
                fontWeight: FontWeight.w600,
                color: t.text2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedPreview extends ConsumerWidget {
  const _FeedPreview();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(homeFeedProvider);
    final t = context.tokens;

    return SizedBox(
      height: 160,
      child: feed.when(
        loading: () => ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          itemCount: 3,
          separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
          itemBuilder: (_, __) => const Skeleton(width: 128, height: 160, radius: R.gentle),
        ),
        error: (e, __) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: FloatingSurface(
            solid: true,
            child: Text(
              L.of(context).stateEmpty,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
        data: (items) => items.isEmpty
            ? Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: FloatingSurface(
                  solid: true,
                  child: Text(
                    L.of(context).stateEmpty,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              )
            : ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                itemCount: items.length.clamp(0, 10),
                separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
                itemBuilder: (context, i) {
                  final p = items[i];
                  return PressableScale(
                    onTap: () => context.push(Routes.post(p.id)),
                    child: Container(
                      width: 128,
                      decoration: BoxDecoration(
                        color: t.surface,
                        borderRadius: R.gentle,
                        border: Border.all(color: t.border2),
                        boxShadow: t.shadowTiny,
                      ),
                      padding: const EdgeInsets.all(Gap.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              p.text,
                              maxLines: 5,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                          Row(
                            children: [
                              Icon(Icons.favorite_rounded, size: 12, color: t.accent2),
                              const SizedBox(width: 4),
                              Text(
                                formatCount(p.likes),
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class _ActivityPreview extends StatelessWidget {
  const _ActivityPreview({required this.id});
  final NfcId? id;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    if (id == null) {
      return FloatingSurface(
        solid: true,
        child: Text(l.activityEmpty, style: Theme.of(context).textTheme.bodyMedium),
      );
    }
    return FloatingSurface(
      solid: true,
      child: Column(
        children: [
          _Row(icon: Icons.nfc_rounded, label: l.nfcScans, value: id!.taps, tone: t.accent2),
          const SizedBox(height: Gap.md),
          _Row(icon: Icons.visibility_rounded, label: l.nfcViews, value: id!.views, tone: t.accentBDark),
          const SizedBox(height: Gap.md),
          _Row(icon: Icons.group_rounded, label: l.profileFollowers, value: id!.followers, tone: t.accentCDark),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.icon, required this.label, required this.value, required this.tone});

  final IconData icon;
  final String label;
  final int value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(color: tone.withValues(alpha: .18), shape: BoxShape.circle),
          child: Icon(icon, size: 16, color: t.isDark ? tone : t.text1),
        ),
        const SizedBox(width: Gap.md),
        Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
        Text(formatCount(value), style: Theme.of(context).textTheme.titleSmall),
      ],
    );
  }
}
