import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/buttons.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import 'id_detail.dart';

/// KOD QIDIRUVI — DO'KONDA VA KATALOGDA BIR XIL.
///
/// Egasi buni saytdagidek so'radi: "nom qidirishi, saytga o'xshab
/// nom yozsa narxi chiqishi". Saytda kod yozganda uning bandligi
/// va narxi darhol ko'rinadi.
///
/// NIMA UCHUN MIXIN. Bu qidiruv IKKI ekranda kerak: do'kon (xarid
/// yo'lining boshi) va ID katalogi (tariflarni taqqoslash). Ikkala
/// joyda alohida yozilsa — kechikish (debounce) o'lchovi, bo'sh
/// natija matni va boshqaruvchini tozalash uch joyda uch xil
/// bo'lib ketardi. Bittasi unutilsa xotira oqardi.
///
/// NARX VA BANDLIK SERVERDAN (`/api/records/search`): mijozda narx
/// jadvali yo'q, shuning uchun serverda narx o'zgarsa ilova ham
/// darhol to'g'ri ko'rsatadi.
/// To'liq kod shakli — uch harf va uch raqam (AAA000).
final RegExp _codePattern = RegExp(r'^[A-Za-z]{3}[0-9]{3}$');

mixin CodeSearch<T extends StatefulWidget> on State<T> {
  final TextEditingController codeQuery = TextEditingController();
  Timer? _debounce;

  /// `null` — qidiruv yo'q: ekran o'z tarkibini ko'rsatadi.
  /// Bo'sh ro'yxat — qidirildi, lekin topilmadi.
  List<Record>? found;
  bool searching = false;

  /// BO'SH KOD — SERVER AYTGAN NARX BILAN.
  ///
  /// HAQIQIY XATO, EGASI SURAT BILAN KO'RSATDI: do'konda "III777"
  /// deb yozilganda "bunday kod topilmadi" chiqardi. Sababi
  /// `/api/records/search` FAQAT mavjud profillarni qidiradi —
  /// hali hech kim olmagan kod u yerda yo'q. Holbuki saytda aynan
  /// bo'sh kod yozilganda uning narxi chiqadi va sotib olinadi.
  ///
  /// Endi natija bo'sh bo'lsa server `/api/records/check` dan
  /// so'raladi: bandmi, qaysi tarif va narxi qancha.
  Map<String, dynamic>? freeCode;

  @override
  void dispose() {
    _debounce?.cancel();
    codeQuery.dispose();
    super.dispose();
  }

  void onCodeQuery(String raw) {
    final q = raw.trim();
    _debounce?.cancel();
    if (q.length < 2) {
      setState(() {
        found = null;
        freeCode = null;
        searching = false;
      });
      return;
    }
    // Har harfga so'rov yubormaymiz — yozish tugashini kutamiz.
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      if (!mounted) return;
      setState(() => searching = true);
      final repo = AppScope.read(context).repo;
      List<Record> res = const [];
      try {
        res = await repo.searchRecords(q);
      } catch (_) {
        // Qidiruv yiqilsa ekran ishlashda davom etadi: odam
        // tariflardan tanlashi mumkin.
      }

      // TO'LIQ KOD YOZILSA — NARX HAR DOIM TEPADA.
      //
      // EGASI: "o'ziga kerakli ID'ni qidirsa, tepadan o'sha ID
      // narxi chiqsin". Saytdagi `/narxlar` kalkulyatori aynan
      // shunday ishlaydi: kod yoziladi, darajasi, bandligi va
      // narxi chiqadi.
      //
      // Ilgari bu so'rov faqat profil TOPILMAGANDA yuborilardi,
      // ya'ni band kodda narx ham, daraja ham ko'rinmasdi.
      Map<String, dynamic>? free;
      if (_codePattern.hasMatch(q)) {
        try {
          final r = await repo.checkCode(q);
          if (r['valid'] == true) free = r;
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        found = res;
        freeCode = free;
        searching = false;
      });
    });
  }

  /// Natija bloki — ro'yxatga qo'shiladigan widgetlar.
  ///
  /// QIDIRUV NATIJASI EKRAN TARKIBINI ALMASHTIRADI. Ikkalasi birga
  /// ko'rinsa odam qaysi biri natija ekanini bilmay qoladi.
  List<Widget> codeResults(BuildContext context) {
    if (searching) {
      return const [
        Padding(
          padding: EdgeInsets.symmetric(horizontal: S.gutter),
          child: Skeleton(height: 72, radius: R.tile),
        ),
      ];
    }
    final free = freeCode;
    final list = found;
    final priceCard = free == null
        ? const <Widget>[]
        : [
            Padding(
              padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
              child: FreeCodeCard(
                info: free,
                onTap: free['available'] == true && free['purchasable'] == true
                    ? () => push<void>(
                          context,
                          (_) => IdDetailScreen(
                            record: Record(
                              code: '${free['code']}',
                              name: '',
                              price: (free['price'] as num?)?.round() ?? 0,
                              serverTier: '${free['tier'] ?? ''}',
                            ),
                          ),
                        )
                    : null,
              ),
            ),
          ];

    if (list == null) return priceCard;
    if (list.isEmpty) {
      if (priceCard.isNotEmpty) return priceCard;
      return [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: EmptyState(
            tr('Boshqa kod yozib ko‘ring yoki tariflardan tanlang.'),
            title: tr('Bunday kod topilmadi'),
            icon: Ico.search,
          ),
        ),
      ];
    }
    return [
      // Narx kartasi TEPADA — qidirilayotgan narsa shu.
      ...priceCard,
      for (final r in list)
        Padding(
          padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x8),
          child: CodeRow(
            record: r,
            onTap: () => push<void>(context, (_) => IdDetailScreen(record: r)),
          ),
        ),
    ];
  }
}

/// QIDIRUV NATIJASI — bitta topilgan kod.
///
/// Tarif namunasi, kodning o'zi va narxi.
class CodeRow extends StatelessWidget {
  const CodeRow({super.key, required this.record, required this.onTap});

  final Record record;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(record.tier);
    // Sotuvda bo'lmagan kod ham chiqishi mumkin (kimningdir
    // profili). Uni "sotib olish" deb ko'rsatish aldov bo'lardi.
    final forSale = record.price > 0;

    return Surface(
      padding: const EdgeInsets.all(S.x12),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 30,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(R.status),
              gradient: style.swatch,
            ),
          ),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(record.code, style: T.code(15, color: C.ink)),
                const SizedBox(height: 3),
                Text(style.label, style: T.caption.copyWith(color: C.ink3)),
              ],
            ),
          ),
          if (forSale)
            Text(som(record.price), style: T.amount.copyWith(fontSize: 15))
          else
            Text(tr('Band'), style: T.caption.copyWith(color: C.ink3)),
        ],
      ),
    );
  }
}

/// KOD KARTASI — DARAJA, SABAB, HOLAT VA NARX.
///
/// Saytdagi `/narxlar` kalkulyatorining aynan o'zi: kod yozilganda
/// uning darajasi, nima uchun shu daraja ekani, bandmi-yo'qmi va
/// narxi ko'rinadi. Egasi shu sahifani ko'rsatib so'radi.
///
/// NARX VA DARAJA — SERVERDAN. Mijozda naqsh qoidalari ham, narx
/// jadvali ham yo'q: ikkalasi `/api/records/check` javobidan
/// ko'chiriladi, ya'ni saytda o'zgarsa ilovada ham darhol
/// o'zgaradi.
class FreeCodeCard extends StatelessWidget {
  const FreeCodeCard({super.key, required this.info, this.onTap});

  final Map<String, dynamic> info;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final code = '${info['code'] ?? ''}';
    final tier = TierStyle.parse('${info['tier'] ?? ''}');
    final style = TierStyle.of(tier);
    final price = (info['price'] as num?)?.round() ?? 0;
    final free = info['available'] == true && info['purchasable'] == true;
    final pending = info['pendingPayment'] == true;

    Widget line(String label, Widget value) => Padding(
          padding: const EdgeInsets.only(top: S.x8),
          child: Row(
            children: [
              Text(label, style: T.caption.copyWith(color: C.ink3)),
              const Spacer(),
              value,
            ],
          ),
        );

    return Surface(
      padding: const EdgeInsets.all(S.x16),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 34,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(R.status),
                  gradient: style.swatch,
                ),
              ),
              const SizedBox(width: S.x12),
              Expanded(child: Text(code, style: T.code(19, color: C.ink))),
              StatusChip(
                pending
                    ? tr('To‘lov kutilmoqda')
                    : (free ? tr('Bo‘sh') : tr('Band')),
                tone: free ? StatusTone.ok : StatusTone.neutral,
              ),
            ],
          ),

          const SizedBox(height: S.x12),
          const RowDivider(indent: 0),

          line(tr('Daraja'),
              Text(style.label, style: T.cardTitle.copyWith(fontSize: 14))),
          line(
            tr('Sabab'),
            Flexible(
              child: Text(
                tierReason(tier),
                textAlign: TextAlign.right,
                // Sabab KESILMASIN: u narx nima uchun shunday
                // ekanini tushuntiradi — yarmi ko'rinsa ma'nosi
                // yo'qoladi.
                maxLines: 2,
                style: T.caption.copyWith(fontSize: 12.5),
              ),
            ),
          ),
          if (price > 0)
            line(
              tr('Narxi'),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(som(price), style: T.amount.copyWith(fontSize: 17)),
                  const SizedBox(width: 4),
                  Text(tr('so‘m'), style: T.meta),
                ],
              ),
            ),

          if (free) ...[
            const SizedBox(height: S.x16),
            PrimaryButton(tr('Sotib olish'), size: BtnSize.m, onTap: onTap),
          ] else ...[
            const SizedBox(height: S.x12),
            Text(
              pending
                  ? tr('Bu kod band qilingan — to‘lov kutilmoqda.')
                  : tr('Bu kodning egasi bor. Boshqa kod yozib ko‘ring.'),
              style: T.caption.copyWith(fontSize: 12.5),
            ),
          ],
        ],
      ),
    );
  }
}

/// NIMA UCHUN SHU DARAJA — saytdagi `/narxlar` dagi "Sabab".
///
/// Bitta joyda: katalogdagi tarif qatori ham shu matnni ishlatadi,
/// aks holda ikki ekranda ikki xil tushuntirish bo'lardi.
String tierReason(Tier tier) => switch (tier) {
      Tier.exclusive => tr('VIP · BOSS · faqat harflar'),
      Tier.premium => tr('Kuchli naqsh — masalan AAA000'),
      Tier.gold => tr('Takrorlanuvchi harf yoki raqam'),
      Tier.silver => tr('Oyna yoki qo‘shni juftlik'),
      Tier.bronze => tr('Oddiy AAA000 naqsh'),
      Tier.free => tr('Ro‘yxatdan o‘tganda 8 xonali kod'),
    };
