import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../design/tokens/nfc_tokens.dart';
import '../profile/music_player.dart';

/// Ichki video chizuvchi — istorya va post uchun BITTA joyda.
///
/// ## NIMA UCHUN KERAK BO'LDI
///
/// `Post.isVideo` ham, `StoryItem.isVideo` ham model tomonidan
/// TO'G'RI o'qilardi, lekin ekranlarning BIRORTASI ularni
/// ishlatmasdi: hamma narsa `CachedNetworkImage` bilan chizilardi.
///
/// Ya'ni video post ham, video istorya ham QO'YISH mumkin edi
/// (kompozitor `videoUrl` ni qabul qiladi va server saqlaydi), lekin
/// ko'rgan odam faqat siniq rasm belgisini ko'rardi. Hech qanday
/// xato chiqmasdi — `errorWidget` jimgina o'rnini egallardi.
///
/// ## KONTROLLER UMRI
///
/// Kontroller SHU vidjetga bog'langan. Ota-ekranda saqlansa, element
/// almashganda eski video dekoder va bufer xotirasini ushlab
/// qolardi. `ValueKey` bilan Flutter eski holatni tashlaydi, yangisi
/// quriladi, eskisi esa `dispose` da yopiladi.
///
/// ## OVOZ EGALIGI
///
/// Video ovoz chiqaradi, demak u audio EGASI bo'ladi. Shu paytda
/// profil musiqasi ijro etilayotgan bo'lsa — to'xtaydi. Reels'dagi
/// bilan bir xil qoida: ikki manba bir vaqtda ovoz chiqarmaydi.
///
/// ## DANGASA OCHILISH (`lazy: true`)
///
/// Kontroller UMUMAN qurilmaydi — odam bosmaguncha. Lentada
/// beshta video post bo'lsa, ilgari beshta dekoder ochilib,
/// beshta tarmoq so'rovi ketardi; ekranda esa hech biri
/// o'ynamasdi.
///
/// `autoPlay: false` BILAN BIR XIL EMAS, ataylab. Profil
/// panjarasi `autoPlay: false` ni POSTER sifatida ishlatadi:
/// kontroller ochiladi va birinchi kadr ko'rinadi, lekin
/// o'ynamaydi. Dangasa rejim uni kulrang qutiga aylantirib
/// qo'yardi — shuning uchun bayroq ALOHIDA va standarti
/// `false`: mavjud joylarning birortasi ham o'zgarmaydi.
///
/// Bu O'zbekistonda ayniqsa muhim: mobil internet qimmat va
/// ko'rilmagan video uchun trafik sarflash — odamning pulini
/// so'ramasdan ishlatish.
///
/// ## ILOVA FONGA KETGANDA
///
/// `WidgetsBindingObserver` orqali to'xtatiladi. Ilgari bu yerda
/// u YO'Q edi: `story_viewer.dart` va `music_player.dart` fonni
/// kuzatardi, ichki video esa yo'q — ya'ni lentadagi video
/// o'ynayotganda telefon boshqa ilovaga o'tsa, OVOZ DAVOM
/// ETARDI.
class InlineVideo extends ConsumerStatefulWidget {
  const InlineVideo({
    super.key,
    required this.url,
    this.autoPlay = true,
    this.looping = false,
    this.onDuration,
    this.onFailed,
    this.tapToToggle = false,
    this.fit = BoxFit.cover,
    this.onAspect,
    this.lazy = false,
    this.active,
  });

  final String url;
  final bool autoPlay;
  final bool looping;

  /// Uzunlik ma'lum bo'lgach chaqiriladi (istoryada progress shunga
  /// moslanadi).
  final ValueChanged<Duration>? onDuration;

  /// Video ochilmadi (buzuq havola, format, tarmoq). Istoryada taymer
  /// shu zahoti oddiy vaqt bilan davom etadi — ko'ruvchi kutib qolmaydi.
  final VoidCallback? onFailed;

  /// Postda: bosish ijro/pauza. Istoryada bosish keyingisiga
  /// o'tkazadi, shuning uchun u yerda YOQILMAYDI.
  final bool tapToToggle;

  /// Videoni qutiga qanday joylash.
  ///
  /// Ro'yxatda quti videoning nisbatiga moslanadi, shuning uchun
  /// `cover` hech narsa kesmaydi. Butun ekranda esa `contain`
  /// beriladi: yotiq video kesilib ketmasligi kerak.
  final BoxFit fit;

  /// Video o'lchami ma'lum bo'lgach chaqiriladi (kenglik/balandlik).
  ///
  /// Shusiz quti videoning haqiqiy shaklini BILMAYDI va oldindan
  /// yozib qo'yilgan nisbatga majburlaydi.
  final ValueChanged<double>? onAspect;

  /// Kontroller FAQAT bosilganda qurilsinmi.
  ///
  /// Ro'yxatlar uchun. `autoPlay: false` dan farqi yuqorida.
  final bool lazy;

  /// KO'RINISHGA BOG'LIQ IJRO (Instagram uslubi).
  ///
  /// `null` — bu rejim o'chiq, ijroni odam boshqaradi (eski xulq,
  /// istorya va post tafsiloti shunday qoladi).
  ///
  /// `true` — bu video hozir lentaning DOMINANT elementi: ochilib
  /// ijro etiladi. `false` — ekrandan chiqdi yoki boshqasi
  /// dominant bo'ldi: darhol to'xtaydi.
  ///
  /// Kimning ovozi chiqishini baribir `AudioOwner` hal qiladi —
  /// bu yerda parallel tizim YO'Q. Ko'rinish ulushini lentaning
  /// o'zi o'lchaydi (`VisibleFraction`) va faqat BITTA kartaga
  /// `true` beradi.
  final bool? active;

  @override
  ConsumerState<InlineVideo> createState() => _InlineVideoState();
}

class _InlineVideoState extends ConsumerState<InlineVideo>
    with WidgetsBindingObserver {
  VideoPlayerController? _c;
  bool _ready = false;
  bool _failed = false;

  /// Kontroller ochilishi BOSHLANGANMI.
  ///
  /// `_ready` dan farq qiladi: ochilish boshlangan, lekin hali
  /// tugamagan oraliq bor. Ikkinchi bosish o'sha oraliqda kelsa,
  /// ikkinchi kontroller qurilib, birinchisi yetim qolardi.
  bool _opening = false;

  /// Vidjet o'chirilgan — `_open()` ning har bir `await` idan keyin
  /// tekshiriladi.
  ///
  /// NIMA UCHUN `mounted` YETARLI EMAS: `_open()` ichida bir nechta
  /// `await` bor va ular orasida ekran yopilishi mumkin. Ilgari
  /// faqat BITTA joyda `mounted` tekshirilardi, shuning uchun
  /// istorya yuklanayotganda X bosilsa, keyin `play()` ALLAQACHON
  /// o'chirilgan kontrollerda chaqirilardi va ovoz ekran
  /// yopilganidan keyin ham davom etardi.
  bool _gone = false;

  /// Ovoz egaligi reyestri — `initState` DA olinadi.
  ///
  /// `dispose()` ichida `ref` ni ishlatib bo'lMAYDI: Riverpod
  /// "Cannot use ref after the widget was disposed" istisnosini
  /// tashlaydi. Ilgari `dispose()` aynan shu chaqiruvdan
  /// BOSHLANARDI, ya'ni istisno undan keyingi qatorlarni —
  /// `setVolume(0)`, `pause()` va `dispose()` ni — BUTUNLAY
  /// ishlamay qoldirardi.
  ///
  /// Natija: video kontrolleri hech qachon yopilmasdi va istorya
  /// ekrani ketganidan keyin ham OVOZ DAVOM ETARDI. APK #48 dagi
  /// tuzatish ishlamaganining sababi ham shu — `setVolume(0)`
  /// istisnodan KEYIN turgan edi.
  AudioOwner? _owner;

  @override
  void initState() {
    super.initState();
    // `ref.read` `initState` da ruxsat etilgan; reyestr konteyner
    // bilan yashaydi, ya'ni vidjetdan uzoq umr ko'radi.
    _owner = ref.read(audioOwnerProvider);
    WidgetsBinding.instance.addObserver(this);
    // Dangasa rejimda kontroller ham, tarmoq so'rovi ham odam
    // bosmaguncha YO'Q. Boshqa hamma holatda — avvalgidek.
    if (widget.active == true) {
      _openAndPlay();
    } else if (!widget.lazy && widget.active == null) {
      _open();
    }
  }

  /// Dominantlik o'zgardi — ijro etiladi yoki to'xtatiladi.
  @override
  void didUpdateWidget(covariant InlineVideo old) {
    super.didUpdateWidget(old);
    if (widget.active == old.active) return;
    if (widget.active == true) {
      _openAndPlay();
    } else if (widget.active == false) {
      _release();
    }
  }

  /// LENTADA DOMINANTLIKNI YO'QOTDI — pleer TO'LIQ yopiladi.
  ///
  /// Ilgari faqat pauza qilinardi: lentada 5 ta video bo'lsa, bittasi
  /// ko'rilgandan keyin ham uning pleeri (dekoder va bufer) Home tabi
  /// yashirin turganda ham xotirada qolaverardi. Telefonda bu qotish
  /// edi. Instagram ham ekrandan chiqqan videoni yopadi; qaytganda
  /// qayta ochiladi.
  void _release() {
    final c = _c;
    _c = null;
    _ready = false;
    _opening = false;
    c?.setVolume(0);
    c?.pause();
    c?.dispose();
    _owner?.release(this);
    if (mounted) setState(() {});
  }

  /// Ochish + ovoz egaligini olish + ijro.
  ///
  /// Egalik `take()` orqali olinadi, ya'ni AVVALGI manba (boshqa
  /// video yoki profil musiqasi) darhol to'xtaydi. Bir vaqtda
  /// bitta ovoz qoidasi shu bitta joyda saqlanadi.
  Future<void> _openAndPlay() async {
    _owner?.take(this, _pauseForOther);
    if (_c == null) {
      await _open();
    }
    final c = _c;
    if (c == null || _gone || !mounted) return;
    // Dominantlik `_open()` davomida o'zgargan bo'lishi mumkin.
    if (widget.active == false) return;
    await c.setVolume(1);
    await c.play();
    if (mounted) setState(() {});
  }

  /// ILOVA FONGA KETDI — video to'xtaydi.
  ///
  /// `story_viewer.dart` va `music_player.dart` buni allaqachon
  /// qiladi; ichki video esa qilmasdi va telefon boshqa ilovaga
  /// o'tganda ovoz davom etardi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      _pauseForOther();
      return;
    }
    // QAYTGANDA YASHIRIN VIDEO O'ZI BOSHLANMAYDI.
    //
    // Faqat hozir dominant bo'lgan karta qayta baholanadi.
    // Ekrandan chiqib ketgan videoning `active` i `false`, ya'ni
    // u jim qoladi.
    // Yashirin tabda (Home ko'rinmayotganda) ham boshlanmaydi.
    if (widget.active == true && TickerMode.of(context)) _openAndPlay();
  }

  Future<void> _open() async {
    // Ikki marta ochilmasin: birinchi kontroller yetim qolardi va
    // uni hech kim yopmasdi.
    if (_opening || _c != null) return;
    _opening = true;
    final c = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    _c = c;
    // `_release()` ochilish davomida chaqirilsa, bu kontroller
    // endi "eski" — u allaqachon yopilgan.
    bool stale() => !identical(_c, c);
    try {
      await c.initialize();
      if (stale()) return;
      if (_gone || !mounted) {
        await c.dispose();
        return;
      }
      await c.setLooping(widget.looping);
      if (_gone) {
        await c.dispose();
        return;
      }
      if (widget.autoPlay) {
        _owner?.take(this, _pauseForOther);
        await c.play();
        // Ijro buyrug'i ketgandan keyin ham tekshiriladi: aynan shu
        // oraliqda yopilsa ovoz ortda qolib ketardi.
        if (_gone) {
          await c.dispose();
          return;
        }
      }
      if (!mounted) {
        await c.dispose();
        return;
      }
      setState(() => _ready = true);
      widget.onDuration?.call(c.value.duration);
      // Shakl SHU YERDA ma'lum bo'ladi — oldin emas. Ota-vidjet
      // qutini shunga moslaydi.
      final size = c.value.size;
      if (size.height > 0) {
        widget.onAspect?.call(size.width / size.height);
      }
    } catch (_) {
      // Yopilgan (eski) kontrollerning xatosi — video buzuq emas.
      if (stale()) return;
      // Buzuq havola yoki qo'llab-quvvatlanmaydigan format — ilova
      // qulamaydi, o'rnida fon qoladi.
      if (mounted) setState(() => _failed = true);
      widget.onFailed?.call();
    }
  }

  /// Boshqa manba ovoz egaligini oldi — yoki ekran yopilmoqda.
  ///
  /// OVOZ AVVAL o'chiriladi: `pause()` platformaga xabar yuboradi
  /// va u bajarilguncha ovoz eshitilib turardi.
  void _pauseForOther() {
    _c?.setVolume(0);
    _c?.pause();
    if (mounted) setState(() {});
  }

  Future<void> _toggle() async {
    // Dangasa rejim: birinchi bosishda kontroller endi quriladi.
    if (widget.lazy && _c == null && !_failed) {
      _owner?.take(this, _pauseForOther);
      await _open();
      final opened = _c;
      if (opened != null && !_gone && mounted) {
        await opened.setVolume(1);
        await opened.play();
        if (mounted) setState(() {});
      }
      return;
    }
    final c = _c;
    if (c == null || !_ready) return;
    if (c.value.isPlaying) {
      await c.pause();
    } else {
      _owner?.take(this, _pauseForOther);
      await c.setVolume(1);
      await c.play();
    }
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _gone = true;
    WidgetsBinding.instance.removeObserver(this);
    final c = _c;
    _c = null;
    // KONTROLLER BIRINCHI YOPILADI. Bu yerda hech narsa undan
    // oldin turmasligi kerak: oldin turgan har qanday chaqiruv
    // istisno tashlasa, video yopilmay qolardi.
    c?.setVolume(0);
    c?.pause();
    c?.dispose();
    _owner?.release(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final c = _c;
    if (_failed) {
      return ColoredBox(
        color: t.surface2,
        child: Icon(Icons.videocam_off_rounded, size: 30, color: t.text3),
      );
    }
    // HALI OCHILMAGAN (dangasa rejim) — bosish taklifi ko'rinadi.
    //
    // Bo'sh kulrang quti "yuklanmadi" degan taassurot qoldirardi;
    // aslida video joyida va bir bosishda ochiladi.
    if (c == null && widget.lazy) {
      return GestureDetector(
        onTap: _toggle,
        behavior: HitTestBehavior.opaque,
        child: ColoredBox(
          color: t.surface2,
          child: Center(
            child: Icon(Icons.play_circle_fill_rounded,
                size: 54, color: t.text1.withValues(alpha: .85)),
          ),
        ),
      );
    }
    if (!_ready || c == null) {
      return ColoredBox(color: t.surface2);
    }
    // BIRINCHI KADR YUMSHOQ OCHILADI.
    //
    // Ilgari video tayyor bo'lgan zahoti `ColoredBox` o'rniga
    // BIR ZUMDA paydo bo'lardi — Reels'da bir sahifadan
    // ikkinchisiga o'tganda bu chaqnash bo'lib sezilardi.
    //
    // 220 ms — ko'z sezadigan, lekin kutishga aylanmaydigan
    // eng qisqa oraliq. Ovoz va o'ynash mantig'iga tegilmadi:
    // bu FAQAT chizish.
    final video = TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOut,
      builder: (_, v, child) => Opacity(opacity: v, child: child),
      child: FittedBox(
        fit: widget.fit,
        child: SizedBox(
          width: c.value.size.width,
          height: c.value.size.height,
          child: VideoPlayer(c),
        ),
      ),
    );
    if (!widget.tapToToggle) return video;
    return GestureDetector(
      onTap: _toggle,
      child: Stack(
        fit: StackFit.expand,
        children: [
          video,
          if (!c.value.isPlaying)
            const Center(
              child: Icon(Icons.play_circle_fill_rounded,
                  size: 54, color: Colors.white),
            ),
        ],
      ),
    );
  }
}
