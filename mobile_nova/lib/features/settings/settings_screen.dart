import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/profile_context.dart';
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
import '../premium/boost_controller.dart' show boostCreditsProvider;
import '../premium/iap_controller.dart'
    show iapEnabledProvider, iapTrialDaysLeft;
import '../shop/store_policy.dart';
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
    final personal = ref.watch(activePersonalProvider);
    final shopItems = [
      if (showOrdersEntry)
        SettingsItem(
          icon: Icons.receipt_long_outlined,
          label: l.orders,
          onTap: () => context.push(Routes.orders),
        ),
      if (!isAppStoreBuild)
        SettingsItem(
          icon: Icons.card_giftcard_outlined,
          label: l.settingsReferral,
          onTap: () => context.push(Routes.settingsReferral),
        ),
    ];

    return NovaScaffold(
      title: l.settings,
      showBack: true,
      body: NovaScroll(
        children: [
          // AKKAUNT XULOSASI — BOSILMAYDI (egasi, 2026-10, iPhone surati).
          //
          // Ilgari bu yerda `user.displayName` turardi: hisobda ism yo'q
          // bo'lsa u email'ning `@` gacha qismi (`ali77099`) — XOM login,
          // avatar o'rnida esa `AL`. Karta bosilsa "Profilni tahrirlash"
          // ochilardi — pastdagi qator bilan bir xil ish (ikki kirish).
          //
          // Endi: ommaviy profil (NFC ID) ismi va avatari, hisobning
          // haqiqiy email'i; ism bo'lmasa — faqat email. Tahrirlash —
          // FAQAT pastdagi "Profilni tahrirlash" qatori.
          if (user != null)
            Builder(builder: (context) {
              final name = [personal?.name ?? '', user.name]
                  .map((e) => e.trim())
                  .firstWhere((e) => e.isNotEmpty, orElse: () => '');
              final avatar = (personal?.avatarUrl ?? '').isNotEmpty
                  ? personal!.avatarUrl
                  : user.avatarUrl;
              final text = Theme.of(context).textTheme;
              return FloatingSurface(
                key: const ValueKey('settings-account'),
                solid: true,
                child: Row(
                  children: [
                    Avatar(
                        url: avatar,
                        initials: _initials(name.isNotEmpty ? name : user.email),
                        size: 52),
                    const SizedBox(width: Gap.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (name.isNotEmpty)
                            Text(name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: text.titleMedium),
                          if (user.email.isNotEmpty)
                            Text(user.email,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: name.isNotEmpty
                                    ? text.bodySmall?.copyWith(color: t.text2)
                                    : text.titleMedium),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          SectionHeader(color: t.text2, title: l.settingsAccount),
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
              icon: Icons.insights_rounded,
              label: l.settingsAnalytics,
              onTap: () => context.push(Routes.settingsAnalytics),
            ),
            SettingsItem(
              icon: Icons.shield_outlined,
              label: l.settingsSecurity,
              onTap: () => context.push(Routes.settingsSecurity),
            ),
            // DO'STLARNI TAKLIF QILISH — iPhone ham, Android ham. Bonus
            // — Premium kunlari (chegirma yoki narx emas).
            SettingsItem(
              icon: Icons.card_giftcard_rounded,
              label: l.inviteTitle,
              onTap: () => context.push(Routes.invite),
            ),
            // PREMIUM — FAQAT iPHONE'DA VA IAP KALITI YOQILGANDA.
            //
            // Xarid Apple In-App Purchase orqali (`features/premium/`).
            // Kalit o'chiq / javob kelmagan / Android — qator YO'Q,
            // menyu avvalgidek (Play qoidasi va 3.1.1 izohlari yuqorida
            // va pastda).
            if (ref.watch(iapEnabledProvider))
              SettingsItem(
                icon: Icons.workspace_premium_rounded,
                label: l.settingsPremium,
                // Bepul sinov paytida — sotuv ham, kunlar sanog'i ham
                // emas: "Hammasi ochiq".
                subtitle:
                    iapTrialDaysLeft(user) != null ? l.iapTrialSettings : null,
                onTap: () => context.push(Routes.premium),
              ),
            // KO'TARISH KREDITLARI — iPhone + kalit va kredit BOR bo'lsa.
            if (ref.watch(boostCreditsProvider).valueOrNull?.isNotEmpty ??
                false)
              SettingsItem(
                icon: Icons.trending_up_rounded,
                label: l.boostCredits,
                value: '${ref.watch(boostCreditsProvider).value!.length}',
                onTap: () => context.push(Routes.boostCredits),
              ),
          ]),
          SectionHeader(color: t.text2, title: l.settingsAppearance),
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
            // iPhone'da YO'Q (`showNotificationSettings` izohida): ilovada
            // push ham, mahalliy bildirishnoma ham yo'q, tugmalar hech
            // narsaga ta'sir qilmasdi. ANDROID O'ZGARMAYDI.
            if (showNotificationSettings)
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
          //
          // iPHONE'DA BU BO'LIM UMUMAN YO'Q (egasi, 2026-10-04):
          //   * "Buyurtmalar" — `showOrdersEntry` izohida;
          //   * "Referal" — mukofoti keyingi NFC ID xaridiga 10%
          //     chegirma (`settingsReferralHint`, server
          //     `pending_discount_pct`). Raqamli mahsulotga chegirma
          //     va'dasi Apple 3.1.1 ga tushadi, chegirmaning o'zi esa
          //     ilovada ishlatilmaydi.
          // Bandlar qolmasa, bo'sh sarlavha ham qolmaydi.
          if (shopItems.isNotEmpty) ...[
            SectionHeader(color: t.text2, title: l.settingsShopSection),
            SettingsGroup(items: shopItems),
          ],
          SectionHeader(color: t.text2, title: l.settingsSupport),
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
          //
          // iPhone'da YO'Q (egasi, 2026-10-04): "...saytda" degan
          // karta Apple tekshiruvchisi uchun tashqi xaridga
          // yo'naltirish (3.1.1 / 3.1.3). `kShowSiteNotice` o'chirilsa
          // Android'da ham yo'qoladi — boshqa sayt yozuvlari kabi.
          if (kShowSiteNotice && !isAppStoreBuild) ...[
            const _SiteCard(),
            const SizedBox(height: Gap.xxl),
          ],
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

  static String _initials(String s) {
    final parts = s.split('@').first.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    final d = parts.first;
    return (d.length >= 2 ? d.substring(0, 2) : d).toUpperCase();
  }

  String _themeName(L l, String id) => switch (id) {
        'graphite' => l.themeGraphite,
        'ocean' => l.themeOcean,
        'aurora' => l.themeAurora,
        'mono' => l.themeMono,
        'onyx' => l.themeOnyx,
        'pudra' => l.themePudra,
        'sakura' => l.themeSakura,
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
    this.subtitle,
    this.onTap,
    this.danger = false,
    this.trailing,
  });

  final IconData icon;
  final String label;

  /// O'ng tomondagi joriy qiymat (masalan tanlangan mavzu nomi).
  final String? value;

  /// Nom ostidagi kichik izoh (masalan "Bepul sinov: 30 kun qoldi").
  final String? subtitle;
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
                // Ajratuvchi Ivory'da deyarli ko'rinmasdi (border2 7.5%).
                child: Divider(height: 1, color: t.border1),
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
    final label = Text(
      item.label,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: color),
    );

    return PressableScale(
      onTap: item.onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: 13),
        child: Row(
          children: [
            BrandAwareIcon(item.icon, size: 19, color: color),
            const SizedBox(width: Gap.lg),
            Expanded(
              child: item.subtitle == null
                  ? label
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        label,
                        Text(
                          item.subtitle!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: t.text2),
                        ),
                      ],
                    ),
            ),
            if (item.value != null)
              Padding(
                padding: const EdgeInsets.only(left: Gap.sm),
                child: Text(
                  item.value!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  // Qiymat (Ivory, O‘zbekcha) — ikkilamchi, lekin o'qiladi.
                  style: Theme.of(context)
                      .textTheme
                      .labelMedium
                      ?.copyWith(color: t.text2, fontWeight: FontWeight.w600),
                ),
              ),
            if (item.trailing != null)
              item.trailing!
            else if (item.onTap != null)
              Padding(
                padding: const EdgeInsets.only(left: 4),
                child: Icon(Icons.chevron_right_rounded, size: 18, color: t.text2),
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
