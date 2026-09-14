import 'package:flutter/widgets.dart';

import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/sheet.dart';
import '../../design/components/surface.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';

/// KONTENT QOIDALARI — FAYL TANLASHDAN OLDIN (dizayn 14c).
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
/// Endi bitta oyna bor va u HAR BIR yuklash oqimida, fayl
/// tanlagichi ochilishidan oldin chaqiriladi.
///
/// NIMA UCHUN RO'YXAT, NIMA UCHUN QUYUQ XAT EMAS: uzun abzatsni
/// hech kim o'qimaydi. Beshta qator esa bir qarashda ko'rinadi va
/// har birining oldida bir xil belgi turadi — "bu TAQIQLANADI".
/// Qoidalarning huquqiy mazmuni o'zgargani yo'q, faqat ko'rinishi
/// o'qiladigan bo'ldi.

/// Taqiqlangan kontent — ekranda ko'rinadigan tartibda.
///
/// GETTER, `static final` EMAS: ro'yxat `tr()` chaqiradi va til
/// almashganda qayta qurilishi SHART. `static final` bo'lsa u
/// birinchi tilda muzlab qolardi.
List<String> get _bannedRules => [
      tr('Pornografiya va erotik kontent'),
      tr('Diniy targ‘ibot va aqidaga daxl'),
      tr('Siyosiy targ‘ibot va chaqiriqlar'),
      tr('Zo‘ravonlik, haqorat, kamsitish'),
      tr('Huquqi sizga tegishli bo‘lmagan rasm, video, musiqa'),
    ];

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
    subtitle: tr('Yuklashdan oldin o‘qib chiqing'),
    child: const _RulesBody(),
  );
  return ok == true;
}

class _RulesBody extends StatefulWidget {
  const _RulesBody();

  @override
  State<_RulesBody> createState() => _RulesBodyState();
}

class _RulesBodyState extends State<_RulesBody> {
  /// ROZILIK OLDINDAN BELGILANMAYDI. Belgilangan katakcha
  /// rozilikni bildirmaydi — odam uni BOSISHI kerak. Shu sababli
  /// asosiy tugma belgilanmaguncha o'chiq turadi.
  bool _agreed = false;

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Eyebrow(tr('TAQIQLANADI'), color: C.fail),
          const SizedBox(height: S.x12),
          for (final rule in _bannedRules) ...[
            _RuleRow(text: rule),
            const SizedBox(height: S.x12),
          ],
          const SizedBox(height: S.x4),
          Text(
            tr('Qoidaga zid kontent o‘chiriladi. Takrorlansa hisob '
                'cheklanadi. Har postda "⋯" → Shikoyat qilish mavjud.'),
            style: T.caption,
          ),
          const SizedBox(height: S.x20),
          CheckBox(
            value: _agreed,
            label: tr('Kontent men tomonimdan tayyorlangan va qoidalarga mos'),
            onChanged: (v) => setState(() => _agreed = v),
          ),
          const SizedBox(height: S.x20),
          PrimaryButton(
            tr('Roziman, davom etish'),
            // O'CHIQ TUGMA — ATAYLAB. Rozilik serverga `agreed`
            // bo'lib boradi, ya'ni u haqiqiy: bu yerda uni
            // "o'zi bosilgandek" qilib bo'lmaydi.
            onTap: _agreed ? () => Navigator.of(context).pop(true) : null,
          ),
          const SizedBox(height: S.x8),
          GhostButton(
            tr('Bekor qilish'),
            expand: true,
            color: C.ink2,
            onTap: () => Navigator.of(context).pop(false),
          ),
        ],
      );
}

/// Bitta taqiq qatori — qizil doiradagi belgi va matn.
///
/// HOLAT FAQAT RANG BILAN BILDIRILMAYDI: doira ichida "×" belgisi
/// bor, tepada esa "TAQIQLANADI" yozuvi turadi. Rangni ajrata
/// olmaydigan odam ham ma'noni tushunadi.
class _RuleRow extends StatelessWidget {
  const _RuleRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: C.fail.withValues(alpha: .12),
              shape: BoxShape.circle,
              border: Border.all(color: C.fail.withValues(alpha: .3)),
            ),
            alignment: Alignment.center,
            child: NIcon(Ico.close, size: 12, color: C.fail),
          ),
          const SizedBox(width: S.x12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(text, style: T.body.copyWith(fontSize: 14)),
            ),
          ),
        ],
      );
}
