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
      // Mavjud profil topilmasa — kod bo'sh bo'lishi mumkin.
      Map<String, dynamic>? free;
      if (res.isEmpty) {
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
    if (free != null) {
      return [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
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
    }
    final list = found;
    if (list == null) return const [];
    if (list.isEmpty) {
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

/// BO'SH KOD KARTASI — tarif, narx va sotib olish yo'li.
///
/// Saytda bo'sh kod yozilganda aynan shu ma'lumot chiqadi: kod,
/// tarifi va narxi. Band bo'lsa narx ko'rsatilmaydi — bu aldov
/// bo'lardi.
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(code, style: T.code(17, color: C.ink)),
                    const SizedBox(height: 3),
                    Text(style.label,
                        style: T.caption.copyWith(color: C.ink3)),
                  ],
                ),
              ),
              if (free)
                Text(som(price), style: T.amount.copyWith(fontSize: 16))
              else
                StatusChip(
                  pending ? tr('To‘lov kutilmoqda') : tr('Band'),
                  tone: StatusTone.neutral,
                ),
            ],
          ),
          if (free) ...[
            const SizedBox(height: S.x12),
            PrimaryButton(
              tr('Sotib olish'),
              size: BtnSize.m,
              onTap: onTap,
            ),
          ] else if (!pending) ...[
            const SizedBox(height: S.x8),
            Text(
              tr('Bu kod allaqachon egasi bor.'),
              style: T.caption.copyWith(fontSize: 12.5),
            ),
          ],
        ],
      ),
    );
  }
}
