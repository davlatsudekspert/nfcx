import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';
import 'profile_repository.dart';

/// OBUNACHILAR / OBUNALAR RO'YXATI.
///
/// Ilgari profildagi uchta raqam shunchaki matn edi — bosilmasdi.
/// Odam "12 obunachi" ni ko'rib, kimligini bilolmasdi.
///
/// Manba: `GET /api/follow-list/:code?dir=followers|following`.
/// `dir` nomi ataylab serverdagi nom bilan bir xil — ilgari ilova
/// `?type=` yuborardi va server uni e'tiborsiz qoldirib, HAR DOIM
/// obunachilarni qaytarardi.
final followListProvider = FutureProvider.autoDispose
    .family<List<NfcId>, ({String code, String dir})>((ref, a) async {
  final res = await ref
      .read(profileRepositoryProvider)
      .followList(a.code, dir: a.dir);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

class FollowListScreen extends ConsumerWidget {
  const FollowListScreen({super.key, required this.code, required this.dir});

  final String code;

  /// `followers` yoki `following`.
  final String dir;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final arg = (code: code, dir: dir);
    final list = ref.watch(followListProvider(arg));

    return NovaScaffold(
      showBack: true,
      title: dir == 'following' ? l.profileFollowing : l.profileFollowers,
      body: list.when(
        loading: () => const SkeletonList(),
        error: (e, __) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(followListProvider(arg)),
        ),
        data: (items) => items.isEmpty
            ? StatePanel(
                icon: Icons.person_off_rounded,
                title: l.stateEmpty,
                message: l.stateEmptyHint,
              )
            : ListView.separated(
                padding: EdgeInsets.fromLTRB(
                    Gap.screenX, Gap.md, Gap.screenX, navSafeBottom(context)),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.sm),
                itemBuilder: (context, i) => _Row(item: items[i]),
              ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.item});

  final NfcId item;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final name = item.name.trim().isEmpty ? item.code : item.name;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => context.push(Routes.user(item.code)),
      child: Container(
        padding: const EdgeInsets.all(Gap.md),
        decoration: BoxDecoration(
          color: t.surface2,
          borderRadius: R.gentle,
          border: Border.all(color: t.border2),
        ),
        child: Row(
          children: [
            Avatar(url: item.avatarUrl, initials: _initials(name), size: 44, ring: false),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: t.text1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.code,
                    style: TextStyle(
                      fontFamily: AppType.mono,
                      fontSize: 11.5,
                      color: t.text3,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 20, color: t.text3),
          ],
        ),
      ),
    );
  }

  String _initials(String s) =>
      (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
}
