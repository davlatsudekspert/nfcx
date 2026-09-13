import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../common/contact_actions.dart';
import '../../app.dart';
import '../common/top_bar.dart';
import '../lock/set_pin_screen.dart';
import '../orders/my_orders.dart';
import '../identity/edit_profile.dart';
import 'change_password.dart';
import '../../l10n/strings.dart';
import 'appearance.dart';

/// SOZLAMALAR — va IKKI XIL TASDIQLASH.
///
/// Ular hech qachon birlashtirilmaydi:
///   HISOB   — email. Ro'yxatdan o'tishda bir marta bajariladi.
///   PROFIL  — mavjud NFCSTORE Telegram boti. Tasdiqlangan nishonni
///             shu beradi.
///
/// NISHON HOLATI SERVERDAN. Bu ekran uni hech qachon o'zi
/// "tasdiqlangan" deb ko'rsatmaydi — faqat backend aytganini yozadi.
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

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final email = state.user?.email ?? '';
    final active = state.active;

    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            TopBar(title: tr('Sozlamalar')),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  Eyebrow(tr('Tasdiqlash')),
                  const SizedBox(height: S.x12),

                  // 1) HISOB — EMAIL. Ro'yxatdan o'tishda bajarilgan.
                  Surface(
                    child: Row(
                      children: [
                        const NIcon(Ico.check, size: 20, color: C.verdant),
                        const SizedBox(width: S.x12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(tr('Akkaunt — email'), style: T.cardTitle),
                              const SizedBox(height: 2),
                              Text(
                                email.isEmpty ? '—' : AppUser.mask(email),
                                style: T.meta.copyWith(fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        StatusChip(tr('Tasdiqlangan'), tone: StatusTone.ok),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x12),

                  // 2) PROFIL — TELEGRAM BOT. Bu boshqa narsa.
                  Surface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(tr('Profilni tasdiqlash'), style: T.cardTitle),
                            ),
                            if (active?.verified == true)
                              StatusChip(tr('Tasdiqlangan'), tone: StatusTone.ok),
                          ],
                        ),
                        const SizedBox(height: 5),
                        Text(
                          tr('Telegram bot orqali profilingizni tasdiqlang. Tasdiqlangan ') +
                          tr('nishon profilingizda ko‘rinadi.'),
                          style: T.caption,
                        ),
                        const SizedBox(height: S.x12),
                        SecondaryButton(
                          tr('Telegram orqali tasdiqlash'),
                          height: 46,
                          icon: const NIcon(Ico.telegram, size: 17, color: C.telegram),
                          onTap: _busyTg ? null : _startTelegram,
                        ),
                        if (_tgError != null) ...[
                          const SizedBox(height: S.x8),
                          Text(_tgError!, style: T.caption.copyWith(color: C.signal)),
                        ],
                        const SizedBox(height: S.x8),
                        Text(
                          tr('Tasdiqlash holati NFCSTORE serverida saqlanadi'),
                          style: T.caption.copyWith(fontSize: 10.5, color: C.muted),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Xavfsizlik')),
                  const SizedBox(height: S.x12),
                  _LockCard(available: _bioAvailable),

                  const SizedBox(height: S.x24),
                  Eyebrow(tr('Akkaunt')),
                  const SizedBox(height: S.x12),
                  _Group([
                  _Row(
                    label: tr('Buyurtmalarim'),
                    icon: Ico.bag,
                    onTap: () => push(context, (_) => const MyOrdersScreen()),
                  ),
                  // "Shaxsiy ma'lumotlar" ilgari BOSILMAYDIGAN qator
                  // edi — ko'rinishi tugma, xulqi esa yo'q. Endi u
                  // faol shaxsning tahrirlash ekranini ochadi.
                  _Row(
                    label: tr('Shaxsiy ma‘lumotlar'),
                    icon: Ico.user,
                    onTap: state.active?.record == null
                        ? null
                        : () => push(
                              context,
                              (_) => EditProfileScreen(record: state.active!.record!),
                            ),
                  ),
                  _Row(
                    label: tr('Parolni o‘zgartirish'),
                    icon: Ico.lock,
                    onTap: () => push(context, (_) => const ChangePasswordScreen()),
                  ),
                  // BILDIRISHNOMALAR QATORI OLIB TASHLANDI: u "Yoniq"
                  // deb yozib turardi, lekin ilovada push bildirishnoma
                  // umuman yo'q. Mavjud bo'lmagan imkoniyatni va'da
                  // qilishdan ko'ra, uni ko'rsatmagan ma'qul.
                  // KO'RINISH — mavzu va til bitta ekranda: ikkalasi
                  // ham "ilova qanday ko'rinadi" degan savolga
                  // tegishli va ikkalasi ham darhol qo'llanadi.
                  _Row(
                    label: tr('Ko‘rinish'),
                    icon: Ico.globe,
                    value: AppPrefsScope.of(context).locale.label,
                    onTap: () => push(context, (_) => const AppearanceScreen()),
                  ),
                  _Row(label: tr('To‘lovlar'), icon: Ico.card, value: tr('Payme · Click'), last: true),
                  ]),

                  const SizedBox(height: S.x24),
                  Press(
                    haptic: true,
                    onTap: () async {
                      await state.signOut();
                      if (context.mounted) Navigator.of(context).maybePop();
                    },
                    child: Surface(
                      shadow: E.e1,
                      child: Row(
                        children: [
                          const NIcon(Ico.logout, size: 19, color: C.signal),
                          const SizedBox(width: S.x12),
                          Text(tr('Chiqish'), style: T.cardTitle.copyWith(color: C.signal)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// SOZLAMALAR QATORI — KARTA EMAS, RO'YXAT.
///
/// NIMA UCHUN QAYTA YOZILDI: har qator alohida soya bilan karta
/// edi va ekran o'nta suzuvchi to'rtburchakka aylanardi. Sozlamalar
/// esa boshqa ekranlar kabi "boy" bo'lmasligi kerak — u eng toza
/// va eng sokin bo'lim. Endi qatorlar BITTA yuzada, orasida
/// ingichka chiziq bilan: tizim sozlamalari qanday ko'rinsa,
/// shunday.
class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    required this.icon,
    this.value,
    this.onTap,
    this.last = false,
  });

  final String label;
  final Ico icon;
  final String? value;
  final VoidCallback? onTap;

  /// Guruhdagi oxirgi qator — ostiga chiziq chizilmaydi.
  final bool last;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x12),
          decoration: BoxDecoration(
            border: last
                ? null
                : Border(bottom: BorderSide(color: C.hairline)),
          ),
          child: Row(
            children: [
              NIcon(icon, size: 19, color: C.ash),
              const SizedBox(width: S.x12),
              Expanded(child: Text(label, style: T.cardTitle.copyWith(fontSize: 13.5))),
              if (value != null) ...[
                Text(value!, style: T.caption.copyWith(fontSize: 11.5)),
                if (onTap != null) const SizedBox(width: S.x8),
              ],
              // Strelka FAQAT bosiladigan qatorda. Aks holda odam
              // bosadi va hech narsa bo'lmaydi — bu ishonchni
              // yo'qotadi.
              if (onTap != null) const NIcon(Ico.chevronRight, size: 17, color: C.ash),
            ],
          ),
        ),
      );
}

/// Qatorlar guruhi — bitta yuza.
class _Group extends StatelessWidget {
  const _Group(this.rows);
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) => Surface(
        padding: EdgeInsets.zero,
        shadow: E.e1,
        child: Column(children: rows),
      );
}

/// ILOVA QULFI — PIN va barmoq izi / yuz.
///
/// NIMA UCHUN KERAK: hisobda odamning shaxsiy kontaktlari, biznesi va
/// to'lov tarixi turadi. Telefon birov qo'liga tushsa, ilova ochiq
/// qolgan bo'lsa — hammasi ochiq.
class _LockCard extends StatefulWidget {
  const _LockCard({required this.available});

  /// Qurilmada barmoq izi/yuz sozlanganmi.
  final bool available;

  @override
  State<_LockCard> createState() => _LockCardState();
}

class _LockCardState extends State<_LockCard> {
  @override
  Widget build(BuildContext context) {
    final lock = AppLockScope.of(context);

    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              NIcon(Ico.lock, size: 20, color: C.champagne),
              const SizedBox(width: S.x12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr('PIN kod'), style: T.cardTitle),
                    SizedBox(height: 3),
                    Text(tr('Ilova ochilganda kod so‘raladi'), style: T.caption),
                  ],
                ),
              ),
              _Switch(
                value: lock.enabled,
                onChanged: (on) async {
                  if (on) {
                    await push<bool>(context, (_) => SetPinScreen(lock: lock));
                  } else {
                    await lock.disable();
                  }
                  if (mounted) setState(() {});
                },
              ),
            ],
          ),
          if (lock.enabled) ...[
            const SizedBox(height: S.x12),
            Container(height: 1, color: C.hairline),
            const SizedBox(height: S.x12),
            Row(
              children: [
                NIcon(Ico.fingerprint, size: 20,
                    color: widget.available ? C.champagne : C.muted),
                const SizedBox(width: S.x12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(tr('Barmoq izi yoki yuz'), style: T.cardTitle),
                      const SizedBox(height: 3),
                      Text(
                        widget.available
                            ? tr('Kod o‘rniga tezroq ochish')
                            : tr('Qurilmada sozlanmagan'),
                        style: T.caption,
                      ),
                    ],
                  ),
                ),
                _Switch(
                  value: lock.biometricEnabled,
                  // Qurilmada sozlanmagan bo'lsa belgi ishlamaydi —
                  // yoqib bo'lmaydigan narsani taklif qilmaymiz.
                  onChanged: widget.available
                      ? (on) async {
                          await lock.setBiometric(on);
                          if (mounted) setState(() {});
                        }
                      : null,
                ),
              ],
            ),
            const SizedBox(height: S.x12),
            SecondaryButton(
              tr('Kodni o‘zgartirish'),
              height: 44,
              onTap: () async {
                await push<bool>(context, (_) => SetPinScreen(lock: lock));
                if (mounted) setState(() {});
              },
            ),
          ],
        ],
      ),
    );
  }
}

/// Yoqish/o'chirish belgisi.
///
/// Material'ning `Switch` i o'z rang sxemasini oladi va bu dizaynda
/// begona ko'rinadi — shuning uchun o'zimizniki.
class _Switch extends StatelessWidget {
  const _Switch({required this.value, this.onChanged});

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => Press(
        onTap: onChanged == null ? null : () => onChanged!(!value),
        scale: .94,
        child: Opacity(
          opacity: onChanged == null ? .45 : 1,
          child: AnimatedContainer(
            duration: M.fade,
            curve: M.curve,
            width: 46,
            height: 27,
            padding: const EdgeInsets.all(3),
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            decoration: BoxDecoration(
              color: value ? C.champagne : C.graphite,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: value ? C.champagne : C.hairline),
            ),
            child: Container(
              width: 21,
              height: 21,
              decoration: BoxDecoration(
                color: value ? C.ink : C.muted,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      );
}
