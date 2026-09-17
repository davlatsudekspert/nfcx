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
  String? uploadedImage;

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

  test('PREMIUMSIZ hisob izoh YOZA OLMAYDI — qoida SERVERDA', () async {
    // EGASINING QOIDASI: izoh yozish Premium obunachilarga.
    //
    // NIMA UCHUN AYNAN SHU YERDA SINALADI: ilovada maydonni
    // yashirish — bu faqat KO'RINISH. So'rovni qo'lda yuborgan odam
    // baribir izoh yozardi. Shuning uchun qoida serverda turibdi va
    // shu sinov aynan serverni so'roqqa tutadi.
    //
    // Demo ma'lumotda 1-hisob Premium, 2-hisob (Malika) esa yo'q.
    final other = Repo(Api(baseUrl: base));
    await other.login(login: 'malika@nfcstore.uz', password: _demoPassword);

    final feed = await repo.feed();
    final item = feed.items.firstWhere((e) => e.kind == 'post');

    // O'QISH OCHIQ.
    final list = await other.comments(item.commentTarget, item.id);
    expect(list.items, isA<List>());

    // YOZISH — YO'Q.
    await expectLater(
      other.addComment(item.commentTarget, item.id, 'premiumsiz'),
      throwsA(
        isA<ApiError>().having(
          (e) => e.toString(),
          'sabab',
          contains('premium_required'),
        ),
      ),
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
    uploadedImage = url;
  });

  test('post — joylanadi, ro‘yxatda chiqadi, o‘chiriladi', () async {
    // POST MEDIASIZ BO'LMAYDI (server `bad_image` qaytaradi) —
    // lenta faqat matndan iborat yozuvlarni qabul qilmaydi.
    final post = await repo.addPost(
      'VIP001',
      imageUrl: uploadedImage,
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
      repo.addPost('VIP001', imageUrl: uploadedImage, caption: 'Rozilik yo‘q', agreed: false),
      throwsA(isA<ApiError>()),
    );
  });

  test('istorya — joylanadi va lentaga tushadi', () async {
    await repo.addStory(
      'VIP001',
      imageUrl: uploadedImage,
      caption: 'Sinov istoryasi',
      agreed: true,
    );
    final feed = await repo.storyFeed();
    expect(feed, isNotEmpty);
  });

  test('begona profilga post yozib bo‘lmaydi', () async {
    // ABC123 — Malikaniki. Egalik SERVERDA tekshiriladi.
    await expectLater(
      repo.addPost('ABC123', imageUrl: uploadedImage, caption: 'begona', agreed: true),
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

  // ── ID QIDIRUVI: BOR-YO'QLIGI VA NARXI ────────────────────────
  //
  // "Qidiruvda ID lar yozilsa bor-yo'qligi, yo'q bo'lsa narxi,
  // uni band qilaman desa..." — do'kondagi to'liq yo'l.

  test('BO‘SH kod — narxi va tarifi bilan qaytadi', () async {
    // Hech kimda bo'lmagan standart kod. Narx SERVERDA kodning
    // shaklidan hisoblanadi (`personalPurchaseQuote`).
    final q = await repo.codeQuote('QQW345');
    expect(q.taken, isFalse);
    expect(q.purchasable, isTrue, reason: 'bo‘sh kod sotuvda bo‘lishi kerak');
    expect(q.amount, greaterThan(0), reason: 'narx ko‘rsatilishi shart');
    expect(q.tier, isNotEmpty);
  });

  test('BAND kod — sotib bo‘lmaydi, sababi aytiladi', () async {
    final q = await repo.codeQuote('VIP001');
    expect(q.taken, isTrue);
    expect(q.purchasable, isFalse);
    expect(q.reason, 'already_taken');

    // Profili esa ochiladi — ilova "Band" deb ko'rsatib, profilga
    // o'tish tugmasini beradi.
    final rec = await repo.record('VIP001');
    expect(rec.name, isNotEmpty);
  });

  test('narx so‘rash kodni BAND QILMAYDI', () async {
    // Narxni ko'rgan odam pending buyurtma qoldirib ketmasligi
    // kerak: aks holda kod 24 soatga yopilib qolardi.
    final first = await repo.codeQuote('QQW345');
    final again = await repo.codeQuote('QQW345');
    expect(first.purchasable, isTrue);
    expect(again.purchasable, isTrue);
  });

  test('bo‘sh kodni band qilish — summa NARX BILAN BIR XIL', () async {
    const code = 'QQW346';
    final q = await repo.codeQuote(code);
    expect(q.purchasable, isTrue);

    // NARXNI SERVER hisoblaydi: mijoz yuborgan summa e'tiborga
    // olinmaydi (aks holda ID ni 1 so'mga olish mumkin bo'lardi).
    final order = await repo.reserveRecord(
      code,
      name: 'Sinov',
      phone: '+998901112233',
      provider: 'payme',
    );
    expect(order.id, greaterThan(0));
    expect(order.price, q.amount,
        reason: 'to‘lanadigan summa ko‘rsatilgan narx bilan bir xil bo‘lsin');

    // TO'LOV HAVOLASI — ilova shu manzilni ochadi. Payme har doim
    // bo'lishi kerak; Click faqat kaliti sozlangan bo'lsa.
    expect(order.linkFor('payme'), isNotNull,
        reason: 'Payme havolasi kelishi shart');

    // Band qilingandan keyin o'sha kod endi sotuvda emas.
    final after = await repo.codeQuote(code);
    expect(after.purchasable, isFalse);
    expect(after.reason, 'reserved_pending_payment');
  });

  test('CLICK bilan ham band qilinadi', () async {
    const code = 'QQW347';
    final order = await repo.reserveRecord(
      code,
      name: 'Sinov',
      phone: '+998901112233',
      provider: 'click',
    );
    expect(order.id, greaterThan(0));
    expect(order.price, greaterThan(0));

    // CLICK kaliti sozlangan bo'lsa havola ham keladi. Sozlanmagan
    // bo'lsa ilova tugmani o'chiq ko'rsatadi — bu YOLG'ON emas:
    // "Click bor" deb ko'rsatib, bosilganda Payme ochilishi eng
    // yomon variant edi (avval aynan shunday bo'lgan).
    final click = order.linkFor('click');
    if (click != null) expect(click, contains('http'));
  });

  // ── REELS: QO'YISH VA O'CHIRISH ───────────────────────────────

  test('Reels — video post joylanadi, lentaga tushadi va o‘chadi', () async {
    // 1×1 piksel "video" o'rniga kichik fayl: bu yerda muhimi
    // media havolasi post bilan birga saqlanishi va lentada
    // qaytishi.
    expect(uploadedImage, isNotEmpty,
        reason: 'oldingi test media yuklagan bo‘lishi kerak');

    final created = await repo.addPost(
      'VIP001',
      imageUrl: uploadedImage,
      caption: 'Sinov reels',
      agreed: true,
    );
    final id = created.id;
    expect(id, isNotEmpty);

    final feed = await repo.feed(page: 1);
    final mine = feed.items.where((e) => '${e.id}' == id);
    expect(mine, isNotEmpty, reason: 'yangi post lentada ko‘rinishi kerak');

    // IZOH — Reels ichidagi varaqa shu metodlarni chaqiradi.
    final postId = int.parse(id);
    final added = await repo.addComment('post', postId, 'Zo‘r');
    expect(added.comment.body, 'Zo‘r');
    final list = await repo.comments('post', postId);
    expect(list.items.map((e) => e.body), contains('Zo‘r'));
    await repo.deleteComment(added.comment.id);

    // O'CHIRISH — o'z kontentini egasi o'chira oladi.
    await repo.deletePost(int.parse(id));
    final after = await repo.feed(page: 1);
    expect(after.items.any((e) => '${e.id}' == id), isFalse,
        reason: 'o‘chirilgan post lentada qolmasligi kerak');
  });

  test('begona Reels o‘chirilmaydi', () async {
    // Dilshod post joylaydi, Malika uni o'chirishga uriladi.
    final mine = await repo.addPost(
      'VIP001',
      imageUrl: uploadedImage,
      caption: 'Begona o‘chira olmasin',
      agreed: true,
    );

    final other = Repo(Api(baseUrl: base));
    await other.login(login: 'malika@nfcstore.uz', password: _demoPassword);
    await expectLater(
      other.deletePost(int.parse(mine.id)),
      throwsA(anything),
      reason: 'begona odam o‘chira olmasligi kerak',
    );

    // Egasi esa o'chira oladi.
    await repo.deletePost(int.parse(mine.id));
  });

  // ── BIZNES: POST VA ISTORYA ───────────────────────────────────
  //
  // "Biznes profil bizneslarga yoqishi kerak, post/istorya qo'ya
  // olishi kerak" — shu yo'l boshdan-oxir tekshiriladi.

  test('biznes POST joylaydi, o‘z ro‘yxatida va lentada ko‘rinadi',
      () async {
    // LATTE egasi — alohida hisob (demo ma'lumotlarida uchinchi
    // foydalanuvchi). Ilovada u "biznes shaxs" bo'lib kiradi.
    final owner = Repo(Api(baseUrl: base));
    await owner.login(login: 'latte@nfcstore.uz', password: _demoPassword);
    final media = await owner.uploadMedia(_png, contentType: 'image/png');

    final before = await owner.companyPosts('LATTE');

    await owner.addCompanyPost(
      'LATTE',
      imageUrl: media,
      caption: 'Yangi menyu keldi',
      agreed: true,
    );

    // 1) Egasi o'z postlarini KO'RADI (profil egasidagi "Postlarim"
    //    aynan shu metodni chaqiradi).
    final after = await owner.companyPosts('LATTE');
    expect(after.length, before.length + 1);
    expect(after.map((p) => p.caption), contains('Yangi menyu keldi'));

    // 2) Post UMUMIY LENTAGA ham tushadi.
    final feed = await repo.feed(page: 1);
    expect(
      feed.items.any((e) => e.caption == 'Yangi menyu keldi' && e.isCompany),
      isTrue,
      reason: 'biznes posti lentada ko‘rinishi kerak',
    );

    // 3) Egasi o'chira oladi.
    final fresh = after.firstWhere((p) => p.caption == 'Yangi menyu keldi');
    await owner.deleteCompanyPost('LATTE', int.parse(fresh.id));
    final gone = await owner.companyPosts('LATTE');
    expect(gone.map((p) => p.caption), isNot(contains('Yangi menyu keldi')));
  });

  test('biznes ISTORYA joylaydi', () async {
    final owner = Repo(Api(baseUrl: base));
    await owner.login(login: 'latte@nfcstore.uz', password: _demoPassword);
    final media = await owner.uploadMedia(_png, contentType: 'image/png');
    await owner.addCompanyStory(
      'LATTE',
      imageUrl: media,
      caption: 'Bugun 20% chegirma',
      agreed: true,
    );
    final feed = await repo.feed(page: 1);
    expect(
      feed.items.any((e) => e.caption == 'Bugun 20% chegirma'),
      isTrue,
      reason: 'biznes istoryasi lentada ko‘rinishi kerak',
    );
  });

  test('begona odam biznesga post yoza olmaydi', () async {
    final other = Repo(Api(baseUrl: base));
    await other.login(login: 'malika@nfcstore.uz', password: _demoPassword);
    await expectLater(
      other.addCompanyPost(
        'LATTE',
        imageUrl: uploadedImage,
        caption: 'Begona',
        agreed: true,
      ),
      reason: 'faqat kompaniya egasi post yoza oladi',
      throwsA(anything),
    );
  });

  // ── KONTAKT QOLDIRISH ─────────────────────────────────────────

  test('kontakt qoldirish — ism va aloqa SERVERDA tekshiriladi', () async {
    final guest = Repo(Api(baseUrl: base));

    // Ism yo'q — server rad etadi (mijozdagi tekshiruv bilan bir xil).
    await expectLater(
      guest.sendLead('VIP001', name: '', phone: '+998901112233'),
      throwsA(anything),
    );

    // Aloqa kanali yo'q — u ham rad etiladi.
    await expectLater(
      guest.sendLead('VIP001', name: 'Sinov'),
      throwsA(anything),
    );
  });
}

/// ENG KICHIK HAQIQIY PNG (1×1) — server MIME va hajmni tekshiradi,
/// shuning uchun "shunchaki baytlar" yaramaydi.
const _png = <int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
];
