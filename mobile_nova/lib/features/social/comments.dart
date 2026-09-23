import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';
import 'moderation.dart';

/// Izohlar.
///
/// Backend: `hosting/api/comments.js` — bitta jadval, to'rt xil
/// kontent (`post`, `company_post`, `story`, `company_story`).
///
/// Ilgari post ekranida "izohlar yo'q" degan o'zgarmas yozuv turardi
/// va u hech qachon o'zgarmasdi: izoh yozadigan joy ham, ro'yxat ham
/// yo'q edi. Backend'da esa bu yo'l tayyor turgan edi.

typedef CommentRef = ({String kind, int id});

final commentsProvider = FutureProvider.autoDispose
    .family<({List<Comment> items, bool hasMore, int total}), CommentRef>(
        (ref, r) async {
  final res = await ref.watch(socialRepositoryProvider).comments(r.kind, r.id);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Post/istorya ostidagi izohlar bo'limi.
class CommentsSection extends ConsumerStatefulWidget {
  const CommentsSection({
    super.key,
    required this.kind,
    required this.id,
    this.ownerCode = '',
    this.focusNode,
  });

  /// `post` | `company_post` | `story` | `company_story`.
  final String kind;
  final int id;

  /// Kontent egasining kodi — shikoyatda yuboriladi.
  final String ownerCode;

  /// Tashqaridan fokus berish uchun. Post ekranidagi izoh tugmasi
  /// aynan shuni ishlatadi: bosilganda klaviatura ochilib, kursor
  /// yozish maydoniga tushadi. Ilgari o'sha tugma umuman
  /// `onTap` siz edi — bosilardi, lekin hech narsa bo'lmasdi.
  final FocusNode? focusNode;

  @override
  ConsumerState<CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends ConsumerState<CommentsSection> {
  final _text = TextEditingController();
  bool _busy = false;
  String? _error;

  /// JAVOB YOZILAYOTGAN IZOH.
  ///
  /// `null` — oddiy izoh. Aks holda maydon ustida "kimga javob"
  /// yo'lakchasi chiqadi va yuborishda `parentId` ketadi.
  Comment? _replyTo;

  CommentRef get _ref => (kind: widget.kind, id: widget.id);

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final body = _text.text.trim();
    if (body.isEmpty) return;
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(socialRepositoryProvider).addComment(
          widget.kind,
          widget.id,
          body,
          parentId: _replyTo?.id ?? 0,
        );
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) {
        _text.clear();
        _replyTo = null;
        // Ro'yxat serverdan qayta o'qiladi: `total` va tartib ham
        // shu yerda yangilanadi.
        ref.invalidate(commentsProvider(_ref));
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  /// Izohga like.
  ///
  /// Natija DARHOL ko'rinadi (yurakcha bosilishi bilan to'ladi),
  /// keyin server javobi bilan aniqlashtiriladi. Xato bo'lsa
  /// ro'yxat serverdan qayta o'qiladi — ya'ni ekranda HECH QACHON
  /// serverda bo'lmagan holat qolib ketmaydi.
  Future<void> _like(Comment c) async {
    final l = L.of(context);
    final res =
        await ref.read(socialRepositoryProvider).toggleCommentLike(c.id);
    if (!mounted) return;
    res.when(
      ok: (_) => ref.invalidate(commentsProvider(_ref)),
      err: (e) {
        ref.invalidate(commentsProvider(_ref));
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(describeError(l, e))));
      },
    );
  }

  Future<void> _delete(Comment c) async {
    final l = L.of(context);
    final ok = await showDialog<bool>(
          context: context,
          builder: (dialog) => AlertDialog(
            title: Text(l.actionDelete),
            content: Text(c.text, maxLines: 3, overflow: TextOverflow.ellipsis),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialog).pop(false),
                child: Text(l.actionCancel),
              ),
              TextButton(
                onPressed: () => Navigator.of(dialog).pop(true),
                child: Text(l.actionDelete,
                    style: TextStyle(color: context.tokens.error)),
              ),
            ],
          ),
        ) ??
        false;
    if (!ok || !mounted) return;
    final res = await ref.read(socialRepositoryProvider).deleteComment(c.id);
    if (!mounted) return;
    res.when(
      ok: (_) => ref.invalidate(commentsProvider(_ref)),
      err: (e) => ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(describeError(l, e)))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final data = ref.watch(commentsProvider(_ref));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: data.valueOrNull == null || data.valueOrNull!.total == 0
              ? l.postComments
              : '${l.postComments} · ${data.valueOrNull!.total}',
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Kimga javob yozilyapti ──────────────────────
              if (_replyTo != null) ...[
                Container(
                  margin: const EdgeInsets.only(bottom: Gap.sm),
                  padding: const EdgeInsets.fromLTRB(Gap.md, 8, 6, 8),
                  decoration: BoxDecoration(
                    color: t.surface2,
                    borderRadius: R.gentle,
                    border: Border.all(color: t.border2),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.reply_rounded, size: 16, color: t.accent2),
                      const SizedBox(width: Gap.sm),
                      Expanded(
                        child: Text(
                          l.commentReplyingTo(_replyTo!.authorName.isEmpty
                              ? _replyTo!.code
                              : _replyTo!.authorName),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close_rounded, size: 17, color: t.text3),
                        tooltip: l.actionCancel,
                        onPressed: () => setState(() => _replyTo = null),
                      ),
                    ],
                  ),
                ),
              ],

              // ── Qoidalar eslatmasi ──────────────────────────
              // Izoh ham ommaviy kontent: haqorat, diniy va siyosiy
              // targ'ibot taqiqi yozishdan OLDIN ko'rinib tursin.
              Padding(
                key: const ValueKey('comment-rules-note'),
                padding: const EdgeInsets.only(bottom: Gap.sm),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.info_outline_rounded, size: 13, color: t.text3),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        l.commentRulesNote,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(fontSize: 11.5, color: t.text3),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Yozish maydoni ──────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      focusNode: widget.focusNode,
                      enabled: !_busy,
                      minLines: 1,
                      maxLines: 4,
                      // Server 1000 belgi bilan cheklaydi — bu yerda
                      // ham shuncha, shunda "yubor" bosilgandan keyin
                      // 422 kelmaydi.
                      maxLength: 1000,
                      textInputAction: TextInputAction.newline,
                      decoration: InputDecoration(
                        hintText: l.postAddComment,
                        counterText: '',
                        filled: true,
                        fillColor: t.surface2,
                        border: OutlineInputBorder(
                          borderRadius: R.gentle,
                          borderSide: BorderSide(color: t.border2),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: R.gentle,
                          borderSide: BorderSide(color: t.border2),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: R.gentle,
                          borderSide: BorderSide(color: t.accent2),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: Gap.lg, vertical: Gap.md),
                      ),
                    ),
                  ),
                  const SizedBox(width: Gap.sm),
                  NovaIconButton(
                    icon: Icons.send_rounded,
                    tooltip: l.actionSend,
                    size: 48,
                    onPressed: _busy ? null : _send,
                  ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: Gap.sm),
                Text(_error!,
                    style: Theme.of(context)
                        .textTheme
                        .bodySmall!
                        .copyWith(color: t.error)),
              ],
              const SizedBox(height: Gap.lg),

              // ── Ro'yxat ─────────────────────────────────────
              data.when(
                loading: () => const SkeletonList(count: 2, height: 56),
                error: (e, __) => StatePanel.fromError(
                  context,
                  asAppError(e),
                  onRetry: () => ref.invalidate(commentsProvider(_ref)),
                ),
                data: (d) {
                  if (d.items.isEmpty) {
                    return FloatingSurface(
                      solid: true,
                      child: Column(
                        children: [
                          Icon(Icons.mode_comment_outlined,
                              size: 25, color: t.text3),
                          const SizedBox(height: Gap.sm),
                          Text(l.postNoComments,
                              style: Theme.of(context).textTheme.bodyMedium),
                        ],
                      ),
                    );
                  }
                  return Column(
                    children: [
                      // JAVOBLAR ICHKARIGA SURILADI.
                      //
                      // Server tartibni mavzu bo'yicha beradi: ota
                      // izoh, keyin uning javoblari. Shuning uchun
                      // bu yerda qayta saralash shart emas —
                      // ro'yxat qanday kelsa, shunday chiziladi.
                      for (final c in d.items)
                        Padding(
                          padding: EdgeInsets.only(left: c.isReply ? 34 : 0),
                          child: _CommentTile(
                            comment: c,
                            ownerCode: widget.ownerCode,
                            onDelete: c.mine ? () => _delete(c) : null,
                            onLike: () => _like(c),
                            // Javobga javob yozib bo'lmaydi (server
                            // ham rad etadi), shuning uchun tugma
                            // faqat ota izohda.
                            onReply: c.isReply
                                ? null
                                : () => setState(() {
                                      _replyTo = c;
                                      widget.focusNode?.requestFocus();
                                    }),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CommentTile extends ConsumerWidget {
  const _CommentTile({
    required this.comment,
    required this.ownerCode,
    this.onDelete,
    this.onLike,
    this.onReply,
  });

  final Comment comment;
  final String ownerCode;
  final VoidCallback? onDelete;
  final VoidCallback? onLike;

  /// `null` — javobga javob yozib bo'lmaydi.
  final VoidCallback? onReply;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final l = L.of(context);
    final name =
        comment.authorName.isEmpty ? comment.code : comment.authorName;

    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Avatar(
            url: comment.authorAvatar,
            initials: name.isEmpty ? '·' : name.characters.first.toUpperCase(),
            size: 34,
            ring: false,
            onTap: comment.code.isEmpty
                ? null
                : () => context.push(Routes.user(comment.code)),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ISM HAM BOSILADI — avatar kabi.
                //
                // Avatar allaqachon profilga olib borardi, ism esa
                // yo'q. Odam esa ko'pincha ISMNI bosadi: u kattaroq
                // va o'qilib turibdi. Bosilmagach "ishlamayapti" deb
                // o'ylardi.
                if (comment.code.isEmpty)
                  Text(name, style: Theme.of(context).textTheme.titleSmall)
                else
                  GestureDetector(
                    onTap: () => context.push(Routes.user(comment.code)),
                    behavior: HitTestBehavior.opaque,
                    child: Text(name,
                        style: Theme.of(context).textTheme.titleSmall),
                  ),
                const SizedBox(height: 2),
                Text(comment.text,
                    style: Theme.of(context).textTheme.bodyMedium),
                // ── Javob va like ──────────────────────────
                if (onReply != null || onLike != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (onReply != null)
                        _TinyAction(
                          label: l.commentReply,
                          onTap: onReply!,
                        ),
                      if (onLike != null) ...[
                        if (onReply != null) const SizedBox(width: Gap.lg),
                        _TinyAction(
                          // Bosilgan bo'lsa to'la yurakcha va aksent
                          // rangida — holat bir qarashda ko'rinadi.
                          icon: comment.liked
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          tone: comment.liked ? t.accent2 : null,
                          label: comment.likes > 0 ? '${comment.likes}' : '',
                          onTap: onLike!,
                        ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (onDelete != null)
            IconButton(
              icon: Icon(Icons.delete_outline_rounded, size: 18, color: t.text3),
              tooltip: l.actionDelete,
              onPressed: onDelete,
            )
          else
            IconButton(
              key: ValueKey('comment-actions-${comment.id}'),
              icon: Icon(Icons.flag_outlined, size: 17, color: t.text3),
              tooltip: l.reportTitle,
              // Izoh shikoyati `comment` turi bilan; muallifni ham
              // shu yerdan bloklash mumkin.
              onPressed: () => showContentActions(
                context,
                ref,
                target: ReportTarget.comment,
                targetId: '${comment.id}',
                ownerCode: comment.code.isEmpty ? ownerCode : comment.code,
                blockKind: BlockKind.record,
                blockId: comment.code,
                keyPrefix: 'comment',
              ),
            ),
        ],
      ),
    );
  }
}


/// Izoh ostidagi kichik amal — "Javob berish" va yurakcha.
///
/// Alohida vidjet: ikkalasi ham bir xil o'lcham, bir xil bosish
/// maydoni va bir xil rangda bo'lishi kerak. Nusxa ko'chirilsa
/// biri o'zgarib, ikkinchisi ortda qolardi.
class _TinyAction extends StatelessWidget {
  const _TinyAction({this.icon, required this.label, this.tone, required this.onTap});

  final IconData? icon;
  final String label;
  final Color? tone;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = tone ?? t.text3;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        // Barmoq uchun maydon: matnning o'zi juda kichik.
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) Icon(icon, size: 15, color: color),
            if (icon != null && label.isNotEmpty) const SizedBox(width: 4),
            if (label.isNotEmpty)
              Text(
                label,
                style: TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
