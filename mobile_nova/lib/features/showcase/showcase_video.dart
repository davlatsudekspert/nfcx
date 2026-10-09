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
///   Varaqni ochmasdan (lentada, ko'rgazma sahifasida) hech narsa
///   o'zi o'ynamaydi;
/// * pleer ustida hech narsa yo'q (yopish tugmasi va "YouTube'da ochish"
///   havolasi pleerdan TASHQARIDA — tepada va pastda);
/// * o'lcham kamida 200×200;
/// * ilova kimligi: sahifa `https://nfcstore.uz/` bazasi bilan yuklanadi
///   (Referer), `origin` va `widget_referrer` — `music_embed.dart` bilan
///   bir xil yo'l;
/// * fonda ijro YO'Q — varaq yopilsa yoki ilova fonga o'tsa pleer
///   yo'q qilinadi (qaytilganda qaytadan quriladi).
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

/// Varaqni ochadi. Yopilganda (har qanday yo'l bilan) tugaydi.
Future<void> showShowcaseVideo(
  BuildContext context, {
  required String url,
  required String videoId,
  String title = '',
}) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Colors.black,
    builder: (_) =>
        ShowcaseVideoSheet(url: url, videoId: videoId, title: title),
  );
}

class ShowcaseVideoSheet extends ConsumerStatefulWidget {
  const ShowcaseVideoSheet({
    super.key,
    required this.url,
    required this.videoId,
    this.title = '',
  });

  final String url;
  final String videoId;
  final String title;

  /// Pleer o'lchami: 16:9 (Shorts — 9:16), lekin hech qachon
  /// 200×200 dan kichik emas va ekran balandligining ~60% idan oshmaydi.
  @visibleForTesting
  static Size playerSize({
    required double maxWidth,
    required double screenHeight,
    required bool shorts,
  }) {
    const min = 200.0;
    final w0 = maxWidth < min ? min : maxWidth;
    final maxH = screenHeight * .6 < min ? min : screenHeight * .6;
    if (shorts) {
      final h = (w0 * 16 / 9).clamp(min, maxH);
      return Size((h * 9 / 16).clamp(min, w0), h);
    }
    return Size(w0, (w0 * 9 / 16).clamp(min, maxH));
  }

  @override
  ConsumerState<ShowcaseVideoSheet> createState() => _ShowcaseVideoSheetState();
}

class _ShowcaseVideoSheetState extends ConsumerState<ShowcaseVideoSheet>
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
    final mq = MediaQuery.of(context);
    final shorts = isYoutubeShorts(widget.url);
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.lg, 0, Gap.lg, Gap.lg),
        child: LayoutBuilder(builder: (context, c) {
          final size = ShowcaseVideoSheet.playerSize(
            maxWidth: c.maxWidth,
            screenHeight: mq.size.height,
            shorts: shorts,
          );
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Sarlavha va yopish — pleerning USTIDA EMAS, tepasida.
              Row(
                children: [
                  const Icon(Icons.smart_display_rounded,
                      color: Colors.white, size: 22),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Text(
                      widget.title.isEmpty ? 'YouTube' : widget.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: AppType.sans,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  IconButton(
                    key: const ValueKey('showcase-video-close'),
                    onPressed: () => Navigator.of(context).maybePop(),
                    tooltip: MaterialLocalizations.of(context)
                        .closeButtonTooltip,
                    icon: const Icon(Icons.close_rounded,
                        color: Colors.white),
                  ),
                ],
              ),
              const SizedBox(height: Gap.sm),
              SizedBox(
                key: const ValueKey('showcase-video-player-area'),
                width: size.width,
                height: size.height,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
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
                ),
              ),
              if (_error == null) ...[
                const SizedBox(height: Gap.xs),
                // Zaxira yo'l — pleerdan PASTDA, kichik havola.
                TextButton.icon(
                  key: const ValueKey('showcase-video-external'),
                  onPressed: () => openLink(widget.url),
                  style: TextButton.styleFrom(foregroundColor: Colors.white70),
                  icon: const Icon(Icons.open_in_new_rounded, size: 16),
                  label: Text(l.showcaseOpenYoutube),
                ),
              ],
            ],
          );
        }),
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
