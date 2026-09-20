import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../design/theme/typography.dart';
import '../../../design/tokens/nfc_tokens.dart';
import '../../../design/tokens/shapes.dart';
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
                // Faol yozuv oltin, qolganlari sokin — bir qarashda
                // qaysi biri ishlayotgani ko'rinadi.
                gradient: on ? t.accentGradient : null,
                color: on ? null : t.surfaceSolid,
                borderRadius: R.tile,
                border: Border.all(color: on ? t.accent2 : t.border2),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.nfc_rounded,
                          size: 14, color: on ? t.onAccent : t.accent2),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          id.code,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.monoStyle(
                              color: on ? t.onAccent : t.text1, size: 13),
                        ),
                      ),
                      if (id.cardLinked)
                        Icon(Icons.credit_card_rounded,
                            size: 13, color: on ? t.onAccent : t.text3),
                    ],
                  ),
                  Text(
                    id.name.isEmpty ? '—' : id.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 12,
                        color: on ? t.onAccent : t.text2),
                  ),
                  Text(
                    '${formatCount(id.views)} ko\u2018rish',
                    style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 11,
                        color: on ? t.onAccent.withValues(alpha: .85) : t.text3),
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
