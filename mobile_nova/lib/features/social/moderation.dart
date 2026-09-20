import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../l10n/gen/app_localizations.dart';

/// Shikoyat va bloklash.
///
/// ## Nega kerak
///
/// Backend'da bu tizim ALLAQACHON bor
/// (`hosting/api/moderation.js`), lekin ilovada unga hech qanday
/// kirish nuqtasi yo'q edi: odam nomaqbul kontentni ko'rsa, qo'lidan
/// hech narsa kelmasdi. O'sha faylning o'zida yozilgan sabab:
/// Google Play foydalanuvchi kontenti bor ilovalardan ilova ICHIDA
/// shikoyat qilish va bloklashni TALAB qiladi.
///
/// Ro'yxatlar serverdagi yopiq ro'yxatlarning aynan o'zi — mos
/// kelmasa server `422 bad_reason` / `bad_target` qaytaradi.

/// Shikoyat sabablari — `REPORT_REASONS` bilan bir xil tartibda.
enum ReportReason {
  porn('porn'),
  religious('religious'),
  political('political'),
  violence('violence'),
  insult('insult'),
  spam('spam'),
  illegal('illegal'),
  copyright('copyright'),
  other('other');

  const ReportReason(this.wire);

  /// Serverga yuboriladigan qiymat.
  final String wire;

  String label(L l) => switch (this) {
        ReportReason.porn => l.reportReasonPorn,
        ReportReason.religious => l.reportReasonReligious,
        ReportReason.political => l.reportReasonPolitical,
        ReportReason.violence => l.reportReasonViolence,
        ReportReason.insult => l.reportReasonInsult,
        ReportReason.spam => l.reportReasonSpam,
        ReportReason.illegal => l.reportReasonIllegal,
        ReportReason.copyright => l.reportReasonCopyright,
        ReportReason.other => l.reportReasonOther,
      };
}

/// Nimaga shikoyat qilish mumkin — `REPORT_TARGETS`.
enum ReportTarget {
  post('post'),
  story('story'),
  companyPost('company_post'),
  record('record'),
  company('company');

  const ReportTarget(this.wire);
  final String wire;
}

/// Nimani bloklash mumkin — `BLOCK_KINDS`. Alohida post emas, PROFIL.
enum BlockKind {
  record('record'),
  company('company');

  const BlockKind(this.wire);
  final String wire;
}

class BlockedItem {
  const BlockedItem({required this.kind, required this.id});
  final String kind;
  final String id;
}

class ModerationRepository {
  ModerationRepository(this._api);
  final ApiClient _api;

  /// Shikoyat yuborish.
  ///
  /// Kirish SHART EMAS — server anonim shikoyatni ham qabul qiladi
  /// (IP bo'yicha chegara bilan).
  Future<Result<void>> report({
    required ReportTarget target,
    required String targetId,
    required ReportReason reason,
    String note = '',
    String ownerCode = '',
  }) =>
      _api.post<void>('/api/reports', {
        'targetKind': target.wire,
        'targetId': targetId,
        'reason': reason.wire,
        if (note.isNotEmpty) 'note': note,
        if (ownerCode.isNotEmpty) 'ownerCode': ownerCode,
      });

  Future<Result<List<BlockedItem>>> blocks() async {
    final res = await _api.get<Map<String, dynamic>>('/api/blocks');
    return res.map((j) {
      final raw = j['blocks'];
      if (raw is! List) return const <BlockedItem>[];
      return raw
          .whereType<Map>()
          .map((e) => BlockedItem(
                kind: '${e['targetKind'] ?? e['kind'] ?? ''}',
                id: '${e['targetId'] ?? e['id'] ?? ''}',
              ))
          .where((e) => e.id.isNotEmpty)
          .toList();
    });
  }

  Future<Result<void>> block(BlockKind kind, String id) =>
      _api.post<void>('/api/blocks', {'kind': kind.wire, 'id': id});

  Future<Result<void>> unblock(String kind, String id) =>
      _api.delete<void>('/api/blocks/$kind/$id');
}

final moderationRepositoryProvider = Provider<ModerationRepository>(
  (ref) => ModerationRepository(ref.watch(apiProvider)),
);

final blocksProvider =
    FutureProvider.autoDispose<List<BlockedItem>>((ref) async {
  final res = await ref.watch(moderationRepositoryProvider).blocks();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Shikoyat varag'i.
Future<void> showReportSheet(
  BuildContext context, {
  required ReportTarget target,
  required String targetId,
  String ownerCode = '',
}) =>
    showModalBottomSheet<void>(
      context: context,
      // ILDIZ NAVIGATORDA OCHILADI.
      //
      // Aks holda varaq TAB navigatorida ochiladi va pastki suzuvchi
      // navigatsiya paneli uning ustiga chiziladi — varaqning eng
      // pastki tugmalari panel ostida qolib ko'rinmay qoladi.
      // Ildiz navigatorda varaq butun ekranni qoplaydi.
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _ReportSheet(
        target: target,
        targetId: targetId,
        ownerCode: ownerCode,
      ),
    );

class _ReportSheet extends ConsumerStatefulWidget {
  const _ReportSheet({
    required this.target,
    required this.targetId,
    required this.ownerCode,
  });

  final ReportTarget target;
  final String targetId;
  final String ownerCode;

  @override
  ConsumerState<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<_ReportSheet> {
  final _note = TextEditingController();
  ReportReason? _reason;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final reason = _reason;
    if (reason == null) return;
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(moderationRepositoryProvider).report(
          target: widget.target,
          targetId: widget.targetId,
          reason: reason,
          note: _note.text.trim(),
          ownerCode: widget.ownerCode,
        );
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l.reportSent)));
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: Gap.lg,
        right: Gap.lg,
        bottom: MediaQuery.viewInsetsOf(context).bottom +
            MediaQuery.viewPaddingOf(context).bottom +
            Gap.lg,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: R.soft,
          border: Border.all(color: t.border2),
        ),
        padding: const EdgeInsets.all(Gap.xl),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.flag_outlined, size: 19, color: t.warn),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Text(l.reportTitle,
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                ],
              ),
              const SizedBox(height: Gap.lg),
              Wrap(
                spacing: Gap.sm,
                runSpacing: Gap.sm,
                children: [
                  for (final r in ReportReason.values)
                    Capsule(
                      label: r.label(l),
                      selected: _reason == r,
                      onTap: _busy ? null : () => setState(() => _reason = r),
                    ),
                ],
              ),
              const SizedBox(height: Gap.lg),
              NovaField(
                label: l.reportNote,
                controller: _note,
                maxLines: 3,
                maxLength: 600,
                enabled: !_busy,
              ),
              if (_error != null) ...[
                const SizedBox(height: Gap.md),
                Text(_error!,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall!
                        .copyWith(color: t.error)),
              ],
              const SizedBox(height: Gap.lg),
              NovaButton(
                label: l.reportTitle,
                busy: _busy,
                onPressed: _reason == null ? null : _send,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bloklanganlar ro'yxati — Sozlamalar > Maxfiylik ichidan.
class BlockedScreen extends ConsumerWidget {
  const BlockedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final blocks = ref.watch(blocksProvider);

    return NovaScaffold(
      title: l.blockedList,
      showBack: true,
      body: blocks.when(
        loading: () => const SkeletonList(count: 4, height: 64),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(blocksProvider)),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(Gap.section),
                child: Text(l.stateEmpty,
                    style: Theme.of(context).textTheme.bodyMedium),
              ),
            );
          }
          return NovaScroll(
            children: [
              for (final b in items)
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: Gap.screenX, vertical: Gap.xs),
                  child: FloatingSurface(
                    solid: true,
                    child: Row(
                      children: [
                        Icon(
                          b.kind == 'company'
                              ? Icons.storefront_rounded
                              : Icons.person_rounded,
                          size: 19,
                          color: t.text3,
                        ),
                        const SizedBox(width: Gap.md),
                        Expanded(
                          child: Text(b.id,
                              style:
                                  Theme.of(context).textTheme.titleSmall),
                        ),
                        NovaButton(
                          label: l.unblockUser,
                          tone: ButtonTone.quiet,
                          onPressed: () async {
                            await ref
                                .read(moderationRepositoryProvider)
                                .unblock(b.kind, b.id);
                            ref.invalidate(blocksProvider);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
