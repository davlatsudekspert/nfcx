import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/screens/business/business_stats.dart';
import 'package:nfcstore/screens/business/product_detail.dart';
import 'package:nfcstore/screens/discover/discover.dart';
import 'package:nfcstore/screens/entry/login.dart';
import 'package:nfcstore/screens/entry/onboarding.dart';
import 'package:nfcstore/screens/entry/register.dart';
import 'package:nfcstore/screens/entry/splash.dart';
import 'package:nfcstore/screens/entry/verify_email.dart';
import 'package:nfcstore/screens/home/home.dart';
import 'package:nfcstore/screens/identity/follow_list.dart';
import 'package:nfcstore/screens/content/story_viewer.dart';
import 'package:nfcstore/screens/identity/profile_screen.dart';
import 'package:nfcstore/screens/identity/profile_stats.dart';
import 'package:nfcstore/screens/identity/switcher.dart';
import 'package:nfcstore/screens/lock/lock_screen.dart';
import 'package:nfcstore/screens/lock/set_pin_screen.dart';
import 'package:nfcstore/screens/nfc/id_catalog.dart';
import 'package:nfcstore/screens/nfc/id_detail.dart';
import 'package:nfcstore/design/components/icons.dart';
import 'package:nfcstore/design/components/identity_card.dart';
import 'package:nfcstore/design/components/states.dart';
import 'package:nfcstore/screens/nfc/nfc_center.dart';
import 'package:nfcstore/screens/nfc/nfc_scan.dart';
import 'package:nfcstore/screens/nfc/nfc_write.dart';
import 'package:nfcstore/screens/nfc/order_card.dart';
import 'package:nfcstore/screens/nfc/qr_share.dart';
import 'package:nfcstore/screens/orders/my_orders.dart';
import 'package:nfcstore/screens/orders/owner_orders.dart';
import 'package:nfcstore/screens/payment/payment_screen.dart';
import 'package:nfcstore/screens/settings/settings_screen.dart';
import 'package:nfcstore/screens/shell.dart';
import 'package:nfcstore/state/app_lock.dart';
import 'package:nfcstore/state/app_state.dart';
import '../widget_test.dart' show FakeStore;
import 'harness.dart';

/// EKRANMA-EKRAN VIZUAL AUDIT.
///
/// Har bir ekran PNG sifatida chiqariladi (`goldens/`). Bu ikki ish
/// qiladi:
///   1) DIZAYNNI KO'RISH — ekranni haqiqatan ochib ko'rmasdan
///      "chiroyli bo'ldimi" degan savolga javob berib bo'lmaydi.
///      Aynan shu usul ikkita jiddiy nosozlikni topdi (matn ostidagi
///      sariq chiziqlar va ekranni to'ldirmaslik).
///   2) REGRESSIYA — keyinchalik biror o'zgarish ekranni buzsa,
///      farq shu yerda ko'rinadi.
///
/// Yangilash: `flutter test --update-goldens test/audit`
///
/// DIQQAT: rasm o'rinlari (`MediaSlot`) ataylab bo'sh — testda tarmoq
/// yo'q. Bu ham foydali: dizayn rasm KELMAGANDA qanday ko'rinishini
/// ham shu yerda baholaymiz.
void main() {
  setUpAll(loadAuditFonts);

  Future<void> golden(WidgetTester t, String name) =>
      expectLater(find.byType(MaterialApp), matchesGoldenFile('goldens/$name.png'));

  // ── Entry ──────────────────────────────────────────────────────────
  testWidgets('01 splash', (t) async {
    await pumpScreen(t, const SplashScreen());
    await golden(t, '01-splash');
  });

  testWidgets('02 onboarding', (t) async {
    await pumpScreen(t, OnboardingScreen(onDone: () {}));
    await golden(t, '02-onboarding');
  });

  testWidgets('03 login', (t) async {
    await pumpScreen(t, const LoginScreen());
    await golden(t, '03-login');
  });

  testWidgets('04 register', (t) async {
    await pumpScreen(t, const RegisterScreen());
    await golden(t, '04-register');
  });

  testWidgets('05 email tasdiqlash', (t) async {
    await pumpScreen(t, const VerifyEmailScreen(
      email: 'egasi@nfcstore.uz', phone: '+998901234567',
      password: 'x', name: 'Muhammad',
    ));
    await golden(t, '05-email-tasdiqlash');
  });

  // ── Qulf ───────────────────────────────────────────────────────────
  testWidgets('06 qulf ekrani', (t) async {
    final lock = AppLock(storage: FakeStore());
    await lock.setPin('1234');
    lock.lock();
    await pumpScreen(t, LockScreen(lock: lock), lock: lock);
    await golden(t, '06-qulf');
  });

  testWidgets('07 PIN o‘rnatish', (t) async {
    final lock = AppLock(storage: FakeStore());
    await pumpScreen(t, SetPinScreen(lock: lock), lock: lock);
    await golden(t, '07-pin-ornatish');
  });

  // ── Asosiy tablar ──────────────────────────────────────────────────
  Future<AppState> ready() async {
    final s = auditState();
    await s.boot();
    return s;
  }

  testWidgets('08 home', (t) async {
    final s = await ready();
    await pumpScreen(t, const HomeScreen(), state: s);
    await golden(t, '08-home');
  });

  testWidgets('09 qobiq — pastki panel', (t) async {
    final s = await ready();
    await pumpScreen(t, const Shell(), state: s);
    await golden(t, '09-qobiq-navbar');
  });

  testWidgets('10 discover', (t) async {
    final s = await ready();
    await pumpScreen(t, const DiscoverScreen(), state: s);
    await golden(t, '10-discover');
  });

  testWidgets('11 NFC Center', (t) async {
    final s = await ready();
    await pumpScreen(t, const NfcCenterScreen(), state: s);
    await golden(t, '11-nfc-center');
  });

  testWidgets('12 ID katalogi', (t) async {
    final s = await ready();
    await pumpScreen(t, const IdCatalogScreen(), state: s);
    await golden(t, '12-id-katalogi');
  });

  testWidgets('13 ID tafsiloti', (t) async {
    final s = await ready();
    await pumpScreen(t, IdDetailScreen(
      record: Record.fromJson(const {'code': 'GLD100', 'price': 149000, 'tier': 'gold'}),
    ), state: s);
    await golden(t, '13-id-tafsiloti');
  });

  testWidgets('14 QR va ulashish', (t) async {
    final s = await ready();
    await pumpScreen(t, QrShareScreen(identity: s.active!), state: s);
    await golden(t, '14-qr');
  });

  // ── Profillar ──────────────────────────────────────────────────────
  testWidgets('15 shaxsiy profil — ega', (t) async {
    final s = await ready();
    await pumpScreen(t, ProfileScreen(identity: s.active!), state: s);
    await golden(t, '15-profil-ega');
  });

  testWidgets('16 shaxsiy profil — ommaviy', (t) async {
    final s = await ready();
    await pumpScreen(t, const ProfileScreen(code: 'OTH999'), state: s);
    await golden(t, '16-profil-ommaviy');
  });

  testWidgets('17 biznes profil — ommaviy', (t) async {
    final s = await ready();
    await pumpScreen(t, const ProfileScreen(companyId: 'QQQ777'), state: s);
    await golden(t, '17-biznes-ommaviy');
  });

  testWidgets('18 obunachilar', (t) async {
    final s = await ready();
    await pumpScreen(t, const FollowListScreen(code: 'VIP001', title: 'Muhammad'), state: s);
    await golden(t, '18-obunachilar');
  });

  // ── Katalog va buyurtma ────────────────────────────────────────────
  testWidgets('19 mahsulot tafsiloti', (t) async {
    final s = await ready();
    await pumpScreen(t, ProductDetailScreen(
      product: Product.fromJson(const {
        'id': '1', 'name': 'Qora metall karta', 'price': 1200000,
        'description': 'Lazer bilan ishlangan qora metall karta. Ismingiz va '
            'NFC chipi o‘rnatilgan. Bir tegish bilan profilingiz ochiladi.',
      }),
      companyId: 'DDD333',
      companyName: 'NFCSTORE',
    ), state: s);
    await golden(t, '19-mahsulot');
  });

  testWidgets('20 ega buyurtmalari', (t) async {
    final s = await ready();
    await pumpScreen(t, const OwnerOrdersScreen(
      companyId: 'DDD333', companyName: 'NFCSTORE',
    ), state: s);
    await golden(t, '20-ega-buyurtmalari');
  });

  testWidgets('21 mening buyurtmalarim', (t) async {
    final s = await ready();
    await pumpScreen(t, const MyOrdersScreen(), state: s);
    await golden(t, '21-buyurtmalarim');
  });

  testWidgets('22 to‘lov', (t) async {
    final s = await ready();
    await pumpScreen(t, PaymentScreen(
      record: Record.fromJson(const {'code': 'GLD100', 'price': 149000, 'tier': 'gold'}),
    ), state: s);
    await golden(t, '22-tolov');
  });

  testWidgets('23 biznes statistikasi', (t) async {
    final s = await ready();
    await pumpScreen(t, const BusinessStatsScreen(companyId: 'DDD333'), state: s);
    await golden(t, '23-statistika');
  });

  testWidgets('24 jismoniy karta buyurtmasi', (t) async {
    final s = await ready();
    await pumpScreen(t, OrderCardScreen(record: s.cards.first), state: s);
    await golden(t, '24-jismoniy-karta');
  });

  testWidgets('25 sozlamalar va tasdiqlash', (t) async {
    final s = await ready();
    await pumpScreen(t, const SettingsScreen(), state: s);
    await golden(t, '25-sozlamalar');
  });

  testWidgets('26 shaxs almashtirgich', (t) async {
    final s = await ready();
    await pumpScreen(
      t,
      Builder(builder: (c) => GestureDetector(
        onTap: () => showIdentitySwitcher(c),
        child: const ColoredBox(color: C.obsidian, child: SizedBox.expand()),
      )),
      state: s,
    );
    await t.tap(find.byType(GestureDetector).first);
    await t.pumpAndSettle();
    await golden(t, '26-shaxs-almashtirgich');
  });

  testWidgets('27 story ko‘ruvchi', (t) async {
    final s = await ready();
    await pumpScreen(t, const StoryViewerScreen(code: 'VIP001'), state: s);
    await golden(t, '27-story');
  });

  testWidgets('28 shaxsiy statistika', (t) async {
    final s = await ready();
    await pumpScreen(
      t,
      const ProfileStatsScreen(code: 'VIP001', name: 'Muhammad Yusuf'),
      state: s,
    );
    await golden(t, '28-shaxsiy-statistika');
  });

  // NFC APPARATURASI. Testda NFC moduli YO'Q — ya'ni bu goldenlar
  // aynan "qurilmada NFC yo'q" holatini qamrab oladi. Bu eng ko'p
  // uchraydigan buzuq holat: matn tushunarli bo'lishi va maket
  // buzilmasligi shu yerda qo'riqlanadi.
  testWidgets('29 NFC o‘qish', (t) async {
    final s = await ready();
    await pumpScreen(t, const NfcScanScreen(), state: s);
    // NFC tekshiruvi muddati (3 s) tugasin — aks holda kadrda faqat
    // aylanuvchi belgi qoladi va audit hech narsani ko'rsatmaydi.
    await t.pump(const Duration(seconds: 4));
    await golden(t, '29-nfc-oqish');
  });

  testWidgets('30 NFC yozish', (t) async {
    final s = await ready();
    await pumpScreen(t, const NfcWriteScreen(), state: s);
    await golden(t, '30-nfc-yozish');
  });

  // TARIFLAR YONMA-YON.
  //
  // NIMA UCHUN ALOHIDA KADR: tariflar farqini bitta ekranda ko'rmasa,
  // "Bronze bilan Exclusive bir xil ko'rinadi" degan muammoni
  // aniqlashning yo'li yo'q. Bu kadr aynan shu savolga javob beradi.
  testWidgets('31 tariflar yonma-yon', (t) async {
    final s = await ready();
    await pumpScreen(
      t,
      ColoredBox(
        color: C.obsidian,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            IdentityCard(code: 'KTB482', holder: 'Bronze', tier: Tier.bronze, dense: true),
            SizedBox(height: 10),
            IdentityCard(code: 'SLV220', holder: 'Silver', tier: Tier.silver, dense: true),
            SizedBox(height: 10),
            IdentityCard(code: 'GLD100', holder: 'Gold', tier: Tier.gold, dense: true),
            SizedBox(height: 10),
            IdentityCard(code: 'PRM777', holder: 'Premium', tier: Tier.premium, dense: true),
            SizedBox(height: 10),
            IdentityCard(code: 'VIP001', holder: 'Exclusive', tier: Tier.exclusive, dense: true),
          ],
        ),
      ),
      state: s,
    );
    await golden(t, '31-tariflar');
  });

  // BO'SH HOLATLAR — ega va mehmon uchun yonma-yon.
  //
  // Audit shuni ko'rsatdiki, yangi foydalanuvchi ilovaning yarmida
  // aynan shu kadrlarni ko'radi. Ular dizaynning eng ko'p
  // ko'riladigan, lekin eng kam e'tibor beriladigan qismi.
  testWidgets('32 bo‘sh holatlar', (t) async {
    final s = await ready();
    await pumpScreen(
      t,
      ColoredBox(
        color: C.obsidian,
        child: ListView(
          children: [
            EmptyState(
              'Birinchisini joylang — profilingiz shu bilan jonlanadi.',
              title: 'Hali post yo‘q',
              icon: Ico.image,
              actionLabel: 'Post qo‘shish',
              onAction: () {},
            ),
            const _Rule(),
            const EmptyState(
              'Bu profilda hali post joylanmagan.',
              title: 'Hali post yo‘q',
              icon: Ico.image,
            ),
            const _Rule(),
            const EmptyState(
              'Kimdir sizga ID sovg‘a qilsa, u shu yerda tasdiqlashni '
              'kutib turadi.',
              title: 'Sovg‘a taklifi yo‘q',
              icon: Ico.gift,
            ),
          ],
        ),
      ),
      state: s,
    );
    await golden(t, '32-bosh-holatlar');
  });
}

/// Audit kadridagi ajratuvchi chiziq — holatlar bir-biriga
/// qo'shilib ketmasin.
class _Rule extends StatelessWidget {
  const _Rule();
  @override
  Widget build(BuildContext context) =>
      Container(height: 1, color: C.hairline);
}
