import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
