import 'dart:async';

import 'package:flutter/widgets.dart';

import '../tokens.dart';
import '../type.dart';
import 'icons.dart';
import 'press.dart';
import 'surface.dart';

/// TOAST — qisqa tasdiq. "Kontakt saqlandi", "Post o'chirildi".
///
/// NIMA UCHUN O'Z TOASTI: Material'ning `SnackBar` i `Scaffold`
/// talab qiladi, ilova esa `Scaffold` ishlatmaydi. Bundan tashqari
/// dizayn toastni shisha yuzada, oltin urg'u bilan chizadi.
///
/// BEKOR QILISH TUGMASI: o'chirish kabi amallarda toast 5 soniya
/// turadi va "Bekor" tugmasi bo'ladi (dizayn 10b). Bu ikki qadamli
/// tasdiqdan keyingi UCHINCHI himoya emas — bu shunchaki
/// foydalanuvchiga qaytish imkoni.

class _ToastData {
  _ToastData({
    required this.message,
    required this.tone,
    required this.actionLabel,
    required this.onAction,
  });

  final String message;
  final StatusTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;
}

/// Toastlarni ko'rsatuvchi qatlam. `MaterialApp.builder` ichida
/// bir marta o'raladi.
class ToastHost extends StatefulWidget {
  const ToastHost({super.key, required this.child});

  final Widget child;

  static _ToastHostState? _of(BuildContext context) =>
      context.findAncestorStateOfType<_ToastHostState>();

  @override
  State<ToastHost> createState() => _ToastHostState();
}

class _ToastHostState extends State<ToastHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: M.push,
    reverseDuration: M.fade,
  );

  _ToastData? _data;
  Timer? _timer;

  void show(_ToastData data, Duration duration) {
    _timer?.cancel();
    setState(() => _data = data);
    _c.forward();
    _timer = Timer(duration, hide);
  }

  void hide() {
    _timer?.cancel();
    if (!mounted) return;
    _c.reverse().then((_) {
      if (mounted) setState(() => _data = null);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Stack(
      children: [
        widget.child,
        if (data != null)
          Positioned(
            left: S.gutter,
            right: S.gutter,
            // Tab bar ustida — toast navigatsiyani to'smasin.
            bottom: MediaQuery.of(context).padding.bottom + 96,
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, child) {
                final t = M.curve.transform(_c.value);
                return Opacity(
                  opacity: t,
                  child: Transform.translate(
                    offset: Offset(0, (1 - t) * 16),
                    child: child,
                  ),
                );
              },
              child: _ToastCard(data: data, onClose: hide),
            ),
          ),
      ],
    );
  }
}

class _ToastCard extends StatelessWidget {
  const _ToastCard({required this.data, required this.onClose});

  final _ToastData data;
  final VoidCallback onClose;

  Color get _tint => switch (data.tone) {
        StatusTone.ok => C.ok,
        StatusTone.fail => C.fail,
        StatusTone.pending => C.warn,
        StatusTone.accent => C.accent,
        StatusTone.neutral => C.ink2,
      };

  Ico get _icon => switch (data.tone) {
        StatusTone.ok => Ico.check,
        StatusTone.fail => Ico.warning,
        StatusTone.pending => Ico.clock,
        _ => Ico.info,
      };

  @override
  Widget build(BuildContext context) => GlassPanel(
        radius: R.card,
        blur: 18,
        padding: const EdgeInsets.symmetric(
          horizontal: S.x16,
          vertical: S.x12,
        ),
        child: Row(
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: _tint.withValues(alpha: .16),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: NIcon(_icon, size: 14, color: _tint),
            ),
            const SizedBox(width: S.x12),
            Expanded(
              child: Text(
                data.message,
                style: T.cardTitle.copyWith(fontSize: 14),
              ),
            ),
            if (data.actionLabel != null)
              Press(
                onTap: () {
                  onClose();
                  data.onAction?.call();
                },
                minSize: 0,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: S.x8,
                    vertical: S.x8,
                  ),
                  child: Text(
                    data.actionLabel!,
                    style: T.buttonSm.copyWith(color: C.accent),
                  ),
                ),
              ),
          ],
        ),
      );
}

// ─────────────────────────────────────────────────────────────

/// Toast ko'rsatish.
///
/// Host topilmasa jim o'tadi — test muhitida yoki ilova ildizisiz
/// chizilgan widgetda xato chiqarmaydi.
void showToast(
  BuildContext context,
  String message, {
  StatusTone tone = StatusTone.ok,
  String? actionLabel,
  VoidCallback? onAction,
  Duration duration = const Duration(milliseconds: 2600),
}) {
  ToastHost._of(context)?.show(
    _ToastData(
      message: message,
      tone: tone,
      actionLabel: actionLabel,
      onAction: onAction,
    ),
    duration,
  );
}

/// "Bekor" tugmali toast — o'chirishdan keyin 5 soniya turadi.
void showUndoToast(
  BuildContext context,
  String message, {
  required VoidCallback onUndo,
  String label = 'Bekor',
}) =>
    showToast(
      context,
      message,
      tone: StatusTone.neutral,
      actionLabel: label,
      onAction: onUndo,
      duration: const Duration(seconds: 5),
    );
