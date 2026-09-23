import 'package:flutter/material.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'business_profile_screen.dart';
import 'profile_screen.dart';

class SocialListScreen extends StatefulWidget {
  const SocialListScreen({
    super.key,
    required this.code,
    required this.following,
    required this.title,
  });

  final String code;
  final bool following;
  final String title;

  @override
  State<SocialListScreen> createState() => _SocialListScreenState();
}

class _SocialListScreenState extends State<SocialListScreen> {
  List<SocialIdentity> _items = const [];
  bool _loading = true;
  String? _message;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final items = await SessionScope.read(context).repo.followList(
            widget.code,
            following: widget.following,
          );
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _message = 'Ro‘yxat yuklanmadi.';
      });
    }
  }

  Future<void> _open(SocialIdentity item) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => item.isCompany
            ? BusinessProfileScreen(companyId: item.code)
            : ProfileScreen(code: item.code),
      ),
    );
  }

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
              widget.title,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            Text(
              widget.code,
              style: TextStyle(
                color: p.ink2,
                fontFamily: 'IBMPlexMono',
                fontSize: 8.8,
                letterSpacing: .8,
              ),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: p.ink,
        onRefresh: _load,
        child: _loading && _items.isEmpty
            ? ListView(
                children: const [
                  SizedBox(height: 220),
                  Center(child: CircularProgressIndicator(strokeWidth: 1.6)),
                ],
              )
            : _items.isEmpty
                ? ListView(
                    padding: const EdgeInsets.fromLTRB(22, 120, 22, 30),
                    children: [
                      Icon(
                        Icons.people_outline_rounded,
                        color: p.ink2,
                        size: 38,
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: Text(
                          _message ??
                              (widget.following
                                  ? 'Hozircha hech kim kuzatilmayapti.'
                                  : 'Hozircha obunachi yo‘q.'),
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 30),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final item = _items[i];
                      return InkWell(
                        onTap: () => _open(item),
                        borderRadius: BorderRadius.circular(22),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: p.surface,
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: p.line),
                          ),
                          child: Row(
                            children: [
                              BrandAvatar(
                                url: item.avatarUrl,
                                size: 48,
                                goldRing: item.verified,
                                fallback: item.name,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Flexible(
                                          child: Text(
                                            item.name.isEmpty
                                                ? item.code
                                                : item.name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                        if (item.verified) ...[
                                          const SizedBox(width: 5),
                                          Icon(
                                            Icons.verified_rounded,
                                            size: 14,
                                            color: p.accent,
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.isCompany
                                          ? 'Business · ' + item.code
                                          : item.code,
                                      style: TextStyle(
                                        color: p.ink2,
                                        fontFamily: 'IBMPlexMono',
                                        fontSize: 8.8,
                                      ),
                                    ),
                                    if (item.isCompany &&
                                        item.personName.isNotEmpty) ...[
                                      const SizedBox(height: 3),
                                      Text(
                                        'Orqasida: ' + item.personName,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: p.ink2,
                                          fontSize: 8.7,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Icon(
                                Icons.chevron_right_rounded,
                                color: p.ink2,
                              ),
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
