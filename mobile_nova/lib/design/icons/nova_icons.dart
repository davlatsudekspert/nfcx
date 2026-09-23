import 'package:flutter/cupertino.dart';

/// IJTIMOIY BELGILAR — YUMALOQ, MAYIN CHIZIQLI (egasi, 2026-09:
/// "Reels, lenta joylardagi belgilar qirralikka o'xshaydi").
///
/// Material'ning `mode_comment_outlined` (to'rtburchak pufak, o'tkir
/// dum), `send` (burchakli qog'oz samolyot) kabi belgilari qalin va
/// burchakli edi. Instagram va Apple ilovalari ingichka, yumaloq
/// chiziqli belgilar ishlatadi — bu yerda aynan o'sha to'plam
/// (`cupertino_icons`, Apple'ning SF Symbols uslubi).
///
/// Hamma ijtimoiy ekran (lenta, Reels, post, story, izohlar) SHU
/// yerdan oladi: bitta joyda o'zgartirilsa, hammasi birga o'zgaradi.
abstract final class NovaIcons {
  static const like = CupertinoIcons.heart;
  static const liked = CupertinoIcons.heart_fill;
  static const comment = CupertinoIcons.chat_bubble;
  static const share = CupertinoIcons.paperplane;
  static const save = CupertinoIcons.bookmark;
  static const saved = CupertinoIcons.bookmark_fill;
  static const sound = CupertinoIcons.speaker_2_fill;
  static const muted = CupertinoIcons.speaker_slash_fill;
  static const more = CupertinoIcons.ellipsis;
  static const report = CupertinoIcons.flag;
  static const delete = CupertinoIcons.delete;

  /// Izoh yuborish — dumaloq tugma ichidagi yuqoriga strelka
  /// (iMessage/Instagram kabi).
  static const send = CupertinoIcons.arrow_up;
}
