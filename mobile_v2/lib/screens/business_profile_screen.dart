import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/models.dart';
import '../core/session.dart';
import '../core/theme.dart';
import '../ui/widgets.dart';

class BusinessProfileScreen extends StatefulWidget {
  const BusinessProfileScreen({super.key, required this.companyId, this.own = false});

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

  Future<void> _open(String raw) async {
    if (raw.trim().isEmpty) return;
    Uri? uri;
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      uri = Uri.tryParse(raw);
    } else if (raw.startsWith('@')) {
      uri = Uri.tryParse('https://t.me/' + raw.substring(1));
    } else {
      uri = Uri.tryParse(raw);
    }
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    if (_loading && _company == null) {
      return Scaffold(
        body: Center(child: CircularProgressIndicator(strokeWidth: 1.8, color: p.accent)),
      );
    }

    final c = _company;
    if (c == null) {
      return Scaffold(
        appBar: AppBar(backgroundColor: Colors.transparent),
        body: Center(
          child: OutlinedButton(onPressed: _load, child: const Text('Qayta urinish')),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 104),
          children: [
            Row(
              children: [
                if (!widget.own)
                  RoundIcon(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop()),
                const Spacer(),
                RoundIcon(icon: Icons.ios_share_rounded, onTap: () {
                  _open('https://nfcstore.uz/c/' + c.id.toLowerCase());
                }),
                const SizedBox(width: 9),
                RoundIcon(icon: Icons.more_horiz_rounded, onTap: () {}),
              ],
            ),
            const SizedBox(height: 12),
            if ((c.coverUrl ?? '').isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: CachedNetworkImage(
                  imageUrl: c.coverUrl!,
                  height: 150,
                  fit: BoxFit.cover,
                ),
              ),
            Transform.translate(
              offset: Offset(0, (c.coverUrl ?? '').isNotEmpty ? -34 : 0),
              child: Column(
                children: [
                  BrandAvatar(
                    url: c.logoUrl,
                    size: 88,
                    goldRing: true,
                    fallback: c.name,
                  ),
                  const SizedBox(height: 12),
                  Text(c.name, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineMedium),
                  if (c.city.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(c.city, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                  const SizedBox(height: 9),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: p.hero,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      c.id,
                      style: TextStyle(
                        fontFamily: 'IBMPlexMono',
                        color: p.heroInk,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (c.about.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(c.about, style: Theme.of(context).textTheme.bodyLarge),
            ],
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                StatBlock(value: c.views.toString(), label: 'ko‘rishlar'),
                StatBlock(value: c.followers.toString(), label: 'obunachilar'),
                StatBlock(value: _catalog.length.toString(), label: 'mahsulot'),
              ],
            ),
            const SizedBox(height: 22),
            if (c.hoursLabel.isNotEmpty || c.isOpen != null)
              SurfaceCard(
                shadow: false,
                child: Row(
                  children: [
                    Icon(
                      c.isOpen == false ? Icons.schedule_rounded : Icons.check_circle_outline_rounded,
                      color: c.isOpen == false ? const Color(0xFFD65D55) : p.accent,
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Text(
                        c.hoursLabel.isEmpty
                            ? (c.isOpen == true ? 'Hozir ochiq' : 'Hozir yopiq')
                            : c.hoursLabel,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 9,
              runSpacing: 9,
              children: [
                if (c.phone.isNotEmpty)
                  Pill(label: 'Telefon', icon: Icons.call_outlined, onTap: () => _open('tel:' + c.phone)),
                if (c.telegram.isNotEmpty)
                  Pill(label: 'Telegram', icon: Icons.send_outlined, onTap: () => _open(c.telegram)),
                if (c.instagram.isNotEmpty)
                  Pill(label: 'Instagram', icon: Icons.camera_alt_outlined, onTap: () => _open(c.instagram)),
                if (c.website.isNotEmpty)
                  Pill(label: 'Sayt', icon: Icons.language_rounded, onTap: () => _open(c.website)),
              ],
            ),
            const SizedBox(height: 28),
            const SectionHeader(title: 'Katalog'),
            const SizedBox(height: 12),
            if (_catalog.isEmpty)
              SurfaceCard(
                shadow: false,
                child: Text('Katalog hozircha bo‘sh.', style: Theme.of(context).textTheme.bodyMedium),
              )
            else
              SizedBox(
                height: 228,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _catalog.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 11),
                  itemBuilder: (context, i) => _ProductCard(product: _catalog[i]),
                ),
              ),
            const SizedBox(height: 28),
            const SectionHeader(title: 'Postlar'),
            const SizedBox(height: 12),
            if (_posts.isEmpty)
              SurfaceCard(
                shadow: false,
                child: Text('Hozircha post yo‘q.', style: Theme.of(context).textTheme.bodyMedium),
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
                ),
                itemBuilder: (context, i) {
                  final image = _posts[i].imageUrl;
                  return ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: image == null
                        ? ColoredBox(
                            color: p.background2,
                            child: Icon(Icons.image_outlined, color: p.ink2),
                          )
                        : CachedNetworkImage(imageUrl: image, fit: BoxFit.cover),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    final p = context.brand;
    return SizedBox(
      width: 164,
      child: SurfaceCard(
        padding: EdgeInsets.zero,
        shadow: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(21)),
                child: product.imageUrl == null
                    ? ColoredBox(
                        color: p.background2,
                        child: Center(child: Icon(Icons.inventory_2_outlined, color: p.ink2)),
                      )
                    : CachedNetworkImage(
                        imageUrl: product.imageUrl!,
                        width: double.infinity,
                        fit: BoxFit.cover,
                      ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 5),
                  Text(
                    _money(product.effectivePrice),
                    style: TextStyle(
                      color: p.accent,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
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
