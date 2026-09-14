import 'package:flutter/widgets.dart';
import '../../design/components/buttons.dart';
import '../../design/components/sheet.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';

/// KONTENT QOIDALARI — FAYL TANLASHDAN OLDIN.
///
/// NIMA UCHUN ALOHIDA FAYL VA NIMA UCHUN "OLDIN".
///
/// Saytda bu oyna ancha vaqtdan beri bor (`ContentRulesGate.jsx`) va
/// u faylni tanlashdan OLDIN chiqadi. Tartib ataylab shunday:
/// ogohlantirish fayl tanlangandan keyin chiqsa, odam allaqachon
/// "ish tugadi" deb o'ylab, uni o'qimay yopib yuboradi.
///
/// Ilovada esa ahvol boshqacha edi:
///   — post/story yaratishda qoidalar bor edi, lekin ular formaning
///     PASTIDA, oddiy belgilash katakchasi sifatida turardi;
///   — avatar, muqova, logo, galereya va mahsulot rasmlarida
///     ogohlantirish UMUMAN YO'Q edi.
///
/// Egasi buni shunday ta'rifladi: "u narsa saytda bor, ilovada
/// yo'q ekan". Endi bitta oyna bor va u HAR BIR yuklash oqimida,
/// fayl tanlagichi ochilishidan oldin chaqiriladi.
///
/// MATN O'ZGARTIRILMAYDI. Manba — saytdagi `CONTENT_RULES_TEXT`;
/// u yerda "MATN EGASI BERGAN TAHRIRDA — o'zgartirilmaydi,
/// qisqartirilmaydi" deb yozilgan. Bu yuridik matn, bezak emas.
String get contentRulesText => tr(
      'Joylashtirilayotgan kontent quyidagilarni o‘z ichiga olmasligi '
      'shart: diniy targ‘ibot yoki ekstremistik mazmun, pornografik '
      'yoki jinsiy xarakterdagi tasvirlar, siyosiy targ‘ibot, '
      'shuningdek O‘zbekiston Respublikasi qonunchiligiga zid har '
      'qanday material. Ushbu qoidalar buzilgan taqdirda kontent '
      'ogohlantirishsiz o‘chiriladi.',
    );

/// Rozilik qatori — saytdagi `CONTENT_RULES_ACCEPT`.
String get contentRulesAccept => tr('Men qoidalarni o‘qidim va roziman');

/// Qoidalar oynasini ochadi.
///
/// `true` — odam rozilik bildirdi, fayl tanlagichini ochish mumkin.
/// `false` yoki `null` — bekor qildi, hech narsa ochilmaydi.
///
/// CHAQIRUVCHI UCHUN QOIDA: natija `true` bo'lmasa, yuklash oqimi
/// SHU YERDA to'xtaydi. "Baribir ochaveramiz" degan yo'l yo'q —
/// aks holda oyna bezakka aylanadi.
Future<bool> askContentRules(BuildContext context) async {
  final ok = await showSheet<bool>(
    context,
    title: tr('Kontent qoidalari'),
    subtitle: tr('Yuklashdan oldin o‘qing.'),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Qoidalar matni — diqqatni tortadigan ramkada.
          Container(
            padding: const EdgeInsets.all(S.x16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.card),
              color: C.signal.withValues(alpha: .07),
              border: Border.all(color: C.signal.withValues(alpha: .3)),
            ),
            child: Text(contentRulesText, style: T.body.copyWith(color: C.offWhite)),
          ),
          const SizedBox(height: S.x16),
          PrimaryButton(
            contentRulesAccept,
            onTap: () => Navigator.of(context).pop(true),
          ),
          const SizedBox(height: S.x8),
          SecondaryButton(
            tr('Bekor qilish'),
            onTap: () => Navigator.of(context).pop(false),
          ),
        ],
      ),
    ),
  );
  return ok == true;
}
