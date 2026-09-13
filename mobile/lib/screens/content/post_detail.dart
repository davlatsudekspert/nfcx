import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../common/top_bar.dart';

/// Post tafsiloti — to'liq media, tavsif, yoqtirish va ko'rish soni.
class PostDetailScreen extends StatefulWidget {
  const PostDetailScreen({super.key, required this.post});
  final Post post;

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final p = widget.post;
    final images = p.images.isEmpty ? <String>[''] : p.images;
    return Scaffold(
      backgroundColor: C.obsidian,
      body: SafeArea(
        child: Column(
          children: [
            TopBar(
              title: p.authorName.isEmpty ? 'Post' : p.authorName,
              subtitle: p.createdAt == null ? null : _ago(p.createdAt!),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  AspectRatio(
                    aspectRatio: 4 / 5,
                    child: Stack(
                      children: [
                        PageView.builder(
                          itemCount: images.length,
                          onPageChanged: (i) => setState(() => _page = i),
                          itemBuilder: (_, i) => NetImage(
                            images[i].isEmpty ? null : images[i],
                            slotLabel: 'POST MEDIA 4:5',
                          ),
                        ),
                        if (images.length > 1)
                          Positioned(
                            right: S.x12, top: S.x12,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: C.backdrop.withValues(alpha: .6),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text('${_page + 1}/${images.length}',
                                  style: T.statusLabel.copyWith(color: C.offWhite)),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: S.x16),
                  Row(
                    children: [
                      const NIcon(Ico.heart, size: 20, color: C.ash),
                      const SizedBox(width: 6),
                      Text(compact(p.likes), style: T.meta),
                      const SizedBox(width: S.x20),
                      const NIcon(Ico.eye, size: 20, color: C.ash),
                      const SizedBox(width: 6),
                      Text(compact(p.views), style: T.meta),
                    ],
                  ),
                  if (p.caption.isNotEmpty) ...[
                    const SizedBox(height: S.x16),
                    Text(p.caption, style: T.body),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "4 soat oldin" ko'rinishidagi vaqt. Aniq sana kerak emas —
/// yangilik lentasida nisbiy vaqt tezroq o'qiladi.
String _ago(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return 'hozir';
  if (d.inMinutes < 60) return '${d.inMinutes} daqiqa oldin';
  if (d.inHours < 24) return '${d.inHours} soat oldin';
  if (d.inDays < 30) return '${d.inDays} kun oldin';
  return '${t.day}.${t.month.toString().padLeft(2, '0')}.${t.year}';
}
