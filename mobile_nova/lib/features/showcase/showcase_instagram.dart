import 'dart:async';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import '../../core/utils/external_link.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/shapes.dart';
import '../../l10n/gen/app_localizations.dart';
import 'showcase_video.dart' show webLoadCancelled;

/// KO'RGAZMA — INSTAGRAM POSTI ilova ichida (egasi tasdiqlagan).
///
/// Instagram'ning RASMIY ommaviy embed sahifasi ochiladi:
/// `https://www.instagram.com/<p|reel>/<kod>/embed/` (token kerak emas).
///
/// * odam "Instagram'da ko'rish" ni O'ZI bosgan — WebView media'ni
///   to'smaydi (iOS'da `mediaTypesRequiringUserAction` bo'sh, Android'da
///   `setMediaPlaybackRequiresUserGesture(false)`, YouTube varag'i bilan
///   bir xil; build 330). Reel embed'ning o'zi play bosishni so'rashi
///   mumkin — bosilganda darhol o'ynaydi;
/// * embed ustida hech narsa yo'q: yopish — tepada, "Instagram'da
///   ochish" — pastda;
/// * embed ichidagi havolalar ("View on Instagram", profil...) WebView
///   ichida OCHILMAYDI — tashqarida (`openLink`), ilovada Instagram
///   sayti "ichkariga" kirib ketmaydi;
/// * yuklanmasa (tarmoq/HTTP xato yoki javobsizlik) — embed o'rnida
///   "Instagram'da ochish";
/// * fonda hech narsa o'ynamaydi: ilova fonga o'tsa sahifa bo'shatiladi.

/// Embed shuncha vaqtda yuklanmasa — zaxira yo'l.
const kShowcaseInstagramTimeout = Duration(seconds: 20);

/// Sinov uchun: WebView o'rniga soxta embed. `onState` ga `ready` yoki
/// `error:<sabab>` yuboriladi.
@visibleForTesting
Widget Function(Uri embed, ValueChanged<String> onState)?
    showcaseInstagramEmbedOverride;

Future<void> showShowcaseInstagram(
  BuildContext context, {
  required String url,
  required Uri embed,
  String title = '',
}) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Colors.black,
    builder: (_) =>
        ShowcaseInstagramSheet(url: url, embed: embed, title: title),
  );
}

class ShowcaseInstagramSheet extends StatefulWidget {
  const ShowcaseInstagramSheet({
    super.key,
    required this.url,
    required this.embed,
    this.title = '',
  });

  final String url;
  final Uri embed;
  final String title;

  @override
  State<ShowcaseInstagramSheet> createState() => _ShowcaseInstagramSheetState();
}

class _ShowcaseInstagramSheetState extends State<ShowcaseInstagramSheet>
    with WidgetsBindingObserver {
  final _ctl = _EmbedHandle();
  bool _foreground = true;
  bool _ready = false;
  String? _error;
  Timer? _watchdog;
  int _gen = 0;

  @override
  void initState() {
    super.initState();
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
    _watchdog = Timer(kShowcaseInstagramTimeout, () {
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
    } else if (s.startsWith('error')) {
      _watchdog?.cancel();
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
      // Fonda ovoz yo'q: sahifa darhol bo'shatiladi.
      _ctl.unload();
      _watchdog?.cancel();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _watchdog?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final h = (MediaQuery.sizeOf(context).height * .68).clamp(320.0, 720.0);
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Gap.lg, 0, Gap.lg, Gap.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                const Icon(Icons.camera_alt_outlined,
                    color: Colors.white, size: 22),
                const SizedBox(width: Gap.sm),
                Expanded(
                  child: Text(
                    widget.title.isEmpty ? 'Instagram' : widget.title,
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
                  key: const ValueKey('showcase-ig-close'),
                  onPressed: () => Navigator.of(context).maybePop(),
                  tooltip:
                      MaterialLocalizations.of(context).closeButtonTooltip,
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                ),
              ],
            ),
            const SizedBox(height: Gap.sm),
            SizedBox(
              key: const ValueKey('showcase-ig-area'),
              width: double.infinity,
              height: h,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: _error != null
                    ? _Fallback(
                        url: widget.url,
                        message: l.showcaseInstagramUnavailable,
                      )
                    : !_foreground
                        ? const ColoredBox(color: Colors.white)
                        : KeyedSubtree(
                            key: ValueKey('ig-$_gen'),
                            child: showcaseInstagramEmbedOverride?.call(
                                    widget.embed, _onState) ??
                                _InstagramEmbed(
                                  embed: widget.embed,
                                  handle: _ctl,
                                  onState: _onState,
                                ),
                          ),
              ),
            ),
            if (_error == null) ...[
              const SizedBox(height: Gap.xs),
              TextButton.icon(
                key: const ValueKey('showcase-ig-external'),
                onPressed: () => openLink(widget.url),
                style: TextButton.styleFrom(foregroundColor: Colors.white70),
                icon: const Icon(Icons.open_in_new_rounded, size: 16),
                label: Text(l.showcaseOpenInstagram),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.url, required this.message});
  final String url;
  final String message;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return ColoredBox(
      key: const ValueKey('showcase-ig-fallback'),
      color: Colors.white.withValues(alpha: .08),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(Gap.lg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.camera_alt_outlined,
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
                key: const ValueKey('showcase-ig-fallback-open'),
                onPressed: () => openLink(url),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                ),
                icon: const Icon(Icons.open_in_new_rounded, size: 16),
                label: Text(l.showcaseOpenInstagram),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmbedHandle {
  WebViewController? _web;

  void unload() {
    _web?.loadHtmlString('<html></html>').catchError((_) {});
  }
}

/// Embed sahifasining o'zi (shu manzil) — WebView ichida qoladi.
/// Boshqa har qanday asosiy oyna o'tishi — tashqarida.
@visibleForTesting
bool instagramEmbedStaysInside(Uri embed, String url) {
  final u = Uri.tryParse(url);
  if (u == null) return false;
  if (u.scheme == 'about') return true;
  String norm(String p) => p.endsWith('/') ? p : '$p/';
  return u.scheme == 'https' &&
      u.host.toLowerCase() == embed.host &&
      norm(u.path) == norm(embed.path);
}

class _InstagramEmbed extends StatefulWidget {
  const _InstagramEmbed({
    required this.embed,
    required this.handle,
    required this.onState,
  });

  final Uri embed;
  final _EmbedHandle handle;
  final ValueChanged<String> onState;

  @override
  State<_InstagramEmbed> createState() => _InstagramEmbedState();
}

class _InstagramEmbedState extends State<_InstagramEmbed> {
  late final WebViewController _web;

  @override
  void initState() {
    super.initState();
    // Media odam bosishini kutmaydi: varaqni u o'zi ochgan (YouTube
    // varag'i va `music_embed.dart` bilan bir xil sozlama).
    final PlatformWebViewControllerCreationParams params =
        WebViewPlatform.instance is WebKitWebViewPlatform
            ? WebKitWebViewControllerCreationParams(
                allowsInlineMediaPlayback: true,
                mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
              )
            : const PlatformWebViewControllerCreationParams();
    _web = WebViewController.fromPlatformCreationParams(params)
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white);
    final platform = _web.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
    }
    _web
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) => widget.onState('ready'),
        onWebResourceError: (e) {
          if ((e.isForMainFrame ?? false) && !webLoadCancelled(e)) {
            widget.onState('error:load');
          }
        },
        onHttpError: (e) {
          final req = e.request?.uri;
          final code = e.response?.statusCode ?? 0;
          if (code >= 400 &&
              req != null &&
              instagramEmbedStaysInside(widget.embed, req.toString())) {
            widget.onState('error:http$code');
          }
        },
        onNavigationRequest: (r) {
          if (!r.isMainFrame ||
              instagramEmbedStaysInside(widget.embed, r.url)) {
            return NavigationDecision.navigate;
          }
          // "View on Instagram" va boshqa havolalar — tashqarida.
          openLink(r.url);
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(widget.embed);
    widget.handle._web = _web;
  }

  @override
  void dispose() {
    if (identical(widget.handle._web, _web)) widget.handle._web = null;
    _web.loadHtmlString('<html></html>').catchError((_) {});
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => WebViewWidget(controller: _web);
}
