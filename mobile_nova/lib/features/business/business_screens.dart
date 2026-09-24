import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_client.dart';
import '../../core/utils/sharing.dart';
import '../../data/models/models.dart';
import '../../data/repositories/business_repository.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/contact_buttons.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../social/media_frame.dart';
import '../../routing/routes.dart';
import '../home/widgets/avatar.dart';
import '../home/widgets/identity_card.dart';
import 'business_intro.dart';
import 'business_providers.dart';
import '../profile/profile_screen.dart';

/// Biznes bo'limining kirish nuqtasi.
///
/// Hisob bo'lmasa — ochish taklifi; bo'lsa — boshqaruv paneli.
class BusinessScreen extends ConsumerWidget {
  const BusinessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final list = ref.watch(myBusinessesProvider);

    return NovaScaffold(
      title: l.bizTitle,
      showBack: true,
      body: list.when(
        loading: () => const SkeletonList(count: 2),
        error: (e, __) => StatePanel.fromError(
          context,
          asAppError(e),
          onRetry: () => ref.invalidate(myBusinessesProvider),
        ),
        data: (items) => items.isEmpty
            // BO'SH FORMA EMAS — TAKLIF.
            //
            // Ilgari bu yerda quruq `StatePanel` turardi:
            // "Sizda biznes hisobi yo'q" va darhol "Biznes
            // yaratish". Bosgan odam bo'sh anketa ko'rardi va
            // nima uchun to'ldirayotganini bilmasdi.
            //
            // Endi uchta narsa birga: nima berishi, NAMUNANI
            // ko'rish va shundan keyin yaratish. Namuna eng
            // ishonarlisi — u ilovada allaqachon bor
            // (`/demo/business`), shuning uchun tekinga keladi.
            ? const BusinessIntroBody()
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                  Gap.screenX,
                  Gap.md,
                  Gap.screenX,
                  120,
                ),
                itemCount: items.length + 1,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
                itemBuilder: (context, i) {
                  if (i == items.length) {
                    return NovaButton(
                      label: l.bizCreate,
                      tone: ButtonTone.outline,
                      icon: Icons.add_rounded,
                      onPressed: () => context.push(Routes.businessIntro),
                    );
                  }
                  return _BusinessTile(business: items[i]);
                },
              ),
      ),
    );
  }
}

class _BusinessTile extends ConsumerWidget {
  const _BusinessTile({required this.business});
  final Business business;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.lg),
      onTap: () {
        rememberBusiness(ref, business.companyId);
        context.push(Routes.businessDashboard);
      },
      child: Row(
        children: [
          Avatar(
            url: business.logoUrl,
            initials: _initials(business.displayName, business.companyId),
            size: 48,
            ring: false,
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  business.displayName.isEmpty
                      ? business.companyId
                      : business.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                Text(
                  'nfcstore.uz/c/${business.companyId}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppType.monoStyle(color: t.text3, size: 10.5),
                ),
              ],
            ),
          ),
          if (!business.isPublished)
            Capsule(label: l.bizPending, dense: true, tone: t.warn),
        ],
      ),
    );
  }
}

String _initials(String name, String fallback) {
  final s = name.trim().isEmpty ? fallback : name.trim();
  return (s.length >= 2 ? s.substring(0, 2) : s).toUpperCase();
}

/// Biznes boshqaruv paneli.
///
/// Shaxsiy profildan ATAYLAB boshqacha tuzilgan: bu yerda birinchi
/// o'rinda ko'rsatkichlar va boshqaruv, shaxsiyda esa identity va
/// kontent turadi.
/// `activeBusinessProvider == null` — "hali yuklanmadi / xato" ni
/// "haqiqatan biznes yo'q" dan ajratadi.
///
/// Ilgari biznes yaratilgach (ro'yxat qayta yuklanayotganda) panel
/// "Sizda biznes yo'q — Biznes yaratish" deb turardi; odam yana
/// yaratishga urinardi. Tarmoq xatosida ham shunday edi va qayta
/// urinish tugmasi yo'q edi.
Widget businessGateBody(BuildContext context, WidgetRef ref, Widget empty) {
  final all = ref.watch(myBusinessesProvider);
  if (all.isLoading) return const SkeletonList(count: 2);
  if (all.hasError) {
    return StatePanel.fromError(context, asAppError(all.error!),
        onRetry: () => ref.invalidate(myBusinessesProvider));
  }
  return empty;
}

class BusinessDashboardScreen extends ConsumerWidget {
  const BusinessDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final b = ref.watch(activeBusinessProvider);

    if (b == null) {
      return NovaScaffold(
        title: l.bizDashboard,
        showBack: true,
        body: businessGateBody(
          context,
          ref,
          StatePanel(
            icon: Icons.storefront_outlined,
            title: l.bizNone,
            message: l.bizNoneHint,
            actionLabel: l.bizCreate,
            onAction: () => context.push(Routes.businessIntro),
          ),
        ),
      );
    }

    return NovaScaffold(
      title: b.displayName.isEmpty ? b.companyId : b.displayName,
      showBack: true,
      actions: [
        NovaIconButton(
          icon: Icons.edit_rounded,
          tooltip: l.actionEdit,
          onPressed: () => context.push(Routes.businessEdit),
        ),
        const SizedBox(width: Gap.sm),
      ],
      body: NovaScroll(
        children: [
          Row(
            children: [
              Expanded(
                child: _Metric(
                  icon: Icons.visibility_rounded,
                  value: b.views,
                  label: l.nfcViews,
                  tone: t.accentB,
                ),
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: _Metric(
                  icon: Icons.group_rounded,
                  value: b.followers,
                  label: l.profileFollowers,
                  tone: t.accentC,
                ),
              ),
            ],
          ),
          const SizedBox(height: Gap.md),
          if (!b.isPublished)
            Container(
              padding: const EdgeInsets.all(Gap.lg),
              decoration: BoxDecoration(
                color: t.warn.withValues(alpha: .12),
                borderRadius: R.gentle,
                border: Border.all(color: t.warn.withValues(alpha: .35)),
              ),
              child: Row(
                children: [
                  Icon(Icons.hourglass_top_rounded, size: 18, color: t.warn),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: Text(
                      l.bizPending,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                  TextButton(
                    onPressed: () async {
                      final res = await ref
                          .read(businessRepositoryProvider)
                          .submit(b.companyId);
                      if (!context.mounted) return;
                      res.when(
                        ok: (_) => ref.invalidate(myBusinessesProvider),
                        err: (e) => ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(describeError(l, e))),
                        ),
                      );
                    },
                    child: Text(l.bizSubmitReview),
                  ),
                ],
              ),
            ),
          SectionHeader(title: l.bizDashboard),
          FloatingSurface(
            solid: true,
            padding: const EdgeInsets.symmetric(vertical: Gap.sm),
            child: Column(
              children: [
                _NavRow(
                  icon: Icons.inventory_2_rounded,
                  label: l.bizCatalog,
                  onTap: () => context.push(Routes.businessCatalog),
                ),
                _NavRow(
                  icon: Icons.storefront_rounded,
                  label: l.bizStorefront,
                  onTap: () => context.push(Routes.storefront(b.companyId)),
                ),
                _NavRow(
                  icon: Icons.insights_rounded,
                  label: l.bizAnalytics,
                  onTap: () => context.push(Routes.businessAnalytics),
                ),
                _NavRow(
                  icon: Icons.ios_share_rounded,
                  label: l.actionShare,
                  onTap: () => shareLink(
                    '$kApiBase/c/${b.companyId}',
                    title: b.displayName,
                  ),
                ),
              ],
            ),
          ),
          SectionHeader(title: l.profileContact),
          FloatingSurface(
            solid: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (b.phone.isNotEmpty)
                  _InfoRow(icon: Icons.phone_rounded, text: b.phone),
                if (b.address.isNotEmpty)
                  _InfoRow(icon: Icons.place_rounded, text: b.address),
                if (b.website.isNotEmpty)
                  _InfoRow(icon: Icons.language_rounded, text: b.website),
                if (b.phone.isEmpty && b.address.isEmpty && b.website.isEmpty)
                  Text(
                    l.stateEmpty,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.icon,
    required this.value,
    required this.label,
    required this.tone,
  });

  final IconData icon;
  final int value;
  final String label;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(Gap.lg),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: R.gentle,
        border: Border.all(color: t.border2),
        boxShadow: t.shadowTiny,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: t.isDark ? tone : t.text1),
          const SizedBox(height: Gap.sm),
          Text(
            formatCount(value),
            style: Theme.of(
              context,
            ).textTheme.displayMedium?.copyWith(fontSize: 25),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium,
          ),
        ],
      ),
    );
  }
}

class _NavRow extends StatelessWidget {
  const _NavRow({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return PressableScale(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: Gap.lg,
          vertical: Gap.md,
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: t.text1),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Text(label, style: Theme.of(context).textTheme.bodyLarge),
            ),
            Icon(Icons.chevron_right_rounded, size: 18, color: t.text3),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.only(bottom: Gap.sm),
      child: Row(
        children: [
          Icon(icon, size: 15, color: t.text3),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(
              text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }
}

/// Ommaviy vitrina — mijoz ko'radigan sahifa.
class StorefrontScreen extends StatelessWidget {
  const StorefrontScreen({super.key, required this.companyId});

  final String companyId;

  /// BIZNES PROFILI — shaxsiy profil bilan BIR XIL premium ekran
  /// (egasi, 2026-09-24: "Tanlovdan biznes profilga kirganda ham
  /// shaxsiy profildek premium bo'lsin"). Ilgari bu yerda alohida,
  /// oddiy vitrina (chapdagi kichik logo, muqova polosasi) turardi.
  /// Endi markazda logo, nom, ID kapsulasi, statistika, Kuzatish,
  /// aloqa tugmalari, katalog va postlar — hammasi `ProfileScreen`.
  @override
  Widget build(BuildContext context) => ProfileScreen(companyId: companyId);
}

/// MAHSULOT TAFSILOTI — pastdan ochiladigan varaq.
///
/// Katalogdagi plitka bosilganda ochiladi. Ilgari plitkada
/// `onTap` umuman yo'q edi va mahsulotni ko'rishning hech qanday
/// yo'li yo'q edi.
///
/// Varaq ATAYLAB yangi ekran emas: katalogdan chiqib ketmasdan
/// qarab, yopib, keyingisiga o'tish mumkin.
///
/// `contacts` — biznesning aloqa tugmalari. "Bog'lanish" ilgari
/// faqat varaqni YOPARDI; endi o'sha tugmalar shu yerda.
Future<void> showProductSheet(BuildContext context, CatalogItem item,
    {List<ContactAction> contacts = const []}) {
  return showModalBottomSheet(
    context: context,
    // Ildiz navigatorda — aks holda pastki panel varaq ustiga
    // chiziladi va tugmalar ko'rinmay qoladi.
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => _ProductSheet(item: item, contacts: contacts),
  );
}

class _ProductSheet extends StatelessWidget {
  const _ProductSheet({required this.item, this.contacts = const []});

  final CatalogItem item;
  final List<ContactAction> contacts;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final sale = item.salePrice;

    return Container(
      decoration: BoxDecoration(
        color: t.surfaceSolid,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(34)),
        border: Border.all(color: t.border2),
      ),
      padding: EdgeInsets.fromLTRB(
        Gap.xl,
        Gap.md,
        Gap.xl,
        Gap.xl + MediaQuery.viewPaddingOf(context).bottom,
      ),
      // VARAQ AYLANTIRILADI.
      //
      // Kichik ekranda (yoki tizim shrifti kattalashtirilganda)
      // surat, tavsif va narx sig'masdi: "A RenderFlex overflowed
      // by 92 pixels" va pastdagi tugma ko'rinmay qolardi.
      // Balandlik ekranning 88% i bilan cheklanadi, ortig'i
      // aylantiriladi.
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * .88,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: t.border1,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: Gap.lg),
            if (item.imageUrl.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: AspectRatio(
                  aspectRatio: 4 / 3,
                  child: mediaImage(context, item.imageUrl, fit: BoxFit.cover),
                ),
              ),
            const SizedBox(height: Gap.lg),
            Text(item.name, style: Theme.of(context).textTheme.titleLarge),
            if (item.description.isNotEmpty) ...[
              const SizedBox(height: Gap.sm),
              Text(
                item.description,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
            const SizedBox(height: Gap.lg),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // "Narx kelishiladi" — plitkadagidek; "0 so'm" emas.
                Text(
                  item.priceOnRequest
                      ? l.catalogPriceOnRequest
                      : formatMoney(sale ?? item.price, item.currency),
                  style: AppType.monoStyle(color: t.text1, size: 18),
                ),
                if (sale != null && !item.priceOnRequest) ...[
                  const SizedBox(width: Gap.sm),
                  Text(
                    formatMoney(item.price, item.currency),
                    style: AppType.monoStyle(
                      color: t.text3,
                      size: 13,
                    ).copyWith(decoration: TextDecoration.lineThrough),
                  ),
                ],
              ],
            ),
            if (contacts.isNotEmpty) ...[
              const SizedBox(height: Gap.xl),
              Text(l.demoAddToCart,
                  style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: Gap.md),
              ContactButtons(actions: contacts),
            ],
          ],
        ),
      ),
    );
  }
}

/// Katalogdagi bitta mahsulot/xizmat.
class CatalogTile extends StatelessWidget {
  const CatalogTile({super.key, required this.item, this.onTap, this.trailing});

  final CatalogItem item;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.md),
      onTap: onTap,
      child: Row(
        children: [
          ClipRRect(
            borderRadius: R.tile,
            child: SizedBox(
              width: 62,
              height: 62,
              child: item.imageUrl.isEmpty
                  ? ColoredBox(
                      color: t.surface2,
                      child: Icon(
                        item.isService
                            ? Icons.design_services_rounded
                            : Icons.inventory_2_rounded,
                        size: 22,
                        color: t.text3,
                      ),
                    )
                  : mediaImage(context, item.imageUrl, fit: BoxFit.cover),
            ),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                if (item.description.isNotEmpty)
                  Text(
                    item.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        item.priceOnRequest
                            ? l.catalogPriceOnRequest
                            : formatMoney(item.effectivePrice, item.currency),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: item.priceOnRequest
                            ? TextStyle(
                                fontFamily: AppType.sans,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: t.text1,
                              )
                            : AppType.monoStyle(color: t.text1, size: 13),
                      ),
                    ),
                    if (item.hasDiscount) ...[
                      const SizedBox(width: Gap.sm),
                      Text(
                        formatMoney(item.price, item.currency),
                        style: AppType.monoStyle(
                          color: t.text3,
                          size: 11,
                        ).copyWith(decoration: TextDecoration.lineThrough),
                      ),
                    ],
                    if (!item.available) ...[
                      const SizedBox(width: Gap.sm),
                      Capsule(
                        label: l.bizUnavailable,
                        dense: true,
                        tone: t.error,
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// `1250000` → `1 250 000 so'm`.
///
/// `intl` ning `NumberFormat` i har til uchun alohida ajratgich beradi
/// (`1,250,000` inglizchada), UZS esa mahalliy odatga ko'ra bo'sh joy
/// bilan yoziladi — shuning uchun oddiy, barqaror format.
String formatMoney(int amount, String currency) {
  final s = amount.toString();
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
    buf.write(s[i]);
  }
  return '$buf ${currency == 'UZS' ? "so'm" : currency}';
}

