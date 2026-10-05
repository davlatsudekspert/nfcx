import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import 'music_source.dart';

/// YouTube / Yandex Music havolasi — pleerning ICHIDA, xizmatning
/// RASMIY pleeri bilan (sayt ham xuddi shunday qiladi:
/// `src/pages/ProfilePage.jsx`).
///
/// ## Nega audio fayl emas
///
/// YouTube'dan ovozni ajratib olish yoki yashirin (videosiz) ijro
/// etish YouTube qoidalariga zid. Shuning uchun video KO'RINADI
/// (kamida 200×200, ustiga hech narsa qo'yilmaydi) va ijro faqat
/// varaq ochiq turganda davom etadi — varaq yopilsa to'xtaydi.
///
/// ## Holat
///
/// YouTube IFrame API holatni `NfcMusic` kanali orqali yuboradi:
/// `playing`, `paused`, `ended`, `error:<kod>`. Video joylashtirishni
/// taqiqlagan bo'lsa (101/150) chaqiruvchi "YouTube'da ochish"
/// tugmasini ko'rsatadi.
class MusicEmbedController {
  WebViewController? _web;
  MusicKind _kind = MusicKind.audio;

  /// Ijro/pauza. YouTube — IFrame API orqali. Yandex — vidjetning O'Z
  /// tugmasi sahifa ichidan bosiladi (`MusicEmbed.yandexBridgeJs`):
  /// egasi, 2026-10-05: "pleerda play bosilsa Yandex'da ham play
  /// bo'lishi kerak", ilgari ikki joyda bosish kerak edi.
  Future<void> play() async {
    if (_kind == MusicKind.youtube) {
      await _web?.runJavaScript('window.nfcPlay && window.nfcPlay()');
    } else if (_kind == MusicKind.yandex) {
      await _web?.runJavaScript('window.nfcToggle && window.nfcToggle()');
    }
  }

  Future<void> pause() async {
    if (_kind == MusicKind.youtube) {
      await _web?.runJavaScript('window.nfcPause && window.nfcPause()');
    } else if (_kind == MusicKind.yandex) {
      await _web?.runJavaScript('window.nfcToggle && window.nfcToggle()');
    }
  }
}

class MusicEmbed extends StatefulWidget {
  const MusicEmbed({
    super.key,
    required this.source,
    required this.controller,
    this.onState,
  });

  final MusicSource source;
  final MusicEmbedController controller;

  /// `playing` | `paused` | `ended` | `error:<kod>`
  final ValueChanged<String>? onState;

  /// Saytdagi bilan bir xil o'lcham: YouTube 200×200 dan kichik
  /// bo'lmaydi; Yandex vidjeti pastroq va kengroq.
  static Size sizeFor(MusicKind kind) => kind == MusicKind.yandex
      ? const Size(280, 180)
      : const Size(240, 220);

  @visibleForTesting
  static String youtubeHtml(String id) => '''
<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{width:100%;height:100%}</style>
</head><body><div id="p"></div>
<script>
var player;
function post(m){try{NfcMusic.postMessage(m)}catch(e){}}
window.nfcPlay=function(){try{player.playVideo()}catch(e){}};
window.nfcPause=function(){try{player.pauseVideo()}catch(e){}};
function onYouTubeIframeAPIReady(){
  player=new YT.Player('p',{width:'100%',height:'100%',videoId:${jsonEncode(id)},
    playerVars:{playsinline:1,autoplay:1,rel:0,modestbranding:1,controls:1,origin:'https://nfcstore.uz'},
    events:{
      onReady:function(e){e.target.playVideo()},
      onStateChange:function(e){
        if(e.data===1)post('playing');else if(e.data===2)post('paused');else if(e.data===0)post('ended');
      },
      onError:function(e){post('error:'+e.data)}
    }});
}
</script>
<script src="https://www.youtube.com/iframe_api"></script>
</body></html>''';

  /// YANDEX VIDJETI BILAN KO'PRIK — sahifa yuklangach ichiga qo'yiladi.
  ///
  /// Yandex vidjeti tashqi API bermaydi, lekin sahifa WebView'da
  /// to'g'ridan-to'g'ri ochiladi, ya'ni skript uning ichida ishlaydi:
  /// `nfcToggle` vidjetning o'z play/pauza tugmasini bosadi. Ochilgach
  /// bir marta o'zi ham bosadi (pleerdagi play — foydalanuvchining
  /// harakati). Tugma topilmasa (Yandex sahifani o'zgartirsa) hech narsa
  /// buzilmaydi — vidjetning o'z tugmasi baribir ishlaydi.
  /// Holat (`playing`/`paused`) media hodisalaridan `NfcMusic` ga ketadi.
  @visibleForTesting
  static const yandexBridgeJs = r'''
(function(){
  if (window.nfcToggle) return;
  function post(m){try{NfcMusic.postMessage(m)}catch(e){}}
  document.addEventListener('play',function(){post('playing')},true);
  document.addEventListener('pause',function(){post('paused')},true);
  function visible(el){var r=el.getBoundingClientRect();return r.width>0&&r.height>0;}
  window.nfcToggle=function(){
    var sel=['[aria-label*="Воспроизв" i]','[aria-label*="Слушать" i]','[aria-label*="Пауза" i]',
      '[aria-label*="Play" i]','[aria-label*="Pause" i]','[title*="Воспроизв" i]','[title*="Пауза" i]',
      'button[class*="play" i]','[class*="play-button" i]','[class*="PlayButton"]'];
    for(var i=0;i<sel.length;i++){
      var list=document.querySelectorAll(sel[i]);
      for(var j=0;j<list.length;j++){ if(visible(list[j])){ list[j].click(); return true; } }
    }
    var a=document.querySelector('audio,video');
    if(a){ if(a.paused){a.play()}else{a.pause()} return true; }
    return false;
  };
  var n=0;
  var t=setInterval(function(){ if(window.nfcToggle()||++n>16){clearInterval(t)} },500);
})();
''';

  @visibleForTesting
  static Uri? yandexUri(String url) {
    var m = RegExp(r'/album/(\d+)/track/(\d+)').firstMatch(url);
    if (m != null) {
      return Uri.parse(
          'https://music.yandex.ru/iframe/#track/${m.group(2)}/${m.group(1)}');
    }
    m = RegExp(r'/track/(\d+)').firstMatch(url);
    if (m != null) {
      return Uri.parse('https://music.yandex.ru/iframe/#track/${m.group(1)}');
    }
    m = RegExp(r'/users/([^/?\s]+)/playlists/(\d+)').firstMatch(url);
    if (m != null) {
      return Uri.parse(
          'https://music.yandex.ru/iframe/#playlist/${m.group(1)}/${m.group(2)}');
    }
    m = RegExp(r'/album/(\d+)').firstMatch(url);
    if (m != null) {
      return Uri.parse('https://music.yandex.ru/iframe/#album/${m.group(1)}');
    }
    return null;
  }

  @override
  State<MusicEmbed> createState() => _MusicEmbedState();
}

class _MusicEmbedState extends State<MusicEmbed> {
  late final WebViewController _web;

  @override
  void initState() {
    super.initState();
    // Avtomatik ijro: foydalanuvchi pleerda O'ZI bosgan (varaqdagi
    // tugma yoki ro'yxat qatori), ya'ni bu uning harakati davomi.
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
      ..addJavaScriptChannel('NfcMusic',
          onMessageReceived: (m) => widget.onState?.call(m.message));
    final platform = _web.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
    }
    if (widget.source.kind == MusicKind.yandex) {
      _web.setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) =>
            _web.runJavaScript(MusicEmbed.yandexBridgeJs).catchError((_) {}),
      ));
    }
    widget.controller
      .._web = _web
      .._kind = widget.source.kind;
    _load();
  }

  void _load() {
    final src = widget.source;
    if (src.kind == MusicKind.youtube) {
      // Bazaviy manzil — sayt: YouTube pleeri "origin"siz ishlamaydi.
      _web.loadHtmlString(MusicEmbed.youtubeHtml(src.id),
          baseUrl: 'https://nfcstore.uz/');
    } else {
      final u = MusicEmbed.yandexUri(src.url);
      if (u != null) {
        _web.loadRequest(u);
      } else {
        widget.onState?.call('error:yandex');
      }
    }
  }

  @override
  void dispose() {
    if (identical(widget.controller._web, _web)) {
      widget.controller._web = null;
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MusicEmbed.sizeFor(widget.source.kind);
    return LayoutBuilder(
      builder: (_, c) => ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(
          // Tor ekranda varaqdan chiqib ketmasin.
          width: c.maxWidth.isFinite && c.maxWidth < size.width
              ? c.maxWidth
              : size.width,
          height: size.height,
          child: WebViewWidget(controller: _web),
        ),
      ),
    );
  }
}
