import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

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
    final current = widget.code ?? SessionScope.of(context).activeProfile?.code ?? '';
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

  Future<void> _share() async {
    final p = _profile;
    if (p == null) return;
    await Share.share('https://nfcstore.uz/' + p.code.toLowerCase());
  }

  Future<void> _qr() async {
    final p = _profile;
    if (p == null) return;
    final palette = context.brand;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: palette.surface,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Mening QR kodim', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: QrImageView(
                data: 'https://nfcstore.uz/' + p.code.toLowerCase(),
                size: 220,
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              p.code,
              style: TextStyle(
                fontFamily: 'IBMPlexMono',
                color: palette.ink,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.2,
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
        body: Center(child: CircularProgressIndicator(strokeWidth: 1.8, color: palette.accent)),
      );
    }

    if (_error != null && _profile == null) {
      return Scaffold(
        appBar: widget.code == null ? null : AppBar(backgroundColor: Colors.transparent),
        body: Center(
          child: OutlinedButton(
            onPressed: () => _load(_loadedCode),
            child: const Text('Qayta urinish'),
          ),
        ),
      );
    }

    final p = _profile;
    if (p == null) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Text('Profil topilmadi.', style: Theme.of(context).textTheme.bodyMedium),
          ),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () => _load(p.code),
          color: palette.accent,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 104),
            children: [
              Row(
                children: [
                  if (!_own) ...[
                    RoundIcon(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop()),
                    const SizedBox(width: 10),
                  ],
                  const Spacer(),
                  RoundIcon(icon: Icons.ios_share_rounded, onTap: _share),
                  const SizedBox(width: 9),
                  RoundIcon(icon: Icons.more_horiz_rounded, onTap: () {}),
                ],
              ),
              const SizedBox(height: 10),
              Center(
                child: Column(
                  children: [
                    BrandAvatar(
                      url: p.avatarUrl,
                      size: 88,
                      goldRing: true,
                      fallback: p.name,
                    ),
                    const SizedBox(height: 13),
                    Text(
                      p.name,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    if (p.role.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(p.role, style: Theme.of(context).textTheme.bodyMedium),
                    ],
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: palette.hero,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        p.code,
                        style: TextStyle(
                          fontFamily: 'IBMPlexMono',
                          color: palette.heroInk,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.6,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  StatBlock(value: _posts.length.toString(), label: 'postlar'),
                  StatBlock(value: _stats.followers.toString(), label: 'obunachilar'),
                  StatBlock(value: _stats.following.toString(), label: 'obunalar'),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 48,
                      child: FilledButton.icon(
                        onPressed: _own ? () {} : null,
                        icon: Icon(_own ? Icons.edit_outlined : Icons.person_add_alt_1_rounded, size: 18),
                        label: Text(_own ? 'Profilni tahrirlash' : 'Kuzatish'),
                        style: FilledButton.styleFrom(
                          backgroundColor: palette.hero,
                          foregroundColor: palette.heroInk,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  RoundIcon(icon: Icons.qr_code_2_rounded, onTap: _qr, size: 48),
                  const SizedBox(width: 8),
                  RoundIcon(icon: Icons.ios_share_rounded, onTap: _share, size: 48),
                ],
              ),
              if (_own) ...[
                const SizedBox(height: 26),
                Row(
                  children: [
                    Expanded(
                      child: Text('NFC ID larim', style: Theme.of(context).textTheme.titleLarge),
                    ),
                    Text(
                      'Hammasi',
                      style: TextStyle(color: palette.ink2, fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 104,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: SessionScope.of(context).profiles.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (context, i) {
                      final item = SessionScope.of(context).profiles[i];
                      final selected = item.code == p.code;
                      return GestureDetector(
                        onTap: () => SessionScope.read(context).usePersonal(item),
                        child: Container(
                          width: 106,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: selected ? palette.hero : palette.surface,
                            borderRadius: BorderRadius.circular(17),
                            border: Border.all(
                              color: selected ? palette.accent : palette.line,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.code,
                                style: TextStyle(
                                  fontFamily: 'IBMPlexMono',
                                  color: selected ? palette.heroInk : palette.ink,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const Spacer(),
                              Text(
                                item.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: selected ? Colors.white : palette.ink,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                item.views.toString() + ' ko‘rish',
                                style: TextStyle(
                                  color: selected
                                      ? Colors.white.withValues(alpha: .56)
                                      : palette.ink2,
                                  fontSize: 8.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
              const SizedBox(height: 26),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 42,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        border: Border(bottom: BorderSide(color: palette.ink, width: 1.5)),
                      ),
                      child: Text('Postlar', style: Theme.of(context).textTheme.titleMedium),
                    ),
                  ),
                  Expanded(
                    child: Container(
                      height: 42,
                      alignment: Alignment.center,
                      child: Text('Reels', style: TextStyle(color: palette.ink2, fontSize: 13)),
                    ),
                  ),
                  Expanded(
                    child: Container(
                      height: 42,
                      alignment: Alignment.center,
                      child: Text('Saqlangan', style: TextStyle(color: palette.ink2, fontSize: 13)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_posts.isEmpty)
                SurfaceCard(
                  shadow: false,
                  child: Text(
                    'Hozircha post yo‘q.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _posts.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 5,
                    mainAxisSpacing: 5,
                    childAspectRatio: 1,
                  ),
                  itemBuilder: (context, i) {
                    final post = _posts[i];
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: post.imageUrl == null
                          ? ColoredBox(
                              color: palette.background2,
                              child: Icon(
                                post.videoUrl == null
                                    ? Icons.image_outlined
                                    : Icons.play_arrow_rounded,
                                color: palette.ink2,
                              ),
                            )
                          : CachedNetworkImage(
                              imageUrl: post.imageUrl!,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => ColoredBox(
                                color: palette.background2,
                                child: Icon(Icons.broken_image_outlined, color: palette.ink2),
                              ),
                            ),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}
