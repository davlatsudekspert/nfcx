import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// SOVG'A KARTASINI FAOLLASHTIRISH.
///
/// KIM UCHUN: kimdir unga NFCSTORE kartasini sovg'a qilgan odam.
/// Uning hisobi HALI YO'Q — shuning uchun bu oqim kirish ekranidan
/// boradi, ilova ichidan emas.
///
/// UCH QADAM, SERVER TARTIBI BILAN:
///   1) kod — bu haqiqiy sovg'a kartasimi (`GET /api/nfc-gifts/:code`)
///   2) aktivatsiya kodi — kartadagi maxfiy kod (`/verify`)
///   3) hisob — email, parol, ism (`/activate`)
///
/// NIMA UCHUN TEKSHIRUV ALOHIDA QADAM: aktivatsiya kodi noto'g'ri
/// bo'lsa, odam butun ro'yxatdan o'tish formasini to'ldirib
/// bo'lgandan keyin emas, DARHOL biladi.
///
/// BACKEND CHEKLOVI: `/activate` faqat COOKIE qaytaradi, Bearer
/// token emas. Shuning uchun oxirida o'sha email va parol bilan
/// oddiy kirish chaqiriladi — bu chetlab o'tish emas, mavjud
/// endpointlarning to'g'ri ketma-ketligi.
class GiftCardScreen extends StatefulWidget {
  const GiftCardScreen({super.key});

  @override
  State<GiftCardScreen> createState() => _GiftCardScreenState();
}

enum _Step { code, activation, account }

class _GiftCardScreenState extends State<GiftCardScreen> {
  final _code = TextEditingController();
  final _activation = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();

  _Step _step = _Step.code;
  String _recipient = '';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_code, _activation, _email, _password, _name, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  String get _cleanCode => _code.text.trim().toUpperCase();

  Future<void> _lookup() async {
    if (_cleanCode.length < 3) {
      setState(() => _error = 'Kartadagi kodni kiriting.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final name = await AppScope.read(context).repo.giftCardLookup(_cleanCode);
      if (!mounted) return;
      if (name == null) {
        setState(() => _error = 'Bunday sovg‘a kartasi topilmadi yoki '
            'u allaqachon faollashtirilgan.');
        return;
      }
      setState(() {
        _recipient = name;
        // Kartada ism bo'lsa, uni oldindan qo'yamiz.
        if (name.isNotEmpty && _name.text.isEmpty) _name.text = name;
        _step = _Step.activation;
      });
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    if (_activation.text.trim().isEmpty) {
      setState(() => _error = 'Aktivatsiya kodini kiriting.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context)
          .repo
          .giftCardVerify(_cleanCode, _activation.text.trim());
      if (mounted) setState(() => _step = _Step.account);
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = e.key == 'bad_code'
            ? 'Aktivatsiya kodi noto‘g‘ri.'
            : humanError(e));
      }
    } catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _activate() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Email manzilini to‘g‘ri kiriting.');
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _error = 'Parol kamida 6 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Ismingizni kiriting.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state = AppScope.read(context);
      await state.repo.giftCardActivate(
        _cleanCode,
        activationCode: _activation.text.trim(),
        email: email,
        password: _password.text,
        name: _name.text.trim(),
        phone: _phone.text.trim(),
      );
      // Server cookie qaytardi, ilovaga esa token kerak.
      await state.signIn(email, _password.text);
      successHaptic();
      // Ildiz `AuthPhase` o'zgarishiga qarab o'zi almashadi.
      if (mounted) Navigator.of(context).pop();
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        setState(() => _error = switch (e.key) {
              'bad_code' => 'Aktivatsiya kodi noto‘g‘ri.',
              'email_taken' =>
                'Bu email band. Parol to‘g‘ri bo‘lsa, avval kiring.',
              'code_taken' => 'Bu ID allaqachon boshqa odamga biriktirilgan.',
              'weak_password' => 'Parol juda oddiy.',
              'bad_email' => 'Email manzilini to‘g‘ri kiriting.',
              _ => humanError(e),
            });
      }
    } catch (e) {
      errorHaptic();
      if (mounted) setState(() => _error = humanError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: C.obsidian,
        child: SafeArea(
          child: Column(
            children: [
              const TopBar(title: 'Sovg‘a kartasi'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                  children: [
                    _Steps(step: _step),
                    const SizedBox(height: S.x24),
                    ..._body(),
                    if (_error != null) ...[
                      const SizedBox(height: S.x16),
                      Text(_error!, style: T.caption.copyWith(color: C.signal)),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      );

  List<Widget> _body() {
    switch (_step) {
      case _Step.code:
        return [
          Text('Kartadagi kod', style: T.section),
          const SizedBox(height: S.x8),
          Text(
            'Sovg‘a kartangizning orqasida yozilgan ID kodini kiriting.',
            style: T.caption,
          ),
          const SizedBox(height: S.x20),
          Field(
            label: 'ID kodi',
            controller: _code,
            // Namuna kod — maket ma'lumoti emas, shakl ko'rsatkichi.
            hint: 'ABC123',
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _lookup(),
          ),
          const SizedBox(height: S.x20),
          PrimaryButton('Davom etish', loading: _busy, onTap: _busy ? null : _lookup),
        ];

      case _Step.activation:
        return [
          Surface(
            padding: const EdgeInsets.all(S.x16),
            border: C.champagne.withValues(alpha: .3),
            child: Row(
              children: [
                const NIcon(Ico.gift, size: 20, color: C.champagne),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_cleanCode, style: T.code.copyWith(fontSize: 15)),
                      if (_recipient.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text('$_recipient uchun', style: T.caption),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: S.x24),
          Text('Aktivatsiya kodi', style: T.section),
          const SizedBox(height: S.x8),
          Text(
            'Karta bilan kelgan maxfiy kodni kiriting. Uni boshqalarga '
            'bermang — kod bilan ID faollashtiriladi.',
            style: T.caption,
          ),
          const SizedBox(height: S.x20),
          Field(
            label: 'Aktivatsiya kodi',
            controller: _activation,
            hint: '••••••',
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _verify(),
          ),
          const SizedBox(height: S.x20),
          PrimaryButton('Tekshirish', loading: _busy, onTap: _busy ? null : _verify),
          const SizedBox(height: S.x12),
          GhostButton('Orqaga',
              onTap: _busy ? null : () => setState(() => _step = _Step.code)),
        ];

      case _Step.account:
        return [
          Text('Hisob yaratish', style: T.section),
          const SizedBox(height: S.x8),
          Text(
            '$_cleanCode shu hisobga biriktiriladi.',
            style: T.caption,
          ),
          const SizedBox(height: S.x20),
          Field(
            label: 'Ism',
            controller: _name,
            hint: 'Ismingiz',
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: S.x16),
          Field(
            label: 'Email',
            controller: _email,
            hint: 'ism@gmail.com',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: S.x16),
          Field(
            label: 'Parol',
            controller: _password,
            hint: 'Kamida 6 ta belgi',
            obscure: true,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: S.x16),
          Field(
            label: 'Telefon',
            controller: _phone,
            hint: 'Ixtiyoriy',
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _activate(),
          ),
          const SizedBox(height: S.x24),
          PrimaryButton('Faollashtirish', loading: _busy, onTap: _busy ? null : _activate),
        ];
    }
  }
}

/// Uch qadamli ko'rsatkich — qayerdaligini bilish uchun.
class _Steps extends StatelessWidget {
  const _Steps({required this.step});
  final _Step step;

  @override
  Widget build(BuildContext context) {
    final index = _Step.values.indexOf(step);
    return Row(
      children: [
        for (var i = 0; i < _Step.values.length; i++) ...[
          if (i > 0) const SizedBox(width: 6),
          Expanded(
            child: AnimatedContainer(
              duration: M.fade,
              curve: M.curve,
              height: 3,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                color: i <= index ? C.champagne : C.hairline,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
