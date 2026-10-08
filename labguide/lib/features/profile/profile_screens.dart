import 'dart:ui' show PlatformDispatcher;

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/app_scope.dart';
import '../../app/widgets/lg_page.dart';
import '../../design/widgets/lg_widgets.dart';
import '../../l10n/gen/app_localizations.dart';
import '../auth/auth_controller.dart';
import '../auth/ui/role_screen.dart';
import '../settings/settings_controller.dart';
import '../../app/shell.dart';

enum _SignOut { keepData, deleteData }

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  static const _nativeLanguage = {
    AppLanguage.uz: 'O‘zbekcha',
    AppLanguage.ru: 'Русский',
    AppLanguage.en: 'English',
  };

  /// Hisobli foydalanuvchi: chiqishdan oldin shu qurilmadagi ma'lumotni
  /// ham o'chirish tanlovi (keyingi foydalanuvchi oldingisining QC qaydlari
  /// va xatcho'plarini ko'rmasligi uchun). Mehmon uchun bu “boshidan
  /// sozlash” — ma'lumot o'sha odamniki, o'chirilmaydi.
  Future<void> _signOut(BuildContext context) async {
    final services = context.services;
    if (services.auth.hasAccount) {
      final l = AppLocalizations.of(context);
      final choice = await showDialog<_SignOut>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(l.profileSignOutTitle),
          content: Text(l.profileSignOutBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(l.actionCancel),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(_SignOut.deleteData),
              child: Text(l.profileSignOutDelete),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(_SignOut.keepData),
              child: Text(l.profileSignOut),
            ),
          ],
        ),
      );
      if (choice == null) return;
      if (choice == _SignOut.deleteData) {
        await services.deleteLocalData(PlatformDispatcher.instance.locales);
        await services.settings.resetOnboarding();
        return;
      }
    }
    await services.auth.signOut();
    await services.settings.resetOnboarding();
  }

  @override
  Widget build(BuildContext context) {
    final services = context.services;
    final settings = services.settings;
    final auth = services.auth;
    return ListenableBuilder(
      listenable: Listenable.merge([settings, auth]),
      builder: (context, _) {
        final l = AppLocalizations.of(context);
        final text = Theme.of(context).textTheme;
        final session = auth.session;
        final (String tag, String title, String subtitle) = switch (session) {
          EmailSession(:final email, isDemo: true) => (
            l.profileDemoSession,
            email,
            settings.effectiveRole.title(l),
          ),
          EmailSession(:final email) => (
            l.authEmailLabel,
            email,
            settings.effectiveRole.title(l),
          ),
          _ => (l.profileGuest, l.profileGuest, l.profileGuestSub),
        };
        return LgPage(
          title: l.profileTitle,
          showProfile: false,
          children: [
            LgPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LgTag(tag),
                  const SizedBox(height: 12),
                  Text(title, style: text.titleLarge),
                  const SizedBox(height: 4),
                  Text(subtitle, style: text.bodyMedium),
                  if (!auth.hasAccount) ...[
                    const SizedBox(height: 14),
                    LgButton.secondary(
                      label: l.profileSignIn,
                      icon: Icons.mail_outline_rounded,
                      onPressed: () => context.push('/profile/auth'),
                    ),
                  ],
                ],
              ),
            ),
            LgRow(
              title: l.profileRole,
              subtitle:
                  '${settings.effectiveRole.title(l)} · ${l.profileRoleSub}',
              icon: settings.effectiveRole.icon,
              onTap: () => context.push('/profile/role'),
              divider: false,
            ),
            LgSectionTitle(l.profileLanguage),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final lang in AppLanguage.values)
                  LgChoiceChip(
                    label: _nativeLanguage[lang]!,
                    selected: settings.language == lang,
                    onTap: () => settings.setLanguage(lang),
                  ),
              ],
            ),
            LgSectionTitle(l.profileAppearance),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final (mode, label) in [
                  (ThemeMode.system, l.themeSystem),
                  (ThemeMode.light, l.themeLight),
                  (ThemeMode.dark, l.themeDark),
                ])
                  LgChoiceChip(
                    label: label,
                    selected: settings.themeMode == mode,
                    onTap: () => settings.setThemeMode(mode),
                  ),
              ],
            ),
            const SizedBox(height: 18),
            LgRow(
              title: l.libPacks,
              subtitle: l.libPacksSub,
              icon: Icons.download_for_offline_outlined,
              onTap: () => openInTab(context, '/library/packs'),
            ),
            LgRow(
              title: l.profilePurchase,
              subtitle: l.profilePurchaseSub,
              icon: Icons.workspace_premium_outlined,
              onTap: () => context.push('/profile/purchase'),
            ),
            LgRow(
              title: l.profilePrivacy,
              subtitle: l.profilePrivacySub,
              icon: Icons.shield_outlined,
              onTap: () => context.push('/profile/privacy'),
              divider: false,
            ),
            const SizedBox(height: 18),
            LgButton.secondary(
              label: auth.hasAccount ? l.profileSignOut : l.profileRestartSetup,
              icon: auth.hasAccount
                  ? Icons.logout_rounded
                  : Icons.restart_alt_rounded,
              onPressed: () => _signOut(context),
            ),
            const SizedBox(height: 16),
            Center(
              child: Text(
                l.profileVersion(services.config.appVersion),
                style: text.bodySmall,
              ),
            ),
            if (services.config.showDebugBadge)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Center(
                  child: LgTag(l.debugBuildBadge, tone: LgTone.warning),
                ),
              ),
          ],
        );
      },
    );
  }
}

class PurchaseScreen extends StatelessWidget {
  const PurchaseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return LgPage(
      title: l.purchaseTitle,
      showProfile: false,
      children: [
        LgPanel(
          soft: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l.purchaseFree, style: text.bodyLarge),
              const SizedBox(height: 10),
              Text(l.purchasePro, style: text.bodyLarge),
            ],
          ),
        ),
        LgNotice(l.purchaseNotice),
        const SizedBox(height: 8),
        // Do'kon ulanmagan: tugmalar o'chirilgan, muvaffaqiyat ko'rsatmaydi.
        LgButton(
          label: '${l.purchaseSubscribe} · ${l.notAvailableYet}',
          onPressed: null,
        ),
        const SizedBox(height: 10),
        LgButton.secondary(
          label: '${l.purchaseRestore} · ${l.notAvailableYet}',
          onPressed: null,
        ),
        const SizedBox(height: 12),
        Center(child: LgTag(l.plannedStage('E'), tone: LgTone.neutral)),
      ],
    );
  }
}

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  Future<void> _confirmDelete(BuildContext context) async {
    final l = AppLocalizations.of(context);
    final services = context.services;
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.privacyDeleteConfirmTitle),
        content: Text(l.privacyDeleteConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l.actionDelete),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await services.deleteLocalData(PlatformDispatcher.instance.locales);
    messenger.showSnackBar(SnackBar(content: Text(l.privacyDeleted)));
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return LgPage(
      title: l.privacyTitle,
      showProfile: false,
      children: [
        Text(l.privacyBody, style: text.bodyLarge),
        const SizedBox(height: 12),
        LgRow(
          title: l.privacyTerms,
          subtitle: l.privacyTermsSub,
          icon: Icons.description_outlined,
          onTap: () => context.push('/terms'),
        ),
        LgRow(
          title: l.privacyDeleteLocal,
          subtitle: l.privacyDeleteLocalSub,
          icon: Icons.delete_outline_rounded,
          onTap: () => _confirmDelete(context),
          divider: false,
        ),
      ],
    );
  }
}
