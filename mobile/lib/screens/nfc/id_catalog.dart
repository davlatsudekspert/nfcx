import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../identity/profile_screen.dart';
import '../../design/components/input.dart';
import '../../design/components/buttons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../orders/my_orders.dart';
import '../settings/premium.dart';
import 'id_detail.dart';

/// ID KATALOGI — TARIFLARNI TAQQOSLASH.
///
/// Dizayn 3a: har qator bitta tarif. Chapda MATERIAL namunasi,
/// o'rtada nom va naqsh, o'ngda narx. Odam bir qarashda beshta
/// darajani ko'radi va farqni MATERIALDAN tushunadi — bu
/// mahsulotning asosiy g'oyasi.
///
/// NARX SERVERDAN. Mijozda narx jadvali YO'Q: har tarif uchun
/// katalogdagi eng arzon mavjud kod narxi ko'rsatiladi. Shuning
/// uchun serverda narx o'zgarsa ilova ham darhol to'g'ri
/// ko'rsatadi.
///
/// BEPUL 8 XONALI KOD alohida turadi: uning materiali yo'q va u
/// sotilmaydi — ro'yxatdan o'tganda beriladi. Shuning uchun qatori
/// punktir chegara bilan chiziladi.
class IdCatalogScreen extends StatefulWidget {
  const IdCatalogScreen({super.key});

  @override
  State<IdCatalogScreen> createState() => _IdCatalogScreenState();
}

class _IdCatalogScreenState extends State<IdCatalogScreen> {
  List<Record>? _all;
  Object? _error;
  bool _loading = true;

  /// Jismoniy karta narxi — SERVERDAN (`/api/settings/physical-nfc-pricing`).
  /// Kodga yozib qo'yilsa, saytda narx o'zgarganda ilova eskisini
  /// ko'rsatib turardi.
  int? _cardFee;

  /// KOD TEKSHIRISH (prototip: `.codecheck`).
  final _code = TextEditingController();
  Record? _found;
  CodeQuote? _quote;
  bool _checked = false;
  bool _checking = false;
  String? _checkError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  /// KODNI TEKSHIRISH — bo'shmi yoki band.
  ///
  /// SERVERDAN so'raladi: katalog faqat SOTUVDAGI kodlarni biladi,
  /// ya'ni "topilmadi" degani "bo'sh" degani emas — kod allaqachon
  /// birovniki bo'lishi mumkin. Shuni faqat server aytadi.
  Future<void> _check() async {
    final code = _code.text.trim().toUpperCase();
    if (code.length < 3) {
      setState(() => _checkError = tr('Kod kamida 3 belgidan iborat bo‘ladi.'));
      return;
    }
    setState(() {
      _checking = true;
      _checkError = null;
    });
    final repo = AppScope.read(context).repo;

    // IKKI SAVOL, IKKI SO'ROV:
    //   1) kod kimdadir bo'lsa — kimda? (`record`)
    //   2) bo'sh bo'lsa — qanchaga? (`codeQuote`)
    //
    // Ilgari faqat birinchisi so'ralardi va bo'sh kod uchun
    // "Topilmadi" chiqardi — holbuki aynan o'shani sotib olsa
    // bo'lardi. Narx endi serverdan keladi (xarid oqimidagi o'sha
    // manbadan), shuning uchun ko'rsatilgan summa to'lanadigan
    // summa bilan bir xil.
    Record? rec;
    Object? recError;
    try {
      rec = await repo.record(code);
    } catch (e) {
      recError = e;
    }

    CodeQuote? quote;
    if (rec == null) {
      try {
        quote = await repo.codeQuote(code);
      } catch (_) {
        // ZAXIRA: `/api/records/:code/quote` hamma o'rnatmada
        // mavjud emas. Ayni kod DO'KON KATALOGIDA tursa, narx
        // allaqachon qo'limizda — o'sha ko'rsatiladi. Aks holda
        // quyida oddiy "topilmadi" chiqadi. Katalog narxi bilan
        // xarid narxi bitta manbadan keladi, ya'ni ko'rsatilgan
        // summa to'lanadigan summa bilan bir xil bo'lib qoladi.
        for (final r in _all ?? const <Record>[]) {
          if (r.code.toUpperCase() != code || r.price <= 0) continue;
          if (r.notForSale) break;
          quote = CodeQuote(
            code: code,
            purchasable: true,
            tier: r.tier.name,
            amount: r.price,
          );
          break;
        }
      }
    }

    if (!mounted) return;
    setState(() {
      _found = rec;
      _quote = quote;
      _checked = true;
      _checking = false;
      _checkError = rec == null &&
              quote == null &&
              recError != null &&
              !recError.toString().contains('NOT_FOUND')
          ? humanError(recError)
          : null;
    });
  }

  Future<void> _load({bool force = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = AppScope.read(context).repo;
      final list = await repo.catalog(force: force);
      int? fee;
      try {
        final pricing = await repo.physicalPricing();
        final v = pricing['physicalCardFee'];
        fee = v is num ? v.round() : null;
      } catch (_) {
        // Narx kelmasa qator baribir ko'rinadi — faqat summa
        // o'rnida chiziqcha turadi.
      }
      if (!mounted) return;
      setState(() {
        _all = list;
        _cardFee = fee;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  /// SOTIB OLISH MUMKIN BO'LGAN KODLAR.
  ///
  /// Narxi bo'lmagan (bepul, sovg'a, sotuvda emas) va allaqachon
  /// o'zimizga tegishli kodlar chiqarib tashlanadi.
  List<Record> _available(Tier tier) {
    final state = AppScope.read(context);
    return [
      for (final r in _all ?? const <Record>[])
        if (r.tier == tier &&
            r.price > 0 &&
            !r.notForSale &&
            !state.ownsRecord(r.code))
          r,
    ]..sort((a, b) => a.price.compareTo(b.price));
  }

  @override
  Widget build(BuildContext context) {
    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _load(force: true),
          color: C.accent,
          backgroundColor: C.surface,
          displacement: 28,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).padding.bottom + S.x32,
            ),
            children: [
              const TopBar(),
              ScreenTitle(
                tr('O‘z kodingizni'),
                accent: tr('tanlang'),
                eyebrow: tr('Do‘kon'),
              ),

              // KOD TEKSHIRISH (prototip: `.codecheck`).
              //
              // Do'konning birinchi savoli — "menga kerakli kod
              // bo'shmi?". Tariflar ro'yxati bunga javob bermaydi:
              // odam aniq kodni yozib, darhol javob olishi kerak.
              Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Field(
                        label: tr('KOD'),
                        controller: _code,
                        hint: 'VIP yoki ABZ007',
                        error: _checkError,
                        maxLength: 16,
                        onSubmitted: (_) => _check(),
                      ),
                    ),
                    const SizedBox(width: S.x8),
                    Padding(
                      padding: const EdgeInsets.only(top: 22),
                      child: PrimaryButton(
                        tr('Tekshirish'),
                        // Qatorda turgani uchun kenglikni O'ZI
                        // egallamaydi — aks holda cheksiz kenglik
                        // so'rab, maketni yiqitadi.
                        expand: false,
                        loading: _checking,
                        onTap: _checking ? null : _check,
                      ),
                    ),
                  ],
                ),
              ),
              if (_checked)
                Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x8),
                  child: _CheckResult(
                    code: _code.text.trim().toUpperCase(),
                    record: _found,
                    quote: _quote,
                    owned: _found != null &&
                        AppScope.read(context).ownsRecord(_found!.code),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x20),
                child: Text(
                  tr('Narxlar serverdan olinadi.'),
                  style: T.caption.copyWith(fontSize: 11.5),
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
                child: SectionHeader(tr('Tariflar')),
              ),

              if (_loading && _all == null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: Column(
                    children: List.generate(
                      5,
                      (_) => const Padding(
                        padding: EdgeInsets.only(bottom: S.x12),
                        child: Skeleton(height: 74, radius: R.card),
                      ),
                    ),
                  ),
                )
              else if (_error != null && _all == null)
                ErrorState(humanError(_error), detail: errorDetail(_error), onRetry: _load)
              else ...[
                // BEPUL — material yo'q, sotilmaydi.
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    0,
                    S.gutter,
                    S.x12,
                  ),
                  child: const _FreeRow(),
                ),

                for (final tier in const [
                  Tier.bronze,
                  Tier.silver,
                  Tier.gold,
                  Tier.premium,
                  Tier.exclusive,
                ])
                  Padding(
                    padding: const EdgeInsets.fromLTRB(
                      S.gutter,
                      0,
                      S.gutter,
                      S.x12,
                    ),
                    child: _TierRow(
                      tier: tier,
                      codes: _available(tier),
                      onTap: () => push<void>(
                        context,
                        (_) => _TierCodesScreen(
                          tier: tier,
                          codes: _available(tier),
                        ),
                      ),
                    ),
                  ),

                // QO'SHIMCHA — prototipdagi ikkinchi blok: jismoniy
                // karta va Profil Premium. Ular ham SOTILADIGAN
                // narsa, ya'ni do'konda turishi kerak.
                Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, S.x20, S.gutter, S.x12),
                  child: SectionHeader(tr('Qo‘shimcha')),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x12),
                  child: _ExtraRow(
                    icon: Ico.card,
                    title: tr('Jismoniy NFC karta'),
                    price: _cardFee,
                    note: tr('Dizayn + yetkazish'),
                    onTap: () => push<void>(context, (_) => const MyOrdersScreen()),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x20),
                  child: _ExtraRow(
                    icon: Ico.sparkle,
                    title: tr('Profil Premium'),
                    // Premium narxi buyurtma yaratilganda serverdan
                    // keladi (`/api/premium/request`), ya'ni bu yerda
                    // uni ko'rsatish uchun manba yo'q.
                    price: null,
                    note: tr('Fon rasmi, video vizitka, musiqa, ko‘proq havola'),
                    onTap: () => push<void>(context, (_) => const PremiumScreen()),
                  ),
                ),

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                  child: Surface(
                    padding: const EdgeInsets.all(S.x16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        NIcon(Ico.info, size: 17, color: C.ink3),
                        const SizedBox(width: S.x12),
                        Expanded(
                          child: Text(
                            tr('Profil Premium va jismoniy NFC karta — '
                                'alohida xizmatlar. Ular tarifni '
                                'o‘zgartirmaydi.'),
                            style: T.caption.copyWith(fontSize: 12.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Bepul 8 xonali kod — punktir chegara bilan.
class _FreeRow extends StatelessWidget {
  const _FreeRow();

  @override
  Widget build(BuildContext context) => CustomPaint(
        painter: _DashedBorderPainter(color: C.ink3.withValues(alpha: .55)),
        child: Padding(
          padding: const EdgeInsets.all(S.x16),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 42,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(R.status),
                  border: Border.all(color: C.ink3.withValues(alpha: .5)),
                ),
                alignment: Alignment.center,
                child: Text(
                  tr('8 XONA'),
                  style: T.meta.copyWith(fontSize: 9, color: C.ink3),
                ),
              ),
              const SizedBox(width: S.x16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(tr('Bepul'), style: T.cardTitle),
                    const SizedBox(height: 3),
                    Text(
                      tr('Ro‘yxatdan o‘tganda 8 xonali kod'),
                      style: T.caption.copyWith(fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: S.x8),
              Text(
                '0 ${tr('so‘m')}',
                style: T.amount.copyWith(color: C.ink2),
              ),
            ],
          ),
        ),
      );
}
/// TARIF QATORI — chapda MINI METALL KARTA, o'ngda nom, narx va
/// bir qatorlik tavsif (prototip: `.tierc`).
///
/// NIMA UCHUN NAMUNA EMAS, KARTA: odam sotib olayotgan narsa —
/// KARTA. Rangli to'rtburchak uni ko'rsatmaydi; kod yozilgan
/// kichik karta esa mahsulotning o'zi bo'lib turadi.
/// QO'SHIMCHA MAHSULOT QATORI (prototip: `.tierc` ning ixcham
/// varianti) — ikonka, nom, narx va bir qatorlik izoh.
class _ExtraRow extends StatelessWidget {
  const _ExtraRow({
    required this.icon,
    required this.title,
    required this.price,
    required this.note,
    required this.onTap,
  });

  final Ico icon;
  final String title;

  /// Narx — SERVERDAN. `null` bo'lsa umuman ko'rsatilmaydi:
  /// to'qilgan summadan ko'ra uning yo'qligi yaxshi.
  final int? price;
  final String note;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        minSize: 0,
        scale: .98,
        child: Container(
          padding: const EdgeInsets.all(S.x12),
          decoration: BoxDecoration(
            color: C.surface,
            borderRadius: BorderRadius.circular(R.card),
            border: Border.all(color: C.line),
          ),
          child: Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: C.accent.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(R.status),
                ),
                alignment: Alignment.center,
                child: NIcon(icon, size: 22, color: C.accent),
              ),
              const SizedBox(width: S.x16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: T.cardTitle),
                    const SizedBox(height: 2),
                    if (price != null) ...[
                      Text('${som(price!)} ${tr('so‘m')}', style: T.price.copyWith(fontSize: 13)),
                      const SizedBox(height: 2),
                    ],
                    Text(note, style: T.caption.copyWith(fontSize: 11.5, height: 1.3)),
                  ],
                ),
              ),
              NIcon(Ico.chevronRight, size: 18, color: C.ink3),
            ],
          ),
        ),
      );
}

/// KOD TEKSHIRUVI NATIJASI (prototip: `.result`).
///
/// Uch holat: BO'SH (narxi bilan, sotib olish mumkin), BAND
/// (egasining profili ochiladi) va MENIKI. Uchalasi ham aniq
/// yoziladi — "topilmadi" degan javob odamni bilmaslikda
/// qoldirardi.
class _CheckResult extends StatelessWidget {
  const _CheckResult({
    required this.code,
    required this.record,
    required this.quote,
    required this.owned,
  });

  final String code;
  final Record? record;

  /// Kod bo'sh bo'lsa — serverdan kelgan narx.
  final CodeQuote? quote;

  final bool owned;

  @override
  Widget build(BuildContext context) {
    final rec = record;
    final q = quote;
    final free = rec != null && rec.price > 0 && !rec.notForSale && !owned;
    final taken = rec != null && !free && !owned;

    final String title;
    final String sub;
    final String? action;
    final VoidCallback? tap;
    if (owned) {
      title = tr('Sizniki');
      sub = tr('Bu kod allaqachon sizda.');
      action = tr('Profil');
      tap = () => push<void>(context, (_) => ProfileScreen(code: rec!.code));
    } else if (free) {
      title = '${tr('Bo‘sh')} · ${TierStyle.of(rec.tier).label}';
      sub = '${tr('Narxi')}: ${som(rec.price)} ${tr('so‘m dan')}';
      action = tr('Sotib olish');
      tap = () => push<void>(context, (_) => IdDetailScreen(record: rec));
    } else if (taken) {
      title = '${tr('Band')} · ${TierStyle.of(rec.tier).label}';
      sub = rec.name.isEmpty ? tr('Bu kod allaqachon sotilgan') : rec.name;
      action = tr('Profil');
      tap = () => push<void>(context, (_) => ProfileScreen(code: rec.code));
    } else if (q != null && q.purchasable) {
      // BO'SH KOD — narxi bilan. Aynan shu holat ilgari
      // "Topilmadi" bo'lib chiqardi.
      title = '${tr('Bo‘sh')} · ${TierStyle.of(TierStyle.parse(q.tier)).label}';
      sub = '${tr('Narxi')}: ${som(q.amount)} ${tr('so‘m')}';
      action = tr('Band qilish');
      tap = () => push<void>(
            context,
            (_) => IdDetailScreen(
              record: Record(
                code: q.code,
                name: '',
                price: q.amount,
                serverTier: q.tier,
              ),
            ),
          );
    } else if (q != null && q.reason == 'reserved_pending_payment') {
      // Kimdir band qilgan, lekin hali to'lamagan — 24 soat
      // ichida to'lanmasa yana bo'shaydi.
      title = tr('Vaqtincha band');
      sub = tr('Kimdir band qildi. To‘lanmasa 24 soatda bo‘shaydi.');
      action = null;
      tap = null;
    } else {
      title = tr('Topilmadi');
      sub = tr('Bu kod sotuvda yo‘q. Boshqa kodni sinab ko‘ring.');
      action = null;
      tap = null;
    }

    return Container(
      padding: const EdgeInsets.all(S.x12),
      decoration: BoxDecoration(
        color: C.surface,
        borderRadius: BorderRadius.circular(R.card),
        border: Border.all(
          color: free || (q?.purchasable ?? false)
              ? C.ok.withValues(alpha: .45)
              : C.line,
        ),
      ),
      child: Row(
        children: [
          Text(code, style: T.code(18, color: C.ink, weight: FontWeight.w700)),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: T.cardTitle),
                const SizedBox(height: 2),
                Text(sub, style: T.caption.copyWith(fontSize: 12)),
              ],
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: S.x8),
            SecondaryButton(action, size: BtnSize.s, expand: false, onTap: tap),
          ],
        ],
      ),
    );
  }
}

class _TierRow extends StatelessWidget {
  const _TierRow({
    required this.tier,
    required this.codes,
    required this.onTap,
  });

  final Tier tier;
  final List<Record> codes;
  final VoidCallback onTap;

  /// Tarifning bir qatorlik tavsifi — prototipdagi matnlar.
  String get _blurb => switch (tier) {
        Tier.bronze => tr('3 harf + 3 raqam. Oddiy, ishonchli.'),
        Tier.silver => tr('Chrome Silver material, story ochiladi.'),
        Tier.gold => tr('Chiroyli kodlar. Pure Gold.'),
        Tier.premium => tr('Juda chiroyli kodlar. Premium Gold.'),
        Tier.exclusive => tr('Faqat harflar. Titanium Gold, ichki nur.'),
        Tier.free => tr('Ro‘yxatdan o‘tganda beriladi.'),
      };

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(tier);
    final available = codes.isNotEmpty;
    final sample = available ? codes.first : null;
    final from = sample?.price ?? 0;

    return Press(
      onTap: available ? onTap : null,
      minSize: 0,
      scale: .98,
      child: Container(
        padding: const EdgeInsets.all(S.x12),
        decoration: BoxDecoration(
          color: C.surface,
          borderRadius: BorderRadius.circular(R.card),
          border: Border.all(color: C.line),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(
              width: 132,
              child: IdentityCard(
                code: sample?.code ?? style.label.toUpperCase(),
                tier: tier,
                url: sample == null
                    ? null
                    : 'nfcstore.uz/${sample.code.toLowerCase()}',
                flippable: false,
                sweep: tier == Tier.gold || tier == Tier.exclusive,
              ),
            ),
            const SizedBox(width: S.x16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(style.label, style: T.section.copyWith(fontSize: 19)),
                  const SizedBox(height: 4),
                  if (available)
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: som(from), style: T.price.copyWith(fontSize: 13)),
                          TextSpan(
                            text: ' ${tr('so‘m dan')}',
                            style: T.caption.copyWith(fontSize: 12),
                          ),
                        ],
                      ),
                    )
                  else
                    Text(tr('Hozircha bo‘sh kod yo‘q'), style: T.caption.copyWith(fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(
                    _blurb,
                    style: T.caption.copyWith(fontSize: 11.5, height: 1.3),
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

/// PUNKTIR CHEGARA.
///
/// Flutter'da tayyor punktir chegara yo'q, `Border` esa faqat
/// tutash chiziq chiza oladi. Bepul tarifni qolganidan ajratish
/// uchun aynan punktir kerak — u "bu material emas" degan ma'noni
/// beradi.
class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(R.card),
    );
    final path = Path()..addRRect(rect);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = color;

    const dash = 5.0;
    const gap = 4.0;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = (distance + dash).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance = next + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) => old.color != color;
}

// ─────────────────────────────────────────────────────────────

/// Bitta tarifdagi bo'sh kodlar.
class _TierCodesScreen extends StatelessWidget {
  const _TierCodesScreen({required this.tier, required this.codes});

  final Tier tier;
  final List<Record> codes;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(tier);

    return ScreenBackdrop(
      aura: Aura.spotlight,
      child: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).padding.bottom + S.x32,
          ),
          children: [
            const TopBar(),
            ScreenTitle(
              style.label,
              eyebrow: tr('Bo‘sh kodlar'),
              subtitle: trf('{n} ta kod tanlash uchun ochiq.', {
                'n': '${codes.length}',
              }),
            ),
            if (codes.isEmpty)
              EmptyState(
                tr('Bu tarifda hozircha bo‘sh kod yo‘q. Boshqa tarifni '
                    'ko‘ring.'),
                title: tr('Bo‘sh kod yo‘q'),
                icon: Ico.card,
              )
            else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: S.gutter),
                child: Wrap(
                  spacing: S.x12,
                  runSpacing: S.x12,
                  children: [
                    for (final r in codes)
                      MiniIdCard(
                        code: r.code,
                        tier: tier,
                        width: (MediaQuery.of(context).size.width -
                                S.gutter * 2 -
                                S.x12) /
                            2,
                        onTap: () => push<void>(
                          context,
                          (_) => IdDetailScreen(record: r),
                        ),
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
