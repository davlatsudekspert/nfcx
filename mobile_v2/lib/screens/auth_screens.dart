import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

enum AccountKind { personal, business }

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _email = TextEditingController();
  final _phone = TextEditingController(text: '+998');
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _promo = TextEditingController();

  final _businessName = TextEditingController();
  final _businessAbout = TextEditingController();
  final _businessCity = TextEditingController();
  final _businessPhone = TextEditingController();

  AccountKind? _kind;
  String _category = 'other';
  bool _codeSent = false;
  bool _busy = false;
  bool _terms = false;
  bool _obscure = true;
  String? _message;

  @override
  void dispose() {
    for (final c in [
      _email,
      _phone,
      _password,
      _code,
      _promo,
      _businessName,
      _businessAbout,
      _businessCity,
      _businessPhone,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String _cleanPhone(String value) =>
      value.replaceAll(RegExp(r'[^0-9+]'), '').trim();

  Future<void> _sendCode() async {
    final email = _email.text.trim();
    final phone = _cleanPhone(_phone.text);
    if (_busy) return;
    if (_kind == null) {
      setState(() => _message = 'Avval Personal yoki Business ni tanlang.');
      return;
    }
    if (!email.contains('@')) {
      setState(() => _message = 'Email manzilini to‘g‘ri kiriting.');
      return;
    }
    if (phone.replaceAll('+', '').length < 9) {
      setState(() => _message = 'Telefon raqamini to‘g‘ri kiriting.');
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _message = 'Parol kamida 6 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (!_terms) {
      setState(() => _message = 'Davom etish uchun shartlarga rozilik bering.');
      return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final channel = await SessionScope.read(context).repo.requestRegisterCode(
        email: email,
        phone: phone,
      );
      if (!mounted) return;
      setState(() {
        _codeSent = true;
        _message = channel == 'none'
            ? 'Tasdiqlash xizmati vaqtincha o‘chiq. Davom etishingiz mumkin.'
            : 'Tasdiqlash kodi emailingizga yuborildi.';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _message = _authError(e));
    } catch (_) {
      if (mounted) setState(() => _message = 'Kod yuborilmadi. Qayta urinib ko‘ring.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  bool _validateBusiness() {
    if (_kind != AccountKind.business) return true;
    if (_businessName.text.trim().isEmpty ||
        _businessCity.text.trim().isEmpty ||
        _businessAbout.text.trim().length < 20) {
      setState(() => _message =
          'Business uchun nom, shahar va kamida 20 belgilik tavsifni to‘ldiring.');
      return false;
    }
    return true;
  }

  Future<void> _register() async {
    if (_busy) return;
    final email = _email.text.trim();
    final phone = _cleanPhone(_phone.text);
    final password = _password.text;
    final code = _code.text.trim();

    if (_kind == null) {
      setState(() => _message = 'Personal yoki Business ni tanlang.');
      return;
    }
    if (email.isEmpty || phone.isEmpty || password.length < 6) {
      setState(() => _message = 'Email, telefon va parolni to‘liq kiriting.');
      return;
    }
    if (_codeSent && code.isEmpty) {
      setState(() => _message = 'Emailga kelgan tasdiqlash kodini kiriting.');
      return;
    }
    if (!_terms) {
      setState(() => _message = 'Davom etish uchun shartlarga rozilik bering.');
      return;
    }
    if (!_validateBusiness()) return;

    final companyPhone = _cleanPhone(
      _businessPhone.text.trim().isEmpty ? phone : _businessPhone.text,
    );

    setState(() {
      _busy = true;
      _message = null;
    });

    try {
      final created = await SessionScope.read(context).signUp(
        email: email,
        phone: phone,
        password: password,
        code: code,
        promoCode: _promo.text.trim(),
        business: _kind == AccountKind.business
            ? {
                'auto': true,
                'displayName': _businessName.text.trim(),
                'city': _businessCity.text.trim(),
                'phone': companyPhone,
                'description': _businessAbout.text.trim(),
                'category': _category,
              }
            : null,
      );

      if (!mounted) return;
      if (_kind == AccountKind.business && !created) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Hisob yaratildi. Business profilni ilova ichidan keyinroq bepul ochishingiz mumkin.',
            ),
          ),
        );
      }
      Navigator.of(context).popUntil((route) => route.isFirst);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _message = _authError(e));
    } catch (_) {
      if (mounted) setState(() => _message = 'Ro‘yxatdan o‘tish amalga oshmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _authError(ApiException e) => switch (e.key) {
        'email_taken' => 'Bu email bilan hisob mavjud.',
        'phone_taken' => 'Bu telefon raqami bilan hisob mavjud.',
        'bad_email_code' => 'Tasdiqlash kodi noto‘g‘ri yoki muddati tugagan.',
        'email_code_required' => 'Email tasdiqlash kodi kerak.',
        'email_required' => 'Email kiritish kerak.',
        'too_many_requests' || 'rate_limited' =>
          'Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.',
        'offline' => 'Internet bilan aloqa yo‘q.',
        'timeout' => 'Server javobi kechikdi.',
        _ => e.detail.isNotEmpty ? e.detail : 'Amal bajarilmadi: ' + e.key,
      };

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(22, 8, 22, 42),
          children: [
            const Wordmark(),
            const SizedBox(height: 36),
            Text('Qanday boshlaysiz?', style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 8),
            Text(
              'Avval hisob turini tanlang. Har ikkala yo‘lda ham bepul boshlash mumkin.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Expanded(
                  child: _AccountChoice(
                    selected: _kind == AccountKind.personal,
                    icon: Icons.person_outline_rounded,
                    title: 'Personal',
                    subtitle: 'Shaxsiy raqamli identity',
                    onTap: () => setState(() => _kind = AccountKind.personal),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _AccountChoice(
                    selected: _kind == AccountKind.business,
                    icon: Icons.storefront_outlined,
                    title: 'Business',
                    subtitle: 'Biznes profil va katalog',
                    onTap: () => setState(() => _kind = AccountKind.business),
                  ),
                ),
              ],
            ),
            if (_kind != null) ...[
              const SizedBox(height: 18),
              SurfaceCard(
                shadow: false,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.card_giftcard_rounded, color: p.accent),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text(
                        _kind == AccountKind.personal
                            ? 'Ro‘yxatdan o‘tganda bepul 8 xonali NFC ID avtomatik beriladi. Premium ID larni keyin katalogdan ko‘rishingiz mumkin.'
                            : 'Hisob bilan bepul 8 xonali shaxsiy NFC ID va bepul avtomatik Business ID yaratiladi. Pullik nom tanlash majburiy emas.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              SurfaceCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    TextField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Telefon',
                        hintText: '+998 90 123 45 67',
                        prefixIcon: Icon(Icons.call_outlined),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        hintText: 'name@example.com',
                        prefixIcon: Icon(Icons.alternate_email_rounded),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _password,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: 'Parol',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    if (_codeSent) ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _code,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        decoration: const InputDecoration(
                          labelText: 'Email tasdiqlash kodi',
                          counterText: '',
                          prefixIcon: Icon(Icons.verified_outlined),
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextField(
                      controller: _promo,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: 'Promokod (ixtiyoriy)',
                        prefixIcon: Icon(Icons.redeem_outlined),
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_kind == AccountKind.business) ...[
              const SizedBox(height: 20),
              Text('Business haqida', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 10),
              SurfaceCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    TextField(
                      controller: _businessName,
                      decoration: const InputDecoration(
                        labelText: 'Biznes nomi',
                        prefixIcon: Icon(Icons.storefront_outlined),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _businessAbout,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Tavsif',
                        hintText: 'Kamida 20 ta belgi',
                        alignLabelWithHint: true,
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _businessCity,
                      decoration: const InputDecoration(
                        labelText: 'Shahar',
                        prefixIcon: Icon(Icons.location_city_outlined),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _businessPhone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Biznes telefoni (ixtiyoriy)',
                        hintText: 'Bo‘sh bo‘lsa hisob telefoni ishlatiladi',
                        prefixIcon: Icon(Icons.call_outlined),
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Turkum',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    const SizedBox(height: 9),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _CategoryChip(
                          label: 'Boshqa',
                          value: 'other',
                          selected: _category,
                          onChanged: (v) => setState(() => _category = v),
                        ),
                        _CategoryChip(
                          label: 'Kafe',
                          value: 'cafe',
                          selected: _category,
                          onChanged: (v) => setState(() => _category = v),
                        ),
                        _CategoryChip(
                          label: 'Restoran',
                          value: 'restaurant',
                          selected: _category,
                          onChanged: (v) => setState(() => _category = v),
                        ),
                        _CategoryChip(
                          label: 'Do‘kon',
                          value: 'shop',
                          selected: _category,
                          onChanged: (v) => setState(() => _category = v),
                        ),
                        _CategoryChip(
                          label: 'Xizmat',
                          value: 'service',
                          selected: _category,
                          onChanged: (v) => setState(() => _category = v),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            if (_kind != null) ...[
              const SizedBox(height: 16),
              CheckboxListTile(
                value: _terms,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                onChanged: _busy ? null : (v) => setState(() => _terms = v == true),
                title: const Text('Ommaviy oferta va kontent qoidalariga roziman'),
              ),
              if (_message != null) ...[
                const SizedBox(height: 4),
                Text(_message!, style: Theme.of(context).textTheme.bodyMedium),
              ],
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 54,
                child: FilledButton(
                  onPressed: _busy ? null : (_codeSent ? _register : _sendCode),
                  style: FilledButton.styleFrom(
                    backgroundColor: p.hero,
                    foregroundColor: p.heroInk,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  child: _busy
                      ? SizedBox(
                          width: 19,
                          height: 19,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: p.heroInk,
                          ),
                        )
                      : Text(_codeSent ? 'Hisobni yaratish' : 'Emailga kod yuborish'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AccountChoice extends StatelessWidget {
  const _AccountChoice({
    required this.selected,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final bool selected;
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 190),
        height: 152,
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: selected ? p.hero : p.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: selected ? p.accent : p.line,
            width: selected ? 1.5 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: p.shadow.withValues(alpha: selected ? .8 : .38),
              blurRadius: selected ? 24 : 14,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: selected ? p.heroInk : p.ink, size: 27),
            const Spacer(),
            Text(
              title,
              style: TextStyle(
                color: selected ? Colors.white : p.ink,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              subtitle,
              style: TextStyle(
                color: selected ? Colors.white.withValues(alpha: .62) : p.ink2,
                fontSize: 10.5,
                height: 1.25,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.value,
    required this.selected,
    required this.onChanged,
  });

  final String label;
  final String value;
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) => Pill(
        label: label,
        selected: value == selected,
        onTap: () => onChanged(value),
      );
}

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _busy = false;
  bool _sent = false;
  String? _message;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final email = _email.text.trim();
    if (email.isEmpty || _busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await SessionScope.read(context).repo.requestPasswordReset(email);
      if (!mounted) return;
      setState(() {
        _sent = true;
        _message =
            'So‘rov yuborildi. Hisobingizdagi tasdiqlangan tiklash kanalini tekshiring.';
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _message =
            e.key == 'offline' ? 'Internet bilan aloqa yo‘q.' : 'So‘rov yuborilmadi.');
      }
    } catch (_) {
      if (mounted) setState(() => _message = 'So‘rov yuborilmadi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 36),
          children: [
            Text('Parolni tiklash', style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: 8),
            Text(
              'Email manzilingizni kiriting. Tiklash yo‘riqnomasi mavjud tasdiqlash kanaliga yuboriladi.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 28),
            SurfaceCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_message != null) ...[
                    const SizedBox(height: 12),
                    Text(_message!, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton(
                      onPressed: (_busy || _sent) ? null : _send,
                      style: FilledButton.styleFrom(
                        backgroundColor: p.hero,
                        foregroundColor: p.heroInk,
                      ),
                      child: Text(_sent ? 'Yuborildi' : 'Tiklash so‘rovini yuborish'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
