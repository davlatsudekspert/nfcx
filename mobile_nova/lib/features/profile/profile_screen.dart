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

class _Hero extends StatelessWidget {
  const _Hero({required this.user, required this.id, required this.mode});

  final User user;
  final NfcId? id;
  final AppMode mode;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final cover = id?.coverUrl ?? '';

    return SizedBox(
      // Muqova + avatarning pastga chiqib turgan qismi.
      height: 210,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
            child: ClipRRect(
              borderRadius: R.organic(a: 34, b: 34, c: 34, d: 14),
              child: SizedBox(
                height: 150,
                width: double.infinity,
                child: cover.isEmpty
                    ? DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: mode == AppMode.business
                                ? [t.accentB, t.accentCDark]
                                : [t.accent1, t.accentDDark],
                          ),
                        ),
                      )
                    : CachedNetworkImage(
                        imageUrl: cover,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => ColoredBox(color: t.surface2),
                        errorWidget: (_, __, ___) => ColoredBox(color: t.surface2),
                      ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Column(
              children: [
                Avatar(
                  url: user.avatarUrl,
                  initials: user.initials,
                  size: 92,
                ),
                const SizedBox(height: Gap.sm),
                Text(
                  id != null && id!.name.isNotEmpty ? id!.name : user.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (id != null)
                  Text(
                    id!.code,
                    style: AppType.monoStyle(color: t.accent2, size: 12, letterSpacing: 1.6),
                  ),
              ],
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
