import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../social/media_frame.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../profile/profile_repository.dart';
import 'session.dart';
import 'signup_intent.dart';
import '../../core/utils/media_url.dart';
import '../../core/media/image_cache.dart';

/// Ro'yxatdan o'tgandan keyingi profil to'ldirish.
///
/// Majburiy EMAS: "Keyinroq" tugmasi darhol Home'ga olib boradi.
/// Yangi foydalanuvchini birinchi ekrandayoq forma bilan to'sish
/// tashlab ketishning eng keng tarqalgan sababi.
class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _name = TextEditingController();
  final _bio = TextEditingController();
  final _picker = ImagePicker();
  bool _busy = false;
  String? _error;

  /// Yuklangan surat manzili — saqlashda profil bilan birga ketadi.
  String _avatarUrl = '';
  double _uploadProgress = 0;

  @override
  void initState() {
    super.initState();
    final user = ref.read(currentUserProvider);
    if (user != null) _name.text = user.displayName;
  }

  @override
  void dispose() {
    _name.dispose();
    _bio.dispose();
    super.dispose();
  }

  /// Avatar tanlash va yuklash.
  ///
  /// Ilgari bu doira `onTap: () {}` edi — ya'ni bosilardi, lekin
  /// hech narsa qilmasdi.
  Future<void> _pickAvatar() async {
    final l = L.of(context);
    final f = await _picker.pickImage(
      source: ImageSource.gallery,
      // Avatar hech qachon 800px dan katta ko'rsatilmaydi.
      maxWidth: 800,
      imageQuality: 88,
    );
    if (f == null || !mounted) return;

    setState(() {
      _busy = true;
      _uploadProgress = 0;
      _error = null;
    });
    final res = await ref.read(profileRepositoryProvider).uploadImage(
          f.path,
          onProgress: (sent, total) {
            if (mounted && total > 0) {
              setState(() => _uploadProgress = sent / total);
            }
          },
        );
    if (!mounted) return;
    setState(() {
      _busy = false;
      res.when(
        // `mediaUrl` — yuklash NISBIY yo'l qaytaradi
        // (`/uploads/...`) va u to'g'ridan-to'g'ri ko'rsatilsa,
        // yangi avatar ORNIGA bo'shliq chiqardi: rasm keshi
        // domensiz manzilni ocholmaydi. Model chegarasidagi
        // tuzatish bu yerga yetib kelmaydi — qiymat modeldan
        // emas, yuklash javobidan keladi.
        //
        // Serverga qaytishda `storageUrl` uni yana nisbiy
        // shaklga keltiradi, ya'ni bazada hech narsa
        // o'zgarmaydi.
        ok: (url) => _avatarUrl = mediaUrl(url),
        err: (e) => _error = describeError(l, e),
      );
    });
  }

  Future<void> _save() async {
    final l = L.of(context);
    final id = ref.read(myIdsProvider).firstOrNull;
    if (id == null) {
      // NFC ID hali berilmagan bo'lsa saqlaydigan joy yo'q — Home'da
      // foydalanuvchi ID yaratishi mumkin.
      if (mounted) finishSignup(context, ref);
      return;
    }

    setState(() => _busy = true);
    final res = await ref.read(profileRepositoryProvider).updateProfile(
          code: id.code,
          name: _name.text.trim(),
          bio: _bio.text.trim(),
          avatarUrl: _avatarUrl.isEmpty ? null : _avatarUrl,
        );
    if (!mounted) return;

    // Sessiya yangilanguncha tugma band — ikkinchi bosish yo'q.
    await res.when(
      ok: (_) async {
        await ref.read(sessionProvider.notifier).refresh();
        if (mounted) finishSignup(context, ref);
      },
      err: (e) async => setState(() => _error = describeError(l, e)),
    );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);

    return NovaScaffold(
      body: NovaScroll(
        padding: const EdgeInsets.fromLTRB(Gap.xxl, Gap.section, Gap.xxl, Gap.section),
        children: [
          Center(
            child: Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: t.success.withValues(alpha: .13),
                shape: BoxShape.circle,
                border: Border.all(color: t.success.withValues(alpha: .32)),
              ),
              child: Icon(Icons.check_rounded, size: 33, color: t.success),
            ),
          ),
          const SizedBox(height: Gap.xl),
          Text(l.setupTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayMedium),
          const SizedBox(height: Gap.sm),
          Text(l.setupSubtitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium),
          // SERVER BERGAN BEPUL NFC ID — birinchi kundan ko'rinsin.
          //
          // Server ro'yxatdan o'tishda avtomatik 8 xonali ID beradi
          // (`createFreeAutoId`). Ilgari odam uni faqat Home'ga
          // tushgandagina ko'rardi; endi hisob ochilgan zahoti — bu
          // "menda allaqachon NFC ID bor" degan his beradi.
          if (ref.watch(myIdsProvider).firstOrNull case final id?) ...[
            const SizedBox(height: Gap.lg),
            Center(
              child: Container(
                key: const ValueKey('setup-free-id'),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Color.lerp(t.surfaceSolid, t.brandSoft, .5),
                  borderRadius: R.pill,
                  border: Border.all(color: t.brand.withValues(alpha: .6)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(l.setupFreeId.toUpperCase(),
                        style: AppType.eyebrow(color: t.brandInk, size: 9)),
                    const SizedBox(width: Gap.md),
                    Text(
                      id.code,
                      style: AppType.monoStyle(
                          color: t.text1,
                          size: 15,
                          weight: FontWeight.w600,
                          letterSpacing: 2.2),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: Gap.section),
          Center(
            child: PressableScale(
              onTap: _busy ? null : _pickAvatar,
              child: Container(
                width: 92,
                height: 92,
                decoration: BoxDecoration(
                  gradient: t.accentGradient,
                  shape: BoxShape.circle,
                  boxShadow: t.shadowSoft,
                ),
                clipBehavior: Clip.antiAlias,
                alignment: Alignment.center,
                child: _busy && _uploadProgress > 0
                    ? CircularProgressIndicator(
                        value: _uploadProgress,
                        strokeWidth: 2.4,
                        color: t.onAccent,
                      )
                    : _avatarUrl.isNotEmpty
                        ? CachedNetworkImage(
                            cacheManager: NovaImageCache.manager,
                            fadeOutDuration: NovaImageCache.fadeOut,
                            fadeInDuration: NovaImageCache.fadeIn,
                            imageUrl: _avatarUrl,
                            fit: BoxFit.cover,
                            memCacheWidth: decodeWidth(context, 92),
                            width: 92,
                            height: 92,
                          )
                        : Stack(
                            alignment: Alignment.center,
                            children: [
                              Text(
                                user?.initials ?? 'N',
                                style: AppType.displayStyle(
                                    color: t.onAccent, size: 33),
                              ),
                              Positioned(
                                right: 6,
                                bottom: 6,
                                child: Icon(Icons.photo_camera_rounded,
                                    size: 17, color: t.onAccent),
                              ),
                            ],
                          ),
              ),
            ),
          ),
          const SizedBox(height: Gap.xxl),
          NovaField(
            label: l.fieldName,
            controller: _name,
            enabled: !_busy,
            textCapitalization: TextCapitalization.words,
          ),
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.fieldBio,
            controller: _bio,
            maxLines: 3,
            maxLength: 160,
            enabled: !_busy,
          ),
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: t.error,
              ),
            ),
          ],
          const SizedBox(height: Gap.xxl),
          NovaButton(label: l.actionSave, busy: _busy, onPressed: _save),
          const SizedBox(height: Gap.md),
          NovaButton(
            label: l.setupSkip,
            tone: ButtonTone.quiet,
            onPressed: _busy ? null : () => finishSignup(context, ref),
          ),
        ],
      ),
    );
  }
}
