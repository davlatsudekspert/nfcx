// ILOVA ↔ SERVER — UCHMA-UCH.
//
// Qolgan barcha testlar soxta javoblar bilan ishlaydi: ular ekranni
// tekshiradi, ALOQANI emas. Ya'ni server javobining shakli
// o'zgarsa (maydon nomi, turi, joylashuvi), hech bir test buni
// ko'rmasdi — xato faqat telefonning o'zida, bo'sh ekran bo'lib
// chiqardi.
//
// Bu yerda esa HAQIQIY HTTP: ilovaning `Api` + `Repo` qatlami
// production'dagi AYNAN O'SHA `hosting/worker.js` bilan gaplashadi
// (lokal ishga tushirilgan holda, xotiradagi D1 bilan).
//
// ISHGA TUSHIRISH:
//   node ../scripts/dev-api-server.mjs &        # boshqa terminalda
//   API_BASE=http://127.0.0.1:8787 flutter test test/live_api_test.dart
//
// yoki bitta buyruq bilan:  node ../scripts/test-live-app.mjs
//
// `API_BASE` berilmasa test O'TKAZIB YUBORILADI — CI da server
// ko'tarilmagan bo'lsa, quvur qizarmasligi kerak (u yerda o'z
// tekshiruvlari bor).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/data/repo.dart';

const _demoEmail = 'dilshod@nfcstore.uz';
const _demoPassword = 'demo1234';

void main() {
  final base = Platform.environment['API_BASE'] ?? '';
  if (base.isEmpty) {
    test('lokal API testi (API_BASE berilmagan — o‘tkazib yuborildi)', () {},
        skip: 'API_BASE=http://127.0.0.1:8787 bilan ishga tushiring');
    return;
  }

  late Api api;
  late Repo repo;

  /// Yuklangan rasm havolasi — post va istorya testlari uchun.
  /// Server tashqi manzilni qabul qilmaydi (SSRF yo'li), shuning
  /// uchun avval haqiqiy yuklash bo'lishi kerak.
  String? _uploadedImage;

  setUpAll(() async {
    api = Api(baseUrl: base);
    repo = Repo(api);
  });

  // ── KIRISH ──────────────────────────────────────────────────────
  test('kirish — token keladi va keyingi so‘rovlarga qo‘shiladi', () async {
    final token = await repo.login(login: _demoEmail, password: _demoPassword);
    expect(token, isNotEmpty);
    expect(api.token, token);
  });

  test('noto‘g‘ri parol — kirish bermaydi', () async {
    final bad = Repo(Api(baseUrl: base));
    await expectLater(
      bad.login(login: _demoEmail, password: 'notogri'),
      throwsA(isA<ApiError>()),
    );
  });

  // ── PROFIL VA KARTALAR ──────────────────────────────────────────
  test('profil — kartalar ro‘yxati bilan keladi', () async {
    final me = await api.get('/api/auth/me');
    final cards = (me as Map)['cards'] as List;
    expect(cards, isNotEmpty);
    expect(cards.map((c) => c['code']), contains('VIP001'));
  });

  test('ommaviy profil — maydonlar to‘liq o‘qiladi', () async {
    final r = await repo.record('VIP001');
    expect(r.name, 'Dilshod Karimov');
    expect(r.role, isNotEmpty);
    expect(r.phone, isNotEmpty);
  });

  test('biznes profil — kompaniya, katalogi va postlari bilan keladi', () async {
    // DIQQAT: `cards.profile_type='business'` va `companies` jadvali
    // ikki xil narsa. Ilovaning biznes ekranlari `companies` dan
    // o'qiydi — shuning uchun tekshiruv ham aynan shu yo'ldan
    // boradi.
    // Kompaniya ID'si faqat harflardan iborat ('LATTE'), 'DDD333'
    // esa uning manba kartasi — server ikkisini alohida biladi.
    final company = await repo.company('LATTE');
    expect(company.name, 'Latte Coffee');

    // OMMAVIY KATALOG kompaniyaning O'ZI bilan birga keladi —
    // tashrifchi uchun alohida so'rov yo'q.
    expect(company.items, isNotEmpty, reason: 'kafening menyusi bo‘sh bo‘lmasligi kerak');
    expect(company.items.first.name, isNotEmpty);

    final posts = await repo.companyPosts('LATTE');
    expect(posts, isNotEmpty);
  });

  test('begona odam kompaniya katalogini TAHRIRLAY olmaydi', () async {
    // `/catalog` — EGA uchun. Kirgan odam (Dilshod) kafening egasi
    // emas, ya'ni 403 kelishi SHART: aks holda istalgan odam
    // birovning menyusini ko'rib-o'zgartira olardi.
    await expectLater(repo.companyCatalog('LATTE'), throwsA(isA<ApiError>()));
  });

  // ── LENTA, ISTORYA, REELS ───────────────────────────────────────
  test('lenta — post va istorya aralash, izoh maydonlari bilan', () async {
    final feed = await repo.feed();
    expect(feed.items, isNotEmpty);
    expect(feed.items.any((e) => e.kind == 'post'), isTrue);
    expect(feed.items.any((e) => e.isStory), isTrue);
    // Yangi maydon: server bermasa ilova o'zi yig'adi, lekin
    // BU SERVER bermog'i kerak.
    expect(feed.items.first.commentTarget, isNotEmpty);
  });

  test('istorya lentasi — obuna bo‘lganlar ko‘rinadi', () async {
    final stories = await repo.storyFeed();
    expect(stories, isNotEmpty);
  });

  test('postni yoqtirish — server sanaydi, mijoz emas', () async {
    final feed = await repo.feed();
    final post = feed.items.firstWhere((e) => e.kind == 'post' && e.likeable);
    final first = await repo.likePost(post.id);
    final second = await repo.likePost(post.id);
    // Ikkinchi bosish — bekor qilish.
    expect(first.liked, isNot(second.liked));
    expect((first.count - second.count).abs(), 1);
  });

  // ── IZOHLAR ─────────────────────────────────────────────────────
  test('izoh — yoziladi, ro‘yxatda chiqadi, o‘chiriladi', () async {
    final feed = await repo.feed();
    final item = feed.items.firstWhere((e) => e.kind == 'post');

    final before = await repo.comments(item.commentTarget, item.id);
    final added = await repo.addComment(item.commentTarget, item.id, 'Uchma-uch sinov');
    expect(added.comment.body, 'Uchma-uch sinov');
    expect(added.comment.mine, isTrue);
    expect(added.total, before.total + 1);

    final after = await repo.comments(item.commentTarget, item.id);
    expect(after.items.first.body, 'Uchma-uch sinov');

    final total = await repo.deleteComment(added.comment.id);
    expect(total, before.total);
  });

  test('izohlarni mehmon ham o‘qiydi, lekin yoza olmaydi', () async {
    final guest = Repo(Api(baseUrl: base));
    final feed = await repo.feed();
    final item = feed.items.firstWhere((e) => e.kind == 'post');

    final list = await guest.comments(item.commentTarget, item.id);
    expect(list.items, isA<List>());

    await expectLater(
      guest.addComment(item.commentTarget, item.id, 'mehmon'),
      throwsA(isA<ApiError>()),
    );
  });

  // ── QIDIRUV VA KATALOG ──────────────────────────────────────────
  test('qidiruv — ism bo‘yicha topadi', () async {
    final found = await repo.searchRecords('Malika');
    expect(found.map((r) => r.code), contains('ABC123'));
  });

  test('kategoriyalar ro‘yxati bo‘sh emas', () async {
    final cats = await repo.categories();
    expect(cats, isNotEmpty);
  });

  test('katalog — sotuvdagi ID‘lar keladi', () async {
    final all = await repo.catalog();
    expect(all, isNotEmpty);
  });

  // ── OBUNA ───────────────────────────────────────────────────────
  test('obuna — soni o‘zgaradi va holat eslab qolinadi', () async {
    final before = await repo.followStats('ABC123');
    if (before.isFollowing) {
      await repo.unfollow('ABC123');
    } else {
      await repo.follow('ABC123');
    }
    final after = await repo.followStats('ABC123');
    expect(after.isFollowing, isNot(before.isFollowing));
    expect((after.followers - before.followers).abs(), 1);
  });

  // ── NFC ─────────────────────────────────────────────────────────
  test('NFC teg — chip kodi profilga olib boradi', () async {
    // `repo.tap()` faqat hodisani yozadi (void). Tegning QAYSI
    // profilga bog'langani alohida endpointdan keladi — kartani
    // telefonga tegizganda ilova aynan shu javobga qarab ekran
    // ochadi.
    final linked = await api.get('/api/tap/demo-chip-vip001');
    expect((linked as Map)['linkedCode'], 'VIP001');
    await repo.tap('VIP001');
  });

  // ── STATISTIKA, BUYURTMA, NARXLAR ───────────────────────────────
  test('statistika — tegish va ko‘rishlar sanalgan', () async {
    final stats = await repo.analytics('VIP001');
    expect((stats['byType'] as Map).isNotEmpty, isTrue);
  });

  test('buyurtmalar ro‘yxati keladi', () async {
    final orders = await repo.orders();
    expect(orders, isNotEmpty);
  });

  test('jismoniy karta narxlari keladi', () async {
    final pricing = await repo.physicalPricing();
    expect(pricing['tiers'], isNotEmpty);
  });

  // ── YOZISH OQIMLARI ─────────────────────────────────────────────
  //
  // Bu yergacha hammasi O'QISH edi. Yozish yo'llari boshqacha
  // yiqiladi: ular huquq, rozilik va to'lov bilan bog'langan va
  // aynan shu yerda ilova bilan server bir-birini tushunmay
  // qolishi mumkin.

  test('media yuklash — havola qaytadi va u profilga yoziladi', () async {
    // Eng kichik haqiqiy PNG (1×1). Server MIME va hajmni
    // tekshiradi, shuning uchun "shunchaki baytlar" yaramaydi.
    final png = <int>[
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ];
    final url = await repo.uploadMedia(png, contentType: 'image/png');
    expect(url, startsWith('/uploads/'));

    // Yuklangan rasm PROFILGA yozilishi kerak — aks holda "yukladim,
    // lekin hech qayerda ko'rinmadi" bo'lardi. `PUT /api/records/:code`
    // TO'LIQ yozuvni kutadi (ilova ham shunday yuboradi), shuning
    // uchun ism ham bo'lishi shart.
    final me = await repo.record('VIP001');
    final updated = await repo.updateRecord('VIP001', {
      'name': me.name,
      'role': me.role,
      'avatarUrl': url,
    });
    expect(updated.avatarUrl, contains(url));
    _uploadedImage = url;
  });

  test('post — joylanadi, ro‘yxatda chiqadi, o‘chiriladi', () async {
    // POST MEDIASIZ BO'LMAYDI (server `bad_image` qaytaradi) —
    // lenta faqat matndan iborat yozuvlarni qabul qilmaydi.
    final post = await repo.addPost(
      'VIP001',
      imageUrl: _uploadedImage,
      caption: 'Sinov posti',
      agreed: true,
    );
    expect(post.id, isNotEmpty);

    final mine = await repo.recordPosts('VIP001');
    expect(mine.map((p) => p.caption), contains('Sinov posti'));

    await repo.deletePost(int.parse(post.id));
    final after = await repo.recordPosts('VIP001');
    expect(after.map((p) => p.caption), isNot(contains('Sinov posti')));
  });

  test('kontent qoidalariga rozilik SERVERDA tekshiriladi', () async {
    // `agreed: false` bilan yuborilgan so'rov rad etilishi SHART:
    // rozilik faqat ekranda bo'lsa, uni so'rovni to'g'ridan-to'g'ri
    // yuborib chetlab o'tish mumkin edi.
    await expectLater(
      repo.addPost('VIP001', imageUrl: _uploadedImage, caption: 'Rozilik yo‘q', agreed: false),
      throwsA(isA<ApiError>()),
    );
  });

  test('istorya — joylanadi va lentaga tushadi', () async {
    await repo.addStory(
      'VIP001',
      imageUrl: _uploadedImage,
      caption: 'Sinov istoryasi',
      agreed: true,
    );
    final feed = await repo.storyFeed();
    expect(feed, isNotEmpty);
  });

  test('begona profilga post yozib bo‘lmaydi', () async {
    // ABC123 — Malikaniki. Egalik SERVERDA tekshiriladi.
    await expectLater(
      repo.addPost('ABC123', imageUrl: _uploadedImage, caption: 'begona', agreed: true),
      throwsA(isA<ApiError>()),
    );
  });

  test('biznesga buyurtma — mijoz tomonidan yuboriladi', () async {
    final company = await repo.company('LATTE');
    await repo.placeCompanyOrder(
      'LATTE',
      name: 'Dilshod',
      phone: '+998901234567',
      itemId: company.items.first.id,
      qty: 2,
      note: 'Shakarsiz',
    );
    // Buyurtma EGASIGA ko'rinadi; begona odam ro'yxatni ko'ra
    // olmasligi kerak.
    await expectLater(repo.companyOrders('LATTE'), throwsA(isA<ApiError>()));
  });

  test('jismoniy karta buyurtmasi — to‘lov havolasi bilan qaytadi', () async {
    // Maydon nomlari ilovadagi buyurtma ekrani bilan AYNAN bir xil
    // (`order_card.dart`) — shu sabab bu test ikkalasini bog'lab
    // turadi: server nomni o'zgartirsa, bu yerda darhol qizaradi.
    final r = await repo.orderPhysicalCard('VIP001', {
      'shippingName': 'Dilshod Karimov',
      'shippingPhone': '+998901234567',
      'shippingAddress': 'Toshkent, Chilonzor 1',
      'quantity': 1,
    });
    // Ilova shu javobdan to'lov ekraniga o'tadi: buyurtma raqami va
    // summa bo'lishi shart.
    expect(r['orderId'] ?? r['id'], isNotNull);
    expect(r['amount'] ?? r['price'], isNotNull);
  });

  test('Premium so‘rovi — to‘lov havolasi bilan qaytadi', () async {
    // Dilshod allaqachon premium, shuning uchun premium bo'lmagan
    // ikkinchi hisob (Malika) ishlatiladi.
    final other = Repo(Api(baseUrl: base));
    await other.login(login: 'malika@nfcstore.uz', password: _demoPassword);
    final order = await other.requestPremium();
    expect(order.id, greaterThan(0));
    expect(order.price, greaterThan(0));
  });

  test('yordam xabari yuboriladi', () async {
    await repo.sendSupport('Sinov: ilova ishlayaptimi?');
    final msgs = await repo.supportMessages();
    expect(msgs, isNotEmpty);
  });

  test('to‘lov yoqilganligi holati keladi', () async {
    final settings = await repo.paymentsEnabled();
    // Ilova shu bayroqqa qarab to'lov tugmasini ko'rsatadi yoki
    // "vaqtincha o'chirilgan" xabarini chiqaradi.
    expect(settings.containsKey('enabled'), isTrue);
  });
}
