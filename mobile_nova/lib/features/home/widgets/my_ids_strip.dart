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
import '../../../app/profile_context.dart';
import 'identity_card.dart' show formatCount;
import '../../../l10n/gen/app_localizations.dart';

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

    // Belgilangan karta = HAQIQATAN faol profil (bosh sahifa va
    // profil ko'rsatayotgani bilan bir xil manba).
    final active = ref.watch(activePersonalProvider)?.code;

    // Katta shrift (Sozlamalar -> x1.3) bilan plitka ichidagi uch
    // qator sig'masdi: balandlik shrift bilan birga o'sadi.
    final k = (MediaQuery.textScalerOf(context).scale(12) / 12).clamp(1.0, 1.6);

    return SizedBox(
      // x1.0 -> 96, x1.3 -> 132 (uchala qator va plastinka ichki
      // bo'shlig'i birga o'sadi).
      height: 96 + (k - 1) * 120,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        itemCount: ids.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.sm),
        itemBuilder: (context, i) {
          final id = ids[i];
          final on = id.code == active;
          return PressableScale(
            key: ValueKey('my-id-${id.code}'),
            // BOSILGANDA SHU ID FAOL BO'LADI (egasi, 2026-09: "profildan
            // ID almashtiraman"). Faol kartani qayta bosish — uning
            // sozlamalari (QR, asosiy qilish, sovg'a, tarix).
            onTap: () async {
              if (on) {
                context.push(Routes.nfcId(id.code));
                return;
              }
              await selectPersonal(ref, id.code);
              if (!context.mounted) return;
              ScaffoldMessenger.of(context)
                ..hideCurrentSnackBar()
                ..showSnackBar(SnackBar(
                  duration: const Duration(seconds: 2),
                  content: Text(L.of(context).profileSwitchedTo(
                      id.name.isEmpty ? id.code : id.name)),
                ));
            },
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
                //
                // Tus mavzuning `brand` (champagne) oilasidan: ivory'da
                // aksent QORA, uning tusi esa loyqa kulrang dog' bo'lardi.
                color: on
                    ? Color.lerp(
                        t.surfaceSolid, t.brandSoft, t.isDark ? .14 : .55)
                    : t.surfaceSolid,
                borderRadius: R.tile,
                border: Border.all(
                  color: on ? t.brand.withValues(alpha: .7) : t.border2,
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
                    // Tarjimada — rus tilida ham o'zbekcha chiqmasin.
                    '${formatCount(id.views)} · ${L.of(context).nfcViews.toLowerCase()}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
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
