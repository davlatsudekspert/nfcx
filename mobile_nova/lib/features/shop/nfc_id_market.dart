import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/models.dart';
import '../../data/repositories/shop_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../business/business_screens.dart' show formatMoney;
import 'store_policy.dart';

// ═══════════════════════════════════════════════════════════════════
// NFC ID QIDIRISH / OLISH
//
// Bu ekranlar SAYTNING O'Z endpointlaridan ishlaydi — ilova uchun
// alohida katalog, alohida narx jadvali yoki alohida to'lov backendi
// YO'Q (`shop_repository.dart` dagi izohga qarang).
//
// Ikkita kirish joyi bitta shu ekranga olib keladi: NFC Markaz va
// Bosh sahifadagi tezkor amal. Ikkinchi katalog yaratilmaydi.
// ═══════════════════════════════════════════════════════════════════

/// Daraja narxlari — serverdan. Bir marta olinadi va saqlanadi:
/// jadval kamdan-kam o'zgaradi, har ochilishda so'rash esa
/// katalogni sekinlashtirardi.
final idPricingProvider = FutureProvider<List<IdTier>>((ref) async {
  final res = await ref.watch(shopRepositoryProvider).idPricing();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Qidiruv maydonidagi matn — TOZALANGAN holda (faqat harf/raqam,
/// bosh harf). Server ham kodni aynan shunday normallashtiradi.
final idQueryProvider = StateProvider.autoDispose<String>((_) => '');

/// Kod holati. `autoDispose` — ekran yopilganda so'rov ham keraksiz
/// bo'lib qoladi.
final idQuoteProvider =
    FutureProvider.autoDispose.family<IdQuote, String>((ref, code) async {
  final res = await ref.watch(shopRepositoryProvider).idQuote(code);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

/// Bitta buyurtma holati — to'lovdan qaytgandan keyin qayta so'raladi.
final idOrderProvider =
    FutureProvider.autoDispose.family<Order, int>((ref, id) async {
  final res = await ref.watch(shopRepositoryProvider).order(id);
  return res.when(ok: (v) => v, err: (e) => throw e);
});

String normalizeIdCode(String raw) =>
    raw.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

String tierLabel(L l, String tier) => switch (tier) {
      'free' => l.idTierFree,
      'silver' => l.idTierSilver,
      'gold' => l.idTierGold,
      'premium' => l.idTierPremium,
      'exclusive' => l.idTierExclusive,
      _ => tier,
    };

/// Kod holati bitta so'zda + rang.
({String text, Color color}) quoteState(L l, NfcTokens t, IdQuote q) {
  if (q.taken) return (text: l.idStateTaken, color: t.text3);
  if (q.reserved) return (text: l.idStateReserved, color: t.warn);
  if (q.purchasable) return (text: l.idStateAvailable, color: t.accent2);
  return (text: l.idStateNotForSale, color: t.text3);
}

// ─────────────────────────────────────────────── qidirish + katalog

class NfcIdMarketScreen extends ConsumerStatefulWidget {
  const NfcIdMarketScreen({super.key});

  @override
  ConsumerState<NfcIdMarketScreen> createState() => _NfcIdMarketScreenState();
}

class _NfcIdMarketScreenState extends ConsumerState<NfcIdMarketScreen> {
  final _field = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _field.dispose();
    super.dispose();
  }

  /// HAR BOSILGAN HARFDA SO'ROV YUBORILMAYDI.
  ///
  /// "VIP001" ni yozish 6 ta so'rov degani bo'lardi va ularning
  /// beshtasi javob kelgunicha allaqachon eskirgan bo'lardi. 350 ms
  /// — odam yozishdan to'xtaganini bilish uchun yetarli.
  void _onChanged(String raw) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      ref.read(idQueryProvider.notifier).state = normalizeIdCode(raw);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final query = ref.watch(idQueryProvider);

    return NovaScaffold(
      title: l.idMarketTitle,
      showBack: true,
      actions: [
        NovaIconButton(
          icon: Icons.receipt_long_rounded,
          tooltip: l.paymentHistory,
          onPressed: () => context.push(Routes.orders),
        ),
        const SizedBox(width: Gap.sm),
      ],
      body: NovaScroll(
        children: [
          NovaField(
            label: l.idMarketTitle,
            hint: l.idMarketSearchHint,
            controller: _field,
            onChanged: _onChanged,
            maxLength: 16,
            prefix: const Icon(Icons.search_rounded, size: 19),
          ),
          const SizedBox(height: Gap.lg),
          if (query.isEmpty)
            const _TierCatalog()
          else if (query.length < 3)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: Gap.xl),
              child: Text(l.idMarketMinChars,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall),
            )
          else
            _SearchResult(code: query),
        ],
      ),
    );
  }
}

/// Darajalar ro'yxati — narxlar SERVERDAN.
class _TierCatalog extends ConsumerWidget {
  const _TierCatalog();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final tiers = ref.watch(idPricingProvider);

    return tiers.when(
      loading: () => const SkeletonList(count: 4, height: 64),
      error: (e, __) => StatePanel.fromError(context, asAppError(e),
          onRetry: () => ref.invalidate(idPricingProvider)),
      data: (list) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: l.idMarketTiers),
          for (final tier in list)
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.md),
              child: FloatingSurface(
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        tierLabel(l, tier.tier),
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(color: t.text1),
                      ),
                    ),
                    if (tier.price != null)
                      Text(
                        tier.from
                            ? '${l.idPriceFrom} ${formatMoney(tier.price!, 'UZS')}'
                            : formatMoney(tier.price!, 'UZS'),
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: t.accent1,
                        ),
                      )
                    else
                      Text(l.idStateNotForSale,
                          style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Bitta kod uchun natija.
class _SearchResult extends ConsumerWidget {
  const _SearchResult({required this.code});
  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quote = ref.watch(idQuoteProvider(code));
    return quote.when(
      loading: () => const SkeletonList(count: 1, height: 132),
      error: (e, __) => StatePanel.fromError(context, asAppError(e),
          onRetry: () => ref.invalidate(idQuoteProvider(code))),
      data: (q) => _IdCard(
        quote: q,
        onTap: () => context.push(Routes.nfcIdBuy(q.code)),
      ),
    );
  }
}

class _IdCard extends ConsumerWidget {
  const _IdCard({required this.quote, this.onTap});
  final IdQuote quote;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final state = quoteState(l, t, quote);

    return FloatingSurface(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  quote.code,
                  // Serif — NFC ID va display nomlar uchun; qolgan
                  // hamma joyda sans qoladi.
                  style: TextStyle(
                    fontFamily: AppType.display,
                    fontSize: 27,
                    height: 1.05,
                    color: t.text1,
                  ),
                ),
              ),
              Capsule(label: state.text, dense: true, tone: state.color),
            ],
          ),
          if (quote.tier.isNotEmpty) ...[
            const SizedBox(height: Gap.sm),
            Text(tierLabel(l, quote.tier),
                style: Theme.of(context).textTheme.bodySmall),
          ],
          if (quote.purchasable && quote.amount > 0) ...[
            const SizedBox(height: Gap.lg),
            Text(
              formatMoney(quote.amount, 'UZS'),
              style: TextStyle(
                fontFamily: AppType.sans,
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: t.accent1,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────── ID va checkout

/// ID tafsiloti + buyurtma. Ikkalasi BITTA ekranda: oraliqda
/// yana bir "tasdiqlang" qadami odamni kutdirardi, holbuki tanlov
/// bitta — sotib olish yoki yo'q.
class NfcIdBuyScreen extends ConsumerWidget {
  const NfcIdBuyScreen({super.key, required this.code});
  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final quote = ref.watch(idQuoteProvider(code));

    return NovaScaffold(
      title: l.idDetailTitle,
      showBack: true,
      body: quote.when(
        loading: () => const SkeletonList(count: 2, height: 120),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(idQuoteProvider(code))),
        data: (q) {
          final state = quoteState(l, t, q);

          return NovaScroll(
            children: [
              FloatingSurface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      q.code,
                      style: TextStyle(
                        fontFamily: AppType.display,
                        fontSize: 38,
                        height: 1.05,
                        color: t.text1,
                      ),
                    ),
                    const SizedBox(height: Gap.md),
                    Capsule(label: state.text, dense: true, tone: state.color),
                    if (q.tier.isNotEmpty) ...[
                      const SizedBox(height: Gap.md),
                      Text(tierLabel(l, q.tier),
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                    if (q.purchasable && q.amount > 0) ...[
                      const SizedBox(height: Gap.lg),
                      Text(
                        formatMoney(q.amount, 'UZS'),
                        style: TextStyle(
                          fontFamily: AppType.sans,
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: t.accent1,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              // ILOVA ICHIDA SOTILMAYDI — `store_policy.dart` izohi.
              // Ism maydoni ham kerak emas: u faqat xarid uchun edi.
              if (q.purchasable) ...[
                const SizedBox(height: Gap.xl),
                StoreNotice(text: l.storeBuyOnSiteId),
              ],
              const SizedBox(height: Gap.xxl),
            ],
          );
        },
      ),
    );
  }
}

/// To'lov va natija — HOLATNI SERVER AYTADI.
///
/// Ilova hech qachon o'zi "to'landi" deb hisoblamaydi: Payme/Click'dan
/// qaytgandan keyin ham holat `GET /api/orders/:id` dan qayta
/// so'raladi. Shuning uchun brauzerdan qanday qaytilgani (muvaffaqiyat
/// sahifasi, orqaga tugmasi, ilovani qayta ochish) umuman ahamiyatsiz.
class NfcIdOrderScreen extends ConsumerWidget {
  const NfcIdOrderScreen({super.key, required this.orderId});
  final int orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final order = ref.watch(idOrderProvider(orderId));

    return NovaScaffold(
      title: l.idOrderTitle,
      showBack: true,
      body: order.when(
        loading: () => const SkeletonList(count: 2, height: 110),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(idOrderProvider(orderId))),
        data: (o) {
          final (label, tone, hint) = switch (o.status) {
            'paid' => (l.idOrderPaid, t.success, l.idPaidHint),
            'cancelled' => (l.idOrderCancelled, t.text3, ''),
            'pending' => (l.idOrderPending, t.warn, l.idPendingHint),
            _ => (l.idOrderFailed, t.error, ''),
          };

          return NovaScroll(
            children: [
              FloatingSurface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            o.code,
                            style: TextStyle(
                              fontFamily: AppType.display,
                              fontSize: 27,
                              height: 1.05,
                              color: t.text1,
                            ),
                          ),
                        ),
                        Capsule(label: label, dense: true, tone: tone),
                      ],
                    ),
                    const SizedBox(height: Gap.lg),
                    Row(
                      children: [
                        Expanded(
                            child: Text(l.checkoutTotal,
                                style: Theme.of(context).textTheme.bodySmall)),
                        Text(
                          formatMoney(o.total, 'UZS'),
                          style: TextStyle(
                            fontFamily: AppType.sans,
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: t.accent1,
                          ),
                        ),
                      ],
                    ),
                    if (hint.isNotEmpty) ...[
                      const SizedBox(height: Gap.md),
                      Text(hint, style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ],
                ),
              ),
              // BU EKRANDA TO'LOV TUGMASI YO'Q.
              //
              // Bu yerga faqat NFC ID buyurtmasi tushadi — raqamli
              // mahsulot. Google Play uni o'z to'lov tizimisiz
              // sotishga ruxsat bermaydi, tashqi havola ochish ham
              // taqiqlangan. Holat ko'rinadi, to'lov esa saytda.
              //
              // Jismoniy karta boshqa ekranda (`shop_screens.dart`)
              // va u yerda Payme/Click avvalgidek ishlaydi — jismoniy
              // tovar bu qoidadan ozod.
              if (o.pending) ...[
                const SizedBox(height: Gap.xl),
                StoreNotice(text: storeNoticeText(l, o.kind)),
              ],
              const SizedBox(height: Gap.lg),
              NovaButton(
                label: l.idOrderCheck,
                tone: ButtonTone.quiet,
                icon: Icons.refresh_rounded,
                onPressed: () {
                  ref.invalidate(idOrderProvider(orderId));
                  // To'langan bo'lsa ID endi "NFC ID'larim" da —
                  // o'sha ro'yxat ham yangilanishi kerak, aks holda
                  // odam yangi ID'ni ko'rmaydi.
                  ref.invalidate(idQuoteProvider(o.code));
                },
              ),
              if (o.status == 'paid') ...[
                const SizedBox(height: Gap.md),
                NovaButton(
                  label: l.nfcMyIds,
                  icon: Icons.style_rounded,
                  onPressed: () => context.go(Routes.nfcIds),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
