import 'package:flutter/widgets.dart';

import '../../design/components/buttons.dart';
import '../../design/components/input.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
import '../../design/components/toast.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// KONTAKT QOLDIRISH (prototip: "Kontakt qoldirish").
///
/// NIMA UCHUN KERAK: "Kontaktni saqlash" — bu KARTA EGASINING
/// ma'lumotini olish. Teskarisi ham kerak: profilni ochgan odam
/// O'ZINI qoldirmoqchi bo'ladi ("menga qo'ng'iroq qiling"). Serverda
/// bu allaqachon bor (`card_leads`), lekin ilovada yo'l yo'q edi —
/// odam nomerini izohga yozib qoldirardi yoki umuman ketardi.
///
/// SERVER QOIDASI TAKRORLANADI: ism SHART va aloqa
/// kanallaridan kamida bittasi. Mijozda tekshirish — odam "Yuborish"
/// ni bosib, 422 xatosini kutib o'tirmasligi uchun; serverdagi
/// tekshiruv esa baribir qoladi.
Future<bool> showLeadSheet(BuildContext context, String code) async {
  final ok = await showSheet<bool>(
    context,
    title: tr('Kontakt qoldirish'),
    subtitle: tr('Ma’lumotingiz karta egasiga boradi — u sizga o‘zi '
        'bog‘lanadi.'),
    child: _LeadSheet(code: code),
  );
  return ok ?? false;
}

class _LeadSheet extends StatefulWidget {
  const _LeadSheet({required this.code});

  final String code;

  @override
  State<_LeadSheet> createState() => _LeadSheetState();
}

class _LeadSheetState extends State<_LeadSheet> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _tg = TextEditingController();
  final _note = TextEditingController();

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _tg.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final name = _name.text.trim();
    final phone = _phone.text.trim();
    final tg = _tg.text.trim();

    if (name.isEmpty) {
      setState(() => _error = tr('Ismingizni yozing.'));
      return;
    }
    if (phone.isEmpty && tg.isEmpty) {
      setState(() => _error = tr('Telefon yoki Telegram — kamida bittasi.'));
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.sendLead(
            widget.code,
            name: name,
            phone: phone,
            telegram: tg,
            note: _note.text.trim(),
          );
      if (!mounted) return;
      successHaptic();
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = humanError(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Field(
            label: tr('Ismingiz'),
            controller: _name,
            hint: tr('Masalan: Dilshod Karimov'),
            maxLength: 80,
          ),
          const SizedBox(height: S.x12),
          Field(
            label: tr('Telefon'),
            controller: _phone,
            hint: '90 123 45 67',
            prefix: '+998',
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: S.x12),
          Field(
            label: tr('Telegram'),
            controller: _tg,
            hint: 'username',
            prefix: '@',
          ),
          const SizedBox(height: S.x12),
          Field(
            label: tr('Izoh'),
            controller: _note,
            hint: tr('Nima haqida gaplashmoqchisiz?'),
            maxLines: 3,
            maxLength: 500,
          ),
          if (_error != null) ...[
            const SizedBox(height: S.x12),
            Text(_error!, style: T.caption.copyWith(color: C.fail)),
          ],
          const SizedBox(height: S.x20),
          PrimaryButton(tr('Yuborish'), loading: _busy, onTap: _send),
        ],
      );
}

/// Muvaffaqiyat xabari — varaqa yopilgandan keyin ko'rsatiladi.
void leadSentToast(BuildContext context) =>
    showToast(context, tr('Kontaktingiz yuborildi'));
