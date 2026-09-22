import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
import 'business_profile_screen.dart';
import 'profile_screen.dart';

enum _DiscoverMode { people, businesses, catalog }

class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final _search = TextEditingController();
  Timer? _debounce;

  _DiscoverMode _mode = _DiscoverMode.people;
  bool _loading = true;
  List<IdentityProfile> _people = const [];
  List<Company> _companies = const [];
  Object? _error;

  @override
  void initState() {
    super.initState();
    _search.addListener(_onSearch);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_loading && _people.isEmpty && _companies.isEmpty) _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.removeListener(_onSearch);
    _search.dispose();
    super.dispose();
  }

  void _onSearch() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _load);
  }

  Future<void> _load() async {
    final repo = SessionScope.read(context).repo;
    final q = _search.text.trim();

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (_mode == _DiscoverMode.businesses) {
        final items =
            q.isEmpty ? await repo.companies() : await repo.searchCompanies(q);
        if (!mounted) return;
        setState(() {
          _companies = items;
          _loading = false;
        });
      } else {
        final items =
            q.isEmpty ? await repo.catalog() : await repo.searchProfiles(q);
        if (!mounted) return;
        setState(() {
          _people = items;
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  void _setMode(_DiscoverMode value) {
    if (_mode == value) return;
    setState(() => _mode = value);
    _load();
  }

  Future<void> _openWebsite(IdentityProfile item) async {
    final uri = Uri.parse(
      'https://nfcstore.uz/katalog?q=' + Uri.encodeQueryComponent(item.code),
    );
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _catalogSheet(IdentityProfile item) async {
    final p = context.brand;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: p.surface,
      showDragHandle: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 4, 18, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _CatalogCard(item: item, large: true),
            const SizedBox(height: 16),
            Text(
              'Ilovada to‘lov olinmaydi. Tanlangan NFC ID uchun xarid va to‘lov nfcstore.uz saytida yakunlanadi.',
              textAlign: TextAlign.center,
              style: Theme.of(sheetContext).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton.icon(
                onPressed: () {
                  Navigator.pop(sheetContext);
                  _openWebsite(item);
                },
                icon: const Icon(Icons.open_in_new_rounded, size: 18),
                label: const Text('Saytda davom etish'),
                style: FilledButton.styleFrom(
                  backgroundColor: p.ink,
                  foregroundColor: p.background,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 17, 18, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Text(
                      'Discover\nwhat matters.',
                      style: Theme.of(context)
                          .textTheme
                          .headlineLarge
                          ?.copyWith(fontSize: 34, height: .94),
                    ),
                  ),
                  Text(
                    'NFCSTORE / 26',
                    style: TextStyle(
                      color: p.ink2,
                      fontFamily: 'IBMPlexMono',
                      fontSize: 8.8,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Container(
                decoration: BoxDecoration(
                  color: p.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: p.line),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: .045),
                      blurRadius: 16,
                      offset: const Offset(0, 7),
                    ),
                  ],
                ),
                child: TextField(
                  controller: _search,
                  decoration: InputDecoration(
                    hintText: 'Odam, biznes yoki NFC ID',
                    prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: _search.text.isEmpty
                        ? null
                        : IconButton(
                            onPressed: () => _search.clear(),
                            icon: const Icon(Icons.close_rounded),
                          ),
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: _ModeBar(
                mode: _mode,
                onChanged: _setMode,
              ),
            ),
            const SizedBox(height: 14),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                child: _loading
                    ? Center(
                        key: const ValueKey('loading'),
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: p.ink,
                        ),
                      )
                    : _error != null
                        ? _Error(
                            key: const ValueKey('error'),
                            onRetry: _load,
                          )
                        : switch (_mode) {
                            _DiscoverMode.people => _peopleView(),
                            _DiscoverMode.businesses => _businessView(),
                            _DiscoverMode.catalog => _catalogView(),
                          },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _peopleView() {
    final p = context.brand;
    if (_people.isEmpty) {
      return const _Empty(
        key: ValueKey('people-empty'),
        text: 'Mos profil topilmadi.',
      );
    }

    final featured = _people.first;
    final rest = _people.skip(1).toList();

    return ListView(
      key: const ValueKey('people'),
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 2, 18, 24),
      children: [
        GestureDetector(
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => ProfileScreen(code: featured.code),
            ),
          ),
          child: Container(
            height: 196,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFF111110),
              borderRadius: BorderRadius.circular(28),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: 0,
                  top: 0,
                  child: BrandAvatar(
                    url: featured.avatarUrl,
                    size: 72,
                    goldRing: true,
                    fallback: featured.name,
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'FEATURED IDENTITY',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: .42),
                        fontSize: 8.3,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.45,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      featured.code,
                      style: TextStyle(
                        color: p.heroInk,
                        fontFamily: 'IBMPlexMono',
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      featured.name.isEmpty ? featured.code : featured.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontFamily: 'InstrumentSerif',
                        fontSize: 29,
                        height: .95,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      featured.role.isEmpty
                          ? 'NFCSTORE identity'
                          : featured.role,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: .55),
                        fontSize: 10.5,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 22),
        Text(
          'YANGI PROFILLAR',
          style: TextStyle(
            color: p.ink2,
            fontSize: 8.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < rest.length; i++) ...[
          _PersonRow(
            item: rest[i],
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProfileScreen(code: rest[i].code),
              ),
            ),
          ),
          if (i != rest.length - 1)
            Divider(height: 1, indent: 58, color: p.line),
        ],
      ],
    );
  }

  Widget _businessView() {
    if (_companies.isEmpty) {
      return const _Empty(
        key: ValueKey('business-empty'),
        text: 'Mos biznes topilmadi.',
      );
    }

    return GridView.builder(
      key: const ValueKey('business'),
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 2, 18, 24),
      itemCount: _companies.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: .82,
      ),
      itemBuilder: (context, i) {
        final item = _companies[i];
        return _BusinessTile(
          item: item,
          dark: i % 3 == 0,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => BusinessProfileScreen(companyId: item.id),
            ),
          ),
        );
      },
    );
  }

  Widget _catalogView() {
    if (_people.isEmpty) {
      return const _Empty(
        key: ValueKey('catalog-empty'),
        text: 'Mos NFC ID topilmadi.',
      );
    }

    return GridView.builder(
      key: const ValueKey('catalog'),
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 2, 18, 24),
      itemCount: _people.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: .9,
      ),
      itemBuilder: (context, i) => GestureDetector(
        onTap: () => _catalogSheet(_people[i]),
        child: _CatalogCard(
          item: _people[i],
          dark: i % 4 == 0,
        ),
      ),
    );
  }
}

class _ModeBar extends StatelessWidget {
  const _ModeBar({
    required this.mode,
    required this.onChanged,
  });

  final _DiscoverMode mode;
  final ValueChanged<_DiscoverMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;

    Widget item(
      String text,
      _DiscoverMode value,
    ) {
      final selected = mode == value;
      return Expanded(
        child: InkWell(
          borderRadius: BorderRadius.circular(15),
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 170),
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? p.ink : Colors.transparent,
              borderRadius: BorderRadius.circular(15),
            ),
            child: Text(
              text,
              style: TextStyle(
                color: selected ? p.background : p.ink2,
                fontSize: 10.5,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: p.background2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: p.line),
      ),
      child: Row(
        children: [
          item('Odamlar', _DiscoverMode.people),
          item('Biznes', _DiscoverMode.businesses),
          item('NFC ID', _DiscoverMode.catalog),
        ],
      ),
    );
  }
}

class _PersonRow extends StatelessWidget {
  const _PersonRow({
    required this.item,
    required this.onTap,
  });

  final IdentityProfile item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            BrandAvatar(
              url: item.avatarUrl,
              size: 47,
              fallback: item.name,
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name.isEmpty ? item.code : item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: p.ink,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.role.isEmpty ? 'NFCSTORE identity' : item.role,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: p.ink2, fontSize: 9.5),
                  ),
                ],
              ),
            ),
            Text(
              item.code,
              style: TextStyle(
                color: p.ink,
                fontFamily: 'IBMPlexMono',
                fontSize: 9.3,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 6),
            Icon(Icons.arrow_outward_rounded, color: p.ink2, size: 17),
          ],
        ),
      ),
    );
  }
}

class _BusinessTile extends StatelessWidget {
  const _BusinessTile({
    required this.item,
    required this.dark,
    required this.onTap,
  });

  final Company item;
  final bool dark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final bg = dark ? const Color(0xFF111110) : p.surface;
    final fg = dark ? const Color(0xFFF8F6EF) : p.ink;
    final muted =
        dark ? Colors.white.withValues(alpha: .5) : p.ink2;

    return InkWell(
      borderRadius: BorderRadius.circular(25),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(25),
          border: Border.all(
            color: dark
                ? Colors.white.withValues(alpha: .08)
                : p.line,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                BrandAvatar(
                  url: item.logoUrl,
                  size: 44,
                  goldRing: item.verified,
                  fallback: item.name,
                ),
                const Spacer(),
                Icon(
                  Icons.arrow_outward_rounded,
                  color: muted,
                  size: 18,
                ),
              ],
            ),
            const Spacer(),
            Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: fg,
                fontFamily: 'InstrumentSerif',
                fontSize: 22,
                height: .98,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              item.city.isEmpty ? 'NFCSTORE Business' : item.city,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: muted, fontSize: 9.5),
            ),
            const SizedBox(height: 11),
            Text(
              item.id,
              style: TextStyle(
                color: dark ? p.heroInk : fg,
                fontFamily: 'IBMPlexMono',
                fontSize: 9.3,
                fontWeight: FontWeight.w600,
                letterSpacing: .7,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CatalogCard extends StatelessWidget {
  const _CatalogCard({
    required this.item,
    this.dark = false,
    this.large = false,
  });

  final IdentityProfile item;
  final bool dark;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    final bg = dark ? const Color(0xFF111110) : p.surface;
    final fg = dark ? const Color(0xFFF8F6EF) : p.ink;
    final muted =
        dark ? Colors.white.withValues(alpha: .5) : p.ink2;

    return Container(
      height: large ? 210 : null,
      padding: EdgeInsets.all(large ? 20 : 15),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(
          color: dark
              ? Colors.white.withValues(alpha: .08)
              : p.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'NFC ID',
                style: TextStyle(
                  color: muted,
                  fontSize: 8.2,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.35,
                ),
              ),
              const Spacer(),
              Icon(
                Icons.contactless_rounded,
                color: dark ? p.heroInk : p.ink,
                size: large ? 27 : 21,
              ),
            ],
          ),
          const Spacer(),
          Text(
            item.code,
            style: TextStyle(
              color: dark ? p.heroInk : fg,
              fontFamily: 'IBMPlexMono',
              fontSize: large ? 27 : 19,
              fontWeight: FontWeight.w600,
              letterSpacing: large ? 2 : 1.2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            item.name.isEmpty ? 'Tanlangan identity' : item.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: fg,
              fontSize: large ? 14 : 10.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            item.price > 0 ? _money(item.price) : 'Narx saytda',
            style: TextStyle(
              color: muted,
              fontSize: large ? 12 : 9.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({
    super.key,
    required this.text,
  });

  final String text;

  @override
  Widget build(BuildContext context) => Center(
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      );
}

class _Error extends StatelessWidget {
  const _Error({
    super.key,
    required this.onRetry,
  });

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Ma’lumot yuklanmadi.',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onRetry,
              child: const Text('Qayta urinish'),
            ),
          ],
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
