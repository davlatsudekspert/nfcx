import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'business_manage_screen.dart';
import 'social_list_screen.dart';

class BusinessProfileScreen extends StatefulWidget {
  const BusinessProfileScreen({
    super.key,
    required this.companyId,
    this.own = false,
  });

  final String companyId;
  final bool own;

  @override
  State<BusinessProfileScreen> createState() => _BusinessProfileScreenState();
}

class _BusinessProfileScreenState extends State<BusinessProfileScreen> {
  Company? _company;
  List<Product> _catalog = const [];
  List<PostItem> _posts = const [];
  bool _loading = true;
  bool _followBusy = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loading && _company == null) _load();
  }

  Future<void> _load() async {
    final repo = SessionScope.read(context).repo;
    setState(() => _loading = true);

    try {
      final results = await Future.wait<dynamic>([
        repo.company(widget.companyId),
        repo.companyCatalog(widget.companyId),
        repo.companyPosts(widget.companyId),
      ]);

      if (!mounted) return;
      setState(() {
        _company = results[0] as Company;
        _catalog = results[1] as List<Product>;
        _posts = results[2] as List<PostItem>;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleFollow() async {
    final c = _company;
    if (c == null || widget.own || _followBusy) return;

    setState(() => _followBusy = true);
    try {
      final r =
          await SessionScope.read(context).repo.toggleCompanyFollow(c.id);
      if (!mounted) return;
      setState(() {
        _company = Company(
          id: c.id,
          name: c.name,
          logoUrl: c.logoUrl,
          coverUrl: c.coverUrl,
          about: c.about,
          city: c.city,
          address: c.address,
          phone: c.phone,
          telegram: c.telegram,
          instagram: c.instagram,
          website: c.website,
          followers: r.followers,
          views: c.views,
          following: r.following,
          verified: c.verified,
          isOpen: c.isOpen,
          hoursLabel: c.hoursLabel,
          items: c.items,
        );
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _followBusy = false);
    }
  }

  Future<void> _open(String raw) async {
    if (raw.trim().isEmpty) return;

    Uri? uri;
    if (raw.startsWith('tel:')) {
      uri = Uri.tryParse(raw);
    } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
      uri = Uri.tryParse(raw);
    } else if (raw.startsWith('@')) {
      uri = Uri.tryParse('https://t.me/' + raw.substring(1));
    } else {
      uri = Uri.tryParse(raw);
    }

    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _share(Company c) async {
    await Share.share(
      'https://nfcstore.uz/c/' + c.id.toLowerCase(),
      subject: c.name,
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;

    if (_loading && _company == null) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(
            strokeWidth: 1.6,
            color: p.ink,
          ),
        ),
      );
    }

    final c = _company;
    if (c == null) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: OutlinedButton(
              onPressed: _load,
              child: const Text('Qayta urinish'),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        color: p.ink,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            SliverToBoxAdapter(
              child: _BusinessHero(
                company: c,
                own: widget.own,
                onBack:
                    widget.own ? null : () => Navigator.of(context).pop(),
                onShare: () => _share(c),
                onFollowers: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SocialListScreen(
                      code: c.id,
                      following: false,
                      title: 'Business obunachilari',
                    ),
                  ),
                ),
                onManage: widget.own
                    ? () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => BusinessManageScreen(
                              companyId: c.id,
                            ),
                          ),
                        );
                        if (mounted) await _load();
                      }
                    : null,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (c.about.isNotEmpty) ...[
                      Text(
                        'ABOUT',
                        style: TextStyle(
                          color: p.ink2,
                          fontSize: 8.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.5,
                        ),
                      ),
                      const SizedBox(height: 9),
                      Text(
                        c.about,
                        style: TextStyle(
                          color: p.ink,
                          fontSize: 13.2,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                    if (!widget.own)
                      SizedBox(
                        width: double.infinity,
                        height: 51,
                        child: FilledButton(
                          onPressed: _followBusy ? null : _toggleFollow,
                          style: FilledButton.styleFrom(
                            backgroundColor: p.ink,
                            foregroundColor: p.background,
                          ),
                          child: _followBusy
                              ? SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: p.background,
                                  ),
                                )
                              : Text(
                                  c.following
                                      ? 'Kuzatilmoqda'
                                      : 'Biznesni kuzatish',
                                ),
                        ),
                      ),
                    if (!widget.own) const SizedBox(height: 18),
                    if (c.phone.isNotEmpty ||
                        c.telegram.isNotEmpty ||
                        c.instagram.isNotEmpty ||
                        c.website.isNotEmpty)
                      _ContactStrip(
                        company: c,
                        onOpen: _open,
                      ),
                    const SizedBox(height: 28),
                    Row(
                      children: [
                        Text(
                          'Catalog',
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontSize: 17),
                        ),
                        const Spacer(),
                        Text(
                          _catalog.length.toString() + ' item',
                          style: TextStyle(
                            color: p.ink2,
                            fontFamily: 'IBMPlexMono',
                            fontSize: 9.3,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (_catalog.isEmpty)
                      _EmptyBlock(
                        icon: Icons.inventory_2_outlined,
                        text: 'Katalog hozircha bo‘sh.',
                      )
                    else
                      SizedBox(
                        height: 246,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          physics: const BouncingScrollPhysics(),
                          itemCount: _catalog.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(width: 10),
                          itemBuilder: (context, i) => _ProductCard(
                            product: _catalog[i],
                            dark: i % 4 == 0,
                          ),
                        ),
                      ),
                    const SizedBox(height: 30),
                    Row(
                      children: [
                        Text(
                          'Stories & posts',
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontSize: 17),
                        ),
                        const Spacer(),
                        Text(
                          _posts.length.toString(),
                          style: TextStyle(
                            color: p.ink2,
                            fontFamily: 'IBMPlexMono',
                            fontSize: 9.3,
                          ),
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
                  child: _EmptyBlock(
                    icon: Icons.auto_stories_outlined,
                    text: 'Hozircha kontent yo‘q.',
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 30),
                sliver: SliverGrid.builder(
                  itemCount: _posts.length,
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 7,
                    mainAxisSpacing: 7,
                    childAspectRatio: .8,
                  ),
                  itemBuilder: (context, i) =>
                      _BusinessPost(post: _posts[i]),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _BusinessHero extends StatelessWidget {
  const _BusinessHero({
    required this.company,
    required this.own,
    required this.onShare,
    required this.onFollowers,
    this.onBack,
    this.onManage,
  });

  final Company company;
  final bool own;
  final VoidCallback onShare;
  final VoidCallback onFollowers;
  final VoidCallback? onBack;
  final VoidCallback? onManage;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final hasCover = (company.coverUrl ?? '').isNotEmpty;

    return Container(
      height: 420,
      decoration: const BoxDecoration(
        color: Color(0xFF111110),
        borderRadius: BorderRadius.vertical(
          bottom: Radius.circular(34),
        ),
      ),
      child: Stack(
        fit: StackFit.passthrough,
        children: [
          if (hasCover)
            Positioned.fill(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(34),
                ),
                child: CachedNetworkImage(
                  imageUrl: company.coverUrl!,
                  fit: BoxFit.cover,
                  color: Colors.black.withValues(alpha: .5),
                  colorBlendMode: BlendMode.darken,
                ),
              ),
            ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(34),
                ),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: hasCover
                      ? [
                          Colors.black.withValues(alpha: .22),
                          Colors.black.withValues(alpha: .82),
                        ]
                      : [
                          const Color(0xFF111110),
                          const Color(0xFF0B0B0A),
                        ],
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              18,
              MediaQuery.paddingOf(context).top + 10,
              18,
              25,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (onBack != null)
                      _HeroButton(
                        icon: Icons.arrow_back_rounded,
                        onTap: onBack!,
                      )
                    else
                      Text(
                        'BUSINESS',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .44),
                          fontSize: 8.4,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.7,
                        ),
                      ),
                    const Spacer(),
                    if (onManage != null) ...[
                      _HeroButton(
                        icon: Icons.tune_rounded,
                        onTap: onManage!,
                      ),
                      const SizedBox(width: 7),
                    ],
                    _HeroButton(
                      icon: Icons.ios_share_rounded,
                      onTap: onShare,
                    ),
                  ],
                ),
                const Spacer(),
                BrandAvatar(
                  url: company.logoUrl,
                  size: 82,
                  goldRing: company.verified,
                  fallback: company.name,
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Text(
                        company.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Color(0xFFF8F6EF),
                          fontFamily: 'InstrumentSerif',
                          fontSize: 38,
                          height: .91,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      company.id,
                      style: TextStyle(
                        color: p.heroInk,
                        fontFamily: 'IBMPlexMono',
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    if (company.city.isNotEmpty) ...[
                      Icon(
                        Icons.location_on_outlined,
                        color: Colors.white.withValues(alpha: .48),
                        size: 14,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        company.city,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .52),
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                    const Spacer(),
                    if (company.isOpen != null)
                      Text(
                        company.isOpen == true ? 'OPEN' : 'CLOSED',
                        style: TextStyle(
                          color: company.isOpen == true
                              ? const Color(0xFF9ABB8F)
                              : const Color(0xFFE07B72),
                          fontSize: 8.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.3,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 23),
                Row(
                  children: [
                    _HeroStat(
                      value: company.views.toString(),
                      label: 'views',
                    ),
                    const SizedBox(width: 28),
                    _HeroStat(
                      value: company.followers.toString(),
                      label: 'followers',
                      onTap: onFollowers,
                    ),
                    const Spacer(),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: .055),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: .1),
                        ),
                      ),
                      child: Icon(
                        Icons.storefront_outlined,
                        color: p.heroInk,
                        size: 23,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactStrip extends StatelessWidget {
  const _ContactStrip({
    required this.company,
    required this.onOpen,
  });

  final Company company;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final items = <({IconData icon, String label, String value})>[
      if (company.phone.isNotEmpty)
        (
          icon: Icons.call_outlined,
          label: 'Call',
          value: 'tel:' + company.phone,
        ),
      if (company.telegram.isNotEmpty)
        (
          icon: Icons.send_outlined,
          label: 'Telegram',
          value: company.telegram,
        ),
      if (company.instagram.isNotEmpty)
        (
          icon: Icons.camera_alt_outlined,
          label: 'Instagram',
          value: company.instagram,
        ),
      if (company.website.isNotEmpty)
        (
          icon: Icons.language_rounded,
          label: 'Website',
          value: company.website,
        ),
    ];

    return SizedBox(
      height: 76,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final item = items[i];
          return _ContactButton(
            icon: item.icon,
            label: item.label,
            onTap: () => onOpen(item.value),
          );
        },
      ),
    );
  }
}

class _ContactButton extends StatelessWidget {
  const _ContactButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        width: 91,
        padding: const EdgeInsets.symmetric(horizontal: 11),
        decoration: BoxDecoration(
          color: p.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: p.line),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: p.ink, size: 19),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                color: p.ink2,
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

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.dark,
  });

  final Product product;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final bg = dark ? const Color(0xFF111110) : p.surface;
    final fg = dark ? const Color(0xFFF8F6EF) : p.ink;
    final muted =
        dark ? Colors.white.withValues(alpha: .48) : p.ink2;

    return Container(
      width: 184,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(25),
        border: Border.all(
          color: dark
              ? Colors.white.withValues(alpha: .08)
              : p.line,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: product.imageUrl == null
                ? ColoredBox(
                    color: dark
                        ? Colors.white.withValues(alpha: .035)
                        : p.background2,
                    child: Center(
                      child: Icon(
                        Icons.inventory_2_outlined,
                        color: muted,
                        size: 32,
                      ),
                    ),
                  )
                : CachedNetworkImage(
                    imageUrl: product.imageUrl!,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => ColoredBox(
                      color: p.background2,
                      child: Icon(
                        Icons.broken_image_outlined,
                        color: p.ink2,
                      ),
                    ),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(13, 11, 13, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: fg,
                    fontSize: 11.7,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  _money(product.effectivePrice),
                  style: TextStyle(
                    color: dark ? p.heroInk : muted,
                    fontFamily: 'IBMPlexMono',
                    fontSize: 9.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BusinessPost extends StatelessWidget {
  const _BusinessPost({required this.post});
  final PostItem post;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
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
          Positioned(
            left: 9,
            right: 9,
            bottom: 9,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: .42),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Text(
                post.caption.isEmpty ? 'NFCSTORE Business' : post.caption,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9.5,
                  height: 1.25,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBlock extends StatelessWidget {
  const _EmptyBlock({
    required this.icon,
    required this.text,
  });

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      height: 135,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: p.surface,
        borderRadius: BorderRadius.circular(23),
        border: Border.all(color: p.line),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: p.ink2, size: 25),
          const SizedBox(height: 8),
          Text(
            text,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(99),
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: .06),
            border: Border.all(
              color: Colors.white.withValues(alpha: .1),
            ),
          ),
          child: Icon(icon, color: Colors.white, size: 18),
        ),
      );
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

String _money(int value) {
  final s = value.toString();
  final out = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) out.write(' ');
    out.write(s[i]);
  }
  return out.toString() + ' so‘m';
}