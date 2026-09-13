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
        setState(() => _tgError = 'Telegram bot hozir sozlanmagan.');
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
            const TopBar(title: 'Sozlamalar'),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  const Eyebrow('Tasdiqlash'),
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
                              const Text('Akkaunt — email', style: T.cardTitle),
                              const SizedBox(height: 2),
                              Text(
                                email.isEmpty ? '—' : AppUser.mask(email),
                                style: T.meta.copyWith(fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        const StatusChip('Tasdiqlangan', tone: StatusTone.ok),
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
                            const Expanded(
                              child: Text('Profilni tasdiqlash', style: T.cardTitle),
                            ),
                            if (active?.verified == true)
                              const StatusChip('Tasdiqlangan', tone: StatusTone.ok),
                          ],
                        ),
                        const SizedBox(height: 5),
                        const Text(
                          'Telegram bot orqali profilingizni tasdiqlang. Tasdiqlangan '
                          'nishon profilingizda ko‘rinadi.',
                          style: T.caption,
                        ),
                        const SizedBox(height: S.x12),
                        SecondaryButton(
                          'Telegram orqali tasdiqlash',
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
                          'Tasdiqlash holati NFCSTORE serverida saqlanadi',
                          style: T.caption.copyWith(fontSize: 10.5, color: C.muted),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: S.x24),
                  const Eyebrow('Xavfsizlik'),
                  const SizedBox(height: S.x12),
                  _LockCard(available: _bioAvailable),

                  const SizedBox(height: S.x24),
                  const Eyebrow('Akkaunt'),
                  const SizedBox(height: S.x12),
                  _Row(
                    label: 'Buyurtmalarim',
                    icon: Ico.bag,
                    onTap: () => push(context, (_) => const MyOrdersScreen()),
                  ),
                  _Row(label: 'Shaxsiy ma‘lumotlar', icon: Ico.user),
                  _Row(label: 'Bildirishnomalar', icon: Ico.bell, value: 'Yoniq'),
                  _Row(label: 'Til', icon: Ico.globe, value: 'O‘zbekcha'),
                  _Row(label: 'To‘lovlar', icon: Ico.card, value: 'Payme · Click'),

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
                          Text('Chiqish', style: T.cardTitle.copyWith(color: C.signal)),
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

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.icon, this.value, this.onTap});
  final String label;
  final Ico icon;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: S.x8),
        child: Press(
          onTap: onTap,
          child: Surface(
          padding: const EdgeInsets.symmetric(horizontal: S.x16, vertical: S.x12),
          shadow: E.e1,
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
        ),
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
              const NIcon(Ico.lock, size: 20, color: C.champagne),
              const SizedBox(width: S.x12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('PIN kod', style: T.cardTitle),
                    SizedBox(height: 3),
                    Text('Ilova ochilganda kod so‘raladi', style: T.caption),
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
                      const Text('Barmoq izi yoki yuz', style: T.cardTitle),
                      const SizedBox(height: 3),
                      Text(
                        widget.available
                            ? 'Kod o‘rniga tezroq ochish'
                            : 'Qurilmada sozlanmagan',
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
              'Kodni o‘zgartirish',
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
