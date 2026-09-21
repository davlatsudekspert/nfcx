import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/external_link.dart';
import '../../core/errors/app_error.dart';
import '../../data/models/models.dart';
import '../../data/repositories/shop_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../business/business_screens.dart' show formatMoney;
import 'store_policy.dart';

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
      actions: [
        NovaIconButton(
          icon: Icons.receipt_long_rounded,
          tooltip: l.orders,
          onPressed: () => context.push(Routes.orders),
        ),
        const SizedBox(width: Gap.sm),
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
                  height: 40,
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
                      child: Icon(Icons.nfc_rounded, size: 26, color: t.onAccent),
                    )
                  : CachedNetworkImage(
                      imageUrl: product.imageUrl,
                      fit: BoxFit.cover,
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
                          child:
                              Icon(Icons.nfc_rounded, size: 70, color: t.onAccent),
                        )
                      : CachedNetworkImage(
                          imageUrl: p.imageUrl,
                          fit: BoxFit.cover,
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
  PayProvider? _selected;
  bool _busy = false;
  String? _error;

  Future<void> _pay() async {
    final l = L.of(context);
    final provider = _selected;
    if (provider == null) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    // Buyurtma avval serverda yaratiladi: to'lov havolasi uning
    // raqamiga bog'lanadi.
    final repo = ref.read(shopRepositoryProvider);
    final orders = await repo.orders();
    if (!mounted) return;

    final orderId = orders.valueOrNull?.firstOrNull?.id ?? 0;
    if (orderId == 0) {
      setState(() {
        _busy = false;
        _error = l.errEndpointMissing;
      });
      return;
    }

    final res = await repo.startPayment(provider: provider, orderId: orderId);
    if (!mounted) return;
    setState(() => _busy = false);

    await res.when(
      ok: (url) async {
        // TO'LOV SAHIFASI — `openLink` osilib qolmaydi va brauzer
        // ochilmasa havolani buferga ko'chiradi. Ilgari shu yerda
        // `launchUrl` to'g'ridan-to'g'ri kutilardi: kanal javob
        // bermasa tugma cheksiz "yuklanmoqda" bo'lib qolardi.
        await openLink(url);
        if (mounted) context.push(Routes.paymentResult('pending'));
      },
      err: (e) async => setState(() => _error = e.code == 'payment_not_configured'
          ? l.paymentNotConfigured
          : describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final p = widget.product;
    final providers = ref.watch(paymentProvidersProvider);

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
          SectionHeader(title: l.checkoutPayWith),
          providers.when(
            loading: () => const Skeleton(height: 56, radius: R.gentle),
            error: (e, __) => StatePanel.fromError(context, asAppError(e),
                onRetry: () => ref.invalidate(paymentProvidersProvider)),
            data: (enabled) => enabled.isEmpty
                // Backend'da hech bir to'lov provayderi yoqilmagan.
                // Ilgari bu yerda "CONFIG REQUIRED" chiqardi — xarid
                // qilmoqchi bo'lgan odamga hech nima aytmaydigan
                // ishlab-chiquvchi yozuvi.
                ? StatePanel(
                    icon: Icons.credit_card_off_rounded,
                    title: l.paymentNotConfigured,
                    message: l.paymentNotConfiguredHint,
                    tone: t.warn,
                  )
                : Column(
                    children: [
                      for (final e in enabled)
                        Padding(
                          padding: const EdgeInsets.only(bottom: Gap.sm),
                          child: FloatingSurface(
                            solid: true,
                            padding: const EdgeInsets.all(Gap.lg),
                            onTap: () => setState(() => _selected = e),
                            child: Row(
                              children: [
                                Builder(builder: (_) {
                                  final label = switch (e) {
                                    PayProvider.payme => 'Payme',
                                    PayProvider.click => 'Click',
                                    PayProvider.paynet => 'Paynet',
                                  };
                                  // PROVAYDER O'Z RANGIDA.
                                  //
                                  // Odam to'lov tizimini RANGIDAN
                                  // taniydi, matnni o'qib emas.
                                  // Ranglar saytdan olingan, ikki
                                  // joyda bir xil.
                                  final brand = brandColor(label);
                                  return Row(children: [
                                    Icon(
                                      _selected == e
                                          ? Icons.radio_button_checked_rounded
                                          : Icons.radio_button_unchecked_rounded,
                                      size: 19,
                                      color: _selected == e
                                          ? (brand ?? t.accent2)
                                          : t.text3,
                                    ),
                                    const SizedBox(width: Gap.md),
                                    if (brand != null) ...[
                                      Container(
                                        width: 26,
                                        height: 26,
                                        decoration: BoxDecoration(
                                          color: brand,
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                        alignment: Alignment.center,
                                        child: Text(
                                          label.characters.first,
                                          style: const TextStyle(
                                            fontFamily: AppType.sans,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w800,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: Gap.md),
                                    ],
                                    Expanded(
                                      child: Text(
                                        label,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyLarge,
                                      ),
                                    ),
                                  ]);
                                }),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: t.error)),
          ],
          const SizedBox(height: Gap.xxl),
          NovaButton(
            label: l.checkoutPlace,
            busy: _busy,
            onPressed: _selected == null ? null : _pay,
          ),
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
        actionLabel: l.orders,
        onAction: () => context.go(Routes.orders),
      ),
    );
  }
}

/// Buyurtmalar ro'yxati.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final orders = ref.watch(ordersProvider);

    return NovaScaffold(
      title: l.orders,
      showBack: true,
      body: orders.when(
        loading: () => const SkeletonList(count: 3),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(ordersProvider)),
        data: (items) => items.isEmpty
            ? StatePanel(
                icon: Icons.receipt_long_outlined,
                title: l.ordersEmpty,
                message: l.stateEmptyHint,
                actionLabel: l.shopTitle,
                onAction: () => context.go(Routes.shop),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                    Gap.screenX, Gap.md, Gap.screenX, 120),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                itemBuilder: (context, i) {
                  final o = items[i];
                  return FloatingSurface(
                    solid: true,
                    padding: const EdgeInsets.all(Gap.lg),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l.orderNumber('${o.id}'),
                                  style:
                                      Theme.of(context).textTheme.titleSmall),
                              Text(o.itemsText.isEmpty ? o.status : o.itemsText,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style:
                                      Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(formatMoney(o.total, o.currency),
                                style: AppType.monoStyle(
                                    color: t.text1, size: 13)),
                            const SizedBox(height: 3),
                            Capsule(label: o.status, dense: true),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}

/// `AppError` dan CONFIG REQUIRED ekanini bilish.
bool isConfigMissing(AppError e) =>
    e.kind == AppErrorKind.endpointMissing ||
    e.code == 'payment_not_configured';
