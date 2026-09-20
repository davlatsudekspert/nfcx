import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../data/repositories/nfc_repository.dart';
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
import '../home/widgets/identity_card.dart';
import 'qr_sheet.dart';

/// Foydalanuvchining barcha NFC ID'lari.
class NfcIdsScreen extends ConsumerWidget {
  const NfcIdsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final ids = ref.watch(myIdsProvider);

    return NovaScaffold(
      title: l.nfcMyIds,
      showBack: true,
      body: ids.isEmpty
          ? StatePanel(
              icon: Icons.badge_outlined,
              title: l.homeNoId,
              message: l.homeNoIdHint,
              actionLabel: l.homeShop,
              onAction: () => context.push(Routes.shop),
            )
          : RefreshIndicator(
              color: context.tokens.accent2,
              onRefresh: () => ref.read(sessionProvider.notifier).refresh(),
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                    Gap.screenX, Gap.md, Gap.screenX, 120),
                physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics()),
                itemCount: ids.length,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                itemBuilder: (context, i) => NfcIdTile(id: ids[i]),
              ),
            ),
    );
  }
}

/// Ro'yxatdagi bitta NFC ID.
class NfcIdTile extends StatelessWidget {
  const NfcIdTile({super.key, required this.id});

  final NfcId id;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final business = id.kind == NfcIdKind.business;
    final tone = business ? t.accentB : t.accent1;
    final toneDark = business ? t.accentBDark : t.accent2;

    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.lg),
      onTap: () => context.push(Routes.nfcId(id.code)),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [tone, toneDark]),
                  borderRadius: R.tile,
                ),
                child: Icon(
                  business ? Icons.storefront_rounded : Icons.person_rounded,
                  size: 21,
                  color: t.onAccent,
                ),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      id.name.isEmpty ? id.code : id.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    Text(
                      id.code,
                      style: AppType.monoStyle(color: t.text3, size: 11.5),
                    ),
                  ],
                ),
              ),
              if (id.primary)
                Capsule(label: l.nfcPrimary, selected: true, dense: true)
              else if (!id.active)
                Capsule(label: l.nfcInactive, dense: true),
            ],
          ),
          const SizedBox(height: Gap.md),
          Row(
            children: [
              _Metric(icon: Icons.nfc_rounded, value: id.taps, label: l.nfcScans),
              _Metric(
                  icon: Icons.visibility_rounded, value: id.views, label: l.nfcViews),
              _Metric(
                  icon: Icons.group_rounded,
                  value: id.followers,
                  label: l.profileFollowers),
              const Spacer(),
              NovaIconButton(
                icon: Icons.qr_code_rounded,
                tooltip: l.nfcShowQr,
                size: 36,
                onPressed: () => showQrSheet(context, id),
              ),
              const SizedBox(width: Gap.sm),
              NovaIconButton(
                icon: Icons.ios_share_rounded,
                tooltip: l.actionShare,
                size: 36,
                onPressed: () => shareLink(id.publicUrl(kApiBase), title: id.name),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.value, required this.label});

  final IconData icon;
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.only(right: Gap.lg),
      child: Semantics(
        label: '$label $value',
        child: Row(
          children: [
            Icon(icon, size: 13, color: t.text3),
            const SizedBox(width: 4),
            Text(formatCount(value),
                style: Theme.of(context).textTheme.labelMedium),
          ],
        ),
      ),
    );
  }
}

/// NFC ID tafsilotlari.
class NfcIdDetailScreen extends ConsumerWidget {
  const NfcIdDetailScreen({super.key, required this.code});

  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final ids = ref.watch(myIdsProvider);
    final id = ids.where((e) => e.code == code).firstOrNull;

    if (id == null) {
      return NovaScaffold(
        showBack: true,
        body: StatePanel(
          icon: Icons.search_off_rounded,
          title: l.errNotFound,
          message: code,
        ),
      );
    }

    return NovaScaffold(
      title: id.name.isEmpty ? id.code : id.name,
      showBack: true,
      actions: [
        NovaIconButton(
          icon: Icons.edit_rounded,
          tooltip: l.actionEdit,
          onPressed: () => context.push(Routes.nfcIdEdit(id.code)),
        ),
        const SizedBox(width: Gap.sm),
      ],
      body: NovaScroll(
        children: [
          Container(
            padding: const EdgeInsets.all(Gap.xl),
            decoration: BoxDecoration(
              gradient: id.kind == NfcIdKind.business
                  ? LinearGradient(colors: [t.accentB, t.accentBDark])
                  : t.accentGradient,
              borderRadius: R.organic(a: 40, b: 40, c: 40, d: 18),
              boxShadow: t.shadowFloat,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l.homeActiveId.toUpperCase(),
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1.3,
                    color: t.onAccent.withValues(alpha: .6),
                  ),
                ),
                const SizedBox(height: 5),
                SelectableText(
                  id.code,
                  style: AppType.monoStyle(
                      color: t.onAccent, size: 26, letterSpacing: 2.6),
                ),
                const SizedBox(height: Gap.md),
                Text(
                  id.publicUrl(kApiBase),
                  style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: t.onAccent.withValues(alpha: .72),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: Gap.xl),
          Row(
            children: [
              Expanded(
                child: NovaButton(
                  label: l.nfcShowQr,
                  icon: Icons.qr_code_rounded,
                  onPressed: () => showQrSheet(context, id),
                ),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: NovaButton(
                  label: l.actionShare,
                  tone: ButtonTone.quiet,
                  icon: Icons.ios_share_rounded,
                  onPressed: () =>
                      shareLink(id.publicUrl(kApiBase), title: id.name),
                ),
              ),
            ],
          ),
          SectionHeader(title: l.nfcViews),
          FloatingSurface(
            solid: true,
            child: Column(
              children: [
                _DetailRow(label: l.nfcScans, value: formatCount(id.taps)),
                const SizedBox(height: Gap.md),
                _DetailRow(label: l.nfcViews, value: formatCount(id.views)),
                const SizedBox(height: Gap.md),
                _DetailRow(
                    label: l.profileFollowers, value: formatCount(id.followers)),
                const SizedBox(height: Gap.md),
                _DetailRow(
                  label: l.nfcLinkCard,
                  value: id.cardLinked ? l.yes : l.no,
                ),
              ],
            ),
          ),
          SectionHeader(title: l.settingsAccount),
          FloatingSurface(
            solid: true,
            padding: const EdgeInsets.symmetric(vertical: Gap.sm),
            child: Column(
              children: [
                _ActionRow(
                  icon: Icons.star_rounded,
                  label: l.nfcSetPrimary,
                  enabled: !id.primary,
                  onTap: () async {
                    final res =
                        await ref.read(nfcRepositoryProvider).setPrimary(id.code);
                    if (!context.mounted) return;
                    res.when(
                      ok: (_) => ref.read(sessionProvider.notifier).refresh(),
                      err: (e) => ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(describeError(l, e))),
                      ),
                    );
                  },
                ),
                _ActionRow(
                  icon: Icons.card_giftcard_rounded,
                  label: l.nfcGift,
                  onTap: () => context.push(Routes.nfcGift(id.code)),
                ),
                _ActionRow(
                  icon: Icons.history_rounded,
                  label: l.nfcHistory,
                  onTap: () => context.push(Routes.nfcHistory),
                ),
                _ActionRow(
                  icon: Icons.delete_outline_rounded,
                  label: l.actionDelete,
                  danger: true,
                  onTap: () => _confirmDelete(context, ref, id),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(
      BuildContext context, WidgetRef ref, NfcId id) async {
    final l = L.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.actionDelete, style: Theme.of(context).textTheme.titleLarge),
        content: Text(l.nfcDeleteConfirm,
            style: Theme.of(context).textTheme.bodyMedium),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l.actionDelete,
                style: TextStyle(color: context.tokens.error)),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;

    final res = await ref.read(nfcRepositoryProvider).deleteId(id.code);
    if (!context.mounted) return;
    res.when(
      ok: (_) {
        ref.read(sessionProvider.notifier).refresh();
        context.pop();
      },
      err: (e) => ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(describeError(l, e)))),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Expanded(
              child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Text(value, style: Theme.of(context).textTheme.titleSmall),
        ],
      );
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
    this.enabled = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = danger ? t.error : t.text1;
    return Opacity(
      opacity: enabled ? 1 : .4,
      child: PressableScale(
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
          child: Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context)
                      .textTheme
                      .bodyLarge
                      ?.copyWith(color: color),
                ),
              ),
              Icon(Icons.chevron_right_rounded, size: 18, color: t.text3),
            ],
          ),
        ),
      ),
    );
  }
}
