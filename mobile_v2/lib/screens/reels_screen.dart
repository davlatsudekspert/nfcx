import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player/video_player.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'business_profile_screen.dart';
import 'compose_screen.dart';
import 'profile_screen.dart';

class ReelsScreen extends StatefulWidget {
  const ReelsScreen({super.key});

  @override
  State<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends State<ReelsScreen> {
  final _controller = PageController();
  List<FeedItem> _items = const [];
  bool _loading = true;
  Object? _error;
  int _page = 1;
  bool _hasMore = true;
  bool _loadingMore = false;
  int _index = 0;
  Set<String> _saved = <String>{};

  String _savedKey(FeedItem item) => item.targetKind + ':' + item.id.toString();

  Future<void> _loadSaved() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList('v2_saved_reels') ?? const <String>[];
    if (mounted) setState(() => _saved = saved.toSet());
  }

  Future<void> _toggleSaved(FeedItem item) async {
    final key = _savedKey(item);
    final next = {..._saved};
    if (!next.add(key)) next.remove(key);
    setState(() => _saved = next);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList('v2_saved_reels', next.toList()..sort());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_saved.isEmpty) _loadSaved();
    if (_loading && _items.isEmpty) _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await SessionScope.read(context).repo.feed(page: 1);
      if (!mounted) return;
      setState(() {
        _items = r.items;
        _page = 1;
        _hasMore = r.hasMore;
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

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    _loadingMore = true;
    try {
      final r = await SessionScope.read(context).repo.feed(page: _page + 1);
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...r.items];
        _page += 1;
        _hasMore = r.hasMore;
      });
    } catch (_) {
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> _toggleLike(int index) async {
    if (index < 0 || index >= _items.length) return;
    final original = _items[index];
    if (!original.likeable) return;

    setState(() {
      _items = [..._items]
        ..[index] = original.copyWith(
          liked: !original.liked,
          likeCount:
              (original.likeCount + (original.liked ? -1 : 1)).clamp(0, 1 << 30),
        );
    });

    try {
      final result = await SessionScope.read(context)
          .repo
          .likeContent(original.targetKind, original.id);
      if (!mounted) return;
      setState(() {
        final current = _items[index];
        _items = [..._items]
          ..[index] = current.copyWith(
            liked: result.liked,
            likeCount: result.count,
          );
      });
    } catch (_) {
      if (mounted) {
        setState(() => _items = [..._items]..[index] = original);
      }
    }
  }

  Future<void> _share(FeedItem item) async {
    await Share.share(
      'https://nfcstore.uz/' + item.code.toLowerCase(),
      subject: item.name,
    );
  }

  void _openAuthor(FeedItem item) {
    if (item.isCompany) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => BusinessProfileScreen(companyId: item.code),
        ),
      );
    } else {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProfileScreen(code: item.code)),
      );
    }
  }

  Future<void> _comments(int index) async {
    final item = _items[index];
    final count = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.brand.surface,
      showDragHandle: true,
      builder: (_) => _CommentsSheet(item: item),
    );
    if (!mounted || count == null || index >= _items.length) return;
    setState(() {
      _items = [..._items]
        ..[index] = _items[index].copyWith(commentCount: count);
    });
  }

  Future<void> _more(FeedItem item) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: context.brand.surface,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.person_outline_rounded),
                title: const Text('Profilni ochish'),
                onTap: () => Navigator.pop(sheetContext, 'profile'),
              ),
              ListTile(
                leading: const Icon(Icons.flag_outlined),
                title: const Text('Shikoyat qilish'),
                onTap: () => Navigator.pop(sheetContext, 'report'),
              ),
              ListTile(
                leading: const Icon(Icons.ios_share_rounded),
                title: const Text('Ulashish'),
                onTap: () => Navigator.pop(sheetContext, 'share'),
              ),
            ],
          ),
        ),
      ),
    );

    if (!mounted || action == null) return;
    if (action == 'profile') {
      _openAuthor(item);
    } else if (action == 'share') {
      await _share(item);
    } else if (action == 'report') {
      try {
        await SessionScope.read(context).repo.report(
          targetKind: item.targetKind,
          targetId: item.id.toString(),
          ownerCode: item.code,
          reason: 'other',
          note: 'Mobile V2 orqali yuborildi',
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Shikoyat yuborildi.')),
          );
        }
      } catch (_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Shikoyat yuborilmadi.')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;

    if (_loading && _items.isEmpty) {
      return const ColoredBox(
        color: Colors.black,
        child: Center(
          child: CircularProgressIndicator(
            strokeWidth: 1.7,
            color: Colors.white,
          ),
        ),
      );
    }

    if (_error != null && _items.isEmpty) {
      return ColoredBox(
        color: Colors.black,
        child: SafeArea(
          child: Center(
            child: OutlinedButton(
              onPressed: _load,
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
              child: const Text('Qayta urinish'),
            ),
          ),
        ),
      );
    }

    if (_items.isEmpty) {
      return ColoredBox(
        color: Colors.black,
        child: SafeArea(
          child: Center(
            child: Text(
              'Reels hozircha bo‘sh.',
              style: TextStyle(color: Colors.white.withValues(alpha: .7)),
            ),
          ),
        ),
      );
    }

    return ColoredBox(
      color: Colors.black,
      child: PageView.builder(
        controller: _controller,
        scrollDirection: Axis.vertical,
        itemCount: _items.length,
        onPageChanged: (value) {
          setState(() => _index = value);
          if (value >= _items.length - 2) _loadMore();
        },
        itemBuilder: (context, i) {
          final item = _items[i];
          return Stack(
            fit: StackFit.expand,
            children: [
              _ReelMedia(item: item, active: i == _index),
              const _ReelScrim(),
              SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(15, 13, 11, 104),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Text(
                            'Reels',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -.7,
                            ),
                          ),
                          const Spacer(),
                          _GlassIcon(
                            icon: Icons.add_rounded,
                            onTap: () async {
                              final done =
                                  await Navigator.of(context).push<bool>(
                                MaterialPageRoute(
                                  builder: (_) => const ComposeScreen(
                                    kind: ComposeKind.post,
                                  ),
                                ),
                              );
                              if (done == true && mounted) await _load();
                            },
                          ),
                          const SizedBox(width: 7),
                          _GlassIcon(
                            icon: Icons.camera_alt_outlined,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => const ComposeScreen(
                                  kind: ComposeKind.story,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const Spacer(),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => _openAuthor(item),
                              child: Padding(
                                padding: const EdgeInsets.only(
                                  left: 2,
                                  right: 12,
                                  bottom: 5,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        BrandAvatar(
                                          url: item.avatarUrl,
                                          size: 38,
                                          goldRing: true,
                                          fallback: item.name,
                                        ),
                                        const SizedBox(width: 9),
                                        Flexible(
                                          child: Text(
                                            item.name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 13.7,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 9,
                                            vertical: 5,
                                          ),
                                          decoration: BoxDecoration(
                                            borderRadius:
                                                BorderRadius.circular(999),
                                            border: Border.all(
                                              color: Colors.white
                                                  .withValues(alpha: .4),
                                            ),
                                          ),
                                          child: const Text(
                                            'Ko‘rish',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 9.2,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (item.caption.isNotEmpty) ...[
                                      const SizedBox(height: 10),
                                      Text(
                                        item.caption,
                                        maxLines: 3,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: Colors.white
                                              .withValues(alpha: .92),
                                          fontSize: 12.6,
                                          height: 1.38,
                                        ),
                                      ),
                                    ],
                                    const SizedBox(height: 10),
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          item.isCompany
                                              ? Icons.storefront_outlined
                                              : Icons.badge_outlined,
                                          color:
                                              p.heroInk.withValues(alpha: .9),
                                          size: 13,
                                        ),
                                        const SizedBox(width: 5),
                                        Text(
                                          item.code,
                                          style: TextStyle(
                                            fontFamily: 'IBMPlexMono',
                                            color:
                                                p.heroInk.withValues(alpha: .95),
                                            fontSize: 9.4,
                                            fontWeight: FontWeight.w600,
                                            letterSpacing: .65,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          SizedBox(
                            width: 58,
                            child: Column(
                              children: [
                                GestureDetector(
                                  onTap: () => _openAuthor(item),
                                  child: Stack(
                                    clipBehavior: Clip.none,
                                    children: [
                                      BrandAvatar(
                                        url: item.avatarUrl,
                                        size: 46,
                                        goldRing: true,
                                        fallback: item.name,
                                      ),
                                      Positioned(
                                        bottom: -5,
                                        left: 15,
                                        child: Container(
                                          width: 18,
                                          height: 18,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: p.heroInk,
                                            border: Border.all(
                                              color: Colors.black,
                                              width: 2,
                                            ),
                                          ),
                                          child: const Icon(
                                            Icons.add_rounded,
                                            color: Colors.black,
                                            size: 12,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 20),
                                _ReelAction(
                                  icon: item.liked
                                      ? Icons.favorite_rounded
                                      : Icons.favorite_border_rounded,
                                  label: _compact(item.likeCount),
                                  color: item.liked
                                      ? const Color(0xFFFF5261)
                                      : Colors.white,
                                  onTap: item.likeable
                                      ? () => _toggleLike(i)
                                      : null,
                                ),
                                const SizedBox(height: 17),
                                _ReelAction(
                                  icon: Icons.chat_bubble_outline_rounded,
                                  label: _compact(item.commentCount),
                                  onTap: () => _comments(i),
                                ),
                                const SizedBox(height: 17),
                                _ReelAction(
                                  icon: Icons.send_outlined,
                                  label: 'Ulash',
                                  onTap: () => _share(item),
                                ),
                                const SizedBox(height: 17),
                                _ReelAction(
                                  icon: _saved.contains(_savedKey(item))
                                      ? Icons.bookmark_rounded
                                      : Icons.bookmark_border_rounded,
                                  label: 'Saqlash',
                                  color: _saved.contains(_savedKey(item))
                                      ? p.heroInk
                                      : Colors.white,
                                  onTap: () => _toggleSaved(item),
                                ),
                                const SizedBox(height: 17),
                                _ReelAction(
                                  icon: Icons.more_horiz_rounded,
                                  label: '',
                                  onTap: () => _more(item),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CommentsSheet extends StatefulWidget {
  const _CommentsSheet({required this.item});
  final FeedItem item;

  @override
  State<_CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<_CommentsSheet> {
  final _text = TextEditingController();
  List<CommentItem> _comments = const [];
  bool _loading = true;
  bool _sending = false;
  int _total = 0;
  String? _message;

  @override
  void initState() {
    super.initState();
    _total = widget.item.commentCount;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final r = await SessionScope.read(context)
          .repo
          .comments(widget.item.targetKind, widget.item.id);
      if (!mounted) return;
      setState(() {
        _comments = r.comments;
        _total = r.total;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _message = 'Izohlar yuklanmadi.';
        });
      }
    }
  }

  Future<void> _send() async {
    final body = _text.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _message = null;
    });

    try {
      final r = await SessionScope.read(context).repo.addComment(
            widget.item.targetKind,
            widget.item.id,
            body,
          );
      if (!mounted) return;
      setState(() {
        _comments = [r.comment, ..._comments];
        _total = r.total;
        _text.clear();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _message = switch (e.key) {
          'premium_required' =>
            'Izoh yozish Premium hisoblar uchun. Izohlarni o‘qish ochiq.',
          'banned' => 'Hisobingizga izoh yozish cheklovi qo‘yilgan.',
          'too_many_requests' => 'Juda tez yozdingiz. Biroz kuting.',
          _ => 'Izoh yuborilmadi.',
        };
      });
    } catch (_) {
      if (mounted) setState(() => _message = 'Izoh yuborilmadi.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _toggleCommentLike(int index) async {
    final before = _comments[index];
    setState(() {
      _comments = [..._comments]
        ..[index] = before.copyWith(
          liked: !before.liked,
          likes: (before.likes + (before.liked ? -1 : 1)).clamp(0, 1 << 30),
        );
    });

    try {
      final r = await SessionScope.read(context).repo.likeComment(before.id);
      if (!mounted) return;
      setState(() {
        _comments = [..._comments]
          ..[index] = _comments[index].copyWith(
            liked: r.liked,
            likes: r.count,
          );
      });
    } catch (_) {
      if (mounted) {
        setState(() => _comments = [..._comments]..[index] = before);
      }
    }
  }

  Future<void> _delete(int index) async {
    final item = _comments[index];
    if (!item.mine) return;
    try {
      final total =
          await SessionScope.read(context).repo.deleteComment(item.id);
      if (!mounted) return;
      setState(() {
        _comments = [..._comments]..removeAt(index);
        _total = total;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return PopScope(
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
      },
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .72,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 2, 18, 14),
                child: Row(
                  children: [
                    Text(
                      'Izohlar',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _compact(_total),
                      style: TextStyle(
                        color: p.ink2,
                        fontFamily: 'IBMPlexMono',
                        fontSize: 11,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () => Navigator.pop(context, _total),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: p.line),
              Expanded(
                child: _loading
                    ? Center(
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: p.ink,
                        ),
                      )
                    : _comments.isEmpty
                        ? Center(
                            child: Text(
                              'Birinchi izohni qoldiring.',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 15, 16, 18),
                            itemCount: _comments.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 16),
                            itemBuilder: (context, i) {
                              final item = _comments[i];
                              return GestureDetector(
                                onLongPress:
                                    item.mine ? () => _delete(i) : null,
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    BrandAvatar(
                                      url: item.avatarUrl,
                                      size: 38,
                                      fallback: item.name,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  item.name.isEmpty
                                                      ? item.code
                                                      : item.name,
                                                  style: TextStyle(
                                                    color: p.ink,
                                                    fontSize: 11.5,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ),
                                              if (item.parentId > 0)
                                                Text(
                                                  'javob',
                                                  style: TextStyle(
                                                    color: p.ink2,
                                                    fontSize: 9,
                                                  ),
                                                ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            item.body,
                                            style: TextStyle(
                                              color: p.ink,
                                              fontSize: 12.5,
                                              height: 1.38,
                                            ),
                                          ),
                                          if (item.mine) ...[
                                            const SizedBox(height: 4),
                                            Text(
                                              'O‘chirish uchun bosib turing',
                                              style: TextStyle(
                                                color: p.ink2,
                                                fontSize: 8.5,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    GestureDetector(
                                      onTap: () => _toggleCommentLike(i),
                                      child: Column(
                                        children: [
                                          Icon(
                                            item.liked
                                                ? Icons.favorite_rounded
                                                : Icons.favorite_border_rounded,
                                            color: item.liked
                                                ? const Color(0xFFFF5261)
                                                : p.ink2,
                                            size: 18,
                                          ),
                                          if (item.likes > 0) ...[
                                            const SizedBox(height: 3),
                                            Text(
                                              _compact(item.likes),
                                              style: TextStyle(
                                                color: p.ink2,
                                                fontSize: 8.5,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
              ),
              if (_message != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      _message!,
                      style: TextStyle(
                        color: p.ink2,
                        fontSize: 10.5,
                      ),
                    ),
                  ),
                ),
              Container(
                padding: const EdgeInsets.fromLTRB(13, 10, 13, 12),
                decoration: BoxDecoration(
                  color: p.surface,
                  border: Border(top: BorderSide(color: p.line)),
                ),
                child: SafeArea(
                  top: false,
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _text,
                          maxLength: 1000,
                          minLines: 1,
                          maxLines: 4,
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: 'Izoh yozing…',
                            filled: true,
                            fillColor: p.background2,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(18),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        onPressed: _sending ? null : _send,
                        style: IconButton.styleFrom(
                          backgroundColor: p.ink,
                          foregroundColor: p.background,
                        ),
                        icon: _sending
                            ? SizedBox(
                                width: 17,
                                height: 17,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: p.background,
                                ),
                              )
                            : const Icon(Icons.arrow_upward_rounded),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GlassIcon extends StatelessWidget {
  const _GlassIcon({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.black.withValues(alpha: .28),
            border: Border.all(
              color: Colors.white.withValues(alpha: .16),
            ),
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
      );
}

class _ReelAction extends StatelessWidget {
  const _ReelAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = Colors.white,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color color;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: 58,
          child: Column(
            children: [
              Icon(icon, color: color, size: 29),
              if (label.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  label,
                  maxLines: 1,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: .94),
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ],
          ),
        ),
      );
}

class _ReelScrim extends StatelessWidget {
  const _ReelScrim();

  @override
  Widget build(BuildContext context) => const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0x66000000),
              Color(0x00000000),
              Color(0x16000000),
              Color(0xC7000000),
            ],
            stops: [0, .22, .58, 1],
          ),
        ),
      );
}

class _ReelMedia extends StatefulWidget {
  const _ReelMedia({required this.item, required this.active});
  final FeedItem item;
  final bool active;

  @override
  State<_ReelMedia> createState() => _ReelMediaState();
}

class _ReelMediaState extends State<_ReelMedia> {
  VideoPlayerController? _video;

  @override
  void initState() {
    super.initState();
    _setup();
  }

  @override
  void didUpdateWidget(_ReelMedia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item.videoUrl != widget.item.videoUrl) {
      _disposeVideo();
      _setup();
    } else {
      _sync();
    }
  }

  Future<void> _setup() async {
    final url = widget.item.videoUrl;
    if ((url ?? '').isEmpty) return;
    final controller = VideoPlayerController.networkUrl(Uri.parse(url!));
    _video = controller;
    try {
      await controller.initialize();
      await controller.setLooping(true);
      if (widget.active) await controller.play();
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Future<void> _sync() async {
    final v = _video;
    if (v == null || !v.value.isInitialized) return;
    if (widget.active) {
      await v.play();
    } else {
      await v.pause();
    }
  }

  void _disposeVideo() {
    _video?.dispose();
    _video = null;
  }

  @override
  void dispose() {
    _disposeVideo();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final v = _video;
    if (v != null && v.value.isInitialized) {
      return FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: v.value.size.width,
          height: v.value.size.height,
          child: VideoPlayer(v),
        ),
      );
    }

    final image = widget.item.imageUrl;
    if ((image ?? '').isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: image!,
        fit: BoxFit.cover,
        errorWidget: (_, __, ___) =>
            const ColoredBox(color: Color(0xFF111111)),
      );
    }

    return const ColoredBox(
      color: Color(0xFF111111),
      child: Center(
        child: Icon(
          Icons.play_circle_outline_rounded,
          color: Colors.white54,
          size: 70,
        ),
      ),
    );
  }
}

String _compact(int value) {
  if (value >= 1000000) {
    final v = value / 1000000;
    return (v >= 10 ? v.toStringAsFixed(0) : v.toStringAsFixed(1)) + 'M';
  }
  if (value >= 1000) {
    final v = value / 1000;
    return (v >= 10 ? v.toStringAsFixed(0) : v.toStringAsFixed(1)) + 'K';
  }
  return value.toString();
}