import 'package:flutter/services.dart'
    show FilteringTextInputFormatter, TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import 'verify_email.dart';

/// RO'YXATDAN O'TISH — ism, email, telefon, parol.
///
/// Maydonlar backend'dagi HAQIQIY maydonlar. Telefon KONTAKT
/// ma'lumoti sifatida olinadi, tasdiqlash uchun emas: hisob EMAIL
/// orqali tasdiqlanadi. Shuning uchun email maydonining ostida
/// "KOD SHU MANZILGA" deb yozilgan — odam kodni qayerdan
/// kutishini FORMANI TO'LDIRAYOTGANDA biladi, keyingi ekranda
/// emas.
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
      setState(() => _error = tr('Email manzilini tekshiring.'));
      return;
    }
    if (phone.length < 9) {
      setState(() => _error = tr('Telefon raqamini to‘liq kiriting.'));
      return;
    }
    if (_password.text.length < 8) {
      setState(() => _error = tr('Parol kamida 8 belgi bo‘lsin.'));
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
            tr('Hozir emailga kod yuborib bo‘lmayapti. Birozdan so‘ng qayta urining.'));
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
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SafeArea(
          child: Padding(
            // Asosiy tugma klaviatura ostida qolmasligi uchun.
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const TopBar(),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ScreenTitle(
                          tr('Ro‘yxatdan o‘tish'),
                          subtitle: tr('Tasdiqlash kodi emailga yuboriladi. '
                              'Telefon raqami profil aloqasi uchun saqlanadi.'),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            S.gutter,
                            S.x8,
                            S.gutter,
                            S.x32,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Field(
                                label: tr('Ism va familiya'),
                                controller: _name,
                                hint: tr('Ismingiz'),
                                keyboardType: TextInputType.name,
                                textInputAction: TextInputAction.next,
                              ),
                              const SizedBox(height: S.x16),
                              Field(
                                label: tr('Email'),
                                controller: _email,
                                hint: 'ism@gmail.com',
                                helper: tr('KOD SHU MANZILGA'),
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                              ),
                              const SizedBox(height: S.x16),
                              Field(
                                label: tr('Telefon'),
                                controller: _phone,
                                hint: '90 123 45 67',
                                prefix: '+998',
                                helper: tr('Raqamni keyin Sozlamalarda Telegram '
                                    'botga ulaysiz — parolni tiklashda kerak '
                                    'bo‘ladi'),
                                keyboardType: TextInputType.phone,
                                textInputAction: TextInputAction.next,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                              ),
                              const SizedBox(height: S.x16),
                              Field(
                                label: tr('Parol'),
                                controller: _password,
                                hint: '••••••••',
                                obscure: true,
                                helper: tr('Kamida 8 belgi'),
                                keyboardType: TextInputType.visiblePassword,
                                textInputAction: TextInputAction.done,
                                onSubmitted: (_) => _submit(),
                                error: _error,
                              ),
                              const SizedBox(height: S.x24),
                              PrimaryButton(
                                tr('Kodni emailga yuborish'),
                                loading: _busy,
                                onTap: _busy ? null : _submit,
                              ),
                              const SizedBox(height: S.x16),
                              Text(
                                tr('Ro‘yxatdan o‘tganda bepul 8 xonali ID beriladi'),
                                textAlign: TextAlign.center,
                                style: T.caption
                                    .copyWith(color: C.ink3, fontSize: 12.5),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}
