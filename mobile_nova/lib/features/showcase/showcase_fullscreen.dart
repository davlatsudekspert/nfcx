import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../design/theme/typography.dart';
import '../../design/tokens/shapes.dart';

/// KO'RGAZMA — YouTube va Instagram BUTUN EKRANDA (egasi, TestFlight
/// 331: "silkani bosganda avto to'liq ochilmayapti").
///
/// Ilgari pastdan varaq (bottom sheet) ochilardi; endi odam "Videoni
/// ko'rish" / "Instagram'da ko'rish" ni bosishi bilan butun ekranli
/// qora sahifa ochiladi:
///
/// * tepada — belgi, sarlavha va "×" (media maydonidan TASHQARIDA);
/// * o'rtada — rasmiy pleer/embed qolgan butun joyni egallaydi (o'lchamni
///   [ShowcaseFullscreen.body] o'zi tanlaydi), ustida HECH NARSA yo'q;
/// * pastda — kichik "... da ochish" havolasi;
/// * pastga surish (media tashqarisida — tepa panel, pastki havola yoki
///   bo'sh qora joy), "×" yoki "orqaga" — yopiladi. Media ustida
///   surish pleerning o'ziga qoladi (YouTube vaqt chizig'i va h.k.);
/// * telefon kesigi va pastki chiziq hisobga olinadi (`SafeArea`).
Future<void> pushShowcaseFullscreen(
  BuildContext context,
  WidgetBuilder builder,
) {
  return Navigator.of(context, rootNavigator: true).push<void>(
    MaterialPageRoute<void>(fullscreenDialog: true, builder: builder),
  );
}

class ShowcaseFullscreen extends StatefulWidget {
  const ShowcaseFullscreen({
    super.key,
    required this.icon,
    required this.title,
    required this.closeKey,
    required this.body,
    this.footer,
  });

  final IconData icon;
  final String title;
  final Key closeKey;

  /// Media — `area` (tepa panel va pastki havoladan qolgan joy) ichida,
  /// markazda.
  final Widget Function(BuildContext context, Size area) body;

  /// Pastdagi kichik havola (yoki `null` — zaxira panel ko'rinsa).
  final Widget? footer;

  /// Shuncha pastga surilsa (yoki tez surilsa) — yopiladi.
  static const closeDistance = 110.0;
  static const closeVelocity = 700.0;

  @override
  State<ShowcaseFullscreen> createState() => _ShowcaseFullscreenState();
}

class _ShowcaseFullscreenState extends State<ShowcaseFullscreen> {
  double _drag = 0;

  void _close() => Navigator.of(context).maybePop();

  void _onDrag(DragUpdateDetails d) =>
      setState(() => _drag = math.max(0, _drag + d.delta.dy));

  void _onDragEnd(DragEndDetails d) {
    if (_drag > ShowcaseFullscreen.closeDistance ||
        (d.primaryVelocity ?? 0) > ShowcaseFullscreen.closeVelocity) {
      _close();
    } else {
      setState(() => _drag = 0);
    }
  }

  /// Pastga surib yopish — faqat media TASHQARISIDA.
  Widget _swipe(Widget child) => GestureDetector(
        behavior: HitTestBehavior.translucent,
        onVerticalDragUpdate: _onDrag,
        onVerticalDragEnd: _onDragEnd,
        onVerticalDragCancel: () => setState(() => _drag = 0),
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final title = Padding(
      padding: const EdgeInsets.fromLTRB(Gap.lg, Gap.xs, Gap.xs, Gap.xs),
      child: Row(
        children: [
          Icon(widget.icon, color: Colors.white, size: 22),
          const SizedBox(width: Gap.sm),
          Expanded(
            child: Text(
              widget.title,
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
            key: widget.closeKey,
            onPressed: _close,
            tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
            icon: const Icon(Icons.close_rounded, color: Colors.white),
          ),
        ],
      ),
    );
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Transform.translate(
          offset: Offset(0, _drag),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Media atrofidagi bo'sh qora joy ham surib yopiladi.
              _swipe(const ColoredBox(color: Colors.black)),
              SafeArea(
                child: Column(
                  children: [
                    _swipe(title),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, box) => Center(
                          child: widget.body(context, box.biggest),
                        ),
                      ),
                    ),
                    if (widget.footer != null)
                      _swipe(
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: Gap.xs,
                          ),
                          child: Center(child: widget.footer),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Embed (YouTube/Instagram) ichidagi havola faqat odam O'ZI bosganda
/// tashqarida ochiladi. Sahifaning o'zi yo'naltirsa (masalan Instagram
/// kirish sahifasiga) ilova Safari/brauzerga "otilib" chiqmaydi —
/// zaxira panel ko'rsatiladi.
class EmbedTapClock {
  /// Bosishdan keyin shu vaqt ichidagi navigatsiya — odamniki.
  static const window = Duration(seconds: 3);

  DateTime? _at;

  void touched() => _at = DateTime.now();

  bool get recent {
    final at = _at;
    return at != null && DateTime.now().difference(at) <= window;
  }

  /// [child] ga tegilganini yozadi (bosishni o'zi ushlamaydi).
  Widget wrap(Widget child) => Listener(
    behavior: HitTestBehavior.translucent,
    onPointerDown: (_) => touched(),
    child: child,
  );
}
