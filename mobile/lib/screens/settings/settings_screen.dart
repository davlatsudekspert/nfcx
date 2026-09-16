import 'package:flutter/material.dart' show showLicensePage;
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter/widgets.dart';

import '../../app.dart';
import '../../app_version.dart';
import '../../data/api_client.dart' show absUrl;
import '../../data/models.dart';
import '../../design/components/backdrop.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/palette_card.dart';
import '../../design/components/toast.dart';
import '../../design/feedback.dart';
import '../../design/components/input.dart';
import '../../design/components/sheet.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/components/top_bar.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../l10n/strings.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../identity/edit_profile.dart';
import '../lock/set_pin_screen.dart';
import '../orders/my_orders.dart';
import 'appearance.dart';
import 'change_password.dart';
import 'payments_history.dart';
import 'premium.dart';
import 'support.dart';

/// SOZLAMALAR — bir xil ritmdagi qatorlar guruhi.
///
/// EKRANNING TARTIBI ODAMNING SAVOLIGA QARAB: "men kimman"
/// (PROFIL) → "hisobim" (HISOB) → "kim ochadi" (XAVFSIZLIK) →
/// "nima to'ladim" (BUYURTMA VA TO'LOV) → "kimga murojaat
/// qilaman" (YORDAM VA HUQUQ). Eng oxirida — buzuvchi amallar,
/// ATAYLAB ajratilgan holda.
///
/// IKKI XIL TASDIQLASH HECH QACHON BIRLASHTIRILMAYDI:
///   HISOB   — email. Ro'yxatdan o'tishda bir marta bajariladi va
///             sarlavha ostida yashirilgan holda ko'rinadi.
///   PROFIL  — mavjud NFCSTORE Telegram boti. Telefon raqamini
///             tasdiqlash va parolni tiklash shu orqali.
///
/// NISHON VA HOLAT SERVERDAN. Bu ekran hech qachon o'zi
/// "tasdiqlangan" deb ko'rsatmaydi — faqat backend aytganini
/// yozadi.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _busyTg = false;
  String? _tgError;
  bool _bioAvailable = false;

  @override
  void initState() {
    super.initState();
    // Qurilmada barmoq izi/yuz sozlanganmi — shunga qarab belgi
    // ko'rsatiladi. Sozlanmagan bo'lsa uni umuman taklif qilmaymiz.
    AppLockScope.read(context).biometricAvailable().then((v) {
      if (mounted) setState(() => _bioAvailable = v);
    });
  }

  Future<void> _startTelegram() async {
    setState(() {
      _busyTg = true;
      _tgError = null;
    });
    try {
      final res = await AppScope.read(context).repo.telegramLinkStart();
      final link = '${res['link'] ?? res['url'] ?? ''}';
      if (link.isEmpty) {
        setState(() => _tgError = tr('Telegram bot hozir sozlanmagan.'));
        return;
      }
      await openExternal(Uri.parse(link));
    } catch (e) {
      if (mounted) setState(() => _tgError = humanError(e));
    } finally {
      if (mounted) setState(() => _busyTg = false);
    }
  }

  /// ILOVA QULFI — PIN va barmoq izi / yuz.
  ///
  /// NIMA UCHUN ALOHIDA OYNADA: sozlamalar ro'yxati bir xil
  /// ritmdagi qatorlardan iborat va uning o'rtasida ikki kalitli
  /// katta karta turmaydi. Qulfning o'z joyi bor va u shu yerda
  /// to'liq ochiladi.
  Future<void> _lockSheet() async {
    final lock = AppLockScope.read(context);
    await showSheet<void>(
      context,
      title: tr('Ilova qulfi'),
      subtitle: tr('Ilova ochilganda kod so‘raladi'),
      child: StatefulBuilder(
        builder: (sheetContext, setSheet) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _LockLine(
              icon: Ico.lock,
              title: tr('PIN kod'),
              subtitle: tr('Ilova ochilganda kod so‘raladi'),
              value: lock.enabled,
              onChanged: (on) async {
                if (on) {
                  await push<bool>(context, (_) => SetPinScreen(lock: lock));
                } else {
                  await lock.disable();
                }
                setSheet(() {});
              },
            ),
            if (lock.enabled) ...[
              const SizedBox(height: S.x16),
              _LockLine(
                icon: Ico.fingerprint,
                title: tr('Barmoq izi yoki yuz'),
                subtitle: _bioAvailable
                    ? tr('Kod o‘rniga tezroq ochish')
                    : tr('Qurilmada sozlanmagan'),
                value: lock.biometricEnabled,
                // Qurilmada sozlanmagan bo'lsa belgi ishlamaydi —
                // yoqib bo'lmaydigan narsani taklif qilmaymiz.
                onChanged: _bioAvailable
                    ? (on) async {
                        await lock.setBiometric(on);
                        setSheet(() {});
                      }
                    : null,
              ),
              const SizedBox(height: S.x20),
              SecondaryButton(
                tr('Kodni o‘zgartirish'),
                size: BtnSize.m,
                onTap: () async {
                  await push<bool>(context, (_) => SetPinScreen(lock: lock));
                  setSheet(() {});
                },
              ),
            ],
          ],
        ),
      ),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final prefs = AppPrefsScope.of(context);
    final lock = AppLockScope.of(context);
    final email = state.user?.email ?? '';
    final active = state.active;

    return ScreenBackdrop(
      aura: Aura.none,
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: TopBar()),
            SliverToBoxAdapter(
              child: ScreenTitle(
                tr('Sozlamalar'),
                // HISOB — EMAIL: ro'yxatdan o'tishda bir marta
                // tasdiqlangan va shu yerda yashirilgan holda
                // ko'rinadi.
                subtitle: email.isEmpty ? null : AppUser.mask(email),
              ),
            ),

            // ── KO'RINISH ─────────────────────────────────────
            //
            // PROTOTIPDA PALITRA AYNAN SHU YERDA, ENG TEPADA va
            // ichida: mavzu — eng ko'p o'zgartiriladigan sozlama
            // va uni alohida sahifaga yashirish odamni ikki
            // bosishga majbur qilardi. Kartalar o'z ranglarida
            // chiziladi, tanlov darhol butun ilovaga tushadi.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x24,
                  S.gutter,
                  0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Eyebrow(tr('Ko‘rinish')),
                    const SizedBox(height: S.x12),
                    Row(
                      children: [
                        for (final p in Palette.all) ...[
                          Expanded(
                            child: PaletteCard(
                              palette: p,
                              selected: p.id == prefs.palette.id,
                              onTap: () {
                                successHaptic();
                                prefs.setPalette(p);
                              },
                            ),
                          ),
                          if (p != Palette.all.last)
                            const SizedBox(width: S.x8),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ── PROFIL ────────────────────────────────────────
            _Group(
              eyebrow: tr('Profil'),
              rows: [
                ListRow(
                  title: tr('Profilni tahrirlash'),
                  leading: NIcon(Ico.user, size: 19, color: C.ink2),
                  onTap: active?.record == null
                      ? null
                      : () => push(
                            context,
                            (_) => EditProfileScreen(record: active!.record!),
                          ),
                ),
                ListRow(
                  title: tr('Ko‘rinish namunasi'),
                  subtitle: prefs.palette.label,
                  leading: NIcon(Ico.palette, size: 19, color: C.ink2),
                  onTap: () => push(context, (_) => const AppearanceScreen()),
                ),
                ListRow(
                  title: tr('Til'),
                  subtitle: prefs.locale.label,
                  leading: NIcon(Ico.language, size: 19, color: C.ink2),
                  onTap: () => push(context, (_) => const AppearanceScreen()),
                ),
              ],
            ),

            // ── HISOB ─────────────────────────────────────────
            _Group(
              eyebrow: tr('Hisob'),
              rows: [
                ListRow(
                  title: tr('Profil Premium'),
                  // NARX JADVALI MIJOZDA YO'Q. Premium summasini
                  // faqat server aytadi (`POST /api/premium/request`
                  // javobidagi `amount`) va u Premium ekranida
                  // ko'rsatiladi.
                  subtitle: state.user?.isPremium == true
                      ? null
                      : tr('Narxni server aytadi'),
                  leading: NIcon(Ico.star, size: 19, color: C.ink2),
                  trailing: state.user?.isPremium == true
                      ? StatusChip(tr('Faol'), tone: StatusTone.ok)
                      : null,
                  onTap: () => push(context, (_) => const PremiumScreen()),
                ),
                ListRow(
                  title: tr('Telefon raqamini tasdiqlash'),
                  subtitle: tr('Ixtiyoriy. Parolni tiklashda kerak bo‘ladi.'),
                  leading: NIcon(Ico.phone, size: 19, color: C.ink2),
                  trailing: StatusChip(tr('Telegram bot')),
                  onTap: _busyTg ? null : _startTelegram,
                ),
                // PROMOKODIM (prototip: "Promokodim · DILSHOD10").
                //
                // Bu KOD EGASINIKI: kimdir shu kod bilan ro'yxatdan
                // o'tsa, EGASIGA 10% chegirma yoziladi. Shuning
                // uchun uni ulashish mumkin bo'lishi kerak — bosilsa
                // nusxalanadi.
                if ((state.user?.promoCode ?? '').isNotEmpty)
                  ListRow(
                    title: tr('Promokodim'),
                    subtitle: state.user!.promoCode,
                    leading: NIcon(Ico.gift, size: 19, color: C.ink2),
                    trailing: (state.user?.discountPct ?? 0) > 0
                        ? StatusChip(
                            '−${state.user!.discountPct}%',
                            tone: StatusTone.ok,
                          )
                        : NIcon(Ico.copy, size: 17, color: C.ink3),
                    onTap: () {
                      Clipboard.setData(
                        ClipboardData(text: state.user!.promoCode),
                      );
                      showToast(context, tr('Nusxalandi'));
                    },
                  ),
                ListRow(
                  title: tr('Parolni o‘zgartirish'),
                  leading: NIcon(Ico.key, size: 19, color: C.ink2),
                  onTap: () =>
                      push(context, (_) => const ChangePasswordScreen()),
                ),
              ],
              note: _tgError,
            ),

            // ── XAVFSIZLIK ────────────────────────────────────
            _Group(
              eyebrow: tr('Xavfsizlik'),
              rows: [
                ListRow(
                  title: tr('PIN · barmoq izi · Face ID'),
                  subtitle: tr('Ilova ochilganda kod so‘raladi'),
                  leading: NIcon(Ico.shield, size: 19, color: C.ink2),
                  // HOLAT FAQAT RANG BILAN EMAS: belgi va matn ham
                  // bor (`StatusChip` shunday qilingan).
                  trailing: StatusChip(
                    lock.enabled ? tr('Yoqilgan') : tr('O‘chiq'),
                    tone: lock.enabled ? StatusTone.ok : StatusTone.neutral,
                  ),
                  onTap: _lockSheet,
                ),
              ],
            ),

            // ── BUYURTMA VA TO'LOV ────────────────────────────
            _Group(
              eyebrow: tr('Buyurtma va to‘lov'),
              rows: [
                ListRow(
                  title: tr('Buyurtmalarim'),
                  leading: NIcon(Ico.bag, size: 19, color: C.ink2),
                  onTap: () => push(context, (_) => const MyOrdersScreen()),
                ),
                ListRow(
                  title: tr('To‘lovlar tarixi'),
                  leading: NIcon(Ico.card, size: 19, color: C.ink2),
                  onTap: () =>
                      push(context, (_) => const PaymentsHistoryScreen()),
                ),
              ],
            ),

            // ── YORDAM VA HUQUQ ───────────────────────────────
            //
            // Google Play ilova ichida maxfiylik siyosatiga havola
            // bo'lishini kutadi. Manzil BITTA MANBADAN: `absUrl`
            // bazasi (`api_client.dart`). Qo'lda yozilsa, domen
            // o'zgarganda havolalar o'lik qolardi.
            _Group(
              eyebrow: tr('Yordam va huquq'),
              rows: [
                ListRow(
                  title: tr('Maxfiylik siyosati · Oferta'),
                  leading: NIcon(Ico.shield, size: 19, color: C.ink2),
                  onTap: () => openExternal(Uri.parse(absUrl('/maxfiylik')!)),
                ),
                ListRow(
                  title: tr('Foydalanish shartlari'),
                  leading: NIcon(Ico.doc, size: 19, color: C.ink2),
                  onTap: () => openExternal(Uri.parse(absUrl('/shartlar')!)),
                ),
                ListRow(
                  title: tr('Litsenziyalar'),
                  leading: NIcon(Ico.info, size: 19, color: C.ink2),
                  onTap: () => showLicensePage(
                    context: context,
                    applicationName: 'NFCSTORE',
                    applicationVersion: appVersion,
                  ),
                ),
                ListRow(
                  title: tr('Bog‘lanish · Telegram bot, admin'),
                  leading: NIcon(Ico.telegram, size: 19, color: C.ink2),
                  onTap: () => push(context, (_) => const SupportScreen()),
                ),
              ],
            ),

            // ── BUZUVCHI AMALLAR ──────────────────────────────
            //
            // "Chiqish" dan ham YUQORIDA emas, quyida va alohida
            // guruhda: ikkalasi yonma-yon bir xil tursa, chiqmoqchi
            // bo'lgan odam xato bosishi mumkin.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x32,
                  S.gutter,
                  0,
                ),
                child: RowGroup(
                  children: [
                    ListRow(
                      title: tr('Hisobni o‘chirish'),
                      danger: true,
                      leading: NIcon(Ico.trash, size: 19, color: C.fail),
                      onTap: () => _deleteAccount(context, state),
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x16,
                  S.gutter,
                  0,
                ),
                child: GhostButton(
                  tr('Chiqish'),
                  icon: Ico.logout,
                  expand: true,
                  color: C.ink2,
                  onTap: () async {
                    await state.signOut();
                    if (context.mounted) Navigator.of(context).maybePop();
                  },
                ),
              ),
            ),

            // VERSIYA. Qurilmada sinashda "bu o'zgarish ko'rinmayapti"
            // deyilganda birinchi savol — ilovaning qaysi build'i
            // o'rnatilgan.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  S.gutter,
                  S.x24,
                  S.gutter,
                  S.x32,
                ),
                child: Center(
                  child: Text(
                    'NFCSTORE $appVersion',
                    style: T.meta.copyWith(color: C.ink3),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bo'lim — eyebrow va bitta yuzadagi qatorlar.
class _Group extends StatelessWidget {
  const _Group({required this.eyebrow, required this.rows, this.note});

  final String eyebrow;
  final List<Widget> rows;

  /// Guruh ostidagi xato yoki izoh (Telegram ulash xatosi).
  final String? note;

  @override
  Widget build(BuildContext context) => SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(S.gutter, S.x24, S.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Eyebrow(eyebrow),
              const SizedBox(height: S.x12),
              RowGroup(children: rows),
              if ((note ?? '').isNotEmpty) ...[
                const SizedBox(height: S.x8),
                Text(note!, style: T.caption.copyWith(color: C.fail)),
              ],
            ],
          ),
        ),
      );
}

/// Qulf oynasidagi bitta kalit.
class _LockLine extends StatelessWidget {
  const _LockLine({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final Ico icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          NIcon(
            icon,
            size: 20,
            color: onChanged == null ? C.ink3 : C.accent,
          ),
          const SizedBox(width: S.x12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: T.cardTitle),
                const SizedBox(height: 3),
                Text(subtitle, style: T.caption.copyWith(color: C.ink3)),
              ],
            ),
          ),
          const SizedBox(width: S.x12),
          Toggle(value: value, onChanged: onChanged),
        ],
      );
}

/// HISOBNI O'CHIRISH — IKKI QADAM.
///
/// NIMA UCHUN BOR: Google Play "User Data" siyosati hisob yaratishga
/// ruxsat beradigan ilovadan hisobni O'CHIRISH YO'LINI ILOVA ICHIDA
/// talab qiladi.
///
/// NIMA UCHUN IKKI QADAM: birinchi varaqda NIMA KETISHI ro'yxat
/// bilan ko'rsatiladi, ikkinchisida esa odam so'zni QO'LDA yozadi.
/// Bitta tugma bilan o'chiriladigan hisob — tasodifiy bosishdan
/// himoyasiz.
Future<void> _deleteAccount(BuildContext context, AppState state) async {
  // ID'LAR RO'YXATI — nima ketayotganini aniq ko'rsatadi. Odam
  // o'zining qaysi kodlari yo'qolishini varaqda ko'radi.
  final codes = [
    ...state.cards.map((c) => c.code),
    ...state.companies.map((c) => c.id),
  ].where((c) => c.isNotEmpty).join(' · ');

  final go = await showSheet<bool>(
    context,
    title: tr('Hisobni o‘chirish'),
    subtitle: tr('Bu amalni ilovadan qaytarib bo‘lmaydi.'),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(tr('Nimalar yo‘qoladi'), style: T.cardTitle),
        const SizedBox(height: S.x12),
        _Loss(tr('Ochiq profil va uning havolasi')),
        _Loss(tr('Story, postlar va Reels')),
        _Loss(tr('Obunachilar va statistika')),
        if (codes.isNotEmpty)
          _Loss(tr('Mening ID‘larim'), value: codes)
        else
          _Loss(tr('Mening ID‘larim')),
        const SizedBox(height: S.x24),
        PrimaryButton(
          tr('Davom etish'),
          onTap: () => Navigator.of(context).pop(true),
        ),
        const SizedBox(height: S.x8),
        GhostButton(
          tr('Bekor qilish'),
          expand: true,
          color: C.ink2,
          onTap: () => Navigator.of(context).pop(false),
        ),
      ],
    ),
  );
  if (go != true || !context.mounted) return;

  final word = tr('O‘CHIRISH');
  final typed = TextEditingController();
  var agreed = false;

  final confirmed = await showSheet<bool>(
    context,
    title: tr('Tasdiqlash uchun yozing'),
    child: StatefulBuilder(
      builder: (sheetContext, setSheet) {
        final ready = typed.text.trim().toUpperCase() == word && agreed;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr('Quyidagi maydonga O‘CHIRISH so‘zini kiriting.'),
              style: T.body,
            ),
            const SizedBox(height: S.x16),
            Field(
              label: tr('Tasdiq so‘zi'),
              controller: typed,
              hint: word,
              keyboardType: TextInputType.text,
              onChanged: (_) => setSheet(() {}),
            ),
            const SizedBox(height: S.x8),
            CheckBox(
              value: agreed,
              label: tr('Tushundim: hisobim va ID‘larim o‘chiriladi'),
              onChanged: (v) => setSheet(() => agreed = v),
            ),
            const SizedBox(height: S.x16),
            DangerButton(
              tr('Hisobni o‘chirish'),
              filled: true,
              onTap: ready
                  ? () => Navigator.of(sheetContext).pop(true)
                  : null,
            ),
            const SizedBox(height: S.x8),
            GhostButton(
              tr('Bekor qilish'),
              expand: true,
              color: C.ink2,
              onTap: () => Navigator.of(sheetContext).pop(false),
            ),
          ],
        );
      },
    ),
  );
  typed.dispose();
  if (confirmed != true || !context.mounted) return;

  try {
    await state.repo.deleteAccount();
    await state.signOut();
    if (context.mounted) Navigator.of(context).maybePop();
  } catch (e) {
    if (context.mounted) await showError(context, humanError(e));
  }
}

/// O'chirishda yo'qoladigan bitta narsa.
class _Loss extends StatelessWidget {
  const _Loss(this.label, {this.value});
  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: S.x12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NIcon(Ico.close, size: 15, color: C.fail),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: T.bodyStrong.copyWith(fontSize: 14)),
                  if ((value ?? '').isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(value!, style: T.code(12.5, color: C.ink2)),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}
