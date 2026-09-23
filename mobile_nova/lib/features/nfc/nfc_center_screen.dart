import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/utils/sharing.dart';

import '../../core/network/api_client.dart';

import '../../design/motion/motion.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../home/home_screen.dart';
import '../home/widgets/my_ids_strip.dart';
import 'nfc_service.dart';
import 'qr_sheet.dart';

/// NFC markazi — ilovaning vizual o'zagi.
///
/// Soft editorial: markazda NFCSTORE BREND MUHRI (pastki nav va
/// Splash'dagi bilan bir xil) va undan sekin tarqaluvchi ingichka
/// to'lqinlar. Ostida bitta aniq tugma, keyin barcha amallar BITTA
/// guruhlangan ro'yxatda, eng pastda "NFC ID'larim".
///
/// Tepada qurilmaning HAQIQIY NFC holati: apparati yo'q bo'lsa yoki
/// o'chirilgan bo'lsa buni yashirmaydi.
///
/// Ro'yxat pastida `navSafeBottom` — ID'lar suzuvchi navigatsiya
/// OSTIGA kirib qolmaydi.
class NfcCenterScreen extends ConsumerWidget {
  const NfcCenterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final id = ref.watch(activeIdProvider);
    final availability = ref.watch(nfcAvailabilityProvider);
    // NFC APPARATI YO'Q — skaner va "kartaga yozish" bu qurilmada
    // ishlamaydi. Ular o'rniga ishlaydigan yo'llar ko'rsatiladi
    // (QR, havola, ID boshqaruvi) — ekran boshi berk ko'cha emas.
    final noNfc = availability.valueOrNull == NfcAvailability.unsupported;
    final width = MediaQuery.sizeOf(context).width;

    // 360 da 120, 430 da 144.
    final core = (width * .335).clamp(112.0, 148.0);

    const x = EdgeInsets.symmetric(horizontal: Gap.screenX);

    return NovaScaffold(
      title: l.nfcCenter,
      actions: [
        // Kelgan sovg'alar — backend'da bu oqim bor edi, ilovada
        // ko'rish yo'li yo'q edi.
        NovaIconButton(
          icon: Icons.card_giftcard_rounded,
          tooltip: l.giftOffers,
          onPressed: () => context.push(Routes.giftOffers),
        ),
        const SizedBox(width: Gap.sm),
        NovaIconButton(
          icon: Icons.history_rounded,
          tooltip: l.nfcHistory,
          onPressed: () => context.push(Routes.nfcHistory),
        ),
      ],
      body: NovaScroll(
        // Gorizontal chegara har bo'limda alohida: ID lentasi ekran
        // chetigacha suriladi.
        padding: EdgeInsets.only(
          top: Gap.sm,
          bottom: navSafeBottom(context) + Gap.lg,
        ),
        children: [
          Padding(
            padding: x,
            child: availability.when(
              loading: () => const SizedBox(height: Gap.sm),
              error: (_, __) => const SizedBox(height: Gap.sm),
              data: (a) => a == NfcAvailability.unsupported
                  ? const SizedBox.shrink()
                  : _StatusStrip(availability: a),
            ),
          ),
          if (noNfc) ...[
            const SizedBox(height: Gap.lg),
            const Padding(padding: x, child: NoNfcPanel()),
          ] else ...[
          const SizedBox(height: Gap.lg),
          Center(
            child: ScanCore(
              size: core,
              semanticLabel: l.nfcTapToScan,
              onTap: () => context.push(Routes.nfcScan),
            ),
          ),
          const SizedBox(height: Gap.md),
          Padding(
            padding: x,
            child: Column(
              children: [
                Text(
                  l.nfcTapToScan,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  l.nfcHoldCard,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: Gap.xl),
                Center(
                  child: NovaButton(
                    label: l.nfcScanStart,
                    icon: Icons.center_focus_weak_rounded,
                    expand: false,
                    onPressed: () => context.push(Routes.nfcScan),
                  ),
                ),
              ],
            ),
          ),
          ],
          const SizedBox(height: Gap.section),

          // BARCHA AMALLAR — BITTA GURUH.
          //
          // Avval ular orb atrofida aylanib yurardi (4 ta) va yana
          // uchta alohida karta turardi. Aylanayotgan tugmani nishonga
          // olish qiyin, rus tilidagi uzun yorliqlar bir-biriga
          // tiqilardi. Endi hammasi bir ustunda, bir xil balandlikda.
          //
          // "Kartaga yozish" birinchi: u odamning boshqa kartasidagi
          // ma'lumotni o'chirishi mumkin, shuning uchun alohida ekran
          // (tekshiruv + tasdiq) orqali ishlaydi — bu yerda faqat
          // kirish.
          Padding(
            padding: x,
            child: _ActionGroup(
              rows: [
                if (!noNfc)
                  _ActionRow(
                    icon: Icons.edit_note_rounded,
                    title: l.nfcWrite,
                    subtitle: l.nfcWriteSubtitle,
                    onTap: () => context.push(Routes.nfcWrite),
                  ),
                // Bosh sahifadagi "ID qidirish" ham AYNAN shu ekranni
                // ochadi — ikkinchi katalog yo'q. NFC'siz qurilmada u
                // yuqoridagi panelda — takrorlanmaydi.
                if (!noNfc) _ActionRow(
                  icon: Icons.search_rounded,
                  title: l.idMarketTitle,
                  subtitle: l.idMarketSearchHint,
                  onTap: () => context.push(Routes.nfcMarket),
                ),
                if (id != null && !noNfc)
                  _ActionRow(
                    icon: Icons.qr_code_2_rounded,
                    title: l.nfcShowQr,
                    subtitle: id.code,
                    mono: true,
                    onTap: () => showQrSheet(context, id),
                  ),
                _ActionRow(
                  icon: Icons.credit_card_rounded,
                  title: l.nfcCards,
                  subtitle: l.nfcCardsHint,
                  onTap: () => context.push(Routes.nfcCards),
                ),
                if (id != null)
                  _ActionRow(
                    icon: Icons.card_giftcard_rounded,
                    title: l.nfcGift,
                    subtitle: l.nfcGiftHint,
                    onTap: () => context.push(Routes.nfcGift(id.code)),
                  ),
                _ActionRow(
                  icon: Icons.shield_outlined,
                  title: l.nfcSecurity,
                  subtitle: l.nfcSecurityHint,
                  onTap: () => context.push(Routes.nfcSecurity),
                ),
              ],
            ),
          ),
          SectionHeader(
            title: l.nfcMyIds,
            action: l.actionSeeAll,
            onAction: () => context.push(Routes.nfcIds),
          ),
          if (ref.watch(myIdsProvider).isEmpty)
            Padding(
              padding: x,
              child: FloatingSurface(
                solid: true,
                child: Text(l.homeNoIdHint,
                    style: Theme.of(context).textTheme.bodyMedium),
              ),
            )
          else
            // Profildagi bilan AYNAN bitta widget — ikki nusxa yo'q.
            const MyIdsStrip(),
        ],
      ),
    );
  }
}

/// Markaziy skaner nuqtasi — brend muhri va sekin tarqaluvchi
/// to'lqinlar (ripple).
///
/// Uchta ingichka halqa muhr qirrasidan chiqib, kengayib so'nadi —
/// NFC to'lqini. Glow, radial nur, rangli dog' YO'Q: faqat 0.8px
/// champagne chiziq. Muhrning o'zi juda sekin "nafas oladi" (3%).
///
/// "Harakatni kamaytirish" yoqilganda to'lqinlar to'xtaydi va ikkita
/// statik halqa qoladi; ilova fonga ketganda `TickerMode` to'xtatadi.
class ScanCore extends StatefulWidget {
  const ScanCore({
    super.key,
    required this.size,
    this.onTap,
    this.semanticLabel,
  });

  /// Muhr diametri. Butun maydon `size * 2` — to'lqinlar uchun joy.
  final double size;
  final VoidCallback? onTap;
  final String? semanticLabel;

  @override
  State<ScanCore> createState() => _ScanCoreState();
}

class _ScanCoreState extends State<ScanCore>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2800),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (reduceMotion(context)) {
      _c.stop();
      _c.value = .35;
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final still = reduceMotion(context);
    final area = widget.size * 2;

    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: SizedBox(
        width: area,
        height: area,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned.fill(
              child: IgnorePointer(
                child: RepaintBoundary(
                  child: CustomPaint(
                    painter: _RipplePainter(
                      progress: _c,
                      core: widget.size,
                      color: t.brand,
                      still: still,
                    ),
                  ),
                ),
              ),
            ),
            PressableScale(
              onTap: widget.onTap,
              scale: .95,
              child: AnimatedBuilder(
                animation: _c,
                builder: (context, child) {
                  // Nafas: 0 -> 1 -> 0 bir sikl ichida, 3% gacha.
                  final breath = still
                      ? 0.0
                      : (1 - math.cos(_c.value * 2 * math.pi)) / 2;
                  return Transform.scale(
                    scale: 1 + breath * .03,
                    child: child,
                  );
                },
                child: BrandSeal(size: widget.size, elevated: true),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RipplePainter extends CustomPainter {
  _RipplePainter({
    required this.progress,
    required this.core,
    required this.color,
    required this.still,
  }) : super(repaint: progress);

  final Animation<double> progress;
  final double core;
  final Color color;
  final bool still;

  static const _waves = 3;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final start = core / 2 + 6;
    final end = size.shortestSide / 2 - 2;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = .9;

    if (still) {
      for (final f in const [.34, .7]) {
        paint.color = color.withValues(alpha: .32 * (1 - f * .6));
        canvas.drawCircle(c, start + (end - start) * f, paint);
      }
      return;
    }

    for (var i = 0; i < _waves; i++) {
      final p = (progress.value + i / _waves) % 1.0;
      // Chiqishda tez, oxirida sekin — suvdagi to'lqin kabi.
      final eased = Curves.easeOutCubic.transform(p);
      final r = start + (end - start) * eased;
      final a = math.pow(1 - p, 1.6).toDouble() * .55;
      paint.color = color.withValues(alpha: a);
      canvas.drawCircle(c, r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _RipplePainter old) =>
      old.color != color || old.core != core || old.still != still;
}

/// Guruhlangan amallar kartasi — qatorlar orasida ingichka chiziq.
class _ActionGroup extends StatelessWidget {
  const _ActionGroup({required this.rows});
  final List<_ActionRow> rows;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: t.border2),
        boxShadow: t.shadowTiny,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          children: [
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0)
                Padding(
                  padding: const EdgeInsets.only(left: 72),
                  child: Divider(height: 1, thickness: 1, color: t.border2),
                ),
              rows[i],
            ],
          ],
        ),
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle = '',
    this.mono = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  /// Pastki yozuv kodmi (`VIP001`) — unda IBM Plex Mono.
  final bool mono;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final theme = Theme.of(context).textTheme;
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Gap.lg, 14, Gap.md, 14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: t.surface2,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, size: 20, color: t.text1),
              ),
              const SizedBox(width: Gap.lg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.titleSmall),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: mono
                            ? AppType.monoStyle(
                                color: t.text2, size: 12, letterSpacing: .6)
                            : theme.bodySmall,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: Gap.sm),
              Icon(Icons.chevron_right_rounded, size: 20, color: t.text3),
            ],
          ),
        ),
      ),
    );
  }
}

/// Qurilmaning NFC holati — yashirilmaydi.
class _StatusStrip extends StatelessWidget {
  const _StatusStrip({required this.availability});
  final NfcAvailability availability;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    final (icon, text, tone) = switch (availability) {
      NfcAvailability.ready => (Icons.check_circle_rounded, l.nfcActive, t.success),
      NfcAvailability.disabled => (Icons.nfc_rounded, l.nfcDisabled, t.warn),
      NfcAvailability.unsupported =>
        (Icons.do_not_disturb_on_outlined, l.nfcUnsupported, t.text3),
      NfcAvailability.unknown => (Icons.hourglass_empty_rounded, l.stateLoading, t.text3),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: Gap.md),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: .11),
        borderRadius: R.pill,
        border: Border.all(color: tone.withValues(alpha: .3)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: tone),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontFamily: 'Manrope',
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: t.text1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}


/// NFC APPARATI YO'Q QURILMA — nima qilish mumkinligini aytadi.
///
/// Ilgari bu holatda faqat "Bu qurilmada NFC yo'q" yozuvi va skaner
/// tugmasi turardi (bosilsa ham hech narsa bo'lmasdi). Endi NFC'siz
/// ham ishlaydigan HAQIQIY yo'llar beriladi:
///   * QR kod — boshqa odam telefonining kamerasi bilan ochadi;
///   * havolani ulashish — Telegram, SMS...;
///   * NFC ID'larni boshqarish va yangi ID olish.
class NoNfcPanel extends ConsumerWidget {
  const NoNfcPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final id = ref.watch(activeIdProvider);

    Widget tile(IconData icon, String title, String hint, VoidCallback onTap,
            Key key, {bool mono = false}) =>
        Expanded(
          child: PressableScale(
            onTap: onTap,
            child: Container(
              key: key,
              padding: const EdgeInsets.all(Gap.md),
              height: 118,
              decoration: BoxDecoration(
                color: t.surfaceSolid,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: t.border2),
                boxShadow: t.shadowTiny,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, size: 22, color: t.text1),
                  const Spacer(),
                  Text(title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 2),
                  Text(hint,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      // ID — IBM Plex Mono (shrift qoidasi).
                      style: mono
                          ? AppType.monoStyle(
                              color: t.text2, size: 12, letterSpacing: .8)
                          : Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          ),
        );

    return Column(
      key: const ValueKey('no-nfc-panel'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(Gap.xl),
          decoration: BoxDecoration(
            color: Color.lerp(t.surfaceSolid, t.brandSoft, .35),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: t.brand.withValues(alpha: .45)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const BrandSeal(size: 44, elevated: false),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: Text(l.nfcUnsupported,
                        style: AppType.displayStyle(color: t.text1, size: 24)),
                  ),
                ],
              ),
              const SizedBox(height: Gap.md),
              Text(l.noNfcExplain,
                  style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
        const SizedBox(height: Gap.md),
        if (id != null) ...[
          Row(
            children: [
              tile(Icons.qr_code_2_rounded, l.nfcShowQr, id.code,
                  () => showQrSheet(context, id), const ValueKey('no-nfc-qr'),
                  mono: true),
              const SizedBox(width: Gap.md),
              tile(Icons.ios_share_rounded, l.noNfcShareLink,
                  l.noNfcShareHint,
                  () => shareLink(id.publicUrl(kApiBase), title: id.name),
                  const ValueKey('no-nfc-share')),
            ],
          ),
          const SizedBox(height: Gap.md),
        ],
        Row(
          children: [
            tile(Icons.badge_outlined, l.nfcMyIds, l.noNfcManageHint,
                () => context.push(Routes.nfcIds),
                const ValueKey('no-nfc-ids')),
            const SizedBox(width: Gap.md),
            tile(Icons.search_rounded, l.idMarketTitle, l.noNfcGetHint,
                () => context.push(Routes.nfcMarket),
                const ValueKey('no-nfc-market')),
          ],
        ),
      ],
    );
  }
}
