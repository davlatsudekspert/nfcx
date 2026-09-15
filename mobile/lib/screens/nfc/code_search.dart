import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../identity/profile_screen.dart';
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
/// NARX VA BANDLIK SERVERDAN: mijozda narx jadvali yo'q, shuning
/// uchun serverda narx o'zgarsa ilova ham darhol to'g'ri ko'rsatadi.
///
/// IKKI SO'ROV, BITTA NATIJA. `/api/records/search` faqat BAZADA BOR
/// kartalarni topadi. Hali hech kim olmagan kod (masalan III777)
/// bazada yo'q — va u aynan sotib olinadigan kod. Ilgari shunday kod
/// yozilsa "Bunday kod topilmadi" chiqardi (egasi shuni ko'rsatdi).
/// Endi kod to'liq shaklda yozilgan bo'lsa (AAA000 yoki faqat
/// harflar) `/api/records/:code/quote` ham so'raladi: server kodni
/// xarid oqimidagi funksiya bilan baholaydi va tarif hamda narxni
/// aytadi. Natija ro'yxatda BIRINCHI turadi.
mixin CodeSearch<T extends StatefulWidget> on State<T> {
  final TextEditingController codeQuery = TextEditingController();
  Timer? _debounce;

  /// `null` — qidiruv yo'q: ekran o'z tarkibini ko'rsatadi.
  /// Bo'sh ro'yxat — qidirildi, lekin topilmadi.
  List<Record>? found;
  bool searching = false;

  /// Server aytgan "sotilmaydi" sababi — bo'sh natija matni uchun.
  String quoteReason = '';

  /// To'liq kod shakli: AAA000 yoki faqat harflar (ekslyuziv).
  /// Faqat shunday so'rov uchun baho so'raladi — "AA" kabi yarim
  /// yozuvga server baribir "sotilmaydi" derdi.
  static final _fullCode = RegExp(r'^(?:[A-Z]{3}[0-9]{3}|[A-Z]{3,12})$');

  /// Kod ko'rinishiga keltirish: katta harf, faqat harf-raqam.
  static String normalizeCode(String raw) =>
      raw.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

  static bool isFullCode(String raw) => _fullCode.hasMatch(normalizeCode(raw));

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
        searching = false;
      });
      return;
    }
    // Har harfga so'rov yubormaymiz — yozish tugashini kutamiz.
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      if (!mounted) return;
      setState(() => searching = true);
      final repo = AppScope.read(context).repo;
      final code = normalizeCode(q);
      final wantQuote = isFullCode(q);

      // Ikkalasi BIR VAQTDA: ketma-ket so'ralsa odam ikki barobar
      // kutardi.
      final results = await Future.wait<dynamic>([
        repo.searchRecords(q).catchError((_) => const <Record>[]),
        if (wantQuote)
          repo.quote(code).then<CodeQuote?>((q) => q).catchError((_) => null),
      ]);
      if (!mounted) return;

      final list = <Record>[...(results[0] as List<Record>)];
      final quote = wantQuote ? results[1] as CodeQuote? : null;
      var reason = '';
      if (quote != null) {
        final known = list.any((r) => r.code.toUpperCase() == quote.code);
        if (!known && (quote.available || quote.exists)) {
          // Bo'sh kod — narxi bilan ro'yxat boshida; band kod —
          // "Band" deb (profilga olib boradi).
          list.insert(0, quote.toRecord());
        }
        if (!quote.available && !quote.exists) reason = quote.reason;
      }
      setState(() {
        found = list;
        quoteReason = reason;
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
    final list = found;
    if (list == null) return const [];
    if (list.isEmpty) {
      // Server "sotilmaydi" degan bo'lsa — sababi aytiladi: bloklangan
      // kod, 8 xonali bepul shakl va h.k. Shunchaki "topilmadi" odamni
      // yana urinib ko'rishga majbur qilardi.
      final blocked = quoteReason.isNotEmpty;
      return [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: S.gutter),
          child: EmptyState(
            blocked
                ? tr('Bu kod sotuvga chiqmaydi — AAA000 shaklini yoki faqat '
                    'harflardan iborat kodni yozing.')
                : tr('Boshqa kod yozib ko‘ring yoki tariflardan tanlang.'),
            title: blocked ? tr('Bu kod sotilmaydi') : tr('Bunday kod topilmadi'),
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
            // Bo'sh kod — xaridga; band kod — egasining profiliga.
            // Band kodni xarid ekraniga olib borish aldov bo'lardi.
            onTap: () => push<void>(
              context,
              (_) => r.price > 0
                  ? IdDetailScreen(record: r)
                  : ProfileScreen(code: r.code),
            ),
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
