import 'package:flutter/material.dart' show RefreshIndicator;
import 'package:flutter/widgets.dart';

import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
import '../../design/components/press.dart';
import '../../design/components/skeleton.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/sweep.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool force = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await AppScope.read(context).repo.catalog(force: force);
      if (!mounted) return;
      setState(() {
        _all = list;
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
    final goldCodes = _available(Tier.gold);
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
                tr('Sizga xos raqam'),
                subtitle: tr('Profilingiz uchun o‘ziga xos NFC ID tanlang.'),
              ),

              // KATALOG VITRINASI — odam avval tayyor premium kartani
              // ko'radi, keyin tariflar ichiga tushadi. Bu narxlar ro'yxati
              // emas, mahsulot tanlash hissini beradi.
              if (goldCodes.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    S.gutter,
                    S.x4,
                    S.gutter,
                    S.x20,
                  ),
                  child: _CatalogHero(
                    record: goldCodes.first,
                    onTap: () => push<void>(
                      context,
                      (_) => _TierCodesScreen(
                        tier: Tier.gold,
                        codes: goldCodes,
                      ),
                    ),
                  ),
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

// ─────────────────────────────────────────────────────────────

class _CatalogHero extends StatelessWidget {
  const _CatalogHero({required this.record, required this.onTap});

  final Record record;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Gold ID', style: T.section),
          const SizedBox(height: S.x12),
          Press(
            onTap: onTap,
            minSize: 0,
            child: IdentityCard(
              code: record.code,
              tier: Tier.gold,
              holder: record.name,
              flippable: false,
              sweep: true,
            ),
          ),
          const SizedBox(height: S.x8),
          Row(
            children: [
              Text(record.code, style: T.cardTitle),
              const Spacer(),
              Text(
                '${som(record.price)} so‘m',
                style: T.amount.copyWith(color: C.accent),
              ),
              const SizedBox(width: S.x8),
              const NIcon(Ico.chevronRight, size: 18, color: C.accent),
            ],
          ),
        ],
      );
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

/// Tarif qatori — material namunasi, nom, narx.
class _TierRow extends StatelessWidget {
  const _TierRow({
    required this.tier,
    required this.codes,
    required this.onTap,
  });

  final Tier tier;
  final List<Record> codes;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = TierStyle.of(tier);
    final available = codes.isNotEmpty;
    final from = available ? codes.first.price : 0;

    Widget swatch = Container(
      width: 56,
      height: 42,
      decoration: BoxDecoration(
        gradient: style.swatch,
        borderRadius: BorderRadius.circular(R.status),
        border: Border.all(color: style.light.withValues(alpha: .4)),
        boxShadow: C.e1,
      ),
    );

    // Gold — eng mashhur tarif: namunasidan yorug'lik o'tadi.
    if (tier == Tier.gold) {
      swatch = LightSweep(radius: R.status, opacity: .5, child: swatch);
    }

    return Surface(
      padding: const EdgeInsets.all(S.x16),
      glow: tier == Tier.gold,
      border: Border.all(
        color: tier == Tier.gold
            ? C.accent.withValues(alpha: .35)
            : C.line,
      ),
      onTap: available ? onTap : null,
      child: Row(
        children: [
          swatch,
          const SizedBox(width: S.x16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Text(style.label, style: T.cardTitle),
                    if (tier == Tier.gold) ...[
                      const SizedBox(width: S.x8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          gradient: C.actionFace,
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: Text(
                          tr('MASHHUR'),
                          style: T.meta.copyWith(
                            fontSize: 8.5,
                            color: C.onAccent,
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  _hint(tier),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: T.caption.copyWith(fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: S.x8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (available)
                Text(som(from), style: T.amount.copyWith(fontSize: 17))
              else
                Text(tr('Yo‘q'), style: T.amount.copyWith(color: C.ink3)),
              const SizedBox(height: 2),
              Text(
                available
                    ? (tier == Tier.exclusive
                        ? tr('so‘mdan')
                        : tr('so‘m'))
                    : tr('hozircha'),
                style: T.meta.copyWith(fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Naqsh qoidasi — tarif nimadan kelib chiqishini aytadi.
  String _hint(Tier tier) => switch (tier) {
        Tier.exclusive => tr('VIP · BOSS · faqat harflar'),
        Tier.premium => tr('Kuchli naqsh — masalan AAA000'),
        Tier.gold => tr('Takrorlanuvchi harf yoki raqam'),
        Tier.silver => tr('Oyna yoki qo‘shni juftlik'),
        _ => tr('Oddiy AAA000 naqsh'),
      };
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
