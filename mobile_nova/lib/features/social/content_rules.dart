import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../app/providers.dart';
import '../../core/storage/secure_store.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../design/widgets/buttons.dart';
import '../../l10n/gen/app_localizations.dart';

/// Kontent qoidalari darvozasi.
///
/// ## Bu bezak emas, BACKEND TALABI
///
/// `hosting/worker.js` post va istorya yaratishda tanada
/// `agreed: true` bo'lishini talab qiladi va bo'lmasa
/// `422 rules_not_accepted` qaytaradi (`rulesAcceptedD1`).
/// Ilova bu maydonni YUBORMAS edi — ya'ni ilovadan post ham,
/// istorya ham joylab bo'lmasdi.
///
/// ## Matn manbasi
///
/// Matn saytdagi `src/components/ContentRulesGate.jsx` dan AYNAN
/// ko'chirilgan. U yerda aniq yozilgan: "MATN EGASI BERGAN TAHRIRDA
/// — o'zgartirilmaydi, qisqartirilmaydi". Uch tilning hammasi
/// saytning `translations.js` faylidan olingan, ya'ni saytda va
/// ilovada foydalanuvchi AYNAN bir xil matnni o'qiydi.
///
/// ## UX
///
/// Birinchi marta — to'liq matn va belgilash katakchasi. Keyingi
/// safar — publish tugmasi ostida bitta qatorli eslatma; har bir
/// oddiy postda modal oyna chiqaravermaydi. Rozilik `prefs` da
/// saqlanadi, lekin serverga HAR SAFAR yuboriladi.
///
/// Qoidalarni istalgan vaqtda Sozlamalardan qayta ochish mumkin.

class ContentRules extends StateNotifier<bool> {
  ContentRules(this._prefs) : super(_prefs.contentRulesAccepted);

  final Prefs _prefs;

  Future<void> accept() async {
    state = true;
    await _prefs.setContentRulesAccepted(true);
  }
}

final contentRulesProvider =
    StateNotifierProvider<ContentRules, bool>((ref) {
  return ContentRules(ref.watch(prefsProvider));
});

/// Qoidalar darvozasidan o'tkazadi.
///
/// Qaytadi: `true` — davom etish mumkin (rozilik bor yoki hozir
/// berildi), `false` — foydalanuvchi bekor qildi.
///
/// [force] `true` bo'lsa rozilik avval berilgan bo'lsa ham to'liq
/// matn ko'rsatiladi (Sozlamalardan ochilganda).
Future<bool> ensureContentRules(
  BuildContext context,
  WidgetRef ref, {
  bool force = false,
}) async {
  if (!force && ref.read(contentRulesProvider)) return true;

  final accepted = await showModalBottomSheet<bool>(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
        // Qoidalarni o'qimasdan chetlab o'tish uchun tashqariga bosish
        // YETARLI EMAS: "Bekor qilish" ataylab bosilishi kerak.
        isDismissible: false,
        enableDrag: false,
        builder: (_) => const _RulesSheet(),
      ) ??
      false;

  if (accepted && context.mounted) {
    await ref.read(contentRulesProvider.notifier).accept();
  }
  return accepted;
}

class _RulesSheet extends StatefulWidget {
  const _RulesSheet();

  @override
  State<_RulesSheet> createState() => _RulesSheetState();
}

class _RulesSheetState extends State<_RulesSheet> {
  bool _checked = false;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final l = L.of(context);

    return Padding(
      padding: EdgeInsets.only(
        left: Gap.lg,
        right: Gap.lg,
        bottom: MediaQuery.viewPaddingOf(context).bottom + Gap.lg,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: R.soft,
          border: Border.all(color: t.border2),
        ),
        padding: const EdgeInsets.all(Gap.xl),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.gavel_rounded, size: 19, color: t.warn),
                  const SizedBox(width: Gap.sm),
                  Expanded(
                    child: Text(l.rulesTitle,
                        style: Theme.of(context).textTheme.titleMedium),
                  ),
                ],
              ),
              const SizedBox(height: Gap.lg),
              Text(l.rulesBody,
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: Gap.lg),
              // Katakcha qatorining HAMMASI bosiladi — kichik kvadratni
              // aniq nishonga olish shart emas.
              InkWell(
                onTap: () => setState(() => _checked = !_checked),
                borderRadius: R.tile,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: Gap.sm),
                  child: Row(
                    children: [
                      Checkbox(
                        value: _checked,
                        onChanged: (v) => setState(() => _checked = v ?? false),
                        activeColor: t.accent2,
                        checkColor: t.onAccent,
                      ),
                      Expanded(
                        child: Text(l.rulesAccept,
                            style: Theme.of(context).textTheme.bodyMedium),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Gap.lg),
              NovaButton(
                label: l.rulesContinue,
                onPressed: _checked
                    ? () => Navigator.of(context).pop(true)
                    : null,
              ),
              const SizedBox(height: Gap.sm),
              NovaButton(
                label: l.actionCancel,
                tone: ButtonTone.quiet,
                onPressed: () => Navigator.of(context).pop(false),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Publish tugmasi ostidagi bir qatorli eslatma.
///
/// Rozilik allaqachon berilgan bo'lsa ham qoidalar ko'rinib turadi,
/// lekin yo'lni to'smaydi. Bosilsa to'liq matn ochiladi.
class ContentRulesNote extends ConsumerWidget {
  const ContentRulesNote({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final l = L.of(context);
    return GestureDetector(
      onTap: () => ensureContentRules(context, ref, force: true),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: Gap.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.info_outline_rounded, size: 14, color: t.text3),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                l.rulesReminder,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
