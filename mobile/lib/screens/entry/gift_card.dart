import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

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
///
/// FON — `Aura.spotlight`: nur tepadan to'g'ri karta ustiga
/// tushadi, chunki bu ekranning qahramoni KARTA.
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
      setState(() => _error = tr('Kartadagi kodni kiriting.'));
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
        setState(() => _error = tr('Bunday sovg‘a kartasi topilmadi yoki ') +
            tr('u allaqachon faollashtirilgan.'));
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
      setState(() => _error = tr('Aktivatsiya kodini kiriting.'));
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
            ? tr('Aktivatsiya kodi noto‘g‘ri.')
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
      setState(() => _error = tr('Email manzilini to‘g‘ri kiriting.'));
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _error = tr('Parol kamida 6 ta belgidan iborat bo‘lsin.'));
      return;
    }
    if (_name.text.trim().isEmpty) {
      setState(() => _error = tr('Ismingizni kiriting.'));
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
              'bad_code' => tr('Aktivatsiya kodi noto‘g‘ri.'),
              'email_taken' =>
                tr('Bu email band. Parol to‘g‘ri bo‘lsa, avval kiring.'),
              'code_taken' => tr('Bu ID allaqachon boshqa odamga biriktirilgan.'),
              'weak_password' => tr('Parol juda oddiy.'),
              'bad_email' => tr('Email manzilini to‘g‘ri kiriting.'),
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
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.spotlight,
        child: SafeArea(
          child: Padding(
            // Asosiy tugma klaviatura ostida qolmaydi.
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Column(
              children: [
                const TopBar(),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ScreenTitle(
                          tr('Sovg‘a kartasi'),
                          eyebrow: tr('Faollashtirish'),
                          subtitle: _subtitle,
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(
                            S.gutter,
                            0,
                            S.gutter,
                            S.x32,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _Steps(step: _step),
                              const SizedBox(height: S.x24),
                              ..._body(),
                              if (_error != null) ...[
                                const SizedBox(height: S.x16),
                                _ErrorNote(message: _error!),
                              ],
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

  String get _subtitle => switch (_step) {
        _Step.code => tr('Kartaning orqasidagi ID kodini kiriting.'),
        _Step.activation => tr('Karta bilan kelgan maxfiy kodni kiriting.'),
        _Step.account => tr('Oxirgi qadam — hisobingizni oching.'),
      };

  List<Widget> _body() {
    switch (_step) {
      case _Step.code:
        return [
          Text(tr('Kartadagi kod'), style: T.section),
          const SizedBox(height: S.x8),
          Text(
            tr('Sovg‘a kartangizning orqasida yozilgan ID kodini kiriting.'),
            style: T.caption,
          ),
          const SizedBox(height: S.x20),
          Field(
            label: tr('ID kodi'),
            controller: _code,
            // Namuna kod — maket ma'lumoti emas, shakl ko'rsatkichi.
            hint: 'ABC123',
            keyboardType: TextInputType.text,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _lookup(),
          ),
          const SizedBox(height: S.x20),
          PrimaryButton(
            tr('Davom etish'),
            loading: _busy,
            onTap: _busy ? null : _lookup,
          ),
        ];

      case _Step.activation:
        return [
          // ID MA'LUM BO'LDI — karta ekranning qahramoni bo'ladi.
          _GiftedCard(code: _cleanCode, recipient: _recipient),
          const SizedBox(height: S.x24),
          Text(tr('Aktivatsiya kodi'), style: T.section),
          const SizedBox(height: S.x8),
          Text(
            tr('Karta bilan kelgan maxfiy kodni kiriting. Uni boshqalarga ') +
                tr('bermang — kod bilan ID faollashtiriladi.'),
            style: T.caption,
          ),
          const SizedBox(height: S.x20),
          Field(
            label: tr('Aktivatsiya kodi'),
            controller: _activation,
            hint: '••••••',
            obscure: true,
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _verify(),
          ),
          const SizedBox(height: S.x20),
          PrimaryButton(
            tr('Tekshirish'),
            loading: _busy,
            onTap: _busy ? null : _verify,
          ),
          const SizedBox(height: S.x8),
          Center(
            child: GhostButton(
              tr('Orqaga'),
              onTap: _busy ? null : () => setState(() => _step = _Step.code),
            ),
          ),
        ];

      case _Step.account:
        return [
          _GiftedCard(code: _cleanCode, recipient: _recipient, codeChecked: true),
          const SizedBox(height: S.x24),
          Text(tr('Hisob yaratish'), style: T.section),
          const SizedBox(height: S.x8),
          Text(
            '$_cleanCode ${tr('shu hisobga biriktiriladi.')}',
            style: T.caption,
          ),
          const SizedBox(height: S.x20),
          Field(
            label: tr('Ism'),
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
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: S.x16),
          Field(
            label: tr('Parol'),
            controller: _password,
            hint: tr('Kamida 6 ta belgi'),
            obscure: true,
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: S.x16),
          Field(
            label: tr('Telefon'),
            controller: _phone,
            hint: tr('Ixtiyoriy'),
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _activate(),
          ),
          const SizedBox(height: S.x24),
          PrimaryButton(
            tr('Faollashtirish'),
            loading: _busy,
            onTap: _busy ? null : _activate,
          ),
        ];
    }
  }
}

// ─────────────────────────────────────────────────────────────
// SOVG'A KARTASI
// ─────────────────────────────────────────────────────────────

/// Kod tasdiqlangach — ID ning O'ZI ko'rsatiladi.
///
/// Tarif `Tier.exclusive`: sovg'a kartasi jismoniy karta va
/// ma'lumot qatlamining o'zi ham uni shunday hisoblaydi
/// (`Record.tier`: `isGift → exclusive`). Lookup endpointi tarifni
/// qaytarmaydi, shuning uchun boshqa manba yo'q.
class _GiftedCard extends StatelessWidget {
  const _GiftedCard({
    required this.code,
    required this.recipient,
    this.codeChecked = false,
  });

  final String code;
  final String recipient;

  /// Aktivatsiya kodi tekshirildi.
  ///
  /// Bu PROFIL tasdig'i EMAS (`Record.verified`) — shunchaki shu
  /// oqimdagi qadam. Nomi ataylab boshqacha: `verified` deb
  /// yozilsa, kodda tasdiqlangan nishon qattiq yozilganday
  /// ko'rinardi.
  final bool codeChecked;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          IdentityCard(
            code: code,
            tier: Tier.exclusive,
            holder: recipient,
            flippable: false,
          ),
          const SizedBox(height: S.x16),
          Row(
            children: [
              NIcon(Ico.gift, size: 16, color: C.accent),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  recipient.isEmpty
                      ? tr('Sovg‘a kartasi')
                      : '$recipient ${tr('uchun')}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.caption,
                ),
              ),
              const SizedBox(width: S.x8),
              StatusChip(
                codeChecked ? tr('Tasdiqlandi') : tr('Topildi'),
                tone: codeChecked ? StatusTone.ok : StatusTone.accent,
              ),
            ],
          ),
        ],
      );
}

// ─────────────────────────────────────────────────────────────
// XATO
// ─────────────────────────────────────────────────────────────

/// Xato — BELGI va matn birga. Faqat qizil matn yetarli emas.
class _ErrorNote extends StatelessWidget {
  const _ErrorNote({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Surface(
        color: C.fail.withValues(alpha: .10),
        border: Border.all(color: C.fail.withValues(alpha: .38)),
        padding: const EdgeInsets.all(S.x12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NIcon(Ico.warning, size: 16, color: C.fail),
            const SizedBox(width: S.x8),
            Expanded(
              child: Text(
                message,
                style: T.caption.copyWith(color: C.fail, fontSize: 13),
              ),
            ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────
// QADAMLAR
// ─────────────────────────────────────────────────────────────

/// Uch qadamli ko'rsatkich — qayerdaligini bilish uchun.
///
/// Qadam raqami MATN bilan ham yoziladi: chiziqning rangi
/// ko'rinmasa ham "2 / 3" o'qiladi.
class _Steps extends StatelessWidget {
  const _Steps({required this.step});

  final _Step step;

  @override
  Widget build(BuildContext context) {
    final index = _Step.values.indexOf(step);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
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
                    color: i <= index ? C.accent : C.line,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: S.x8),
        Text(
          '${index + 1} / ${_Step.values.length}',
          style: T.meta,
        ),
      ],
    );
  }
}
