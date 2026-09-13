import 'package:flutter/widgets.dart';
import '../../design/components/icons.dart';
import '../../design/components/press.dart';
import '../../design/components/states.dart';
import '../../design/components/surface.dart';
import '../../design/nav.dart';
import '../../design/tokens.dart';
import '../../design/type.dart';
import '../../state/app_state.dart';
import '../settings/settings_screen.dart';
import 'profile_screen.dart';
import 'switcher.dart';
import '../nfc/id_catalog.dart';
import '../../l10n/strings.dart';

/// PROFILE tabi — faol shaxsning profili.
///
/// Kompaniya ALOHIDA TAB EMAS: biznesni boshqarish — bu shaxsni
/// almashtirish, ya'ni almashtirgich orqali. Shuning uchun bu yerda
/// faol shaxs profili to'g'ridan-to'g'ri ochiladi va yuqorida
/// almashtirish tugmasi turadi.
class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final active = state.active;

    if (active == null) {
      return SafeArea(
        child: Column(
          children: [
            const SizedBox(height: S.x44),
            EmptyState(
              tr('ID tanlaganingizdan keyin profil shu yerda ochiladi.'),
              title: tr('Shaxsingiz yo‘q'),
              icon: Ico.user,
              actionLabel: tr('ID tanlash'),
              onAction: () => push(context, (_) => const IdCatalogScreen()),
            ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.all(S.gutter),
              child: Press(
                onTap: () => push(context, (_) => const SettingsScreen()),
                child: Surface(
                  shadow: E.e1,
                  child: Row(
                    children: [
                      const NIcon(Ico.settings, size: 19, color: C.ash),
                      const SizedBox(width: S.x12),
                      Expanded(child: Text(tr('Sozlamalar'), style: T.cardTitle)),
                      const NIcon(Ico.chevronRight, size: 17, color: C.muted),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    // Profil ekrani o'z sarlavha qatorini chizadi; bu yerda faqat
    // almashtirish va sozlamalar tugmalari qo'shiladi.
    return Stack(
      children: [
        Positioned.fill(
          child: ProfileScreen(
            key: ValueKey(active.code),
            identity: active,
          ),
        ),
        Positioned(
          top: MediaQuery.paddingOf(context).top + 8,
          right: S.x12,
          child: Row(
            children: [
              Press(
                haptic: true,
                onTap: () => showIdentitySwitcher(context),
                child: Padding(
                  padding: EdgeInsets.all(S.x8),
                  child: NIcon(Ico.refresh, size: 20, color: C.champagne),
                ),
              ),
              Press(
                onTap: () => push(context, (_) => const SettingsScreen()),
                child: const Padding(
                  padding: EdgeInsets.all(S.x8),
                  child: NIcon(Ico.settings, size: 20, color: C.offWhite),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
