import 'package:flutter/widgets.dart';

import '../../design/components/icons.dart';
import '../../design/components/identity_card.dart';
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
///
/// KO'RINISH — `FilterChip` uslubi: radius `R.chip`, ko'rinadigan
/// balandligi 36 dp. Bosish maydoni esa `Press(minSize: S.tap)` bilan
/// 48 dp gacha kengaytiriladi — chip kichkina bo'lsa ham barmoq
/// adashmaydi.
///
/// TARIFNI NUQTA KO'RSATADI (`TierDot`), rang emas: kod matni har
/// doim yozilgan turadi, ya'ni holat faqat rangga tayanmaydi.
class IdChip extends StatelessWidget {
  const IdChip({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final active = state.active;
    final code = active?.code ?? '—';

    return Press(
      haptic: true,
      onTap: () => showIdentitySwitcher(context),
      minSize: S.tap,
      scale: .95,
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: S.x12),
        decoration: BoxDecoration(
          gradient: C.raisedSurface,
          borderRadius: BorderRadius.circular(R.chip),
          border: Border.all(color: C.line),
        ),
        // `alignment` o'rniga `Align(widthFactor: 1)` — aks holda chip
        // `Row` ichida butun kenglikka cho'zilardi.
        child: Align(
          widthFactor: 1,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (active != null) ...[
                TierDot(identityTier(active), size: 9),
                const SizedBox(width: 7),
              ],
              Text(code, style: T.code(13)),
              const SizedBox(width: 5),
              NIcon(Ico.chevronDown, size: 13, color: C.ink3),
            ],
          ),
        ),
      ),
    );
  }
}
