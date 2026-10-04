import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/utils/media_url.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/nova_scaffold.dart';
import '../../design/widgets/states.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';
import '../social/media_frame.dart' show mediaImage;

/// SOZLAMALAR -> ILOVA HAQIDA -> YANGILIKLAR (egasi, 2026-10).
///
/// ## NIMA UCHUN QORA EKRAN EDI
///
/// "Yangiliklar" qatori `context.push(Routes.discover)` qilardi.
/// `/discover` — pastki navigatsiyadagi Tanlov tabi, ya'ni
/// `StatefulShellRoute` ichidagi branch. Uni shell'dan TASHQARIDAGI
/// sahifa (Sozlamalar) ustiga `push` qilish shell'ning ikkinchi
/// nusxasini qurishga urinadi va qora sahifa qoladi — Android'da ham,
/// iPhone'da ham (umumiy Flutter kodi). Bundan tashqari u yangilik
/// emas, katalog edi.
///
/// Endi bu — o'z sahifasi: saytdagi `/api/news` (o'sha yangiliklar,
/// uch tilda). Yuklanish, bo'sh, xato (qayta urinish) holatlari bor —
/// hech qachon bo'sh qora ekran emas.
class NewsItem {
  const NewsItem({
    required this.id,
    required this.title,
    required this.body,
    required this.imageUrl,
    required this.date,
  });

  final int id;
  final String title;
  final String body;
  final String imageUrl;
  final DateTime? date;

  /// Server elementi -> joriy til. Tarjima bo'sh bo'lsa o'zbekchasi.
  factory NewsItem.fromJson(Map<String, dynamic> j, String lang) {
    String pick(String base) {
      final suffix = switch (lang) { 'ru' => 'Ru', 'en' => 'En', _ => '' };
      final v = suffix.isEmpty ? '' : '${j['$base$suffix'] ?? ''}'.trim();
      return v.isNotEmpty ? v : '${j[base] ?? ''}'.trim();
    }

    return NewsItem(
      id: (j['id'] as num?)?.toInt() ?? 0,
      title: pick('title'),
      body: pick('body'),
      imageUrl: mediaUrl('${j['imageUrl'] ?? ''}'),
      date: DateTime.tryParse('${j['createdAt'] ?? ''}'.replaceFirst(' ', 'T')),
    );
  }
}

/// Faqat e'lon qilingan yangiliklar (server ham shuni beradi).
final newsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.watch(apiProvider).get<Map<String, dynamic>>('/api/news');
  final data = res.when(ok: (v) => v, err: (e) => throw e);
  final list = data['news'];
  return [
    if (list is List)
      for (final e in list)
        if (e is Map && e['published'] != false) Map<String, dynamic>.from(e),
  ];
});

String _date(DateTime? d) {
  if (d == null) return '';
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.day)}.${two(d.month)}.${d.year}';
}

class NewsScreen extends ConsumerWidget {
  const NewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final lang = Localizations.localeOf(context).languageCode;
    final news = ref.watch(newsProvider);

    return NovaScaffold(
      title: l.settingsNews,
      showBack: true,
      body: news.when(
        loading: () => const SkeletonList(count: 3, height: 120),
        error: (e, __) => StatePanel.fromError(context, asAppError(e),
            onRetry: () => ref.invalidate(newsProvider)),
        data: (raw) {
          final items = [for (final j in raw) NewsItem.fromJson(j, lang)];
          if (items.isEmpty) {
            return StatePanel(
              key: const ValueKey('news-empty'),
              icon: Icons.campaign_outlined,
              title: l.newsEmpty,
              message: l.newsEmptyHint,
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(newsProvider),
            child: ListView.separated(
              key: const ValueKey('news-list'),
              padding: const EdgeInsets.fromLTRB(
                  Gap.screenX, Gap.md, Gap.screenX, Gap.section),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: Gap.md),
              itemBuilder: (context, i) => _NewsCard(item: items[i]),
            ),
          );
        },
      ),
    );
  }
}

class _NewsCard extends StatelessWidget {
  const _NewsCard({required this.item});
  final NewsItem item;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    return FloatingSurface(
      key: ValueKey('news-${item.id}'),
      solid: true,
      padding: EdgeInsets.zero,
      borderRadius: BorderRadius.circular(24),
      onTap: () => _open(context, item),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (item.imageUrl.isNotEmpty)
              AspectRatio(
                aspectRatio: 16 / 9,
                child: ColoredBox(
                  color: t.surface2,
                  child: mediaImage(context, item.imageUrl, fit: BoxFit.cover),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(Gap.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (item.date != null)
                    Text(_date(item.date),
                        style: AppType.monoStyle(color: t.text2, size: 11)),
                  const SizedBox(height: Gap.xs),
                  Text(item.title, style: text.titleMedium),
                  if (item.body.isNotEmpty) ...[
                    const SizedBox(height: Gap.xs),
                    Text(item.body,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: text.bodyMedium),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static void _open(BuildContext context, NewsItem item) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => _NewsDetail(item: item),
    ));
  }
}

class _NewsDetail extends StatelessWidget {
  const _NewsDetail({required this.item});
  final NewsItem item;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    return NovaScaffold(
      showBack: true,
      body: NovaScroll(
        children: [
          if (item.imageUrl.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: ColoredBox(
                  color: t.surface2,
                  child: mediaImage(context, item.imageUrl, fit: BoxFit.cover),
                ),
              ),
            ),
          const SizedBox(height: Gap.lg),
          if (item.date != null)
            Text(_date(item.date),
                style: AppType.monoStyle(color: t.text2, size: 11)),
          const SizedBox(height: Gap.xs),
          Text(item.title, style: text.titleLarge),
          const SizedBox(height: Gap.md),
          SelectableText(item.body, style: text.bodyLarge),
          const SizedBox(height: Gap.section),
        ],
      ),
    );
  }
}
