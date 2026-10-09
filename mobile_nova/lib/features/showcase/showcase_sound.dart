import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/storage/secure_store.dart';
import '../../design/icons/nova_icons.dart';
import '../../l10n/gen/app_localizations.dart';

/// KO'RGAZMA OVOZI — bitta umumiy kalit (egasi, build 329).
///
/// Burchakdagi 🔇/🔊 tugma bilan boshqariladi: barcha sahifalarda va
/// rasm ko'ruvchida bir xil, ilova qayta ochilganda ham saqlanadi
/// (`Prefs.showcaseMuted`). O'chiq bo'lsa ko'rgazma musiqasi UMUMAN
/// o'ynamaydi (ovozi pasaytirilgan holda ham emas).
class ShowcaseMuteController extends StateNotifier<bool> {
  ShowcaseMuteController(this._prefs) : super(_prefs.showcaseMuted);
  final Prefs _prefs;

  Future<void> toggle() => set(!state);

  Future<void> set(bool muted) async {
    if (muted == state) return;
    state = muted;
    await _prefs.setShowcaseMuted(muted);
  }
}

final showcaseMutedProvider =
    StateNotifierProvider<ShowcaseMuteController, bool>(
  (ref) => ShowcaseMuteController(ref.watch(prefsProvider)),
);

/// Ko'rgazma burchagidagi ovoz tugmasi — qora shisha doira, oq ikonka.
///
/// Ko'rinadigan doira 40 px, bosish maydoni 48 px.
class ShowcaseMuteButton extends ConsumerWidget {
  const ShowcaseMuteButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final muted = ref.watch(showcaseMutedProvider);
    final label = muted ? l.actionUnmute : l.actionMute;
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        toggled: muted,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => ref.read(showcaseMutedProvider.notifier).toggle(),
          child: SizedBox(
            width: 48,
            height: 48,
            child: Center(
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: .42),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white.withValues(alpha: .5)),
                ),
                child: Icon(
                  muted ? NovaIcons.muted : NovaIcons.sound,
                  size: 19,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
