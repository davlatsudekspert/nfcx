import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  Future<void> _web(String path) async {
    await launchUrl(
      Uri.parse('https://nfcstore.uz/' + path),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final p = context.brand;
    final theme = BrandThemeScope.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('Sozlamalar', style: Theme.of(context).textTheme.headlineMedium),
        backgroundColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 36),
        children: [
          SurfaceCard(
            shadow: false,
            child: Row(
              children: [
                BrandAvatar(
                  url: s.activeProfile?.avatarUrl,
                  size: 48,
                  goldRing: true,
                  fallback: s.activeProfile?.name ?? '',
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.activeProfile?.name ?? s.user?.email ?? 'NFCSTORE',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        s.user?.email ?? '',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 26),
          Text('KO‘RINISH', style: TextStyle(color: p.ink2, fontSize: 10, letterSpacing: 1.4, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _ThemeCard(
                  title: 'Editorial Ivory',
                  subtitle: 'Oq · grafit · champagne',
                  selected: theme.mode == BrandThemeMode.editorial,
                  dark: false,
                  onTap: () => theme.setMode(BrandThemeMode.editorial),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ThemeCard(
                  title: 'Midnight Gold',
                  subtitle: 'To‘q ko‘k · muted gold',
                  selected: theme.mode == BrandThemeMode.midnight,
                  dark: true,
                  onTap: () => theme.setMode(BrandThemeMode.midnight),
                ),
              ),
            ],
          ),
          const SizedBox(height: 26),
          Text('HISOB', style: TextStyle(color: p.ink2, fontSize: 10, letterSpacing: 1.4, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          _Group(
            items: [
              _Item(Icons.person_outline_rounded, 'Profilni tahrirlash', () {}),
              _Item(Icons.storefront_outlined, 'Biznes', () {
                if (s.companies.isNotEmpty) s.setBusinessMode(true);
              }),
              _Item(Icons.badge_outlined, 'NFC ID larim', () {}),
              _Item(Icons.shield_outlined, 'Xavfsizlik', () {}),
            ],
          ),
          const SizedBox(height: 20),
          Text('NFCSTORE', style: TextStyle(color: p.ink2, fontSize: 10, letterSpacing: 1.4, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          _Group(
            items: [
              _Item(Icons.shopping_bag_outlined, 'NFC ID va kartalarni saytda olish', () => _web('katalog')),
              _Item(Icons.help_outline_rounded, 'Yordam', () => _web('aloqa')),
              _Item(Icons.gavel_outlined, 'Kontent qoidalari', () => _web('shartlar')),
              _Item(Icons.privacy_tip_outlined, 'Maxfiylik', () => _web('maxfiylik')),
              _Item(Icons.info_outline_rounded, 'Ilova haqida', () {}),
            ],
          ),
          const SizedBox(height: 18),
          SurfaceCard(
            shadow: false,
            child: Row(
              children: [
                Icon(Icons.info_outline_rounded, color: p.accent),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'V2 ilovada to‘lov qabul qilinmaydi. Xarid va to‘lovlar nfcstore.uz saytida bajariladi.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          OutlinedButton.icon(
            onPressed: () => SessionScope.read(context).signOut(),
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Hisobdan chiqish'),
          ),
        ],
      ),
    );
  }
}

class _ThemeCard extends StatelessWidget {
  const _ThemeCard({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.dark,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final bool dark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 128,
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: dark ? const Color(0xFF07111F) : const Color(0xFFF7F5F0),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? p.accent : p.line,
            width: selected ? 1.6 : 1,
          ),
          boxShadow: [
            BoxShadow(color: p.shadow.withValues(alpha: .5), blurRadius: 16, offset: const Offset(0, 6)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: dark ? const Color(0xFFD0AA5B) : const Color(0xFF171716),
                  ),
                ),
                const Spacer(),
                if (selected)
                  Icon(Icons.check_circle_rounded, size: 19, color: p.accent),
              ],
            ),
            const Spacer(),
            Text(
              title,
              style: TextStyle(
                color: dark ? const Color(0xFFF7F4ED) : const Color(0xFF171716),
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: TextStyle(
                color: dark ? const Color(0xFFA7B0BC) : const Color(0xFF716D66),
                fontSize: 9.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Item {
  const _Item(this.icon, this.label, this.onTap);
  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

class _Group extends StatelessWidget {
  const _Group({required this.items});
  final List<_Item> items;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return SurfaceCard(
      padding: EdgeInsets.zero,
      shadow: false,
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            InkWell(
              onTap: items[i].onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 14),
                child: Row(
                  children: [
                    Icon(items[i].icon, size: 19, color: p.ink),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(items[i].label, style: Theme.of(context).textTheme.bodyLarge),
                    ),
                    Icon(Icons.chevron_right_rounded, color: p.ink2),
                  ],
                ),
              ),
            ),
            if (i != items.length - 1)
              Divider(height: 1, indent: 46, color: p.line),
          ],
        ],
      ),
    );
  }
}
