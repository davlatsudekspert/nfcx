import 'dart:async';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../route_watch.dart';
import '../tokens.dart';
import '../type.dart';
import 'buttons.dart';
import 'media.dart';
import '../../l10n/strings.dart';

/// VIDEO — istorya, post va Reels uchun.
///
/// NIMA UCHUN QO'SHILDI: server 2026-09 dan beri `videoUrl` ni
/// qaytaradi (istorya ham, post ham video bo'lishi mumkin), ilovada
/// esa video pleyer UMUMAN YO'Q edi. Natijada video istorya QORA
/// EKRAN bo'lib ochilardi: model `videoUrl` ni o'qirdi, lekin uni
/// chizadigan widget yo'q edi va ekran `imageUrl` ni (bo'sh satrni)
/// ko'rsatishga urinardi.
///
/// XULQ: o'zi boshlanadi, takrorlanadi, ovozi bor. Bu istorya uchun
/// odatiy: odam tugma qidirmaydi.
///
/// YIQILSA — QORA EKRAN EMAS. Video ochilmasa (formati
/// qo'llab-quvvatlanmasa, tarmoq uzilsa) muqova rasmi yoki aniq
/// yozuv ko'rsatiladi. Aynan shu holat oldin hech narsa aytmasdan
/// qora ekran berardi.
class VideoView extends StatefulWidget {
  const VideoView({
    super.key,
    required this.url,
    this.isLocalFile = false,
    this.poster,
    this.fit = BoxFit.cover,
    this.autoPlay = true,
    this.loop = true,
    this.active = true,
    this.onDuration,
  });

  final String url;

  /// `url` — qurilmadagi fayl yo'li (tarmoq manzili emas).
  /// Joylashdan OLDIN ko'rib chiqish uchun kerak.
  final bool isLocalFile;

  /// Video ochilguncha (va ochilmasa) ko'rsatiladigan rasm.
  final String? poster;

  final BoxFit fit;
  final bool autoPlay;
  final bool loop;

  /// Kadr HOZIR ko'rinyaptimi. Reels'da `PageView` qo'shni kadrlarni
  /// oldindan quradi — busiz ekranda bitta video turgani holda
  /// ikkitasining ovozi birdan eshitilardi.
  final bool active;

  /// Video ochilgach uning UZUNLIGI aytiladi.
  ///
  /// Istorya ko'ruvchisi buni kutadi: progress chizig'i qat'iy 5
  /// soniyaga sozlangan va usiz 30 soniyalik video beshinchi
  /// soniyada uzilib, keyingi istoryaga o'tib ketardi.
  final ValueChanged<Duration>? onDuration;

  @override
  State<VideoView> createState() => _VideoViewState();
}

class _VideoViewState extends State<VideoView>
    with WidgetsBindingObserver, RouteAware {
  /// Video ochilishini eng ko'p kutish.
  ///
  /// `initialize()` da MUDDAT YO'Q: manzil yetib bormasa, format
  /// qo'llab-quvvatlanmasa yoki server javob bermasa, u shunchaki
  /// HECH QACHON tugamaydi. Istisno ham chiqmaydi — ya'ni
  /// `try/catch` yordam bermaydi.
  ///
  /// Qurilmada "video istorya QORA EKRAN" holati aynan shu edi:
  /// video istoryada muqova rasmi bo'lmaydi, shuning uchun kutish
  /// ko'rinishi qoraygan fon va kichkina aylanuvchi belgidan iborat
  /// bo'lardi va u abadiy turardi.
  static const _openTimeout = Duration(seconds: 15);

  VideoPlayerController? _c;
  bool _ready = false;
  bool _failed = false;

  /// EKRAN USTIGA BOSHQA EKRAN OCHILGANMI.
  ///
  /// Reels'da muallif profiliga o'tilsa, Reels daraxtdan chiqmaydi —
  /// u yangi ekran ostida qolib o'ynashda davom etardi: ekranda
  /// boshqa sahifa, quloqda oldingi videoning ovozi. Egasi shuni
  /// xabar qildi.
  bool _covered = false;

  /// Ilova old planda turibdimi. Fonga o'tganda (boshqa ilova, ekran
  /// o'chishi, qo'ng'iroq) video ovozi davom etardi.
  bool _foreground = true;

  /// Qaysi kuzatuvchiga ulanganmiz — yopilganda aynan shundan
  /// uzilish uchun.
  RouteObserver<ModalRoute<void>>? _observer;

  /// Nima uchun ochilmagani. Odamga ko'rsatiladi: "ochib bo'lmadi"
  /// deb qo'yib qo'yish keyingi safar ham nima bo'lganini
  /// bilmaslikka olib keladi.
  String? _reason;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _open();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Kuzatuvchiga ulanish — har safar, chunki ekran boshqa
    // navigatorga ko'chishi mumkin. `unsubscribe` takroriy
    // obunani o'zi tozalaydi.
    final observer = RouteWatchScope.maybeOf(context);
    final route = ModalRoute.of(context);
    if (observer != null && route is ModalRoute<void>) {
      _observer?.unsubscribe(this);
      _observer = observer;
      observer.subscribe(this, route);
    }
    // `TickerMode` — tanlanmagan tab (`IndexedStack`) shu belgi
    // orqali "to'xtatilgan" deb aytiladi. U o'zgarganda shu
    // metod chaqiriladi, ya'ni pauza avtomatik ishlaydi.
    _sync();
  }

  /// Ustiga boshqa ekran ochildi.
  @override
  void didPushNext() {
    _covered = true;
    _sync();
  }

  /// Ustidagi ekran yopildi — qaytdik.
  @override
  void didPopNext() {
    _covered = false;
    _sync();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final fg = state == AppLifecycleState.resumed;
    if (fg == _foreground) return;
    _foreground = fg;
    _sync();
  }

  /// Video HOZIR o'ynashi kerakmi.
  bool get _shouldPlay => videoShouldPlay(
        active: widget.active,
        autoPlay: widget.autoPlay,
        covered: _covered,
        foreground: _foreground,
        tabVisible: TickerMode.valuesOf(context).enabled,
      );

  @override
  void didUpdateWidget(VideoView old) {
    super.didUpdateWidget(old);
    // Reels'da bitta widget qayta ishlatilishi mumkin — manzil
    // o'zgarsa eski video qolib ketmasin.
    if (old.url != widget.url || old.isLocalFile != widget.isLocalFile) {
      _c?.dispose();
      _c = null;
      _ready = false;
      _failed = false;
      _reason = null;
      _open();
      return;
    }
    if (old.active != widget.active) _sync();
  }

  /// Ko'rinmay qolganda video TO'XTAYDI va boshiga qaytadi: odam
  /// kadrga qaytganda uni o'rtasidan emas, boshidan ko'radi.
  void _sync() {
    final c = _c;
    if (c == null || !_ready) return;
    if (_shouldPlay) {
      c.play();
    } else {
      c.pause();
      c.seekTo(Duration.zero);
    }
  }

  Future<void> _open() async {
    final url = widget.url.trim();
    if (url.isEmpty) {
      setState(() {
        _failed = true;
        _reason = tr('Video manzili bo‘sh.');
      });
      return;
    }

    final uri = Uri.tryParse(url);
    if (uri == null) {
      setState(() {
        _failed = true;
        _reason = tr('Video manzili noto‘g‘ri.');
      });
      return;
    }

    final c = widget.isLocalFile
        ? VideoPlayerController.file(File(url))
        : VideoPlayerController.networkUrl(uri);
    _c = c;
    try {
      // MUDDAT BILAN. Usiz bu qator abadiy kutishi mumkin.
      await c.initialize().timeout(_openTimeout);
      if (!mounted) {
        await c.dispose();
        return;
      }
      await c.setLooping(widget.loop);
      if (_shouldPlay) await c.play();
      widget.onDuration?.call(c.value.duration);
      setState(() => _ready = true);
    } on TimeoutException {
      if (!mounted) return;
      setState(() {
        _failed = true;
        _reason = tr('Video juda sekin ochilyapti. Ulanishni tekshiring.');
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _failed = true;
        // Pleyerning o'z xabari qisqartirilgan holda ko'rsatiladi:
        // "format qo'llab-quvvatlanmaydi" bilan "tarmoq yo'q"
        // butunlay boshqa muammo va ularni ajratib bo'lmasa,
        // keyingi safar ham qorong'uda qolamiz.
        _reason = _shortError(e);
      });
    }
  }

  /// Pleyer xatosidan odam o'qiy oladigan qisqa sabab.
  static String _shortError(Object e) {
    final s = e.toString();
    if (s.contains('Source error') || s.contains('MEDIA_ERR_SRC')) {
      return tr('Bu video formati qo‘llab-quvvatlanmaydi.');
    }
    if (s.contains('SocketException') || s.contains('Failed host lookup')) {
      return tr('Internet aloqasi yo‘q. Ulanishni tekshiring.');
    }
    return tr('Videoni ochib bo‘lmadi.');
  }

  @override
  void dispose() {
    _observer?.unsubscribe(this);
    WidgetsBinding.instance.removeObserver(this);
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;

    if (_failed) {
      // SABAB HAR DOIM YOZILADI — muqova ustida ham.
      //
      // Ilgari muqova bo'lsa faqat u ko'rsatilardi va odam
      // videoning umuman ochilmaganini bilmasdi: u shunchaki
      // qimirlamaydigan rasmga qarab o'tirardi.
      final poster = (widget.poster ?? '').trim();
      return Stack(
        fit: StackFit.expand,
        children: [
          if (poster.isNotEmpty)
            NetImage(poster, radius: 0, fit: widget.fit, slotLabel: '')
          else
            ColoredBox(color: C.placeholder),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(S.gutter),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: C.backdrop.withValues(alpha: .72),
                  borderRadius: BorderRadius.circular(R.tile),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: S.x16, vertical: S.x12),
                  child: Text(
                    _reason ?? tr('Videoni ochib bo‘lmadi.'),
                    textAlign: TextAlign.center,
                    style: T.caption.copyWith(color: C.offWhite),
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }

    if (c == null || !_ready) {
      // Kutish paytida muqova ko'rinadi — ekran bo'sh qolmaydi.
      final poster = (widget.poster ?? '').trim();
      return Stack(
        fit: StackFit.expand,
        children: [
          if (poster.isNotEmpty)
            NetImage(poster, radius: 0, fit: widget.fit, slotLabel: '')
          else
            ColoredBox(color: C.placeholder),
          const Center(child: Spinner(size: 20)),
        ],
      );
    }

    return FittedBox(
      fit: widget.fit,
      clipBehavior: Clip.hardEdge,
      child: SizedBox(
        width: c.value.size.width,
        height: c.value.size.height,
        child: VideoPlayer(c),
      ),
    );
  }
}

/// VIDEO O'YNASHI KERAKMI — BARCHA SHARTLAR BITTA JOYDA.
///
/// Ilgari faqat [active] tekshirilardi va qolgan uchtasi "ovoz
/// davom etyapti" degan xatoning uch xil ko'rinishi bo'lgan:
///
///   • [tabVisible] — boshqa tabga o'tilsa. `IndexedStack`
///     ko'rinmayotgan tabni daraxtda qoldiradi va u ishlashda davom
///     etardi (egasi: "boshqa punktga o'tsam ham o'chmayapti");
///   • [covered] — ustiga boshqa ekran ochilsa (masalan Reels'dan
///     muallif profiliga o'tish);
///   • [foreground] — ilova fonga ketsa (boshqa ilova, ekran
///     o'chishi, qo'ng'iroq).
///
/// Alohida funksiya — testdan tekshirish uchun: bu mantiqni
/// haqiqiy pleyer bilan sinash qurilmasiz imkonsiz.
bool videoShouldPlay({
  required bool active,
  required bool autoPlay,
  required bool covered,
  required bool foreground,
  required bool tabVisible,
}) =>
    active && autoPlay && !covered && foreground && tabVisible;
