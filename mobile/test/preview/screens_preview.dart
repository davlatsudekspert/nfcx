import 'package:flutter/material.dart' hide FilterChip;
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/models.dart';
import 'package:nfcstore/design/components/backdrop.dart';
import 'package:nfcstore/design/components/buttons.dart';
import 'package:nfcstore/design/components/identity_card.dart';
import 'package:nfcstore/design/components/surface.dart';
import 'package:nfcstore/design/tokens.dart';
import 'package:nfcstore/design/type.dart';
import 'package:nfcstore/screens/discover/discover.dart';
import 'package:nfcstore/screens/home/home.dart';
import 'package:nfcstore/screens/identity/profile_screen.dart';
import 'package:nfcstore/screens/identity/profile_tab.dart';
import 'package:nfcstore/screens/nfc/id_catalog.dart';
import 'package:nfcstore/screens/nfc/id_detail.dart';
import 'package:nfcstore/screens/nfc/nfc_center.dart';
import 'package:nfcstore/screens/payment/payment_screen.dart';
import 'package:nfcstore/screens/settings/settings_screen.dart';
import 'package:nfcstore/screens/shell.dart';

import '../audit/harness.dart';
import 'package:nfcstore/screens/content/reels.dart';

import 'preview.dart' show installImageStub, loadFonts, previewSize, shot;

/// EKRAN PREVIEWLARI — dizayn maketiga solishtirish uchun.
///
/// `flutter test --update-goldens test/preview` har ekranni
/// `test/preview/out/` ga PNG qilib yozadi. Bu testlar hech narsani
/// tekshirmaydi — ular ko'z bilan baholash uchun rasm chiqaradi.
void main() {
  setUpAll(loadFonts);

  Future<void> screen(WidgetTester t, Widget child, String name) async {
    mockImageCacheDir();
    installImageStub();
    t.view.physicalSize = previewSize * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);

    final state = auditState();
    await state.boot();

    await t.pumpWidget(auditApp(child, state));
    await t.pump();
    await t.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 300));
    });
    await t.pump();
    await t.pump(const Duration(milliseconds: 60));
    await t.pump(const Duration(milliseconds: 500));
    await t.pump(const Duration(seconds: 2));

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('out/$name.png'),
    );
  }

  testWidgets('bosh sahifa', (t) => screen(t, const Shell(), 'home'));

  testWidgets(
    'qidiruv',
    (t) => screen(t, const DiscoverScreen(), 'discover'),
  );

  testWidgets(
    'nfc markazi',
    (t) => screen(t, const NfcCenterScreen(), 'nfc'),
  );

  testWidgets(
    'profil tabi',
    (t) => screen(t, const ProfileTab(), 'profile-tab'),
  );

  testWidgets(
    'ochiq profil — NFC tegizishdan',
    (t) => screen(
      t,
      const ProfileScreen(code: 'GLD777', entry: ProfileEntry.tap),
      'profile-tap',
    ),
  );

  testWidgets(
    'ochiq profil — qidiruvdan',
    (t) => screen(
      t,
      const ProfileScreen(code: 'GLD777'),
      'profile-search',
    ),
  );

  testWidgets(
    'id katalogi',
    (t) => screen(t, const IdCatalogScreen(), 'catalog'),
  );

  testWidgets(
    'id tafsiloti',
    (t) => screen(
      t,
      IdDetailScreen(
        record: Record(
          code: 'GLD777',
          name: 'Gold ID',
          price: 149000,
          serverTier: 'gold',
        ),
      ),
      'id-detail',
    ),
  );

  testWidgets(
    'to‘lov usuli',
    (t) => screen(
      t,
      PaymentScreen(
        record: Record(
          code: 'GLD777',
          name: 'Gold ID',
          price: 149000,
          serverTier: 'gold',
        ),
      ),
      'payment',
    ),
  );

  testWidgets(
    'sozlamalar',
    (t) => screen(t, const SettingsScreen(), 'settings'),
  );

  testWidgets('home lentasi — pastga', (t) async {
    mockImageCacheDir();
    installImageStub();
    t.view.physicalSize = previewSize * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);

    final state = auditState();
    await state.boot();
    await t.pumpWidget(auditApp(const HomeScreen(), state));
    await t.pump();
    await t.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 300));
    });
    await t.pump();
    await t.pump(const Duration(seconds: 2));

    // Lentagacha aylantiramiz — karta va tezkor amallardan keyin
    // nima ko'rinishini tekshirish uchun.
    await t.drag(find.byType(CustomScrollView).first, const Offset(0, -520));
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('out/home-feed.png'),
    );
  });

  // REELS — to'liq ekran video lentasi.
  //
  // Preview qobig'i rasm o'rniga mahalliy chizg'ich qo'yadi, shuning
  // uchun bu yerda kadr HAQIQIY ilovadagidek ko'rinadi: quyuq media
  // ustida oq matn, o'ng ustunda layk, izoh va ulashish.
  testWidgets('reels', (t) => screen(t, const ReelsScreen(), 'reels'));

  testWidgets('mavzular', (t) async {
    mockImageCacheDir();
    // To'rt mavzu bir kadrda — urg'u oilasi almashishini ko'rish
    // uchun. Tarif materiallari o'zgarmasligi shu yerda ko'rinadi.
    for (final p in Palette.all) {
      C.apply(p);
      await shot(
        t,
        const _ThemeStrip(),
        'theme-${p.id}',
        size: const Size(390, 560),
      );
    }
    C.apply(Palette.opal);
  });
}

/// Mavzu namunasi — tarmoqsiz chiziladigan elementlar.
class _ThemeStrip extends StatelessWidget {
  const _ThemeStrip();

  @override
  Widget build(BuildContext context) => ScreenBackdrop(
        aura: Aura.home,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(S.gutter),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(C.palette.label, style: T.title),
                const SizedBox(height: S.x20),
                const IdentityCard(
                  code: 'GLD777',
                  tier: Tier.gold,
                  holder: 'Dilshod Karimov',
                  url: 'nfcstore.uz/gld777',
                  sweep: false,
                ),
                const SizedBox(height: S.x20),
                const StatRow(
                  tiles: [
                    StatTile(value: '1 248', label: 'Ko‘rish'),
                    StatTile(value: '86', label: 'Kontakt'),
                    StatTile(value: '412', label: 'Obunachi'),
                  ],
                ),
                const SizedBox(height: S.x20),
                PrimaryButton('Kontaktni saqlash', onTap: () {}),
                const SizedBox(height: S.x8),
                Row(
                  children: [
                    FilterChip('Hammasi', active: true, onTap: () {}),
                    const SizedBox(width: S.x8),
                    FilterChip('Restoran', onTap: () {}),
                    const SizedBox(width: S.x8),
                    const StatusChip('Tasdiqlandi', tone: StatusTone.ok),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
}
