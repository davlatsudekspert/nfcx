import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/profile_context.dart';
import '../../app/providers.dart';
import '../../core/utils/external_link.dart';
import '../../core/utils/result.dart';
import '../../core/utils/validators.dart';
import '../../data/models/models.dart';
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
import '../shop/store_policy.dart';
import '../../routing/routes.dart';
import '../auth/session.dart';
import '../business/business_screens.dart' show formatMoney;
import '../profile/profile_repository.dart';
import '../../data/repositories/shop_repository.dart';
import 'settings_screen.dart';
import '../social/moderation.dart';
import 'app_lock.dart';

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
          'mono' => l.themeMono,
          'onyx' => l.themeOnyx,
          'noir' => l.themeNoir,
        'ivory' => l.themeIvory,
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
                      // Brend nishoni — mavzudan qat'i nazar bir xil.
                      // Kartaning qolgan qismi o'sha mavzuning
                      // ranglarida, shuning uchun nishon yonida
                      // mavzu kontrasti baribir ko'rinib turadi.
                      const BrandLogo(size: 48, style: BrandLogoStyle.badge),
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

/// Parolni almashtirish — joriy parol bilan, bitta qadamda.
///
/// ## NIMA UCHUN KOD YO'Q
///
/// Ilgari bu ekran ikki bosqichli edi: avval emailga kod so'ralardi
/// (`/api/settings/request-password-code`), keyin kod bilan
/// `/api/settings/change-password`. Email xizmati o'chganda kod hech
/// qachon kelmasdi va parolni o'zgartirishning YAGONA yo'li yopilib
/// qolardi.
///
/// Serverda ayni shu ish uchun kodsiz yo'l ALLAQACHON bor:
/// `/api/settings/change-password-direct` — u joriy parolni
/// `verifyPassword` bilan tekshiradi va tezlik cheklovi qo'yadi.
/// Ya'ni xavfsizlik qoidasi yumshatilmadi, faqat tasdiqlash
/// EMAILDAN emas, JORIY PAROLDAN olinadi.
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
  final _next2 = TextEditingController();

  bool _busy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _next2.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l = L.of(context);
    if (_current.text.isEmpty) {
      setState(() => _error = l.settingsCurrentPassword);
      return;
    }
    if (Validate.password(_next.text) != null) {
      setState(() => _error = l.errPasswordShort);
      return;
    }
    // Takrorlash mos kelmasa serverga umuman bormaymiz: aks holda
    // odam xato yozgan parolni bilmasdan o'rnatib qo'yardi va
    // keyingi kirishda ichkariga tusholmasdi.
    if (_next.text != _next2.text) {
      setState(() => _error = l.errPasswordMismatch);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    final res = await ref.read(profileRepositoryProvider).changePassword(
          currentPassword: _current.text,
          newPassword: _next.text,
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
          const SizedBox(height: Gap.lg),
          NovaField(
            label: l.fieldPasswordRepeat,
            controller: _next2,
            obscure: true,
            enabled: !_busy,
          ),
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
            label: l.actionSave,
            busy: _busy,
            onPressed: _submit,
          ),
          // ── LOKAL ILOVA QULFI ──────────────────────────────
          // Bu akkaunt paroli EMAS: server bu haqda bilmaydi.
          SectionHeader(title: l.lockTitle),
          Consumer(builder: (context, ref, _) {
            final lock = ref.watch(appLockProvider);
            return FloatingSurface(
              solid: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.lockDesc,
                      style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: Gap.lg),
                  if (!lock.enabled)
                    NovaButton(
                      label: l.lockSetPin,
                      onPressed: () => showPinSetup(context, ref),
                    )
                  else
                    NovaButton(
                      label: l.lockOff,
                      tone: ButtonTone.quiet,
                      onPressed: () =>
                          ref.read(appLockProvider.notifier).disable(),
                    ),
                ],
              ),
            );
          }),
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

  /// Hisobni o'chirish — HAQIQIY (`DELETE /api/account`).
  ///
  /// Ilgari faqat qo'llab-quvvatlashga murojaat yuborilardi; Google
  /// Play buni qabul qilmaydi. Endi odam oqibatni o'qiydi, "Tushundim"
  /// belgisini qo'yadi va tasdiqlaydi; hisob darhol o'chadi va ilova
  /// kirish ekraniga qaytadi.
  Future<void> _confirmDelete(BuildContext context) async {
    final l = L.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) {
        var understood = false;
        return StatefulBuilder(
          builder: (context, setDialog) => AlertDialog(
            title: Text(l.settingsDeleteAccount),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l.deleteAccountWhat),
                const SizedBox(height: Gap.md),
                CheckboxListTile(
                  key: const ValueKey('delete-understood'),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  value: understood,
                  onChanged: (v) => setDialog(() => understood = v ?? false),
                  title: Text(l.deleteAccountUnderstood),
                ),
              ],
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: Text(l.actionCancel)),
              TextButton(
                key: const ValueKey('delete-confirm'),
                onPressed:
                    understood ? () => Navigator.pop(context, true) : null,
                child: Text(l.settingsDeleteAccount,
                    style: TextStyle(
                        color: understood
                            ? context.tokens.error
                            : context.tokens.text3)),
              ),
            ],
          ),
        );
      },
    );
    if (ok != true || !context.mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    final res = await ref.read(profileRepositoryProvider).deleteAccount();
    if (!mounted) return;
    switch (res) {
      case Ok():
        // Server sessiyalarni o'zi yopdi — bu yerda faqat qurilmadagi
        // token tozalanadi; router kirish ekraniga olib boradi.
        await ref.read(sessionProvider.notifier).logout();
        messenger.showSnackBar(SnackBar(content: Text(l.deleteAccountDone)));
      case Err(:final error):
        messenger
            .showSnackBar(SnackBar(content: Text(describeError(l, error))));
    }
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
  /// Standart holat. `news` — reklama xabarlari, shuning uchun
  /// yoqilgan holda EMAS, o'chiq holda boshlanadi.
  static const _defaults = <String, bool>{
    'scan': true,
    'social': true,
    'orders': true,
    'news': false,
  };

  late final Map<String, bool> _values = {
    for (final e in _defaults.entries)
      e.key: ref.read(prefsProvider).notif(e.key, fallback: e.value),
  };

  Future<void> _set(String key, bool v) async {
    setState(() => _values[key] = v);
    await ref.read(prefsProvider).setNotif(key, v);
  }

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
                          onChanged: (v) => _set(r.$1, v),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: Gap.lg),
          // Ilgari bu yerda "BACKEND ENDPOINT REQUIRED" degan
          // ishlab-chiquvchi yozuvi turardi — foydalanuvchi uchun
          // bu shunchaki buzuq ekran taassuroti berardi.
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.sm),
            child: Text(
              l.notifOnDeviceHint,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: t.text3),
            ),
          ),
        ],
      ),
    );
  }
}

/// MAXFIYLIK.
///
/// Bu ekran ilgari YOLG'ON gapirardi: ikkita tugma bor edi, lekin
/// ularning qiymati hech qayerda saqlanmasdi va hech narsaga
/// ta'sir qilmasdi. Foydalanuvchi "Profil ommaviy" ni o'chirib,
/// profili yashirilgan deb o'ylardi — aslida u katalogda turaverardi.
/// Maxfiylikda bu oddiy o'lik tugmadan ham yomon.
///
/// Endi tugma HAQIQIY maydonga ulangan: `cards.hidden_from_directory`.
/// Server uni allaqachon qabul qilar va qaytarar edi — ilova shunchaki
/// so'ramagan. `worker.js` dagi barcha katalog so'rovlari
/// (`Tanlov`, biznes katalogi, ommaviy sovg'alar devori) aynan shu
/// ustun bo'yicha filtrlaydi.
///
/// "Ko'rishlar statistikasi" tugmasi OLIB TASHLANDI: unga mos ustun
/// backend'da yo'q, ya'ni uni bajarib bo'lmaydigan va'da edi.
class PrivacySettingsScreen extends ConsumerStatefulWidget {
  const PrivacySettingsScreen({super.key});

  @override
  ConsumerState<PrivacySettingsScreen> createState() =>
      _PrivacySettingsScreenState();
}

class _PrivacySettingsScreenState
    extends ConsumerState<PrivacySettingsScreen> {
  /// Saqlash ketayotganda tugma qayta bosilmasin.
  bool _saving = false;

  /// Optimistik qiymat: so'rov ketayotganda tugma darhol siljiydi,
  /// xato bo'lsa joyiga QAYTADI.
  bool? _pending;

  Future<void> _setPublic(NfcId id, bool public) async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _pending = public;
    });

    final res = await ref.read(profileRepositoryProvider).updateProfile(
          code: id.code,
          hiddenFromDirectory: !public,
        );
    if (!mounted) return;

    switch (res) {
      case Ok():
        // Ro'yxat sessiyadan keladi — saqlagandan keyin uni
        // yangilamasak, ekrandan chiqib qaytganda ESKI qiymat
        // ko'rinardi va tugma "o'zi qaytib qoldi" bo'lib tuyulardi.
        await ref.read(sessionProvider.notifier).refresh();
        if (!mounted) return;
        setState(() {
          _saving = false;
          _pending = null;
        });
      case Err(:final error):
        setState(() {
          _saving = false;
          _pending = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeError(L.of(context), error))),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final id = ref.watch(activePersonalProvider);
    final public = _pending ?? (id == null ? true : !id.hiddenFromDirectory);

    return NovaScaffold(
      title: l.settingsPrivacy,
      showBack: true,
      body: NovaScroll(
        children: [
          // Bloklanganlar — backend'da bu ro'yxat bor edi, lekin
          // ilovada unga kirish yo'li yo'q edi.
          FloatingSurface(
            solid: true,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const BlockedScreen()),
            ),
            child: Row(
              children: [
                Icon(Icons.block_rounded, size: 19, color: t.text3),
                const SizedBox(width: Gap.md),
                Expanded(
                  child: Text(l.blockedList,
                      style: Theme.of(context).textTheme.titleSmall),
                ),
                Icon(Icons.chevron_right_rounded, size: 19, color: t.text3),
              ],
            ),
          ),
          const SizedBox(height: Gap.md),
          FloatingSurface(
            solid: true,
            padding: const EdgeInsets.symmetric(vertical: Gap.xs),
            child: _Toggle(
              icon: Icons.public_rounded,
              label: l.privacyPublicProfile,
              value: public,
              onChanged:
                  id == null || _saving ? null : (v) => _setPublic(id, v),
            ),
          ),
          const SizedBox(height: Gap.md),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Gap.sm),
            child: Text(
              l.privacyPublicHint,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: t.text3),
            ),
          ),
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

  /// `null` — saqlash ketyapti yoki profil hali kelmagan.
  final ValueChanged<bool>? onChanged;

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
                  return _PaymentRow(row: items[i]);
                },
              ),
      ),
    );
  }
}

/// TO'LOVLAR TARIXIDAGI BITTA QATOR.
///
/// ## NIMA UCHUN HAMMA SUMMA "0 so'm" EDI
///
/// Server `/api/payments` da summani **`price`** deb yuboradi
/// (`hosting/api/account.js`). Ekran esa **`p['amount']`** ni
/// o'qirdi — bunday kalit javobda UMUMAN YO'Q. Natijada
/// `(null as num?)?.toInt() ?? 0` doim 0 qaytarardi va butun tarix
/// "0 so'm" bo'lib ko'rinardi.
///
/// Xuddi shu sabab birinchi ustunda ham `p['provider']` o'qilardi
/// (server `paymentProvider` yuboradi), shuning uchun u har doim
/// zaxira qiymatga — XOM `status` matniga tushib ketardi. Odam
/// "pending", "cancelled" degan inglizcha so'zlarni ko'rardi va
/// to'lovi nima uchun ekanini bilmasdi.
///
/// Endi qator uch narsani aytadi: NIMA uchun to'langan, QANCHA va
/// HOLATI nima — hammasi tarjima qilingan holda.
class _PaymentRow extends StatelessWidget {
  const _PaymentRow({required this.row});

  final Map<String, dynamic> row;

  /// Summani o'qiydi. `price` — serverning haqiqiy kaliti;
  /// `amount` zaxira sifatida qoldirilgan.
  int get _price {
    final v = row['price'] ?? row['amount'];
    if (v is num) return v.toInt();
    return int.tryParse('$v') ?? 0;
  }

  String _kind(L l) => switch ('${row['kind'] ?? ''}') {
        'card_purchase' => l.payKindCard,
        'physical_card_order' => l.payKindPhysical,
        'auction_payment' => l.payKindAuction,
        'premium_upgrade' => l.payKindPremium,
        'premium_follow' => l.payKindFollow,
        _ => l.payKindOther,
      };

  /// Holat matni va rangi.
  (String, Color) _status(L l, NfcTokens t) =>
      switch ('${row['status'] ?? ''}') {
        'paid' => (l.payStatusPaid, t.success),
        'pending' => (l.payStatusPending, t.warn),
        'cancelled' => (l.payStatusCancelled, t.text3),
        'failed_code_taken' => (l.payStatusFailed, t.error),
        _ => ('${row['status'] ?? ''}', t.text3),
      };

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final (statusText, statusColor) = _status(l, t);
    final provider = '${row['paymentProvider'] ?? row['provider'] ?? ''}';

    return FloatingSurface(
      solid: true,
      padding: const EdgeInsets.all(Gap.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_kind(l), style: Theme.of(context).textTheme.bodyLarge),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(statusText,
                        style: AppType.monoStyle(color: statusColor, size: 11)),
                    if (provider.isNotEmpty) ...[
                      Text(' · ',
                          style: AppType.monoStyle(color: t.text3, size: 11)),
                      Text(provider,
                          style: AppType.monoStyle(color: t.text3, size: 11)),
                    ],
                  ],
                ),
                // TUGALLANMAGAN TO'LOV SHUNDAYLIGINI AYTADI.
                // Ilgari qatorda xom "pending" so'zi turardi va
                // odam to'lovi o'tdimi, yo'qmi bilmasdi.
                if ('${row['status'] ?? ''}' == 'pending') ...[
                  const SizedBox(height: 2),
                  Text(l.payPendingHint,
                      style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
          const SizedBox(width: Gap.md),
          Text(
            formatMoney(_price, 'UZS'),
            style: AppType.monoStyle(color: t.text1, size: 13),
          ),
        ],
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
                      fontWeight: FontWeight.w600,
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

/// PREMIUM OBUNA — ILOVA ICHIDAN SOTIB OLISH.
///
/// ## AVVAL BU YERDA NIMA TURGANI
///
/// Ekran bor edi, lekin u SOXTA edi:
///
///   * `requestPremium()` `post<void>` edi — server qaytargan
///     TO'LOV HAVOLASI tashlab yuborilardi;
///   * tugma yorlig'i `l.supportWriteUs` ("Bizga yozing") edi;
///   * muvaffaqiyatda `l.supportSent` ("Xabar yuborildi") chiqardi —
///     bu YOLG'ON: qo'llab-quvvatlashga hech narsa yuborilmagan,
///     serverda to'lanmagan buyurtma yaratilgan, odam esa to'lov
///     sahifasiga OLIB BORILMAGAN;
///   * narx ham, nima ochilishi ham yozilmagan edi.
///
/// Ya'ni "Premium" tugmasi bosilardi, hech narsa sotib olinmasdi va
/// odam nega Reels qo'ya olmasligini bilmay qolardi.
///
/// ## ENDI QANDAY
///
/// `POST /api/premium/request` → `{orderId, amount, payLinks}`.
/// Havola TIZIM BRAUZERIDA ochiladi (Payme/Click checkout), keyin
/// odam ilovaga qaytganda `GET /api/payments/:id` bilan holat
/// so'raladi va to'langan bo'lsa sessiya yangilanadi.
///
/// NARX SERVERDAN KELADI. Ilova uni o'zida yozib qo'ymaydi: saytda
/// narx o'zgarsa ilova eski summani ko'rsatib turardi.
class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen>
    with WidgetsBindingObserver {
  PremiumOffer? _offer;
  bool _busy = false;
  String? _error;
  String? _note;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// BRAUZERDAN QAYTGANDA O'ZI TEKSHIRADI.
  ///
  /// To'lov ILOVADAN TASHQARIDA bo'ladi, shuning uchun ilova
  /// to'langanini o'zi bilmaydi. Odamdan "tekshirish" tugmasini
  /// bosishni talab qilish — uni yarim yo'lda qoldirish.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _offer != null) _check();
  }

  /// Buyurtma yaratadi (yoki to'lanmagan eskisini qaytaradi) va
  /// to'lov sahifasini ochadi.
  Future<void> _check() async {
    final offer = _offer;
    if (offer == null || _busy) return;
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });

    final res =
        await ref.read(shopRepositoryProvider).paymentStatus(offer.orderId);
    if (!mounted) return;

    await res.when(
      ok: (j) async {
        final paid = '${j['status'] ?? ''}' == 'paid';
        if (paid) {
          // Sessiya YANGILANADI — `isPremium` shu yerdan keladi va
          // butun ilova (post qo'yish darvozasi ham) shunga qaraydi.
          await ref.read(sessionProvider.notifier).refresh();
          if (!mounted) return;
          setState(() {
            _busy = false;
            _offer = null;
            _note = l.premiumPaid;
          });
        } else {
          setState(() {
            _busy = false;
            _note = l.premiumNotYet;
          });
        }
      },
      err: (e) async => setState(() {
        _busy = false;
        _error = describeError(l, e);
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final user = ref.watch(currentUserProvider);
    final active = user?.premiumActive ?? false;
    final offer = _offer;

    return NovaScaffold(
      title: l.premiumTitle,
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
          Text(active ? l.premiumActive : l.premiumTitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayMedium),
          const SizedBox(height: Gap.sm),
          Text(active ? _validity(l, user!) : l.premiumTagline,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium),

          const SizedBox(height: Gap.section),
          _Perks(),

          // NARX FAQAT SERVERDAN KELGANDA ko'rsatiladi. Buyurtma hali
          // yaratilmagan bo'lsa ilova summani TAXMIN QILMAYDI.
          if (offer != null) ...[
            const SizedBox(height: Gap.section),
            Center(
              child: Capsule(
                label:
                    '${formatMoney(offer.amount, 'UZS')} / ${l.premiumPerMonth}',
                icon: Icons.sell_outlined,
                selected: true,
              ),
            ),
          ],

          if (_note != null) ...[
            const SizedBox(height: Gap.xl),
            Text(_note!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium),
          ],
          if (_error != null) ...[
            const SizedBox(height: Gap.xl),
            Text(_error!,
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: t.error)),
          ],

          const SizedBox(height: Gap.section),

          // PREMIUM ILOVA ICHIDA SOTILMAYDI.
          //
          // Sabab `lib/features/shop/store_policy.dart` da: Google
          // Play raqamli obunani o'z to'lov tizimisiz sotishga ruxsat
          // bermaydi. Obunaning O'ZI va uning imkoniyatlari yuqorida
          // ko'rinib turadi — faqat oxirgi qadam saytda.
          //
          // Saytga BOSILADIGAN havola ham qo'yilmaydi (anti-steering):
          // manzil matn sifatida yoziladi.
          StoreNotice(text: l.storeBuyOnSitePremium),

          // Saytda to'langan bo'lsa — holatni shu yerdan yangilash.
          // Bu xarid emas, tekshiruv; qoidaga daxli yo'q.
          const SizedBox(height: Gap.md),
          NovaButton(
            label: l.premiumCheck,
            tone: ButtonTone.outline,
            busy: _busy,
            onPressed: _busy ? null : _check,
          ),
        ],
      ),
    );
  }

  /// "Qachongacha" qatori.
  ///
  /// Muddat YO'Q bo'lishi "premium emas" degani emas: eski, bir
  /// martalik to'lov qilganlarda `is_premium = 1` va u MUDDATSIZ.
  String _validity(L l, User u) {
    if (u.trialActive && u.premiumUntil == null) return l.premiumTrial;
    final until = u.premiumUntil;
    if (until == null) return l.premiumForever;
    final d = until.toLocal();
    String two(int n) => n.toString().padLeft(2, '0');
    return l.premiumUntil('${two(d.day)}.${two(d.month)}.${d.year}');
  }
}

/// Premium nimani ochishi — SERVERDAGI qoidalar bilan bir xil.
///
/// `FEATURE_MIN_D1 = { post: 'silver', video: 'premium', story: 'gold' }`
/// va `POST_LIMIT_D1[premium] = 60`, `musicLimitD1(true) = 10`.
class _Perks extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final items = <(IconData, String)>[
      (Icons.movie_creation_outlined, l.premiumPerkVideo),
      (Icons.auto_stories_outlined, l.premiumPerkStory),
      (Icons.grid_on_rounded, l.premiumPerkPosts),
      (Icons.music_note_rounded, l.premiumPerkMusic),
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
          // HUQUQIY HUJJATLAR — PLAY TALABI.
          //
          // Google shaxsiy ma'lumot yig'adigan ilovadan maxfiylik
          // siyosatini talab qiladi. Ilgari bu ekranda faqat
          // `nfcstore.uz` matn bo'lib turardi — odam siyosatni
          // qayerdan o'qishini bilmasdi.
          //
          // BU XARID HAVOLASI EMAS. `store_policy.dart` dagi
          // anti-steering qoidasi to'lovga yo'naltirishni
          // cheklaydi; huquqiy hujjatga havola esa aksincha,
          // Google TALAB qiladigan narsa.
          SectionHeader(title: l.settingsAbout),
          _LegalRow(
            icon: Icons.privacy_tip_outlined,
            label: l.legalPrivacy,
            url: 'https://$kSiteHost/maxfiylik',
          ),
          const SizedBox(height: Gap.sm),
          _LegalRow(
            icon: Icons.gavel_rounded,
            label: l.legalTerms,
            url: 'https://$kSiteHost/shartlar',
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

/// Huquqiy hujjat qatori — brauzerda ochiladi.
///
/// `openLink` ishlatiladi: u osilib qolmaydi va brauzer
/// ochilmasa havolani buferga ko'chiradi, ya'ni odam uni
/// baribir o'qiy oladi.
class _LegalRow extends StatelessWidget {
  const _LegalRow({
    required this.icon,
    required this.label,
    required this.url,
  });

  final IconData icon;
  final String label;
  final String url;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return FloatingSurface(
      solid: true,
      onTap: () => openLink(url),
      child: Row(
        children: [
          Icon(icon, size: 19, color: t.accent2),
          const SizedBox(width: Gap.md),
          Expanded(
            child: Text(label, style: Theme.of(context).textTheme.bodyLarge),
          ),
          Icon(Icons.open_in_new_rounded, size: 16, color: t.text3),
        ],
      ),
    );
  }
}
