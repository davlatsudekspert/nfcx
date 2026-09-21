import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../design/tokens/nfc_tokens.dart';
import 'inline_video.dart';

/// MEDIA O'Z SHAKLIGA MOSLASHADI — KESILMAYDI, CHO'ZILMAYDI.
///
/// ## MUAMMO
///
/// Har ekran media uchun O'Z qutisini yozib qo'ygandi va ichiga
/// `BoxFit.cover` bergandi:
///
///   * lenta kartasi — `AspectRatio(4 / 3)`
///   * post tafsiloti — `AspectRatio(1)`
///   * istorya va Reels — butun ekran
///
/// `cover` quti nisbati bilan rasm nisbati mos kelmasa rasmni
/// KATTALASHTIRADI va ortig'ini KESADI. Tik (portret) rasm 4:3
/// qutida usti va osti bilan qirqilardi; kvadrat logotip esa butun
/// ekranni to'ldirishi uchun cho'zilib, hoshiyasi chiqib ketardi —
/// "katta bo'p ketyapti" aynan shu.
///
/// Ustiga ikki ekran ikki xil nisbatda edi: BITTA post lentada
/// boshqacha, ochilganda boshqacha ko'rinardi.
///
/// ## YECHIM
///
/// Ikki xil joy — ikki xil qoida, lekin ikkalasi ham SHU FAYLDA.
///
///   * Ro'yxat ichida (`AdaptiveMedia`): quti rasmning O'Z
///     nisbatiga moslashadi. Ya'ni kesish shart emas.
///   * Butun ekranda (`FullBleedMedia`): `contain` — hech narsa
///     kesilmaydi, bo'sh joy esa o'sha rasmning XIRALASHTIRILGAN
///     nusxasi bilan to'ldiriladi.

/// Eng tik ruxsat etilgan nisbat — 4:5.
///
/// Chegara kerak, chunki juda tik rasm (masalan 9:16 skrinshot)
/// lentada butun ekranni egallab olardi va undan keyingi post
/// umuman ko'rinmasdi.
const double kMediaAspectMin = 4 / 5;

/// Eng yotiq ruxsat etilgan nisbat — 16:9.
const double kMediaAspectMax = 16 / 9;

/// Nisbat hali noma'lum bo'lganda ishlatiladigan qiymat.
///
/// Kvadrat tanlangan: rasm kelgach quti o'zgaradi va sakrash eng
/// kichik bo'ladi, chunki kvadrat ikki chegaraning o'rtasida.
const double kMediaAspectFallback = 1.0;

/// Haqiqiy nisbatni ruxsat etilgan oraliqqa soladi.
double clampMediaAspect(double raw) {
  if (!raw.isFinite || raw <= 0) return kMediaAspectFallback;
  return raw.clamp(kMediaAspectMin, kMediaAspectMax);
}

/// Manzil ILOVA ICHIDAGI rasmmi.
///
/// Demo bo'limi tarmoqqa BOG'LIQ BO'LMASLIGI kerak: reklama
/// bo'limi internet sekin bo'lganda bo'sh kvadratlar ko'rsatsa,
/// u reklama emas, nuqson bo'lib ko'rinadi.
bool isAssetMedia(String url) => url.startsWith('assets/');

/// Rasmni chizadi — manba tarmoq ham, ilova ichi ham bo'lishi
/// mumkin. Ikkala yo'l BITTA joyda turadi, shuning uchun har bir
/// ekran buni qaytadan hal qilmaydi.
Widget mediaImage(
  BuildContext context,
  String url, {
  required BoxFit fit,
  Alignment alignment = Alignment.center,
}) {
  final t = context.tokens;
  Widget broken() => ColoredBox(
        color: t.surface2,
        child: Icon(Icons.broken_image_outlined, size: 30, color: t.text3),
      );
  if (isAssetMedia(url)) {
    return Image.asset(url,
        fit: fit, alignment: alignment, errorBuilder: (_, __, ___) => broken());
  }
  return CachedNetworkImage(
    imageUrl: url,
    fit: fit,
    alignment: alignment,
    placeholder: (_, __) => ColoredBox(color: t.surface2),
    errorWidget: (_, __, ___) => broken(),
  );
}

/// RO'YXAT ICHIDAGI MEDIA — quti mediaga moslashadi.
class AdaptiveMedia extends StatefulWidget {
  const AdaptiveMedia({
    super.key,
    required this.url,
    required this.isVideo,
    this.videoKey,
    this.autoPlayVideo = true,
    this.loopingVideo = false,
    this.tapToToggleVideo = false,
    this.borderRadius,
    this.lazyVideo = false,
    this.activeVideo,
  });

  final String url;
  final bool isVideo;
  final Key? videoKey;
  final bool autoPlayVideo;
  final bool loopingVideo;
  final bool tapToToggleVideo;
  final BorderRadius? borderRadius;

  /// Video kontrolleri faqat bosilganda qurilsinmi — ro'yxatlar
  /// uchun. `InlineVideo.lazy` ga uzatiladi.
  final bool lazyVideo;

  /// Ko'rinishga bog'liq ijro — `InlineVideo.active` ga uzatiladi.
  final bool? activeVideo;

  @override
  State<AdaptiveMedia> createState() => _AdaptiveMediaState();
}

class _AdaptiveMediaState extends State<AdaptiveMedia> {
  double _aspect = kMediaAspectFallback;
  ImageStream? _stream;
  ImageStreamListener? _listener;

  @override
  void initState() {
    super.initState();
    if (!widget.isVideo) _resolveImage();
  }

  @override
  void didUpdateWidget(AdaptiveMedia old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url || old.isVideo != widget.isVideo) {
      _drop();
      _aspect = kMediaAspectFallback;
      if (!widget.isVideo) _resolveImage();
    }
  }

  /// RASMNING HAQIQIY O'LCHAMINI SO'RAYDI.
  ///
  /// Rasm allaqachon keshda bo'lsa javob DARHOL keladi va quti
  /// to'g'ri nisbatda quriladi — sakrash ko'rinmaydi.
  void _resolveImage() {
    if (widget.url.isEmpty) return;
    final ImageProvider provider = isAssetMedia(widget.url)
        ? AssetImage(widget.url)
        : CachedNetworkImageProvider(widget.url);
    final stream = provider.resolve(ImageConfiguration.empty);
    final listener = ImageStreamListener(
      (info, _) {
        if (!mounted) return;
        final w = info.image.width.toDouble();
        final h = info.image.height.toDouble();
        if (h <= 0) return;
        final next = clampMediaAspect(w / h);
        if ((next - _aspect).abs() > 0.001) setState(() => _aspect = next);
      },
      // Xato YUTILADI: rasm kelmasa quti sukut nisbatida qoladi va
      // `errorWidget` o'z o'rnini egallaydi.
      onError: (_, __) {},
    );
    stream.addListener(listener);
    _stream = stream;
    _listener = listener;
  }

  void _drop() {
    final s = _stream;
    final l = _listener;
    if (s != null && l != null) s.removeListener(l);
    _stream = null;
    _listener = null;
  }

  @override
  void dispose() {
    _drop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final child = widget.isVideo
        ? InlineVideo(
            key: widget.videoKey,
            url: widget.url,
            autoPlay: widget.autoPlayVideo,
            looping: widget.loopingVideo,
            tapToToggle: widget.tapToToggleVideo,
            lazy: widget.lazyVideo,
            active: widget.activeVideo,
            // Quti videoning o'z nisbatiga kelganda `cover` hech
            // narsa kesmaydi; chegaraga urilgan holatda esa
            // kesish eng kichik bo'ladi.
            onAspect: (a) {
              if (!mounted) return;
              final next = clampMediaAspect(a);
              if ((next - _aspect).abs() > 0.001) {
                setState(() => _aspect = next);
              }
            },
          )
        : mediaImage(context, widget.url, fit: BoxFit.cover);

    final framed = AspectRatio(aspectRatio: _aspect, child: child);
    final r = widget.borderRadius;
    return r == null ? framed : ClipRRect(borderRadius: r, child: framed);
  }
}

/// BUTUN EKRANDAGI MEDIA — hech narsa kesilmaydi.
///
/// Orqa fon: o'sha rasmning xiralashtirilgan, kattalashtirilgan
/// nusxasi. Shu sabab kvadrat yoki yotiq media ham ekranni
/// to'ldirib ko'rinadi, lekin O'ZI kesilmaydi.
class FullBleedMedia extends StatelessWidget {
  const FullBleedMedia({
    super.key,
    required this.child,
    this.backdropUrl = '',
  });

  final Widget child;

  /// Xira fon uchun manba. Bo'sh bo'lsa (video) tekis fon
  /// ishlatiladi — videoni ikki marta dekodlash juda qimmat.
  final String backdropUrl;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Stack(
      fit: StackFit.expand,
      children: [
        ColoredBox(color: t.bg1),
        if (backdropUrl.isNotEmpty)
          ImageFiltered(
            imageFilter: ImageFilter.blur(sigmaX: 34, sigmaY: 34),
            child: mediaImage(context, backdropUrl, fit: BoxFit.cover),
          ),
        // Fon mazmunni yutib yubormasligi uchun qoraytiriladi.
        if (backdropUrl.isNotEmpty)
          ColoredBox(color: Colors.black.withValues(alpha: .35)),
        Center(child: child),
      ],
    );
  }
}
