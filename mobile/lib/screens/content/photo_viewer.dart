import 'package:flutter/widgets.dart';

import '../../design/components/media.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../common/top_bar.dart';
import '../../l10n/strings.dart';

/// GALEREYA RASMINI TO'LIQ KO'RISH.
///
/// NIMA UCHUN ALOHIDA: post tafsilotidagi ko'rgich yoqtirish, ko'rish
/// soni va izohga bog'liq — galereya rasmida bularning hech biri
/// yo'q. O'sha ekranni qayta ishlatsak, bo'sh raqamlar chiqardi.
class PhotoViewerScreen extends StatefulWidget {
  const PhotoViewerScreen({
    super.key,
    required this.images,
    this.initial = 0,
    this.title = '',
  });

  final List<String> images;
  final int initial;
  final String title;

  @override
  State<PhotoViewerScreen> createState() => _PhotoViewerScreenState();
}

class _PhotoViewerScreenState extends State<PhotoViewerScreen> {
  late final _controller = PageController(initialPage: widget.initial);
  late int _page = widget.initial;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.images.length;

    return ColoredBox(
      color: C.obsidian,
      child: SafeArea(
        child: Column(
          children: [
            TopBar(
              title: widget.title.isEmpty ? tr('Galereya') : widget.title,
              // Sanoq sarlavhada: rasm ustida turgan raqam
              // suratning o'zini to'sib qo'yardi.
              subtitle: total > 1 ? '${_page + 1} / $total' : null,
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: total,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) => Padding(
                  padding: const EdgeInsets.all(S.gutter),
                  child: Center(
                    child: NetImage(widget.images[i], fit: BoxFit.contain),
                  ),
                ),
              ),
            ),
            if (total > 1) ...[
              const SizedBox(height: S.x8),
              Text(tr('Chapga suring'), style: T.caption.copyWith(fontSize: 11)),
              const SizedBox(height: S.x16),
            ],
          ],
        ),
      ),
    );
  }
}
