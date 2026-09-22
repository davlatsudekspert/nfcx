import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key, required this.profile});

  final IdentityProfile profile;

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  late final TextEditingController _name;
  late final TextEditingController _role;
  late final TextEditingController _about;
  late final TextEditingController _city;
  late final TextEditingController _phone;
  late final TextEditingController _telegram;
  late final TextEditingController _website;

  bool _busy = false;
  bool _uploading = false;
  String? _avatarUrl;
  String? _message;

  @override
  void initState() {
    super.initState();
    final p = widget.profile;
    _name = TextEditingController(text: p.name);
    _role = TextEditingController(text: p.role);
    _about = TextEditingController(text: p.about);
    _city = TextEditingController(text: p.city);
    _phone = TextEditingController(text: p.phone);
    _telegram = TextEditingController(
      text: p.tg.isEmpty ? '' : 't.me/' + p.tg,
    );
    _website = TextEditingController(text: p.website);
    _avatarUrl = p.avatarUrl;
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _role,
      _about,
      _city,
      _phone,
      _telegram,
      _website,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String get _telegramName {
    var v = _telegram.text.trim();
    if (v.isEmpty) return '';
    v = v.replaceFirst(RegExp(r'^https?://', caseSensitive: false), '');
    v = v.replaceFirst(RegExp(r'^(www\.)?t\.me/', caseSensitive: false), '');
    return v.replaceAll('@', '').trim();
  }

  Future<void> _pickAvatar() async {
    if (_uploading) return;
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
      maxWidth: 1600,
    );
    if (picked == null || !mounted) return;

    setState(() {
      _uploading = true;
      _message = null;
    });

    try {
      final bytes = await picked.readAsBytes();
      final lower = picked.name.toLowerCase();
      final type = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
      final url = await SessionScope.read(context).repo.uploadMedia(
            bytes,
            contentType: type,
          );
      if (!mounted) return;
      setState(() => _avatarUrl = url);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _message =
            e.key == 'too_large' ? 'Rasm hajmi juda katta.' : 'Rasm yuklanmadi.');
      }
    } catch (_) {
      if (mounted) setState(() => _message = 'Rasm yuklanmadi.');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _save() async {
    if (_busy) return;
    if (_name.text.trim().isEmpty) {
      setState(() => _message = 'Ism bo‘sh bo‘lmasin.');
      return;
    }
    if (_about.text.length > 160) {
      setState(() => _message = 'Haqida matni 160 belgidan oshmasin.');
      return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });

    try {
      final session = SessionScope.read(context);
      final current = await session.repo.profile(widget.profile.code);
      await session.repo.updateProfile(current.code, {
        'name': _name.text.trim(),
        'role': _role.text.trim(),
        'avatarUrl': _avatarUrl ?? current.avatarUrl ?? '',
        'bgUrl': current.coverUrl ?? '',
        'about': _about.text.trim(),
        'city': _city.text.trim(),
        'address': current.address,
        'phone': _phone.text.trim(),
        'email': current.email,
        'tg': _telegramName,
        'instagram': current.instagram,
        'website': _website.text.trim(),
        'profileType': current.profileType,
        'categorySlug': current.categorySlug,
        'extraLinks': current.extraLinks,
      });
      await session.refresh();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _message = switch (e.key) {
          'unauthorized' => 'Sessiya tugagan. Qayta kiring.',
          'bad_name' => 'Ism noto‘g‘ri.',
          'too_many_requests' => 'Birozdan keyin qayta urinib ko‘ring.',
          _ => e.detail.isNotEmpty ? e.detail : 'Profil saqlanmadi.',
        };
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'Profil saqlanmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Profilni tahrirlash',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 36),
        children: [
          Center(
            child: GestureDetector(
              onTap: _pickAvatar,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  BrandAvatar(
                    url: _avatarUrl,
                    size: 92,
                    goldRing: true,
                    fallback: _name.text,
                  ),
                  Positioned(
                    right: -2,
                    bottom: -2,
                    child: Container(
                      width: 31,
                      height: 31,
                      decoration: BoxDecoration(
                        color: p.ink,
                        shape: BoxShape.circle,
                        border: Border.all(color: p.background, width: 3),
                      ),
                      child: _uploading
                          ? Padding(
                              padding: const EdgeInsets.all(8),
                              child: CircularProgressIndicator(
                                strokeWidth: 1.7,
                                color: p.background,
                              ),
                            )
                          : Icon(
                              Icons.photo_camera_outlined,
                              size: 15,
                              color: p.background,
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 28),
          _Field(controller: _name, label: 'Ism va familiya'),
          const SizedBox(height: 12),
          _Field(controller: _role, label: 'Lavozim', maxLength: 60),
          const SizedBox(height: 12),
          _Field(
            controller: _about,
            label: 'Haqida',
            maxLines: 4,
            maxLength: 160,
          ),
          const SizedBox(height: 12),
          _Field(controller: _city, label: 'Shahar'),
          const SizedBox(height: 12),
          _Field(
            controller: _phone,
            label: 'Telefon',
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          _Field(
            controller: _telegram,
            label: 'Telegram',
            hint: 't.me/foydalanuvchi',
          ),
          const SizedBox(height: 12),
          _Field(
            controller: _website,
            label: 'Veb-sayt',
            keyboardType: TextInputType.url,
          ),
          if (_message != null) ...[
            const SizedBox(height: 14),
            Text(
              _message!,
              style: TextStyle(color: p.ink2, fontSize: 11.5),
            ),
          ],
          const SizedBox(height: 22),
          SizedBox(
            height: 54,
            child: FilledButton(
              onPressed: (_busy || _uploading) ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: p.ink,
                foregroundColor: p.background,
              ),
              child: _busy
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: p.background,
                      ),
                    )
                  : const Text('Saqlash'),
            ),
          ),
        ],
      ),
    );
  }
}

class CreateBusinessScreen extends StatefulWidget {
  const CreateBusinessScreen({super.key});

  @override
  State<CreateBusinessScreen> createState() => _CreateBusinessScreenState();
}

class _CreateBusinessScreenState extends State<CreateBusinessScreen> {
  final _name = TextEditingController();
  final _about = TextEditingController();
  final _city = TextEditingController();
  final _phone = TextEditingController();
  String _category = 'other';
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _name.dispose();
    _about.dispose();
    _city.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (_busy) return;
    if (_name.text.trim().isEmpty ||
        _city.text.trim().isEmpty ||
        _about.text.trim().length < 20) {
      setState(() => _message =
          'Nom, shahar va kamida 20 belgilik tavsifni to‘ldiring.');
      return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });

    try {
      final session = SessionScope.read(context);
      await session.repo.createCompany({
        'auto': true,
        'displayName': _name.text.trim(),
        'city': _city.text.trim(),
        'phone': _phone.text.trim(),
        'description': _about.text.trim(),
        'category': _category,
      });
      await session.refresh();
      session.setBusinessMode(true);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _message = switch (e.key) {
          'company_limit' => 'Business profil limiti tugagan.',
          'bad_company_id' => 'Business ID yaratilmadi.',
          _ => e.detail.isNotEmpty ? e.detail : 'Business yaratilmadi.',
        };
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'Business yaratilmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Yangi Business',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 36),
        children: [
          SurfaceCard(
            shadow: false,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.auto_awesome_rounded, color: p.accent),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    'Pullik nom tanlash shart emas. Business ID avtomatik va bepul yaratiladi.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _Field(controller: _name, label: 'Biznes nomi'),
          const SizedBox(height: 12),
          _Field(
            controller: _about,
            label: 'Tavsif',
            maxLines: 4,
            maxLength: 300,
          ),
          const SizedBox(height: 12),
          _Field(controller: _city, label: 'Shahar'),
          const SizedBox(height: 12),
          _Field(
            controller: _phone,
            label: 'Telefon',
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 17),
          Text(
            'Turkum',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 9),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final entry in const {
                'other': 'Boshqa',
                'cafe': 'Kafe',
                'restaurant': 'Restoran',
                'shop': 'Do‘kon',
                'service': 'Xizmat',
              }.entries)
                ChoiceChip(
                  label: Text(entry.value),
                  selected: _category == entry.key,
                  onSelected: (_) => setState(() => _category = entry.key),
                ),
            ],
          ),
          if (_message != null) ...[
            const SizedBox(height: 14),
            Text(
              _message!,
              style: TextStyle(color: p.ink2, fontSize: 11.5),
            ),
          ],
          const SizedBox(height: 22),
          SizedBox(
            height: 54,
            child: FilledButton(
              onPressed: _busy ? null : _create,
              style: FilledButton.styleFrom(
                backgroundColor: p.ink,
                foregroundColor: p.background,
              ),
              child: _busy
                  ? SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: p.background,
                      ),
                    )
                  : const Text('Business profilni yaratish'),
            ),
          ),
        ],
      ),
    );
  }
}

class SecurityScreen extends StatefulWidget {
  const SecurityScreen({super.key});

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _changePassword() async {
    if (_busy) return;
    if (_current.text.isEmpty) {
      setState(() => _message = 'Joriy parolni kiriting.');
      return;
    }
    if (_next.text.length < 6) {
      setState(() => _message = 'Yangi parol kamida 6 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (_next.text != _repeat.text) {
      setState(() => _message = 'Yangi parollar mos kelmadi.');
      return;
    }
    if (_next.text == _current.text) {
      setState(() => _message = 'Yangi parol eskisidan farq qilsin.');
      return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await SessionScope.read(context).repo.changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      if (!mounted) return;
      _current.clear();
      _next.clear();
      _repeat.clear();
      setState(() => _message = 'Parol muvaffaqiyatli o‘zgartirildi.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _message = switch (e.key) {
          'bad_password' || 'invalid_credentials' => 'Joriy parol noto‘g‘ri.',
          'weak_password' => 'Yangi parol juda oddiy.',
          'too_many_requests' => 'Juda ko‘p urinish. Biroz kuting.',
          _ => e.detail.isNotEmpty ? e.detail : 'Parol o‘zgartirilmadi.',
        };
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'Parol o‘zgartirilmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deleteAccount() async {
    final confirm = TextEditingController();
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hisobni butunlay o‘chirish'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Bu amal qaytarilmaydi. Tasdiqlash uchun DELETE deb yozing.',
            ),
            const SizedBox(height: 14),
            TextField(
              controller: confirm,
              autofocus: true,
              decoration: const InputDecoration(hintText: 'DELETE'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Bekor qilish'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(dialogContext, confirm.text.trim() == 'DELETE'),
            child: const Text('O‘chirish'),
          ),
        ],
      ),
    );
    confirm.dispose();

    if (approved != true || !mounted) return;
    setState(() => _busy = true);
    try {
      final session = SessionScope.read(context);
      await session.repo.deleteAccount();
      await session.signOut();
      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _message = 'Hisob o‘chirilmadi. Qayta urinib ko‘ring.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Xavfsizlik',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 36),
        children: [
          Text(
            'Parolni o‘zgartirish',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 14),
          _Field(
            controller: _current,
            label: 'Joriy parol',
            obscure: true,
          ),
          const SizedBox(height: 12),
          _Field(
            controller: _next,
            label: 'Yangi parol',
            obscure: true,
          ),
          const SizedBox(height: 12),
          _Field(
            controller: _repeat,
            label: 'Yangi parolni takrorlang',
            obscure: true,
          ),
          if (_message != null) ...[
            const SizedBox(height: 12),
            Text(
              _message!,
              style: TextStyle(color: p.ink2, fontSize: 11.5),
            ),
          ],
          const SizedBox(height: 18),
          SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: _busy ? null : _changePassword,
              style: FilledButton.styleFrom(
                backgroundColor: p.ink,
                foregroundColor: p.background,
              ),
              child: const Text('Parolni saqlash'),
            ),
          ),
          const SizedBox(height: 34),
          Divider(color: p.line),
          const SizedBox(height: 24),
          Text(
            'Xavfli amallar',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Hisob o‘chirilsa profillar va bog‘langan ma’lumotlar server qoidalari bo‘yicha o‘chiriladi.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 15),
          OutlinedButton.icon(
            onPressed: _busy ? null : _deleteAccount,
            icon: const Icon(Icons.delete_forever_outlined),
            label: const Text('Hisobni butunlay o‘chirish'),
          ),
        ],
      ),
    );
  }
}

class AboutAppScreen extends StatelessWidget {
  const AboutAppScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'NFCSTORE haqida',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 36),
        children: [
          Container(
            height: 212,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: const Color(0xFF111110),
              borderRadius: BorderRadius.circular(30),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'NFCSTORE',
                  style: TextStyle(
                    color: p.heroInk,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.8,
                  ),
                ),
                const Spacer(),
                const Text(
                  'More than a link.',
                  style: TextStyle(
                    color: Colors.white,
                    fontFamily: 'InstrumentSerif',
                    fontSize: 31,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Digital identity · Business · NFC',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: .5),
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'NFCSTORE V2',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 7),
          Text(
            'Premium raqamli identity platformasi. Ilovada to‘lov qabul qilinmaydi; xaridlar nfcstore.uz saytida yakunlanadi.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          Text(
            'Preview build · 2026',
            style: TextStyle(
              color: p.ink2,
              fontFamily: 'IBMPlexMono',
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    this.hint,
    this.maxLines = 1,
    this.maxLength,
    this.keyboardType,
    this.obscure = false,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final int maxLines;
  final int? maxLength;
  final TextInputType? keyboardType;
  final bool obscure;

  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        obscureText: obscure,
        maxLines: obscure ? 1 : maxLines,
        maxLength: maxLength,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          counterText: maxLength == null ? null : '',
        ),
      );
}
