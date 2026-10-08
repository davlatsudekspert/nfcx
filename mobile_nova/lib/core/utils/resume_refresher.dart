import 'package:flutter/widgets.dart';

/// ILOVA FONDAN QAYTGANDA YANGILASH — umumiy kuzatuvchi.
///
/// `resumed` kelganda [onResume] chaqiriladi, lekin [gap] dan tez-tez
/// emas (ilova almashtirib turish serverni bezovta qilmasin). [when]
/// `false` qaytarsa (masalan, sessiya faol emas) o'tkazib yuboriladi va
/// vaqt belgisi o'zgarmaydi.
///
/// Sessiya (`sessionResumeRefreshProvider`) va server kalitlari
/// (`appFlagsProvider`) shu bitta qoidadan foydalanadi.
class ResumeRefresher with WidgetsBindingObserver {
  ResumeRefresher({
    required this.gap,
    required this.onResume,
    required DateTime Function() clock,
    bool Function()? when,
  })  : _clock = clock,
        _when = when,
        _last = clock();

  final Duration gap;
  final VoidCallback onResume;
  final DateTime Function() _clock;
  final bool Function()? _when;
  DateTime _last;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    if (!(_when?.call() ?? true)) return;
    final now = _clock();
    if (now.difference(_last) < gap) return;
    _last = now;
    onResume();
  }
}
