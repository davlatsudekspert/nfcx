import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/logo.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import 'forgot_password.dart';
import 'gift_card.dart';
import 'register.dart';

/// KIRISH — email YOKI telefon, plus parol.
///
/// SMS KODI YO'Q va bo'lmaydi: NFCSTORE da SMS shlyuzi yo'q. Odam
/// hech qachon SMS kod ekranini ko'rmasligi kerak.
///
/// Fon SOKIN (`Aura.none`): forma ekranida yorug'lik dog'i
/// maydonlar ustiga tushib, o'qishni qiyinlashtiradi.
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
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SafeArea(
          child: Padding(
            // ASOSIY TUGMA KLAVIATURA OSTIDA QOLMAYDI: ro'yxat
            // klaviatura balandligicha ko'tariladi.
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                S.gutter,
                S.x32,
                S.gutter,
                S.x32,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: BrandMark(size: 64)),
                  const SizedBox(height: S.x24),
                  Text(
                    tr('Xush kelibsiz'),
                    textAlign: TextAlign.center,
                    style: T.title,
                  ),
                  const SizedBox(height: S.x8),
                  Text(
                    tr('Hisobingizga kiring yoki yangi ochingiz'),
                    textAlign: TextAlign.center,
                    style: T.caption,
                  ),
                  const SizedBox(height: S.x24),
                  // IKKI BO'LIMLI ALMASHTIRGICH.
                  //
                  // "Ro'yxatdan o'tish" tanlanganda ekran ALMASHMAYDI
                  // — alohida ekran ochiladi. Shuning uchun bu yerda
                  // saqlanadigan holat yo'q: qaytib kelganda
                  // "Kirish" faol bo'lib turadi va bu to'g'ri.
                  _Segments(
                    onRegister: () => push(context, (_) => const RegisterScreen()),
                  ),
                  const SizedBox(height: S.x24),
                  Field(
                    label: tr('Email'),
                    controller: _login,
                    hint: 'ism@gmail.com',
                    // SERVER IKKALASINI HAM QABUL QILADI.
                    //
                    // Email asosiy identifikator, lekin eski
                    // hisoblar telefon bilan ochilgan bo'lishi
                    // mumkin va ular ham kira olishi kerak. Yorliq
                    // asosiy yo'lni ko'rsatadi, izoh esa
                    // ikkinchisini yashirmaydi.
                    helper: tr('Email yoki telefon raqami'),
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: S.x16),
                  Field(
                    label: tr('Parol'),
                    controller: _password,
                    hint: '••••••••',
                    obscure: true,
                    keyboardType: TextInputType.visiblePassword,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _submit(),
                    error: _error,
                  ),
                  const SizedBox(height: S.x8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: GhostButton(
                      tr('Parolni tiklash'),
                      size: BtnSize.s,
                      onTap: () => push(
                        context,
                        (_) => ForgotPasswordScreen(login: _login.text.trim()),
                      ),
                    ),
                  ),
                  const SizedBox(height: S.x12),
                  PrimaryButton(
                    tr('Kirish'),
                    loading: _busy,
                    onTap: _busy ? null : _submit,
                  ),
                  const SizedBox(height: S.x24),
                  const _OrRule(),
                  const SizedBox(height: S.x20),
                  // SOVG'A KARTASI — hisobi YO'Q odam uchun.
                  //
                  // Kimdir unga karta sovg'a qilgan bo'lsa, u avval
                  // ro'yxatdan o'tib, keyin kartani qidirishi kerak
                  // emas: kod va aktivatsiya kodi bilan hisob shu
                  // yerning o'zida ochiladi.
                  SecondaryButton(
                    tr('Sovg‘a kartasi bilan'),
                    icon: Ico.gift,
                    onTap: () => push(context, (_) => const GiftCardScreen()),
                  ),
                  const SizedBox(height: S.x24),
                  Text(
                    tr('Ro‘yxatdan o‘tganda bepul 8 xonali ID beriladi'),
                    textAlign: TextAlign.center,
                    style: T.caption.copyWith(color: C.ink3, fontSize: 12.5),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// ALMASHTIRGICH
// ─────────────────────────────────────────────────────────────

/// Ikki bo'limli almashtirgich — "Kirish" / "Ro'yxatdan o'tish".
///
/// Faol bo'lim faqat RANG bilan emas, TO'LDIRILGAN metall yuza va
/// soya bilan ajraladi: rang ko'rmaydigan odam ham qaysi biri
/// tanlanganini ko'radi.
class _Segments extends StatelessWidget {
  const _Segments({required this.onRegister});

  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(R.input),
          border: Border.all(color: C.line),
        ),
        child: Row(
          children: [
            Expanded(
              child: _Segment(
                label: tr('Kirish'),
                active: true,
                // Allaqachon shu ekrandamiz.
                onTap: null,
              ),
            ),
            Expanded(
              child: _Segment(
                label: tr('Ro‘yxatdan o‘tish'),
                active: false,
                onTap: onRegister,
              ),
            ),
          ],
        ),
      );
}

class _Segment extends StatelessWidget {
  const _Segment({required this.label, required this.active, this.onTap});

  final String label;
  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: S.tap,
        scale: .98,
        child: AnimatedContainer(
          duration: M.fade,
          curve: M.curve,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: active ? C.actionFace : null,
            borderRadius: BorderRadius.circular(R.chip),
            boxShadow: active ? C.e1 : null,
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: T.buttonSm.copyWith(
              fontSize: 14,
              color: active ? C.onAccent : C.ink2,
            ),
          ),
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// AJRATGICH
// ─────────────────────────────────────────────────────────────

/// Nozik chiziq va o'rtada mono "YOKI".
class _OrRule extends StatelessWidget {
  const _OrRule();

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Expanded(child: const _Hairline()),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: S.x12),
            child: Text(tr('YOKI'), style: T.statusLabel.copyWith(color: C.ink3)),
          ),
          Expanded(child: const _Hairline()),
        ],
      );
}

class _Hairline extends StatelessWidget {
  const _Hairline();

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(color: C.line),
        child: const SizedBox(height: 1, width: double.infinity),
      );
}
