import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import 'verify_email.dart';

/// Ro'yxatdan o'tish — ism, email, telefon, parol.
///
/// Maydonlar backend'dagi HAQIQIY maydonlar. Telefon KONTAKT
/// ma'lumoti sifatida olinadi, tasdiqlash uchun emas: hisob EMAIL
/// orqali tasdiqlanadi.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  static final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

  Future<void> _submit() async {
    final email = _email.text.trim().toLowerCase();
    final phone = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (!_emailRe.hasMatch(email)) {
      setState(() => _error = 'Email manzilini tekshiring.');
      return;
    }
    if (phone.length < 9) {
      setState(() => _error = 'Telefon raqamini to‘liq kiriting.');
      return;
    }
    if (_password.text.length < 8) {
      setState(() => _error = 'Parol kamida 8 belgi bo‘lsin.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });

    final state = AppScope.read(context);
    try {
      // Kod yuborish — javobdagi `channel` qaysi kanal ishlaganini
      // aytadi. `none` bo'lsa xizmat o'chirilgan: bu holatda soxta
      // "kod yuborildi" ekraniga O'TMAYMIZ.
      final channel = await state.repo.requestRegisterCode(
        email: email,
        phone: '+998$phone',
      );
      if (!mounted) return;
      if (channel == 'none') {
        setState(() => _error =
            'Hozir emailga kod yuborib bo‘lmayapti. Birozdan so‘ng qayta urining.');
        return;
      }
      await push(context, (_) => VerifyEmailScreen(
            email: email,
            phone: '+998$phone',
            password: _password.text,
            name: _name.text.trim(),
          ));
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = humanError(e));
    } catch (e) {
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _BackBar(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, S.x32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Akkaunt\nyaratish', style: T.display),
                      const SizedBox(height: S.x12),
                      const Text('Emailingizga tasdiqlash kodi yuboriladi.', style: T.body),
                      const SizedBox(height: S.x24),
                      Field(label: 'Ism', controller: _name, hint: 'Ismingiz',
                          textInputAction: TextInputAction.next),
                      const SizedBox(height: S.x16),
                      Field(
                        label: 'Email', controller: _email, hint: 'ism@gmail.com',
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: S.x16),
                      Field(
                        label: 'Telefon raqam', controller: _phone, hint: '90 123 45 67',
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        prefix: Text('+998', style: T.meta.copyWith(color: C.ash, fontSize: 14)),
                      ),
                      const SizedBox(height: S.x16),
                      Field(
                        label: 'Parol', controller: _password, hint: '••••••••',
                        obscure: true, helper: 'Kamida 8 belgi',
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _submit(),
                        error: _error,
                      ),
                      const SizedBox(height: S.x24),
                      PrimaryButton('Ro‘yxatdan o‘tish', loading: _busy, onTap: _busy ? null : _submit),
                      const SizedBox(height: S.x12),
                      Center(
                        child: Text(
                          'Ro‘yxatdan o‘tish orqali shartlarga rozilik bildirasiz',
                          textAlign: TextAlign.center,
                          style: T.caption.copyWith(color: C.muted, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
}

/// Orqaga qaytish qatori — Entry oqimidagi barcha ekranlarda bir xil.
class _BackBar extends StatelessWidget {
  const _BackBar();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.x12, S.x8, S.gutter, S.x8),
        child: Align(
          alignment: Alignment.centerLeft,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).maybePop(),
            child: const Padding(
              padding: EdgeInsets.all(S.x8),
              child: Text('←', style: TextStyle(color: C.offWhite, fontSize: 22, height: 1)),
            ),
          ),
        ),
      );
}
