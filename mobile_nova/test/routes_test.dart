import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nfcstore_nova/routing/routes.dart';

import 'helpers.dart';

/// "O'lik marshrut qolmasin" talabini MASHINA tekshiradi.
///
/// Ro'yxatni qo'lda yuritish foydasiz: yangi ekran qo'shilganda uni
/// bu yerga kiritish unutiladi. Shuning uchun test `Routes` dagi HAR
/// BIR yo'lni oladi va routerdan uni yecha olishini so'raydi.
final testSource = File('test/routes_test.dart').readAsStringSync();

void main() {
  late GoRouter router;

  setUp(() => router = buildTestRouter());

  /// `Routes` sinfidagi barcha statik yo'llar.
  const staticPaths = <String>[
    Routes.splash,
    Routes.welcome,
    Routes.login,
    Routes.loginVerify,
    Routes.register,
    Routes.registerVerify,
    Routes.profileSetup,
    Routes.home,
    Routes.discover,
    Routes.reels,
    Routes.nfc,
    Routes.profile,
    Routes.postCreate,
    Routes.storyCreate,
    Routes.reelCreate,
    Routes.nfcIds,
    Routes.nfcScan,
    Routes.nfcHistory,
    Routes.nfcCards,
    Routes.nfcSecurity,
    Routes.profileEdit,
    Routes.business,
    Routes.businessOnboard,
    Routes.businessDashboard,
    Routes.businessEdit,
    Routes.businessCatalog,
    Routes.businessAnalytics,
    Routes.businessProductNew,
    Routes.shop,
    Routes.checkout,
    Routes.orders,
    Routes.activity,
    Routes.settings,
    Routes.settingsSecurity,
    Routes.settingsLanguage,
    Routes.settingsTheme,
    Routes.settingsNotifications,
    Routes.settingsPrivacy,
    Routes.settingsPayment,
    Routes.settingsReferral,
    Routes.settingsPremium,
    Routes.settingsSupport,
    Routes.settingsAbout,
    Routes.paymentHistory,
    // `giftOffers` bu yerda YO'Q edi — yangi meta-sinov topdi.
    Routes.giftOffers,
  ];

  /// Parametrli yo'llar — namunaviy qiymat bilan.
  final dynamicPaths = <String>[
    Routes.post(1),
    Routes.story('48210377'),
    Routes.user('48210377'),
    Routes.nfcId('48210377'),
    Routes.nfcIdEdit('48210377'),
    Routes.nfcGift('48210377'),
    Routes.businessProduct(7),
    Routes.storefront('nova'),
    Routes.shopProduct('nfc-black'),
    Routes.paymentResult('success'),
    // "NFC Mobile" bo'limidagi namuna profillar.
    Routes.demoPersonal,
    Routes.demoBusiness,
  ];

  test('har bir statik marshrut routerda mavjud', () {
    for (final path in staticPaths) {
      expect(
        routeExists(router, path),
        isTrue,
        reason: 'Marshrut topilmadi: $path',
      );
    }
  });

  test('har bir parametrli marshrut routerda mavjud', () {
    for (final path in dynamicPaths) {
      expect(
        routeExists(router, path),
        isTrue,
        reason: 'Marshrut topilmadi: $path',
      );
    }
  });

  test('noma’lum manzil xato sahifasiga tushadi, qulamaydi', () {
    expect(routeExists(router, '/bunday-yol-yoq'), isFalse);
  });

  test('App Links BUTUN domenni da\'vo qilmaydi', () {
    // Ilgari manifestda shunday edi:
    //
    //     <data android:scheme="https" android:host="nfcstore.uz"/>
    //
    // YO'LSIZ. Ya'ni ilova `https://nfcstore.uz/*` ning HAMMASINI
    // da'vo qilardi: bosh sahifa, do'kon, blog, admin, to'lov.
    // Ilovada ular uchun ekran yo'q, ustiga `https://nfcstore.uz/`
    // `Routes.splash` (`/`) ga mos kelib, sayt o'rniga ilova
    // ochilardi.
    final manifest =
        File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

    // VIEW filtri (brauzer havolasi) — faqat `pathPrefix` bilan.
    final viewFilter = RegExp(
      r'<intent-filter android:autoVerify="true">(.*?)</intent-filter>',
      dotAll: true,
    ).firstMatch(manifest);
    expect(viewFilter, isNotNull, reason: 'App Links filtri yo\'q');

    final body = viewFilter!.group(1)!;
    final hostOnly = RegExp(
      r'<data[^>]*android:host="nfcstore\.uz"(?![^>]*pathPrefix)[^>]*/>',
    );
    expect(hostOnly.hasMatch(body), isFalse,
        reason: 'App Links filtrida YO\'LSIZ host da\'vosi bor — '
            'ilova saytning hamma havolasini yutib yuboradi');
    expect(body.contains('pathPrefix'), isTrue,
        reason: 'App Links filtrida `pathPrefix` yo\'q');
  });

  test('`Routes` dagi HAR BIR statik yo\'l ro\'yxatda bor', () {
    // BU SINOV SINOVNI TEKSHIRADI.
    //
    // Yuqoridagi `staticPaths` QO'LDA yuritiladi, hujjat izohi esa
    // "test `Routes` dagi HAR BIR yo'lni oladi" deb va'da beradi.
    // Ikkisi bir xil emas: yangi marshrut qo'shilib, ro'yxatga
    // kiritilmasa, sinov uni UMUMAN ko'rmaydi va "hammasi joyida"
    // deb turaveradi.
    //
    // Shuning uchun manba fayli o'qiladi va e'lon qilingan har bir
    // statik yo'l ro'yxatda borligi tekshiriladi.
    final src = File('lib/routing/routes.dart').readAsStringSync();
    final declared = RegExp(r"static const (\w+)\s*=\s*'/")
        .allMatches(src)
        .map((m) => m.group(1)!)
        .toSet();

    final listed = RegExp(r'Routes\.(\w+)')
        .allMatches(testSource)
        .map((m) => m.group(1)!)
        .toSet();

    final forgotten = declared.difference(listed);
    expect(forgotten, isEmpty,
        reason: 'Bu marshrutlar `Routes` da e\'lon qilingan, lekin '
            'sinov ro\'yxatiga kiritilmagan — ular hech qachon '
            'tekshirilmaydi:\n${forgotten.join('\n')}');
  });
}
