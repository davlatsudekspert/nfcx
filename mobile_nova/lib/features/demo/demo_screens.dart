import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../business/business_screens.dart';
import '../profile/profile_screen.dart';
import 'demo_data.dart';
import 'demo_mode.dart';

/// DEMO EKRANLAR — YANGI EKRAN EMAS.
///
/// Ikkalasi ham ODDIY ekranning o'zini ochadi, faqat atrofiga
/// `ProviderScope` o'raladi va o'sha scope ichida repozitoriylar
/// demo ma'lumot beradiganlar bilan almashtiriladi.
///
/// Shu sabab:
///   * demo profil AYNAN haqiqiy profil ekrani — "ikkinchi versiya"
///     saqlanmaydi va vaqt o'tib ikkisi bir-biridan uzoqlashmaydi;
///   * almashtirish faqat SHU DARAXTDA yashaydi — undan tashqarida
///     ilova avvalgidek serverdan o'qiydi;
///   * demo ma'lumot hech qachon "Mening ID'larim" ga yoki lentaga
///     tushmaydi, chunki u umuman boshqa daraxtdagi holat.

class DemoPersonalScreen extends StatelessWidget {
  const DemoPersonalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        ...demoOverrides(),
        demoModeProvider.overrideWithValue(const DemoInfo(shareUrl: kApiBase)),
      ],
      child: const ProfileScreen(code: kDemoPersonalCode),
    );
  }
}

class DemoBusinessScreen extends StatelessWidget {
  const DemoBusinessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      overrides: [
        ...demoOverrides(),
        demoModeProvider.overrideWithValue(const DemoInfo(shareUrl: kApiBase)),
      ],
      child: const StorefrontScreen(companyId: kDemoBusinessId),
    );
  }
}

/// DEMO KODINI TANIYDI.
///
/// Demo profil ichidan ochilgan istorya yoki post YANGI marshrut
/// bo'lib ochiladi, ya'ni demo `ProviderScope` dan TASHQARIDA
/// qoladi va serverdan o'qishga urinadi. Natijada demo profilning
/// istoryasi bo'sh chiqardi.
///
/// Shuning uchun marshrutning o'zi kodga qaraydi: demo kodi bo'lsa
/// ekran yana demo daraxtiga o'raladi. Haqiqiy kodlarga bu shart
/// umuman tegmaydi.
bool isDemoCode(String code) =>
    code == kDemoPersonalCode || code == kDemoBusinessId;

Widget demoWrap(String code, Widget child) {
  if (!isDemoCode(code)) return child;
  return ProviderScope(
    overrides: [
      ...demoOverrides(),
      demoModeProvider.overrideWithValue(const DemoInfo(shareUrl: kApiBase)),
    ],
    child: child,
  );
}

