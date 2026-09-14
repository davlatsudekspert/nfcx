import 'package:flutter/widgets.dart';

import '../../design/components/buttons.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/feedback.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';

/// SHIKOYAT VA BLOKLASH.
///
/// NIMA UCHUN KERAK: platformada foydalanuvchi joylagan kontent bor,
/// lekin uni ko'rgan odam qo'lidan hech narsa kelmasdi va bizga u
/// haqda xabar ham yetib kelmasdi. Google Play foydalanuvchi
/// kontenti bor ilovalardan ilova ICHIDA shikoyat qilish va
/// bloklashni TALAB qiladi.
///
/// SABAB RO'YXATI YOPIQ va u saytdagi kontent qoidalari matni bilan
/// bir xil narsalarni nomlaydi: odam qoidada o'qigan narsani
/// shikoyatda ham topishi kerak. Erkin matn faqat qo'shimcha izoh
/// uchun — sabab sifatida emas, aks holda adminda saralash imkonsiz
/// bo'lardi.

/// Serverdagi `REPORT_REASONS` bilan BIR XIL kalitlar.
///
/// Kalit — server tili, yozuv — odam tili. Ikkalasini bir joyda
/// ushlash kerak: kalit o'zgarsa server tanimay qoladi.
const _reasonKeys = <String>[
  'porn',
  'religious',
  'political',
  'violence',
  'insult',
  'spam',
  'illegal',
  'copyright',
  'other',
];

/// TILGA BOG'LIQ, ya'ni `const` bo'la olmaydi — har chaqiruvda
/// joriy tilda quriladi.
String _reasonLabel(String key) => switch (key) {
      'porn' => tr('Pornografik yoki jinsiy xarakterdagi'),
      'religious' => tr('Diniy targ‘ibot yoki ekstremistik mazmun'),
      'political' => tr('Siyosiy targ‘ibot'),
      'violence' => tr('Zo‘ravonlik yoki shafqatsizlik'),
      'insult' => tr('Haqorat, so‘kinish, kamsitish'),
      'spam' => tr('Spam yoki aldov'),
      'illegal' => tr('Qonunga zid boshqa material'),
      'copyright' => tr('Mualliflik huquqi buzilgan'),
      _ => tr('Boshqa sabab'),
    };

/// Shikoyat varag'ini ochadi. Yuborilsa `true` qaytaradi.
///
/// [targetKind] — `post` | `story` | `company_post` | `record` |
/// `company`. [ownerCode] adminga kimning kontenti ekanini tez
/// ko'rsatadi.
Future<bool> showReportSheet(
  BuildContext context, {
  required String targetKind,
  required String targetId,
  String ownerCode = '',
}) async {
  final sent = await showSheet<bool>(
    context,
    title: tr('Shikoyat qilish'),
    subtitle: tr('Sabab tanlang. Shikoyat moderatorga yuboriladi va '
        'kontent tekshiriladi.'),
    child: _ReportBody(
      targetKind: targetKind,
      targetId: targetId,
      ownerCode: ownerCode,
    ),
  );
  return sent == true;
}

class _ReportBody extends StatefulWidget {
  const _ReportBody({
    required this.targetKind,
    required this.targetId,
    required this.ownerCode,
  });

  final String targetKind;
  final String targetId;
  final String ownerCode;

  @override
  State<_ReportBody> createState() => _ReportBodyState();
}

class _ReportBodyState extends State<_ReportBody> {
  String? _reason;
  bool _busy = false;
  String? _error;

  Future<void> _send() async {
    final reason = _reason;
    if (reason == null) {
      setState(() => _error = tr('Avval sababni tanlang.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AppScope.read(context).repo.report(
            targetKind: widget.targetKind,
            targetId: widget.targetId,
            reason: reason,
            ownerCode: widget.ownerCode,
          );
      if (!mounted) return;
      successHaptic();
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString().contains('too_many_requests')
            ? tr('Juda ko‘p shikoyat yubordingiz. Ertaga qayta urining.')
            : humanError(e));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final key in _reasonKeys) ...[
              Press(
                onTap: _busy ? null : () => setState(() {
                  _reason = key;
                  _error = null;
                }),
                child: Surface(
                  padding: const EdgeInsets.symmetric(
                      horizontal: S.x12, vertical: S.x12),
                  border: _reason == key
                      ? C.champagne.withValues(alpha: .45)
                      : null,
                  child: Row(
                    children: [
                      // Tanlov belgisi — radio, chunki sabab BITTA.
                      Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _reason == key ? C.champagne : C.hairline,
                            width: 1.6,
                          ),
                          color: _reason == key ? C.champagne : null,
                        ),
                      ),
                      const SizedBox(width: S.x12),
                      Expanded(
                        child: Text(_reasonLabel(key), style: T.body),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
            ],
            if (_error != null) ...[
              const SizedBox(height: S.x8),
              Text(_error!, style: T.caption.copyWith(color: C.signal)),
            ],
            const SizedBox(height: S.x12),
            PrimaryButton(
              tr('Shikoyatni yuborish'),
              loading: _busy,
              onTap: _busy ? null : _send,
            ),
            const SizedBox(height: S.x8),
            SecondaryButton(
              tr('Bekor qilish'),
              onTap: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      );
}
