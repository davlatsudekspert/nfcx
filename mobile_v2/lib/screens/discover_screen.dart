import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';
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
    _debounce = Timer(const Duration(milliseconds: 320), _load);
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
        final items = q.isEmpty ? await repo.companies() : await repo.searchCompanies(q);
        if (!mounted) return;
        setState(() {
          _companies = items;
          _loading = false;
        });
      } else {
        final items = q.isEmpty ? await repo.catalog() : await repo.searchProfiles(q);
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

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text('Kashf eting', style: Theme.of(context).textTheme.headlineLarge),
                  ),
                  RoundIcon(
                    icon: Icons.tune_rounded,
                    onTap: () {},
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Qiziqarli insonlar, bizneslar va NFC ID lar',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
              child: TextField(
                controller: _search,
                decoration: InputDecoration(
                  hintText: 'Odam, biznes yoki NFC ID',
                  prefixIcon: const Icon(Icons.search_rounded),
                  filled: true,
                  fillColor: p.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: BorderSide(color: p.line),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: BorderSide(color: p.line),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    Pill(
                      label: 'Odamlar',
                      icon: Icons.person_outline_rounded,
                      selected: _mode == _DiscoverMode.people,
                      onTap: () => _setMode(_DiscoverMode.people),
                    ),
                    const SizedBox(width: 8),
                    Pill(
                      label: 'Bizneslar',
                      icon: Icons.storefront_outlined,
                      selected: _mode == _DiscoverMode.businesses,
                      onTap: () => _setMode(_DiscoverMode.businesses),
                    ),
                    const SizedBox(width: 8),
                    Pill(
                      label: 'NFC ID katalogi',
                      icon: Icons.badge_outlined,
                      selected: _mode == _DiscoverMode.catalog,
                      onTap: () => _setMode(_DiscoverMode.catalog),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Expanded(
              child: _loading
                  ? Center(child: CircularProgressIndicator(strokeWidth: 1.8, color: p.accent))
                  : _error != null
                      ? _Error(onRetry: _load)
                      : _mode == _DiscoverMode.businesses
                          ? _businessList()
                          : _profileList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _profileList() {
    if (_people.isEmpty) return const _Empty(text: 'Mos natija topilmadi.');
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 104),
      itemCount: _people.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final item = _people[i];
        final isCatalog = _mode == _DiscoverMode.catalog;
        return SurfaceCard(
          shadow: false,
          padding: const EdgeInsets.all(14),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => ProfileScreen(code: item.code)),
          ),
          child: Row(
            children: [
              BrandAvatar(
                url: item.avatarUrl,
                size: 52,
                goldRing: item.isPrimary,
                fallback: item.name,
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.name.isEmpty ? item.code : item.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.role.isEmpty ? 'NFCSTORE profile' : item.role,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 7,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _IdBadge(code: item.code),
                        Text(
                          item.views.toString() + ' ko‘rish',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontSize: 10.5),
                        ),
                        if (isCatalog && item.price > 0)
                          Text(
                            _money(item.price),
                            style: TextStyle(
                              color: context.brand.ink,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (isCatalog && item.price > 0)
                FilledButton(
                  onPressed: () => _openWebsite(item),
                  style: FilledButton.styleFrom(
                    backgroundColor: context.brand.hero,
                    foregroundColor: context.brand.heroInk,
                    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                  ),
                  child: const Text('Saytda olish', style: TextStyle(fontSize: 11)),
                )
              else
                Icon(Icons.chevron_right_rounded, color: context.brand.ink2),
            ],
          ),
        );
      },
    );
  }

  Widget _businessList() {
    if (_companies.isEmpty) return const _Empty(text: 'Mos biznes topilmadi.');
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 104),
      itemCount: _companies.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final item = _companies[i];
        return SurfaceCard(
          shadow: false,
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              BrandAvatar(url: item.logoUrl, size: 52, goldRing: item.verified, fallback: item.name),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.name, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 3),
                    Text(
                      item.about.isEmpty ? item.city : item.about,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 7),
                    Text(
                      item.id,
                      style: TextStyle(
                        fontFamily: 'IBMPlexMono',
                        fontSize: 10.5,
                        color: context.brand.accent,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: context.brand.ink2),
            ],
          ),
        );
      },
    );
  }
}

class _IdBadge extends StatelessWidget {
  const _IdBadge({required this.code});
  final String code;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: p.accentSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        code,
        style: TextStyle(
          fontFamily: 'IBMPlexMono',
          color: p.ink,
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: .7,
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Center(
        child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
      );
}

class _Error extends StatelessWidget {
  const _Error({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Ma’lumot yuklanmadi.', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Qayta urinish')),
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
