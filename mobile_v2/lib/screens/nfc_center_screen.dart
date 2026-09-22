import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/nfc_service.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'profile_screen.dart';

class NfcCenterScreen extends StatefulWidget {
  const NfcCenterScreen({super.key});

  @override
  State<NfcCenterScreen> createState() => _NfcCenterScreenState();
}

class _NfcCenterScreenState extends State<NfcCenterScreen> {
  final _nfc = const NfcService();
  bool? _available;
  bool _busy = false;
  String? _message;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _check();
  }

  Future<void> _check() async {
    if (_available != null) return;
    final value = await _nfc.available();
    if (mounted) setState(() => _available = value);
  }

  Future<void> _scan() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = 'Kartani telefon orqasiga tegizing…';
    });
    final link = await _nfc.read();
    if (!mounted) return;
    setState(() {
      _busy = false;
      _message = link == null ? 'NFCSTORE kartasi topilmadi.' : 'Topildi: ' + link.code;
    });
    if (link != null && mounted) {
      await SessionScope.read(context).repo.tap(link.code);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProfileScreen(code: link.code)),
      );
    }
  }

  Future<void> _write() async {
    final active = SessionScope.read(context).activeProfile;
    if (active == null || _busy) return;

    setState(() {
      _busy = true;
      _message = active.code + ' uchun kartani tegizing…';
    });
    final ok = await _nfc.write(active.code);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _message = ok ? 'NFC karta muvaffaqiyatli yozildi.' : 'Kartaga yozib bo‘lmadi.';
    });
  }

  Future<void> _openCatalog() async {
    await launchUrl(
      Uri.parse('https://nfcstore.uz/katalog'),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final p = context.brand;
    final active = s.activeProfile;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 104),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('NFC markazi', style: Theme.of(context).textTheme.headlineLarge),
                ),
                RoundIcon(icon: Icons.card_giftcard_rounded, onTap: _openCatalog),
                const SizedBox(width: 9),
                RoundIcon(icon: Icons.history_rounded, onTap: () {}),
              ],
            ),
            const SizedBox(height: 4),
            Text('Ulanish — imkoniyat', style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 28),
            Center(
              child: GestureDetector(
                onTap: _available == false ? null : _scan,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  width: 156,
                  height: 156,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: p.hero,
                    border: Border.all(color: p.accent.withValues(alpha: .62), width: 1.4),
                    boxShadow: [
                      BoxShadow(
                        color: p.shadow,
                        blurRadius: 34,
                        offset: const Offset(0, 14),
                      ),
                    ],
                  ),
                  child: Center(
                    child: _busy
                        ? CircularProgressIndicator(strokeWidth: 2, color: p.heroInk)
                        : Icon(Icons.contactless_rounded, color: p.heroInk, size: 68),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 22),
            Center(
              child: Text(
                _available == false
                    ? 'Bu qurilmada NFC mavjud emas'
                    : 'Skanerlash uchun bosing',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: 5),
            Center(
              child: Text(
                _message ?? 'Kartani telefon orqasiga tegizing',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            const SizedBox(height: 28),
            _ActionRow(
              icon: Icons.search_rounded,
              title: 'NFC ID olish',
              body: 'ID qidiring, narxini ko‘ring. To‘lov saytda amalga oshiriladi.',
              onTap: _openCatalog,
            ),
            const SizedBox(height: 10),
            _ActionRow(
              icon: Icons.edit_note_rounded,
              title: 'NFC kartaga yozish',
              body: active == null
                  ? 'Avval faol NFC ID tanlang.'
                  : active.code + ' profilini kartaga yozish',
              onTap: active == null ? null : _write,
            ),
            const SizedBox(height: 10),
            _ActionRow(
              icon: Icons.badge_outlined,
              title: 'Faol NFC ID',
              body: active?.code ?? 'ID tanlanmagan',
              onTap: () {},
            ),
            const SizedBox(height: 28),
            Row(
              children: [
                Expanded(
                  child: Text('NFC ID larim', style: Theme.of(context).textTheme.titleLarge),
                ),
                Text(
                  s.profiles.length.toString() + ' ta',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...s.profiles.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SurfaceCard(
                  shadow: false,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  onTap: () => s.usePersonal(item),
                  child: Row(
                    children: [
                      BrandAvatar(url: item.avatarUrl, size: 38, fallback: item.name),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.name, style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 2),
                            Text(
                              item.code,
                              style: TextStyle(
                                fontFamily: 'IBMPlexMono',
                                color: p.ink2,
                                fontSize: 10.5,
                                letterSpacing: .6,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (active?.code == item.code)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                          decoration: BoxDecoration(
                            color: p.accentSoft,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'Asosiy',
                            style: TextStyle(color: p.ink, fontSize: 9.5, fontWeight: FontWeight.w700),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            SurfaceCard(
              shadow: false,
              child: Row(
                children: [
                  Icon(Icons.info_outline_rounded, color: p.accent),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Ilovada to‘lov qabul qilinmaydi. NFC ID va karta xaridi nfcstore.uz saytida yakunlanadi.',
                      style: Theme.of(context).textTheme.bodyMedium,
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

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.title,
    required this.body,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String body;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return SurfaceCard(
      shadow: false,
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: p.background2,
            ),
            child: Icon(icon, size: 20, color: p.ink),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 3),
                Text(body, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: p.ink2),
        ],
      ),
    );
  }
}
