import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';
import '../../data/api_client.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import 'forgot_password.dart';
import 'register.dart';
import '../../design/components/icons.dart';
import 'gift_card.dart';
import '../../l10n/strings.dart';

/// Kirish — email YOKI telefon, plus parol.
///
/// SMS KODI YO'Q va bo'lmaydi: NFCSTORE da SMS shlyuzi yo'q. Odam
/// hech qachon SMS kod ekranini ko'rmasligi kerak.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _login = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _login.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final login = _login.text.trim();
    if (login.isEmpty || _password.text.length < 6) {
      setState(() => _error = tr('Email/telefon va parolni to‘liq kiriting.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).signIn(login, _password.text);
      // Muvaffaqiyatda ekran o'zi almashadi (AppState `phase` ni
      // o'zgartiradi va ildiz qayta quriladi) — bu yerda navigatsiya
      // qilinmaydi, aks holda ikkita boshqaruv manbai paydo bo'lardi.
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
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(S.gutter, S.x44, S.gutter, S.x32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Image(image: AssetImage('assets/img/logo.png'), width: 46, height: 46),
                const SizedBox(height: S.x32),
                Text(tr('Xush\nkelibsiz'), style: T.display),
                const SizedBox(height: S.x12),
                Text(tr('Email yoki telefon raqamingiz va parolingiz bilan kiring.'),
                    style: T.body),
                const SizedBox(height: S.x32),
                Field(
                  label: tr('Email yoki telefon'),
                  controller: _login,
                  hint: 'ism@gmail.com',
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: S.x16),
                Field(
                  label: tr('Parol'),
                  controller: _password,
                  hint: '••••••••',
                  obscure: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                  error: _error,
                ),
                const SizedBox(height: S.x12),
                Align(
                  alignment: Alignment.centerRight,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => push(
                      context,
                      (_) => ForgotPasswordScreen(login: _login.text.trim()),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(S.x8),
                      // Havola ekanligi RANGDAN ko'rinsin: kulrang
                      // matn oddiy izoh kabi o'qiladi va bosiladigan
                      // joy ekani sezilmaydi.
                      child: Text(
                        tr('Parolni unutdingizmi?'),
                        style: T.caption.copyWith(color: C.antiqueGold),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: S.x12),
                PrimaryButton(tr('Kirish'), loading: _busy, onTap: _busy ? null : _submit),
                const SizedBox(height: S.x20),
                // SOVG'A KARTASI — hisobi YO'Q odam uchun.
                //
                // Kimdir unga karta sovg'a qilgan bo'lsa, u avval
                // ro'yxatdan o'tib, keyin kartani qidirishi kerak
                // emas: kod va aktivatsiya kodi bilan hisob shu
                // yerning o'zida ochiladi.
                SecondaryButton(
                  tr('Menda sovg‘a kartasi bor'),
                  height: 48,
                  icon: NIcon(Ico.gift, size: 17, color: C.platinum),
                  onTap: () => push(context, (_) => const GiftCardScreen()),
                ),
                const SizedBox(height: S.x24),
                Center(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => push(context, (_) => const RegisterScreen()),
                    child: Padding(
                      padding: const EdgeInsets.all(S.x8),
                      child: RichText(
                        text: TextSpan(
                          style: T.caption,
                          children: [
                            TextSpan(text: tr('Akkauntingiz yo‘qmi? ')),
                            TextSpan(
                              text: tr('Akkaunt yaratish'),
                              style: TextStyle(
                                  color: C.champagne, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}
