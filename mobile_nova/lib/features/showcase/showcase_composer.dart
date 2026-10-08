import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../app/profile_context.dart';
import '../../core/utils/media_url.dart';
import '../../data/models/models.dart';
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
import '../business/business_providers.dart' show businessCatalogProvider;
import '../home/home_screen.dart' show homeFeedProvider;
import '../profile/profile_repository.dart';
import '../profile/profile_screen.dart'
    show companyPostsProvider, profilePostsProvider;
import '../shop/store_policy.dart' show isAppStoreBuild;
import '../social/content_rules.dart';
import '../social/media_frame.dart' show mediaImage;
import '../social/music_picker.dart';
import 'showcase_common.dart';
import 'showcase_screen.dart' show showcaseProvider;

/// RASM MANBAI — FAQAT RASM (video tanlab bo'lmaydi).
///
/// Galereyadan bir nechta yoki kameradan bitta. Post yaratish bilan bir
/// xil kichraytirish: eni ≤ 1600 px, sifat 85 (keyin `uploadImage` o'zi
/// ham server chegarasiga moslaydi). Testda soxtasi beriladi.
abstract class ShowcaseImageSource {
  /// Galereyadan ko'pi bilan [limit] ta rasm (fayl yo'llari).
  Future<List<String>> gallery(int limit);

  /// Kameradan bitta rasm (`null` — bekor).
  Future<String?> camera();
}

class _PickerSource implements ShowcaseImageSource {
  final _picker = ImagePicker();

  @override
  Future<List<String>> gallery(int limit) async {
    if (limit <= 0) return const [];
    // `limit` < 2 ni ba'zi platformalar qabul qilmaydi — bitta rasm.
    if (limit == 1) {
      final f = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 85,
      );
      return f == null ? const [] : [f.path];
    }
    final list = await _picker.pickMultiImage(
      maxWidth: 1600,
      imageQuality: 85,
      limit: limit,
    );
    return list.take(limit).map((f) => f.path).toList();
  }

  @override
  Future<String?> camera() async {
    final f = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1600,
      imageQuality: 85,
    );
    return f?.path;
  }
}

final showcaseImageSourceProvider = Provider<ShowcaseImageSource>(
  (_) => _PickerSource(),
);

/// Tanlangan rasm: telefondagi fayl yoki katalogdan kelgan (allaqachon
/// serverda turgan) rasm.
sealed class _Img {
  const _Img();
}

class _Local extends _Img {
  const _Local(this.path);
  final String path;
}

class _Remote extends _Img {
  const _Remote(this.url);
  final String url;
}

/// KO'RGAZMA YARATISH — `/showcase/create`.
///
/// 1–5 rasm, sarlavha (≤ 80), tavsif, ixtiyoriy narx (so'm), biznesda
/// katalogdan tovar, ixtiyoriy YouTube/Instagram havolasi, musiqa va
/// slayd vaqti. Chop etishdan oldin kontent qoidalari darvozasi.
class ShowcaseComposerScreen extends ConsumerStatefulWidget {
  const ShowcaseComposerScreen({super.key});

  @override
  ConsumerState<ShowcaseComposerScreen> createState() =>
      _ShowcaseComposerScreenState();
}

class _ShowcaseComposerScreenState
    extends ConsumerState<ShowcaseComposerScreen> {
  final _title = TextEditingController();
  final _desc = TextEditingController();
  final _price = TextEditingController();
  final _link = TextEditingController();

  final _images = <_Img>[];
  MusicTrack? _music;
  int _seconds = ShowcaseLimits.defaultSlideSeconds;
  CatalogItem? _item;

  bool _busy = false;
  String? _error;

  /// Yuklanayotgan rasm (1 dan) va uning ulushi.
  int _uploading = 0;
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    // «Shu musiqani ishlatish» dan kelindi — trek oldindan tanlangan.
    final pending = ref.read(pendingComposerMusicProvider);
    if (pending != null) {
      _music = pending;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref.read(pendingComposerMusicProvider.notifier).state = null;
        }
      });
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    _price.dispose();
    _link.dispose();
    super.dispose();
  }

  int get _free => ShowcaseLimits.maxImages - _images.length;

  Future<void> _addFromGallery() async {
    final paths = await ref.read(showcaseImageSourceProvider).gallery(_free);
    if (!mounted || paths.isEmpty) return;
    setState(() {
      _images.addAll(paths.take(_free).map(_Local.new));
      _error = null;
    });
  }

  Future<void> _addFromCamera() async {
    final path = await ref.read(showcaseImageSourceProvider).camera();
    if (!mounted || path == null || _free <= 0) return;
    setState(() {
      _images.add(_Local(path));
      _error = null;
    });
  }

  void _showSourcePicker() {
    final l = L.of(context);
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              key: const ValueKey('showcase-pick-gallery'),
              leading: const Icon(Icons.photo_library_rounded),
              title: Text(l.mediaGallery),
              onTap: () {
                Navigator.pop(sheet);
                _addFromGallery();
              },
            ),
            ListTile(
              key: const ValueKey('showcase-pick-camera'),
              leading: const Icon(Icons.photo_camera_rounded),
              title: Text(l.mediaCamera),
              onTap: () {
                Navigator.pop(sheet);
                _addFromCamera();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickMusic() async {
    final picked = await showMusicPicker(context);
    if (picked != null && mounted) setState(() => _music = picked);
  }

  /// KATALOGDAN — sarlavha, narx va rasmlar oldindan to'ldiriladi.
  Future<void> _pickFromCatalog(String companyId) async {
    final item = await showModalBottomSheet<CatalogItem>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: context.tokens.surfaceSolid,
      builder: (_) => _CatalogPickerSheet(companyId: companyId),
    );
    if (item == null || !mounted) return;
    setState(() {
      _item = item;
      final name = item.name.trim();
      _title.text = name.length > ShowcaseLimits.titleMax
          ? name.substring(0, ShowcaseLimits.titleMax)
          : name;
      if (!item.priceOnRequest && !item.priceSoon && item.effectivePrice > 0) {
        _price.text = groupThousands(item.effectivePrice);
      }
      if (_desc.text.trim().isEmpty && item.description.trim().isNotEmpty) {
        _desc.text = item.description.trim();
      }
      // Avvalgi tovarning rasmlari olinadi, yangisiniki boshiga.
      _images.removeWhere((e) => e is _Remote);
      final room = ShowcaseLimits.maxImages - _images.length;
      final remote = item.images.isNotEmpty
          ? item.images
          : [if (item.imageUrl.isNotEmpty) item.imageUrl];
      _images.insertAll(0, remote.take(room).map(_Remote.new));
      _error = null;
    });
  }

  Future<void> _publish() async {
    final l = L.of(context);
    final profile = ref.read(activeProfileProvider);
    if (profile == null) return;

    final issues = validateShowcase(
      images: _images.length,
      title: _title.text,
      price: _price.text,
      link: _link.text,
    );
    if (issues.isNotEmpty) {
      setState(() => _error = showcaseIssueText(l, issues.first));
      return;
    }

    // Kontent qoidalari — yuklashdan OLDIN (rasm avtomatik tekshiriladi).
    if (!await ensureContentRules(context, ref)) {
      if (mounted) setState(() => _error = l.rulesNotAccepted);
      return;
    }
    if (!mounted) return;

    setState(() {
      _busy = true;
      _error = null;
      _uploading = 0;
      _progress = 0;
    });

    // Har rasm — post bilan bir xil yo'l (`/api/upload`, base64).
    final repo = ref.read(profileRepositoryProvider);
    final urls = <String>[];
    for (var i = 0; i < _images.length; i++) {
      final img = _images[i];
      setState(() {
        _uploading = i + 1;
        _progress = 0;
      });
      switch (img) {
        case _Remote(:final url):
          urls.add(storageUrl(url));
        case _Local(:final path):
          final up = await repo.uploadImage(
            path,
            onProgress: (sent, total) {
              if (mounted && total > 0) {
                setState(() => _progress = sent / total);
              }
            },
          );
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
          urls.add(url);
      }
    }

    final title = _title.text.trim();
    final draft = ShowcaseDraft(
      mediaUrls: urls,
      title: title,
      text: _desc.text.trim(),
      priceUzs: parsePriceInput(_price.text),
      catalogItemId: profile.isBusiness ? _item?.key : null,
      linkUrl: _link.text.trim(),
      musicId: _music?.id,
      musicStart: _music?.start ?? 0,
      imageSeconds: _seconds,
    );
    final res = await ref
        .read(socialRepositoryProvider)
        .createShowcase(
          code: profile.code,
          company: profile.isBusiness,
          draft: draft,
        );
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (created) {
        // Media hali tekshirilmagan — post faqat egasiga ko'rinadi.
        if (created?.pending == true) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(l.pendingPublished)));
        }
        ref.invalidate(showcaseProvider);
        ref.invalidate(homeFeedProvider);
        ref.invalidate(
          profile.isBusiness
              ? companyPostsProvider(profile.code)
              : profilePostsProvider(profile.code),
        );
        context.pop();
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final profile = ref.watch(activeProfileProvider);

    if (profile == null) {
      return NovaScaffold(
        showBack: true,
        title: l.showcaseCreate,
        body: StatePanel(
          icon: Icons.badge_outlined,
          title: l.homeNoId,
          message: isAppStoreBuild ? l.homeNoIdHintIos : l.homeNoIdHint,
        ),
      );
    }

    return NovaScaffold(
      title: l.showcaseCreate,
      showBack: true,
      body: NovaScroll(
        children: [
          Text(l.showcasePhotos, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 4),
          Text(
            l.showcasePhotosHint,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: Gap.md),
          // Hammasi ko'rinib turadi (ko'pi bilan 5 ta + "qo'shish").
          Wrap(
            key: const ValueKey('showcase-images'),
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              for (var i = 0; i < _images.length; i++)
                _Thumb(
                  key: ValueKey('showcase-thumb-$i'),
                  image: _images[i],
                  cover: i == 0,
                  onRemove: _busy
                      ? null
                      : () => setState(() => _images.removeAt(i)),
                ),
              if (_free > 0)
                PressableScale(
                  key: const ValueKey('showcase-add-image'),
                  onTap: _busy ? null : _showSourcePicker,
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: t.surface2,
                      borderRadius: R.tile,
                      border: Border.all(color: t.border2),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_photo_alternate_rounded, color: t.text2),
                        const SizedBox(height: 4),
                        Text(
                          '${_images.length}/${ShowcaseLimits.maxImages}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          if (profile.isBusiness) ...[
            const SizedBox(height: Gap.lg),
            if (_item == null)
              NovaButton(
                key: const ValueKey('showcase-from-catalog'),
                label: l.showcaseFromCatalog,
                icon: Icons.inventory_2_outlined,
                tone: ButtonTone.quiet,
                onPressed: _busy ? null : () => _pickFromCatalog(profile.code),
              )
            else
              Row(
                key: const ValueKey('showcase-catalog-picked'),
                children: [
                  Icon(Icons.inventory_2_outlined, size: 18, color: t.text2),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Text(
                      l.showcaseCatalogPicked(_item!.name),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                  IconButton(
                    tooltip: l.showcaseCatalogRemove,
                    onPressed: _busy
                        ? null
                        : () => setState(() => _item = null),
                    icon: Icon(Icons.close_rounded, color: t.text2),
                  ),
                ],
              ),
          ],
          const SizedBox(height: Gap.xl),
          NovaField(
            key: const ValueKey('showcase-title'),
            label: l.showcaseTitleLabel,
            controller: _title,
            maxLength: ShowcaseLimits.titleMax,
            enabled: !_busy,
            textCapitalization: TextCapitalization.sentences,
          ),
          const SizedBox(height: Gap.md),
          NovaField(
            key: const ValueKey('showcase-desc'),
            label: l.showcaseDescLabel,
            controller: _desc,
            maxLines: 4,
            maxLength: 600,
            enabled: !_busy,
            textCapitalization: TextCapitalization.sentences,
          ),
          const SizedBox(height: Gap.md),
          NovaField(
            key: const ValueKey('showcase-price'),
            label: l.showcasePriceLabel,
            controller: _price,
            keyboardType: TextInputType.number,
            inputFormatters: const [ThousandsInputFormatter()],
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.md),
          NovaField(
            key: const ValueKey('showcase-link'),
            label: l.showcaseLinkLabel,
            hint: 'https://youtu.be/…',
            controller: _link,
            keyboardType: TextInputType.url,
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.lg),
          _music == null
              ? NovaButton(
                  key: const ValueKey('showcase-music-add'),
                  label: l.musicAdd,
                  icon: Icons.music_note_rounded,
                  tone: ButtonTone.quiet,
                  onPressed: _busy ? null : _pickMusic,
                )
              : Row(
                  key: const ValueKey('showcase-music-picked'),
                  children: [
                    Flexible(
                      child: MusicChip(
                        track: _music!,
                        onTap: _busy ? () {} : _pickMusic,
                      ),
                    ),
                    const SizedBox(width: Gap.xs),
                    IconButton(
                      tooltip: l.musicRemove,
                      onPressed: _busy
                          ? null
                          : () => setState(() => _music = null),
                      icon: Icon(Icons.close_rounded, color: t.text2),
                    ),
                  ],
                ),
          const SizedBox(height: Gap.lg),
          Text(
            l.showcaseSlideSeconds,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: Gap.sm),
          Wrap(
            spacing: Gap.sm,
            runSpacing: Gap.sm,
            children: [
              for (final s in ShowcaseLimits.slideSeconds)
                Capsule(
                  key: ValueKey('showcase-seconds-$s'),
                  label: l.showcaseSeconds(s),
                  selected: _seconds == s,
                  onTap: _busy ? null : () => setState(() => _seconds = s),
                ),
            ],
          ),
          if (_busy && _uploading > 0) ...[
            const SizedBox(height: Gap.xl),
            ClipRRect(
              borderRadius: R.pill,
              child: LinearProgressIndicator(
                key: const ValueKey('showcase-progress'),
                value: (_uploading - 1 + _progress) / _images.length,
                minHeight: 6,
                backgroundColor: t.surface2,
                valueColor: AlwaysStoppedAnimation(t.accent2),
              ),
            ),
            const SizedBox(height: Gap.sm),
            Text(
              l.showcaseUploading(_uploading, _images.length),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(
              _error!,
              key: const ValueKey('showcase-error'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: t.error,
              ),
            ),
          ],
          const SizedBox(height: Gap.xl),
          const ContentRulesCard(),
          const SizedBox(height: Gap.xl),
          NovaButton(
            key: const ValueKey('showcase-publish'),
            label: l.showcasePublish,
            busy: _busy,
            onPressed: _publish,
          ),
          const ContentRulesNote(),
        ],
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({
    super.key,
    required this.image,
    required this.cover,
    this.onRemove,
  });

  final _Img image;
  final bool cover;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final img = switch (image) {
      _Local(:final path) => Image.file(
        File(path),
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Icon(Icons.image_rounded, color: t.text3),
      ),
      _Remote(:final url) => mediaImage(context, url, fit: BoxFit.cover),
    };
    return SizedBox(
      width: 96,
      height: 96,
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: R.tile,
            child: ColoredBox(color: t.surface2, child: img),
          ),
          if (cover)
            Positioned(
              left: 6,
              bottom: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: .55),
                  borderRadius: R.pill,
                ),
                child: const Icon(
                  Icons.star_rounded,
                  size: 12,
                  color: Colors.white,
                ),
              ),
            ),
          Positioned(
            right: 0,
            top: 0,
            child: Semantics(
              button: true,
              label: l.showcaseRemovePhoto,
              excludeSemantics: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onRemove,
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: .6),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Kompaniya katalogidan tovar tanlash.
class _CatalogPickerSheet extends ConsumerWidget {
  const _CatalogPickerSheet({required this.companyId});
  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final catalog = ref.watch(businessCatalogProvider(companyId));
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * .7,
      child: catalog.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, __) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(businessCatalogProvider(companyId)),
        ),
        data: (items) => items.isEmpty
            ? StatePanel(
                icon: Icons.inventory_2_outlined,
                title: l.showcaseCatalogEmpty,
              )
            : ListView.builder(
                key: const ValueKey('showcase-catalog-list'),
                itemCount: items.length,
                itemBuilder: (_, i) {
                  final it = items[i];
                  return ListTile(
                    key: ValueKey('showcase-catalog-${it.key}'),
                    leading: ClipRRect(
                      borderRadius: R.tile,
                      child: SizedBox(
                        width: 48,
                        height: 48,
                        child: it.imageUrl.isEmpty
                            ? ColoredBox(
                                color: t.surface2,
                                child: Icon(
                                  Icons.inventory_2_outlined,
                                  color: t.text3,
                                ),
                              )
                            : mediaImage(
                                context,
                                it.imageUrl,
                                fit: BoxFit.cover,
                              ),
                      ),
                    ),
                    title: Text(
                      it.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: it.priceOnRequest || it.effectivePrice <= 0
                        ? null
                        : Text(formatUzs(l, it.effectivePrice)),
                    onTap: () => Navigator.of(context).pop(it),
                  );
                },
              ),
      ),
    );
  }
}

/// Narx maydoni: faqat raqam, uch xonadan bo'shliq bilan ajratiladi
/// ("125 000"). Boshqa belgilar kiritilmaydi.
class ThousandsInputFormatter extends TextInputFormatter {
  const ThousandsInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return const TextEditingValue();
    // 13 xonadan uzun — ortig'i olinmaydi (chegara 10 mlrd).
    final trimmed = digits.length > 13 ? digits.substring(0, 13) : digits;
    final noLead = trimmed.replaceFirst(RegExp(r'^0+(?=\d)'), '');
    final text = groupThousands(int.parse(noLead));
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
