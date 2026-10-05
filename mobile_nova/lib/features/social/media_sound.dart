import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Ovoz o'chirilganmi — lenta va Reels uchun BITTA umumiy holat.
///
/// Egasi (2026-10-05): "Asosiy menyuda bez zvuk yo'q ekan". Lentadagi
/// video ekranga kelganda o'zi ovoz bilan o'ynardi va uni o'chirish
/// imkoni yo'q edi. Endi bir joyda o'chirilsa — lentada ham, Reels'da
/// ham o'chiq qoladi (Instagram kabi). `autoDispose` ATAYLAB yo'q.
final mediaMutedProvider = StateProvider<bool>((_) => false);

/// Video burchagidagi kichik 🔇/🔊 tugma.
class MuteButton extends ConsumerWidget {
  const MuteButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final muted = ref.watch(mediaMutedProvider);
    return Semantics(
      button: true,
      label: muted ? 'Ovozni yoqish' : "Ovozni o'chirish",
      child: GestureDetector(
        key: const ValueKey('video-mute'),
        behavior: HitTestBehavior.opaque,
        onTap: () => ref.read(mediaMutedProvider.notifier).state = !muted,
        // Bosish maydoni 44 px, ko'rinadigan doira 30 px.
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Container(
              width: 30,
              height: 30,
              decoration: const BoxDecoration(
                color: Color(0x99000000),
                shape: BoxShape.circle,
              ),
              child: Icon(
                muted ? Icons.volume_off_rounded : Icons.volume_up_rounded,
                size: 17,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
