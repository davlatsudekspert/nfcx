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
import '../../design/widgets/id_lux.dart';
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

/// Toifa nomi — manba `id_lux.dart` (hamma joyda bitta).
String tierLabel(L l, String tier) => idTierLabel(l, tier);

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
            technical: true,
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
    final tiers = ref.watch(idPricingProvider);

    return tiers.when(
      loading: () => const SkeletonList(count: 4, height: 64),
      error: (e, __) => StatePanel.fromError(context, asAppError(e),
          onRetry: () => ref.invalidate(idPricingProvider)),
      data: (list) {
        // Qimmatidan arzoniga: vitrina eng noyobdan boshlanadi.
        final sorted = [...list]
          ..sort((a, b) => IdLux.rank(b.tier).compareTo(IdLux.rank(a.tier)));
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionHeader(title: l.idMarketTiers),
            for (final tier in sorted)
              Padding(
                padding: const EdgeInsets.only(bottom: Gap.md),
                child: _TierTile(tier: tier),
              ),
          ],
        );
      },
    );
  }
}

/// BITTA TOIFA — pullik toifa o'z materialida (Gold/Premium/Exclusive),
/// bepul/kumush esa sodda qator.
class _TierTile extends StatelessWidget {
  const _TierTile({required this.tier});
  final IdTier tier;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final lux = IdLux.of(t, tier.tier);
    final price = tier.price == null ? null : formatMoney(tier.price!, 'UZS');

    if (lux == null) {
      return FloatingSurface(
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
            if (price != null)
              Text(
                tier.from ? '${l.idPriceFrom} $price' : price,
                style: TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: t.text1,
                ),
              )
            else
              Text(l.idStateNotForSale,
                  style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      );
    }

    return LuxSurface(
      key: ValueKey('tier-tile-${tier.tier}'),
      lux: lux,
      padding: const EdgeInsets.fromLTRB(20, 18, 18, 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                IdTierBadge(tier: tier.tier),
                const SizedBox(height: 14),
                Text(
                  tierLabel(l, tier.tier),
                  style: AppType.displayStyle(color: lux.ink, size: 30)
                      .copyWith(height: 1),
                ),
              ],
            ),
          ),
          const SizedBox(width: Gap.md),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (price != null && tier.from)
                Text(l.idPriceFrom,
                    style: AppType.eyebrow(color: lux.soft, size: 8.5)),
              Text(
                price ?? l.idStateNotForSale,
                style: TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: price == null ? 13 : 18,
                  fontWeight: FontWeight.w700,
                  color: lux.ink,
                ),
              ),
            ],
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

    // QIDIRUV NATIJASI — MAHSULOT KARTASI (`IdProductCard`): pullik
    // kod o'z materialida, katta mono raqam (serifda `0/O`, `1/I`
    // adashardi), narx va holat aniq. Pastda "Batafsil" — xarid
    // tugmasi EMAS (Play qoidasi, `store_policy.dart`).
    return IdProductCard(
      code: quote.code,
      tier: quote.tier,
      price: quote.purchasable && quote.amount > 0
          ? formatMoney(quote.amount, 'UZS')
          : null,
      status: (state.text, state.color),
      onTap: onTap,
      footer: onTap == null ? null : _DetailsLink(tier: quote.tier),
    );
  }
}

/// "Batafsil →" — kartaning pastki o'ng burchagida.
class _DetailsLink extends StatelessWidget {
  const _DetailsLink({required this.tier});
  final String tier;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final lux = IdLux.of(t, tier);
    final c = lux?.ink ?? t.text1;
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Text(
          L.of(context).actionPreview,
          style: TextStyle(
            fontFamily: AppType.sans,
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: c,
          ),
        ),
        const SizedBox(width: 4),
        Icon(Icons.arrow_forward_rounded, size: 16, color: c),
      ],
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
              // ID SAHIFASI — KATTA MAHSULOT KARTASI.
              IdProductCard(
                code: q.code,
                tier: q.tier,
                hero: true,
                price: q.purchasable && q.amount > 0
                    ? formatMoney(q.amount, 'UZS')
                    : null,
                status: (state.text, state.color),
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
                            style: AppType.monoStyle(
                              color: t.text1,
                              size: 22,
                              weight: FontWeight.w600,
                              letterSpacing: 2,
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
                  onPressed: () => context.push(Routes.nfcIds),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
