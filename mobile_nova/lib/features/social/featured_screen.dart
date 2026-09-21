import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_error.dart';
import '../../core/utils/external_link.dart';
import '../../data/models/models.dart';
import '../../data/repositories/featured_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../business/business_screens.dart' show formatMoney;

/// POSTNI LENTADA KO'TARISH — NFCSTORE FEATURED.
///
/// ## ILOVA SLOTNI YOQMAYDI
///
/// Bu ekran faqat KUTILAYOTGAN buyurtma ochadi va to'lov
/// sahifasini ochadi. Slot Payme yoki Click tasdiqlagandan
/// keyin, SERVERDA yonadi. Ilovada "to'landi" deb belgilash
/// imkoniyati umuman yo'q — bo'lganda ham u soxta bo'lardi.
///
/// ## NARXNI ILOVA KO'RSATADI, LEKIN BELGILAMAYDI
///
/// Paketlar `/api/featured/packages` dan keladi. So'rovda faqat
/// kun soni yuboriladi. Ilovada narxni qattiq yozib qo'yish —
/// server narxni o'zgartirganda mijozga YOLG'ON raqam ko'rsatish
/// degani.
class FeaturedScreen extends ConsumerStatefulWidget {
  const FeaturedScreen({
    super.key,
    required this.targetKind,
    required this.targetId,
  });

  final String targetKind;
  final int targetId;

  @override
  ConsumerState<FeaturedScreen> createState() => _FeaturedScreenState();
}

class _FeaturedScreenState extends ConsumerState<FeaturedScreen> {
  int? _days;
  bool _busy = false;
  FeaturedPurchase? _pending;
  String _error = '';

  /// Server kalitini ODAM TUSHUNADIGAN gapga o'giradi.
  ///
  /// Umumiy "xatolik yuz berdi" bu yerda yaramaydi: sabablar
  /// aniq va har biri boshqa harakat talab qiladi — biri "boshqa
  /// post tanlang", biri "avval bittasini to'xtating".
  String _say(AppError e) {
    final l = L.of(context);
    return switch (e.code) {
      'already_featured' => l.featuredAlready,
      'too_many_active' => l.featuredTooMany,
      'forbidden' => l.featuredNotYours,
      'payments_disabled' => l.featuredPaymentOff,
      _ => describeError(l, e),
    };
  }

  Future<void> _buy(int days) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    final res = await ref.read(featuredRepositoryProvider).buy(
          targetKind: widget.targetKind,
          targetId: widget.targetId,
          days: days,
        );
    if (!mounted) return;

    await res.when(
      ok: (p) async {
        setState(() {
          _busy = false;
          _pending = p;
        });
        ref.invalidate(myFeaturedProvider);
        // To'lov sahifasi darhol ochiladi. Ochilmasa — havola
        // ekranda qoladi va odam uni qo'lda ocha oladi; jimgina
        // hech narsa qilmaslik eng yomoni.
        final link = p.payme.isNotEmpty ? p.payme : p.click;
        if (link.isEmpty) return;
        final opened = await openLink(link);
        if (!opened && mounted) {
          setState(() => _error = L.of(context).featuredOpenPayment);
        }
      },
      err: (e) async {
        setState(() {
          _busy = false;
          _error = _say(e);
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final offer = ref.watch(featuredPackagesProvider);

    return NovaScaffold(
      title: l.featuredTitle,
      showBack: true,
      body: offer.when(
        loading: () => Center(
          child: CircularProgressIndicator(color: t.accent2, strokeWidth: 2),
        ),
        error: (e, __) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(featuredPackagesProvider),
        ),
        data: (o) {
          if (!o.enabled) {
            return StatePanel(
              icon: Icons.credit_card_off_rounded,
              title: l.featuredPaymentOff,
              tone: t.warn,
            );
          }
          return NovaScroll(
            children: [
              Text(l.featuredIntro,
                  style: Theme.of(context).textTheme.bodyMedium),

              // To'lov ochilgach — kutish holati. Paketlar ro'yxati
              // yashiriladi: ikkinchi marta sotib olish 409 beradi.
              if (_pending != null) ...[
                const SizedBox(height: Gap.lg),
                _Panel(
                  icon: Icons.schedule_rounded,
                  tone: t.warn,
                  title: l.featuredPending,
                  body: l.featuredPendingHint,
                ),
                const SizedBox(height: Gap.md),
                if (_pending!.payme.isNotEmpty)
                  NovaButton(
                    label: l.featuredBuy,
                    icon: Icons.open_in_new_rounded,
                    onPressed: () => openLink(_pending!.payme),
                  ),
              ] else ...[
                SectionHeader(title: l.featuredPick),
                for (final p in o.packages)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.md),
                    child: _PackageTile(
                      pack: p,
                      selected: _days == p.days,
                      onTap: _busy ? null : () => setState(() => _days = p.days),
                    ),
                  ),
                const SizedBox(height: Gap.md),
                NovaButton(
                  label: l.featuredBuy,
                  icon: Icons.credit_card_rounded,
                  busy: _busy,
                  // Muddat tanlanmaguncha tugma o'chiq: qaysi
                  // paket sotib olinayotgani noaniq qolmasin.
                  onPressed: _days == null || _busy ? null : () => _buy(_days!),
                ),
              ],

              if (_error.isNotEmpty) ...[
                const SizedBox(height: Gap.md),
                _Panel(
                  icon: Icons.error_outline_rounded,
                  tone: t.error,
                  title: _error,
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// Bitta paket — kun soni va narxi.
class _PackageTile extends StatelessWidget {
  const _PackageTile({
    required this.pack,
    required this.selected,
    required this.onTap,
  });

  final FeaturedPackage pack;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      onTap: onTap,
      child: Row(
        children: [
          Icon(
            selected
                ? Icons.radio_button_checked_rounded
                : Icons.radio_button_unchecked_rounded,
            size: 20,
            color: selected ? t.accent2 : t.text3,
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Text(
              l.featuredDays(pack.days),
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          Text(
            // Narx do'kon bilan BIR XIL ko'rinishda — ikki joyda
            // ikki xil yozilishi odamni ikkilantirardi.
            formatMoney(pack.price, 'UZS'),
            style: AppType.monoStyle(color: t.text1, size: 14),
          ),
        ],
      ),
    );
  }
}

/// Holat paneli — muvaffaqiyat, kutish yoki xato.
class _Panel extends StatelessWidget {
  const _Panel({
    required this.icon,
    required this.tone,
    required this.title,
    this.body,
  });

  final IconData icon;
  final Color tone;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: .11),
        borderRadius: R.gentle,
        border: Border.all(color: tone.withValues(alpha: .3)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: tone),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                if (body != null) ...[
                  const SizedBox(height: 3),
                  Text(body!, style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
