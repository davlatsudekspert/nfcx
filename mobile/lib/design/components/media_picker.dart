import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:image_picker/image_picker.dart';

import '../../data/api_client.dart';
import '../../data/repo.dart';
import '../tokens.dart';
import '../type.dart';
import 'buttons.dart';
import 'icons.dart';
import 'media.dart';
import 'press.dart';
import 'states.dart';
import '../../l10n/strings.dart';

/// RASM TANLASH VA YUKLASH MAYDONI.
///
/// NIMA UCHUN ALOHIDA KOMPONENT: avatar, muqova, logo va biznes
/// muqovasi — to'rt joyda AYNAN bir xil oqim. Har birini alohida
/// yozish ularning vaqt o'tib bir-biridan uzoqlashishiga olib
/// kelardi (birida xato ko'rsatiladi, boshqasida yo'q).
///
/// XULQ: rasm tanlanadi → DARHOL yuklanadi → natija `onUploaded`
/// orqali qaytadi. Yuklash saqlash tugmasiga qoldirilmaydi: aks
/// holda odam "Saqlash" ni bosgach o'n soniya kutib turardi va
/// nima bo'layotganini bilmasdi.
class MediaPickField extends StatefulWidget {
  const MediaPickField({
    super.key,
    required this.label,
    required this.repo,
    required this.onUploaded,
    this.url,
    this.aspect = 1,
    this.circle = false,
    this.hint,
  });

  final String label;
  final Repo repo;

  /// Yuklangan faylning ichki manzili (`/uploads/...`).
  final ValueChanged<String> onUploaded;

  /// Hozirgi rasm (to'liq manzil).
  final String? url;

  final double aspect;
  final bool circle;
  final String? hint;

  @override
  State<MediaPickField> createState() => _MediaPickFieldState();
}

class _MediaPickFieldState extends State<MediaPickField> {
  final _picker = ImagePicker();

  Uint8List? _preview;
  bool _busy = false;
  String? _error;

  Future<void> _pick() async {
    if (_busy) return;
    setState(() => _error = null);
    try {
      // O'lcham shu yerda chegaralanadi: telefon 4000px rasm beradi,
      // ekranda esa 1200px dan ortig'i ko'rinmaydi.
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 88,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _preview = bytes;
        _busy = true;
      });

      final url = await widget.repo.uploadMedia(bytes, contentType: _mime(file.name));
      if (!mounted) return;
      widget.onUploaded(url);
      setState(() => _busy = false);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        // Yuklanmagan rasm ko'rsatib turish yolg'on bo'lardi.
        _preview = null;
        _error = switch (e.key) {
          'too_large' => tr('Rasm juda katta.'),
          'bad_image' => tr('Bu fayl rasm emas.'),
          'too_many_requests' => tr('Juda ko‘p urinish. Birozdan keyin qayta urining.'),
          _ => humanError(e),
        };
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _preview = null;
        _error = humanError(e);
      });
    }
  }

  static String _mime(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.heic') || n.endsWith('.heif')) return 'image/heic';
    return 'image/jpeg';
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;
    final radius = widget.circle ? 999.0 : R.card;

    // XOTIRA CHEGARASI: katak 72–108px, rasm esa 1600px. Chegarasiz
    // dekodlash ~10 MB oladi va tahrirlash ekranida ikkita shunday
    // maydon bor.
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final image = preview != null
        ? Image.memory(
            preview,
            fit: BoxFit.cover,
            cacheWidth: ((widget.circle ? 72 : 108) * dpr).round(),
          )
        // Yozuvsiz: sarlavha allaqachon tepada turadi va katakda
        // takrorlansa, ikkita bir xil so'z yonma-yon chiqardi.
        : NetImage(widget.url, radius: 0, slotLabel: '');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label.toUpperCase(), style: T.eyebrow),
        const SizedBox(height: S.x8),
        Row(
          children: [
            Press(
              onTap: _busy ? null : _pick,
              child: SizedBox(
                width: widget.circle ? 72 : 108,
                height: widget.circle ? 72 : 108 / widget.aspect,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(radius),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: C.placeholder,
                          border: Border.all(color: C.warmHairline),
                          borderRadius: BorderRadius.circular(radius),
                        ),
                        child: image,
                      ),
                      // YUKLANAYOTGANI KO'RINSIN: rasm qorayadi va
                      // ustida aylana. Aks holda odam rasm allaqachon
                      // saqlangan deb o'ylardi.
                      if (_busy)
                        ColoredBox(
                          color: C.backdrop.withValues(alpha: .6),
                          child: const Center(child: Spinner(size: 20)),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 170,
                    child: SecondaryButton(
                      widget.url == null && preview == null ? tr('Tanlash') : tr('Almashtirish'),
                      height: 42,
                      icon: NIcon(Ico.image, size: 16, color: C.platinum),
                      onTap: _busy ? null : _pick,
                    ),
                  ),
                  if (widget.hint != null) ...[
                    const SizedBox(height: 6),
                    Text(widget.hint!, style: T.caption.copyWith(fontSize: 11)),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 6),
                    Text(_error!, style: T.caption.copyWith(fontSize: 11, color: C.signal)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}
