import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// PAROLNI O'ZGARTIRISH.
///
/// NIMA UCHUN JORIY PAROL SO'RALADI: telefon birovning qo'liga
/// tushsa va ilova ochiq qolsa, parolni o'zgartirib butun hisobni
/// egallab olish mumkin bo'lardi. Joriy parol — shuning oldini
/// oladigan yagona to'siq (PIN qulfi ixtiyoriy).
///
/// Parolni UNUTGANLAR uchun bu ekran emas, kirish ekranidagi
/// «Parolni unutdingizmi?» yo'li ishlatiladi.
///
/// XATO O'Z MAYDONIDA: qaysi maydon noto'g'ri bo'lsa, xabar
/// o'shaning ostida chiqadi — odam qayerni tuzatishini izlamaydi.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

/// Xato qaysi maydonga tegishli.
enum _At { current, next, repeat }

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();

  bool _busy = false;
  bool _done = false;
  String? _error;
  _At _at = _At.repeat;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  void _fail(String message, _At at) {
    setState(() {
      _error = message;
      _at = at;
    });
  }

  Future<void> _submit() async {
    if (_current.text.isEmpty) {
      _fail(tr('Joriy parolni kiriting.'), _At.current);
      return;
    }
    if (_next.text.length < 6) {
      _fail(tr('Yangi parol kamida 6 ta belgidan iborat bo‘lsin.'), _At.next);
      return;
    }
    if (_next.text != _repeat.text) {
      _fail(tr('Yangi parollar mos kelmadi.'), _At.repeat);
      return;
    }
    if (_next.text == _current.text) {
      _fail(tr('Yangi parol eskisidan farq qilsin.'), _At.next);
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.changePassword(
            currentPassword: _current.text,
            newPassword: _next.text,
          );
      successHaptic();
      if (mounted) setState(() => _done = true);
    } on ApiError catch (e) {
      errorHaptic();
      if (mounted) {
        switch (e.key) {
          case 'bad_password' || 'invalid_credentials':
            _fail(tr('Joriy parol noto‘g‘ri.'), _At.current);
          case 'weak_password':
            _fail(tr('Yangi parol juda oddiy.'), _At.next);
          case 'too_many_requests':
            _fail(
              tr('Juda ko‘p urinish. Birozdan keyin qayta urining.'),
              _At.repeat,
            );
          default:
            _fail(humanError(e), _At.repeat);
        }
      }
    } catch (e) {
      errorHaptic();
      if (mounted) _fail(humanError(e), _At.repeat);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _errorFor(_At at) => _at == at ? _error : null;

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.none,
        child: SafeArea(
          bottom: false,
          child: CustomScrollView(
            slivers: [
              const SliverToBoxAdapter(child: TopBar()),
              SliverToBoxAdapter(
                child: ScreenTitle(tr('Parolni o‘zgartirish')),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    0,
                    S.gutter,
                    S.x32,
                  ),
                  child: _done ? _Done() : _form(),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _form() => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Field(
            label: tr('Joriy parol'),
            controller: _current,
            hint: '••••••••',
            obscure: true,
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.next,
            error: _errorFor(_At.current),
          ),
          const SizedBox(height: S.x16),
          Field(
            label: tr('Yangi parol'),
            controller: _next,
            hint: tr('Kamida 6 ta belgi'),
            obscure: true,
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.next,
            error: _errorFor(_At.next),
          ),
          const SizedBox(height: S.x16),
          Field(
            label: tr('Yangi parolni takrorlang'),
            controller: _repeat,
            hint: '••••••••',
            obscure: true,
            keyboardType: TextInputType.visiblePassword,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            error: _errorFor(_At.repeat),
          ),
          const SizedBox(height: S.x24),
          PrimaryButton(
            tr('Saqlash'),
            loading: _busy,
            onTap: _busy ? null : _submit,
          ),
          const SizedBox(height: S.x16),
          Text(
            tr('Joriy parol so‘raladi — hisobni himoyalaydigan '
                'yagona to‘siq shu.'),
            textAlign: TextAlign.center,
            style: T.caption.copyWith(color: C.ink3),
          ),
        ],
      );
}

/// Parol almashgandan keyingi holat.
class _Done extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: S.x16),
          Surface(
            padding: const EdgeInsets.all(S.x20),
            glow: true,
            child: Column(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: C.ok.withValues(alpha: .12),
                    shape: BoxShape.circle,
                    border: Border.all(color: C.ok.withValues(alpha: .38)),
                  ),
                  alignment: Alignment.center,
                  child: NIcon(Ico.check, size: 24, color: C.ok),
                ),
                const SizedBox(height: S.x16),
                Text(
                  tr('Parol o‘zgartirildi'),
                  textAlign: TextAlign.center,
                  style: T.h2,
                ),
                const SizedBox(height: S.x8),
                Text(
                  tr('Endi yangi parol bilan kirasiz. Boshqa ') +
                      tr('qurilmalardagi sessiyalar o‘z holicha qoladi.'),
                  textAlign: TextAlign.center,
                  style: T.caption,
                ),
              ],
            ),
          ),
          const SizedBox(height: S.x24),
          PrimaryButton(
            tr('Tayyor'),
            onTap: () => Navigator.of(context).pop(),
          ),
        ],
      );
}
