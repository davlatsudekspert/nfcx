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

import '../core/storage/secure_store.dart';
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

  /// Namuna (to'qima) biznes profili — serverdan `demo: true`.
  bool get isDemo => isBusiness && business!.isDemo;

  /// HAQIQATAN TASDIQLANGANMI (admin qo'ygan belgi).
  ///
  /// Kompaniyada bunday maydon hozircha yo'q — biznes profilining
  /// o'z nishoni bor (do'kon belgisi), shuning uchun u `false`
  /// qaytaradi va ikkita nishon ustma-ust tushmaydi.
  bool get verified => isBusiness ? false : id!.verified;

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

  /// Profil tepasidagi logoli aloqa tugmalari.
  ContactInfo get contact => isBusiness ? business!.contact : id!.contact;

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
final selectedPersonalCodeProvider = StateProvider<String?>((ref) {
  // Telefon xotirasi ulanmagan bo'lsa (ba'zi sinovlar) — tanlovsiz.
  try {
    return ref.watch(prefsProvider).selectedPersonal;
  } catch (_) {
    return null;
  }
});

/// FAOL SHAXSIY ID'NI TANLASH — YAGONA YO'L.
///
/// Holat va telefon xotirasi birga yangilanadi: ilova qayta ochilganda
/// ham shu ID faol bo'ladi. Rejim shaxsiyga o'tadi.
///
/// `ref` FAQAT BIRINCHI `await` GACHA ishlatiladi: tanlov o'zgarishi
/// bosilgan kartani qayta quradi va u yo'q qilinadi — keyin
/// `ref.read` StateError otardi va rejim almashmay qolardi (E2E #59).
Future<void> selectPersonal(WidgetRef ref, String code) async {
  final prefs = _prefsOrNull(ref);
  final mode = ref.read(modeProvider.notifier);
  ref.read(selectedPersonalCodeProvider.notifier).state = code;
  try {
    await prefs?.setSelectedPersonal(code);
  } catch (_) {/* xotira yo'q — faqat shu sessiya */}
  await mode.set(AppMode.personal);
}

/// Telefon xotirasi — ulanmagan bo'lsa (ba'zi sinovlar) `null`.
Prefs? _prefsOrNull(WidgetRef ref) {
  try {
    return ref.read(prefsProvider);
  } catch (_) {
    return null;
  }
}

/// TANLANGAN YOZUV — BUTUN RO'YXATDAN QIDIRILADI.
///
/// Qidiruv `personalIdsProvider` dan EMAS, `myIdsProvider` dan
/// boradi va bu ataylab.
///
/// `cards.profile_type = 'business'` — bu saytdagi KO'RINISH
/// uslubi, hisobdagi alohida kompaniya emas (kompaniyalar butunlay
/// boshqa manbadan, `myBusinessesProvider` dan keladi). Ya'ni
/// bunday yozuv ham foydalanuvchining o'z NFC ID'si va uni tanlash
/// mumkin bo'lishi kerak.
///
/// Filtrlangan ro'yxatdan qidirilganda haqiqiy hisobda aynan shu
/// sindi: `profileType` o'qiladigan bo'lgandan keyin ikkita yozuv
/// ro'yxatdan tushib qoldi va ular tanlanganda jimgina ASOSIY
/// profil ochilaverdi — odam boshqa profilga o'tdim deb o'ylab,
/// aslida eskisini ko'rib turardi.
final activePersonalProvider = Provider<NfcId?>((ref) {
  final all = ref.watch(myIdsProvider);
  final code = ref.watch(selectedPersonalCodeProvider);
  if (code != null) {
    final match = all.where((e) => e.code == code).firstOrNull;
    if (match != null) return match;
  }

  // Hech narsa tanlanmagan bo'lsa — odatiy shaxsiy ro'yxatdan
  // asosiysi.
  final list = ref.watch(personalIdsProvider);
  if (list.isEmpty) return null;
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
