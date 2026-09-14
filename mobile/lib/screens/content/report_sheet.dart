import 'package:flutter/widgets.dart';

import '../../design/components/buttons.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
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
/// YORLIQLAR QISQA — ATAYLAB.
///
/// Ilgari bu yerda kontent qoidalarining to'liq jumlalari turardi
/// ("Diniy targ'ibot yoki ekstremistik mazmun" kabi) va varaq
/// butun ekranni egallagan qoidalar ro'yxatiga o'xshab qolgandi.
///
/// Qoidalar matni O'Z JOYIDA bor: u post yoki story yuklashdan
/// OLDIN ko'rsatiladi, ya'ni odam joylashdan avval o'qiydi
/// (`compose.dart`). Bu yerda esa boshqa vazifa — allaqachon
/// joylangan kontentni bir so'z bilan turkumlash, xolos.
String _reasonLabel(String key) => switch (key) {
      'porn' => tr('Pornografiya'),
      'religious' => tr('Diniy targ‘ibot'),
      'political' => tr('Siyosat'),
      'violence' => tr('Zo‘ravonlik'),
      'insult' => tr('Haqorat'),
      'spam' => tr('Spam'),
      'illegal' => tr('Qonunga zid'),
      'copyright' => tr('Mualliflik huquqi'),
      _ => tr('Boshqa'),
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
            // QATOR EMAS, CHIPLAR.
            //
            // To'qqizta sabab butun kenglikdagi qatorlarda turganda
            // varaq ekranni to'ldirib, "qoidalar ro'yxati" ga
            // o'xshab qolardi. Yorug'liklar qisqargach ular bitta
            // to'plamga sig'adi va varaq ikki barobar past bo'ladi.
            Wrap(
              spacing: S.x8,
              runSpacing: S.x8,
              children: [
                for (final key in _reasonKeys)
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() {
                      _reason = key;
                      _error = null;
                    }),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 44),
                      padding: const EdgeInsets.symmetric(
                          horizontal: S.x16, vertical: S.x12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(R.chip),
                        color: _reason == key
                            ? C.champagne.withValues(alpha: .13)
                            : null,
                        border: Border.all(
                          color: _reason == key ? C.champagne : C.hairline,
                          width: _reason == key ? 1.4 : 1,
                        ),
                      ),
                      child: Text(
                        _reasonLabel(key),
                        style: T.body.copyWith(
                          color: _reason == key ? C.champagne : C.offWhite,
                          fontWeight:
                              _reason == key ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
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

/// SHIKOYAT + TASDIQ — bitta joyda.
///
/// Ilgari bu ikki qadam (varaqni ochish va "yuborildi" xabari) uchta
/// ekranda so'zma-so'z takrorlangan edi: profil, post va story.
/// Endi bittasi bor.
Future<void> reportAndConfirm(
  BuildContext context, {
  required String targetKind,
  required String targetId,
  String ownerCode = '',
}) async {
  final sent = await showReportSheet(
    context,
    targetKind: targetKind,
    targetId: targetId,
    ownerCode: ownerCode,
  );
  if (!sent || !context.mounted) return;
  await showSheet<void>(
    context,
    title: tr('Shikoyat yuborildi'),
    subtitle: tr('Moderator tekshiradi. Rahmat.'),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
      child: SecondaryButton(tr('Yopish'),
          onTap: () => Navigator.of(context).pop()),
    ),
  );
}

/// "⋯" TUGMASI ORTIDAGI MENYU — begona kontentda.
///
/// NIMA UCHUN MENYU, NIMA UCHUN BAYROQ EMAS.
///
/// Egasi bayroq belgisini ekrandan olib tashlashni so'radi: u
/// postning va story'ning ustida doim ko'rinib turardi va ilovani
/// "shikoyat qilinadigan joy" qilib ko'rsatardi.
///
/// Shikoyatning O'ZI esa olib tashlanmaydi. Google Play
/// foydalanuvchi kontenti bo'lgan ilovadan ilova ICHIDA nomaqbul
/// kontent haqida xabar berish yo'lini TALAB qiladi; uni butunlay
/// olib tashlash ilovani do'kondan chiqarib yuborish xavfini
/// tug'diradi. Shuning uchun u ko'zga tashlanmaydigan "⋯" menyusiga
/// ko'chdi: ekran toza, yo'l esa joyida.
Future<void> showContentMenu(
  BuildContext context, {
  required String title,
  required String targetKind,
  required String targetId,
  String ownerCode = '',
}) async {
  final choice = await showSheet<String>(
    context,
    title: title,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
      child: Column(
        children: [
          SecondaryButton(tr('Shikoyat qilish'),
              onTap: () => Navigator.of(context).pop('report')),
          const SizedBox(height: S.x8),
          GhostButton(tr('Bekor qilish'),
              onTap: () => Navigator.of(context).pop()),
        ],
      ),
    ),
  );
  if (choice != 'report' || !context.mounted) return;
  await reportAndConfirm(
    context,
    targetKind: targetKind,
    targetId: targetId,
    ownerCode: ownerCode,
  );
}
