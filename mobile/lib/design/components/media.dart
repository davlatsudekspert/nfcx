import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'skeleton.dart';

/// MEDIA — rasm har doim yumshoq paydo bo'ladi.
///
/// TEZLIK QOIDASI (dizayn 11c): kesh → skeleton → 240 ms xiralik.
/// Hech qayerda bo'sh oq ekran yoki joy sakrashi yo'q. Shu sababli:
///
/// • rasm kelmaguncha o'sha o'lchamdagi skeleton turadi;
/// • rasm kelganda 240 ms ichida ochiladi, darhol "otilib" chiqmaydi;
/// • `cacheWidth` HAR DOIM beriladi — aks holda 4000 px li rasm
///   to'liq dekodlanib, xotirani yeydi va lenta sakraydi.
class NetImage extends StatelessWidget {
  const NetImage(
    this.url, {
    super.key,
    this.radius = R.card,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.cacheWidth,
    this.slotIcon,
  });

  final String? url;
  final double radius;
  final BoxFit fit;
  final double? width;
  final double? height;

  /// Dekodlash kengligi (piksel). Berilmasa widget kengligidan
  /// hisoblanadi.
  final int? cacheWidth;

  /// Rasm yo'q bo'lganda ko'rinadigan belgi.
  final Ico? slotIcon;

  @override
  Widget build(BuildContext context) {
    final u = url?.trim() ?? '';
    if (u.isEmpty) {
      return MediaSlot(radius: radius, icon: slotIcon, width: width, height: height);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: LayoutBuilder(
        builder: (context, box) {
          final dpr = MediaQuery.maybeDevicePixelRatioOf(context) ?? 3;
          final logical = box.hasBoundedWidth ? box.maxWidth : (width ?? 400);
          final decode = cacheWidth ?? (logical * dpr).round().clamp(64, 2048);

          return CachedNetworkImage(
            imageUrl: u,
            width: width ?? double.infinity,
            height: height,
            fit: fit,
            memCacheWidth: decode,
            fadeInDuration: M.image,
            fadeOutDuration: M.fade,
            placeholder: (context, _) => Skeleton(
              width: double.infinity,
              height: height ?? double.infinity,
              radius: radius,
            ),
            errorWidget: (context, _, __) => MediaSlot(
              radius: radius,
              icon: slotIcon ?? Ico.image,
              width: width,
              height: height,
            ),
          );
        },
      ),
    );
  }
}

/// Rasm o'rni — media yo'q yoki kelmadi.
///
/// Bo'sh kulrang to'rtburchak emas: yuzada nozik gradient va
/// markazida belgi bor, shunda u "buzilgan" emas, "bo'sh"
/// ko'rinadi.
class MediaSlot extends StatelessWidget {
  const MediaSlot({
    super.key,
    this.radius = R.card,
    this.icon,
    this.label,
    this.width,
    this.height,
  });

  final double radius;
  final Ico? icon;
  final String? label;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) => Container(
        width: width ?? double.infinity,
        height: height,
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(color: C.line),
        ),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null)
              NIcon(icon!, size: 22, color: C.ink3.withValues(alpha: .7)),
            if (label != null) ...[
              const SizedBox(height: 6),
              Text(label!, style: T.meta),
            ],
          ],
        ),
      );
}

/// AVATAR — 5 o'lcham: 28 / 36 / 44 / 56 / 72.
///
/// Rasm bo'lmasa ismning bosh harflari ko'rsatiladi. Bu bo'sh
/// doiradan yaxshiroq: foydalanuvchi kimligini baribir taniydi.
class Avatar extends StatelessWidget {
  const Avatar({
    super.key,
    this.url,
    this.name = '',
    this.size = 44,
    this.square = false,
  });

  final String? url;
  final String name;
  final double size;

  /// Biznes profilida logotip KVADRAT (radius 24) — shaxsiy
  /// profildagi dumaloq avatardan farqlanishi uchun. Bu dizaynning
  /// aniq qoidasi.
  final bool square;

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '';
    if (parts.length == 1) {
      return parts.first.characters.take(1).toString().toUpperCase();
    }
    return parts
        .take(2)
        .map((p) => p.characters.take(1).toString())
        .join()
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final radius = square ? size * .3 : size / 2;
    final u = url?.trim() ?? '';

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: C.raisedSurface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: C.line),
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: u.isEmpty
          ? Text(
              _initials,
              style: TextStyle(
                fontFamily: 'PlayfairDisplay',
                fontSize: size * .40,
                height: 1,
                color: C.accent.withValues(alpha: .85),
              ),
            )
          : NetImage(u, radius: radius, width: size, height: size),
    );
  }
}

// ─────────────────────────────────────────────────────────────
// RASM O'Z NISBATIDA
// ─────────────────────────────────────────────────────────────

/// RASMNI QIRQMASDAN KO'RSATADI.
///
/// MUAMMO: lentadagi rasm qat'iy 4:3 ramkaga solinardi va `cover`
/// bilan qirqilardi. Odamlarning rasmi esa ko'pincha TIK (telefon
/// kamerasi 3:4 yoki 9:16 beradi) — natijada boshi ham, pastki
/// yozuvi ham kadrdan chiqib ketardi. Egasining bahosi: "razmer
/// ekranga mos bo'lib ko'rinsin".
///
/// YECHIM: ramka RASMGA moslashadi, rasm ramkaga emas. Rasmning
/// haqiqiy o'lchami tarmoqdan kelganda o'qiladi va ramka yumshoq
/// (240ms) shunga o'tadi.
///
/// CHEGARA BOR: juda cho'zilgan rasm (masalan 1:4 skrinshot) butun
/// ekranni egallab, lentani to'sib qo'yardi. Shuning uchun nisbat
/// [minAspect] va [maxAspect] orasida ushlab turiladi — bunday
/// kamdan-kam rasm chetidan ozgina qirqiladi, qolgan hammasi
/// butunligicha ko'rinadi.
///
/// SAKRASH YO'Q: rasm kelguncha ramka [fallback] nisbatida turadi
/// va o'zgarish animatsiya bilan bo'ladi, ya'ni lenta "sakramaydi".
class AutoImage extends StatefulWidget {
  const AutoImage(
    this.url, {
    super.key,
    this.radius = R.tile,
    this.fallback = 4 / 5,
    this.minAspect = .62,
    this.maxAspect = 1.78,
    this.slotIcon,
  });

  final String? url;
  final double radius;

  /// O'lcham ma'lum bo'lmaguncha ishlatiladigan nisbat.
  final double fallback;

  /// Eng tik va eng yotiq ruxsat etilgan nisbat.
  final double minAspect;
  final double maxAspect;

  final Ico? slotIcon;

  @override
  State<AutoImage> createState() => _AutoImageState();
}

/// BIR MARTA O'LCHANGAN NISBAT — URL bo'yicha eslab qolinadi.
///
/// LENTA TEPAGA SURILGANDA "DIRILLARDI". Sabab shu yerda edi:
/// `_aspect` HAR SAFAR `fallback` (4/5) dan boshlanardi va rasm
/// o'lchami aniqlangach o'zgarardi.
///
/// Pastga surganda bu sezilmaydi — yangi kartalar ko'z ostida
/// paydo bo'ladi va ularning balandligi o'zgarishi ko'rilayotgan
/// joyni qimirlatmaydi. TEPAGA surganda esa ro'yxatdan chiqib
/// ketgan kartalar qaytadan quriladi: har biri avval 4/5 bo'lib,
/// keyin o'z nisbatiga sakraydi. Ya'ni ko'z oldidagi kontentdan
/// YUQORIDAGI balandlik o'zgarib turadi va ro'yxat surilgan joyni
/// o'ziga tortadi — egasi buni "tepaga tortsam dirillab tortilmayapti"
/// deb aytdi.
///
/// Endi bir marta o'lchangan nisbat shu yerda qoladi va karta
/// qaytadan qurilganda DARHOL to'g'ri balandlikda chiziladi.
/// Xotira uchun arzon: URL va bitta son.
final Map<String, double> _aspectMemo = <String, double>{};

class _AutoImageState extends State<AutoImage> {
  late double _aspect = _remembered ?? widget.fallback;

  /// Shu URL uchun nisbat allaqachon o'lchanganmi.
  double? get _remembered => _aspectMemo[(widget.url ?? '').trim()];

  ImageStream? _stream;
  ImageStreamListener? _listener;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(AutoImage old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url) {
      _drop();
      // Yangi URL uchun ham avval xotiraga qaraymiz: shu rasm
      // ilgari ko'rilgan bo'lsa sakrash umuman bo'lmaydi.
      _aspect = _remembered ?? widget.fallback;
      _resolve();
    }
  }

  void _resolve() {
    final url = (widget.url ?? '').trim();
    if (url.isEmpty) return;
    final listener = ImageStreamListener((info, _) {
      if (!mounted) return;
      final w = info.image.width.toDouble();
      final h = info.image.height.toDouble();
      if (w <= 0 || h <= 0) return;
      final next = (w / h).clamp(widget.minAspect, widget.maxAspect);
      // Keyingi safar shu karta qaytadan qurilganda sakramasin.
      _aspectMemo[url] = next;
      if ((next - _aspect).abs() < .001) return;
      setState(() => _aspect = next);
    });
    // `CachedNetworkImageProvider` — `NetImage` bilan BIR XIL manba,
    // ya'ni rasm ikki marta yuklanmaydi: o'lcham keshdan o'qiladi.
    final stream = CachedNetworkImageProvider(url).resolve(
      ImageConfiguration.empty,
    );
    stream.addListener(listener);
    _stream = stream;
    _listener = listener;
  }

  void _drop() {
    if (_stream != null && _listener != null) {
      _stream!.removeListener(_listener!);
    }
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
    final image = NetImage(
      widget.url,
      radius: widget.radius,
      slotIcon: widget.slotIcon,
    );

    if (reduceMotion(context)) {
      return AspectRatio(aspectRatio: _aspect, child: image);
    }

    // NISBATNING O'ZI ANIMATSIYA QILINADI.
    //
    // `AnimatedContainer` bu yerda yordam bermaydi: u o'lchamni emas,
    // O'Z bezagini animatsiya qiladi, ichidagi `AspectRatio` esa
    // bir kadrda sakrab o'zgarardi. `TweenAnimationBuilder` qiymatni
    // silliq suradi va ramka yumshoq ochiladi.
    return TweenAnimationBuilder<double>(
      // `begin` — faqat BIRINCHI qurishda ishlatiladi; keyin
      // `end` o'zgarganda joriy qiymatdan yangisiga suriladi.
      tween: Tween<double>(begin: widget.fallback, end: _aspect),
      duration: M.fade,
      curve: M.curve,
      builder: (context, value, child) =>
          AspectRatio(aspectRatio: value, child: child),
      child: image,
    );
  }
}
