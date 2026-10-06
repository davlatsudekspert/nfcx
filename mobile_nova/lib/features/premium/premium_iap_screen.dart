import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/utils/external_link.dart';
import '../../data/models/models.dart';
import '../../design/motion/motion.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/session.dart';
import 'iap_controller.dart';
import 'iap_store.dart';

/// Apple'ning standart foydalanish shartlari (EULA) — App Store
/// Connect'da alohida EULA yuklanmagan ilovalar uchun.
const kAppleEulaUrl =
    'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/// Maxfiylik siyosati.
const kPrivacyUrl = 'https://nfcstore.uz/privacy';

/// App Store hisobidagi obunalarni boshqarish sahifasi (Apple'niki —
/// tashqi to'lovga yo'naltirish emas).
const kAppleManageSubscriptionsUrl =
    'https://apps.apple.com/account/subscriptions';

/// PREMIUM NIMA BERADI — serverdagi qiymatlar bilan AYNAN bir xil.
///
/// `hosting/worker.js`: `COMPANY_FREE_ITEM_LIMIT = 5`,
/// `COMPANY_PREMIUM_ITEM_LIMIT = 25` (biznes katalogi) va
/// `MUSIC_LIMIT_FREE_D1 = 5` / `MUSIC_LIMIT_PREMIUM_D1 = 10` (profil
/// qo'shiqlari, `musicLimitD1(user.isPremium)`). Post, istoriya,
/// video va izoh ro'yxatda YO'Q — ular hammaga bepul (egasining
/// qarori, 2026-10-04). Yangi imkoniyat o'ylab topilmaydi.
const kCatalogFreeLimit = 5;
const kCatalogPremiumLimit = 25;
const kMusicFreeLimit = 5;
const kMusicPremiumLimit = 10;

/// PREMIUM OBUNASI — APPLE IN-APP PURCHASE (faqat iPhone).
///
/// Marshrut (`/premium`) faqat `iapEnabledProvider` yoqilganda
/// ochiladi (`router.dart`); Android'da va kalit o'chiq bo'lsa ekran
/// umuman yo'q. Narx va davr App Store'dan (`ProductDetails.price`) —
/// ilova narx yozmaydi. Saytga to'lov havolasi YO'Q (Apple 3.1.1).
class PremiumIapScreen extends ConsumerStatefulWidget {
  const PremiumIapScreen({super.key});

  @override
  ConsumerState<PremiumIapScreen> createState() => _PremiumIapScreenState();
}

class _PremiumIapScreenState extends ConsumerState<PremiumIapScreen> {
  String? _selected;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted) ref.read(iapControllerProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    final enabled = ref.watch(iapEnabledProvider);
    final s = ref.watch(iapControllerProvider);
    final user = ref.watch(currentUserProvider);
    final paid = user != null && _paidPremium(user);
    final c = ref.read(iapControllerProvider.notifier);

    final products = s.products;
    final selected = products.isEmpty
        ? null
        : products.firstWhere((p) => p.id == _selected,
            orElse: () => products.first);

    return NovaScaffold(
      title: l.premiumTitle,
      showBack: true,
      body: !enabled
          // Kalit ish paytida o'chirilsa — xarid UI darhol yo'qoladi.
          ? Center(
              key: const ValueKey('iap-disabled'),
              child: Padding(
                padding: const EdgeInsets.all(Gap.xl),
                child: Text(l.iapErrDisabled,
                    textAlign: TextAlign.center, style: text.bodyMedium),
              ),
            )
          : NovaScroll(
              children: [
                Center(
                  child: Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                        gradient: t.accentGradient, shape: BoxShape.circle),
                    child: Icon(Icons.workspace_premium_rounded,
                        size: 38, color: t.onAccent),
                  ),
                ),
                const SizedBox(height: Gap.xl),
                Text(paid ? l.premiumActive : l.premiumTitle,
                    textAlign: TextAlign.center, style: text.displayMedium),
                const SizedBox(height: Gap.sm),
                Text(
                  paid ? _validity(l, user) : l.premiumTagline,
                  key: const ValueKey('iap-status'),
                  textAlign: TextAlign.center,
                  style: text.bodyMedium,
                ),
                const SizedBox(height: Gap.section),
                const _Perks(),
                const SizedBox(height: Gap.section),
                if (paid) ...[
                  NovaButton(
                    key: const ValueKey('iap-manage'),
                    label: l.iapManage,
                    tone: ButtonTone.outline,
                    icon: Icons.open_in_new_rounded,
                    onPressed: () => openLink(kAppleManageSubscriptionsUrl),
                  ),
                ] else if (s.loading) ...[
                  const Center(
                    key: ValueKey('iap-loading'),
                    child: Padding(
                      padding: EdgeInsets.all(Gap.xl),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ] else if (products.isEmpty) ...[
                  Text(l.iapUnavailable,
                      key: const ValueKey('iap-unavailable'),
                      textAlign: TextAlign.center,
                      style: text.bodyMedium),
                  const SizedBox(height: Gap.md),
                  NovaButton(
                    label: l.actionRetry,
                    tone: ButtonTone.quiet,
                    onPressed: () => c.load(force: true),
                  ),
                ] else ...[
                  for (final p in products) ...[
                    _PlanCard(
                      product: p,
                      selected: p.id == selected?.id,
                      onTap: s.busy ? null : () => setState(() => _selected = p.id),
                    ),
                    const SizedBox(height: Gap.md),
                  ],
                  const SizedBox(height: Gap.sm),
                  NovaButton(
                    key: const ValueKey('iap-subscribe'),
                    label: l.iapSubscribe,
                    busy: s.buyingId != null || s.verifying,
                    onPressed: s.busy || selected == null
                        ? null
                        : () => c.buy(selected),
                  ),
                ],
                if (s.notice != null) ...[
                  const SizedBox(height: Gap.xl),
                  Text(
                    _notice(l, s.notice!),
                    key: const ValueKey('iap-notice'),
                    textAlign: TextAlign.center,
                    style: text.bodyMedium,
                  ),
                ],
                if (s.failure != null && s.failure != IapFailure.unavailable) ...[
                  const SizedBox(height: Gap.xl),
                  Text(
                    _failure(l, s.failure!),
                    key: const ValueKey('iap-error'),
                    textAlign: TextAlign.center,
                    style: text.bodyMedium?.copyWith(color: t.error),
                  ),
                ],
                const SizedBox(height: Gap.md),
                NovaButton(
                  key: const ValueKey('iap-restore'),
                  label: l.iapRestore,
                  tone: ButtonTone.quiet,
                  busy: s.restoring,
                  onPressed: s.busy ? null : c.restore,
                ),
                const SizedBox(height: Gap.xl),
                // APPLE 3.1.2: avtomatik yangilanish, bekor qilish va
                // to'lov haqida ochiq matn + shartlar va maxfiylik.
                Text(
                  l.iapDisclosure,
                  key: const ValueKey('iap-disclosure'),
                  style: text.bodySmall?.copyWith(color: t.text2),
                ),
                const SizedBox(height: Gap.md),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: Gap.lg,
                  runSpacing: Gap.sm,
                  children: [
                    _Link(
                      key: const ValueKey('iap-terms'),
                      label: l.iapTermsOfUse,
                      url: kAppleEulaUrl,
                    ),
                    _Link(
                      key: const ValueKey('iap-privacy'),
                      label: l.legalPrivacy,
                      url: kPrivacyUrl,
                    ),
                  ],
                ),
              ],
            ),
    );
  }

  /// To'langan Premium (sinov muddati emas). Sinovdagi odam obuna
  /// bo'la oladi — unga rejalar ko'rsatiladi.
  static bool _paidPremium(User u) =>
      u.premium || (u.premiumUntil?.isAfter(DateTime.now()) ?? false);

  static String _validity(L l, User u) {
    final until = u.premiumUntil;
    if (until == null) return l.premiumForever;
    final d = until.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return l.premiumUntil('${two(d.day)}.${two(d.month)}.${d.year}');
  }

  static String _notice(L l, IapNotice n) => switch (n) {
        IapNotice.activated => l.iapActivated,
        IapNotice.pending => l.iapPending,
        IapNotice.inactive => l.iapInactive,
        IapNotice.nothingToRestore => l.iapNothingToRestore,
      };

  static String _failure(L l, IapFailure f) => switch (f) {
        IapFailure.network => l.iapErrNetwork,
        IapFailure.accountMismatch => l.iapErrAccountMismatch,
        IapFailure.alreadyLinked => l.iapErrAlreadyLinked,
        IapFailure.disabled => l.iapErrDisabled,
        IapFailure.server => l.iapErrServer,
        IapFailure.store => l.iapErrStore,
        IapFailure.unavailable => l.iapUnavailable,
      };
}

/// Obuna davri matni — "oy", "yil", "3 oy".
String iapPeriodLabel(L l, IapProduct p) => switch (p.periodUnit) {
      IapPeriodUnit.day => l.iapPeriodDays(p.periodValue),
      IapPeriodUnit.week => l.iapPeriodWeeks(p.periodValue),
      IapPeriodUnit.month => l.iapPeriodMonths(p.periodValue),
      IapPeriodUnit.year => l.iapPeriodYears(p.periodValue),
      null => '',
    };

/// Reja nomi — "Oylik" / "Yillik"; boshqa davrda App Store nomi.
String iapPlanName(L l, IapProduct p) => switch ((p.periodUnit, p.periodValue)) {
      (IapPeriodUnit.month, 1) => l.iapPlanMonthly,
      (IapPeriodUnit.year, 1) => l.iapPlanYearly,
      _ => p.title.isNotEmpty ? p.title : l.premiumTitle,
    };

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.product,
    required this.selected,
    required this.onTap,
  });

  final IapProduct product;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    final period = iapPeriodLabel(l, product);
    return Semantics(
      selected: selected,
      button: true,
      child: PressableScale(
        onTap: onTap,
        child: AnimatedContainer(
          key: ValueKey('iap-plan-${product.id}'),
          duration: Motion.fast,
          padding: const EdgeInsets.all(Gap.lg),
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: R.soft,
            border: Border.all(
              color: selected ? t.accent2 : t.border1,
              width: selected ? 1.6 : 1,
            ),
            boxShadow: t.shadowTiny,
          ),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_off_rounded,
                size: 20,
                color: selected ? t.accent2 : t.text3,
              ),
              const SizedBox(width: Gap.md),
              Expanded(
                child: Text(iapPlanName(l, product), style: text.titleMedium),
              ),
              const SizedBox(width: Gap.md),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // App Store'ning lokallashtirilgan narxi — o'zgarmasdan.
                  Text(product.price,
                      style: TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: t.text1,
                      )),
                  if (period.isNotEmpty)
                    Text('/ $period',
                        style: text.bodySmall?.copyWith(color: t.text2)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Perks extends StatelessWidget {
  const _Perks();

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final items = <(IconData, String)>[
      (
        Icons.inventory_2_outlined,
        l.iapPerkCatalog(kCatalogPremiumLimit, kCatalogFreeLimit)
      ),
      (
        Icons.music_note_rounded,
        l.iapPerkMusic(kMusicPremiumLimit, kMusicFreeLimit)
      ),
    ];
    return FloatingSurface(
      solid: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l.premiumPerksTitle,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: Gap.md),
          for (final (icon, label) in items)
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.sm),
              child: Row(
                children: [
                  Icon(icon, size: 20, color: t.accent2),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: Text(label,
                        style: Theme.of(context).textTheme.bodyMedium),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Link extends StatelessWidget {
  const _Link({super.key, required this.label, required this.url});

  final String label;
  final String url;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return PressableScale(
      onTap: () => openLink(url),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: Gap.sm),
        child: Text(
          label,
          style: TextStyle(
            fontFamily: AppType.sans,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: t.accent2,
            decoration: TextDecoration.underline,
            decorationColor: t.accent2,
          ),
        ),
      ),
    );
  }
}
