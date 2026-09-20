import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/session.dart';
import '../home/home_screen.dart';
import '../home/widgets/avatar.dart';
import 'profile_repository.dart';
import '../social/media_frame.dart';
import '../../core/utils/media_url.dart';

/// Profilni tahrirlash.
///
/// Backend'da profil = NFC ID (`record`), shuning uchun tahrirlash
/// FAOL ID ga tegishli. ID bo'lmasa tahrirlaydigan narsa yo'q va
/// buni ekran ochiq aytadi.
class ProfileEditScreen extends ConsumerStatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  ConsumerState<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends ConsumerState<ProfileEditScreen> {
  final _name = TextEditingController();
  final _role = TextEditingController();
  final _bio = TextEditingController();
  final _picker = ImagePicker();

  bool _filled = false;
  bool _busy = false;
  String? _error;
  String _avatarUrl = '';

  /// MUQOVA RASMI — profil tepasidagi keng rasm.
  ///
  /// Server buni `bgUrl` deb saqlaydi, model `coverUrl` deb o'qiydi
  /// va profil ekrani uni ALLAQACHON chizadi. Yetishmagani faqat
  /// shu yer edi: tahrir oynasida uni qo'yish yo'li yo'q edi, ya'ni
  /// odam o'z profilining tepa qismini o'zgartira olmasdi.
  String _coverUrl = '';

  /// PROFIL MUSIQASI — ko'pi bilan 5 ta.
  ///
  /// Chegara serverdan: oddiy hisobda 5, Premiumda 10
  /// (`musicLimitD1`). Ilova eng qat'iysini qo'llaydi, shuning
  /// uchun serverga sig'maydigan ro'yxat yuborilmaydi.
  List<String> _music = const [];
  static const _musicMax = 5;
  double _uploadProgress = 0;

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
    _avatarUrl = id.avatarUrl;
    _coverUrl = id.coverUrl;
    _music = List<String>.from(id.musicUrls);
  }

  /// MUSIQA QO'SHISH.
  ///
  /// `image_picker` audio tanlay olmaydi — shuning uchun
  /// `file_picker`. Fayl OQIM bilan yuboriladi
  /// (`/api/upload-file`), base64 emas.
  Future<void> _pickMusic() async {
    final l = L.of(context);
    final picked = await FilePicker.pickFiles(
      type: FileType.audio,
      withData: false,
    );
    final path = picked?.files.singleOrNull?.path;
    if (path == null || !mounted) return;

    setState(() {
      _busy = true;
      _uploadProgress = 0;
      _error = null;
    });
    final res = await ref.read(profileRepositoryProvider).uploadAudio(
          path,
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
        // Avatar bilan bir xil sabab: yuklash NISBIY yo'l
        // qaytaradi, pleyer esa domensiz manzilni ocholmaydi.
        // Serverga qaytishda `storageUrl` uni yana nisbiy
        // shaklga keltiradi.
        ok: (url) {
          if (url.isNotEmpty) _music = [..._music, mediaUrl(url)];
        },
        err: (e) => _error = describeError(l, e),
      );
    });
  }

  Future<void> _pickAvatar() => _pickImage(cover: false);

  Future<void> _pickCover() => _pickImage(cover: true);

  /// AVATAR VA MUQOVA — BITTA YO'L.
  ///
  /// Farqi faqat o'lchamda va natija qaysi maydonga tushishida.
  /// Ikkita deyarli bir xil usul yozish keyin ularning biri
  /// tuzatilib, ikkinchisi unutilishiga olib kelardi.
  Future<void> _pickImage({required bool cover}) async {
    final l = L.of(context);
    final f = await _picker.pickImage(
      source: ImageSource.gallery,
      // Avatar hech qachon 800px dan katta ko'rsatilmaydi; muqova
      // esa ekran kengligida turadi, shuning uchun unga kengroq
      // ruxsat. Kattaroq faylni yuklash trafikni bekorga sarflardi.
      maxWidth: cover ? 1600 : 800,
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
        // yangi rasm ORNIGA bo'shliq chiqardi: rasm keshi
        // domensiz manzilni ocholmaydi. Model chegarasidagi
        // tuzatish bu yerga yetib kelmaydi — qiymat modeldan
        // emas, yuklash javobidan keladi.
        //
        // Serverga qaytishda `storageUrl` uni yana nisbiy
        // shaklga keltiradi, ya'ni bazada hech narsa
        // o'zgarmaydi.
        ok: (url) {
          if (cover) {
            _coverUrl = mediaUrl(url);
          } else {
            _avatarUrl = mediaUrl(url);
          }
        },
        err: (e) => _error = e.kind.name == 'endpointMissing'
            ? l.uploadFailed
            : describeError(l, e),
      );
    });
  }

  Future<void> _save(NfcId id) async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(profileRepositoryProvider).updateProfile(
          code: id.code,
          name: _name.text.trim(),
          role: _role.text.trim(),
          bio: _bio.text.trim(),
          avatarUrl: _avatarUrl.isEmpty ? null : _avatarUrl,
          coverUrl: _coverUrl.isEmpty ? null : _coverUrl,
          musicUrls: _music,
        );
    if (!mounted) return;
    setState(() => _busy = false);
    await res.when(
      ok: (_) async {
        await ref.read(sessionProvider.notifier).refresh();
        if (!mounted) return;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l.profileSaved)));
        context.pop();
      },
      err: (e) async => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final id = ref.watch(activeIdProvider);

    if (user == null) return const SizedBox.shrink();
    if (id == null) {
      return NovaScaffold(
        title: l.profileEdit,
        showBack: true,
        body: StatePanel(
          icon: Icons.badge_outlined,
          title: l.homeNoId,
          message: l.homeNoIdHint,
        ),
      );
    }
    _fillOnce(id);

    return NovaScaffold(
      title: l.profileEdit,
      showBack: true,
      body: NovaScroll(
        children: [
          // MUQOVA + AVATAR — profil tepasi qanday ko'rinsa,
          // tahrirda ham shunday turadi. Ilgari bu yerda faqat
          // avatar bor edi va muqovani umuman qo'yib bo'lmasdi.
          SizedBox(
            height: 176,
            child: Stack(
              alignment: Alignment.topCenter,
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  child: PressableScale(
                    onTap: _busy ? null : _pickCover,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(22),
                      child: SizedBox(
                        height: 124,
                        width: double.infinity,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            if (_coverUrl.isEmpty)
                              DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [t.surface2, t.surface],
                                  ),
                                ),
                              )
                            else
                              mediaImage(context, _coverUrl,
                                  fit: BoxFit.cover),
                            // Tugma har qanday rasm ustida
                            // o'qiladigan bo'lishi uchun yengil
                            // qorong'ilashtirish.
                            DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    Colors.black.withValues(alpha: .10),
                                    Colors.black.withValues(alpha: .34),
                                  ],
                                ),
                              ),
                            ),
                            Align(
                              alignment: Alignment.topRight,
                              child: Padding(
                                padding: const EdgeInsets.all(Gap.md),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: Gap.md, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: .42),
                                    borderRadius: R.pill,
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(Icons.image_rounded,
                                          size: 13, color: Colors.white),
                                      const SizedBox(width: 6),
                                      Text(
                                        l.profileCover,
                                        style: TextStyle(
                                          fontFamily: AppType.sans,
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: .3,
                                          color: Colors.white
                                              .withValues(alpha: .92),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 72,
                  child: Stack(
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: t.bg1, width: 3),
                        ),
                        child: Avatar(
                            url: _avatarUrl,
                            initials: user.initials,
                            size: 104),
                      ),
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: PressableScale(
                          onTap: _busy ? null : _pickAvatar,
                          child: Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              gradient: t.accentGradient,
                              shape: BoxShape.circle,
                              border: Border.all(color: t.bg1, width: 2.5),
                            ),
                            child: Icon(Icons.photo_camera_rounded,
                                size: 15, color: t.onAccent),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_busy && _uploadProgress > 0) ...[
            const SizedBox(height: Gap.lg),
            ClipRRect(
              borderRadius: R.pill,
              child: LinearProgressIndicator(
                value: _uploadProgress,
                minHeight: 5,
                backgroundColor: t.surface2,
                valueColor: AlwaysStoppedAnimation(t.accent2),
              ),
            ),
          ],
          const SizedBox(height: Gap.section),
          NovaField(
            label: l.fieldName,
            controller: _name,
            enabled: !_busy,
            textCapitalization: TextCapitalization.words,
          ),
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
          const SizedBox(height: Gap.xl),
          // ── PROFIL MUSIQASI ─────────────────────────────────
          //
          // Ilgari ilovada musiqa qo'shish IMKONI YO'Q edi:
          // `MusicControl` faqat serverdan kelgan ro'yxatni
          // IJRO ETARDI, qo'shish esa faqat saytda mumkin edi.
          Row(
            children: [
              Icon(Icons.music_note_rounded, size: 17, color: t.text3),
              const SizedBox(width: Gap.sm),
              Expanded(
                child: Text(
                  l.profileMusic,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ),
              Text('${_music.length}/$_musicMax',
                  style: AppType.monoStyle(color: t.text3, size: 11.5)),
            ],
          ),
          const SizedBox(height: Gap.sm),
          for (var i = 0; i < _music.length; i++) ...[
            FloatingSurface(
              solid: true,
              padding: const EdgeInsets.fromLTRB(Gap.md, Gap.sm, Gap.sm, Gap.sm),
              child: Row(
                children: [
                  Icon(Icons.audiotrack_rounded, size: 16, color: t.accent2),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: Text(
                      // Manzilning oxirgi bo'lagi — fayl nomi.
                      Uri.parse(_music[i]).pathSegments.isEmpty
                          ? _music[i]
                          : Uri.parse(_music[i]).pathSegments.last,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 12.5,
                          color: t.text2),
                    ),
                  ),
                  NovaIconButton(
                    icon: Icons.close_rounded,
                    tooltip: l.actionDelete,
                    size: 34,
                    onPressed: _busy
                        ? null
                        : () => setState(() =>
                            _music = [..._music]..removeAt(i)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: Gap.sm),
          ],
          if (_music.length < _musicMax)
            NovaButton(
              label: l.profileMusicAdd,
              icon: Icons.add_rounded,
              tone: ButtonTone.quiet,
              onPressed: _busy ? null : _pickMusic,
            ),
          const SizedBox(height: Gap.lg),
          FloatingSurface(
            solid: true,
            child: Row(
              children: [
                Icon(Icons.nfc_rounded, size: 17, color: t.text3),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Text(id.code,
                      style: AppType.monoStyle(color: t.text2, size: 12.5)),
                ),
                Text(l.fieldEmail,
                    style: Theme.of(context).textTheme.labelMedium),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: t.error)),
          ],
          const SizedBox(height: Gap.xxl),
          NovaButton(
              label: l.actionSave, busy: _busy, onPressed: () => _save(id)),
        ],
      ),
    );
  }
}
