import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../design/widgets/surfaces.dart';
import '../../l10n/gen/app_localizations.dart';

/// TIL TANLASH — birinchi ochilish va ixcham almashtirgich (egasi,
/// 2026-10: "chet elliklar ham yuklab oladi").
///
/// Til nomlari har doim O'Z TILIDA yoziladi (O‘zbekcha / Русский /
/// English) — tilni bilmagan odam ham o'zinikini topadi.
const kLanguages = <(String code, String native, String short)>[
  ('uz', 'O‘zbekcha', 'UZ'),
  ('ru', 'Русский', 'RU'),
  ('en', 'English', 'EN'),
];

String languageShort(String code) =>
    kLanguages.firstWhere((e) => e.$1 == code, orElse: () => kLanguages.first).$3;

/// Telefon tiliga qarab TAVSIYA (tanlovni foydalanuvchi qiladi).
/// O'zbekcha va ruscha to'g'ridan-to'g'ri; MDH tillarida rus tili
/// tushunarliroq; qolgan hammasiga — inglizcha.
String suggestedLanguage(Locale device) => switch (device.languageCode) {
      'uz' => 'uz',
      'ru' || 'kk' || 'ky' || 'tg' || 'be' || 'uk' => 'ru',
      _ => 'en',
    };

/// Uch tilli tanlov varag'i. [firstLaunch] — yopib bo'lmaydi, tanlov
/// tugmasi bilan saqlanadi (keyingi ochilishlarda qayta so'ralmaydi).
Future<void> showLanguageSheet(BuildContext context, WidgetRef ref,
    {bool firstLaunch = false}) {
  final current = firstLaunch
      ? suggestedLanguage(
          WidgetsBinding.instance.platformDispatcher.locale)
      : ref.read(localeProvider).languageCode;
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isDismissible: !firstLaunch,
    enableDrag: !firstLaunch,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _LanguageSheet(initial: current, firstLaunch: firstLaunch),
  );
}

class _LanguageSheet extends ConsumerStatefulWidget {
  const _LanguageSheet({required this.initial, required this.firstLaunch});
  final String initial;
  final bool firstLaunch;

  @override
  ConsumerState<_LanguageSheet> createState() => _LanguageSheetState();
}

class _LanguageSheetState extends ConsumerState<_LanguageSheet> {
  late String _code = widget.initial;

  Future<void> _choose(String code) async {
    setState(() => _code = code);
    // UI DARHOL shu tilga o'tadi (varaq ham).
    await ref.read(localeProvider.notifier).select(Locale(code));
    if (!widget.firstLaunch && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    final text = Theme.of(context).textTheme;
    return PopScope(
      canPop: !widget.firstLaunch,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(Gap.md),
          // Kichik ekran va katta shriftda ham sig'adi (scroll).
          child: ConstrainedBox(
            constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * .9),
            child: SingleChildScrollView(
            child: FloatingSurface(
            key: const ValueKey('language-sheet'),
            solid: true,
            padding: const EdgeInsets.fromLTRB(Gap.lg, Gap.xl, Gap.lg, Gap.lg),
            borderRadius: BorderRadius.circular(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.language_rounded, size: 28, color: t.accent2),
                const SizedBox(height: Gap.sm),
                Text(l.langChooseTitle,
                    textAlign: TextAlign.center,
                    style: AppType.displayStyle(color: t.text1, size: 24)),
                const SizedBox(height: Gap.xs),
                Text(l.langChooseBody,
                    textAlign: TextAlign.center,
                    style: text.bodySmall?.copyWith(color: t.text2)),
                const SizedBox(height: Gap.lg),
                for (final (code, native, short) in kLanguages) ...[
                  _LanguageRow(
                    key: ValueKey('lang-$code'),
                    native: native,
                    short: short,
                    selected: _code == code,
                    onTap: () => _choose(code),
                  ),
                  const SizedBox(height: Gap.sm),
                ],
                if (widget.firstLaunch) ...[
                  const SizedBox(height: Gap.sm),
                  NovaButton(
                    key: const ValueKey('lang-continue'),
                    label: l.actionContinue,
                    onPressed: () async {
                      await ref
                          .read(localeProvider.notifier)
                          .select(Locale(_code));
                      if (context.mounted) Navigator.of(context).pop();
                    },
                  ),
                ],
              ],
            ),
          ),
          ),
          ),
        ),
      ),
    );
  }
}

class _LanguageRow extends StatelessWidget {
  const _LanguageRow({
    super.key,
    required this.native,
    required this.short,
    required this.selected,
    required this.onTap,
  });

  final String native;
  final String short;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return PressableScale(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: Gap.lg, vertical: 14),
        decoration: BoxDecoration(
          color: selected ? t.wash(t.accent2, .10) : t.surface2,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: selected ? t.accent2 : t.border1),
        ),
        child: Row(
          children: [
            Text(short, style: AppType.monoStyle(color: t.text2, size: 12)),
            const SizedBox(width: Gap.md),
            Expanded(
              child: Text(native,
                  style: Theme.of(context)
                      .textTheme
                      .bodyLarge
                      ?.copyWith(color: t.text1)),
            ),
            if (selected)
              Icon(Icons.check_rounded, size: 20, color: t.accent2),
          ],
        ),
      ),
    );
  }
}

/// IXCHAM TIL ALMASHTIRGICH — `🌐 UZ`. Kirmagan foydalanuvchi uchun
/// birinchi ekranlarda (Welcome, kirish, ro'yxatdan o'tish, parol).
class LanguagePill extends ConsumerWidget {
  const LanguagePill({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final code = ref.watch(localeProvider).languageCode;
    return Semantics(
      button: true,
      label: L.of(context).settingsLanguage,
      child: PressableScale(
        key: const ValueKey('lang-pill'),
        onTap: () => showLanguageSheet(context, ref),
        child: SizedBox(
          height: 48,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: t.surfaceSolid,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: t.border1),
                boxShadow: t.shadowTiny,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.language_rounded, size: 16, color: t.text1),
                  const SizedBox(width: 6),
                  Text(languageShort(code),
                      style: AppType.monoStyle(color: t.text1, size: 12)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
