import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/profile_context.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
import '../../data/repositories/social_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../home/home_screen.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import '../profile/profile_repository.dart';
import '../profile/profile_screen.dart';
import 'comments.dart';
import 'engagement.dart';
import 'reels_screen.dart';
import 'story_viewer.dart';
import 'inline_video.dart';
import 'content_rules.dart';
import 'moderation.dart';

/// Post tafsiloti uchun so'rov: yozuv kodi + post id.
typedef PostRef = ({String code, int id});

final postProvider = FutureProvider.autoDispose.family<Post, PostRef>((
  ref,
  r,
) async {
  final res = await ref.watch(socialRepositoryProvider).postIn(r.code, r.id);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Post tafsiloti — yoqtirish, izohlar, ulashish.
class PostScreen extends ConsumerStatefulWidget {
  const PostScreen({super.key, required this.id, this.code = ''});

  final int id;

  /// Postning yozuvi — usiz backend'dan postni olib bo'lmaydi.
  final String code;

  @override
  ConsumerState<PostScreen> createState() => _PostScreenState();
}

class _PostScreenState extends ConsumerState<PostScreen> {
  // LAYK HOLATI MAHALLIY EMAS.
  //
  // Ilgari bu yerda `_likedOverride` va `_likeDelta` degan
  // maydonlar turardi va ular FAQAT shu ekranga tegishli edi:
  // lentada bosilgan layk bu yerda ko'rinmasdi, bu yerda
  // bosilgani esa lentaga qaytmasdi. Endi holat
  // `postLikesProvider` da — bitta joyda.

  /// Izoh yozish maydonining fokusi. "Izoh" tugmasi shu orqali
  /// klaviaturani ochadi — ilgari o'sha tugma `onTap` siz edi va
  /// bosilganda mutlaqo hech narsa bo'lmasdi.
  final _commentFocus = FocusNode();

  @override
  void dispose() {
    _commentFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final post = ref.watch(postProvider((code: widget.code, id: widget.id)));
    final myIds = ref.watch(myIdsProvider);

    return NovaScaffold(
      title: l.homePosts,
      showBack: true,
      body: post.when(
        loading: () => const SkeletonList(count: 2, height: 200),
        error: (e, __) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () =>
              ref.invalidate(postProvider((code: widget.code, id: widget.id))),
        ),
        data: (p) {
          final like = ref.watch(
            postLikesProvider.select(
              (m) => m[p.id] ?? (liked: p.liked, count: p.likes),
            ),
          );
          final liked = like.liked;
          final mine = myIds.any((e) => e.code == p.code);
          return NovaScroll(
            children: [
              Row(
                children: [
                  Avatar(
                    url: p.authorAvatar,
                    initials: _initials(p.authorName, p.code),
                    size: 44,
                    onTap: p.code.isEmpty
                        ? null
                        : () => context.push(Routes.user(p.code)),
                  ),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.authorName.isEmpty ? p.code : p.authorName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        if (p.code.isNotEmpty)
                          Text(
                            p.code,
                            style: AppType.monoStyle(color: t.text3, size: 11),
                          ),
                      ],
                    ),
                  ),
                  if (mine)
                    NovaIconButton(
                      icon: Icons.delete_outline_rounded,
                      tooltip: l.actionDelete,
                      size: 38,
                      onPressed: () => _confirmDelete(p),
                    )
                  else
                    // O'ZGANING posti — shikoyat qilish mumkin.
                    // Backend'da bu yo'l bor edi, ilovada kirish
                    // nuqtasi yo'q edi.
                    NovaIconButton(
                      icon: Icons.flag_outlined,
                      tooltip: l.reportTitle,
                      size: 38,
                      onPressed: () => showReportSheet(
                        context,
                        target: ReportTarget.post,
                        targetId: '${p.id}',
                        ownerCode: p.code,
                      ),
                    ),
                ],
              ),
              if (p.mediaUrls.isNotEmpty) ...[
                const SizedBox(height: Gap.lg),
                ClipRRect(
                  borderRadius: R.gentle,
                  child: AspectRatio(
                    aspectRatio: 1,
                    // VIDEO POST. Ilgari bu yerda HAR DOIM
                    // `CachedNetworkImage` turardi va `p.isVideo`
                    // umuman o'qilmasdi — video post ochilganda
                    // siniq rasm belgisi chiqardi.
                    child: p.isVideo
                        ? InlineVideo(
                            key: ValueKey(p.id),
                            url: p.mediaUrls.first,
                            autoPlay: false,
                            looping: true,
                            tapToToggle: true,
                          )
                        : CachedNetworkImage(
                            imageUrl: p.mediaUrls.first,
                            fit: BoxFit.cover,
                            placeholder: (_, __) =>
                                ColoredBox(color: t.surface2),
                            errorWidget: (_, __, ___) => ColoredBox(
                              color: t.surface2,
                              child: Icon(
                                Icons.broken_image_outlined,
                                size: 30,
                                color: t.text3,
                              ),
                            ),
                          ),
                  ),
                ),
              ],
              if (p.text.isNotEmpty) ...[
                const SizedBox(height: Gap.lg),
                Text(p.text, style: Theme.of(context).textTheme.bodyLarge),
              ],
              const SizedBox(height: Gap.xl),
              Row(
                children: [
                  _Action(
                    icon: liked
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    label: formatCount(like.count),
                    tint: liked ? t.error : t.text2,
                    onTap: () async {
                      final e = await ref
                          .read(postLikesProvider.notifier)
                          .toggle(p);
                      if (e == null || !context.mounted) return;
                      ScaffoldMessenger.of(context)
                        ..hideCurrentSnackBar()
                        ..showSnackBar(
                            SnackBar(content: Text(describeError(l, e))));
                    },
                  ),
                  const SizedBox(width: Gap.xl),
                  _Action(
                    icon: Icons.mode_comment_outlined,
                    label: formatCount(p.comments),
                    tint: t.text2,
                    onTap: _commentFocus.requestFocus,
                  ),
                  const Spacer(),
                  _Action(
                    icon: Icons.ios_share_rounded,
                    label: l.actionShare,
                    tint: t.text2,
                    onTap: () => shareText(p.text),
                  ),
                ],
              ),
              // Izohlar — backend'dagi haqiqiy ro'yxat. Ilgari bu
              // yerda o'zgarmas "izohlar yo'q" yozuvi turardi.
              CommentsSection(
                kind: 'post',
                id: p.id,
                ownerCode: p.code,
                focusNode: _commentFocus,
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _confirmDelete(Post p) async {
    final l = L.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.actionDelete),
        content: Text(l.postDeleteConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              l.actionDelete,
              style: TextStyle(color: context.tokens.error),
            ),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final res = await ref.read(socialRepositoryProvider).deletePost(p.id);
    if (!mounted) return;
    res.when(
      ok: (_) => context.pop(),
      err: (e) => ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(describeError(l, e)))),
    );
  }

  String _initials(String name, String fallback) {
    final s = name.trim().isEmpty ? fallback : name.trim();
    return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
  }
}

class _Action extends StatelessWidget {
  const _Action({
    required this.icon,
    required this.label,
    required this.tint,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Color tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => PressableScale(
    onTap: onTap,
    child: Row(
      children: [
        Icon(icon, size: 21, color: tint),
        const SizedBox(width: 5),
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(color: tint),
        ),
      ],
    ),
  );
}

// --------------------------------------------------------------- yaratish

/// Post / Story / Reel yaratish — bitta oqim, uch ko'rinish.
///
/// Uchalasi ham "media tanla → ko'rib chiq → yukla → chop et" bo'lgani
/// uchun bitta ekran ishlatiladi: uchta deyarli bir xil fayl o'rniga
/// bitta, va yuklash mantig'i bir joyda tuzatiladi.
enum ComposerKind { post, story, reel }

class ComposerScreen extends ConsumerStatefulWidget {
  const ComposerScreen({super.key, required this.kind});

  final ComposerKind kind;

  @override
  ConsumerState<ComposerScreen> createState() => _ComposerScreenState();
}

class _ComposerScreenState extends ConsumerState<ComposerScreen> {
  final _text = TextEditingController();
  final _picker = ImagePicker();

  XFile? _file;
  double _progress = 0;
  bool _busy = false;
  String? _error;

  bool get _video => widget.kind == ComposerKind.reel;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    final f = _video
        ? await _picker.pickVideo(source: source)
        // Yuklashdan OLDIN kichraytiriladi: 12 MP telefon rasmi mobil
        // internetda daqiqalab ketardi va serverda ham keraksiz.
        : await _picker.pickImage(
            source: source,
            maxWidth: 1600,
            imageQuality: 85,
          );
    if (f != null && mounted) setState(() => _file = f);
  }

  Future<void> _publish() async {
    final l = L.of(context);
    // FAOL KONTEKST — shaxsiy yozuv yoki kompaniya.
    //
    // Ilgari bu yerda `activeIdProvider` turardi, ya'ni biznes
    // rejimida turib yaratilgan post SHAXSIY profilga tushardi.
    final profile = ref.read(activeProfileProvider);
    if (profile == null) return;

    // MEDIA MAJBURIY — POST UCHUN HAM.
    //
    // Ilgari post uchun media ixtiyoriy deb hisoblanardi va faqat
    // matn bilan "joylash" bosilardi. Server esa bunday postni
    // QABUL QILMAYDI:
    //
    //     if (!okImg && !okVid) return json({ error: 'bad_image' }, 422);
    //
    // Ya'ni foydalanuvchi matn yozib, tugmani bosib, tushunarsiz
    // xato olardi. Endi shart oldindan aytiladi.
    if (_file == null) {
      setState(() => _error = l.errRequired);
      return;
    }

    // Kontent qoidalari darvozasi. Birinchi marta to'liq matn va
    // rozilik katakchasi ochiladi; keyin bu chaqiruv darhol `true`
    // qaytadi va tugmaning ostidagi eslatma qoladi.
    //
    // Rozilik bo'lmasa so'rov YUBORILMAYDI: serverning o'zi ham uni
    // 422 bilan rad etardi, lekin foydalanuvchiga sabab tushunarsiz
    // bo'lardi.
    if (!await ensureContentRules(context, ref)) {
      if (mounted) setState(() => _error = l.rulesNotAccepted);
      return;
    }
    if (!mounted) return;

    setState(() {
      _busy = true;
      _error = null;
      _progress = 0;
    });

    var mediaUrl = '';
    if (_file != null) {
      void progress(int sent, int total) {
        if (mounted && total > 0) setState(() => _progress = sent / total);
      }

      // Video va rasm SERVERDA ikki xil yo'ldan boradi: rasm base64
      // `data:` URL bo'lib `/api/upload` ga, video esa xom binar
      // bo'lib `/api/upload-card-video` ga ketadi.
      final repo = ref.read(profileRepositoryProvider);
      final up = _video
          ? await repo.uploadVideo(_file!.path, onProgress: progress)
          : await repo.uploadImage(_file!.path, onProgress: progress);
      if (!mounted) return;
      final url = up.valueOrNull;
      if (url == null || url.isEmpty) {
        setState(() {
          _busy = false;
          _error = up.errorOrNull == null
              ? l.uploadFailed
              : describeError(l, up.errorOrNull!);
        });
        return;
      }
      mediaUrl = url;
    }

    // Server media turini ALOHIDA maydonlardan biladi (`imageUrl`
    // yoki `videoUrl`), `type` degan maydon yo'q.
    final image = _video ? '' : mediaUrl;
    final video = _video ? mediaUrl : '';
    final caption = _text.text.trim();

    // Kompaniya va shaxsiy yozuv IKKI XIL endpointga yozadi.
    final social = ref.read(socialRepositoryProvider);
    final business = ref.read(businessRepositoryProvider);

    final res = switch ((widget.kind, profile.isBusiness)) {
      (ComposerKind.story, true) =>
        await business
            .createStory(
              companyId: profile.code,
              imageUrl: image,
              videoUrl: video,
              caption: caption,
            )
            .then((r) => r.map((_) => null)),
      (ComposerKind.story, false) =>
        await social
            .createStory(
              code: profile.code,
              imageUrl: image,
              videoUrl: video,
              caption: caption,
            )
            .then((r) => r.map((_) => null)),
      (ComposerKind.post || ComposerKind.reel, true) =>
        await business
            .createPost(
              companyId: profile.code,
              caption: caption,
              imageUrl: image,
              videoUrl: video,
            )
            .then((r) => r.map((_) => null)),
      (ComposerKind.post || ComposerKind.reel, false) =>
        await social
            .createPost(
              code: profile.code,
              caption: caption,
              imageUrl: image,
              videoUrl: video,
            )
            .then((r) => r.map((_) => null)),
    };

    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) {
        // YANGILANISH TURGA QARAB — ilgari ikkalasi ham har safar
        // qayta o'qilardi, ya'ni story joylansa postlar ro'yxati
        // ham "yangilanardi" va aksincha. Foydalanuvchi uchun bu
        // ikki bo'limni bir-biriga bog'lab qo'yardi.
        switch (widget.kind) {
          case ComposerKind.story:
            // FAQAT STORYLAR. Postlar va lentaga tegilmaydi.
            ref.invalidate(homeStoriesProvider);
            ref.invalidate(storiesOfProvider(profile.code));
          case ComposerKind.post:
            // FAQAT POSTLAR. Story halqasi qayta o'qilmaydi.
            ref.invalidate(homeFeedProvider);
            _invalidatePosts(profile);
          case ComposerKind.reel:
            // Reel — video POST: lentada ham, Reels'da ham
            // ko'rinadi, lekin STORY emas.
            ref.invalidate(homeFeedProvider);
            ref.invalidate(reelsProvider);
            _invalidatePosts(profile);
        }
        context.pop();
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  /// Post ro'yxatini yangilash — manba kontekstga bog'liq.
  ///
  /// Kompaniya postlari `/api/companies/:id/posts` da, shaxsiy
  /// postlar esa `/api/records/:code/posts` da. Noto'g'risini
  /// yangilash "joyladim, lekin ko'rinmadi" holatini berardi.
  void _invalidatePosts(ActiveProfile profile) {
    if (profile.isBusiness) {
      ref.invalidate(companyPostsProvider(profile.code));
    } else {
      ref.invalidate(profilePostsProvider(profile.code));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final id = ref.watch(activeIdProvider);

    final title = switch (widget.kind) {
      ComposerKind.post => l.postCreate,
      ComposerKind.story => l.storyCreate,
      ComposerKind.reel => l.reelCreate,
    };
    final action = switch (widget.kind) {
      ComposerKind.post => l.postPublish,
      ComposerKind.story => l.storyPublish,
      ComposerKind.reel => l.reelPublish,
    };

    if (id == null) {
      return NovaScaffold(
        showBack: true,
        title: title,
        body: StatePanel(
          icon: Icons.badge_outlined,
          title: l.homeNoId,
          message: l.homeNoIdHint,
        ),
      );
    }

    return NovaScaffold(
      title: title,
      showBack: true,
      body: NovaScroll(
        children: [
          PressableScale(
            onTap: _busy ? null : () => _showPicker(),
            child: Container(
              height: 230,
              decoration: BoxDecoration(
                color: t.surface2,
                borderRadius: R.gentle,
                border: Border.all(
                  color: _file == null ? t.border2 : t.accent2,
                  width: _file == null ? 1 : 1.6,
                ),
              ),
              alignment: Alignment.center,
              child: _file == null
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _video
                              ? Icons.videocam_rounded
                              : Icons.add_photo_alternate_rounded,
                          size: 34,
                          color: t.text3,
                        ),
                        const SizedBox(height: Gap.sm),
                        Text(
                          _video ? l.mediaPickVideo : l.mediaPickPhoto,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    )
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.check_circle_rounded,
                          size: 30,
                          color: t.success,
                        ),
                        const SizedBox(height: Gap.sm),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: Gap.xl,
                          ),
                          child: Text(
                            _file!.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
          if (widget.kind != ComposerKind.story) ...[
            const SizedBox(height: Gap.xl),
            NovaField(
              label: l.postCaption,
              controller: _text,
              maxLines: 4,
              maxLength: 600,
              enabled: !_busy,
            ),
          ],
          if (_busy && _progress > 0) ...[
            const SizedBox(height: Gap.xl),
            ClipRRect(
              borderRadius: R.pill,
              child: LinearProgressIndicator(
                value: _progress,
                minHeight: 6,
                backgroundColor: t.surface2,
                valueColor: AlwaysStoppedAnimation(t.accent2),
              ),
            ),
            const SizedBox(height: Gap.sm),
            Text(
              l.uploadProgress((_progress * 100).round()),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: t.error,
              ),
            ),
          ],
          const SizedBox(height: Gap.xxl),
          // Generic "Chop etish" EMAS: foydalanuvchi nima
          // joylayotganini tugmaning o'zidan bilsin.
          NovaButton(label: action, busy: _busy, onPressed: _publish),
          const ContentRulesNote(),
        ],
      ),
    );
  }

  void _showPicker() {
    final l = L.of(context);
    showModalBottomSheet(
      context: context,
      // ILDIZ NAVIGATORDA OCHILADI.
      //
      // Aks holda varaq TAB navigatorida ochiladi va pastki suzuvchi
      // navigatsiya paneli uning ustiga chiziladi — varaqning eng
      // pastki tugmalari panel ostida qolib ko'rinmay qoladi.
      // Ildiz navigatorda varaq butun ekranni qoplaydi.
      useRootNavigator: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: Text(l.mediaGallery),
              onTap: () {
                Navigator.pop(context);
                _pick(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_rounded),
              title: Text(l.mediaCamera),
              onTap: () {
                Navigator.pop(context);
                _pick(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }
}
