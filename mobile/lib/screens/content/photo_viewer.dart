import 'package:flutter/widgets.dart';

import '../../design/components/buttons.dart';
import '../../design/components/icons.dart';
import '../../design/components/media.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';

/// GALEREYA RASMINI TO'LIQ KO'RISH.
///
/// NIMA UCHUN ALOHIDA EKRAN: post tafsilotidagi ko'rgich yurak va
/// ko'rishlar soniga bog'liq — galereya rasmida bularning hech biri
/// yo'q. O'sha ekranni qayta ishlatsak, bo'sh raqamlar chiqardi.
/// Shu sababli bu yerda YURAK HAM, "⋯" MENYUSI HAM YO'Q: bu faqat
/// ko'rgich.
///
/// FON QORA VA BOSHQARUV SHISHA: rasm yagona kontent bo'lgani uchun
/// atrofdagi hamma narsa undan chekinadi. Yopish tugmasi va
/// hisoblagich rasm ustida "suzib" turadi.
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
  late final int _start =
      widget.images.isEmpty ? 0 : widget.initial.clamp(0, widget.images.length - 1);
  late final PageController _controller = PageController(initialPage: _start);
  late int _page = _start;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.images.length;

    return ColoredBox(
      color: C.backdrop,
      child: Stack(
        children: [
          Positioned.fill(
            child: PageView.builder(
              controller: _controller,
              itemCount: total,
              onPageChanged: (i) => setState(() => _page = i),
              // CHIMDIB KATTALASHTIRISH. Hujjat, chek yoki menyu
              // suratida mayda yozuv bo'ladi va uni o'qish uchun
              // rasmni yaqinlashtirish SHART.
              itemBuilder: (_, i) => InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                child: Padding(
                  padding: const EdgeInsets.all(S.gutter),
                  child: NetImage(
                    widget.images[i],
                    radius: 0,
                    fit: BoxFit.contain,
                    slotIcon: Ico.image,
                  ),
                ),
              ),
            ),
          ),

          // BOSHQARUV QATORI — yopish va hisoblagich.
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: S.x12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  RoundButton(
                    Ico.close,
                    glass: true,
                    onTap: () => Navigator.of(context).pop(),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: S.x12),
                      child: Column(
                        children: [
                          if (total > 1)
                            Text(
                              '${_page + 1} / $total',
                              // Fon HAR DOIM quyuq (`C.backdrop`) —
                              // rasm o'z rangida ko'rinsin uchun.
                              // Demak matn ham har doim oq.
                              style: T.statusLabel.copyWith(color: C.onMedia),
                            ),
                          if (widget.title.trim().isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(
                              widget.title,
                              style: T.caption.copyWith(color: C.onMedia2),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  // Hisoblagich AYNAN o'rtada tursin — o'ngda
                  // yopish tugmasi bilan bir xil bo'shliq.
                  const SizedBox(width: S.tap, height: S.tap),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
