import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/media.dart';
import '../../design/components/press.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../common/top_bar.dart';
import '../orders/order_flow.dart';
import '../../l10n/strings.dart';

/// Mahsulot kartochkasi — 1:1 rasm, nom, narx.
///
/// Chegirma: yangi narx champagne mono bilan, eskisi ustidan chizilgan
/// kulrang bilan, chap yuqorida `-15%` signal rangida.
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product, this.companyId, this.companyName = ''});

  final Product product;
  final String? companyId;
  final String companyName;

  @override
  Widget build(BuildContext context) {
    final off = product.discountPct;
    return Press(
      onTap: () => push(
        context,
        (_) => ProductDetailScreen(
          product: product,
          companyId: companyId,
          companyName: companyName,
        ),
      ),
      // `RepaintBoundary` — to'r aylanganda har kartochka o'z
      // qatlamida qayta chiziladi va qo'shnilarini majburlamaydi.
      child: RepaintBoundary(
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              children: [
                // HERO — rasm ro'yxatdan tafsilotga "o'tib" boradi
                // (handoff: shared element, 320ms). Bu ikki ekran
                // orasidagi bog'lanishni ko'rsatadi va o'tish
                // "sakrash"dek emas, davomiy his qilinadi.
                //
                // Teg mahsulot ID si bo'yicha: bir ekranda bir nechta
                // mahsulot bor, ular aralashib ketmasligi kerak.
                Positioned.fill(
                  child: Hero(
                    tag: 'product-${product.id}',
                    child: NetImage(product.imageUrl, slotLabel: '1:1', cacheWidth: 300),
                  ),
                ),
                if (off != null)
                  Positioned(
                    left: S.x8, top: S.x8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: C.signal,
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Text('-$off%',
                          style: T.statusLabel.copyWith(color: C.offWhite)),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: S.x8),
          Text(product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: T.cardTitle.copyWith(fontSize: 12.5, height: 1.3)),
          const SizedBox(height: 3),
          Row(
            children: [
              Text(som(product.effectivePrice), style: T.price.copyWith(fontSize: 12)),
              if (product.salePrice != null) ...[
                const SizedBox(width: 6),
                Text(
                  som(product.price),
                  style: T.meta.copyWith(
                    fontSize: 11,
                    color: C.muted,
                    decoration: TextDecoration.lineThrough,
                    decorationColor: C.muted,
                  ),
                ),
              ],
            ],
          ),
        ],
        ),
      ),
    );
  }
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

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(title: p.name),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x24),
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
                              slotLabel: tr('MAHSULOT 1:1'),
                              radius: R.card,
                            );
                            // Faqat BIRINCHI rasm Hero: qolganlari
                            // ro'yxatda umuman ko'rinmagan, ya'ni
                            // ularning "kelib chiqish joyi" yo'q.
                            return i == 0
                                ? Hero(tag: 'product-${p.id}', child: img)
                                : img;
                          },
                        ),
                        if (images.length > 1)
                          Positioned(
                            bottom: S.x12, left: 0, right: 0,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                for (var i = 0; i < images.length; i++)
                                  Container(
                                    margin: const EdgeInsets.symmetric(horizontal: 3),
                                    width: i == _page ? 16 : 5,
                                    height: 5,
                                    decoration: BoxDecoration(
                                      color: i == _page ? C.champagne : C.muted,
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
                  Text(p.name, style: T.displaySm),
                  const SizedBox(height: S.x8),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('${som(p.effectivePrice)} so‘m',
                          style: T.price.copyWith(fontSize: 19)),
                      if (p.salePrice != null) ...[
                        const SizedBox(width: S.x8),
                        Text(
                          som(p.price),
                          style: T.meta.copyWith(
                            color: C.muted,
                            decoration: TextDecoration.lineThrough,
                            decorationColor: C.muted,
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (p.description.isNotEmpty) ...[
                    const SizedBox(height: S.x16),
                    Text(p.description, style: T.body),
                  ],
                  if (widget.companyName.isNotEmpty) ...[
                    const SizedBox(height: S.x20),
                    Surface(
                      child: Row(
                        children: [
                          Avatar(name: widget.companyName, size: 38),
                          const SizedBox(width: S.x12),
                          Expanded(
                            child: Text(widget.companyName, style: T.cardTitle),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // Buyurtma tugmasi HAR DOIM ko'rinib turadi — uzun tavsifda
            // ham pastga aylantirish shart emas.
            Container(
              padding: EdgeInsets.fromLTRB(
                S.gutter, S.x12, S.gutter,
                MediaQuery.paddingOf(context).bottom + S.x12,
              ),
              decoration: BoxDecoration(
                color: C.obsidian,
                border: Border(top: BorderSide(color: C.hairline)),
              ),
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
