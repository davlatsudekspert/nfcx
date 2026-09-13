import 'package:flutter/services.dart' show TextInputAction;
import 'package:flutter/widgets.dart';

import '../../data/api_client.dart';
import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/states.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';

/// PAROLNI O'ZGARTIRISH.
///
/// NIMA UCHUN JORIY PAROL SO'RALADI: telefon birovning qo'liga
/// tushsa va ilova ochiq qolsa, parolni o'zgartirib butun hisobni
/// egallab olish mumkin bo'lardi. Joriy parol — shuning oldini
/// oladigan yagona to'siq (PIN qulfi ixtiyoriy).
///
/// Parolni UNUTGANLAR uchun bu ekran emas, kirish ekranidagi
/// «Parolni unutdingizmi?» yo'li ishlatiladi.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _repeat = TextEditingController();

  bool _busy = false;
  bool _done = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _repeat.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_current.text.isEmpty) {
      setState(() => _error = 'Joriy parolni kiriting.');
      return;
    }
    if (_next.text.length < 6) {
      setState(() => _error = 'Yangi parol kamida 6 ta belgidan iborat bo‘lsin.');
      return;
    }
    if (_next.text != _repeat.text) {
      setState(() => _error = 'Yangi parollar mos kelmadi.');
      return;
    }
    if (_next.text == _current.text) {
      setState(() => _error = 'Yangi parol eskisidan farq qilsin.');
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
        setState(() => _error = switch (e.key) {
              'bad_password' || 'invalid_credentials' => 'Joriy parol noto‘g‘ri.',
              'weak_password' => 'Yangi parol juda oddiy.',
              'too_many_requests' =>
                'Juda ko‘p urinish. Birozdan keyin qayta urining.',
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
  Widget build(BuildContext context) => SafeArea(
        child: Column(
          children: [
            const TopBar(title: 'Parolni o‘zgartirish'),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: _done
                    ? [
                        const SizedBox(height: S.x32),
                        Text('Parol o‘zgartirildi',
                            textAlign: TextAlign.center, style: T.section),
                        const SizedBox(height: S.x8),
                        Text(
                          'Endi yangi parol bilan kirasiz. Boshqa '
                          'qurilmalardagi sessiyalar o‘z holicha qoladi.',
                          textAlign: TextAlign.center,
                          style: T.caption,
                        ),
                        const SizedBox(height: S.x24),
                        PrimaryButton('Tayyor',
                            onTap: () => Navigator.of(context).pop()),
                      ]
                    : [
                        Field(
                          label: 'Joriy parol',
                          controller: _current,
                          hint: '••••••••',
                          obscure: true,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: 'Yangi parol',
                          controller: _next,
                          hint: 'Kamida 6 ta belgi',
                          obscure: true,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: S.x16),
                        Field(
                          label: 'Yangi parolni takrorlang',
                          controller: _repeat,
                          hint: '••••••••',
                          obscure: true,
                          textInputAction: TextInputAction.done,
                          onSubmitted: (_) => _submit(),
                          error: _error,
                        ),
                        const SizedBox(height: S.x24),
                        PrimaryButton('Saqlash',
                            loading: _busy, onTap: _busy ? null : _submit),
                      ],
              ),
            ),
          ],
        ),
      );
}
