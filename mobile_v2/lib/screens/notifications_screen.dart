import 'package:flutter/material.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'profile_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _items = const [];
  int _unread = 0;
  bool _loading = true;
  String? _message;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loading && _items.isEmpty) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final r = await SessionScope.read(context).repo.notifications();
      if (!mounted) return;
      setState(() {
        _items = r.items;
        _unread = r.unreadCount;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _message = 'Bildirishnomalar yuklanmadi.';
      });
    }
  }

  Future<void> _markAll() async {
    if (_unread == 0) return;
    try {
      await SessionScope.read(context).repo.readAllNotifications();
      if (!mounted) return;
      setState(() {
        _unread = 0;
        _items = _items.map((e) => e.copyWith(read: true)).toList();
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('O‘qildi holati saqlanmadi.')),
        );
      }
    }
  }

  Future<void> _open(NotificationItem item) async {
    if (!item.read) {
      try {
        final unread =
            await SessionScope.read(context).repo.readNotification(item.id);
        if (mounted) {
          final i = _items.indexWhere((e) => e.id == item.id);
          if (i >= 0) {
            setState(() {
              _unread = unread;
              _items = [..._items]..[i] = _items[i].copyWith(read: true);
            });
          }
        }
      } catch (_) {}
    }

    final code = item.actorCode.isNotEmpty ? item.actorCode : item.code;
    if (!mounted || code.isEmpty) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ProfileScreen(code: code)),
    );
  }

  String _text(NotificationItem n) {
    final who = n.title.trim().isEmpty ? 'Foydalanuvchi' : n.title.trim();
    return switch (n.type) {
      'follow' => who + ' sizni kuzata boshladi.',
      'like' => who + ' kontentingizni yoqtirdi.',
      'comment' => who + ' izoh qoldirdi.',
      _ => who + ' profilingiz bilan o‘zaro aloqa qildi.',
    };
  }

  IconData _icon(NotificationItem n) => switch (n.type) {
        'follow' => Icons.person_add_alt_1_rounded,
        'like' => Icons.favorite_rounded,
        'comment' => Icons.chat_bubble_rounded,
        _ => Icons.notifications_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Bildirishnomalar',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            if (_unread > 0)
              Text(
                _unread.toString() + ' ta yangi',
                style: TextStyle(
                  color: p.ink2,
                  fontSize: 9.5,
                  fontFamily: 'IBMPlexMono',
                ),
              ),
          ],
        ),
        actions: [
          if (_unread > 0)
            TextButton(
              onPressed: _markAll,
              child: const Text('Hammasi o‘qildi'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        color: p.ink,
        onRefresh: _load,
        child: _loading && _items.isEmpty
            ? ListView(
                children: const [
                  SizedBox(height: 220),
                  Center(child: CircularProgressIndicator(strokeWidth: 1.7)),
                ],
              )
            : _items.isEmpty
                ? ListView(
                    padding: const EdgeInsets.fromLTRB(20, 110, 20, 30),
                    children: [
                      Icon(
                        Icons.notifications_none_rounded,
                        size: 42,
                        color: p.ink2,
                      ),
                      const SizedBox(height: 13),
                      Center(
                        child: Text(
                          _message ?? 'Hozircha bildirishnoma yo‘q.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 30),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final item = _items[i];
                      return InkWell(
                        onTap: () => _open(item),
                        borderRadius: BorderRadius.circular(23),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: item.read ? p.surface : p.background2,
                            borderRadius: BorderRadius.circular(23),
                            border: Border.all(
                              color: item.read
                                  ? p.line
                                  : p.accent.withValues(alpha: .42),
                            ),
                          ),
                          child: Row(
                            children: [
                              Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  BrandAvatar(
                                    url: item.avatarUrl,
                                    size: 48,
                                    goldRing: !item.read,
                                    fallback: item.title,
                                  ),
                                  Positioned(
                                    right: -3,
                                    bottom: -3,
                                    child: Container(
                                      width: 22,
                                      height: 22,
                                      decoration: BoxDecoration(
                                        color: p.ink,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: p.surface,
                                          width: 2,
                                        ),
                                      ),
                                      child: Icon(
                                        _icon(item),
                                        color: p.background,
                                        size: 11,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(width: 13),
                              Expanded(
                                child: Text(
                                  _text(item),
                                  style: TextStyle(
                                    color: p.ink,
                                    fontSize: 12,
                                    height: 1.42,
                                    fontWeight: item.read
                                        ? FontWeight.w500
                                        : FontWeight.w700,
                                  ),
                                ),
                              ),
                              if (!item.read) ...[
                                const SizedBox(width: 8),
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    color: p.accent,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
