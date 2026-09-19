import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/providers.dart';
import '../../core/utils/validators.dart';
import '../../design/motion/motion.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/brand_logo.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/fields.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../business/business_screens.dart' show formatMoney;
import '../profile/profile_repository.dart';
import '../../data/repositories/shop_repository.dart';
import 'settings_screen.dart';

// ------------------------------------------------------------------ mavzu

/// Mavzu tanlash.
///
/// Har variant O'Z ranglarida ko'rsatiladi — ro'yxatdagi nom emas,
/// KO'RINISH tanlanadi. Logotip ham har kartada, chunki uning
/// kontrasti mavzu bo'yicha tekshirilishi kerak.
class ThemeSettingsScreen extends ConsumerWidget {
  const ThemeSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final current = ref.watch(themeProvider);

    String name(String id) => switch (id) {
          'graphite' => l.themeGraphite,
          'ocean' => l.themeOcean,
          'aurora' => l.themeAurora,
          'midnight' => l.themeMidnight,
          _ => l.themePearl,
        };

    return NovaScaffold(
      title: l.settingsTheme,
      showBack: true,
      body: NovaScroll(
        children: [
          for (final t in NfcTokens.all)
            Padding(
              padding: const EdgeInsets.only(bottom: Gap.md),
              child: PressableScale(
                onTap: () => ref.read(themeProvider.notifier).select(t),
                child: AnimatedContainer(
                  duration: Motion.fast,
                  padding: const EdgeInsets.all(Gap.lg),
                  decoration: BoxDecoration(
                    gradient: t.backdrop,
                    borderRadius: R.soft,
                    border: Border.all(
                      color: current.id == t.id ? t.accent2 : t.border2,
                      width: current.id == t.id ? 2 : 1,
                    ),
                    boxShadow: current.id == t.id ? t.shadowSoft : null,
                  ),
                  child: Row(
                    children: [
                      // Logotip o'z plastinasi bilan — shu mavzuda
                      // kontrast yetarlimi, shu yerdan ko'rinadi.
                      Theme(
                        data: Theme.of(context).copyWith(extensions: [t]),
                        child: const BrandLogo(size: 48, halo: false),
                      ),
                      const SizedBox(width: Gap.lg),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name(t.id),
                              style:
                                  AppType.displayStyle(color: t.text1, size: 19),
                            ),
                            const SizedBox(height: Gap.sm),
                            Row(
                              children: [
                                for (final c in [
                                  t.accent1,
                                  t.accent2,
                                  t.accentB,
                                  t.accentC,
                                  t.accentD
                                ])
                                  Container(
                                    width: 18,
                                    height: 18,
                                    margin: const EdgeInsets.only(right: 6),
                                    decoration: BoxDecoration(
                                      color: c,
                                      shape: BoxShape.circle,
                                      border: Border.all(color: t.border2),
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      if (current.id == t.id)
                        Icon(Icons.check_circle_rounded,
                            size: 22, color: t.accent2),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// -------------------------------------------------------------------- til

class LanguageSettingsScreen extends ConsumerWidget {
  const LanguageSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final current = ref.watch(localeProvider);

    final options = [
      ('uz', l.langUz, 'O‘zbekcha'),
      ('ru', l.langRu, 'Русский'),
      ('en', l.langEn, 'English'),
    ];

    return NovaScaffold(
      title: l.settingsLanguage,
      showBack: true,
      body: NovaScroll(
        children: [
          SettingsGroup(
            items: [
              for (final o in options)
                SettingsItem(
                  icon: Icons.translate_rounded,
                  // Har til O'Z tilida yoziladi: rus tilidagi foydalanuvchi
                  // "Ruscha" ni emas, "Русский" ni qidiradi.
                  label: o.$3,
                  onTap: () =>
                      ref.read(localeProvider.notifier).select(Locale(o.$1)),
                  trailing: current.languageCode == o.$1
                      ? Icon(Icons.check_circle_rounded,
                          size: 20, color: context.tokens.accent2)
                      : const SizedBox(width: 20),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------- xavfsizlik

/// Parolni almashtirish.
///
/// Backend tasdiqlash kodini talab qiladi
/// (`/api/settings/request-password-code`), shuning uchun oqim ikki
/// bosqichli: kod so'rash → yangi parol + kod.
class SecuritySettingsScreen extends ConsumerStatefulWidget {
  const SecuritySettingsScreen({super.key});

  @override
  ConsumerState<SecuritySettingsScreen> createState() =>
      _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState
    extends ConsumerState<SecuritySettingsScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _code = TextEditingController();

  bool _codeSent = false;
  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(profileRepositoryProvider).requestPasswordCode();
    if (!mounted) return;
    setState(() {
      _busy = false;
      res.when(
        ok: (_) {
          _codeSent = true;
          _info = l.verifySending;
        },
        err: (e) => _error = describeError(l, e),
      );
    });
  }

  Future<void> _submit() async {
    final l = L.of(context);
    if (Validate.password(_next.text) != null) {
      setState(() => _error = l.errPasswordShort);
      return;
    }
    if (Validate.code(_code.text) != null) {
      setState(() => _error = l.errBadCode);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final res = await ref.read(profileRepositoryProvider).changePassword(
          currentPassword: _current.text,
          newPassword: _next.text,
          code: _code.text.trim(),
        );
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l.settingsPasswordChanged)));
        context.pop();
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return NovaScaffold(
      title: l.settingsChangePassword,
      showBack: true,
      body: NovaScroll(
        children: [
          NovaField(
            label: l.settingsCurrentPassword,
            controller: _current,
            obscure: true,
            enabled: !_busy,
          ),
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.settingsNewPassword,
            controller: _next,
            obscure: true,
            enabled: !_busy,
          ),
          if (_codeSent) ...[
            const SizedBox(height: Gap.lg),
            NovaField(
              label: l.verifyTitle,
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              enabled: !_busy,
            ),
          ],
          if (_info != null && _error == null) ...[
            const SizedBox(height: Gap.lg),
            Text(_info!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall),
          ],
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: t.error)),
          ],
          const SizedBox(height: Gap.xxl),
          NovaButton(
            label: _codeSent ? l.actionSave : l.loginSendCode,
            busy: _busy,
            onPressed: _codeSent ? _submit : _requestCode,
          ),
          SectionHeader(title: l.settingsDeleteAccount),
          FloatingSurface(
            solid: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.settingsDeleteConfirm,
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: Gap.lg),
                NovaButton(
                  label: l.settingsDeleteAccount,
                  tone: ButtonTone.danger,
                  onPressed: () => _confirmDelete(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Hisobni o'chirish.
  ///
  /// Backend'da bu amal uchun ochiq endpoint yo'q (admin panelidan
  /// bajariladi), shuning uchun ilova YOLG'ON "o'chirildi" demaydi —
  /// murojaat qo'llab-quvvatlash xizmatiga yuboriladi.
  Future<void> _confirmDelete(BuildContext context) async {
    final l = L.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.settingsDeleteAccount),
        content: Text(l.settingsDeleteConfirm),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(l.actionCancel)),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l.actionConfirm,
                style: TextStyle(color: context.tokens.error)),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final res = await ref
        .read(profileRepositoryProvider)
        .support('ACCOUNT_DELETE_REQUEST');
    if (!mounted) return;
    res.when(
      ok: (_) => ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l.supportSent))),
      err: (e) => ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(describeError(l, e)))),
    );
  }
}

// -------------------------------------------------- bildirishnoma/maxfiylik

/// Bildirishnoma sozlamalari.
///
/// Tanlovlar QURILMADA saqlanadi: backend'da push ro'yxati yo'q,
/// shuning uchun ularni serverga yuborish soxta bo'lardi.
class NotificationsSettingsScreen extends ConsumerStatefulWidget {
  const NotificationsSettingsScreen({super.key});

  @override
  ConsumerState<NotificationsSettingsScreen> createState() =>
      _NotificationsSettingsScreenState();
}

class _NotificationsSettingsScreenState
    extends ConsumerState<NotificationsSettingsScreen> {
  final _values = <String, bool>{
    'scan': true,
    'social': true,
    'orders': true,
    'news': false,
  };

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    final rows = <(String, String, IconData)>[
      ('scan', l.nfcScans, Icons.nfc_rounded),
      ('social', l.homePosts, Icons.favorite_rounded),
      ('orders', l.orders, Icons.receipt_long_rounded),
      ('news', l.settingsNews, Icons.campaign_rounded),
    ];

    return NovaScaffold(
      title: l.settingsNotifications,
      showBack: true,
      body: NovaScroll(
        children: [
          FloatingSurface(
            solid: true,
            padding: const EdgeInsets.symmetric(vertical: Gap.xs),
            child: Column(
              children: [
                for (final r in rows)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: Gap.lg, vertical: 5),
                    child: Row(
                      children: [
                        Icon(r.$3, size: 19, color: t.text1),
                        const SizedBox(width: Gap.lg),
                        Expanded(
                          child: Text(r.$2,
                              style: Theme.of(context).textTheme.bodyLarge),
                        ),
                        Switch(
                          value: _values[r.$1]!,
                          activeThumbColor: t.accent2,
                          onChanged: (v) => setState(() => _values[r.$1] = v),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: Gap.lg),
          Text(
            l.devBackendRequired,
            textAlign: TextAlign.center,
            style: AppType.monoStyle(color: t.text3, size: 10.5),
          ),
        ],
      ),
    );
  }
}

class PrivacySettingsScreen extends StatefulWidget {
  const PrivacySettingsScreen({super.key});

  @override
  State<PrivacySettingsScreen> createState() => _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState extends State<PrivacySettingsScreen> {
  bool _publicProfile = true;
  bool _showStats = true;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return NovaScaffold(
      title: l.settingsPrivacy,
      showBack: true,
      body: NovaScroll(
        children: [
          FloatingSurface(
            solid: true,
            padding: const EdgeInsets.symmetric(vertical: Gap.xs),
            child: Column(
              children: [
                _Toggle(
                  icon: Icons.public_rounded,
                  label: l.profileLinks,
                  value: _publicProfile,
                  onChanged: (v) => setState(() => _publicProfile = v),
                ),
                _Toggle(
                  icon: Icons.insights_rounded,
                  label: l.nfcViews,
                  value: _showStats,
                  onChanged: (v) => setState(() => _showStats = v),
                ),
              ],
            ),
          ),
          const SizedBox(height: Gap.lg),
          Text(l.devBackendRequired,
              textAlign: TextAlign.center,
              style: AppType.monoStyle(color: t.text3, size: 10.5)),
        ],
      ),
    );
  }
}

class _Toggle extends StatelessWidget {
  const _Toggle({
    required this.icon,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: 5),
      child: Row(
        children: [
          Icon(icon, size: 19, color: t.text1),
          const SizedBox(width: Gap.lg),
          Expanded(
              child:
                  Text(label, style: Theme.of(context).textTheme.bodyLarge)),
          Switch(
            value: value,
            activeThumbColor: t.accent2,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}

// --------------------------------------------------- to'lovlar / referal

class PaymentHistoryScreen extends ConsumerWidget {
  const PaymentHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final payments = ref.watch(paymentHistoryProvider);

    return NovaScaffold(
      title: l.paymentHistory,
      showBack: true,
      body: payments.when(
        loading: () => const SkeletonList(count: 3),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(paymentHistoryProvider)),
        data: (items) => items.isEmpty
            ? StatePanel(
                icon: Icons.payments_outlined,
                title: l.stateEmpty,
                message: l.stateEmptyHint)
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                    Gap.screenX, Gap.md, Gap.screenX, 120),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: Gap.sm),
                itemBuilder: (context, i) {
                  final p = items[i];
                  return FloatingSurface(
                    solid: true,
                    padding: const EdgeInsets.all(Gap.lg),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text('${p['provider'] ?? p['status'] ?? ''}',
                              style: Theme.of(context).textTheme.bodyLarge),
                        ),
                        Text(
                          formatMoney(
                              (p['amount'] as num?)?.toInt() ?? 0, 'UZS'),
                          style: AppType.monoStyle(color: t.text1, size: 13),
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}

final paymentHistoryProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.watch(shopRepositoryProvider).payments();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

final referralsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.watch(profileRepositoryProvider).referrals();
  return res.when(ok: (v) => v, err: (e) => throw e);
});

class ReferralScreen extends ConsumerWidget {
  const ReferralScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final referrals = ref.watch(referralsProvider);

    return NovaScaffold(
      title: l.settingsReferral,
      showBack: true,
      body: NovaScroll(
        children: [
          if (user != null && user.promoCode.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(Gap.xl),
              decoration: BoxDecoration(
                gradient: t.accentGradient,
                borderRadius: R.organic(a: 34, b: 34, c: 34, d: 14),
                boxShadow: t.shadowSoft,
              ),
              child: Column(
                children: [
                  Text(
                    l.settingsReferral.toUpperCase(),
                    style: TextStyle(
                      fontFamily: AppType.sans,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.3,
                      color: t.onAccent.withValues(alpha: .6),
                    ),
                  ),
                  const SizedBox(height: Gap.sm),
                  SelectableText(
                    user.promoCode,
                    style: AppType.monoStyle(
                        color: t.onAccent, size: 26, letterSpacing: 3),
                  ),
                ],
              ),
            )
          else
            FloatingSurface(
              solid: true,
              child: Text(l.stateEmpty,
                  style: Theme.of(context).textTheme.bodyMedium),
            ),
          const SizedBox(height: Gap.lg),
          Text(l.settingsReferralHint,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium),
          SectionHeader(title: l.profileFollowers),
          referrals.when(
            loading: () => const Skeleton(height: 60, radius: R.gentle),
            error: (e, __) => StatePanel.fromError(context, asAppError(e)),
            data: (items) => items.isEmpty
                ? FloatingSurface(
                    solid: true,
                    child: Text(l.stateEmpty,
                        style: Theme.of(context).textTheme.bodyMedium),
                  )
                : Column(
                    children: [
                      for (final r in items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: Gap.sm),
                          child: FloatingSurface(
                            solid: true,
                            padding: const EdgeInsets.all(Gap.lg),
                            child: Text('${r['email'] ?? r['name'] ?? ''}',
                                style:
                                    Theme.of(context).textTheme.bodyLarge),
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class PremiumScreen extends ConsumerWidget {
  const PremiumScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final t = context.tokens;

    return NovaScaffold(
      title: l.settingsPremium,
      showBack: true,
      body: NovaScroll(
        children: [
          Center(
            child: Container(
              width: 84,
              height: 84,
              decoration:
                  BoxDecoration(gradient: t.accentGradient, shape: BoxShape.circle),
              child: Icon(Icons.workspace_premium_rounded,
                  size: 38, color: t.onAccent),
            ),
          ),
          const SizedBox(height: Gap.xl),
          Text(l.settingsPremium,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayMedium),
          const SizedBox(height: Gap.sm),
          Text(l.settingsReferralHint,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: Gap.section),
          NovaButton(
            label: l.supportWriteUs,
            onPressed: () async {
              final res =
                  await ref.read(profileRepositoryProvider).requestPremium();
              if (!context.mounted) return;
              res.when(
                ok: (_) => ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text(l.supportSent))),
                err: (e) => ScaffoldMessenger.of(context)
                    .showSnackBar(SnackBar(content: Text(describeError(l, e)))),
              );
            },
          ),
        ],
      ),
    );
  }
}

class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key});

  @override
  ConsumerState<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends ConsumerState<SupportScreen> {
  final _message = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final l = L.of(context);
    if (Validate.required(_message.text) != null) {
      setState(() => _error = l.errRequired);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final res =
        await ref.read(profileRepositoryProvider).support(_message.text.trim());
    if (!mounted) return;
    setState(() => _busy = false);
    res.when(
      ok: (_) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l.supportSent)));
        context.pop();
      },
      err: (e) => setState(() => _error = describeError(l, e)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return NovaScaffold(
      title: l.settingsSupport,
      showBack: true,
      body: NovaScroll(
        children: [
          NovaField(
            label: l.supportWriteUs,
            controller: _message,
            maxLines: 6,
            maxLength: 1000,
            enabled: !_busy,
          ),
          if (_error != null) ...[
            const SizedBox(height: Gap.lg),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontFamily: AppType.sans,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: context.tokens.error)),
          ],
          const SizedBox(height: Gap.xxl),
          NovaButton(label: l.actionConfirm, busy: _busy, onPressed: _send),
        ],
      ),
    );
  }
}

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;

    return NovaScaffold(
      title: l.settingsAbout,
      showBack: true,
      body: NovaScroll(
        children: [
          const SizedBox(height: Gap.xl),
          const Center(child: BrandLockup(size: 96)),
          const SizedBox(height: Gap.xl),
          Center(
            child: Text(l.settingsVersion(kAppVersion),
                style: Theme.of(context).textTheme.bodyMedium),
          ),
          const SizedBox(height: Gap.section),
          FloatingSurface(
            solid: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('uz.nfcstore.nova',
                    style: AppType.monoStyle(color: t.text2, size: 12)),
                const SizedBox(height: Gap.sm),
                Text('nfcstore.uz',
                    style: AppType.monoStyle(color: t.text2, size: 12)),
              ],
            ),
          ),
          SectionHeader(title: l.settingsNews),
          FloatingSurface(
            solid: true,
            onTap: () => context.push(Routes.discover),
            child: Row(
              children: [
                Icon(Icons.campaign_rounded, size: 19, color: t.accent2),
                const SizedBox(width: Gap.md),
                Expanded(
                    child: Text(l.settingsNews,
                        style: Theme.of(context).textTheme.bodyLarge)),
                Icon(Icons.chevron_right_rounded, size: 18, color: t.text3),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
