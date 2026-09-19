import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
  }

  Future<void> _pickAvatar() async {
    final l = L.of(context);
    final f = await _picker.pickImage(
      source: ImageSource.gallery,
      // Avatar hech qachon 800px dan katta ko'rsatilmaydi — kattaroq
      // faylni yuklash trafikni bekorga sarflardi.
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
          Center(
            child: Stack(
              children: [
                Avatar(url: _avatarUrl, initials: user.initials, size: 104),
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
