import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/profile_context.dart';
import '../../app/providers.dart';
import '../../data/models/models.dart';
import '../../design/theme/typography.dart';
import '../../design/tokens/nfc_tokens.dart';
import '../../design/tokens/shapes.dart';
import '../../l10n/gen/app_localizations.dart';
import '../business/business_providers.dart';
import '../home/widgets/avatar.dart';

/// PROFIL TANLAGICH.
///
/// Rejim almashganda qaysi profilga o'tish kerakligini hal qiladi:
///
/// * bitta bo'lsa — darhol o'sha ochiladi, ortiqcha bosish yo'q;
/// * bir nechta bo'lsa — shu varaq chiqadi.
///
/// Ro'yxat FAQAT egalik qilingan yozuvlardan tuziladi
/// (`/api/auth/me` va `/api/my/companies`), shuning uchun bu yerdan
/// birovning profiliga o'tib bo'lmaydi.
Future<void> switchToBusiness(BuildContext context, WidgetRef ref) async {
  final list = await ref.read(myBusinessesProvider.future);
  if (!context.mounted) return;

  // Kompaniya yo'q — rejimni baribir o'zgartiramiz, ekran esa
  // "biznes yo'q" holatini ko'rsatadi. Jimgina shaxsiyda qoldirish
  // aldov bo'lardi.
  if (list.isEmpty) {
    await ref.read(modeProvider.notifier).set(AppMode.business);
    return;
  }

  if (list.length == 1) {
    ref.read(selectedBusinessProvider.notifier).state = list.first.companyId;
    await ref.read(modeProvider.notifier).set(AppMode.business);
    return;
  }

  final picked = await _pick<Business>(
    context,
    title: L.of(context).profilePickBusiness,
    items: list,
    selected: ref.read(selectedBusinessProvider) ?? list.first.companyId,
    idOf: (b) => b.companyId,
    nameOf: (b) => b.displayName.isEmpty ? b.companyId : b.displayName,
    imageOf: (b) => b.logoUrl,
  );
  if (picked == null || !context.mounted) return;
  ref.read(selectedBusinessProvider.notifier).state = picked.companyId;
  await ref.read(modeProvider.notifier).set(AppMode.business);
}

/// Shaxsiy rejimga o'tish — bir nechta NFC ID bo'lsa tanlatadi.
Future<void> switchToPersonal(BuildContext context, WidgetRef ref) async {
  final list = ref.read(personalIdsProvider);
  if (list.length <= 1) {
    await ref.read(modeProvider.notifier).set(AppMode.personal);
    return;
  }

  final picked = await _pick<NfcId>(
    context,
    title: L.of(context).profilePickPersonal,
    items: list,
    selected: ref.read(activePersonalProvider)?.code ?? list.first.code,
    idOf: (e) => e.code,
    nameOf: (e) => e.name.isEmpty ? e.code : e.name,
    imageOf: (e) => e.avatarUrl,
  );
  if (picked == null || !context.mounted) return;
  ref.read(selectedPersonalCodeProvider.notifier).state = picked.code;
  await ref.read(modeProvider.notifier).set(AppMode.personal);
}

/// Faol profilni ALMASHTIRISH — rejimni o'zgartirmasdan.
///
/// Profil ekranidagi sarlavhani bosganda chaqiriladi: foydalanuvchi
/// allaqachon biznes rejimida turib, boshqa kompaniyaga o'tmoqchi.
Future<void> pickWithinCurrentMode(BuildContext context, WidgetRef ref) async {
  final business = ref.read(modeProvider) == AppMode.business;
  if (business) {
    final list = ref.read(myBusinessesProvider).valueOrNull ?? const <Business>[];
    if (list.length <= 1) return;
    final picked = await _pick<Business>(
      context,
      title: L.of(context).profilePickBusiness,
      items: list,
      selected: ref.read(selectedBusinessProvider) ?? list.first.companyId,
      idOf: (b) => b.companyId,
      nameOf: (b) => b.displayName.isEmpty ? b.companyId : b.displayName,
      imageOf: (b) => b.logoUrl,
    );
    if (picked != null) {
      ref.read(selectedBusinessProvider.notifier).state = picked.companyId;
    }
    return;
  }
  final list = ref.read(personalIdsProvider);
  if (list.length <= 1) return;
  final picked = await _pick<NfcId>(
    context,
    title: L.of(context).profilePickPersonal,
    items: list,
    selected: ref.read(activePersonalProvider)?.code ?? list.first.code,
    idOf: (e) => e.code,
    nameOf: (e) => e.name.isEmpty ? e.code : e.name,
    imageOf: (e) => e.avatarUrl,
  );
  if (picked != null) {
    ref.read(selectedPersonalCodeProvider.notifier).state = picked.code;
  }
}

Future<T?> _pick<T>(
  BuildContext context, {
  required String title,
  required List<T> items,
  required String selected,
  required String Function(T) idOf,
  required String Function(T) nameOf,
  required String Function(T) imageOf,
}) {
  final t = context.tokens;
  return showModalBottomSheet<T>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (sheet) => SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.all(Gap.md),
        padding: const EdgeInsets.symmetric(vertical: Gap.lg),
        decoration: BoxDecoration(
          color: t.surfaceSolid,
          borderRadius: R.soft,
          border: Border.all(color: t.border2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: t.border1,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: Gap.lg),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: Gap.screenX),
              child: Text(title,
                  style: Theme.of(context).textTheme.titleMedium),
            ),
            const SizedBox(height: Gap.lg),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(horizontal: Gap.md),
                itemCount: items.length,
                itemBuilder: (_, i) {
                  final e = items[i];
                  final id = idOf(e);
                  final active = id == selected;
                  final name = nameOf(e);
                  return Padding(
                    padding: const EdgeInsets.only(bottom: Gap.sm),
                    child: Material(
                      color: active ? t.surface2 : Colors.transparent,
                      borderRadius: R.tile,
                      child: InkWell(
                        borderRadius: R.tile,
                        onTap: () => Navigator.of(sheet).pop(e),
                        child: Padding(
                          padding: const EdgeInsets.all(Gap.md),
                          child: Row(
                            children: [
                              Avatar(
                                url: imageOf(e),
                                initials: name.isEmpty
                                    ? '·'
                                    : name.characters.first.toUpperCase(),
                                size: 42,
                                ring: false,
                              ),
                              const SizedBox(width: Gap.md),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall),
                                    const SizedBox(height: 2),
                                    Text(
                                      id,
                                      style: AppType.monoStyle(
                                          color: t.text3, size: 11,
                                          letterSpacing: 1.2),
                                    ),
                                  ],
                                ),
                              ),
                              if (active)
                                Icon(Icons.check_circle_rounded,
                                    size: 20, color: t.accent2),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
