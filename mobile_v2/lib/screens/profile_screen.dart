import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import '../ui/music_player.dart';
import 'settings_screen.dart';
import 'social_list_screen.dart';
import 'shell.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.code});

  final String? code;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  IdentityProfile? _profile;
  FollowStats _stats = const FollowStats();
  List<PostItem> _posts = const [];
  bool _loading = true;
  Object? _error;
  String _loadedCode = '';

  bool get _own => widget.code == null;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final current =
        widget.code ?? SessionScope.of(context).activeProfile?.code ?? '';
    if (current != _loadedCode) {
      _loadedCode = current;
      _load(current);
    }
  }

  Future<void> _load(String code) async {
    final s = SessionScope.read(context);
    setState(() {
      _loading = true;
      _error = null;
    });

    if (code.isEmpty) {
      setState(() {
        _profile = null;
        _posts = const [];
        _stats = const FollowStats();
        _loading = false;
      });
      return;
    }

    try {
      final results = await Future.wait<dynamic>([
        s.repo.profile(code),
        s.repo.followStats(code),
        s.repo.posts(code),
      ]);
      if (!mounted) return;
      setState(() {
        _profile = results[0] as IdentityProfile;
        _stats = results[1] as FollowStats;
        _posts = results[2] as List<PostItem>;
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

  Future<void> _toggleFollow() async {
    if (_own || _profile == null) return;
    final before = _stats;
    setState(() {
      _stats = FollowStats(
        followers: before.followers + (before.isFollowing ? -1 : 1),
        following: before.following,
        isFollowing: !before.isFollowing,
      );
    });

    try {
      final repo = SessionScope.read(context).repo;
      if (before.isFollowing) {
        await repo.unfollow(_profile!.code);
      } else {
        await repo.follow(_profile!.code);
      }
      final fresh = await repo.followStats(_profile!.code);
      if (mounted) setState(() => _stats = fresh);
    } catch (_) {
      if (mounted) setState(() => _stats = before);
    }
  }

  Future<void> _share() async {
    final p = _profile;
    if (p == null) return;
    await Share.share(
      'https://nfcstore.uz/' + p.code.toLowerCase(),
      subject: p.name,
    );
  }

  Future<void> _qr() async {
    final p = _profile;
    if (p == null) return;
    final palette = context.brand;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: palette.surface,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 6, 24, 30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'QR orqali ulashing',
              style: Theme.of(sheetContext).textTheme.headlineMedium,
            ),
            const SizedBox(height: 7),
            Text(
              p.name,
              style: Theme.of(sheetContext).textTheme.bodyMedium,
            ),
            const SizedBox(height: 19),
            Container(
              padding: const EdgeInsets.all(17),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(26),
              ),
              child: QrImageView(
                data: 'https://nfcstore.uz/' + p.code.toLowerCase(),
                size: 216,
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              p.code,
              style: TextStyle(
                fontFamily: 'IBMPlexMono',
                color: palette.ink,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.brand;

    if (_loading && _profile == null) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(
            strokeWidth: 1.6,
            color: palette.ink,
          ),
        ),
      );
    }

    if (_error != null && _profile == null) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: OutlinedButton(
              onPressed: () => _load(_loadedCode),
              child: const Text('Qayta urinish'),
            ),
          ),
        ),
      );
    }

    final p = _profile;
    if (p == null) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Text(
              'Profil topilmadi.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => _load(p.code),
        color: palette.ink,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            SliverToBoxAdapter(
              child: _ProfileHero(
                profile: p,
                own: _own,
                stats: _stats,
                postCount: _posts.length,
                onBack: _own ? null : () => Navigator.of(context).pop(),
                onShare: _share,
                onQr: _qr,
                onFollowers: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SocialListScreen(
                      code: p.code,
                      following: false,
                      title: 'Obunachilar',
                    ),
                  ),
                ),
                onFollowing: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SocialListScreen(
                      code: p.code,
                      following: true,
                      title: 'Obunalar',
                    ),
                  ),
                ),
                onSettings: _own
                    ? () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const SettingsScreen(),
                          ),
                        )
                    : null,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (p.about.isNotEmpty) ...[
                      Text(
                        'ABOUT',
                        style: TextStyle(
                          color: palette.ink2,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 9),
                      Text(
                        p.about,
                        style: TextStyle(
                          color: palette.ink,
                          fontSize: 13.2,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 22),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 52,
                            child: FilledButton(
                              onPressed: _own
                                  ? () => ShellScope.of(context).selectTab(2)
                                  : _toggleFollow,
                              style: FilledButton.styleFrom(
                                backgroundColor: palette.ink,
                                foregroundColor: palette.background,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(18),
                                ),
                              ),
                              child: Text(
                                _own
                                    ? 'NFC ID boshqaruvi'
                                    : (_stats.isFollowing
                                        ? 'Kuzatilmoqda'
                                        : 'Kuzatish'),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 9),
                        _SquareAction(
                          icon: Icons.qr_code_2_rounded,
                          onTap: _qr,
                        ),
                        const SizedBox(width: 8),
                        _SquareAction(
                          icon: Icons.ios_share_rounded,
                          onTap: _share,
                        ),
                      ],
                    ),
                    if (_own) ...[
                      const SizedBox(height: 29),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'NFC ID collection',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontSize: 17),
                            ),
                          ),
                          Text(
                            SessionScope.of(context).profiles.length.toString() +
                                ' ta',
                            style: TextStyle(
                              color: palette.ink2,
                              fontFamily: 'IBMPlexMono',
                              fontSize: 9.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 13),
                      SizedBox(
                        height: 134,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          physics: const BouncingScrollPhysics(),
                          itemCount:
                              SessionScope.of(context).profiles.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 9),
                          itemBuilder: (context, i) {
                            final item =
                                SessionScope.of(context).profiles[i];
                            return _MiniIdentity(
                              item: item,
                              selected: item.code == p.code,
                              onTap: () {
                                SessionScope.read(context)
                                    .usePersonal(item);
                              },
                            );
                          },
                        ),
                      ),
                    ],
                    const SizedBox(height: 30),
                    Row(
                      children: [
                        Text(
                          'Content',
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontSize: 17),
                        ),
                        const Spacer(),
                        if (_own)
                          TextButton.icon(
                            onPressed: () =>
                                ShellScope.of(context).selectTab(3),
                            icon: const Icon(
                              Icons.play_circle_outline_rounded,
                              size: 17,
                            ),
                            label: const Text('Reels'),
                          ),
                      ],
                    ),
                    const SizedBox(height: 11),
                  ],
                ),
              ),
            ),
            if (_posts.isEmpty)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 30),
                sliver: SliverToBoxAdapter(
                  child: Container(
                    height: 146,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: palette.surface,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: palette.line),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.auto_awesome_outlined,
                          color: palette.ink2,
                          size: 27,
                        ),
                        const SizedBox(height: 9),
                        Text(
                          'Hozircha post yo‘q.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
                sliver: SliverGrid.builder(
                  itemCount: _posts.length,
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 5,
                    mainAxisSpacing: 5,
                    childAspectRatio: .92,
                  ),
                  itemBuilder: (context, i) => _PostTile(
                    post: _posts[i],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.profile,
    required this.own,
    required this.stats,
    required this.postCount,
    required this.onShare,
    required this.onQr,
    required this.onFollowers,
    required this.onFollowing,
    this.onBack,
    this.onSettings,
  });

  final IdentityProfile profile;
  final bool own;
  final FollowStats stats;
  final int postCount;
  final VoidCallback onShare;
  final VoidCallback onQr;
  final VoidCallback onFollowers;
  final VoidCallback onFollowing;
  final VoidCallback? onBack;
  final VoidCallback? onSettings;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      height: 390,
      padding: EdgeInsets.fromLTRB(
        18,
        MediaQuery.paddingOf(context).top + 10,
        18,
        24,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF0F0F0E),
        borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(34),
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -34,
            top: 44,
            child: SizedBox(
              width: 190,
              height: 190,
              child: CustomPaint(
                painter: _ProfileSignal(
                  p.heroInk.withValues(alpha: .13),
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (onBack != null)
                    _HeroAction(
                      icon: Icons.arrow_back_rounded,
                      onTap: onBack!,
                    )
                  else
                    Text(
                      'PROFILE',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: .46),
                        fontSize: 8.5,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.8,
                      ),
                    ),
                  const Spacer(),
                  _HeroAction(
                    icon: Icons.qr_code_2_rounded,
                    onTap: onQr,
                  ),
                  const SizedBox(width: 7),
                  _HeroAction(
                    icon: own
                        ? Icons.settings_outlined
                        : Icons.ios_share_rounded,
                    onTap: own ? onSettings! : onShare,
                  ),
                ],
              ),
              const SizedBox(height: 38),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      BrandAvatar(
                        url: profile.avatarUrl,
                        size: 88,
                        goldRing: true,
                        fallback: profile.name,
                      ),
                      if (profile.musicUrls.isNotEmpty)
                        Positioned(
                          right: -7,
                          bottom: -7,
                          child: GestureDetector(
                            onTap: () => showPremiumMusicPlayer(
                              context,
                              urls: profile.musicUrls,
                              title: profile.name,
                            ),
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: p.heroInk,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: const Color(0xFF0F0F0E),
                                  width: 3,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: .25),
                                    blurRadius: 10,
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.graphic_eq_rounded,
                                color: Colors.black,
                                size: 17,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    profile.code,
                    style: TextStyle(
                      color: p.heroInk,
                      fontFamily: 'IBMPlexMono',
                      fontSize: 19,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 19),
              Text(
                profile.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFFF8F6EF),
                  fontFamily: 'InstrumentSerif',
                  fontSize: 37,
                  height: .93,
                ),
              ),
              if (profile.role.isNotEmpty) ...[
                const SizedBox(height: 9),
                Text(
                  profile.role,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: .58),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const Spacer(),
              Row(
                children: [
                  _HeroStat(
                    value: postCount.toString(),
                    label: 'post',
                  ),
                  const SizedBox(width: 28),
                  _HeroStat(
                    value: stats.followers.toString(),
                    label: 'obunachi',
                    onTap: onFollowers,
                  ),
                  const SizedBox(width: 28),
                  _HeroStat(
                    value: stats.following.toString(),
                    label: 'obuna',
                    onTap: onFollowing,
                  ),
                  const Spacer(),
                  Container(
                    width: 47,
                    height: 47,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: .055),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: .1),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(7),
                      child: Image.asset(
                        'assets/images/nfcstore_logo_mark.png',
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.value,
    required this.label,
    this.onTap,
  });

  final String value;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontFamily: 'IBMPlexMono',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: .42),
                  fontSize: 8.5,
                ),
              ),
            ],
          ),
        ),
      );
}

class _HeroAction extends StatelessWidget {
  const _HeroAction({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: .055),
            border: Border.all(
              color: Colors.white.withValues(alpha: .1),
            ),
          ),
          child: Icon(icon, color: Colors.white, size: 18),
        ),
      );
}

class _SquareAction extends StatelessWidget {
  const _SquareAction({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return InkWell(
      borderRadius: BorderRadius.circular(17),
      onTap: onTap,
      child: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: p.surface,
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: p.line),
        ),
        child: Icon(icon, color: p.ink, size: 20),
      ),
    );
  }
}

class _MiniIdentity extends StatelessWidget {
  const _MiniIdentity({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final IdentityProfile item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final bg = selected ? const Color(0xFF111110) : p.surface;
    final fg = selected ? const Color(0xFFF8F6EF) : p.ink;
    final muted =
        selected ? Colors.white.withValues(alpha: .5) : p.ink2;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 154,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: selected ? p.accent.withValues(alpha: .5) : p.line,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.code,
              style: TextStyle(
                color: selected ? p.heroInk : fg,
                fontFamily: 'IBMPlexMono',
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 1,
              ),
            ),
            const Spacer(),
            Text(
              item.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: fg,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              item.role.isEmpty ? 'NFCSTORE identity' : item.role,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: muted,
                fontSize: 9.2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PostTile extends StatelessWidget {
  const _PostTile({required this.post});
  final PostItem post;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return ClipRRect(
      borderRadius: BorderRadius.circular(13),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (post.imageUrl != null)
            CachedNetworkImage(
              imageUrl: post.imageUrl!,
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => ColoredBox(
                color: p.background2,
                child: Icon(
                  Icons.broken_image_outlined,
                  color: p.ink2,
                ),
              ),
            )
          else
            ColoredBox(
              color: p.background2,
              child: Icon(
                post.videoUrl == null
                    ? Icons.image_outlined
                    : Icons.play_arrow_rounded,
                color: p.ink2,
              ),
            ),
          if (post.videoUrl != null)
            const Positioned(
              top: 8,
              right: 8,
              child: Icon(
                Icons.play_circle_fill_rounded,
                color: Colors.white,
                size: 18,
              ),
            ),
        ],
      ),
    );
  }
}

class _ProfileSignal extends CustomPainter {
  const _ProfileSignal(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final origin = Offset(size.width * .12, size.height * .88);
    for (var i = 0; i < 5; i++) {
      canvas.drawArc(
        Rect.fromCircle(
          center: origin,
          radius: 38 + i * 25,
        ),
        -1.57,
        1.57,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ProfileSignal oldDelegate) =>
      oldDelegate.color != color;
}