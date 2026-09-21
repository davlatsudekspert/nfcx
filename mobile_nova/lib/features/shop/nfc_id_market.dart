import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/external_link.dart';
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
import '../auth/session.dart';

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
class NfcIdBuyScreen extends ConsumerStatefulWidget {
  const NfcIdBuyScreen({super.key, required this.code});
  final String code;

  @override
  ConsumerState<NfcIdBuyScreen> createState() => _NfcIdBuyScreenState();
}

class _NfcIdBuyScreenState extends ConsumerState<NfcIdBuyScreen> {
  final _name = TextEditingController();
  bool _busy = false;
  String? _error;
  bool _seeded = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _buy(IdQuote quote) async {
    final l = L.of(context);
    if (_name.text.trim().isEmpty) {
      setState(() => _error = l.idNameLabel);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(shopRepositoryProvider).buyId(
          code: quote.code,
          name: _name.text.trim(),
        );
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (draft) => context.push(Routes.nfcIdOrder(draft.orderId)),
      err: (e) {
        // Kod shu daqiqada band bo'lib qolgan bo'lishi mumkin —
        // holatni qayta o'qiymiz, aks holda ekran eski "Sotuvda"
        // yozuvi bilan qolib ketardi.
        ref.invalidate(idQuoteProvider(quote.code));
        setState(() => _error = describeError(l, e));
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final quote = ref.watch(idQuoteProvider(widget.code));

    return NovaScaffold(
      title: l.idDetailTitle,
      showBack: true,
      body: quote.when(
        loading: () => const SkeletonList(count: 2, height: 120),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(idQuoteProvider(widget.code))),
        data: (q) {
          // Ism maydoni profildagi nom bilan to'ldiriladi — odam uni
          // qaytadan yozib o'tirmasin. Faqat BIR MARTA: keyin u
          // yozgan matn ustidan yozib yuborilmaydi.
          if (!_seeded) {
            _seeded = true;
            final me = ref.read(sessionProvider);
            if (me is SessionActive && _name.text.isEmpty) {
              _name.text = me.user.name;
            }
          }
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
              if (q.purchasable) ...[
                const SizedBox(height: Gap.xl),
                NovaField(
                  label: l.idNameLabel,
                  controller: _name,
                  enabled: !_busy,
                  maxLength: 60,
                ),
              ],
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
              // SOTIB OLIB BO'LMAYDIGAN ID UCHUN TUGMA UMUMAN YO'Q.
              // O'chirilgan tugma odamda "balki bosilar" degan umid
              // qoldiradi; sababi esa yuqorida kapsulada yozilgan.
              if (q.purchasable)
                NovaButton(
                  label: l.idBuy,
                  busy: _busy,
                  onPressed: _busy ? null : () => _buy(q),
                ),
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
              if (o.pending) ...[
                const SizedBox(height: Gap.xl),
                SectionHeader(title: l.checkoutPayWith),
                // TO'LOV HAVOLALARI SERVERDAN KELADI — ilova merchant
                // ID yoki summani havolaga o'zi yozmaydi.
                if (o.paymeLink.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.md),
                    child: _PayButton(
                      label: 'Payme',
                      brand: _paymeBrand,
                      onTap: () => openLink(o.paymeLink),
                    ),
                  ),
                if (o.clickLink.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.md),
                    child: _PayButton(
                      label: 'Click',
                      brand: _clickBrand,
                      onTap: () => openLink(o.clickLink),
                    ),
                  ),
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


// ─────────────────────────────────────────────── to'lov provayderi

// BREND RANGLARI SAYTDAN OLINGAN — o'ylab topilmagan.
//
// `src/pages/PaymentsPage.jsx` da ayni shu ikki qiymat turadi:
//
//     { id: 'payme', label: 'Payme', color: '#33c8b6' }
//     { id: 'click', label: 'Click', color: '#0d6efd' }
//
// Ikki joyda ikki xil rang bo'lsa, odam saytda bir xil, ilovada
// boshqacha tugma ko'rardi va qaysi biri haqiqiy ekaniga
// ishonmasdi.
const _paymeBrand = Color(0xFF33C8B6);
const _clickBrand = Color(0xFF0D6EFD);

/// To'lov provayderi tugmasi — O'Z RANGIDA.
///
/// Ilgari ikkalasi ham oddiy NovaButton edi: biri oltin, ikkinchisi
/// kulrang. Provayder tanlash to'lovdagi eng muhim qadam va odam uni
/// RANGIDAN taniydi — matnni o'qib emas. Shuning uchun har biri
/// o'z brend rangida.
///
/// Logotip TASVIRI ishlatilmadi: repoda Payme/Click belgilari yo'q
/// va ularni o'zim chizish — begona brendni taqlid qilish bo'lardi.
/// O'rniga brend rangi va nomi, NFCSTORE shakllari bilan.
class _PayButton extends StatelessWidget {
  const _PayButton({
    required this.label,
    required this.brand,
    required this.onTap,
  });

  final String label;
  final Color brand;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Brend rangi ustida oq matn har doim o'qiladi (ikkala rang ham
    // to'yingan va o'rtacha yorug'likda), shuning uchun matn oq.
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: R.gentle,
        child: Ink(
          height: 52,
          decoration: BoxDecoration(
            color: brand,
            borderRadius: R.gentle,
            boxShadow: [
              BoxShadow(
                color: brand.withValues(alpha: .34),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .22),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Text(
                  label.characters.first,
                  style: const TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: Gap.md),
              Text(
                label,
                style: const TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 15.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: .2,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: Gap.md),
              Icon(Icons.arrow_forward_rounded,
                  size: 18, color: Colors.white.withValues(alpha: .85)),
            ],
          ),
        ),
      ),
    );
  }
}
