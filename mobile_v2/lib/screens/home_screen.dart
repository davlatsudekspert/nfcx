import 'package:flutter/material.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'shell.dart';
import 'settings_screen.dart';
import 'compose_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _loading = true;
  FollowStats _stats = const FollowStats();
  List<StoryBubble> _stories = const [];
  Object? _error;
  String _loadedFor = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final code = SessionScope.of(context).activeProfile?.code ?? '';
    if (code != _loadedFor) {
      _loadedFor = code;
      _load();
    }
  }

  Future<void> _load() async {
    final s = SessionScope.read(context);
    final active = s.activeProfile;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      FollowStats stats = const FollowStats();
      List<StoryBubble> stories = const [];
      if (active != null) {
        try {
          stats = await s.repo.followStats(active.code);
        } catch (_) {}
      }
      try {
        stories = await s.repo.storyFeed();
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _stats = stats;
        _stories = stories;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final p = context.brand;
    final active = s.activeProfile;
    final company = s.businessMode && s.companies.isNotEmpty
        ? (s.activeCompany ?? s.companies.first)
        : null;
    final displayName = company?.name ?? active?.name ?? 'Do‘st';
    final firstName = displayName.trim().split(' ').first;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            await s.refresh();
            await _load();
          },
          color: p.accent,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 104),
            children: [
              Row(
                children: [
                  const Wordmark(),
                  const Spacer(),
                  RoundIcon(
                    icon: Icons.notifications_none_rounded,
                    onTap: () {},
                  ),
                  const SizedBox(width: 9),
                  RoundIcon(
                    icon: Icons.settings_outlined,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const SettingsScreen()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _ModeSwitch(
                business: s.businessMode,
                businessEnabled: s.companies.isNotEmpty,
                onChanged: s.setBusinessMode,
              ),
              const SizedBox(height: 24),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Text(
                      'Salom,\n' + firstName + '!',
                      style: Theme.of(context).textTheme.headlineLarge,
                    ),
                  ),
                  BrandAvatar(
                    url: company?.logoUrl ?? active?.avatarUrl,
                    size: 74,
                    goldRing: true,
                    fallback: displayName,
                  ),
                ],
              ),
              const SizedBox(height: 7),
              Text(
                'Sizning raqamli dunyongiz bitta joyda.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 22),
              if (company != null)
                NfcIdentityCard(
                  code: company.id,
                  name: company.name,
                  role: 'Business account',
                  onTap: () => ShellScope.of(context).selectTab(4),
                )
              else if (active != null)
                NfcIdentityCard(
                  code: active.code,
                  name: active.name,
                  role: active.role,
                  onTap: () => ShellScope.of(context).selectTab(2),
                )
              else
                SurfaceCard(
                  child: Text(
                    'Hozircha NFC ID topilmadi.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  ActionTile(
                    icon: Icons.contactless_rounded,
                    label: 'Skanerlash',
                    onTap: () => ShellScope.of(context).selectTab(2),
                  ),
                  ActionTile(
                    icon: Icons.badge_outlined,
                    label: 'NFC ID larim',
                    onTap: () => ShellScope.of(context).selectTab(4),
                  ),
                  ActionTile(
                    icon: Icons.add_box_outlined,
                    label: 'Post qo‘shish',
                    onTap: () async {
                      final done = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(builder: (_) => const ComposeScreen(kind: ComposeKind.post)),
                      );
                      if (done == true && mounted) await _load();
                    },
                  ),
                  ActionTile(
                    icon: Icons.qr_code_2_rounded,
                    label: 'QR kodim',
                    onTap: () => ShellScope.of(context).selectTab(4),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              const SectionHeader(title: 'Stories', action: 'Barchasi'),
              const SizedBox(height: 12),
              SizedBox(
                height: 86,
                child: _loading && _stories.isEmpty
                    ? const Center(child: CircularProgressIndicator(strokeWidth: 1.6))
                    : ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _stories.length + 1,
                        separatorBuilder: (_, __) => const SizedBox(width: 12),
                        itemBuilder: (context, i) {
                          if (i == 0) {
                            return _Story(
                              name: 'Sizning story',
                              avatarUrl: active?.avatarUrl,
                              add: true,
                              onTap: () async {
                                final done = await Navigator.of(context).push<bool>(
                                  MaterialPageRoute(builder: (_) => const ComposeScreen(kind: ComposeKind.story)),
                                );
                                if (done == true && mounted) await _load();
                              },
                            );
                          }
                          final st = _stories[i - 1];
                          return _Story(
                            name: st.name,
                            avatarUrl: st.avatarUrl,
                            onTap: () => ShellScope.of(context).selectTab(3),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 28),
              const SectionHeader(title: 'Identity holati'),
              const SizedBox(height: 12),
              SurfaceCard(
                shadow: false,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    StatBlock(value: (company?.views ?? active?.views ?? 0).toString(), label: 'ko‘rishlar'),
                    Container(width: 1, height: 36, color: p.line),
                    StatBlock(value: (company?.followers ?? _stats.followers).toString(), label: 'obunachilar'),
                    Container(width: 1, height: 36, color: p.line),
                    StatBlock(value: _stats.following.toString(), label: 'obunalar'),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              const SectionHeader(title: 'Tavsiya etilgan'),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _EditorialCard(
                      title: 'NFC bilan yangi imkoniyatlar',
                      icon: Icons.contactless_rounded,
                      onTap: () => ShellScope.of(context).selectTab(2),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _EditorialCard(
                      title: 'Biznesingizni keyingi bosqichga',
                      icon: Icons.storefront_outlined,
                      onTap: () => s.setBusinessMode(true),
                    ),
                  ),
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  'Ayrim ma’lumotlar yangilanmadi. Asosiy profil ishlashda davom etadi.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Story extends StatelessWidget {
  const _Story({
    required this.name,
    this.avatarUrl,
    this.add = false,
    this.onTap,
  });

  final String name;
  final String? avatarUrl;
  final bool add;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 64,
        child: Column(
          children: [
            Stack(
              children: [
                BrandAvatar(url: avatarUrl, size: 54, goldRing: !add, fallback: name),
                if (add)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 19,
                      height: 19,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: p.hero,
                        border: Border.all(color: p.background, width: 2),
                      ),
                      child: Icon(Icons.add_rounded, size: 13, color: p.heroInk),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: p.ink, fontSize: 9.2),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditorialCard extends StatelessWidget {
  const _EditorialCard({
    required this.title,
    required this.icon,
    this.onTap,
  });

  final String title;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(

class _ModeSwitch extends StatelessWidget {
  const _ModeSwitch({
    required this.business,
    required this.businessEnabled,
    required this.onChanged,
  });

  final bool business;
  final bool businessEnabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: p.background2,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: p.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => onChanged(false),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: !business ? p.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: !business
                      ? [BoxShadow(color: p.shadow.withValues(alpha: .45), blurRadius: 8)]
                      : null,
                ),
                child: Text(
                  'Shaxsiy',
                  style: TextStyle(
                    color: p.ink,
                    fontSize: 11.5,
                    fontWeight: !business ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: businessEnabled ? () => onChanged(true) : null,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: business ? p.hero : Colors.transparent,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  businessEnabled ? 'Biznes' : 'Biznes yo‘q',
                  style: TextStyle(
                    color: business ? p.heroInk : p.ink2,
                    fontSize: 11.5,
                    fontWeight: business ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}