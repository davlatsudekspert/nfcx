import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/surfaces.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/external_link.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../home/widgets/avatar.dart';
import '../social/content_rules.dart';
import '../../design/widgets/brand_icon.dart';

/// Ilova versiyasi.
///
/// `pubspec.yaml` dagi qiymat bilan bir xil bo'lishi uchun
/// `--dart-define` orqali beriladi; berilmasa standart qiymat.
const kAppVersion = String.fromEnvironment('NOVA_VERSION', defaultValue: '1.0.0');

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);

    return NovaScaffold(
      title: l.settings,
      showBack: true,
      body: NovaScroll(
        children: [
          if (user != null)
            FloatingSurface(
              solid: true,
              onTap: () => context.push(Routes.profileEdit),
              child: Row(
                children: [
                  Avatar(url: user.avatarUrl, initials: user.initials, size: 52),
                  const SizedBox(width: Gap.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleMedium),
                        Text(user.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 20, color: t.text3),
                ],
              ),
            ),
          SectionHeader(title: l.settingsAccount),
          SettingsGroup(items: [
            SettingsItem(
              icon: Icons.person_outline_rounded,
              label: l.profileEdit,
              onTap: () => context.push(Routes.profileEdit),
            ),
            SettingsItem(
              icon: Icons.storefront_outlined,
              label: l.bizTitle,
              onTap: () => context.push(Routes.business),
            ),
            SettingsItem(
              icon: Icons.nfc_rounded,
              label: l.nfcMyIds,
              onTap: () => context.push(Routes.nfcIds),
            ),
            SettingsItem(
              icon: Icons.shield_outlined,
              label: l.settingsSecurity,
              onTap: () => context.push(Routes.settingsSecurity),
            ),
          ]),
          SectionHeader(title: l.settingsAppearance),
          SettingsGroup(items: [
            SettingsItem(
              icon: Icons.palette_outlined,
              label: l.settingsTheme,
              value: _themeName(l, ref.watch(themeProvider).id),
              onTap: () => context.push(Routes.settingsTheme),
            ),
            SettingsItem(
              icon: Icons.translate_rounded,
              label: l.settingsLanguage,
              value: switch (ref.watch(localeProvider).languageCode) {
                'ru' => l.langRu,
                'en' => l.langEn,
                _ => l.langUz,
              },
              onTap: () => context.push(Routes.settingsLanguage),
            ),
            SettingsItem(
              icon: Icons.notifications_none_rounded,
              label: l.settingsNotifications,
              onTap: () => context.push(Routes.settingsNotifications),
            ),
            SettingsItem(
              icon: Icons.lock_outline_rounded,
              label: l.settingsPrivacy,
              onTap: () => context.push(Routes.settingsPrivacy),
            ),
          ]),
          // GOOGLE PLAY TO'LOV QOIDASI (egasining qarori, 2026-09):
          // "To'lovlar tarixi" va "Premium" menyudan olindi — raqamli
          // xizmat (Premium, NFC ID) to'lovi saytda, ilova ichida esa
          // to'lov haqida hech narsa ko'rinmasin. Jismoniy NFC karta
          // buyurtmalari qoladi: jismoniy tovar Play Billing'dan ozod
          // (`shop/store_policy.dart`).
          SectionHeader(title: l.settingsShopSection),
          SettingsGroup(items: [
            SettingsItem(
              icon: Icons.receipt_long_outlined,
              label: l.orders,
              onTap: () => context.push(Routes.orders),
            ),
            SettingsItem(
              icon: Icons.card_giftcard_outlined,
              label: l.settingsReferral,
              onTap: () => context.push(Routes.settingsReferral),
            ),
          ]),
          SectionHeader(title: l.settingsSupport),
          SettingsGroup(items: [
            SettingsItem(
              icon: Icons.support_agent_rounded,
              label: l.settingsSupport,
              onTap: () => context.push(Routes.settingsSupport),
            ),
            // Kontent qoidalari — joylash paytidagi darvoza bilan
            // AYNAN bir matn. Foydalanuvchi uni istalgan vaqtda
            // qayta o'qiy olishi kerak.
            SettingsItem(
              icon: Icons.gavel_rounded,
              label: l.rulesOpen,
              onTap: () => ensureContentRules(context, ref, force: true),
            ),
            // Maxfiylik siyosati — Play talabi: ilova ichidan ham
            // ochilsin. Bu to'lov havolasi emas (anti-steering qoidasi
            // faqat xaridga tegishli).
            SettingsItem(
              icon: Icons.privacy_tip_outlined,
              label: l.privacyPolicy,
              onTap: () => openLink('$kApiBase/privacy'),
            ),
            SettingsItem(
              icon: Icons.info_outline_rounded,
              label: l.settingsAbout,
              onTap: () => context.push(Routes.settingsAbout),
            ),
          ]),
          const SizedBox(height: Gap.xxl),
          // SAYT HAQIDA — bosh menyuning pastida, chiqishdan oldin.
          //
          // Ilovada NFC kartani SOTIB OLIB bo'lmaydi: jismoniy
          // buyurtma, to'liq katalog va yetkazib berish saytda.
          // Odam buni bilmasa, ilovada qidirib topolmay qoladi.
          const _SiteCard(),
          const SizedBox(height: Gap.xxl),
          NovaButton(
            label: l.logout,
            tone: ButtonTone.danger,
            icon: Icons.logout_rounded,
            onPressed: () => _confirmLogout(context, ref),
          ),
          const SizedBox(height: Gap.xl),
          Center(
            child: Column(
              children: [
                const BrandLogo(size: 46, style: BrandLogoStyle.badge),
                const SizedBox(height: Gap.sm),
                Text(l.settingsVersion(kAppVersion),
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _themeName(L l, String id) => switch (id) {
        'graphite' => l.themeGraphite,
        'ocean' => l.themeOcean,
        'aurora' => l.themeAurora,
        'mono' => l.themeMono,
        'onyx' => l.themeOnyx,
        'noir' => l.themeNoir,
        'ivory' => l.themeIvory,
        _ => l.themePearl,
      };

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final l = L.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.logout),
        content: Text(l.logoutConfirm),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(l.actionCancel)),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child:
                Text(l.logout, style: TextStyle(color: context.tokens.error)),
          ),
        ],
      ),
    );
    if (ok == true) await ref.read(sessionProvider.notifier).logout();
  }
}

/// Sozlamalar ro'yxatidagi bitta qator.
class SettingsItem {
  const SettingsItem({
    required this.icon,
    required this.label,
    this.value,
    this.onTap,
    this.danger = false,
    this.trailing,
  });

  final IconData icon;
  final String label;

  /// O'ng tomondagi joriy qiymat (masalan tanlangan mavzu nomi).
  final String? value;
  final VoidCallback? onTap;
  final bool danger;
  final Widget? trailing;
}

/// Bir nechta sozlama qatorini bitta sirtga yig'adi.
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({super.key, required this.items});

  final List<SettingsItem> items;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.symmetric(vertical: Gap.xs),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0)
              Padding(
                padding: const EdgeInsets.only(left: 52),
                child: Divider(height: 1, color: t.border2),
              ),
            _Row(item: items[i]),
          ],
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.item});
  final SettingsItem item;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final color = item.danger ? t.error : t.text1;

    return PressableScale(
      onTap: item.onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: 13),
        child: Row(
          children: [
            BrandAwareIcon(item.icon, size: 19, color: color),
            const SizedBox(width: Gap.lg),
            Expanded(
              child: Text(
                item.label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    Theme.of(context).textTheme.bodyLarge?.copyWith(color: color),
              ),
            ),
            if (item.value != null)
              Padding(
                padding: const EdgeInsets.only(left: Gap.sm),
                child: Text(
                  item.value!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ),
            if (item.trailing != null)
              item.trailing!
            else if (item.onTap != null)
              Padding(
                padding: const EdgeInsets.only(left: 4),
                child: Icon(Icons.chevron_right_rounded, size: 18, color: t.text3),
              ),
          ],
        ),
      ),
    );
  }
}


/// SAYTGA TAKLIF — yumshoq, reklama bo'lib ko'rinmaydigan karta.
///
/// Rang qat'iy yozilmagan: aksent gradienti ham, hoshiya ham
/// mavzudan keladi.
class _SiteCard extends StatelessWidget {
  const _SiteCard();

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.lg),
      borderRadius: BorderRadius.circular(24),
      // BOSILMAYDI: anti-steering — ilovada saytga bosiladigan havola
      // yo'q (`shop/store_policy.dart`). Manzil matn sifatida o'qiladi.
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: t.accentGradient,
            ),
            child: Icon(Icons.language_rounded, size: 21, color: t.onAccent),
          ),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.siteCardTitle,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(l.siteCardBody,
                    style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
