import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../l10n/gen/app_localizations.dart';
import '../../routing/routes.dart';

/// Ro'yxatdan o'tishda tanlangan hisob turi.
///
/// Egasining talabi (Play testerlari fikridan keyin): ro'yxatdan
/// o'tishning BOSHIDA "Shaxsiy yoki Biznes" so'ralsin. Hisobning o'zi
/// serverda baribir SHAXSIY yaratiladi — biznes har doim hisobga
/// biriktirilgan alohida kompaniya (`/api/companies`). Shuning uchun
/// tanlov serverga yuborilmaydi: u faqat ro'yxatdan o'tgach odamni
/// qayerga olib borishni belgilaydi.
///
/// Xotirada turadi, diskda emas: ro'yxatdan o'tish bitta seansda
/// tugaydi. Ilova yopilib qolsa odam oddiy bosh sahifaga tushadi va
/// "Biznes ochish" tugmasi u yerda ham bor — hech narsa yo'qolmaydi.
enum SignupAccountType { personal, business }

final signupAccountTypeProvider =
    StateProvider<SignupAccountType?>((_) => null);

/// Ro'yxatdan o'tish oqimini YAKUNLASH — profil sozlangandan keyin.
///
/// Biznes tanlagan odam avval bosh sahifaga tushadi, ustiga esa
/// Business intro ochiladi. Shunday qilib "orqaga" bosilsa u bo'sh
/// ekranga emas, o'z bosh sahifasiga qaytadi.
void finishSignup(BuildContext context, WidgetRef ref) {
  final type = ref.read(signupAccountTypeProvider);
  ref.read(signupAccountTypeProvider.notifier).state = null;
  final router = GoRouter.of(context);
  router.go(Routes.home);
  if (type == SignupAccountType.business) {
    WidgetsBinding.instance
        .addPostFrameCallback((_) => router.push(Routes.businessIntro));
  }
}

/// "SHAXSIY YOKI BIZNES" TANLOVI — BITTA JOYDA.
///
/// Ikki ekranda kerak:
///   * ro'yxatdan o'tishning birinchi qadamida;
///   * ijtimoiy kirish bilan YANGI hisob ochilganda — profil sozlash
///     ekranida, chunki u yerda bu savol hali berilmagan bo'ladi.
///
/// Ilgari u `register_screen.dart` ichida yashiringan edi. Ikkinchi
/// ekranda ham kerak bo'lgach nusxa olish o'rniga shu yerga
/// ko'chirildi: nusxa olinsa, biri o'zgarib ikkinchisi qolib ketardi.

/// Hisob turi — ikki katta karta.
///
/// Tanlangani siyoh chegara va belgi bilan ajraladi, rang bilan emas:
/// ivory mavzusida oltin faqat brend tafsilotlarida.
class SignupTypePicker extends StatelessWidget {
  const SignupTypePicker({
    super.key,
    required this.value,
    required this.onChanged,
    this.error,
  });

  final SignupAccountType? value;
  final ValueChanged<SignupAccountType> onChanged;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final t = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TypeCard(
          key: const ValueKey('signup-type-personal'),
          icon: Icons.person_outline_rounded,
          title: l.modePersonal,
          hint: l.accountPersonalHint,
          selected: value == SignupAccountType.personal,
          onTap: () => onChanged(SignupAccountType.personal),
        ),
        const SizedBox(height: Gap.md),
        _TypeCard(
          key: const ValueKey('signup-type-business'),
          icon: Icons.storefront_outlined,
          title: l.modeBusiness,
          hint: l.accountBusinessHint,
          selected: value == SignupAccountType.business,
          onTap: () => onChanged(SignupAccountType.business),
        ),
        if (error != null) ...[
          const SizedBox(height: Gap.md),
          Text(
            error!,
            style: TextStyle(
              fontFamily: AppType.sans,
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: t.error,
            ),
          ),
        ],
      ],
    );
  }
}

class _TypeCard extends StatelessWidget {
  const _TypeCard({
    super.key,
    required this.icon,
    required this.title,
    required this.hint,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String hint;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Semantics(
      button: true,
      selected: selected,
      label: title,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.all(Gap.lg),
          decoration: BoxDecoration(
            color: t.surfaceSolid,
            borderRadius: R.gentle,
            border: Border.all(
              color: selected ? t.text1 : t.border1,
              width: selected ? 1.6 : 1,
            ),
            boxShadow: t.shadowSoft,
          ),
          child: Row(
            children: [
              // Tanlangani — siyoh doira, oltin hoshiya, ichida sirt
              // rangidagi belgi (Asosiy sahifadagi tezkor amallar kabi).
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: selected ? t.text1 : t.surface2,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? t.brand.withValues(alpha: .55)
                        : t.border1,
                  ),
                ),
                child: Icon(icon,
                    size: 21, color: selected ? t.surfaceSolid : t.text1),
              ),
              const SizedBox(width: Gap.md + 2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: AppType.displayStyle(
                            color: t.text1, size: 22, height: 1.1)),
                    const SizedBox(height: 3),
                    Text(hint, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              const SizedBox(width: Gap.sm),
              AnimatedOpacity(
                opacity: selected ? 1 : 0,
                duration: const Duration(milliseconds: 200),
                child: Icon(Icons.check_circle_rounded,
                    size: 22, color: t.text1),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
