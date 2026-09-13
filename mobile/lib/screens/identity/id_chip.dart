import 'package:flutter/widgets.dart';
import '../../design/components/press.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import 'switcher.dart';

/// FAOL SHAXS CHIPI — almashtirgichning tugmasi.
///
/// Handoff talabi: bu chip Home, Discover, NFC va Profile ekranlarida
/// BIR XIL nisbiy joyda turishi kerak (sarlavha qatorining o'ng
/// chekkasi). Shuning uchun u alohida widget — har ekranda qaytadan
/// yozilsa, joyi sekin-asta siljib ketardi.
class IdChip extends StatelessWidget {
  const IdChip({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final code = state.active?.code ?? '—';
    return Press(
      haptic: true,
      onTap: () => showIdentitySwitcher(context),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: S.x12, vertical: 7),
        decoration: BoxDecoration(
          gradient: C.cardSurface,
          borderRadius: BorderRadius.circular(R.chip),
          border: Border.all(color: C.warmHairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(code, style: T.code.copyWith(fontSize: 11.5)),
            const SizedBox(width: 6),
            const Text('⌄', style: TextStyle(color: C.ash, fontSize: 12, height: 1)),
          ],
        ),
      ),
    );
  }
}
