import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/validators.dart';
import '../../data/models/models.dart';
import '../../data/repositories/nfc_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/id_lux.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/session.dart';
import '../home/home_screen.dart';
import '../profile/profile_repository.dart';

// ---------------------------------------------------------------- kartalar

final nfcDevicesProvider = FutureProvider.autoDispose<List<NfcDevice>>((ref) async {
  final res = await ref.watch(nfcRepositoryProvider).devices();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Jismoniy NFC kartalar — ulash va uzish.
class NfcCardsScreen extends ConsumerWidget {
  const NfcCardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final devices = ref.watch(nfcDevicesProvider);

    return NovaScaffold(
      title: l.nfcCards,
      showBack: true,
      body: devices.when(
        loading: () => const SkeletonList(count: 3),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(nfcDevicesProvider)),
        data: (items) => items.isEmpty
            ? StatePanel(
                icon: Icons.credit_card_off_rounded,
                title: l.stateEmpty,
                message: l.nfcHoldCard,
              )
            : ListView.separated(
                padding:
                    const EdgeInsets.fromLTRB(Gap.screenX, Gap.md, Gap.screenX, 120),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                itemBuilder: (context, i) {
                  final d = items[i];
                  return FloatingSurface(
                    solid: true,
                    padding: const EdgeInsets.all(Gap.lg),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: t.surface2,
                            borderRadius: R.tile,
                            border: Border.all(color: t.border2),
                          ),
                          child: Icon(Icons.credit_card_rounded,
                              size: 20, color: t.accent2),
                        ),
                        const SizedBox(width: Gap.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(d.label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.titleSmall),
                              if (d.code.isNotEmpty)
                                Text(d.code,
                                    style: AppType.monoStyle(
                                        color: t.text3, size: 11)),
                            ],
                          ),
                        ),
                        NovaIconButton(
                          icon: d.blockedByOwner
                              ? Icons.lock_open_rounded
                              : Icons.block_rounded,
                          tooltip: d.blockedByOwner
                              ? l.nfcUnblockCard
                              : l.nfcBlockCard,
                          size: 38,
                          onPressed: () => _toggleBlock(context, ref, d),
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }

  /// Kartani bloklash / blokdan chiqarish.
  ///
  /// Ilgari bu "uzish" deb atalardi va serverga `linkedCode: ''`
  /// yuborardi. Bunday amal serverda YO'Q: bo'sh kod `validCode`
  /// tekshiruvidan o'tmaydi va 422 `bad_code` qaytadi. Ya'ni tugma
  /// bosilardi-yu, hech narsa o'zgarmasdi.
  ///
  /// Serverda haqiqatan qo'llab-quvvatlanadigan amal — `blocked`.
  /// Bloklangan karta tegizilganda profil ochilmaydi, ya'ni
  /// yo'qolgan kartani zararsizlantirish uchun aynan shu kerak.
  Future<void> _toggleBlock(
      BuildContext context, WidgetRef ref, NfcDevice d) async {
    final l = L.of(context);
    // Blokdan chiqarish tasdiq so'ramaydi — u xavfsiz amal.
    if (!d.blockedByOwner) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(l.nfcBlockCard),
          content: Text(l.nfcBlockConfirm),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(l.actionCancel)),
            TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(l.actionConfirm)),
          ],
        ),
      );
      if (ok != true || !context.mounted) return;
    }
    final res = await ref
        .read(nfcRepositoryProvider)
        .setDeviceBlocked(d.id, !d.blockedByOwner);
    if (!context.mounted) return;
    res.when(
      ok: (_) => ref.invalidate(nfcDevicesProvider),
      err: (e) => ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(describeError(l, e)))),
    );
  }
}

// ------------------------------------------------------------------ tarix

final nfcHistoryProvider =
    FutureProvider.autoDispose<List<ActivityEvent>>((ref) async {
  final id = ref.watch(activeIdProvider);
  if (id == null) return const [];
  final res = await ref.watch(nfcRepositoryProvider).history(id.code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

class NfcHistoryScreen extends ConsumerWidget {
  const NfcHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final history = ref.watch(nfcHistoryProvider);

    return NovaScaffold(
      title: l.nfcHistory,
      showBack: true,
      body: history.when(
        loading: () => const SkeletonList(),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(nfcHistoryProvider)),
        data: (items) => items.isEmpty
            ? StatePanel(
                icon: Icons.history_toggle_off_rounded,
                title: l.stateEmpty,
                message: l.stateEmptyHint)
            : ListView.separated(
                padding:
                    const EdgeInsets.fromLTRB(Gap.screenX, Gap.md, Gap.screenX, 120),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.sm),
                itemBuilder: (context, i) {
                  final e = items[i];
                  return FloatingSurface(
                    solid: true,
                    padding: const EdgeInsets.all(Gap.md),
                    child: Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                              color: t.accent2.withValues(alpha: .16),
                              shape: BoxShape.circle),
                          child: Icon(Icons.nfc_rounded, size: 15, color: t.accent2),
                        ),
                        const SizedBox(width: Gap.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(e.title.isEmpty ? l.nfcScans : e.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.titleSmall),
                              if (e.createdAt != null)
                                Text(_relative(e.createdAt!, l),
                                    style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}

/// "3 soat oldin" ko'rinishidagi sana.
///
/// `intl` ning to'liq nisbiy formatlagichi uchta til uchun alohida
/// ma'lumot talab qiladi; bu yerdagi ehtiyoj kichik, shuning uchun
/// oddiy va tarjima qilingan variant ishlatiladi.
String _relative(DateTime at, L l) {
  final d = DateTime.now().difference(at);
  if (d.inMinutes < 1) return l.stateLoading;
  if (d.inHours < 1) return '${d.inMinutes} min';
  if (d.inDays < 1) return '${d.inHours} h';
  return '${at.day}.${at.month.toString().padLeft(2, '0')}.${at.year}';
}

// ----------------------------------------------------------------- sovg'a

/// NFC ID ni boshqa foydalanuvchiga sovg'a qilish.
class NfcGiftScreen extends ConsumerStatefulWidget {
  const NfcGiftScreen({super.key, required this.code});

  final String code;

  @override
  ConsumerState<NfcGiftScreen> createState() => _NfcGiftScreenState();
}

class _NfcGiftScreenState extends ConsumerState<NfcGiftScreen> {
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;
  bool _sent = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l = L.of(context);
    final err = Validate.email(_email.text);
    if (err != null) {
      setState(() => _error = l.errBadEmail);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref
        .read(nfcRepositoryProvider)
        .gift(code: widget.code, email: _email.text.trim());
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) => setState(() => _sent = true),
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    if (_sent) {
      return NovaScaffold(
        showBack: true,
        body: StatePanel(
          icon: Icons.card_giftcard_rounded,
          title: l.nfcGiftSent,
          message: _email.text.trim(),
          tone: t.success,
          actionLabel: l.actionDone,
          onAction: () => context.pop(),
        ),
      );
    }

    return NovaScaffold(
      title: l.nfcGift,
      showBack: true,
      body: NovaScroll(
        children: [
          Center(
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                  gradient: t.accentGradient, shape: BoxShape.circle),
              child: Icon(Icons.card_giftcard_rounded,
                  size: 31, color: t.onAccent),
            ),
          ),
          const SizedBox(height: Gap.xl),
          // SOVG'A QILINAYOTGAN ID — mahsulot kartasi: pullik bo'lsa
          // o'z materialida (qiymati sezilsin), bepul bo'lsa sodda.
          IdProductCard(
            code: widget.code,
            tier: ref
                    .watch(myIdsProvider)
                    .where((e) => e.code == widget.code)
                    .firstOrNull
                    ?.tier ??
                '',
            hero: true,
          ),
          const SizedBox(height: Gap.sm),
          Text(l.nfcGiftHint,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: Gap.section),
          NovaField(
            label: l.nfcGiftRecipient,
            controller: _email,
            error: _error,
            keyboardType: TextInputType.emailAddress,
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.xxl),
          NovaButton(label: l.actionConfirm, busy: _busy, onPressed: _send),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------- xavfsizlik

/// NFC xavfsizligi — parolni almashtirish va kartalar boshqaruvi.
class NfcSecurityScreen extends ConsumerWidget {
  const NfcSecurityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final ids = ref.watch(myIdsProvider);
    final linked = ids.where((e) => e.cardLinked).length;

    return NovaScaffold(
      title: l.nfcSecurity,
      showBack: true,
      body: NovaScroll(
        children: [
          FloatingSurface(
            solid: true,
            child: Row(
              children: [
                Icon(Icons.shield_rounded, size: 26, color: t.success),
                const SizedBox(width: Gap.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l.nfcSecurity,
                          style: Theme.of(context).textTheme.titleMedium),
                      Text('$linked / ${ids.length} · ${l.nfcLinkCard}',
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SectionHeader(title: l.nfcMyIds),
          for (final e in ids)
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.sm),
              child: FloatingSurface(
                solid: true,
                padding: const EdgeInsets.all(Gap.lg),
                child: Row(
                  children: [
                    Icon(
                      e.cardLinked ? Icons.lock_rounded : Icons.lock_open_rounded,
                      size: 17,
                      color: e.cardLinked ? t.success : t.text3,
                    ),
                    const SizedBox(width: Gap.md),
                    Expanded(
                      child: Text(e.code,
                          style: AppType.monoStyle(color: t.text1, size: 13)),
                    ),
                    Text(
                      e.cardLinked ? l.nfcLinkCard : l.stateEmpty,
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  ],
                ),
              ),
            ),
          SectionHeader(title: l.settingsSecurity),
          FloatingSurface(
            solid: true,
            child: Text(
              l.settingsDeleteTypeEmail,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------ ID tahrirlash

class NfcIdEditScreen extends ConsumerStatefulWidget {
  const NfcIdEditScreen({super.key, required this.code});

  final String code;

  @override
  ConsumerState<NfcIdEditScreen> createState() => _NfcIdEditScreenState();
}

class _NfcIdEditScreenState extends ConsumerState<NfcIdEditScreen> {
  final _name = TextEditingController();
  final _role = TextEditingController();
  final _bio = TextEditingController();
  bool _busy = false;
  bool _filled = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _role.dispose();
    _bio.dispose();
    super.dispose();
  }

  void _fillOnce(NfcId id) {
    if (_filled) return;
    _filled = true;
    _name.text = id.name;
    _role.text = id.role;
    _bio.text = id.bio;
  }

  Future<void> _save() async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(profileRepositoryProvider).updateProfile(
          code: widget.code,
          name: _name.text.trim(),
          role: _role.text.trim(),
          bio: _bio.text.trim(),
        );
    if (!mounted) return;
    setState(() => _busy = false);
    await res.when(
      ok: (_) async {
        await ref.read(sessionProvider.notifier).refresh();
        if (mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l.profileSaved)));
          context.pop();
        }
      },
      err: (e) async => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final id = ref.watch(myIdsProvider).where((e) => e.code == widget.code).firstOrNull;
    if (id == null) {
      return NovaScaffold(
        showBack: true,
        body: StatePanel(icon: Icons.search_off_rounded, title: l.errNotFound),
      );
    }
    _fillOnce(id);

    return NovaScaffold(
      title: l.actionEdit,
      showBack: true,
      body: NovaScroll(
        children: [
          NovaField(label: l.fieldName, controller: _name, enabled: !_busy),
          const SizedBox(height: Gap.lg),
          NovaField(label: l.bizCategory, controller: _role, enabled: !_busy),
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.fieldBio,
            controller: _bio,
            maxLines: 4,
            maxLength: 300,
            enabled: !_busy,
          ),
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: context.tokens.error)),
          ],
          const SizedBox(height: Gap.xxl),
          NovaButton(label: l.actionSave, busy: _busy, onPressed: _save),
        ],
      ),
    );
  }
}
