import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/models.dart';
import '../../data/repositories/featured_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../shop/store_policy.dart';
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
  FeaturedPurchase? _pending;
  final String _error = '';

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
                StoreNotice(text: l.storeBuyOnSiteId),
              ] else ...[
                // PAKETLAR VA NARXLAR KO'RINADI — xarid esa saytda.
                //
                // Sabab `lib/features/shop/store_policy.dart` da:
                // Google Play raqamli xizmatni o'z to'lov tizimisiz
                // sotishga ruxsat bermaydi. Ro'yxatni yashirish
                // shart emas — u ma'lumot, xarid emas.
                SectionHeader(title: l.featuredPick),
                for (final p in o.packages)
                  Padding(
                    padding: const EdgeInsets.only(bottom: Gap.md),
                    child: _PackageTile(pack: p),
                  ),
                const SizedBox(height: Gap.md),
                StoreNotice(text: l.storeBuyOnSiteId),
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
  /// Endi faqat MA'LUMOT kartasi: narx va muddat ko'rinadi, lekin
  /// bosilmaydi va tanlanmaydi — xarid saytda.
  const _PackageTile({required this.pack});

  final FeaturedPackage pack;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      child: Row(
        children: [
          // Tanlash doirasi OLIB TASHLANDI: karta endi bosilmaydi va
          // "tanlangan" holati ham yo'q — bu shunchaki narxlar
          // ro'yxati.
          Icon(Icons.bolt_rounded, size: 20, color: t.accent2),
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
