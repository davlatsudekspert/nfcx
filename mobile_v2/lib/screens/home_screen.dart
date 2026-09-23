import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'compose_screen.dart';
import 'settings_screen.dart';
import 'notifications_screen.dart';
import 'shell.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _motion;
  late final PageController _identityPages;

  List<StoryBubble> _stories = const [];
  List<FeedItem> _feed = const [];
  FollowStats _stats = const FollowStats();
  bool _loading = true;
  int _identityIndex = 0;
  String _loadedFor = '';

  @override
  void initState() {
    super.initState();
    _motion = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 9),
    )..repeat();
    _identityPages = PageController(viewportFraction: .9);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final code = SessionScope.of(context).activeProfile?.code ?? '';
    if (_loadedFor != code) {
      _loadedFor = code;
      _load();
    }
  }

  @override
  void dispose() {
    _motion.dispose();
    _identityPages.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final s = SessionScope.read(context);
    final active = s.activeProfile;

    setState(() => _loading = true);

    FollowStats stats = const FollowStats();
    List<StoryBubble> stories = const [];
    List<FeedItem> feed = const [];

    if (active != null) {
      try {
        stats = await s.repo.followStats(active.code);
      } catch (_) {}
    }
    try {
      stories = await s.repo.storyFeed();
    } catch (_) {}
    try {
      final r = await s.repo.feed(page: 1);
      feed = r.items.where((e) => !e.isStory).take(5).toList();
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _stats = stats;
      _stories = stories;
      _feed = feed;
      _loading = false;
    });
  }

  List<_ShowcaseIdentity> _identities(AppSession s) {
    final personal = s.activeProfile;
    final result = <_ShowcaseIdentity>[
      _ShowcaseIdentity(
        kind: 'PERSONAL',
        code: personal?.code.isNotEmpty == true ? personal!.code : 'VIP001',
        name: personal?.name.isNotEmpty == true ? personal!.name : 'Muhammad',
        role: personal?.role.isNotEmpty == true
            ? personal!.role
            : 'Digital Identity',
        subtitle: personal?.about.isNotEmpty == true
            ? personal!.about
            : 'Bitta profil. Barcha havolalar. Bir tegishda.',
        statA: (personal?.views ?? 1248).toString(),
        statALabel: 'ko‘rish',
        statB: personal != null ? _stats.followers.toString() : '193',
        statBLabel: 'obunachi',
        avatarUrl: personal?.avatarUrl,
        dark: true,
        live: personal != null,
      ),
    ];

    for (var i = 0; i < 2; i++) {
      final real = i < s.companies.length ? s.companies[i] : null;
      result.add(
        _ShowcaseIdentity(
          kind: 'BUSINESS',
          code: real?.id.isNotEmpty == true
              ? real!.id
              : (i == 0 ? 'NOIR01' : 'LUMEN7'),
          name: real?.name.isNotEmpty == true
              ? real!.name
              : (i == 0 ? 'NOIR Coffee' : 'Lumen Studio'),
          role: real?.city.isNotEmpty == true
              ? real!.city
              : (i == 0 ? 'Coffee · Tashkent' : 'Creative · Andijan'),
          subtitle: real?.about.isNotEmpty == true
              ? real!.about
              : (i == 0
                  ? 'Specialty coffee, sokin atmosfera va raqamli menyu.'
                  : 'Brand, product va digital tajribalar uchun creative studio.'),
          statA: (real?.views ?? (i == 0 ? 8420 : 3160)).toString(),
          statALabel: 'ko‘rish',
          statB: (real?.followers ?? (i == 0 ? 1240 : 486)).toString(),
          statBLabel: 'obunachi',
          avatarUrl: real?.logoUrl,
          dark: i == 1,
          live: real != null,
        ),
      );
    }
    return result;
  }

  Future<void> _toggleFeedLike(int index) async {
    if (index < 0 || index >= _feed.length) return;
    final before = _feed[index];
    if (!before.likeable) return;
    setState(() {
      _feed = [..._feed]
        ..[index] = before.copyWith(
          liked: !before.liked,
          likeCount: (before.likeCount + (before.liked ? -1 : 1))
              .clamp(0, 1 << 30),
        );
    });
    try {
      final r = await SessionScope.read(context)
          .repo
          .likeContent(before.targetKind, before.id);
      if (!mounted || index >= _feed.length) return;
      setState(() {
        _feed = [..._feed]
          ..[index] = _feed[index].copyWith(
            liked: r.liked,
            likeCount: r.count,
          );
      });
    } catch (_) {
      if (mounted && index < _feed.length) {
        setState(() => _feed = [..._feed]..[index] = before);
      }
    }
  }

  Future<void> _shareFeed(FeedItem item) async {
    await Share.share(
      'https://nfcstore.uz/' + item.code.toLowerCase(),
      subject: item.name,
    );
  }

  Future<void> _compose(ComposeKind kind) async {
    final done = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => ComposeScreen(kind: kind)),
    );
    if (done == true && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = SessionScope.of(context);
    final p = context.brand;
    final identities = _identities(s);
    final active = s.activeProfile;

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: RepaintBoundary(
                child: AnimatedBuilder(
                  animation: _motion,
                  builder: (context, _) => CustomPaint(
                    painter: _AmbientPainter(
                      progress: _motion.value,
                      ink: p.ink,
                      accent: p.accent,
                      background: p.background,
                    ),
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              color: p.ink,
              onRefresh: () async {
                await s.refresh();
                await _load();
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Wordmark(
                          compact: MediaQuery.sizeOf(context).width < 390,
                        ),
                      ),
                      const SizedBox(width: 8),
                      _TopAction(
                        icon: Icons.notifications_none_rounded,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const NotificationsScreen(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _TopAction(
                        icon: Icons.settings_outlined,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const SettingsScreen(),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Text(
                          'Your identity,\nin motion.',
                          style: Theme.of(context)
                              .textTheme
                              .displaySmall
                              ?.copyWith(fontSize: 41, height: .94),
                        ),
                      ),
                      Text(
                        '01 / 03',
                        style: TextStyle(
                          color: p.ink2,
                          fontFamily: 'IBMPlexMono',
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 9),
                  Text(
                    'Shaxsiy hayot, biznes va NFC — bitta sokin premium makonda.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    height: 286,
                    child: PageView.builder(
                      controller: _identityPages,
                      clipBehavior: Clip.none,
                      itemCount: identities.length,
                      onPageChanged: (value) =>
                          setState(() => _identityIndex = value),
                      itemBuilder: (context, index) {
                        final item = identities[index];
                        return AnimatedBuilder(
                          animation: _identityPages,
                          builder: (context, child) {
                            var page = _identityPages.hasClients
                                ? (_identityPages.page ??
                                    _identityPages.initialPage.toDouble())
                                : _identityPages.initialPage.toDouble();
                            final delta = (page - index).abs().clamp(0.0, 1.0);
                            final scale = 1 - delta * .055;
                            final y = delta * 9;
                            return Transform.translate(
                              offset: Offset(0, y),
                              child: Transform.scale(
                                scale: scale,
                                alignment: Alignment.center,
                                child: child,
                              ),
                            );
                          },
                          child: Padding(
                            padding: const EdgeInsets.only(right: 10),
                            child: _IdentityCard(
                              data: item,
                              onTap: () {
                                if (index == 0 && item.live) {
                                  ShellScope.of(context).selectTab(4);
                                } else if (index > 0 && item.live) {
                                  s.setBusinessMode(true);
                                  ShellScope.of(context).selectTab(4);
                                }
                              },
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      for (var i = 0; i < identities.length; i++)
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          curve: Curves.easeOutCubic,
                          margin: const EdgeInsets.only(right: 6),
                          width: i == _identityIndex ? 24 : 6,
                          height: 5,
                          decoration: BoxDecoration(
                            color: i == _identityIndex ? p.ink : p.line,
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                      const Spacer(),
                      Text(
                        identities[_identityIndex].live ? 'LIVE' : 'DEMO',
                        style: TextStyle(
                          color: p.ink2,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 30),
                  Row(
                    children: [
                      Expanded(
                        child: _LiveAction(
                          icon: Icons.contactless_rounded,
                          title: 'Scan',
                          subtitle: 'NFC ochish',
                          onTap: () => ShellScope.of(context).selectTab(2),
                        ),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: _LiveAction(
                          icon: Icons.add_rounded,
                          title: 'Create',
                          subtitle: 'Post / Story',
                          onTap: () => _compose(ComposeKind.post),
                        ),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: _LiveAction(
                          icon: Icons.qr_code_2_rounded,
                          title: 'QR',
                          subtitle: 'Ulashish',
                          onTap: () => ShellScope.of(context).selectTab(4),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 31),
                  SectionHeader(
                    title: 'Stories',
                    action: _loading ? '...' : 'Jonli',
                    onAction: () => ShellScope.of(context).selectTab(3),
                  ),
                  const SizedBox(height: 13),
                  SizedBox(
                    height: 96,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      physics: const BouncingScrollPhysics(),
                      itemCount: math.max(6, _stories.length + 1),
                      separatorBuilder: (_, __) => const SizedBox(width: 11),
                      itemBuilder: (context, index) {
                        if (index == 0) {
                          return _StoryOrb(
                            title: 'Siz',
                            avatarUrl: active?.avatarUrl,
                            add: true,
                            onTap: () => _compose(ComposeKind.story),
                          );
                        }
                        if (index - 1 < _stories.length) {
                          final item = _stories[index - 1];
                          return _StoryOrb(
                            title: item.name,
                            avatarUrl: item.avatarUrl,
                            onTap: () =>
                                ShellScope.of(context).selectTab(3),
                          );
                        }
                        const demo = [
                          ('Ali', 'A'),
                          ('One Brand', 'O'),
                          ('Mashrab', 'M'),
                          ('Studio', 'S'),
                          ('Coffee', 'C'),
                        ];
                        final d = demo[(index - 1) % demo.length];
                        return _StoryOrb(
                          title: d.$1,
                          letter: d.$2,
                          onTap: () => ShellScope.of(context).selectTab(3),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 30),
                  SectionHeader(
                    title: 'Lenta',
                    action: _feed.isEmpty ? 'Reels' : 'Barchasi',
                    onAction: () => ShellScope.of(context).selectTab(3),
                  ),
                  const SizedBox(height: 13),
                  if (_feed.isEmpty)
                    _EditorialFeature(
                      number: 'LIVE',
                      eyebrow: 'COMMUNITY',
                      title: 'Kontent shu yerda\njonlanadi.',
                      body:
                          'Post, story va Reels joylang. Siz kuzatadigan va yangi profillar kontenti shu oqimda ko‘rinadi.',
                      icon: Icons.auto_awesome_rounded,
                      dark: false,
                      onTap: () => ShellScope.of(context).selectTab(3),
                    )
                  else
                    ...[
                      for (var i = 0; i < _feed.length; i++) ...[
                        _HomeFeedCard(
                          item: _feed[i],
                          onLike: _feed[i].likeable
                              ? () => _toggleFeedLike(i)
                              : null,
                          onComment: () =>
                              ShellScope.of(context).selectTab(3),
                          onShare: () => _shareFeed(_feed[i]),
                          onOpen: () =>
                              ShellScope.of(context).selectTab(3),
                        ),
                        if (i != _feed.length - 1)
                          const SizedBox(height: 11),
                      ],
                    ],
                  const SizedBox(height: 30),
                  const SectionHeader(title: 'Bugun siz uchun'),
                  const SizedBox(height: 13),
                  _EditorialFeature(
                    number: '01',
                    eyebrow: 'IDENTITY',
                    title: 'Bitta tegish —\nto‘liq taassurot.',
                    body:
                        'NFC ID ni telefon, karta yoki QR orqali bir xil premium tajribada ulashing.',
                    icon: Icons.contactless_rounded,
                    dark: true,
                    onTap: () => ShellScope.of(context).selectTab(2),
                  ),
                  const SizedBox(height: 11),
                  _EditorialFeature(
                    number: '02',
                    eyebrow: 'BUSINESS',
                    title: 'Biznes profilingiz\nmini-saytdan ko‘proq.',
                    body:
                        'Katalog, stories, postlar va NFC kirish nuqtasi bitta joyda.',
                    icon: Icons.storefront_outlined,
                    dark: false,
                    onTap: () => ShellScope.of(context).selectTab(1),
                  ),
                  const SizedBox(height: 30),
                  SectionHeader(
                    title: 'O‘zingizga mos ID',
                    action: 'Katalog',
                    onAction: () => ShellScope.of(context).selectTab(1),
                  ),
                  const SizedBox(height: 13),
                  SizedBox(
                    height: 154,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      physics: const BouncingScrollPhysics(),
                      itemCount: const [
                        ('DDD000', 'EXCLUSIVE'),
                        ('BBB888', 'PREMIUM'),
                        ('VIP001', 'SIGNATURE'),
                        ('AAA000', 'EXCLUSIVE'),
                      ].length,
                      separatorBuilder: (_, __) => const SizedBox(width: 10),
                      itemBuilder: (context, i) {
                        const ids = [
                          ('DDD000', 'EXCLUSIVE'),
                          ('BBB888', 'PREMIUM'),
                          ('VIP001', 'SIGNATURE'),
                          ('AAA000', 'EXCLUSIVE'),
                        ];
                        final id = ids[i];
                        return _PremiumIdCard(
                          code: id.$1,
                          tier: id.$2,
                          dark: i.isEven,
                          onTap: () => launchUrl(
                            Uri.parse(
                              'https://nfcstore.uz/katalog?q=' +
                                  id.$1.toLowerCase(),
                            ),
                            mode: LaunchMode.externalApplication,
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Premium ID xaridi ilovada emas — xavfsiz tarzda nfcstore.uz saytida yakunlanadi.',
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(fontSize: 10.5),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ShowcaseIdentity {
  const _ShowcaseIdentity({
    required this.kind,
    required this.code,
    required this.name,
    required this.role,
    required this.subtitle,
    required this.statA,
    required this.statALabel,
    required this.statB,
    required this.statBLabel,
    required this.dark,
    required this.live,
    this.avatarUrl,
  });

  final String kind;
  final String code;
  final String name;
  final String role;
  final String subtitle;
  final String statA;
  final String statALabel;
  final String statB;
  final String statBLabel;
  final bool dark;
  final bool live;
  final String? avatarUrl;
}

class _IdentityCard extends StatefulWidget {
  const _IdentityCard({required this.data, this.onTap});
  final _ShowcaseIdentity data;
  final VoidCallback? onTap;

  @override
  State<_IdentityCard> createState() => _IdentityCardState();
}

class _IdentityCardState extends State<_IdentityCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final d = widget.data;
    final bg = d.dark ? const Color(0xFF0D0D0C) : const Color(0xFFFDFCF8);
    final fg = d.dark ? const Color(0xFFF8F6F0) : const Color(0xFF111110);
    final muted = d.dark
        ? Colors.white.withValues(alpha: .56)
        : const Color(0xFF77736C);

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        duration: const Duration(milliseconds: 120),
        scale: _pressed ? .985 : 1,
        child: Container(
          padding: const EdgeInsets.all(21),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(31),
            border: Border.all(
              color: d.dark
                  ? Colors.white.withValues(alpha: .1)
                  : const Color(0xFFE2DED5),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: d.dark ? .22 : .1),
                blurRadius: 30,
                offset: const Offset(0, 15),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned(
                right: -40,
                top: -30,
                child: _SignalMark(
                  color: d.dark ? p.accent : Colors.black,
                  opacity: d.dark ? .18 : .055,
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        d.kind,
                        style: TextStyle(
                          color: muted,
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.55,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: d.live
                              ? const Color(0xFF7D9D74)
                              : p.accent,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        d.live ? 'LIVE' : 'DEMO',
                        style: TextStyle(
                          color: muted,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: .8,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    d.code,
                    style: TextStyle(
                      fontFamily: 'IBMPlexMono',
                      color: d.dark ? p.heroInk : fg,
                      fontSize: 28,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2.2,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    d.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: fg,
                      fontFamily: 'InstrumentSerif',
                      fontSize: 27,
                      height: .98,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    d.role,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: muted,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 13),
                  Text(
                    d.subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: muted,
                      fontSize: 11.2,
                      height: 1.35,
                    ),
                  ),
                  const Spacer(),
                  Row(
                    children: [
                      _MiniStat(
                        value: d.statA,
                        label: d.statALabel,
                        color: fg,
                        muted: muted,
                      ),
                      const SizedBox(width: 24),
                      _MiniStat(
                        value: d.statB,
                        label: d.statBLabel,
                        color: fg,
                        muted: muted,
                      ),
                      const Spacer(),
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: d.dark
                              ? Colors.white.withValues(alpha: .07)
                              : const Color(0xFFF1EEE7),
                          border: Border.all(
                            color: d.dark
                                ? Colors.white.withValues(alpha: .1)
                                : const Color(0xFFE0DDD4),
                          ),
                        ),
                        child: Icon(
                          Icons.arrow_outward_rounded,
                          color: fg,
                          size: 19,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({
    required this.value,
    required this.label,
    required this.color,
    required this.muted,
  });
  final String value;
  final String label;
  final Color color;
  final Color muted;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              color: color,
              fontFamily: 'IBMPlexMono',
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: muted, fontSize: 8.5)),
        ],
      );
}

class _SignalMark extends StatelessWidget {
  const _SignalMark({required this.color, required this.opacity});
  final Color color;
  final double opacity;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 170,
        height: 170,
        child: CustomPaint(
          painter: _SignalPainter(color.withValues(alpha: opacity)),
        ),
      );
}

class _SignalPainter extends CustomPainter {
  const _SignalPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final center = Offset(size.width * .2, size.height * .8);
    for (var i = 0; i < 5; i++) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: 38 + i * 24),
        -math.pi / 2,
        math.pi / 2,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _SignalPainter oldDelegate) =>
      oldDelegate.color != color;
}

class _LiveAction extends StatefulWidget {
  const _LiveAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  State<_LiveAction> createState() => _LiveActionState();
}

class _LiveActionState extends State<_LiveAction> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? .965 : 1,
        duration: const Duration(milliseconds: 110),
        child: Container(
          height: 112,
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: p.surface.withValues(alpha: .92),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: p.line.withValues(alpha: .8)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: .055),
                blurRadius: 16,
                offset: const Offset(0, 7),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(widget.icon, color: p.ink, size: 23),
              const Spacer(),
              Text(
                widget.title,
                style: TextStyle(
                  color: p.ink,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                widget.subtitle,
                maxLines: 1,
                style: TextStyle(color: p.ink2, fontSize: 8.8),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StoryOrb extends StatelessWidget {
  const _StoryOrb({
    required this.title,
    this.avatarUrl,
    this.letter,
    this.add = false,
    this.onTap,
  });

  final String title;
  final String? avatarUrl;
  final String? letter;
  final bool add;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 66,
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                BrandAvatar(
                  url: avatarUrl,
                  size: 60,
                  goldRing: !add,
                  fallback: letter ?? title,
                ),
                if (add)
                  Positioned(
                    right: -1,
                    bottom: -1,
                    child: Container(
                      width: 21,
                      height: 21,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: p.ink,
                        border: Border.all(color: p.background, width: 2),
                      ),
                      child: Icon(
                        Icons.add_rounded,
                        color: p.background,
                        size: 13,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 7),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: p.ink,
                fontSize: 9.1,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditorialFeature extends StatelessWidget {
  const _EditorialFeature({
    required this.number,
    required this.eyebrow,
    required this.title,
    required this.body,
    required this.icon,
    required this.dark,
    required this.onTap,
  });

  final String number;
  final String eyebrow;
  final String title;
  final String body;
  final IconData icon;
  final bool dark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final bg = dark ? const Color(0xFF111110) : p.surface;
    final fg = dark ? const Color(0xFFF8F6EF) : p.ink;
    final muted = dark ? Colors.white.withValues(alpha: .56) : p.ink2;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 190),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(
            color: dark
                ? Colors.white.withValues(alpha: .08)
                : p.line.withValues(alpha: .85),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        number,
                        style: TextStyle(
                          color: muted,
                          fontFamily: 'IBMPlexMono',
                          fontSize: 9,
                        ),
                      ),
                      const SizedBox(width: 9),
                      Text(
                        eyebrow,
                        style: TextStyle(
                          color: muted,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.25,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 27),
                  Text(
                    title,
                    style: TextStyle(
                      color: fg,
                      fontFamily: 'InstrumentSerif',
                      fontSize: 27,
                      height: .98,
                    ),
                  ),
                  const SizedBox(height: 13),
                  Text(
                    body,
                    style: TextStyle(
                      color: muted,
                      fontSize: 11.2,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: dark
                    ? Colors.white.withValues(alpha: .06)
                    : p.background2,
              ),
              child: Icon(icon, color: fg, size: 23),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopAction extends StatelessWidget {
  const _TopAction({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: p.surface.withValues(alpha: .88),
          border: Border.all(color: p.line.withValues(alpha: .8)),
        ),
        child: Icon(icon, size: 19, color: p.ink),
      ),
    );
  }
}

class _AmbientPainter extends CustomPainter {
  const _AmbientPainter({
    required this.progress,
    required this.ink,
    required this.accent,
    required this.background,
  });

  final double progress;
  final Color ink;
  final Color accent;
  final Color background;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = background);

    final phase = progress * math.pi * 2;
    final paintA = Paint()
      ..color = ink.withValues(alpha: .025)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 50);
    final paintB = Paint()
      ..color = accent.withValues(alpha: .035)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 55);

    canvas.drawCircle(
      Offset(
        size.width * .82 + math.sin(phase) * 20,
        size.height * .18 + math.cos(phase) * 16,
      ),
      120,
      paintA,
    );
    canvas.drawCircle(
      Offset(
        size.width * .12 + math.cos(phase * .8) * 16,
        size.height * .56 + math.sin(phase * .8) * 25,
      ),
      105,
      paintB,
    );
  }

  @override
  bool shouldRepaint(covariant _AmbientPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.ink != ink ||
      oldDelegate.accent != accent ||
      oldDelegate.background != background;
}

class _PremiumIdCard extends StatefulWidget {
  const _PremiumIdCard({
    required this.code,
    required this.tier,
    required this.onTap,
    required this.dark,
  });

  final String code;
  final String tier;
  final VoidCallback onTap;
  final bool dark;

  @override
  State<_PremiumIdCard> createState() => _PremiumIdCardState();
}

class _PremiumIdCardState extends State<_PremiumIdCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final dark = widget.dark;
    final fg = dark ? const Color(0xFFF8F6EF) : p.ink;
    final muted = dark ? Colors.white.withValues(alpha: .5) : p.ink2;
    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        duration: const Duration(milliseconds: 120),
        scale: _down ? .975 : 1,
        child: Container(
          width: 220,
          padding: const EdgeInsets.all(17),
          decoration: BoxDecoration(
            color: dark ? const Color(0xFF10100F) : p.surface,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(
              color: dark
                  ? p.accent.withValues(alpha: .32)
                  : p.line,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: dark ? .18 : .07),
                blurRadius: 24,
                offset: const Offset(0, 11),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned(
                right: -28,
                top: -34,
                child: SizedBox(
                  width: 110,
                  height: 110,
                  child: Opacity(
                    opacity: dark ? .18 : .08,
                    child: Image.asset(
                      'assets/images/nfcstore_logo_mark.png',
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.tier,
                    style: TextStyle(
                      color: muted,
                      fontSize: 8.2,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    widget.code,
                    style: TextStyle(
                      color: dark ? p.heroInk : fg,
                      fontFamily: 'IBMPlexMono',
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 2.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text(
                        'Ko‘rish',
                        style: TextStyle(
                          color: muted,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      Icon(
                        Icons.arrow_outward_rounded,
                        color: fg,
                        size: 17,
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeFeedCard extends StatefulWidget {
  const _HomeFeedCard({
    required this.item,
    required this.onComment,
    required this.onShare,
    required this.onOpen,
    this.onLike,
  });

  final FeedItem item;
  final VoidCallback? onLike;
  final VoidCallback onComment;
  final VoidCallback onShare;
  final VoidCallback onOpen;

  @override
  State<_HomeFeedCard> createState() => _HomeFeedCardState();
}

class _HomeFeedCardState extends State<_HomeFeedCard> {
  bool _pressed = false;

  String _compact(int n) {
    if (n >= 1000000) return (n / 1000000).toStringAsFixed(n % 1000000 == 0 ? 0 : 1) + 'M';
    if (n >= 1000) return (n / 1000).toStringAsFixed(n % 1000 == 0 ? 0 : 1) + 'K';
    return n.toString();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final item = widget.item;
    final hasImage = (item.imageUrl ?? '').isNotEmpty;
    final hasVideo = (item.videoUrl ?? '').isNotEmpty;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      onTap: widget.onOpen,
      child: AnimatedScale(
        duration: const Duration(milliseconds: 130),
        scale: _pressed ? .988 : 1,
        child: Container(
          decoration: BoxDecoration(
            color: p.surface,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: p.line),
            boxShadow: [
              BoxShadow(
                color: p.shadow.withValues(alpha: .45),
                blurRadius: 22,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(15, 14, 14, 12),
                child: Row(
                  children: [
                    BrandAvatar(
                      url: item.avatarUrl,
                      size: 39,
                      goldRing: true,
                      fallback: item.name,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name.isEmpty ? item.code : item.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item.code,
                            style: TextStyle(
                              color: p.ink2,
                              fontFamily: 'IBMPlexMono',
                              fontSize: 8.7,
                              letterSpacing: .7,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      item.isCompany
                          ? Icons.storefront_outlined
                          : Icons.person_outline_rounded,
                      color: p.ink2,
                      size: 18,
                    ),
                  ],
                ),
              ),
              if (hasImage)
                AspectRatio(
                  aspectRatio: 1.16,
                  child: CachedNetworkImage(
                    imageUrl: item.imageUrl!,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => ColoredBox(
                      color: p.background2,
                      child: const Center(
                        child: CircularProgressIndicator(strokeWidth: 1.4),
                      ),
                    ),
                    errorWidget: (_, __, ___) => ColoredBox(
                      color: p.background2,
                      child: Icon(
                        Icons.broken_image_outlined,
                        color: p.ink2,
                      ),
                    ),
                  ),
                )
              else if (hasVideo)
                AspectRatio(
                  aspectRatio: 1.16,
                  child: Container(
                    color: const Color(0xFF111110),
                    alignment: Alignment.center,
                    child: Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: .1),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: .16),
                        ),
                      ),
                      child: const Icon(
                        Icons.play_arrow_rounded,
                        color: Colors.white,
                        size: 31,
                      ),
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(15, 12, 12, 13),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (item.caption.trim().isNotEmpty) ...[
                      Text(
                        item.caption.trim(),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: p.ink,
                          fontSize: 11.7,
                          height: 1.42,
                        ),
                      ),
                      const SizedBox(height: 11),
                    ],
                    Row(
                      children: [
                        _FeedAction(
                          icon: item.liked
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          label: _compact(item.likeCount),
                          active: item.liked,
                          onTap: widget.onLike,
                        ),
                        const SizedBox(width: 8),
                        _FeedAction(
                          icon: Icons.chat_bubble_outline_rounded,
                          label: _compact(item.commentCount),
                          onTap: widget.onComment,
                        ),
                        const Spacer(),
                        _FeedAction(
                          icon: Icons.send_outlined,
                          label: 'Ulash',
                          onTap: widget.onShare,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeedAction extends StatelessWidget {
  const _FeedAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(99),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18,
              color: active ? const Color(0xFFFF5261) : p.ink,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: p.ink2,
                fontFamily: 'IBMPlexMono',
                fontSize: 8.8,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
