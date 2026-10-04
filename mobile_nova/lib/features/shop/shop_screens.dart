import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../social/media_frame.dart';
import '../../core/errors/app_error.dart';
import '../../data/models/models.dart';
import '../../data/repositories/shop_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../business/business_screens.dart' show formatMoney;
import 'store_policy.dart';
import '../../core/media/image_cache.dart';

final shopProductsProvider =
    FutureProvider.autoDispose<List<ShopProduct>>((ref) async {
  final res = await ref.watch(shopRepositoryProvider).products();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

final shopCategoryProvider = StateProvider.autoDispose<String?>((_) => null);

final ordersProvider = FutureProvider.autoDispose<List<Order>>((ref) async {
  final res = await ref.watch(shopRepositoryProvider).orders();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

final paymentProvidersProvider =
    FutureProvider<Set<PayProvider>>((ref) async {
  final res = await ref.watch(shopRepositoryProvider).enabledProviders();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// NFCSTORE do'koni.
///
/// MAHSULOT NOMLARI VA NARXLARI ILOVADA YOZILMAGAN — hammasi
/// `/api/settings/physical-nfc-pricing` dan keladi.
class ShopScreen extends ConsumerWidget {
  const ShopScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final products = ref.watch(shopProductsProvider);
    final category = ref.watch(shopCategoryProvider);

    return NovaScaffold(
      title: l.shopTitle,
      showBack: true,
      // iPhone'da "Buyurtmalar" yo'q (`showOrdersEntry`, store_policy).
      actions: [
        if (showOrdersEntry) ...[
          NovaIconButton(
            key: const ValueKey('shop-orders'),
            icon: Icons.receipt_long_rounded,
            tooltip: l.orders,
            onPressed: () => context.push(Routes.orders),
          ),
          const SizedBox(width: Gap.sm),
        ],
      ],
      body: products.when(
        loading: () => const SkeletonList(count: 4, height: 96),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(shopProductsProvider)),
        data: (all) {
          final categories = {
            for (final p in all)
              if (p.category.isNotEmpty) p.category
          }.toList()
            ..sort();
          final items = category == null
              ? all
              : all.where((p) => p.category == category).toList();

          if (all.isEmpty) {
            return StatePanel(
              icon: Icons.storefront_outlined,
              title: l.stateEmpty,
              message: l.stateEmptyHint,
              actionLabel: l.actionRefresh,
              onAction: () => ref.invalidate(shopProductsProvider),
            );
          }

          return Column(
            children: [
              if (categories.isNotEmpty)
                SizedBox(
                  // Shrift bilan o'sadi — 1.3 da yorliq kesilmaydi.
                  height: Capsule.rowHeight(context),
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: Gap.sm),
                        child: Capsule(
                          label: l.shopAll,
                          selected: category == null,
                          onTap: () =>
                              ref.read(shopCategoryProvider.notifier).state = null,
                        ),
                      ),
                      for (final c in categories)
                        Padding(
                          padding: const EdgeInsets.only(right: Gap.sm),
                          child: Capsule(
                            label: c,
                            selected: category == c,
                            onTap: () =>
                                ref.read(shopCategoryProvider.notifier).state = c,
                          ),
                        ),
                    ],
                  ),
                ),
              Expanded(
                child: items.isEmpty
                    ? StatePanel(
                        icon: Icons.search_off_rounded,
                        title: l.stateNoResults,
                        message: l.stateNoResultsHint,
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(
                            Gap.screenX, Gap.md, Gap.screenX, 120),
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                        itemBuilder: (context, i) =>
                            _ProductTile(product: items[i]),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ProductTile extends StatelessWidget {
  const _ProductTile({required this.product});
  final ShopProduct product;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.md),
      onTap: () => context.push(Routes.shopProduct(product.id)),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: R.tile,
            child: SizedBox(
              width: 70,
              height: 70,
              child: product.imageUrl.isEmpty
                  ? DecoratedBox(
                      decoration: BoxDecoration(gradient: t.accentGradient),
                      // Mahsulot rasmi bo'lmaganda BRENDIMIZ
                      // turadi, Android ikonkasi emas.
                      child: Center(
                        child: BrandLogo(
                          style: BrandLogoStyle.markOnly,
                          size: 44,
                          tint: t.onAccent,
                        ),
                      ),
                    )
                  : CachedNetworkImage(
                      cacheManager: NovaImageCache.manager,
                      fadeOutDuration: NovaImageCache.fadeOut,
                      fadeInDuration: NovaImageCache.fadeIn,
                      imageUrl: product.imageUrl,
                      fit: BoxFit.cover,
                      memCacheWidth: decodeWidth(context, 120),
                      placeholder: (_, __) => ColoredBox(color: t.surface2),
                      errorWidget: (_, __, ___) => ColoredBox(color: t.surface2),
                    ),
            ),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name.isEmpty ? product.id : product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall),
                if (product.description.isNotEmpty)
                  Text(product.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text(formatMoney(product.price, product.currency),
                        style: AppType.monoStyle(color: t.text1, size: 13)),
                    if (product.hasDiscount) ...[
                      const SizedBox(width: Gap.sm),
                      Text(
                        formatMoney(product.oldPrice!, product.currency),
                        style: AppType.monoStyle(color: t.text3, size: 11)
                            .copyWith(decoration: TextDecoration.lineThrough),
                      ),
                    ],
                    if (!product.inStock) ...[
                      const SizedBox(width: Gap.sm),
                      Capsule(label: l.shopSoldOut, dense: true, tone: t.error),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Mahsulot tafsiloti.
class ShopProductScreen extends ConsumerWidget {
  const ShopProductScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final products = ref.watch(shopProductsProvider);

    return NovaScaffold(
      showBack: true,
      body: products.when(
        loading: () => const SkeletonList(count: 2, height: 200),
        error: (e, __) => StatePanel.fromError(context, asAppError(e)),
        data: (all) {
          final p = all.where((e) => e.id == id).firstOrNull;
          if (p == null) {
            return StatePanel(
                icon: Icons.search_off_rounded, title: l.errNotFound, message: id);
          }
          return NovaScroll(
            children: [
              ClipRRect(
                borderRadius: R.soft,
                child: AspectRatio(
                  aspectRatio: 1.2,
                  child: p.imageUrl.isEmpty
                      ? DecoratedBox(
                          decoration: BoxDecoration(gradient: t.accentGradient),
                          child: Center(
                            child: BrandLogo(
                              style: BrandLogoStyle.markOnly,
                              size: 130,
                              tint: t.onAccent,
                            ),
                          ),
                        )
                      : CachedNetworkImage(
                          cacheManager: NovaImageCache.manager,
                          fadeOutDuration: NovaImageCache.fadeOut,
                          fadeInDuration: NovaImageCache.fadeIn,
                          imageUrl: p.imageUrl,
                          fit: BoxFit.cover,
                          memCacheWidth: decodeWidth(context),
                          placeholder: (_, __) => ColoredBox(color: t.surface2),
                          errorWidget: (_, __, ___) =>
                              ColoredBox(color: t.surface2),
                        ),
                ),
              ),
              const SizedBox(height: Gap.xl),
              Text(p.name.isEmpty ? p.id : p.name,
                  style: Theme.of(context).textTheme.displayMedium),
              if (p.tier.isNotEmpty) ...[
                const SizedBox(height: Gap.sm),
                Capsule(label: p.tier, dense: true),
              ],
              const SizedBox(height: Gap.md),
              Row(
                children: [
                  Text(formatMoney(p.price, p.currency),
                      style: AppType.monoStyle(color: t.text1, size: 22)),
                  if (p.hasDiscount) ...[
                    const SizedBox(width: Gap.md),
                    Text(
                      formatMoney(p.oldPrice!, p.currency),
                      style: AppType.monoStyle(color: t.text3, size: 14)
                          .copyWith(decoration: TextDecoration.lineThrough),
                    ),
                  ],
                ],
              ),
              if (p.description.isNotEmpty) ...[
                const SizedBox(height: Gap.xl),
                Text(p.description,
                    style: Theme.of(context).textTheme.bodyLarge),
              ],
              const SizedBox(height: Gap.section),
              NovaButton(
                label: p.inStock ? l.shopBuy : l.shopSoldOut,
                icon: Icons.shopping_bag_rounded,
                onPressed:
                    p.inStock ? () => context.push(Routes.checkout, extra: p) : null,
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Buyurtmani rasmiylashtirish va to'lovga o'tish.
///
/// PROVAYDER SOZLANMAGAN BO'LSA SOXTA MUVAFFAQIYAT KO'RSATILMAYDI:
/// `CONFIG REQUIRED` holati chiqadi.
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key, this.product});

  final ShopProduct? product;

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  // TO'LOV HOLATI OLIB TASHLANDI.
  //
  // Bu yerda `_selected` (tanlangan provayder), `_busy` va `_pay()`
  // turgan edi. `_pay()` ishlamasdi: u buyurtma YARATMAY, mavjud
  // ro'yxatdan birinchisini olardi — yangi mijozda xato, eski
  // buyurtmasi borida esa BOShQA buyurtma uchun to'lov. Serverda
  // ham jismoniy karta buyurtmasini yaratadigan yo'l yo'q edi.
  //
  // To'liq tahlil `store_policy.dart` dagi `canPayInApp()` izohida.
  //
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final p = widget.product;

    return NovaScaffold(
      title: l.checkoutTitle,
      showBack: true,
      body: NovaScroll(
        children: [
          if (p != null)
            FloatingSurface(
              solid: true,
              child: Row(
                children: [
                  Expanded(
                    child: Text(p.name.isEmpty ? p.id : p.name,
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                  Text(formatMoney(p.price, p.currency),
                      style: AppType.monoStyle(color: t.text1, size: 15)),
                ],
              ),
            ),
          const SizedBox(height: Gap.md),
          FloatingSurface(
            child: Row(
              children: [
                Expanded(
                    child: Text(l.checkoutTotal,
                        style: Theme.of(context).textTheme.titleMedium)),
                Text(formatMoney(p?.price ?? 0, p?.currency ?? 'UZS'),
                    style: AppType.monoStyle(color: t.accent2, size: 18)),
              ],
            ),
          ),
          // TO'LOV USULI TANLASH OLIB TASHLANDI.
          //
          // Sabab `lib/features/shop/store_policy.dart` dagi
          // `canPayInApp()` izohida to'liq yozilgan, qisqasi:
          // ilovadagi jismoniy karta xaridi uch joyda uzilgan edi
          // va tugma bosilganda XATO chiqardi. Buzuq tugmadan
          // ko'ra ishlaydigan yozuv yaxshi.
          //
          // Narx va mahsulot yuqorida QOLDI — odam nima
          // olayotganini va qanchaligini ko'radi, faqat
          // rasmiylashtirish saytda bo'ladi.
          //
          // JISMONIY tovar — iPhone'da ham ko'rinadi (Apple 3.1.5(a)).
          // iPhone'da matn "NFC ID xaridi" emas, "buyurtma": raqamli
          // xaridga ishora bo'lmasin (`store_policy.dart`).
          StoreNotice(
            text: isAppStoreBuild
                ? l.storeBuyOnSitePhysical
                : l.storeBuyOnSiteId,
            physical: true,
          ),
          const SizedBox(height: Gap.xxl),
        ],
      ),
    );
  }
}

/// To'lov natijasi: kutilmoqda / muvaffaqiyatli / xato / bekor.
class PaymentResultScreen extends StatelessWidget {
  const PaymentResultScreen({super.key, required this.state});

  final String state;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    final (icon, title, message, tone) = switch (state) {
      'success' => (Icons.check_circle_rounded, l.paymentSuccess, '', t.success),
      'failed' => (Icons.error_rounded, l.paymentFailed, '', t.error),
      'cancelled' =>
        (Icons.cancel_rounded, l.paymentCancelled, '', t.text3),
      _ => (
          Icons.hourglass_top_rounded,
          l.paymentPending,
          l.paymentPendingHint,
          t.warn
        ),
    };

    return NovaScaffold(
      showBack: true,
      body: StatePanel(
        icon: icon,
        title: title,
        message: message.isEmpty ? null : message,
        tone: tone,
        // iPhone'da "Buyurtmalar" ekrani yo'q (`showOrdersEntry`) —
        // orqaga tugmasi yetarli.
        actionLabel: showOrdersEntry ? l.orders : null,
        onAction: showOrdersEntry
            ? () => context.pushReplacement(Routes.orders)
            : null,
      ),
    );
  }
}

/// Buyurtma holati — tarjima va rang.
///
/// SERVER LUG'ATI (`hosting/worker.js`, `web_orders.status`):
/// `pending` -> `paid` | `cancelled` | `failed_code_taken`. 24 soatda
/// to'lanmagan `pending` ham `cancelled` ga aylanadi
/// (`expireStaleWebOrdersD1`). `new` — server holat yubormaganda
/// modelning standart qiymati; `expired` — ehtiyot uchun.
///
/// Ilgari ro'yxatda XOM inglizcha so'z ("cancelled", "paid") turardi,
/// yana ikki marta: kapsulada va (izoh bo'sh bo'lganda) izoh
/// qatorida. Matnlar saytdagi "To'lovlar" sahifasi
/// (`src/pages/PaymentsPage.jsx`) va "To'lovlar tarixi" bilan bir xil.
/// Noma'lum holat yo'qolib qolmasin — o'zicha ko'rsatiladi.
({String text, Color tone}) orderStatusView(
        L l, NfcTokens t, String status) =>
    switch (status) {
      'paid' => (text: l.payStatusPaid, tone: t.success),
      'pending' => (text: l.payStatusPending, tone: t.warn),
      'new' => (text: l.orderStatusNew, tone: t.warn),
      'cancelled' => (text: l.payStatusCancelled, tone: t.text3),
      'expired' => (text: l.orderStatusExpired, tone: t.text3),
      // To'langan, lekin kod boshqaga o'tib ketgan — pul masalasi,
      // ko'zga tashlanib turishi kerak.
      'failed_code_taken' => (text: l.payStatusFailed, tone: t.error),
      _ => (text: status, tone: t.text3),
    };

/// Yopilgan buyurtma — undan endi hech narsa kutilmaydi, ro'yxatda
/// sukut bo'yicha yig'ilib turadi.
///
/// `failed_code_taken` BU YERDA YO'Q: odam pul to'lagan, buni
/// ko'rishi shart.
bool isInactiveOrder(String status) =>
    status == 'cancelled' || status == 'expired';

/// NIMA buyurtma qilingani — izoh qatori uchun. HOLAT EMAS: u
/// kapsulada turibdi.
///
/// `GET /api/orders` mahsulot nomini yubormaydi, faqat `kind` va
/// `code` — shuning uchun matn turdan yasaladi. Premium, obuna va
/// FEATURED buyurtmalarida `code` texnik ("PREMIUM", "FOLLOW",
/// egasining kodi) — ko'rsatilmaydi.
String orderWhat(L l, Order o) {
  final code = o.code.trim();
  String withCode(String s) => code.isEmpty ? s : '$s · $code';
  return switch (o.kind) {
    OrderKind.nfcId => l.orderKindNfcId(code).trim(),
    OrderKind.physicalCard => withCode(l.payKindPhysical),
    OrderKind.auction => withCode(l.payKindAuction),
    OrderKind.premium => l.payKindPremium,
    OrderKind.premiumFollow => l.payKindFollow,
    OrderKind.featured => l.featuredTitle,
    _ => o.itemsText,
  };
}

/// Buyurtmalar ro'yxati.
///
/// ## BEKOR QILINGANLAR YIG'ILADI
///
/// Egasining iPhone suratida ro'yxatning ko'pi bekor qilingan
/// buyurtmalar edi: har "Band qilish" 24 soatda to'lanmasa
/// `cancelled` bo'ladi. Ular endi pastda bitta "Bekor qilinganlar (N)"
/// tugmasi ortida — bosilsa ochiladi.
///
/// Hamma buyurtma bekor qilingan bo'lsa — ro'yxat o'rnida "Faol
/// buyurtmalar yo'q" holati, tugmasi esa o'sha "Bekor qilinganlar
/// (N)". Bo'sh ro'yxat tagida yolg'iz tugma turgandan ko'ra toza: odam
/// darhol vaziyatni o'qiydi va xohlasa tarixni ochadi.
///
/// ## iPHONE
///
/// Ekranga kirish yo'li iPhone'da yo'q (`showOrdersEntry`). Baribir
/// ochilsa — faqat JISMONIY karta buyurtmalari: raqamli xaridning na
/// o'zi, na narxi ko'rinmaydi (`store_policy.dart`). Summa ham
/// `showOrderAmount` orqali: Android'da hammasida, iPhone'da faqat
/// jismoniy tovarda.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  bool _showInactive = false;

  void _toggle() => setState(() => _showInactive = !_showInactive);

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final orders = ref.watch(ordersProvider);

    return NovaScaffold(
      title: l.orders,
      showBack: true,
      body: orders.when(
        loading: () => const SkeletonList(count: 3),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(ordersProvider)),
        data: (all) {
          final items = isAppStoreBuild
              ? all.where((o) => isPhysicalOrder(o.kind)).toList()
              : all;
          final active =
              items.where((o) => !isInactiveOrder(o.status)).toList();
          final inactive =
              items.where((o) => isInactiveOrder(o.status)).toList();

          if (items.isEmpty) {
            return StatePanel(
              icon: Icons.receipt_long_outlined,
              title: l.ordersEmpty,
              message: l.stateEmptyHint,
              actionLabel: l.shopTitle,
              onAction: () => context.push(Routes.shop),
            );
          }
          if (active.isEmpty && !_showInactive) {
            return StatePanel(
              key: const ValueKey('orders-no-active'),
              icon: Icons.receipt_long_outlined,
              title: l.ordersNoActive,
              actionLabel: l.ordersInactiveShow(inactive.length),
              onAction: _toggle,
            );
          }

          final shown = [...active, if (_showInactive) ...inactive];
          return ListView.separated(
            padding:
                const EdgeInsets.fromLTRB(Gap.screenX, Gap.md, Gap.screenX, 120),
            itemCount: shown.length + (inactive.isEmpty ? 0 : 1),
            separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
            itemBuilder: (context, i) => i < shown.length
                ? _OrderTile(order: shown[i])
                : _InactiveToggle(
                    open: _showInactive,
                    count: inactive.length,
                    onTap: _toggle,
                  ),
          );
        },
      ),
    );
  }
}

class _OrderTile extends StatelessWidget {
  const _OrderTile({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final o = order;
    final status = orderStatusView(l, t, o.status);
    final when = o.createdAt;
    final sub = [
      orderWhat(l, o),
      if (when != null) DateFormat('dd.MM.yyyy').format(when.toLocal()),
    ].where((s) => s.isNotEmpty).join(' · ');

    return FloatingSurface(
      key: ValueKey('order-${o.id}'),
      solid: true,
      padding: const EdgeInsets.all(Gap.lg),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.orderNumber('${o.id}'),
                    style: Theme.of(context).textTheme.titleSmall),
                if (sub.isNotEmpty)
                  Text(sub,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          const SizedBox(width: Gap.md),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Raqamli xarid summasi iPhone'da yo'q — faqat holat.
              if (showOrderAmount(o.kind)) ...[
                Text(formatMoney(o.total, o.currency),
                    style: AppType.monoStyle(color: t.text1, size: 13)),
                const SizedBox(height: 3),
              ],
              Capsule(label: status.text, dense: true, tone: status.tone),
            ],
          ),
        ],
      ),
    );
  }
}

/// "Bekor qilinganlar (N)" / "Yashirish" — ro'yxat oxirida.
class _InactiveToggle extends StatelessWidget {
  const _InactiveToggle({
    required this.open,
    required this.count,
    required this.onTap,
  });

  final bool open;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return Center(
      child: TextButton.icon(
        key: const ValueKey('orders-inactive-toggle'),
        onPressed: onTap,
        icon: Icon(
          open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
          size: 18,
          color: t.text2,
        ),
        label: Text(
          open ? l.ordersInactiveHide : l.ordersInactiveShow(count),
          style: TextStyle(
            fontFamily: AppType.sans,
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: t.text2,
          ),
        ),
      ),
    );
  }
}

/// `AppError` dan CONFIG REQUIRED ekanini bilish.
bool isConfigMissing(AppError e) =>
    e.kind == AppErrorKind.endpointMissing ||
    e.code == 'payment_not_configured';
