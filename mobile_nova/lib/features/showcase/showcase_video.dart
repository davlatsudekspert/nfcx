import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import '../../core/utils/external_link.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/shapes.dart';
import '../../l10n/gen/app_localizations.dart';
import '../profile/music_player.dart' show AudioOwner, audioOwnerProvider;
import 'showcase_common.dart';
import 'showcase_fullscreen.dart';

/// KO'RGAZMA VIDEOSI — YouTube'ning RASMIY pleeri ilova ichida.
///
/// Egasi (build 329): "YouTube'da ochish" o'rniga "Videoni ko'rish" —
/// video ilovadan chiqmasdan ko'riladi. YouTube API qoidalari:
///
/// * ijro FAQAT odam "Videoni ko'rish" ni O'ZI bosgandan keyin
///   boshlanadi (egasi, build 330: "ochilyapti, o'ynab ketmayapti").
///   Bu — uning harakati davomi, `music_embed.dart` dagi bilan bir xil
///   asos: `autoplay:1`, zaxira sifatida `onReady` da `playVideo()`,
///   iOS'da `mediaTypesRequiringUserAction` bo'sh, Android'da
///   `setMediaPlaybackRequiresUserGesture(false)`. Ovoz o'chirilmaydi.
///   Uni ochmasdan (lentada, ko'rgazma sahifasida) hech narsa
///   o'zi o'ynamaydi;
/// * BUTUN EKRANDA ochiladi (egasi, TestFlight 331: "silkani bosganda
///   avto to'liq ochilmayapti"): qora sahifa, pleer qolgan joyni
///   to'ldiradi — Shorts (9:16) bo'yini, oddiy (16:9) enini, markazda
///   (`showcase_fullscreen.dart`);
/// * pleer ustida hech narsa yo'q (yopish tugmasi va "YouTube'da ochish"
///   havolasi pleerdan TASHQARIDA — tepada va pastda);
/// * o'lcham kamida 200×200;
/// * ilova kimligi: sahifa `https://nfcstore.uz/` bazasi bilan yuklanadi
///   (Referer), `origin` va `widget_referrer` — `music_embed.dart` bilan
///   bir xil yo'l;
/// * fonda ijro YO'Q — sahifa yopilsa ("×", pastga surish, "orqaga")
///   yoki ilova fonga o'tsa pleer yo'q qilinadi (qaytilganda qaytadan
///   quriladi).
///
/// Video joylashtirishni taqiqlagan bo'lsa (xato 101/150), yuklanmasa
/// yoki pleer javob bermasa — pleer o'rnida "YouTube'da ochish".

/// WebView yuklashi BEKOR QILINDI (xato emas): iOS `NSURLErrorCancelled`
/// (-999) va WebKit "frame load interrupted" (102) — masalan, sahifa
/// bo'shatilganda yoki tashqi havola to'xtatilganda. Bular zaxira
/// panelni ko'rsatmaydi. Android kodlari manfiy va kichik — to'qnashmaydi.
bool webLoadCancelled(WebResourceError e) =>
    e.errorCode == -999 || e.errorCode == 102;

/// YouTube pleeri WebView'idagi o'tish ICHIDA qoladimi.
///
/// * ichki freym (YouTube'ning o'z iframe'i, `googlevideo`, `ytimg`,
///   `about:blank`/`srcdoc`, reklama freymlari) — hammasi ichida: ular
///   ilovadan olib chiqmaydi, to'sib qo'yilsa pleer ishlamaydi;
/// * asosiy oynada: `about:`/`data:`/`blob:`, bizning bazaviy sahifa
///   (`nfcstore.uz`) va YouTube'ning `/embed/` sahifasi (iOS iframe'ni
///   asosiy oyna deb bersa ham pleer to'xtamasin);
/// * qolgani (tomosha sahifasi, kanal, `youtu.be`, boshqa sayt) —
///   haqiqiy tashqi havola: ilovada emas, tashqarida ochiladi.
@visibleForTesting
bool youtubeNavStaysInside(String url, {required bool mainFrame}) {
  if (!mainFrame) return true;
  final u = Uri.tryParse(url.trim());
  if (u == null) return true;
  final scheme = u.scheme.toLowerCase();
  if (scheme == 'about' || scheme == 'data' || scheme == 'blob') return true;
  if (scheme != 'https') return false;
  final host = u.host.toLowerCase();
  if (host == 'nfcstore.uz' || host == 'www.nfcstore.uz') return true;
  const embedHosts = {
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
  };
  return embedHosts.contains(host) && u.path.startsWith('/embed/');
}

/// Pleer shuncha vaqtda tayyor bo'lmasa — zaxira yo'l ko'rsatiladi.
const kShowcaseVideoReadyTimeout = Duration(seconds: 15);

/// Sinov uchun: WebView o'rniga soxta pleer. `onState` ga pleer
/// holatlari (`ready`, `playing`, `paused`, `ended`, `error:<kod>`)
/// yuboriladi.
@visibleForTesting
Widget Function(String videoId, ValueChanged<String> onState)?
    showcaseYoutubePlayerOverride;

/// Videoni BUTUN EKRANDA ochadi (egasi, TestFlight 331). Yopilganda
/// ("×", pastga surish, "orqaga") tugaydi.
Future<void> showShowcaseVideo(
  BuildContext context, {
  required String url,
  required String videoId,
  String title = '',
}) {
  return pushShowcaseFullscreen(
    context,
    (_) => ShowcaseVideoPage(url: url, videoId: videoId, title: title),
  );
}

class ShowcaseVideoPage extends ConsumerStatefulWidget {
  const ShowcaseVideoPage({
    super.key,
    required this.url,
    required this.videoId,
    this.title = '',
  });

  final String url;
  final String videoId;
  final String title;

  /// Pleer o'lchami — mavjud joyni TO'LDIRADI: oddiy video 16:9 —
  /// enini (markazda), Shorts 9:16 — bo'yini. Hech qachon 200×200 dan
  /// kichik emas (YouTube talabi).
  @visibleForTesting
  static Size playerSize(Size area, {required bool shorts}) {
    const min = 200.0;
    final w = area.width < min ? min : area.width;
    final h = area.height < min ? min : area.height;
    final ratio = shorts ? 9 / 16 : 16 / 9; // eni / bo'yi
    var pw = w;
    var ph = w / ratio;
    if (ph > h) {
      ph = h;
      pw = h * ratio;
    }
    return Size(pw < min ? min : pw, ph < min ? min : ph);
  }

  @override
  ConsumerState<ShowcaseVideoPage> createState() => _ShowcaseVideoPageState();
}

class _ShowcaseVideoPageState extends ConsumerState<ShowcaseVideoPage>
    with WidgetsBindingObserver {
  late final AudioOwner _owner;
  final _ctl = ShowcaseYoutubeController();
  bool _foreground = true;
  bool _ready = false;
  String? _error;
  Timer? _watchdog;

  /// Fondan qaytilganda pleer YANGIDAN quriladi.
  int _gen = 0;

  @override
  void initState() {
    super.initState();
    _owner = ref.read(audioOwnerProvider);
    WidgetsBinding.instance.addObserver(this);
    final s = WidgetsBinding.instance.lifecycleState;
    _foreground = s == null ||
        s == AppLifecycleState.resumed ||
        s == AppLifecycleState.inactive;
    if (_foreground) _arm();
  }

  void _arm() {
    _ready = false;
    _watchdog?.cancel();
    _watchdog = Timer(kShowcaseVideoReadyTimeout, () {
      if (mounted && !_ready && _error == null) {
        setState(() => _error = 'error:timeout');
      }
    });
  }

  void _onState(String s) {
    if (!mounted) return;
    if (s == 'ready') {
      _ready = true;
      _watchdog?.cancel();
    } else if (s == 'playing') {
      _ready = true;
      _watchdog?.cancel();
      // Boshqa ovoz (ko'rgazma musiqasi, lentadagi video) to'xtaydi.
      _owner.take(this, () => _ctl.pause());
    } else if (s == 'paused' || s == 'ended') {
      _owner.release(this);
    } else if (s.startsWith('error')) {
      _watchdog?.cancel();
      _owner.release(this);
      setState(() => _error = s);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final fg = state == AppLifecycleState.resumed ||
        state == AppLifecycleState.inactive;
    if (fg == _foreground || !mounted) return;
    setState(() {
      _foreground = fg;
      if (fg) _gen++;
    });
    if (fg) {
      if (_error == null) _arm();
    } else {
      // Fonda ijro yo'q: DARHOL to'xtatiladi va sahifa bo'shatiladi
      // (fonda kadr chizilmaydi — daraxtdan olinishini kutib bo'lmaydi),
      // keyin pleer daraxtdan ham olinadi.
      _ctl.unload();
      _watchdog?.cancel();
      _owner.release(this);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _watchdog?.cancel();
    _owner.release(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final shorts = isYoutubeShorts(widget.url);
    return ShowcaseFullscreen(
      key: const ValueKey('showcase-video-page'),
      icon: Icons.smart_display_rounded,
      title: widget.title.isEmpty ? 'YouTube' : widget.title,
      closeKey: const ValueKey('showcase-video-close'),
      body: (context, area) {
        final size = ShowcaseVideoPage.playerSize(area, shorts: shorts);
        // Pleer USTIDA hech narsa yo'q: sarlavha/"×" tepada, havola
        // pastda — media maydonidan tashqarida.
        return SizedBox(
          key: const ValueKey('showcase-video-player-area'),
          width: size.width,
          height: size.height,
          child: _error != null
              ? _Fallback(url: widget.url, message: l.showcaseVideoUnavailable)
              : !_foreground
                  ? const ColoredBox(color: Colors.black)
                  : KeyedSubtree(
                      key: ValueKey('yt-$_gen'),
                      child: showcaseYoutubePlayerOverride?.call(
                              widget.videoId, _onState) ??
                          ShowcaseYoutubePlayer(
                            videoId: widget.videoId,
                            controller: _ctl,
                            onState: _onState,
                          ),
                    ),
        );
      },
      // Zaxira yo'l — pleerdan PASTDA, kichik havola.
      footer: _error != null
          ? null
          : TextButton.icon(
              key: const ValueKey('showcase-video-external'),
              onPressed: () => openLink(widget.url),
              style: TextButton.styleFrom(foregroundColor: Colors.white70),
              icon: const Icon(Icons.open_in_new_rounded, size: 16),
              label: Text(l.showcaseOpenYoutube),
            ),
    );
  }
}

/// Pleer o'rnida: "Bu videoni ilova ichida ko'rib bo'lmaydi" va
/// "YouTube'da ochish".
class _Fallback extends StatelessWidget {
  const _Fallback({required this.url, required this.message});
  final String url;
  final String message;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return ColoredBox(
      key: const ValueKey('showcase-video-fallback'),
      color: Colors.white.withValues(alpha: .08),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(Gap.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.smart_display_outlined,
                  color: Colors.white70, size: 36),
              const SizedBox(height: Gap.sm),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: AppType.sans,
                  fontSize: 13.5,
                  height: 1.3,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: Gap.md),
              FilledButton.icon(
                key: const ValueKey('showcase-video-fallback-open'),
                onPressed: () => openLink(url),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                ),
                icon: const Icon(Icons.open_in_new_rounded, size: 16),
                label: Text(l.showcaseOpenYoutube),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pleerni tashqaridan to'xtatish (audio egaligi boshqasiga o'tganda).
class ShowcaseYoutubeController {
  WebViewController? _web;

  Future<void> pause() async {
    await _web
        ?.runJavaScript('window.nfcPause && window.nfcPause()')
        .catchError((_) {});
  }

  /// Ijroni to'xtatib, sahifani bo'shatadi (ovoz qolmaydi).
  void unload() {
    final w = _web;
    if (w == null) return;
    w.runJavaScript('window.nfcPause && window.nfcPause()').catchError((_) {});
    w.loadHtmlString('<html></html>').catchError((_) {});
  }
}

/// YouTube IFrame Player API — WebView ichida.
class ShowcaseYoutubePlayer extends StatefulWidget {
  const ShowcaseYoutubePlayer({
    super.key,
    required this.videoId,
    required this.controller,
    required this.onState,
  });

  final String videoId;
  final ShowcaseYoutubeController controller;

  /// `ready` | `playing` | `paused` | `ended` | `error:<kod>`
  final ValueChanged<String> onState;

  static const _base = 'https://nfcstore.uz/';

  /// Pleer sahifasi. Odam "Videoni ko'rish" ni bosgan — video o'zi
  /// boshlanadi: `autoplay:1`, `onReady` da esa zaxira `playVideo()`
  /// (ba'zi WebView'larda `autoplay` yetarli emas).
  @visibleForTesting
  static String html(String id) => '''
<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{width:100%;height:100%}</style>
</head><body><div id="p"></div>
<script>
var player;
function post(m){try{NfcVideo.postMessage(m)}catch(e){}}
window.nfcPause=function(){try{player.pauseVideo()}catch(e){}};
function onYouTubeIframeAPIReady(){
  player=new YT.Player('p',{width:'100%',height:'100%',videoId:${jsonEncode(id)},
    playerVars:{playsinline:1,autoplay:1,rel:0,controls:1,origin:'https://nfcstore.uz',widget_referrer:'https://nfcstore.uz'},
    events:{
      onReady:function(e){post('ready');try{e.target.playVideo()}catch(x){}},
      onStateChange:function(e){
        if(e.data===1)post('playing');else if(e.data===2)post('paused');else if(e.data===0)post('ended');
      },
      onError:function(e){post('error:'+e.data)}
    }});
}
</script>
<script src="https://www.youtube.com/iframe_api" onerror="post('error:load')"></script>
</body></html>''';

  @override
  State<ShowcaseYoutubePlayer> createState() => _ShowcaseYoutubePlayerState();
}

class _ShowcaseYoutubePlayerState extends State<ShowcaseYoutubePlayer> {
  late final WebViewController _web;

  @override
  void initState() {
    super.initState();
    // Avtomatik ijro: odam "Videoni ko'rish" ni O'ZI bosgan — bu uning
    // harakati davomi (`music_embed.dart` bilan bir xil). Ilgari media
    // "foydalanuvchi bosishini" talab qilardi va iOS'da video pleer
    // ichida bosilsa ham boshlanmasdi (build 330).
    final PlatformWebViewControllerCreationParams params =
        WebViewPlatform.instance is WebKitWebViewPlatform
            ? WebKitWebViewControllerCreationParams(
                allowsInlineMediaPlayback: true,
                mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
              )
            : const PlatformWebViewControllerCreationParams();
    _web = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..addJavaScriptChannel('NfcVideo',
          onMessageReceived: (m) => widget.onState(m.message));
    final platform = _web.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
    }
    _web
      ..setNavigationDelegate(NavigationDelegate(
        onWebResourceError: (e) {
          if ((e.isForMainFrame ?? false) && !webLoadCancelled(e)) {
            widget.onState('error:load');
          }
        },
        onNavigationRequest: (r) {
          if (youtubeNavStaysInside(r.url, mainFrame: r.isMainFrame)) {
            return NavigationDecision.navigate;
          }
          // Pleerdagi "YouTube'da ko'rish", kanal va boshqa havolalar —
          // ilovaning o'zida emas, tashqarida.
          openLink(r.url);
          return NavigationDecision.prevent;
        },
      ))
      ..loadHtmlString(ShowcaseYoutubePlayer.html(widget.videoId),
          baseUrl: ShowcaseYoutubePlayer._base);
    widget.controller._web = _web;
  }

  @override
  void dispose() {
    if (identical(widget.controller._web, _web)) {
      widget.controller._web = null;
    }
    // Fonda ijro yo'q: sahifa bo'shatiladi, ovoz shu zahoti to'xtaydi.
    _web
        .runJavaScript('window.nfcPause && window.nfcPause()')
        .catchError((_) {});
    _web.loadHtmlString('<html></html>').catchError((_) {});
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => WebViewWidget(controller: _web);
}
