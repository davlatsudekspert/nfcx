from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"Expected block not found in {path}: {old[:120]!r}")
    p.write_text(s.replace(old, new, 1))


# Premium metallic story ring.
path = "mobile/lib/design/components/story_ring.dart"
replace_once(
    path,
    "      final gradient = widget.reels ? C.reelsRing : C.storyRing;\n",
    """      final gradient = widget.reels
          ? C.reelsRing
          : const SweepGradient(
              colors: [
                Color(0xFFC8874A),
                Color(0xFFDDE1E6),
                Color(0xFFF0C96B),
                Color(0xFFA96C3F),
                Color(0xFFE8D8B1),
                Color(0xFFD8B77A),
              ],
              stops: [0, .18, .38, .58, .78, 1],
              transform: GradientRotation(.35),
            );
""",
)
replace_once(path, "        margin: const EdgeInsets.all(2.4),\n", "        margin: const EdgeInsets.all(3.2),\n")

# Home: own story comes from the active persona's direct endpoint.
path = "mobile/lib/screens/home/home.dart"
replace_once(
    path,
    "  List<StoryFeedEntry> _stories = const [];\n  List<FeedEntry> _feed = const [];\n",
    "  List<StoryFeedEntry> _stories = const [];\n  bool _hasOwnStory = false;\n  List<FeedEntry> _feed = const [];\n",
)
replace_once(
    path,
    """      List<StoryFeedEntry> stories = const [];
      try {
        stories = await state.repo.storyFeed();
      } catch (_) {}

      // TUGALLANMAGAN TO'LOV vaqtga bog'liq: kod 24 soat band
""",
    """      List<StoryFeedEntry> stories = const [];
      try {
        stories = await state.repo.storyFeed();
      } catch (_) {}

      var hasOwnStory = false;
      final activeIdentity = state.active;
      if (activeIdentity != null && activeIdentity.code.isNotEmpty) {
        try {
          final ownStories = activeIdentity.isBusiness
              ? await state.repo.companyStories(activeIdentity.code)
              : await state.repo.recordStories(activeIdentity.code);
          hasOwnStory = ownStories.isNotEmpty;
        } catch (_) {}
      }

      // TUGALLANMAGAN TO'LOV vaqtga bog'liq: kod 24 soat band
""",
)
replace_once(
    path,
    """        _feed = feed.items;
        _stories = stories;
        _pending = pending;
""",
    """        _feed = feed.items;
        _stories = stories;
        _hasOwnStory = hasOwnStory;
        _pending = pending;
""",
)
replace_once(
    path,
    """  bool get _myStory {
    final code = AppScope.of(context).active?.code;
    if (code == null) return false;
    return _stories.any((e) => e.code == code);
  }

  Future<void> _openMyStory(String code) async {
    await push<void>(context, (_) => StoryViewerScreen(code: code));
  }
""",
    """  bool get _myStory => _hasOwnStory;

  Future<void> _openMyStory(String code) async {
    await push<void>(context, (_) => StoryViewerScreen(code: code));
    if (mounted) await _load(force: true);
  }
""",
)
replace_once(
    path,
    """                  child: _StoryStrip(
                    entries: _orderedStories,
                    loading: _loading && _stories.isEmpty,
                    unseen: _seen.hasUnseen,
                    onAdd: active == null ? null : () => _addStory(active.code),
                    onOpen: _openStory,
                  ),
""",
    """                  child: _StoryStrip(
                    entries: _orderedStories,
                    loading: _loading && _stories.isEmpty && !_myStory,
                    unseen: _seen.hasUnseen,
                    identity: active,
                    hasOwnStory: _myStory,
                    onOwnOpen: active == null ? null : () => _openMyStory(active.code),
                    onAdd: active == null ? null : () => _addStory(active.code),
                    onOpen: _openStory,
                  ),
""",
)
replace_once(path, "              width: 38,\n              height: 38,\n", "              width: 44,\n              height: 44,\n")
replace_once(path, "              child: NIcon(icon, size: 18, color: C.ink),\n", "              child: NIcon(icon, size: 20, color: C.ink),\n")
replace_once(
    path,
    """  const _StoryStrip({
    required this.entries,
    required this.loading,
    required this.unseen,
    required this.onAdd,
    required this.onOpen,
  });

  final List<StoryFeedEntry> entries;
  final bool loading;

  /// Shu odamda ko'rilmagan istorya bormi — halqa shunga qarab
  /// yonadi yoki so'nadi.
  final bool Function(StoryFeedEntry) unseen;

  final VoidCallback? onAdd;
  final ValueChanged<StoryFeedEntry> onOpen;
""",
    """  const _StoryStrip({
    required this.entries,
    required this.loading,
    required this.unseen,
    required this.identity,
    required this.hasOwnStory,
    required this.onOwnOpen,
    required this.onAdd,
    required this.onOpen,
  });

  final List<StoryFeedEntry> entries;
  final bool loading;

  /// Shu odamda ko'rilmagan istorya bormi — halqa shunga qarab
  /// yonadi yoki so'nadi.
  final bool Function(StoryFeedEntry) unseen;

  final Identity? identity;
  final bool hasOwnStory;
  final VoidCallback? onOwnOpen;
  final VoidCallback? onAdd;
  final ValueChanged<StoryFeedEntry> onOpen;
""",
)
replace_once(path, "      height: 88,\n", "      height: 100,\n")
replace_once(
    path,
    """          if (i == 0) {
            return StoryRing(addButton: true, onTap: onAdd);
          }
""",
    """          if (i == 0) {
            final me = identity;
            if (hasOwnStory && me != null) {
              return StoryRing(
                avatarUrl: me.avatarUrl,
                name: tr('Siz'),
                size: 68,
                seen: false,
                onTap: onOwnOpen,
              );
            }
            return StoryRing(size: 68, addButton: true, onTap: onAdd);
          }
""",
)
replace_once(
    path,
    """          return StoryRing(
            avatarUrl: e.avatarUrl,
            name: e.name,
""",
    """          return StoryRing(
            avatarUrl: e.avatarUrl,
            name: e.name,
            size: 68,
""",
)

# Payment: buyer name + selected CTA + visible checkout launch failure.
path = "mobile/lib/screens/payment/payment_screen.dart"
replace_once(path, "import 'package:flutter/widgets.dart';\n", "import 'package:flutter/widgets.dart';\nimport 'package:url_launcher/url_launcher.dart';\n")
replace_once(
    path,
    """    final repo = AppScope.read(context).repo;
    try {
      final order = await repo.reserveRecord(widget.record.code, provider: _provider);
""",
    """    final app = AppScope.read(context);
    final repo = app.repo;
    final buyerName = (app.active?.name ?? '').trim();
    final buyerPhone = (app.user?.phone ?? '').trim();
    if (buyerName.isEmpty) {
      setState(() {
        _busy = false;
        _error = tr('To‘lovni boshlash uchun profilingizdagi ismni kiriting.');
      });
      return;
    }
    try {
      final order = await repo.reserveRecord(
        widget.record.code,
        name: buyerName,
        phone: buyerPhone,
        provider: _provider,
      );
""",
)
replace_once(
    path,
    """      await openExternal(Uri.parse(link));
      _startPolling();
""",
    """      var opened = false;
      try {
        opened = await launchUrl(
          Uri.parse(link),
          mode: LaunchMode.externalApplication,
        );
      } catch (_) {
        opened = false;
      }
      if (!opened) {
        if (!mounted) return;
        setState(() {
          _phase = _Phase.choose;
          _error = trf(
            '{tizim} to‘lov sahifasini ochib bo‘lmadi. Qayta urinib ko‘ring.',
            {'tizim': _provider == 'click' ? 'Click' : 'Payme'},
          );
        });
        return;
      }
      _startPolling();
""",
)
replace_once(
    path,
    """              PrimaryButton(
                tr('Payme bilan to‘lash'),
                loading: _busy,
                onTap: (_busy || !paymeOn) ? null : _start,
              ),
""",
    """              PrimaryButton(
                _provider == 'click'
                    ? tr('Click bilan to‘lash')
                    : tr('Payme bilan to‘lash'),
                loading: _busy,
                onTap: (_busy || (_provider == 'click' ? !clickOn : !paymeOn))
                    ? null
                    : _start,
              ),
""",
)
replace_once(path, "import '../common/contact_actions.dart';\n", "")

print('targeted patches applied')
