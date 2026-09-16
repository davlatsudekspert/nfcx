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
import 'package:nfcstore/l10n/strings.dart';
import 'package:nfcstore/screens/business/create_company.dart';
import 'package:nfcstore/screens/settings/appearance.dart';
import 'package:nfcstore/screens/settings/payments_history.dart';
import 'package:nfcstore/screens/settings/premium.dart';
import 'package:nfcstore/screens/settings/support.dart';
import 'package:nfcstore/screens/business/edit_business.dart';
import 'package:nfcstore/screens/business/edit_catalog.dart';
import 'package:nfcstore/screens/business/edit_gallery.dart';
import 'package:nfcstore/screens/business/working_hours.dart';
import 'package:nfcstore/screens/content/compose.dart';
import 'package:nfcstore/screens/shop/shop.dart';
import 'package:nfcstore/screens/identity/my_content.dart';
import 'package:nfcstore/screens/entry/gift_card.dart';
import 'package:nfcstore/screens/nfc/gift_offers.dart';
import 'package:nfcstore/screens/nfc/nfc_center.dart';
import 'package:nfcstore/screens/nfc/nfc_scan.dart';
import 'package:nfcstore/screens/nfc/nfc_write.dart';
import 'package:nfcstore/screens/nfc/order_card.dart';
import 'package:nfcstore/screens/nfc/qr_share.dart';
import 'package:nfcstore/screens/identity/profile_tab.dart';
import 'package:nfcstore/screens/orders/my_orders.dart';
import 'package:nfcstore/screens/orders/owner_orders.dart';
import 'package:nfcstore/screens/payment/payment_screen.dart';
import 'package:nfcstore/screens/settings/settings_screen.dart';
import 'package:nfcstore/screens/shell.dart';
import 'package:nfcstore/design/components/nav_bar.dart';
import 'package:nfcstore/state/app_lock.dart';
import 'package:nfcstore/state/app_state.dart';
import '../settle.dart';
import '../widget_test.dart' show FakeStore;
import 'fixtures.dart' show AuditMode;
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
  setUp(mockImageCacheDir);

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

  // GRAFIK KALIT — dizayndagi "Xavfsizlik" ekranida bor edi,
  // ilovada esa yo'q edi. Ikki kadr: chizish va qulfni ochish.
  testWidgets('62 grafik kalit — o‘rnatish', (t) async {
    final lock = AppLock(storage: FakeStore());
    await pumpScreen(t, SetPinScreen(lock: lock, pattern: true), lock: lock);
    await golden(t, '62-grafik-kalit-ornatish');
  });

  testWidgets('63 grafik kalit — qulf ekrani', (t) async {
    final lock = AppLock(storage: FakeStore());
    await lock.setPattern('01245');
    lock.lock();
    await pumpScreen(t, LockScreen(lock: lock), lock: lock);
    await golden(t, '63-grafik-kalit-qulf');
  });

  // ── Asosiy tablar ──────────────────────────────────────────────────
  Future<AppState> ready({AuditMode mode = AuditMode.normal}) async {
    final s = auditState(mode: mode);
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

  // NFC MARKAZINING PASTKI QISMI.
  //
  // Egasi: "NFC bo‘limining pastlari bo‘sh qolyapti". Endi u yerda
  // "Qanday ishlaydi" chizmasi turadi va bu kadr uni qo‘riqlaydi:
  // pastki qism yana bo‘shab qolsa — golden o‘zgaradi.
  testWidgets('11 NFC markazi — pastki qismi', (t) async {
    final s = await ready();
    await pumpScreen(t, const NfcCenterScreen(), state: s);
    await t.drag(find.byType(ListView).first, const Offset(0, -900));
    await settle(t);
    await golden(t, '11-nfc-center-past');
  });

  testWidgets('12 ID katalogi', (t) async {
    final s = await ready();
    await pumpScreen(t, const IdCatalogScreen(), state: s);
    await golden(t, '12-id-katalogi');
  });

  // KOD QIDIRUVI — saytdagi `/narxlar` kalkulyatoridek: daraja,
  // sabab, holat va narx. Egasi: "kerakli ID'ni qidirsa, tepadan
  // o'sha ID narxi chiqsin".
  // TAB ICHIDA OCHILGAN EKRANNING ASOSIY TUGMASI KO'RINADIMI.
  //
  // Egasi ikki surat bilan ko'rsatdi: "Sotib olish" va "Buyurtma
  // berish" tugmalari ko'rinmay qolgan — ular pastki tab paneli
  // ostida qolib ketgan edi.
  testWidgets('66 tab ichida — tugma panel ostida qolmaydi', (t) async {
    final s = await ready();
    await pumpScreen(t, const Shell(), state: s);
    await settle(t);
    // Do'kon tabi -> "NFC ID karta" -> buyurtma ekrani.
    //
    // AYNAN PASTKI PANELDAGISI. Bosh sahifada ham "Do'kon" degan
    // tezkor amal bor (prototipdagi to'rt tugmadan biri), shuning
    // uchun oddiy `find.text` ikkita element topadi va bosish
    // muvaffaqiyatsiz tugaydi.
    await t.tap(find.descendant(
      of: find.byType(NavBar),
      matching: find.text(tr('Do‘kon')),
    ));
    await settle(t);
    await t.tap(find.text(tr('NFC ID karta')));
    await settle(t);

    final button = find.text(tr('Buyurtma berish'));
    expect(button, findsWidgets, reason: 'tugma umuman chizilmagan');

    // Tugma tab panelidan YUQORIDA bo'lishi kerak — aks holda uni
    // bosib bo'lmaydi.
    final box = t.getRect(button.first);
    final barTop = t.getSize(find.byType(Shell)).height - NavBar.barHeight;
    expect(
      box.center.dy,
      lessThan(barTop),
      reason: 'tugma pastki panel ostida qolgan — bosib bo‘lmaydi',
    );
  });

  testWidgets('65 kod narxi — qidiruv natijasi', (t) async {
    final s = await ready();
    await pumpScreen(t, const IdCatalogScreen(), state: s);
    await t.enterText(find.byType(EditableText).first, 'III777');
    await t.pump(const Duration(milliseconds: 600));
    await settle(t);
    await golden(t, '65-kod-narxi');
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
    await pumpScreen(t, ProfileScreen(code: s.active!.code), state: s);
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
    await pumpScreen(t, OwnerOrdersScreen(
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
        child: ColoredBox(color: C.bg, child: SizedBox.expand()),
      )),
      state: s,
    );
    await t.tap(find.byType(GestureDetector).first);
    await settle(t);
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
        color: C.bg,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            IdentityCard(code: 'KTB482', holder: 'Bronze', tier: Tier.bronze, sweep: false),
            SizedBox(height: 10),
            IdentityCard(code: 'SLV220', holder: 'Silver', tier: Tier.silver, sweep: false),
            SizedBox(height: 10),
            IdentityCard(code: 'GLD100', holder: 'Gold', tier: Tier.gold, sweep: false),
            SizedBox(height: 10),
            IdentityCard(code: 'PRM777', holder: 'Premium', tier: Tier.premium, sweep: false),
            SizedBox(height: 10),
            IdentityCard(code: 'VIP001', holder: 'Exclusive', tier: Tier.exclusive, sweep: false),
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
        color: C.bg,
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

  testWidgets('33 biznesni tahrirlash', (t) async {
    final s = await ready();
    await pumpScreen(t, EditBusinessScreen(company: s.companies.first), state: s);
    await golden(t, '33-biznes-tahrir');
  });

  testWidgets('34 biznes hisob ochish', (t) async {
    final s = await ready();
    await pumpScreen(t, CreateCompanyScreen(), state: s);
    await golden(t, '34-biznes-ochish');
  });

  testWidgets('35 sovg‘a kartasi', (t) async {
    final s = await ready();
    await pumpScreen(t, const GiftCardScreen(), state: s);
    await golden(t, '35-sovga-kartasi');
  });

  testWidgets('36 sovg‘a takliflari', (t) async {
    final s = await ready();
    await pumpScreen(t, const GiftOffersScreen(), state: s);
    await golden(t, '36-sovga-takliflari');
  });

  testWidgets('37 post yaratish', (t) async {
    final s = await ready();
    await pumpScreen(
      t,
      const ComposeScreen(code: 'VIP001', kind: ComposeKind.post),
      state: s,
    );
    await golden(t, '37-post-yaratish');
  });

  // ── SIFAT DARVOZASI ────────────────────────────────────────────────
  //
  // Bu kadrlar "chiroylimi?" degan savolga emas, "buzilmaydimi?"
  // degan savolga javob beradi. Foydalanuvchi ularni ilovaning
  // birinchi kunidayoq ko'radi: yangi hisob, tarmoq yo'q, server
  // javob bermadi. Ularni tekshirmasdan "tayyor" deb bo'lmaydi.

  testWidgets('38 yangi foydalanuvchi — home', (t) async {
    final s = await ready(mode: AuditMode.newUser);
    await pumpScreen(t, const HomeScreen(), state: s);
    await golden(t, '38-yangi-home');
  });

  testWidgets('39 yangi foydalanuvchi — NFC', (t) async {
    final s = await ready(mode: AuditMode.newUser);
    await pumpScreen(t, const NfcCenterScreen(), state: s);
    await golden(t, '39-yangi-nfc');
  });

  // PROFIL TABI — EGASINING O'ZI KO'RADIGAN EKRAN.
  //
  // Shu paytgacha faqat "yangi foydalanuvchi" holati kadrga
  // olinardi, ya'ni asosiy ko'rinish qo'riqlanmasdi. Egasi aynan
  // shu ekrandan statistikani olib tashlashni so'radi.
  testWidgets('67 profil tabi', (t) async {
    final s = await ready();
    await pumpScreen(t, const ProfileTab(), state: s);
    await golden(t, '67-profil-tabi');
  });

  testWidgets('40 yangi foydalanuvchi — profil', (t) async {
    final s = await ready(mode: AuditMode.newUser);
    await pumpScreen(t, const ProfileTab(), state: s);
    await golden(t, '40-yangi-profil');
  });

  testWidgets('41 tarmoq yo‘q — Discover', (t) async {
    final s = await ready(mode: AuditMode.offline);
    await pumpScreen(t, const DiscoverScreen(), state: s);
    await golden(t, '41-tarmoq-yoq');
  });

  testWidgets('42 server xatosi — buyurtmalarim', (t) async {
    final s = await ready(mode: AuditMode.serverError);
    await pumpScreen(t, const MyOrdersScreen(), state: s);
    await golden(t, '42-server-xatosi');
  });

  // KADR NOMI HAQIQATGA MOSLANDI: avval "rasm yo'q" deb atalgan edi,
  // lekin tarmoq uzilganda profilning O'ZI yuklanmaydi va butun
  // ekran xato holatiga o'tadi — rasm o'rni umuman ko'rinmaydi.
  // Noto'g'ri nom auditni yolg'on qilardi.
  testWidgets('43 biznes profil — tarmoq yo‘q', (t) async {
    final s = await ready(mode: AuditMode.offline);
    await pumpScreen(t, const ProfileScreen(companyId: 'QQQ777'), state: s);
    await golden(t, '43-biznes-tarmoq-yoq');
  });

  // ── MAVZULAR ───────────────────────────────────────────────────────
  //
  // To'rt mavzu BIR XIL ekranda. Farqni shundan boshqa yo'l bilan
  // baholab bo'lmaydi: "yashil mavzu" degan yozuvni o'qib, u qanday
  // ko'rinishini bilib bo'lmaydi.
  for (final p in Palette.all) {
    testWidgets('44 mavzu — ${p.id}', (t) async {
      C.apply(p);
      addTearDown(() => C.apply(Palette.opal));
      final s = await ready();
      await pumpScreen(t, const NfcCenterScreen(), state: s);
      await golden(t, '44-mavzu-${p.id}');
    });
  }

  // ── TILLAR ─────────────────────────────────────────────────────────
  //
  // Tarjima UZUNROQ bo'lishi mumkin ("Sozlamalar" -> "Настройки" ->
  // "Settings") va maketni buzishi mumkin. Buni faqat kadrni ko'rib
  // aniqlash mumkin.
  for (final l in AppLocale.values) {
    testWidgets('45 til — ${l.code}', (t) async {
      applyLocale(l);
      addTearDown(() => applyLocale(AppLocale.uz));
      final s = await ready();
      await pumpScreen(t, const SettingsScreen(), state: s);
      await golden(t, '45-til-${l.code}');
    });
  }

  testWidgets('46 ko‘rinish sozlamasi', (t) async {
    final s = await ready();
    await pumpScreen(t, const AppearanceScreen(), state: s);
    await golden(t, '46-korinish');
  });

  testWidgets('47 to‘lovlar tarixi', (t) async {
    final s = await ready();
    await pumpScreen(t, const PaymentsHistoryScreen(), state: s);
    await golden(t, '47-tolovlar');
  });

  testWidgets('48 yordam', (t) async {
    final s = await ready();
    await pumpScreen(t, const SupportScreen(), state: s);
    await golden(t, '48-yordam');
  });

  testWidgets('49 premium', (t) async {
    final s = await ready();
    await pumpScreen(t, const PremiumScreen(), state: s);
    await golden(t, '49-premium');
  });

  // ── BIZNES TAHRIRI — YANGI BO'LIMLAR ───────────────────────────────
  //
  // Uchalasi ham YETTI/O'N IKKI ta takrorlanuvchi elementdan iborat.
  // Aynan shunday ekranlarda maket eng oson buziladi (qator uzunligi,
  // panjara oralig'i), shuning uchun har biri alohida kadrga olinadi.
  testWidgets('50 ish vaqti', (t) async {
    final s = await ready();
    await pumpScreen(t, WorkingHoursScreen(company: s.companies.first), state: s);
    await golden(t, '50-ish-vaqti');
  });

  testWidgets('51 katalog tahriri', (t) async {
    final s = await ready();
    await pumpScreen(t, EditCatalogScreen(company: s.companies.first), state: s);
    await golden(t, '51-katalog-tahriri');
  });

  testWidgets('52 galereya', (t) async {
    final s = await ready();
    await pumpScreen(t, EditGalleryScreen(company: s.companies.first), state: s);
    await golden(t, '52-galereya');
  });

  // GALEREYA BO'SH HOLATI — ikkinchi kompaniyada rasm yo'q.
  // Bo'sh holat eng ko'p ko'riladigan birinchi kadr, lekin uni
  // tekshirish eng oson unutiladigan narsa.
  testWidgets('53 galereya — bo‘sh', (t) async {
    final s = await ready();
    await pumpScreen(t, EditGalleryScreen(company: s.companies.last), state: s);
    await golden(t, '53-galereya-bosh');
  });

  // YANGI BO'LIMLAR RO'YXATI shaklning ENG PASTIDA. Kadr faqat
  // birinchi ekranni ko'rsatgani uchun, u yerga yetib borish uchun
  // ro'yxat aylantiriladi — aks holda yangi qism auditda umuman
  // ko'rinmasdi.
  testWidgets('54 biznes tahriri — bo‘limlar', (t) async {
    final s = await ready();
    await pumpScreen(t, EditBusinessScreen(company: s.companies.first), state: s);
    await t.drag(find.byType(ListView).first, const Offset(0, -1400));
    await settle(t);
    await golden(t, '54-biznes-bolimlar');
  });

  // MAHSULOT SHAKLI ichki ekran: unga faqat «Mahsulot qo'shish»
  // orqali kirish mumkin, ya'ni yo'lning o'zi ham tekshiriladi.
  // GALEREYA MEHMONGA KO'RINADIMI. Egasi rasm yuklaydi — u
  // ko'rinmasa, butun bo'lim ma'nosiz bo'lardi. Lenta «Haqida»
  // bo'limida: u biznes HAQIDA, postlar esa yangilik oqimi.
  testWidgets('56 biznes profil — haqida va galereya', (t) async {
    final s = await ready();
    await pumpScreen(t, const ProfileScreen(companyId: 'DDD333'), state: s);

    // TAB YO'Q, BO'LIMLAR BOR. Ilgari biznes profili "Lenta /
    // Haqida" tablariga bo'lingan edi va bu test tabni bosardi.
    // Yangi dizaynda bo'linish olib tashlandi: ish vaqti, manzil va
    // galereya bitta uzluksiz ustunda ketma-ket turadi — odam
    // qidirayotgan narsasini tab tanlamasdan, shunchaki pastga
    // surib topadi. Shuning uchun test ham suradi.
    await t.drag(find.byType(ListView).first, const Offset(0, -1600));
    await settle(t);
    expect(find.text(tr('Galereya')), findsOneWidget);
    await golden(t, '56-haqida-galereya');
  });

  // DO'KON — TO'RTINCHI TAB (Reels o'rniga).
  //
  // Ikki kadr: katalog kelgan holat va yangi foydalanuvchi. Yangi
  // foydalanuvchida ID yo'q — "NFC karta" qatori uni katalogga
  // olib boradi, ya'ni ekran bo'sh ko'rinmasligi kerak.
  testWidgets('57 do‘kon', (t) async {
    final s = await ready();
    await pumpScreen(t, const ShopScreen(), state: s);
    await golden(t, '57-dokon');
  });

  testWidgets('58 do‘kon — yangi foydalanuvchi', (t) async {
    final s = await ready(mode: AuditMode.newUser);
    await pumpScreen(t, const ShopScreen(), state: s);
    await golden(t, '58-dokon-yangi');
  });

  // EGASI SO'RADI: "bular ham qilinganmi, aniq tekshir".
  //
  // Uchta ekran dizaynda bor edi va kodda ham bor — lekin kadri
  // yo'q edi, ya'ni ularni faqat qurilmada ko'rish mumkin edi.
  // Endi har birining kadri bor.
  testWidgets('59 mening kontentim', (t) async {
    final s = await ready();
    await pumpScreen(t, const MyContentScreen(), state: s);
    await golden(t, '59-mening-kontentim');
  });

  testWidgets('60 ilova qulfi — PIN, grafik kalit, barmoq izi', (t) async {
    final s = await ready();
    await pumpScreen(t, const SettingsScreen(), state: s);
    await t.scrollUntilVisible(
      find.text(tr('PIN · grafik kalit · barmoq izi')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await settle(t);
    await t.tap(find.text(tr('PIN · grafik kalit · barmoq izi')));
    await settle(t);
    await golden(t, '60-ilova-qulfi');
  });

  testWidgets('61 hisobni o‘chirish', (t) async {
    final s = await ready();
    await pumpScreen(t, const SettingsScreen(), state: s);
    await t.scrollUntilVisible(
      find.text(tr('Hisobni o‘chirish')),
      300,
      scrollable: find.byType(Scrollable).first,
      maxScrolls: 60,
    );
    await settle(t);
    await t.tap(find.text(tr('Hisobni o‘chirish')).first);
    await settle(t);
    await golden(t, '61-hisobni-ochirish');
  });

  // PULLIK BIZNES NOMI — narx va "saytda sotib olish".
  testWidgets('64 biznes nomi narxi', (t) async {
    final s = await ready();
    await pumpScreen(t, const CreateCompanyScreen(), state: s);
    await t.tap(find.text(tr('O‘z nomim')));
    await settle(t);
    await t.enterText(find.byType(EditableText).first, 'NFCSTOREUZ');
    await t.pump(const Duration(milliseconds: 600));
    await settle(t);
    await golden(t, '64-biznes-nomi-narxi');
  });

  testWidgets('55 mahsulot qo‘shish', (t) async {
    final s = await ready();
    await pumpScreen(t, EditCatalogScreen(company: s.companies.first), state: s);
    await t.tap(find.text(tr('Mahsulot qo‘shish')));
    await settle(t);
    await golden(t, '55-mahsulot-shakli');
  });
}

/// Audit kadridagi ajratuvchi chiziq — holatlar bir-biriga
/// qo'shilib ketmasin.
class _Rule extends StatelessWidget {
  const _Rule();
  @override
  Widget build(BuildContext context) =>
      Container(height: 1, color: C.line);
}
