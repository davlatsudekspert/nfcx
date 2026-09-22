import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design/theme/typography.dart';
import '../../../design/tokens/nfc_tokens.dart';
import '../../../design/tokens/shapes.dart';
import '../../../design/widgets/id_plate.dart';
import '../../../design/widgets/surfaces.dart';
import '../../../routing/routes.dart';
import '../../auth/session.dart';
import '../home_screen.dart' show activeIdProvider;
import 'identity_card.dart' show formatCount;

/// "NFC ID'LARIM" — gorizontal lenta.
///
/// ## NIMA UCHUN ALOHIDA FAYLDA
///
/// Ilgari bu vidjet `home_screen.dart` ichida MAHFIY (`_MyIdsStrip`)
/// edi. Endi u bosh sahifada emas, PROFIL ichida turadi. Ko'chirish
/// paytida uni nusxalash eng oson yo'l bo'lardi — va eng yomoni:
/// ikki nusxa vaqt o'tib bir-biridan uzoqlashadi va tuzatish faqat
/// birida qilinadi.
///
/// Shuning uchun BITTA nusxa alohida faylga chiqarildi. Ichidagi
/// mantiq bir harf ham o'zgarmadi.

class MyIdsStrip extends ConsumerWidget {
  const MyIdsStrip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final ids = ref.watch(myIdsProvider);
    if (ids.isEmpty) return const SizedBox.shrink();

    final active = ref.watch(activeIdProvider)?.code;

    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        itemCount: ids.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.sm),
        itemBuilder: (context, i) {
          final id = ids[i];
          final on = id.code == active;
          return PressableScale(
            onTap: () => context.push(Routes.nfcId(id.code)),
            child: Container(
              width: 152,
              padding: const EdgeInsets.all(Gap.md),
              decoration: BoxDecoration(
                // FAOL YOZUV — OLTIN CHEGARA VA NOZIK TUS, TO'LA
                // OLTIN BLOK EMAS.
                //
                // Ilgari faol karta butunlay aksent gradient bilan
                // bo'yalardi. Qora mavzuda u qattiq oltin plita
                // bo'lib ko'rinardi va matn uning ustida qorong'i
                // yozilardi — ya'ni ro'yxatdagi eng katta dog'.
                //
                // Endi farq YENGIL: ichkarida aksentning juda past
                // tusi, chetida oltin chiziq. Qaysi biri
                // ishlayotgani baribir bir qarashda ko'rinadi.
                color: on
                    ? t.accent2.withValues(alpha: t.isDark ? .10 : .16)
                    : t.surfaceSolid,
                borderRadius: R.tile,
                border: Border.all(
                  color: on ? t.accent2.withValues(alpha: .55) : t.border2,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      // KOD — PLASTINKA.
                      //
                      // Ilgari yonida NFC ikonkasi va oddiy matn
                      // turardi. Endi kodning o'zi ko'zga
                      // tashlanadi va darajasi rangda ko'rinadi:
                      // bu odamning o'z ID'siga bo'lgan
                      // munosabatini o'zgartiradi.
                      Flexible(
                        child: IdPlate(
                          code: id.code,
                          tier: id.tier,
                          size: IdPlateSize.small,
                          active: id.active,
                        ),
                      ),
                      if (id.cardLinked) ...[
                        const SizedBox(width: 6),
                        Icon(Icons.credit_card_rounded,
                            size: 13, color: t.text3),
                      ],
                    ],
                  ),
                  Text(
                    id.name.isEmpty ? '—' : id.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 12,
                        color: t.text2),
                  ),
                  Text(
                    '${formatCount(id.views)} ko\u2018rish',
                    style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 11,
                        color: t.text3),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
