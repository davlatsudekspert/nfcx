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