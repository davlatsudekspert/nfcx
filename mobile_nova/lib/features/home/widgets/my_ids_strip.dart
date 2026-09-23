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
import '../../../data/models/models.dart';

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
    final ids = ref.watch(myIdsProvider);
    if (ids.isEmpty) return const SizedBox.shrink();

    // Belgilangan karta = HAQIQATAN faol profil (bosh sahifa va
    // profil ko'rsatayotgani bilan bir xil manba).
    final active = ref.watch(activePersonalProvider)?.code;

    // Katta shrift (Sozlamalar -> x1.3) bilan plitka ichidagi uch
    // qator sig'masdi: balandlik shrift bilan birga o'sadi.
    final k = (MediaQuery.textScalerOf(context).scale(12) / 12).clamp(1.0, 1.6);

    return SizedBox(
      // Karta nisbati (plastik karta ~1.6:1). x1.3 shriftda uch
      // qator sig'ishi uchun balandlik birga o'sadi.
      height: 120 + (k - 1) * 110,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
        itemCount: ids.length,
        separatorBuilder: (_, __) => const SizedBox(width: Gap.md),
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
            child: _MiniIdCard(id: id, on: on),
          );
        },
      ),
    );
  }
}

/// PROFILDAGI NFC ID — MAHSULOT KARTASI (egasi, 2026-09: "NFC ID
/// ilovaning asosiy mahsuloti, oddiy kichik blok emas, premium va
/// qiymatli mahsulotdek ko'rinsin").
///
/// Bosh sahifadagi katta `NfcIdHeroCard` ning KICHIK nusxasi — bir xil
/// til: "NFC ID" yozuvi, seriflik katta raqam, champagne chiziq,
/// gravyura halqalari va ichki hoshiya. Halqalar QOTGAN (animatsiyasiz):
/// lentada bir nechta karta bo'lsa ham kadr og'irlashmaydi.
class _MiniIdCard extends StatelessWidget {
  const _MiniIdCard({required this.id, required this.on});

  final NfcId id;
  final bool on;

  static const _radius = BorderRadius.all(Radius.circular(18));
  static const _inner = BorderRadius.all(Radius.circular(13));

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);
    final warm = Color.lerp(t.surfaceSolid, t.brandSoft, t.isDark ? .16 : .38)!;
    return Container(
      width: 190,
      decoration: BoxDecoration(
        borderRadius: _radius,
        gradient: LinearGradient(
          begin: const Alignment(-.9, -1),
          end: const Alignment(1, 1),
          colors: [t.surfaceSolid, t.surfaceSolid, warm],
          stops: const [0, .5, 1],
        ),
        // Faol karta — champagne chegara; qolganlari juda nozik.
        border: Border.all(
          color: on ? t.brand.withValues(alpha: .75) : t.brand.withValues(alpha: .22),
          width: on ? 1.2 : 1,
        ),
        boxShadow: on ? t.shadowSoft : t.shadowTiny,
      ),
      child: ClipRRect(
        borderRadius: _radius,
        child: Stack(
          children: [
            Positioned(
              right: -58,
              top: -46,
              width: 170,
              height: 170,
              child: IgnorePointer(
                child: CustomPaint(
                  painter: _Rings(
                      color: t.brand.withValues(alpha: t.isDark ? .20 : .26)),
                ),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: Container(
                  margin: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    borderRadius: _inner,
                    border: Border.all(color: t.brand.withValues(alpha: .14)),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 12, 11),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          id.tier.isEmpty
                              ? 'NFC ID'
                              : 'NFC ID · ${id.tier.toUpperCase()}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppType.eyebrow(color: t.brandInk, size: 8.5),
                        ),
                      ),
                      if (id.cardLinked)
                        Padding(
                          padding: const EdgeInsets.only(left: 4),
                          child: Icon(Icons.credit_card_rounded,
                              size: 13, color: t.brandInk),
                        ),
                      // Faol yozuv — faqat nozik yashil nuqta (matn tor
                      // ekran va katta shriftda qatorni sig'dirmasdi).
                      if (on) ...[
                        const SizedBox(width: 6),
                        Semantics(
                          label: l.nfcActive,
                          child: Container(
                            key: const ValueKey('my-id-active-dot'),
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: t.success,
                              boxShadow: [
                                BoxShadow(
                                    color: t.success.withValues(alpha: .35),
                                    blurRadius: 6),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const Spacer(),
                  // KOD — plastinka (ilovaning ID qoidasi: seriflik katta
                  // raqam faqat bosh sahifadagi asosiy kartada; qolgan
                  // hamma joyda daraja rangidagi `IdPlate`).
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: IdPlate(
                      code: id.code,
                      tier: id.tier,
                      size: IdPlateSize.medium,
                      active: id.active,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Container(
                    height: 1,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [
                        t.brand.withValues(alpha: .5),
                        t.brand.withValues(alpha: 0),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          id.name.isEmpty ? '—' : id.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: t.text2,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      // Faqat ko'z belgisi + son: "ko'rishlar" so'zi tor
                      // ekran va katta shriftda qatorni sig'dirmasdi.
                      Semantics(
                        label:
                            '${formatCount(id.views)} ${l.nfcViews.toLowerCase()}',
                        excludeSemantics: true,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.visibility_outlined,
                                size: 12, color: t.text3),
                            const SizedBox(width: 3),
                            Text(
                              formatCount(id.views),
                              maxLines: 1,
                              style: TextStyle(
                                fontFamily: AppType.sans,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: t.text2,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Qotgan gravyura halqalari — katta kartadagi bilan bir xil naqsh.
class _Rings extends CustomPainter {
  const _Rings({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = .6;
    const step = 11.0;
    const count = 7;
    for (var i = 0; i <= count; i++) {
      final r = 14 + i * step;
      final fade = (1 - (i / count - .45).abs() * 1.4).clamp(.15, 1.0);
      paint.color = color.withValues(alpha: color.a * fade);
      canvas.drawCircle(c, r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _Rings old) => old.color != color;
}
