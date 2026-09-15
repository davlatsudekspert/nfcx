import 'api_client.dart';
import 'models.dart';

/// Backend bilan gaplashadigan YAGONA qatlam.
///
/// Ekranlar `Api` ni to'g'ridan-to'g'ri chaqirmaydi: endpoint yo'llari,
/// javob shakllari va ularning o'ziga xosliklari shu yerda qoladi.
/// Backend bir yo'lni o'zgartirsa, tuzatish bitta faylda bo'ladi.
class Repo {
  Repo(this.api);

  final Api api;

  // ── SO'ROVNI TAKRORLAMASLIK ────────────────────────────────────────
  //
  // Katalog (`/api/records`) 500 tagacha yozuv qaytaradi va uni HAM
  // Home, HAM Discover so'raydi. Qobiq tablarni bir vaqtda tirik
  // saqlaydi, ya'ni ilova ochilishida ikkalasi deyarli bir vaqtda
  // so'rab, bir xil 500 qatorni IKKI MARTA yuklab olardi. Shaxs
  // almashtirilganda yana takrorlanardi.
  //
  // Ikki qatlamli himoya:
  //   1) UCHIB KETAYOTGAN so'rov qayta so'ralsa — o'sha `Future`
  //      qaytariladi (ikkinchi so'rov umuman ketmaydi);
  //   2) natija qisqa muddat saqlanadi — tab almashganda qayta
  //      yuklanmaydi, lekin ma'lumot ham eskirib qolmaydi.
  /// 30 SONIYA — 90 EMAS.
  ///
  /// Sayt va ilova bitta bazadan o'qiydi: saytda ID sotilsa yoki yangi
  /// profil ochilsa, ilova buni TEZ ko'rishi kerak. 90 soniya uzun edi —
  /// odam ilovada eskirgan katalogni ko'rib turardi. 30 soniya ikkala
  /// tomonni ham qondiradi: tab almashganda so'rov takrorlanmaydi,
  /// lekin ma'lumot ham eskirmaydi.
  static const _catalogTtl = Duration(seconds: 30);
  Future<List<Record>>? _catalogInFlight;
  List<Record>? _catalogCache;
  DateTime? _catalogAt;

  /// Keshni majburan bo'shatish — "tortib yangilash" uchun.
  void invalidateCatalog() {
    _catalogCache = null;
    _catalogAt = null;
  }

  Map<String, dynamic> _map(dynamic v) =>
      v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};

  List<Map<String, dynamic>> _rows(dynamic v, [String? key]) {
    final raw = v is Map && key != null ? v[key] : v;
    return raw is List
        ? raw.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
        : const [];
  }

  // ── Auth ───────────────────────────────────────────────────────────

  /// Kirish.
  ///
  /// TOKEN IKKI YO'LDAN BIRI BILAN KELADI:
  ///   1) javob tanasida — server `X-Client` sarlavhasini mobil deb
  ///      tanigan bo'lsa (`worker.js`: mobile | android | ios);
  ///   2) `Set-Cookie` sarlavhasida — u HAR DOIM yuboriladi.
  ///
  /// IKKALASI BIR XIL TOKEN: server uni bitta jadvalda, bitta SHA-256
  /// bilan saqlaydi va `Authorization: Bearer` orqali ham qabul
  /// qiladi. Ilgari faqat birinchi yo'l o'qilardi va tana tokensiz
  /// kelganda kirish "Server sessiya ochmadi" bilan to'xtardi —
  /// qurilmada aynan shunday bo'ldi.
  ///
  /// Cookie'ning o'zi ishlatilmaydi: ilova sessiyani Keystore'da
  /// saqlaydi va har so'rovga Bearer qo'yadi. Bu yerdan faqat
  /// QIYMAT olinadi.
  Future<String> login({required String login, required String password}) async {
    final res = await api.postAuth(
      '/api/auth/login',
      {'login': login, 'password': password},
    );
    final token = _sessionToken(res);
    if (token.isEmpty) {
      // Nima kelganini AYTAMIZ: tana JSON bo'lmagan bo'lishi ham
      // mumkin (masalan himoya qatlamining HTML sahifasi) — bunda
      // sabab faqat shu tafsilotdan bilinadi.
      throw ApiError('no_token', status: res.status, detail: res.raw);
    }
    api.token = token;
    return token;
  }

  /// Javobdan sessiya tokenini oladi: avval tanadan, keyin cookie'dan.
  String _sessionToken(ApiResponse res) {
    final fromBody = '${res.map['token'] ?? ''}'.trim();
    if (fromBody.isNotEmpty) return fromBody;
    return (res.sessionCookie ?? '').trim();
  }

  /// Emailga tasdiqlash kodini yuborish.
  ///
  /// Javobdagi `channel`: `email` | `telegram` | `none`. Ekran shunga
  /// qarab yozuvni o'zgartiradi — "Telegram" deb yozib turib emailga
  /// kod yuborish eng chalg'ituvchi xato bo'lardi.
  Future<String> requestRegisterCode({required String email, String? phone}) async {
    final r = _map(await api.post('/api/auth/request-register-code', {
      'email': email,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    }));
    return '${r['channel'] ?? 'none'}';
  }

  Future<String> register({
    required String email,
    required String password,
    required String phone,
    required String emailCode,
    required bool tosAccepted,
  }) async {
    final res = await api.postAuth('/api/auth/register', {
      'email': email,
      'password': password,
      'phone': phone,
      'emailCode': emailCode,
      'tosAccepted': tosAccepted,
    });
    // Kirishdagi kabi: tana bo'lmasa cookie'dan olinadi.
    final token = _sessionToken(res);
    if (token.isNotEmpty) api.token = token;
    return token;
  }

  /// Parolni tiklash uchun kod so'rash.
  ///
  /// Server HAR DOIM `{ok:true}` qaytaradi — hisob bor-yo'qligi
  /// oshkor qilinmaydi. Shuning uchun ilova ham "kod yuborildi" deb
  /// yozadi va boshqa hech narsa aytmaydi.
  Future<void> requestPasswordReset(String login) =>
      api.post('/api/auth/request-password-reset', {'email': login});

  /// Kod bilan yangi parol o'rnatish.
  Future<void> resetPassword({
    required String login,
    required String code,
    required String password,
  }) =>
      api.post('/api/auth/reset-password', {
        'email': login,
        'code': code,
        'password': password,
      });

  /// Sessiya + egalik qilinadigan shaxsiy ID'lar — bitta so'rovda.
  Future<({AppUser? user, List<Record> cards})> me() async {
    final r = _map(await api.get('/api/auth/me'));
    final u = r['user'];
    return (
      user: u is Map ? AppUser.fromJson(u.cast<String, dynamic>()) : null,
      cards: _rows(r, 'cards').map(Record.fromJson).toList(),
    );
  }

  Future<void> logout() async {
    try {
      await api.post('/api/auth/logout');
    } finally {
      api.token = null;
    }
  }

  // ── Profillar ──────────────────────────────────────────────────────

  Future<Record> record(String code) async =>
      Record.fromJson(_map(await api.get('/api/records/$code')));

  Future<List<Post>> recordPosts(String code) async =>
      _rows(await api.get('/api/records/$code/posts'), 'posts').map(Post.fromJson).toList();

  Future<List<Post>> recordStories(String code) async =>
      _rows(await api.get('/api/records/$code/stories'), 'stories').map(Post.fromJson).toList();

  /// Postni yoqtirish — server holatni TESKARISIGA o'giradi va
  /// yangi sonni qaytaradi. Mijoz o'zi sanamaydi: ikkita qurilmadan
  /// bosilganda raqamlar ajralib ketardi.
  Future<({bool liked, int count})> likePost(int id) async {
    final r = _map(await api.post('/api/posts/$id/like'));
    return (liked: r['liked'] == true, count: r["count"] is num ? (r["count"] as num).round() : 0);
  }

  /// ISTORYANI YOQTIRISH.
  ///
  /// `count` VA `likeCount` — ikkalasi ham o'qiladi. Server post
  /// uchun `count`, istorya uchun `likeCount` qaytaradi (ikki
  /// endpoint vaqt o'tib bir-biridan uzoqlashib ketgan). Ilgari bu
  /// yerda faqat `count` o'qilardi, ya'ni istoryaga yurak bosilgach
  /// hisob HAR DOIM 0 ga tushardi.
  Future<({bool liked, int count})> likeStory(int id) async {
    final r = _map(await api.post('/api/stories/$id/like'));
    final n = r['count'] ?? r['likeCount'];
    return (liked: r['liked'] == true, count: n is num ? n.round() : 0);
  }

  /// Istorya OCHILGANI — egasi "nechta odam ko'rdi" ni bilishi uchun.
  ///
  /// Natijasi kutilmaydi va xatosi yutiladi: hisob yozilmagani
  /// uchun istoryani ko'rsatmaslik mantiqsiz bo'lardi.
  Future<int> viewStory(int id) async {
    final r = _map(await api.post('/api/stories/$id/view'));
    final n = r['viewCount'];
    return n is num ? n.round() : 0;
  }

  /// HAQIQIY STORY LENTASI — obuna bo'lingan odamlarniki.
  ///
  /// Bosh ekrandagi dumaloqchalar ilgari FOYDALANUVCHINING O'Z
  /// ID'larini ko'rsatardi: ya'ni har bir halqa "yangi kontent bor"
  /// deb yonib turardi, lekin ortida hech narsa yo'q edi. Server bu
  /// lentani allaqachon beradi.
  ///
  /// Xato bo'lsa BO'SH ro'yxat: lenta yiqilgani uchun butun bosh
  /// ekranni xato holatiga o'tkazish noto'g'ri bo'lardi.
  Future<List<StoryFeedEntry>> storyFeed() async {
    try {
      return _rows(await api.get('/api/stories/feed'), 'feed')
          .map(StoryFeedEntry.fromJson)
          .toList();
    } catch (_) {
      return const [];
    }
  }

  /// Profil ko'rilganini belgilash — "fire and forget".
  ///
  /// Xatosi YUTILADI: statistika yozuvi tushmagani uchun odamga profil
  /// ko'rsatmaslik mantiqsiz bo'lardi.
  Future<void> markView(String code) async {
    try {
      await api.post('/api/records/$code/view');
    } catch (_) {}
  }

  /// NFC/QR orqali ochilganini belgilash.
  Future<void> tap(String code) async {
    try {
      await api.post('/api/tap/$code');
    } catch (_) {}
  }

  Future<Map<String, dynamic>> analytics(String code, {int days = 30}) async =>
      _map(await api.get('/api/records/$code/analytics', query: {'days': days}));

  // ── Obuna ──────────────────────────────────────────────────────────

  Future<FollowStats> followStats(String code) async =>
      FollowStats.fromJson(_map(await api.get('/api/follow-stats/$code')));

  /// Obunachilar (`dir: followers`) yoki obunalar (`dir: following`).
  ///
  /// Server 200 tagacha qator qaytaradi va XATO BO'LSA bo'sh ro'yxat
  /// beradi (yiqilmaydi) — shuning uchun bu yerda ham qo'shimcha
  /// himoya kerak emas.
  Future<List<FollowEntry>> followList(String code, {bool following = false}) async =>
      _rows(
        await api.get('/api/follow-list/$code', query: {if (following) 'dir': 'following'}),
        'list',
      ).map(FollowEntry.fromJson).toList();

  Future<void> follow(String code) => api.post('/api/follow/$code');

  Future<void> unfollow(String code) => api.post('/api/unfollow/$code');

  // ── Kompaniyalar ───────────────────────────────────────────────────

  Future<List<Company>> myCompanies() async =>
      _rows(await api.get('/api/companies/mine'), 'companies').map(Company.fromJson).toList();

  Future<Company> company(String id) async {
    final r = _map(await api.get('/api/companies/$id'));
    return Company.fromJson(_map(r['company']));
  }

  Future<List<Product>> companyCatalog(String id) async =>
      _rows(await api.get('/api/companies/$id/catalog'), 'items').map(Product.fromJson).toList();

  Future<List<Post>> companyPosts(String id) async =>
      _rows(await api.get('/api/companies/$id/posts'), 'posts').map(Post.fromJson).toList();

  Future<List<Post>> companyStories(String id) async =>
      _rows(await api.get('/api/companies/$id/stories'), 'stories').map(Post.fromJson).toList();

  Future<Map<String, dynamic>> companyStats(String id) async =>
      _map(await api.get('/api/companies/$id/stats'));

  Future<List<Map<String, dynamic>>> companyOrders(String id) async =>
      _rows(await api.get('/api/companies/$id/orders'), 'orders');

  /// Katalogdan buyurtma. Narx SERVERDA katalogdan olinadi — mijoz
  /// yuborgan summa hisobga olinmaydi.
  Future<void> placeCompanyOrder(
    String id, {
    required String name,
    required String phone,
    String? itemId,
    int qty = 1,
    String note = '',
  }) =>
      api.post('/api/companies/$id/orders', {
        'name': name,
        'phone': phone,
        if (itemId != null) 'itemId': itemId,
        'qty': qty,
        'note': note,
      });

  /// Buyurtma holatini o'zgartirish (faqat ega).
  ///
  /// `PATCH` — backend aynan shuni kutadi. Ruxsat SERVERDA
  /// tekshiriladi: mijoz tomonidagi "men egaman" bayrog'iga
  /// ishonilmaydi.
  Future<void> setCompanyOrderStatus(String id, int orderId, String status) =>
      api.patch('/api/companies/$id/orders/$orderId', {'status': status});

  /// Shaxsiy profilni tahrirlash.
  ///
  /// Butun yozuv yuboriladi (backend `PUT` da to'liq obyekt kutadi) —
  /// shuning uchun chaqiruvchi avval mavjud yozuvni o'qib, faqat
  /// kerakli maydonlarni o'zgartiradi.
  Future<Record> updateRecord(String code, Map<String, dynamic> body) async =>
      Record.fromJson(_map(await api.put('/api/records/$code', body)));

  /// Kompaniya sahifasidagi hodisa (ko'rish / amal / mahsulot).
  Future<void> companyEvent(String id, {String kind = 'view', String? ref}) async {
    try {
      await api.post('/api/companies/$id/event', {'kind': kind, if (ref != null) 'ref': ref});
    } catch (_) {}
  }

  // ── Discover ───────────────────────────────────────────────────────

  Future<List<Record>> searchRecords(String q) async =>
      _rows(await api.get('/api/records/search', query: {'q': q}), 'records')
          .map(Record.fromJson)
          .toList();

  /// KOMPANIYA QIDIRUVI.
  ///
  /// HAQIQIY XATO: server javobni `{results: [...]}` shaklida beradi,
  /// bu yerda esa `companies` kaliti o'qilardi — ya'ni natija HAR
  /// DOIM bo'sh edi. Egasi buni surat bilan ko'rsatdi: "nfcstore"
  /// deb qidirilganda kompaniyalar umuman chiqmasdi.
  ///
  /// Ikkala kalit ham o'qiladi: eski server `companies`, yangisi
  /// `results` beradi.
  Future<List<Company>> searchCompanies(String q) async {
    final r = await api.get('/api/companies/search', query: {'q': q});
    final rows = r is Map && r['results'] is List
        ? _rows(r, 'results')
        : _rows(r, 'companies');
    return rows.map(Company.fromJson).toList();
  }

  /// KOD BANDMI VA NARXI QANCHA.
  ///
  /// `searchRecords()` dan FARQI: u faqat MAVJUD profillarni topadi,
  /// bu esa hali hech kim olmagan kodning ham tarifi va narxini
  /// aytadi — saytdagi kabi. Narx SERVERDAN.
  Future<Map<String, dynamic>> checkCode(String code) async =>
      _map(await api.get('/api/records/check', query: {'code': code}));

  /// TARIF NARXLARI — katalog uchun.
  ///
  /// Katalogda o'sha tarifdan bo'sh kod qolmagan bo'lsa ham narx
  /// ko'rinishi kerak.
  Future<Map<String, int>> idPricing() async {
    final r = _map(await api.get('/api/settings/id-pricing'));
    final p = r['pricing'];
    if (p is! Map) return const {};
    return {
      for (final e in p.entries)
        if (e.value is num) '${e.key}': (e.value as num).round(),
    };
  }

  /// Katalog — barcha ochiq profillar va sotuvdagi ID'lar.
  ///
  /// `force: true` — keshni chetlab o'tadi (tortib yangilash).
  Future<List<Record>> catalog({bool force = false}) {
    if (!force) {
      final cached = _catalogCache;
      final at = _catalogAt;
      if (cached != null && at != null && DateTime.now().difference(at) < _catalogTtl) {
        return Future.value(cached);
      }
      final inFlight = _catalogInFlight;
      if (inFlight != null) return inFlight;
    }
    final future = api.get('/api/records').then((r) {
      final list = _rows(r).map(Record.fromJson).toList();
      _catalogCache = list;
      _catalogAt = DateTime.now();
      return list;
    }).whenComplete(() => _catalogInFlight = null);
    _catalogInFlight = future;
    return future;
  }

  /// Ochiq kompaniyalar ro'yxati — Discover uchun.
  ///
  /// Faqat FAOL kompaniyalar keladi va maxfiy maydonlar (egasi,
  /// telefoni, to'lov holati) javobda umuman yo'q.
  Future<List<Company>> companies() async =>
      _rows(await api.get('/api/companies'), 'companies').map(Company.fromJson).toList();

  Future<List<Map<String, dynamic>>> categories() async =>
      _rows(await api.get('/api/categories'), 'categories');

  // ── Buyurtma va to'lov ─────────────────────────────────────────────

  Future<List<Order>> orders() async =>
      _rows(await api.get('/api/orders'), 'orders').map(Order.fromJson).toList();

  /// To'lov usullari yoqilganmi (Payme/Click kalitlari sozlanganmi).
  Future<Map<String, dynamic>> paymentsEnabled() async =>
      _map(await api.get('/api/settings/payments-enabled'));

  /// Jismoniy karta narxlari va yetkazish muddati.
  Future<Map<String, dynamic>> physicalPricing() async =>
      _map(await api.get('/api/settings/physical-nfc-pricing'));

  Future<Map<String, dynamic>> orderPhysicalCard(String code, Map<String, dynamic> body) async =>
      _map(await api.post('/api/records/$code/order-physical-card', body));

  /// ID'ni sovg'a qilish. Qabul qiluvchi tasdiqlagach o'tadi.
  /// Parolni o'zgartirish — joriy parolni bilgan holda.
  ///
  /// NIMA UCHUN `-direct`: ikkinchi variant (`change-password`)
  /// email/Telegram kodini talab qiladi va u parolni UNUTGANLAR
  /// uchun. Sozlamalarda esa odam allaqachon kirgan va joriy
  /// parolini biladi — undan yana kod kutish ortiqcha to'siq.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) =>
      api.post('/api/settings/change-password-direct', {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });

  /// O'z NFC ID'sini butunlay o'chirish.
  ///
  /// Server OXIRGI ID ni o'chirishga yo'l qo'ymaydi (`last_card`) —
  /// aks holda odam hech qanday profilsiz qolardi.
  Future<void> deleteRecord(String code) => api.delete('/api/records/$code');

  // ── Kontent yaratish ───────────────────────────────────────────────

  /// Rasm yoki videoni yuklab, ichki manzilini qaytaradi
  /// (`/uploads/story_...`).
  ///
  /// Server faqat SHU shakldagi manzilni qabul qiladi — ya'ni post
  /// va istoryaga tashqi havola qo'yib bo'lmaydi.
  Future<String> uploadMedia(List<int> bytes, {String contentType = 'image/jpeg'}) async {
    final r = _map(await api.upload('/api/upload-media', bytes, contentType: contentType));
    final url = '${r['url'] ?? ''}';
    if (url.isEmpty) throw ApiError('bad_image');
    return url;
  }

  /// Yangi post. Manzil `uploadMedia` dan keladi.
  ///
  /// RASM YOKI VIDEO — bittasi. Server ikkalasini ham qabul qiladi
  /// (`posts.video_url` ustuni 2026-09 dan beri bor), ilova esa
  /// faqat rasm yuborardi: saytdan qo'yilgan video postni ko'rish
  /// mumkin edi, ilovadan qo'yish esa yo'q edi.
  Future<Post> addPost(
    String code, {
    String? imageUrl,
    String? videoUrl,
    String caption = '',
    required bool agreed,
  }) async =>
      Post.fromJson(_map(await api.post('/api/records/$code/posts', {
        if (imageUrl != null) 'imageUrl': imageUrl,
        if (videoUrl != null) 'videoUrl': videoUrl,
        if (caption.isNotEmpty) 'caption': caption,
        'agreed': agreed,
      })));

  /// Yangi istorya. 24 soatdan keyin serverda o'zi o'chadi.
  ///
  /// Kontent qoidalariga rozilik (`agreed`) SERVERDA tekshiriladi —
  /// faqat mijozda bo'lsa so'rovni to'g'ridan-to'g'ri yuborib chetlab
  /// o'tish mumkin edi. Shu sababli ekranda ham rozilik SO'RALADI,
  /// bu yerda `true` shunchaki yozib qo'yilmaydi.
  Future<void> addStory(
    String code, {
    String? imageUrl,
    String? videoUrl,
    String caption = '',
    required bool agreed,
  }) =>
      api.post('/api/records/$code/stories', {
        if (imageUrl != null) 'imageUrl': imageUrl,
        if (videoUrl != null) 'videoUrl': videoUrl,
        if (caption.isNotEmpty) 'caption': caption,
        'agreed': agreed,
      });

  /// O'z postini o'chirish.
  /// HISOBNI O'CHIRISH — foydalanuvchining o'zi.
  ///
  /// Google Play hisob yaratishga ruxsat beradigan ilovadan shu
  /// yo'lni ILOVA ICHIDA talab qiladi (izohi serverda,
  /// `hosting/api/account.js`).
  Future<void> deleteAccount() => api.delete('/api/account');

  Future<void> deletePost(int id) => api.delete('/api/posts/$id');

  /// O'z istoryasini o'chirish (24 soat tugashini kutmasdan).
  Future<void> deleteStory(int id) => api.delete('/api/stories/$id');

  // ── Shikoyat va bloklash ───────────────────────────────────────────
  //
  // Nomaqbul kontentni ko'rgan odam qo'lidan biror narsa kelishi
  // kerak, bizga esa u haqda xabar yetib borishi kerak. Google Play
  // ham foydalanuvchi kontenti bor ilovalardan aynan shuni talab
  // qiladi.

  /// Shikoyat yuborish. `targetKind`: post | story | company_post |
  /// record | company. `reason` — `ReportReason` kaliti.
  Future<void> report({
    required String targetKind,
    required String targetId,
    required String reason,
    String ownerCode = '',
    String note = '',
  }) =>
      api.post('/api/reports', {
        'targetKind': targetKind,
        'targetId': targetId,
        'reason': reason,
        if (ownerCode.isNotEmpty) 'ownerCode': ownerCode,
        if (note.isNotEmpty) 'note': note,
      });

  /// Profilni bloklash — uning kontenti lentada ko'rinmaydi.
  Future<void> block({required String kind, required String id}) =>
      api.post('/api/blocks', {'kind': kind, 'id': id});

  Future<void> unblock({required String kind, required String id}) =>
      api.delete('/api/blocks/$kind/$id');

  // ── Biznes kontenti ────────────────────────────────────────────────
  //
  // Shaxsiy profil bilan BIR XIL oqim, boshqa endpoint. Yaratish
  // ekrani (`ComposeScreen`) ikkalasiga ham xizmat qiladi —
  // nusxalangan kod yozilmadi.

  /// `agreed` — EKRANDAN keladi, qotib yozilmaydi.
  ///
  /// Ilgari bu yerda `'agreed': true` turardi: odam hech qanday
  /// ogohlantirish ko'rmasdan post joylardi, serverda esa "u rozilik
  /// bergan" degan yozuv qolardi. Ya'ni rozilik SOXTA edi va uning
  /// yuridik qiymati yo'q edi.
  Future<void> addCompanyPost(
    String id, {
    String? imageUrl,
    String? videoUrl,
    String caption = '',
    required bool agreed,
  }) =>
      api.post('/api/companies/$id/posts', {
        if (imageUrl != null) 'imageUrl': imageUrl,
        if (videoUrl != null) 'videoUrl': videoUrl,
        if (caption.isNotEmpty) 'caption': caption,
        'agreed': agreed,
      });

  Future<void> addCompanyStory(
    String id, {
    String? imageUrl,
    String? videoUrl,
    String caption = '',
    required bool agreed,
  }) =>
      api.post('/api/companies/$id/stories', {
        if (imageUrl != null) 'imageUrl': imageUrl,
        if (videoUrl != null) 'videoUrl': videoUrl,
        if (caption.isNotEmpty) 'caption': caption,
        'agreed': agreed,
      });

  Future<void> deleteCompanyPost(String id, int postId) =>
      api.delete('/api/companies/$id/posts/$postId');

  Future<void> deleteCompanyStory(String id, int storyId) =>
      api.delete('/api/companies/$id/stories/$storyId');

  // ── Biznes profili ─────────────────────────────────────────────────

  /// Biznes profilini tahrirlash.
  ///
  /// FAQAT YUBORILGAN MAYDONLAR o'zgaradi: server `body[key] == null`
  /// bo'lsa joriy qiymatni qoldiradi. Shuning uchun bu yerda ham
  /// bo'sh maydonlar yuborilmaydi — aks holda tahrirlash ekranida
  /// ko'rsatilmagan narsa (masalan musiqa) tozalanib ketardi.
  Future<Company> updateCompany(String id, Map<String, dynamic> body) async {
    await api.patch('/api/companies/$id', body);
    return company(id);
  }

  /// Ish vaqtini saqlash.
  ///
  /// Server 7 ta elementni kutadi va o'zi normallashtiradi
  /// (`normalizeHoursD1`): ochilish yoki yopilish bo'sh bo'lsa kun
  /// YOPIQ bo'lib yoziladi.
  Future<Company> updateHours(String id, List<DayHours> hours) =>
      updateCompany(id, {'hours': hours.map((d) => d.toJson()).toList()});

  /// Galereya — 12 tagacha manzil. Server ortig'ini kesadi.
  Future<Company> updateGallery(String id, List<String> urls) =>
      updateCompany(id, {'gallery': urls});

  // ── Biznes katalogi ────────────────────────────────────────────────

  /// Yangi mahsulot. Server butun kompaniyani qaytaradi, lekin
  /// ekranga faqat katalog kerak — shuning uchun ro'yxat qayta
  /// so'raladi va bitta shakldan o'qiladi (`companyCatalog`).
  Future<void> addProduct(String id, Map<String, dynamic> body) =>
      api.post('/api/companies/$id/catalog', body);

  Future<void> updateProduct(String id, String itemId, Map<String, dynamic> body) =>
      api.patch('/api/companies/$id/catalog/$itemId', body);

  Future<void> deleteProduct(String id, String itemId) =>
      api.delete('/api/companies/$id/catalog/$itemId');

  /// Company ID bandmi va narxi qancha.
  Future<Map<String, dynamic>> checkCompanyId(String id) async =>
      _map(await api.get('/api/companies/check', query: {'id': id}));

  /// Yangi biznes hisob ochish.
  ///
  /// `auto: true` — tasodifiy BEPUL Company ID (2026-09 qarori).
  /// Nom tanlansa narxi bo'ladi va to'lovdan keyin faollashadi.
  Future<Map<String, dynamic>> createCompany(Map<String, dynamic> body) async =>
      _map(await api.post('/api/companies', body));

  // ── To'lovlar tarixi ───────────────────────────────────────────────

  /// Barcha buyurtma va to'lovlar — eng yangisi birinchi.
  ///
  /// Server 50 tagacha qator beradi. Sahifalash YO'Q va kerak ham
  /// emas: bitta odamda yuzlab to'lov bo'lmaydi.
  Future<({List<PaymentEntry> items, int pendingPayout})> payments() async {
    final r = _map(await api.get('/api/payments'));
    return (
      items: _rows(r, 'payments').map(PaymentEntry.fromJson).toList(),
      pendingPayout: (r['pendingPayout'] as num?)?.round() ?? 0,
    );
  }

  // ── Qo'llab-quvvatlash ─────────────────────────────────────────────

  /// Murojaatlar tarixi — javob bilan birga.
  Future<List<SupportMessage>> supportMessages() async =>
      _rows(await api.get('/api/support'), 'messages')
          .map(SupportMessage.fromJson)
          .toList();

  /// Yangi murojaat. Server uni Telegram orqali adminga yuboradi.
  Future<void> sendSupport(String message) =>
      api.post('/api/support', {'message': message});

  /// Telegram bot foydalanuvchi nomi (`@nomi`). Sozlanmagan bo'lsa
  /// `null` — tugma ko'rsatilmaydi, ishlamaydigan havola berilmaydi.
  Future<String?> telegramBot() async {
    try {
      final r = _map(await api.get('/api/telegram/bot'));
      final name = '${r['username'] ?? ''}'.trim();
      return name.isEmpty ? null : name;
    } catch (_) {
      return null;
    }
  }

  // ── Premium ────────────────────────────────────────────────────────

  /// Premium profil so'rovi.
  ///
  /// KUTAYOTGAN BUYURTMA XATO EMAS: server o'sha buyurtmaning
  /// havolasini qaytaradi, yangisini yaratmaydi — ya'ni ikki marta
  /// pul yechilishi mumkin emas.
  Future<Order> requestPremium() async {
    final r = _map(await api.post('/api/premium/request'));
    return Order(
      id: (r['orderId'] as num?)?.round() ?? 0,
      code: 'PREMIUM',
      price: (r['amount'] as num?)?.round() ?? 0,
      status: 'pending',
      kind: 'premium_upgrade',
      payLink: '${r['payLink'] ?? ''}'.isEmpty ? null : '${r['payLink']}',
    );
  }

  // ── Jismoniy sovg'a karta ──────────────────────────────────────────
  //
  // DIQQAT: bu oqim YANGI HISOB yaratadi — u kartani sovg'a olgan,
  // hali ro'yxatdan o'tmagan odam uchun. Shuning uchun u kirish
  // ekranidan boradi, ilova ichidan emas.

  /// Kod haqiqiy sovg'a kartasimi (kimga atalgan).
  Future<String?> giftCardLookup(String code) async {
    final r = _map(await api.get('/api/nfc-gifts/$code'));
    final gift = r['gift'];
    return gift is Map ? '${gift['recipientName'] ?? ''}' : null;
  }

  /// Aktivatsiya kodini tekshirish — hisob yaratishdan OLDIN.
  Future<void> giftCardVerify(String code, String activationCode) =>
      api.post('/api/nfc-gifts/$code/verify', {'activationCode': activationCode});

  /// Faollashtirish: hisob yaratiladi va ID biriktiriladi.
  ///
  /// SERVER FAQAT COOKIE QAYTARADI, token emas — shuning uchun
  /// keyin oddiy kirish chaqiriladi. Bu vaqtinchalik yechim emas,
  /// backend cheklovi: `jsonWithCookie` mobil mijozni bilmaydi.
  Future<void> giftCardActivate(
    String code, {
    required String activationCode,
    required String email,
    required String password,
    required String name,
    String phone = '',
  }) =>
      api.post('/api/nfc-gifts/$code/activate', {
        'activationCode': activationCode,
        'email': email,
        'password': password,
        'name': name,
        if (phone.isNotEmpty) 'phone': phone,
      });

  // ── Sovg'a takliflari ──────────────────────────────────────────────
  //
  // `POST /api/records/:code/gift` ID ni DARHOL o'tkazmaydi — u
  // KUTILAYOTGAN TAKLIF yaratadi. Oluvchi uni tasdiqlamasa, ID
  // egasida qolaveradi. Ilovada bu qabul qilish oqimi YO'Q edi:
  // ya'ni ilovadan yuborilgan sovg'ani ilovadagi odam hech qachon
  // ololmasdi.

  /// Kiruvchi (menga) va chiquvchi (mendan) kutilayotgan takliflar.
  Future<({List<GiftOffer> incoming, List<GiftOffer> outgoing})> giftOffers() async {
    final r = _map(await api.get('/api/gift-offers'));
    List<GiftOffer> parse(String key, bool incoming) =>
        _rows(r, key).map((j) => GiftOffer.fromJson(j, incoming: incoming)).toList();
    return (incoming: parse('incoming', true), outgoing: parse('outgoing', false));
  }

  /// `accept` — ID menga o'tadi. `reject` — rad etaman.
  /// `cancel` — o'zim yuborgan taklifni qaytarib olaman.
  Future<void> giftOfferAction(int id, String action) =>
      api.post('/api/gift-offers/$id/$action');

  Future<Map<String, dynamic>> giftRecord(String code, Map<String, dynamic> body) async =>
      _map(await api.post('/api/records/$code/gift', body));

  Future<void> setPrimary(String code) => api.post('/api/records/$code/set-primary');

  /// NFC ID band qilish — kutilayotgan buyurtma yaratadi.
  ///
  /// NARXNI SERVER hisoblaydi (`personalPurchaseQuote`), mijoz
  /// yuborgan summa e'tiborga olinmaydi. Javob: `{orderId, price,
  /// payLink}` — `payLink` Payme checkout manzili.
  Future<Order> reserveRecord(String code, {String name = '', String phone = ''}) async {
    final r = _map(await api.post('/api/records/$code', {
      'name': name,
      'phone': phone,
    }));
    return Order(
      id: r['orderId'] is num ? (r['orderId'] as num).round() : 0,
      code: '${r['code'] ?? code}'.toUpperCase(),
      price: r['price'] is num ? (r['price'] as num).round() : 0,
      status: 'pending',
      kind: 'card_purchase',
      payLink: '${r['payLink'] ?? ''}'.isEmpty ? null : '${r['payLink']}',
    );
  }

  /// Bitta buyurtma holati — to'lovdan keyin shu so'raladi.
  ///
  /// TO'LOV HOLATINI FAQAT SERVER belgilaydi. Ilova "to'landi" deb o'zi
  /// qaror qilmaydi: Payme/Click tasdig'i backendga webhook orqali
  /// keladi va yagona haqiqat manbai o'sha.
  Future<Order> order(int id) async =>
      Order.fromJson(_map(await api.get('/api/orders/$id')));

  // ── Tasdiqlash ─────────────────────────────────────────────────────

  /// Telegram bot orqali profil tasdiqlash — havola va token.
  Future<Map<String, dynamic>> telegramLinkStart() async =>
      _map(await api.post('/api/auth/tg-link/start'));

  Future<Map<String, dynamic>> telegramLinkStatus(String token) async =>
      _map(await api.get('/api/auth/tg-link/status', query: {'token': token}));
}
