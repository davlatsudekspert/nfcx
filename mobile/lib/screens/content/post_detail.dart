import 'package:flutter/material.dart' show Scaffold;
import 'package:flutter/widgets.dart';
import '../../data/models.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/components/video_view.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../design/components/buttons.dart';
import '../../design/components/press.dart';
import '../../design/components/sheet.dart';
import '../../state/app_state.dart';
import '../common/top_bar.dart';
import 'report_sheet.dart';
import '../../l10n/strings.dart';

/// Post tafsiloti — to'liq media, tavsif, yoqtirish va ko'rish soni.
class PostDetailScreen extends StatefulWidget {
  const PostDetailScreen({super.key, required this.post, this.canDelete = false});
  final Post post;

  /// O'chirish tugmasi ko'rsatiladimi. Tugma bosilganda ekran
  /// `true` qaytarib yopiladi — O'CHIRISHNING O'ZI profil ekranida
  /// bajariladi (tasdiqlash oynasi va API chaqiruvi o'sha yerda,
  /// bir joyda).
  final bool canDelete;

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
              title: p.authorName.isEmpty ? tr('Post') : p.authorName,
              subtitle: p.createdAt == null ? null : _ago(p.createdAt!),
              // BEGONA postda — SHIKOYAT, o'zinikida — O'CHIRISH.
              //
              // Ilgari o'z postini o'chirishning YAGONA yo'li profil
              // to'ridagi katakni UZOQ BOSISH edi. Uni hech kim
              // topmasdi: ko'rinmaydigan harakat — yo'q funksiya
              // bilan barobar. Egasi aynan shu sababdan "rasmni
              // o'chirsam o'chmadi" deb xabar bergan.
              //
              // Uzoq bosish qoldirildi (tez yo'l), lekin endi
              // ko'rinadigan tugma ham bor.
              trailing: _isOwner(context, p)
                  ? (widget.canDelete
                      ? Press(
                          onTap: () => Navigator.of(context).pop(true),
                          child: Padding(
                            padding: const EdgeInsets.all(S.x8),
                            child: NIcon(Ico.trash, size: 20, color: C.signal),
                          ),
                        )
                      : null)
                  : Press(
                      onTap: () => _report(context, p),
                      child: const Padding(
                        padding: EdgeInsets.all(S.x8),
                        child: NIcon(Ico.flag, size: 20, color: C.ash),
                      ),
                    ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(S.gutter, 0, S.gutter, S.x32),
                children: [
                  AspectRatio(
                    aspectRatio: 4 / 5,
                    // VIDEO POST. Ilgari bu ekran faqat rasm
                    // ko'rsatardi: video postda `images` bo'sh
                    // bo'ladi va joy bo'm-bo'sh chiqardi.
                    child: (p.videoUrl ?? '').isNotEmpty
                        ? VideoView(
                            url: p.videoUrl!,
                            poster: p.images.isEmpty ? null : p.images.first,
                          )
                        : _Gallery(
                            images: images,
                            page: _page,
                            onPage: (i) => setState(() => _page = i),
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

/// Post MENIKIMI — shikoyat tugmasi faqat begonada chiqadi.
bool _isOwner(BuildContext context, Post p) {
  final code = p.authorCode.trim();
  if (code.isEmpty) return false;
  final state = AppScope.read(context);
  return state.ownsRecord(code) ||
      state.companies.any((c) => c.id.toUpperCase() == code.toUpperCase());
}

Future<void> _report(BuildContext context, Post p) async {
  final sent = await showReportSheet(
    context,
    targetKind: 'post',
    targetId: p.id,
    ownerCode: p.authorCode,
  );
  if (!sent || !context.mounted) return;
  await showSheet<void>(
    context,
    title: tr('Shikoyat yuborildi'),
    subtitle: tr('Moderator tekshiradi. Rahmat.'),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(S.gutter, S.x8, S.gutter, 0),
      child: SecondaryButton(tr('Yopish'),
          onTap: () => Navigator.of(context).pop()),
    ),
  );
}

/// Bir nechta rasmli post — suriladigan galereya va "2/5" hisoblagichi.
class _Gallery extends StatelessWidget {
  const _Gallery({required this.images, required this.page, required this.onPage});

  final List<String> images;
  final int page;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) => Stack(
        children: [
          PageView.builder(
            itemCount: images.length,
            onPageChanged: onPage,
            itemBuilder: (_, i) => NetImage(
              images[i].isEmpty ? null : images[i],
              slotLabel: tr('POST MEDIA 4:5'),
            ),
          ),
          if (images.length > 1)
            Positioned(
              right: S.x12,
              top: S.x12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: C.backdrop.withValues(alpha: .6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text('${page + 1}/${images.length}',
                    style: T.statusLabel.copyWith(color: C.offWhite)),
              ),
            ),
        ],
      );
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
