import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/nfc_service.dart';
import '../core/session.dart';
import '../core/theme.dart';
import 'profile_screen.dart';

class NfcCenterScreen extends StatefulWidget {
  const NfcCenterScreen({super.key});

  @override
  State<NfcCenterScreen> createState() => _NfcCenterScreenState();
}

class _NfcCenterScreenState extends State<NfcCenterScreen>
    with SingleTickerProviderStateMixin {
  final _nfc = const NfcService();
  late final AnimationController _pulse;

  bool? _available;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _check();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _check() async {
    if (_available != null) return;
    final value = await _nfc.available();
    if (mounted) setState(() => _available = value);
  }

  Future<void> _scan() async {
    if (_busy || _available == false) return;

    setState(() {
      _busy = true;
      _message = 'Kartani telefon orqasiga tegizing…';
    });

    final link = await _nfc.read();
    if (!mounted) return;

    setState(() {
      _busy = false;
      _message = link == null
          ? 'NFCSTORE kartasi topilmadi.'
          : 'Topildi · ' + link.code;
    });

    if (link != null && mounted) {
      await SessionScope.read(context).repo.tap(link.code);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ProfileScreen(code: link.code),
        ),
      );
    }
  }

  Future<void> _write() async {
    final active = SessionScope.read(context).activeProfile;
    if (active == null || _busy) return;

    setState(() {
      _busy = true;
      _message = active.code + ' uchun NFC kartani tegizing…';
    });

    final ok = await _nfc.write(active.code);
    if (!mounted) return;

    setState(() {
      _busy = false;
      _message = ok
          ? 'NFC karta muvaffaqiyatli yozildi.'
          : 'Kartaga yozib bo‘lmadi.';
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
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 17, 18, 24),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Text(
                    'NFC\nCenter.',
                    style: Theme.of(context)
                        .textTheme
                        .headlineLarge
                        ?.copyWith(fontSize: 35, height: .93),
                  ),
                ),
                Text(
                  _available == false ? 'OFFLINE NFC' : 'READY / 03',
                  style: TextStyle(
                    color: p.ink2,
                    fontFamily: 'IBMPlexMono',
                    fontSize: 8.8,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _scan,
              child: Container(
                height: 292,
                decoration: BoxDecoration(
                  color: const Color(0xFF0F0F0E),
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: .18),
                      blurRadius: 30,
                      offset: const Offset(0, 15),
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: AnimatedBuilder(
                        animation: _pulse,
                        builder: (context, _) => CustomPaint(
                          painter: _NfcWavePainter(
                            t: _pulse.value,
                            color: p.heroInk,
                            active: _busy,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 21,
                      top: 20,
                      child: Text(
                        _busy ? 'LISTENING' : 'NFC READER',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .46),
                          fontSize: 8.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.65,
                        ),
                      ),
                    ),
                    Positioned(
                      right: 20,
                      top: 19,
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _busy
                              ? p.heroInk
                              : (_available == false
                                  ? const Color(0xFFC95650)
                                  : const Color(0xFF7D9D74)),
                        ),
                      ),
                    ),
                    Center(
                      child: AnimatedScale(
                        duration: const Duration(milliseconds: 220),
                        scale: _busy ? 1.08 : 1,
                        child: Container(
                          width: 98,
                          height: 98,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withValues(alpha: .055),
                            border: Border.all(
                              color: p.heroInk.withValues(alpha: .4),
                            ),
                          ),
                          child: _busy
                              ? Padding(
                                  padding: const EdgeInsets.all(35),
                                  child: CircularProgressIndicator(
                                    strokeWidth: 1.8,
                                    color: p.heroInk,
                                  ),
                                )
                              : ClipOval(
                                  child: Image.asset(
                                    'assets/images/nfcstore_logo_mark.png',
                                    width: 84,
                                    height: 84,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 21,
                      right: 21,
                      bottom: 20,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Tegizing.',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontFamily: 'InstrumentSerif',
                                    fontSize: 28,
                                    height: .95,
                                  ),
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  _message ??
                                      (_available == false
                                          ? 'Bu qurilmada NFC mavjud emas.'
                                          : 'Kartani o‘qish uchun panelni bosing.'),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color:
                                        Colors.white.withValues(alpha: .5),
                                    fontSize: 9.7,
                                    height: 1.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          Icon(
                            Icons.arrow_outward_rounded,
                            color: Colors.white.withValues(alpha: .72),
                            size: 21,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 13),
            Row(
              children: [
                Expanded(
                  child: _NfcActionCard(
                    number: '01',
                    title: 'Kartaga yozish',
                    subtitle: active == null
                        ? 'Faol ID tanlang'
                        : active.code,
                    icon: Icons.edit_note_rounded,
                    onTap: active == null ? null : _write,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _NfcActionCard(
                    number: '02',
                    title: 'Yangi NFC ID',
                    subtitle: 'Narxni ko‘ring',
                    icon: Icons.add_card_rounded,
                    onTap: _openCatalog,
                    dark: true,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 29),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Active identity',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontSize: 17),
                  ),
                ),
                Text(
                  s.profiles.length.toString() + ' ID',
                  style: TextStyle(
                    color: p.ink2,
                    fontFamily: 'IBMPlexMono',
                    fontSize: 9.3,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (s.profiles.isEmpty)
              Container(
                height: 104,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: p.surface,
                  borderRadius: BorderRadius.circular(23),
                  border: Border.all(color: p.line),
                ),
                child: Row(
                  children: [
                    Icon(Icons.badge_outlined, color: p.ink2),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Hozircha NFC ID yo‘q. Yangi hisobga bepul avtomatik ID beriladi.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              )
            else
              SizedBox(
                height: 128,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  itemCount: s.profiles.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 9),
                  itemBuilder: (context, i) {
                    final item = s.profiles[i];
                    final selected = active?.code == item.code;
                    return _IdentitySelector(
                      name: item.name,
                      code: item.code,
                      selected: selected,
                      onTap: () => s.usePersonal(item),
                    );
                  },
                ),
              ),
            const SizedBox(height: 25),
            Container(
              padding: const EdgeInsets.all(17),
              decoration: BoxDecoration(
                color: p.background2.withValues(alpha: .72),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: p.line.withValues(alpha: .8)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.language_rounded,
                    color: p.ink,
                    size: 19,
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Text(
                      'To‘lov ilovada emas. NFC ID va karta xaridi nfcstore.uz saytida yakunlanadi.',
                      style: Theme.of(context)
                          .textTheme
                          .bodyMedium
                          ?.copyWith(fontSize: 10.5),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _openCatalog,
                    child: Icon(
                      Icons.arrow_outward_rounded,
                      color: p.ink,
                      size: 18,
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

class _NfcActionCard extends StatefulWidget {
  const _NfcActionCard({
    required this.number,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.dark = false,
  });

  final String number;
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback? onTap;
  final bool dark;

  @override
  State<_NfcActionCard> createState() => _NfcActionCardState();
}

class _NfcActionCardState extends State<_NfcActionCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final bg = widget.dark ? const Color(0xFF111110) : p.surface;
    final fg = widget.dark ? const Color(0xFFF8F6EF) : p.ink;
    final muted =
        widget.dark ? Colors.white.withValues(alpha: .48) : p.ink2;

    return GestureDetector(
      onTapDown:
          widget.onTap == null ? null : (_) => setState(() => _down = true),
      onTapCancel:
          widget.onTap == null ? null : () => setState(() => _down = false),
      onTapUp:
          widget.onTap == null ? null : (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        duration: const Duration(milliseconds: 110),
        scale: _down ? .97 : 1,
        child: Container(
          height: 144,
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(25),
            border: Border.all(
              color: widget.dark
                  ? Colors.white.withValues(alpha: .08)
                  : p.line,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    widget.number,
                    style: TextStyle(
                      color: muted,
                      fontFamily: 'IBMPlexMono',
                      fontSize: 8.5,
                    ),
                  ),
                  const Spacer(),
                  Icon(widget.icon, color: fg, size: 21),
                ],
              ),
              const Spacer(),
              Text(
                widget.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: fg,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: muted, fontSize: 9.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IdentitySelector extends StatelessWidget {
  const _IdentitySelector({
    required this.name,
    required this.code,
    required this.selected,
    required this.onTap,
  });

  final String name;
  final String code;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final bg = selected ? const Color(0xFF111110) : p.surface;
    final fg = selected ? const Color(0xFFF8F6EF) : p.ink;
    final muted =
        selected ? Colors.white.withValues(alpha: .48) : p.ink2;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 158,
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(23),
          border: Border.all(
            color: selected
                ? p.accent.withValues(alpha: .45)
                : p.line,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.contactless_rounded,
              color: selected ? p.heroInk : fg,
              size: 20,
            ),
            const Spacer(),
            Text(
              code,
              style: TextStyle(
                color: selected ? p.heroInk : fg,
                fontFamily: 'IBMPlexMono',
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: muted,
                fontSize: 9.4,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NfcWavePainter extends CustomPainter {
  const _NfcWavePainter({
    required this.t,
    required this.color,
    required this.active,
  });

  final double t;
  final Color color;
  final bool active;

  @override
  void paint(Canvas canvas, Size size) {
    final origin = Offset(size.width * .5, size.height * .46);
    final phase = active ? t : .35;

    for (var i = 0; i < 4; i++) {
      final progress = (phase + i * .21) % 1;
      final radius = 64 + progress * 110;
      final opacity = active
          ? (1 - progress).clamp(0.0, 1.0) * .13
          : .045;
      final paint = Paint()
        ..color = color.withValues(alpha: opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1;
      canvas.drawCircle(origin, radius, paint);
    }

    final grid = Paint()
      ..color = Colors.white.withValues(alpha: .025)
      ..strokeWidth = .7;
    for (var x = 22.0; x < size.width; x += 30) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x, size.height),
        grid,
      );
    }
    for (var y = 22.0; y < size.height; y += 30) {
      canvas.drawLine(
        Offset(0, y),
        Offset(size.width, y),
        grid,
      );
    }

    final glow = Paint()
      ..color = color.withValues(alpha: active ? .045 : .018)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 35);
    canvas.drawCircle(
      Offset(
        origin.dx + math.sin(t * math.pi * 2) * 9,
        origin.dy + math.cos(t * math.pi * 2) * 9,
      ),
      62,
      glow,
    );
  }

  @override
  bool shouldRepaint(covariant _NfcWavePainter oldDelegate) =>
      oldDelegate.t != t ||
      oldDelegate.color != color ||
      oldDelegate.active != active;
}