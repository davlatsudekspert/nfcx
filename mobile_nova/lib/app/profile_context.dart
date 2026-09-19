/// FAOL PROFIL KONTEKSTI — ilovadagi YAGONA haqiqat manbai.
///
/// ## Nima uchun kerak bo'ldi
///
/// Ilgari "Shaxsiy | Biznes" almashtirgichi faqat `AppMode` enumini
/// o'zgartirardi, faol profilni esa `activeIdProvider` tanlardi:
///
///     final want = mode == AppMode.business
///         ? NfcIdKind.business : NfcIdKind.personal;
///     final match = ids.where((e) => e.kind == want);
///     if (match.isNotEmpty) return ...;
///     return ids.firstWhere((e) => e.primary, orElse: () => ids.first);
///
/// Ya'ni biznes rejimi `kind == business` bo'lgan NFC YOZUVINI
/// izlardi. Lekin biznes NFC yozuvi emas — u KOMPANIYA
/// (`/api/my/companies`, `companies` jadvali). Hisobda biznes
/// turidagi yozuv bo'lmaganda `match` bo'sh qolib, funksiya
/// ASOSIY SHAXSIY yozuvga qaytardi.
///
/// Natijada: tugma "Biznes" ga o'tardi, rang o'zgarardi, lekin
/// ekranda o'sha shaxsiy profil — ism, avatar, VIP001 va shaxsiy
/// statistika — qolaverardi. Hech qanday xato chiqmasdi, shuning
/// uchun buni faqat ekranga qarab bilish mumkin edi.
///
/// ## Qoida
///
/// Shaxsiy kontekst — `NfcId`.
/// Biznes kontekst — `Business` (kompaniya).
/// Ikkalasi BIR-BIRIGA ALMASHTIRILMAYDI.
///
/// ## Egalik
///
/// Bu yerda faqat foydalanuvchining O'Z yozuvlari va O'Z
/// kompaniyalari bor: ro'yxatlar `/api/auth/me` va
/// `/api/my/companies` dan keladi. Ya'ni kontekstni almashtirib
/// birovning biznesini ochib bo'lmaydi — ro'yxatga u umuman
/// tushmaydi. Yozish amallarida esa server egalikni yana o'zi
/// tekshiradi (`not_owner`, `not_your_code`).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/models.dart';
import '../features/auth/session.dart';
import '../features/business/business_providers.dart';
import 'providers.dart';



enum ProfileKind { personal, business }

/// Ekranlar uchun yagona ko'rinish.
///
/// Home va Profil bir xil maydonlarni chizadi, manba esa shaxsiy
/// yozuv yoki kompaniya bo'lishi mumkin. Shu sabab bu yerda
/// UMUMIY nomlar bor — ekran `if (business) ... else ...` yozib
/// o'tirmaydi.
class ActiveProfile {
  const ActiveProfile._({
    required this.kind,
    this.id,
    this.business,
  });

  const ActiveProfile.personal(NfcId this.id)
      : kind = ProfileKind.personal,
        business = null;

  const ActiveProfile.company(Business this.business)
      : kind = ProfileKind.business,
        id = null;

  final ProfileKind kind;
  final NfcId? id;
  final Business? business;

  bool get isBusiness => kind == ProfileKind.business;

  /// Ommaviy manzildagi kod: shaxsiyda NFC kodi, bizneda
  /// `companyId`.
  String get code => isBusiness ? business!.companyId : id!.code;

  String get name => isBusiness ? business!.displayName : id!.name;

  String get avatarUrl => isBusiness ? business!.logoUrl : id!.avatarUrl;

  String get coverUrl => isBusiness ? business!.coverUrl : id!.coverUrl;

  /// Shaxsiyda lavozim, bizneda toifa — sarlavha ostidagi qator.
  String get subtitle =>
      isBusiness ? business!.category : id!.role;

  String get bio => isBusiness ? business!.description : id!.bio;

  int get followers => isBusiness ? business!.followers : id!.followers;

  /// Kompaniyada "obunalar" tushunchasi yo'q — u odamlarni
  /// kuzatmaydi. Nol qaytariladi va ekran raqamni ko'rsatadi;
  /// to'qilgan qiymat emas.
  int get following => isBusiness ? 0 : id!.following;

  int get posts => isBusiness ? 0 : id!.posts;

  /// Musiqa faqat shaxsiy kartada bor (`cards.music_url`).
  List<String> get musicUrls =>
      isBusiness ? const <String>[] : id!.musicUrls;
}

/// Foydalanuvchining SHAXSIY yozuvlari.
///
/// Hisobda biznes turidagi yozuv bo'lishi ham mumkin, shuning
/// uchun bu yerda tur bo'yicha ajratiladi. Agar birorta yozuv
/// turi belgilanmagan bo'lsa (eski ma'lumot), hammasi shaxsiy
/// hisoblanadi — aks holda ro'yxat bo'sh qolib, ilova profilsiz
/// ko'rinardi.
final personalIdsProvider = Provider<List<NfcId>>((ref) {
  final ids = ref.watch(myIdsProvider);
  final personal =
      ids.where((e) => e.kind == NfcIdKind.personal).toList();
  return personal.isEmpty ? ids : personal;
});

/// Tanlangan shaxsiy yozuv kodi — bir nechta bo'lganda.
final selectedPersonalCodeProvider = StateProvider<String?>((_) => null);

final activePersonalProvider = Provider<NfcId?>((ref) {
  final list = ref.watch(personalIdsProvider);
  if (list.isEmpty) return null;
  final code = ref.watch(selectedPersonalCodeProvider);
  if (code != null) {
    final match = list.where((e) => e.code == code).firstOrNull;
    if (match != null) return match;
  }
  return list.firstWhere((e) => e.primary, orElse: () => list.first);
});

/// FAOL PROFIL.
///
/// Biznes rejimi so'ralgan bo'lsa-yu, kompaniya bo'lmasa —
/// shaxsiyga QAYTMAYDI va `null` qaytaradi. Ekran shunda "biznes
/// yo'q" holatini ko'rsatadi. Jimgina shaxsiyga qaytish aynan
/// avvalgi xatoning o'zi bo'lardi: foydalanuvchi "Biznes" ni
/// ko'rib, shaxsiy ma'lumotini o'qigan bo'lardi.
final activeProfileProvider = Provider<ActiveProfile?>((ref) {
  final mode = ref.watch(modeProvider);
  if (mode == AppMode.business) {
    final b = ref.watch(activeBusinessProvider);
    return b == null ? null : ActiveProfile.company(b);
  }
  final id = ref.watch(activePersonalProvider);
  return id == null ? null : ActiveProfile.personal(id);
});

/// Biznes rejimi so'ralgan, lekin hisobda kompaniya yo'q.
///
/// Bu YUKLANISHDAN farq qiladi: ro'yxat hali kelmagan bo'lsa
/// `false`, kelib bo'sh chiqsa `true`.
final businessMissingProvider = Provider<bool>((ref) {
  if (ref.watch(modeProvider) != AppMode.business) return false;
  final async = ref.watch(myBusinessesProvider);
  return async.hasValue && async.requireValue.isEmpty;
});

/// Tanlagich kerakmi — bittadan ko'p bo'lsagina.
final hasBusinessChoiceProvider = Provider<bool>((ref) =>
    (ref.watch(myBusinessesProvider).valueOrNull ?? const <Business>[])
        .length >
    1);

final hasPersonalChoiceProvider =
    Provider<bool>((ref) => ref.watch(personalIdsProvider).length > 1);
