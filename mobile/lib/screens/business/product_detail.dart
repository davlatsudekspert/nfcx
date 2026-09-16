import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../orders/order_flow.dart';

/// Mahsulot kartochkasi — 1:1 rasm, nom, narx.
///
/// Chegirma bo'lsa rasm ustida foiz belgisi turadi, narx qatorida
/// esa eski narx ustidan chizilgan holda qoladi: ikkalasi birga
/// "arzonlashdi" degan ma'noni rangsiz ham beradi.
class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.product,
    this.companyId,
    this.companyName = '',
  });

  final Product product;
  final String? companyId;
  final String companyName;

  @override
  Widget build(BuildContext context) {
    final off = product.discountPct;

    return RepaintBoundary(
      child: Surface(
        padding: EdgeInsets.zero,
        glow: off != null,
        onTap: () => push(
          context,
          (_) => ProductDetailScreen(
            product: product,
            companyId: companyId,
            companyName: companyName,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Hero(
                    tag: 'product-${product.id}',
                    child: NetImage(
                      product.imageUrl,
                      radius: R.card,
                      cacheWidth: 300,
                      slotIcon: Ico.bag,
                    ),
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x00000000), Color(0x92000000)],
                        stops: [.48, 1],
                      ),
                    ),
                  ),
                  if (off != null)
                    Positioned(
                      left: S.x8,
                      top: S.x8,
                      child: StatusChip('-$off%', tone: StatusTone.accent),
                    ),
                  Positioned(
                    right: S.x8,
                    bottom: S.x8,
                    child: Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: const Color(0xB8000000),
                        shape: BoxShape.circle,
                        border: Border.all(color: C.lineStrong),
                      ),
                      alignment: Alignment.center,
                      child: NIcon(Ico.bag, size: 14, color: C.accent),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(S.x8, S.x8, S.x8, S.x12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: T.cardTitle,
                  ),
                  const SizedBox(height: 5),
                  _Price(product: product),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// NARX — har doim SERVERDAN kelgan obyektdan.
class _Price extends StatelessWidget {
  const _Price({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Flexible(
            child: Text(
              som(product.effectivePrice),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: T.amount,
            ),
          ),
          if (product.salePrice != null) ...[
            const SizedBox(width: 6),
            Text(
              som(product.price),
              style: T.meta.copyWith(
                decoration: TextDecoration.lineThrough,
                decorationColor: C.ink3,
              ),
            ),
          ],
        ],
      );
}

/// Mahsulot tafsiloti — rasm karuseli, narx, tavsif, biznes qatori,
/// pastda buyurtma tugmasi.
class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({
    super.key,
    required this.product,
    this.companyId,
    this.companyName = '',
  });

  final Product product;
  final String? companyId;
  final String companyName;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final images = p.images.isEmpty ? <String>[''] : p.images;
    final off = p.discountPct;

    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const TopBar(),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, 0),
                children: [
                  AspectRatio(
                    aspectRatio: 1,
                    child: Stack(
                      children: [
                        PageView.builder(
                          itemCount: images.length,
                          onPageChanged: (i) => setState(() => _page = i),
                          itemBuilder: (_, i) {
                            final img = NetImage(
                              images[i].isEmpty ? null : images[i],
                              radius: R.hero,
                              slotIcon: Ico.bag,
                            );
                            // Faqat BIRINCHI rasm Hero: qolganlari
                            // ro'yxatda umuman ko'rinmagan, ya'ni
                            // ularning "kelib chiqish joyi" yo'q.
                            return i == 0
                                ? Hero(tag: 'product-${p.id}', child: img)
                                : img;
                          },
                        ),
                        if (off != null)
                          Positioned(
                            left: S.x12,
                            top: S.x12,
                            child: StatusChip(
                              '-$off%',
                              tone: StatusTone.accent,
                            ),
                          ),
                        // NARX RASM USTIDA — shisha panelda, ya'ni
                        // rasm qanday bo'lsa ham o'qiladi.
                        Positioned(
                          left: S.x12,
                          bottom: S.x12,
                          child: GlassPanel(
                            radius: R.chip,
                            padding: const EdgeInsets.symmetric(
                              horizontal: S.x12,
                              vertical: S.x8,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '${som(p.effectivePrice)} so‘m',
                                  style: T.amount,
                                ),
                                if (p.salePrice != null) ...[
                                  const SizedBox(width: S.x8),
                                  Text(
                                    som(p.price),
                                    style: T.meta.copyWith(
                                      decoration: TextDecoration.lineThrough,
                                      decorationColor: C.ink3,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        if (images.length > 1)
                          Positioned(
                            bottom: S.x12,
                            left: 0,
                            right: 0,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                for (var i = 0; i < images.length; i++)
                                  Container(
                                    margin: const EdgeInsets.symmetric(
                                      horizontal: 3,
                                    ),
                                    width: i == _page ? 16 : 5,
                                    height: 5,
                                    decoration: BoxDecoration(
                                      color: i == _page ? C.accent : C.ink3,
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x20),
                  if (p.categoryName.isNotEmpty) ...[
                    Eyebrow(p.categoryName),
                    const SizedBox(height: 6),
                  ],
                  Text(p.name, style: T.titleSm),
                  const SizedBox(height: S.x12),
                  const AccentRule(),
                  if (p.description.isNotEmpty) ...[
                    const SizedBox(height: S.x16),
                    Text(p.description, style: T.body),
                  ],
                  if (widget.companyName.isNotEmpty) ...[
                    const SizedBox(height: S.x20),
                    Surface(
                      child: Row(
                        children: [
                          Avatar(
                            name: widget.companyName,
                            size: 38,
                            square: true,
                          ),
                          const SizedBox(width: S.x12),
                          Expanded(
                            child: Text(
                              widget.companyName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: T.cardTitle,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  SizedBox(height: StickyBar.inset(context)),
                ],
              ),
            ),
            // Buyurtma tugmasi HAR DOIM ko'rinib turadi — uzun tavsifda
            // ham pastga aylantirish shart emas.
            StickyBar(
              child: PrimaryButton(
                tr('Buyurtma berish'),
                onTap: widget.companyId == null
                    ? null
                    : () => push(
                          context,
                          (_) => OrderFlowScreen(
                            product: p,
                            companyId: widget.companyId!,
                            companyName: widget.companyName,
                          ),
                        ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
