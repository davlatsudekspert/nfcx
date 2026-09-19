import 'package:cached_network_image/cached_network_image.dart';
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
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../home/home_screen.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import '../home/widgets/mode_switch.dart';
import '../nfc/qr_sheet.dart';
import 'profile_repository.dart';

final profilePostsProvider =
    FutureProvider.autoDispose.family<List<Post>, String>((ref, code) async {
  final res = await ref.watch(socialRepositoryProvider).postsOf(code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Digital Identity Canvas.
///
/// Bir xil katta to'rtburchak kartalar TO'PLAMI EMAS: muqova, suzuvchi
/// avatar, kapsula shaklidagi statistika va ixcham plitkalar — har biri
/// boshqa shakl va o'lchamda. Kompozitsiya ataylab nosimmetrik.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, this.code});

  /// `null` — o'z profili. Aks holda boshqa foydalanuvchi.
  final String? code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final mode = ref.watch(modeProvider);
    final ids = ref.watch(myIdsProvider);

    final id = code == null
        ? ref.watch(activeIdProvider)
        : ids.where((e) => e.code == code).firstOrNull;
    final isMe = code == null || ids.any((e) => e.code == code);

    if (user == null) return const SizedBox.shrink();

    return NovaScaffold(
      showBack: code != null,
      actions: code != null
          ? null
          : [
              NovaIconButton(
                icon: Icons.settings_outlined,
                tooltip: l.settings,
                onPressed: () => context.push(Routes.settings),
              ),
              const SizedBox(width: Gap.sm),
            ],
      body: RefreshIndicator(
        color: t.accent2,
        backgroundColor: t.surfaceSolid,
        onRefresh: () async {
          await ref.read(sessionProvider.notifier).refresh();
          if (id != null) ref.invalidate(profilePostsProvider(id.code));
        },
        child: NovaScroll(
          padding: EdgeInsets.only(bottom: navSafeBottom(context)),
          children: [
            _Hero(user: user, id: id, mode: mode),
            const SizedBox(height: Gap.xl),
            if (isMe && code == null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: ModeSwitch(
                  mode: mode,
                  onChanged: (m) => ref.read(modeProvider.notifier).set(m),
                ),
              ),
            const SizedBox(height: Gap.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: _StatCapsules(id: id),
            ),
            const SizedBox(height: Gap.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: Row(
                children: [
                  Expanded(
                    child: NovaButton(
                      label: isMe ? l.profileEdit : l.actionFollow,
                      icon: isMe ? Icons.edit_rounded : Icons.person_add_alt_rounded,
                      onPressed: isMe
                          ? () => context.push(Routes.profileEdit)
                          : () => ref
                              .read(profileFollowProvider.notifier)
                              .toggle(code!),
                    ),
                  ),
                  const SizedBox(width: Gap.md),
                  NovaIconButton(
                    icon: Icons.qr_code_rounded,
                    tooltip: l.nfcShowQr,
                    size: 52,
                    onPressed: id == null ? null : () => showQrSheet(context, id),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.ios_share_rounded,
                    tooltip: l.actionShare,
                    size: 52,
                    onPressed: id == null
                        ? null
                        : () => shareLink(id.publicUrl(kApiBase)),
                  ),
                ],
              ),
            ),
            if (mode == AppMode.business && isMe) ...[
              SectionHeader(title: l.bizTitle),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: _BusinessTiles(),
              ),
            ],
            SectionHeader(title: l.profilePosts),
            if (id == null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                child: FloatingSurface(
                  solid: true,
                  child: Text(l.homeNoIdHint,
                      style: Theme.of(context).textTheme.bodyMedium),
                ),
              )
            else
              _PostsGrid(code: id.code),
          ],
        ),
      ),
    );
  }
}

/// Kuzatish holati — optimistik.
class ProfileFollow extends StateNotifier<Set<String>> {
  ProfileFollow(this._ref) : super(const {});
  final Ref _ref;

  Future<void> toggle(String code) async {
    final following = state.contains(code);
    state = following ? (state.toSet()..remove(code)) : (state.toSet()..add(code));
    final repo = _ref.read(profileRepositoryProvider);
    final res = following ? await repo.unfollow(code) : await repo.follow(code);
    res.when(
      ok: (_) {},
      err: (_) => state =
          following ? (state.toSet()..add(code)) : (state.toSet()..remove(code)),
    );
  }
}

final profileFollowProvider =
    StateNotifierProvider<ProfileFollow, Set<String>>(ProfileFollow.new);

/// Profil boshi — Concept B'dagi markazlashgan "identity" ustuni.
///
/// Concept B'da muqova YO'Q: ekran tepasida atmosfera (aurora) turadi,
/// undan keyin markazda avatar-blob, ism, ikkilamchi yozuv va NFC ID
/// kapsulasi — hammasi bitta o'qda. Bizda muqova HAQIQIY ma'lumot
/// (`id.coverUrl`), shuning uchun u o'chirilmaydi, lekin endi KARTA
/// emas: to'liq kenglikdagi, pastga qarab fonga singib ketadigan
/// atmosfera bo'lib turadi. Fokus kartada emas, odamda.
class _Hero extends StatelessWidget {
  const _Hero({required this.user, required this.id, required this.mode});

  final User user;
  final NfcId? id;
  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final business = mode == AppMode.business;
    final cover = id?.coverUrl ?? '';

    // Rejim atmosferaning ham, avatar nurining ham rangini belgilaydi.
    final tone = business ? t.accentB : t.accent1;
    final toneDark = business ? t.accentBDark : t.accent2;
    final glow = business ? t.glowB : t.glow;

    // Ikkilamchi yozuv faqat backend bergan bo'lsa chiqadi. Concept B'da
    // bu yerda `@handle` turadi — bizning backend'da bunday maydon yo'q,
    // shuning uchun UNI TO'QIB CHIQARMAYMIZ.
    final subtitle = (id?.role ?? '').trim();

    return Stack(
      children: [
        // Atmosfera: to'liq kenglik, hoshiyasiz, pastda fonga so'nadi.
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 150,
          child: ShaderMask(
            // So'nishni SCRIM bilan emas, muqovaning O'ZINI shaffoflashtirib
            // qilamiz. Ustiga `bg1` to'rtburchagi qo'yilsa, uning pastki
            // qirrasi orqadagi jonli fon (backdrop) ustida TO'G'RI CHIZIQ
            // bo'lib ko'rinib qolardi — karta yana paydo bo'lardi.
            shaderCallback: (rect) => const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.white, Colors.white, Colors.transparent],
              stops: [0, .34, 1],
            ).createShader(rect),
            blendMode: BlendMode.dstIn,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (cover.isEmpty)
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          tone.withValues(alpha: .34),
                          toneDark.withValues(alpha: .12),
                        ],
                      ),
                    ),
                  )
                else
                  CachedNetworkImage(
                    imageUrl: cover,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => ColoredBox(color: t.surface2),
                    errorWidget: (_, __, ___) => ColoredBox(color: t.surface2),
                  ),
              ],
            ),
          ),
        ),
        // Stack ichidagi o'lchamsiz bola bo'sh constraint oladi va CHAPGA
        // yopishadi — shuning uchun ustun ataylab to'liq kenglikka yoyiladi.
        SizedBox(
          width: double.infinity,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 86),
                _HeroAvatar(user: user, id: id, glow: glow, business: business),
                const SizedBox(height: Gap.md),
                Text(
                  id != null && id!.name.isNotEmpty
                      ? id!.name
                      : user.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: AppType.displayStyle(
                    color: t.text1,
                    size: 24,
                    height: 1.18,
                    letterSpacing: -.6,
                  ),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                if (id != null) ...[
                  const SizedBox(height: Gap.md),
                  _IdPill(id: id!),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Avatar + holat nishoni.
///
/// Concept B'da avatar 120px, aksent gradientida va o'z nuri bilan
/// suzib turadi. `Avatar` widgeti butun ilovada bir xil — shuning uchun
/// u qayta yozilmaydi, faqat ostiga nur qo'yiladi.
class _HeroAvatar extends StatelessWidget {
  const _HeroAvatar({
    required this.user,
    required this.id,
    required this.glow,
    required this.business,
  });

  final User user;
  final NfcId? id;
  final Color glow;
  final bool business;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final avatar = (id?.avatarUrl ?? '').isNotEmpty
        ? id!.avatarUrl
        : user.avatarUrl;

    return SizedBox(
      width: 112,
      height: 112,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: glow,
                  blurRadius: 46,
                  offset: const Offset(0, 20),
                ),
              ],
            ),
            child: Avatar(
              url: avatar,
              initials: user.initials,
              size: 112,
              ringColor: business ? t.accentB : null,
            ),
          ),
          // Nishon FAQAT haqiqiy holat bo'lganda: asosiy ID yoki biznes.
          if (id != null && (id!.primary || id!.kind == NfcIdKind.business))
            Positioned(
              right: 2,
              bottom: 2,
              child: Container(
                width: 27,
                height: 27,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [t.accentB, t.accentBDark],
                  ),
                  border: Border.all(color: t.bg1, width: 3.4),
                  boxShadow: [BoxShadow(color: t.glowB, blurRadius: 12)],
                ),
                child: Icon(
                  id!.kind == NfcIdKind.business
                      ? Icons.storefront_rounded
                      : Icons.check_rounded,
                  size: 12,
                  color: kOnAccent,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// NFC ID kapsulasi — Concept B'dagi nuqta + kod.
///
/// Nuqta bezak emas: ID faol bo'lmasa u so'nik rangda turadi.
class _IdPill extends StatelessWidget {
  const _IdPill({required this.id});
  final NfcId id;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final dot = id.active ? t.success : t.text3;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: t.surface2,
        borderRadius: R.pill,
        border: Border.all(color: t.border2),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: dot,
              boxShadow: [BoxShadow(color: dot, blurRadius: 9)],
            ),
          ),
          const SizedBox(width: Gap.sm),
          Flexible(
            child: Text(
              id.code,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppType.monoStyle(
                color: t.accent3,
                size: 11.5,
                weight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Statistika — katta karta emas, uchta kapsula.
class _StatCapsules extends StatelessWidget {
  const _StatCapsules({required this.id});
  final NfcId? id;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final items = [
      (formatCount(id?.posts ?? 0), l.profilePosts),
      (formatCount(id?.followers ?? 0), l.profileFollowers),
      (formatCount(id?.following ?? 0), l.profileFollowing),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: Gap.sm),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: Gap.md),
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: R.pill,
                border: Border.all(color: t.border2),
              ),
              child: Column(
                children: [
                  Text(items[i].$1,
                      style: Theme.of(context).textTheme.titleMedium),
                  Text(
                    items[i].$2,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _BusinessTiles extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final tiles = [
      (Icons.dashboard_rounded, l.bizDashboard, Routes.businessDashboard),
      (Icons.inventory_2_rounded, l.bizCatalog, Routes.businessCatalog),
      (Icons.insights_rounded, l.bizAnalytics, Routes.businessAnalytics),
      (Icons.storefront_rounded, l.bizStorefront, Routes.business),
    ];
    return Wrap(
      spacing: Gap.md,
      runSpacing: Gap.md,
      children: [
        for (final e in tiles)
          PressableScale(
            onTap: () => context.push(e.$3),
            child: Container(
              width: (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - Gap.md) / 2,
              padding: const EdgeInsets.all(Gap.lg),
              decoration: BoxDecoration(
                color: t.surface,
                borderRadius: R.gentle,
                border: Border.all(color: t.border2),
                boxShadow: t.shadowTiny,
              ),
              child: Row(
                children: [
                  Icon(e.$1, size: 19, color: t.accentBDark),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Text(
                      e.$2,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _PostsGrid extends ConsumerWidget {
  const _PostsGrid({required this.code});
  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final posts = ref.watch(profilePostsProvider(code));

    return posts.when(
      loading: () => Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: List.generate(
            6,
            (_) => Skeleton(
              width: (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3,
              height: (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3,
              radius: R.tile,
            ),
          ),
        ),
      ),
      error: (e, __) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        child: StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(profilePostsProvider(code))),
      ),
      data: (items) {
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: FloatingSurface(
              solid: true,
              child: Column(
                children: [
                  Icon(Icons.photo_library_outlined, size: 27, color: t.text3),
                  const SizedBox(height: Gap.sm),
                  Text(l.stateEmpty, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          );
        }
        final side =
            (MediaQuery.sizeOf(context).width - Gap.screenX * 2 - 12) / 3;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final p in items)
                PressableScale(
                  onTap: () => context.push(Routes.post(p.id)),
                  child: ClipRRect(
                    borderRadius: R.tile,
                    child: SizedBox(
                      width: side,
                      height: side,
                      child: p.mediaUrls.isEmpty
                          ? Container(
                              color: t.surface2,
                              padding: const EdgeInsets.all(Gap.sm),
                              child: Text(
                                p.text,
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            )
                          : Stack(
                              fit: StackFit.expand,
                              children: [
                                CachedNetworkImage(
                                  imageUrl: p.mediaUrls.first,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) =>
                                      ColoredBox(color: t.surface2),
                                  errorWidget: (_, __, ___) =>
                                      ColoredBox(color: t.surface2),
                                ),
                                if (p.isVideo)
                                  const Positioned(
                                    right: 5,
                                    top: 5,
                                    child: Icon(Icons.play_circle_fill_rounded,
                                        size: 15, color: Colors.white),
                                  ),
                              ],
                            ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
