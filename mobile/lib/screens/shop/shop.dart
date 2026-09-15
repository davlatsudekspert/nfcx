import 'package:flutter/material.dart' show RefreshIndicator;

import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../../design/components/input.dart';
import '../../design/components/nav_bar.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/refresh.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../nfc/code_search.dart';
import '../nfc/gift_offers.dart';
import '../nfc/id_catalog.dart';
import '../business/create_company.dart';
import '../nfc/order_card.dart';
import '../orders/my_orders.dart';
import '../settings/payments_history.dart';
import '../settings/premium.dart';

/// DO'KON — XARID YO'LINING BOSHI.
///
/// NIMA UCHUN BU TAB PAYDO BO'LDI. Bu joyda "Reels" turardi:
/// boshqalarning postlari to'liq ekranda. Egasi uni olib tashlashni
/// so'radi — ilova ijtimoiy lenta emas, u NFC ID va vizitka
/// mahsuloti. Postlar o'z o'rnida qoldi: har profilda ko'rinadi.
///
/// O'RNIGA NIMA QO'YILDI. Egasi qayta-qayta so'ragan narsa:
/// "ID sotib olishi, NFC kartaga buyurtma berishi, nom qidirishi,
/// saytga o'xshab nom yozsa narxi chiqishi, to'lov Payme Click".
/// Bularning hammasi ilovada BOR edi, lekin uch-to'rt ekran ichida
/// yashiringan edi. Endi ular bitta tabda va bir bosishda.
///
/// NFC MARKAZIDAN FARQI — aniq chegara: NFC markazi kartani
/// ISHLATISH uchun (tegizish, skanerlash, yozish, QR va o'z
/// ID'laringiz), do'kon esa SOTIB OLISH uchun (kod, jismoniy
/// karta, Premium, to'lovlar). NFC markazidagi "karta buyurtma
/// berish" tugmasi o'z joyida qoldi — u faol ID uchun qisqa yo'l,
/// bu yer esa xaridning o'z bo'limi.
class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> with CodeSearch {
  List<Record>? _catalog;

  /// Tarif -> narx (`/api/pricing`, kalit `Tier.name`).
  Map<String, int> _prices = const {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool force = false}) async {
    if (mounted) setState(() => _loading = true);
    try {
      final repo = AppScope.read(context).repo;
      final results = await Future.wait<dynamic>([
        repo.catalog(force: force),
        repo.pricing().catchError((_) => const <String, int>{}),
      ]);
      if (!mounted) return;
      setState(() {
        _catalog = results[0] as List<Record>;
        _prices = results[1] as Map<String, int>;
        _loading = false;
      });
    } catch (_) {
      // Katalog kelmasa ham do'kon ishlaydi: qidiruv va xizmatlar
      // joyida qoladi, faqat "…dan" narxlari ko'rinmaydi.
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  /// Tarif narxi — "shundan boshlanadi".
  ///
  /// Narx serverdan: mijozda narx jadvali yo'q. Avval `/api/pricing`
  /// dagi tarif narxi; u kelmagan bo'lsa — katalogdagi ENG ARZON
  /// bo'sh kod. Ilgari faqat ikkinchisi bor edi va bo'sh kodi yo'q
  /// tarif narxsiz ("Katalogda") turardi.
  int _from(Tier tier) {
    final listed = _prices[tier.name] ?? 0;
    if (listed > 0) return listed;
    var best = 0;
    for (final r in _catalog ?? const <Record>[]) {
      if (r.tier != tier || r.price <= 0 || r.notForSale) continue;
      if (best == 0 || r.price < best) best = r.price;
    }
    return best;
  }

  /// NFC karta buyurtmasi ID ga bog'lanadi — kartaga o'sha ID
  /// yoziladi. ID bo'lmasa avval katalog ochiladi, aks holda
  /// bo'sh forma ochilib odam nima qilishni bilmay qolardi.
  void _orderCard() {
    final state = AppScope.read(context);
    final record = state.active?.record ??
        (state.cards.isNotEmpty ? state.cards.first : null);
    if (record == null) {
      push<void>(context, (_) => const IdCatalogScreen());
      return;
    }
    push<void>(context, (_) => OrderCardScreen(record: record));
  }

  @override
  Widget build(BuildContext context) {
    final searchOpen = searching || found != null;

    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => pullRefresh(() => _load(force: true)),
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(bottom: NavBar.inset(context)),
            children: [
              ScreenTitle(
                tr('Do‘kon'),
                subtitle: tr('ID kod, jismoniy NFC karta va Premium. '
                    'To‘lov — Payme yoki Click.'),
              ),

              // QIDIRUV BIRINCHI: saytdagidek, kod yozilsa uning
              // bandligi va narxi darhol chiqadi.
              Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x8),
                child: SearchField(
                  controller: codeQuery,
                  hint: tr('Kod yozing — masalan AAA000'),
                  onChanged: onCodeQuery,
                ),
              ),

              if (searchOpen)
                ...codeResults(context)
              else ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x8,
                    S.gutter,
                    S.x12,
                  ),
                  child: SectionHeader(
                    tr('Tariflar'),
                    actionLabel: tr('Hammasi'),
                    onAction: () =>
                        push<void>(context, (_) => const IdCatalogScreen()),
                  ),
                ),

                SizedBox(
                  height: 132,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                    itemCount: _tiers.length,
                    separatorBuilder: (_, __) => const SizedBox(width: S.x12),
                    itemBuilder: (context, i) => _loading && _catalog == null
                        ? const Skeleton(width: 132, height: 132, radius: R.card)
                        : _TierCard(
                            tier: _tiers[i],
                            from: _from(_tiers[i]),
                            onTap: () => push<void>(
                              context,
                              (_) => const IdCatalogScreen(),
                            ),
                          ),
                  ),
                ),

                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x24,
                    S.gutter,
                    S.x12,
                  ),
                  child: SectionHeader(tr('Xizmatlar')),
                ),

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: RowGroup(
                    children: [
                      // BIZNES PROFIL — DO'KONDA HAM.
                      //
                      // EGASI: "kompaniyani ham qo'yish kerak, biznes
                      // NFC ID larning savdosi ham bor-ku". To'g'ri:
                      // biznes hisob ochish ILOVADA bor edi, lekin
                      // faqat shaxs almashtirgichdagi kichik
                      // tugmadan — ya'ni xarid qiladigan odam uni
                      // topa olmasdi.
                      ListRow(
                        title: tr('Biznes profil'),
                        subtitle: tr('Katalog, buyurtma va statistika. '
                            'Bepul ID yoki o‘z nomingiz'),
                        leading: const _RowIcon(Ico.building),
                        onTap: () => push<void>(
                          context,
                          (_) => const CreateCompanyScreen(),
                        ),
                      ),
                      ListRow(
                        title: tr('NFC ID karta'),
                        subtitle: tr('Jismoniy karta — telefonga tegizilganda '
                            'profilingiz ochiladi'),
                        leading: const _RowIcon(Ico.card),
                        onTap: _orderCard,
                      ),
                      ListRow(
                        title: tr('Premium profil'),
                        subtitle: tr('Kengaytirilgan imkoniyatlar va belgi'),
                        leading: const _RowIcon(Ico.sparkle),
                        onTap: () =>
                            push<void>(context, (_) => const PremiumScreen()),
                      ),
                      ListRow(
                        title: tr('Sovg‘a takliflari'),
                        subtitle: tr('Sizga yuborilgan ID‘lar'),
                        leading: const _RowIcon(Ico.gift),
                        onTap: () => push<void>(
                          context,
                          (_) => const GiftOffersScreen(),
                        ),
                      ),
                    ],
                  ),
                ),

                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x24,
                    S.gutter,
                    S.x12,
                  ),
                  child: SectionHeader(tr('Xaridlarim')),
                ),

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: RowGroup(
                    children: [
                      ListRow(
                        title: tr('Buyurtmalarim'),
                        subtitle: tr('Holati va yetkazib berish'),
                        leading: const _RowIcon(Ico.truck),
                        onTap: () =>
                            push<void>(context, (_) => const MyOrdersScreen()),
                      ),
                      ListRow(
                        title: tr('To‘lovlar tarixi'),
                        subtitle: tr('Payme va Click orqali to‘lovlar'),
                        leading: const _RowIcon(Ico.wallet),
                        onTap: () => push<void>(
                          context,
                          (_) => const PaymentsHistoryScreen(),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: S.x16),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: S.gutter),
                  child: _PayNote(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Bepul 8 xonali kod do'konda ko'rsatilmaydi — u sotilmaydi.
const _tiers = [
  Tier.bronze,
  Tier.silver,
  Tier.gold,
  Tier.premium,
  Tier.exclusive,
];

/// Tarif kartasi — material namunasi, nomi va "shundan" narxi.
///
/// MATERIAL BIRINCHI: mahsulotning asosiy g'oyasi shu — tarif
/// naqshdan kelib chiqadi va profilda metall bo'lib ko'rinadi.
class _TierCard extends StatelessWidget {
  const _TierCard({required this.tier, required this.from, required this.onTap});

  final Tier tier;
  final int from;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(tier);
    return Press(
      onTap: onTap,
      minSize: 0,
      scale: .97,
      child: Container(
        width: 132,
        padding: const EdgeInsets.all(S.x12),
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(color: C.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 46,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(R.status),
                gradient: style.swatch,
              ),
            ),
            const Spacer(),
            Text(style.label, style: T.cardTitle.copyWith(fontSize: 14)),
            const SizedBox(height: 2),
            Text(
              // Narx kelmagan bo'lsa yolg'on raqam yozilmaydi.
              from > 0 ? trf('{p} dan', {'p': som(from)}) : tr('Katalogda'),
              style: T.caption.copyWith(fontSize: 12, color: C.ink3),
            ),
          ],
        ),
      ),
    );
  }
}

class _RowIcon extends StatelessWidget {
  const _RowIcon(this.icon);

  final Ico icon;

  @override
  Widget build(BuildContext context) => Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: C.accent.withValues(alpha: .09),
          borderRadius: BorderRadius.circular(R.status),
          border: Border.all(color: C.accent.withValues(alpha: .18)),
        ),
        child: NIcon(icon, size: 18, color: C.accent),
      );
}

/// To'lov usullari — xarid qilishdan OLDIN ko'rinadi.
///
/// Odam "qanday to'layman" degan savolga javobni to'lov ekranida
/// emas, shu yerda oladi.
class _PayNote extends StatelessWidget {
  const _PayNote();

  @override
  Widget build(BuildContext context) => Surface(
        padding: const EdgeInsets.all(S.x16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NIcon(Ico.wallet, size: 17, color: C.ink3),
            const SizedBox(width: S.x12),
            Expanded(
              child: Text(
                tr('To‘lov Payme yoki Click orqali amalga oshiriladi. '
                    'To‘lov tasdiqlangach ID darhol profilingizga '
                    'biriktiriladi.'),
                style: T.caption.copyWith(fontSize: 12.5),
              ),
            ),
          ],
        ),
      );
}
