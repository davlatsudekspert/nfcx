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

  Map<String, dynamic> _map(dynamic v) =>
      v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};

  List<Map<String, dynamic>> _rows(dynamic v, [String? key]) {
    final raw = v is Map && key != null ? v[key] : v;
    return raw is List
        ? raw.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
        : const [];
  }

  // ── Auth ───────────────────────────────────────────────────────────

  /// Kirish. `X-Client` mobil bo'lgani uchun token javob tanasida keladi.
  Future<String> login({required String login, required String password}) async {
    final r = _map(await api.post('/api/auth/login', {'login': login, 'password': password}));
    final token = '${r['token'] ?? ''}';
    if (token.isEmpty) throw ApiError('no_token');
    api.token = token;
    return token;
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
    final r = _map(await api.post('/api/auth/register', {
      'email': email,
      'password': password,
      'phone': phone,
      'emailCode': emailCode,
      'tosAccepted': tosAccepted,
    }));
    final token = '${r['token'] ?? ''}';
    if (token.isNotEmpty) api.token = token;
    return token;
  }

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

  Future<List<Company>> searchCompanies(String q) async {
    final r = await api.get('/api/companies/search', query: {'q': q});
    return _rows(r, 'companies').map(Company.fromJson).toList();
  }

  /// Katalog — barcha ochiq profillar va sotuvdagi ID'lar.
  Future<List<Record>> catalog() async {
    final r = await api.get('/api/records');
    return _rows(r).map(Record.fromJson).toList();
  }

  Future<List<Map<String, dynamic>>> categories() async =>
      _rows(await api.get('/api/categories'), 'categories');

  // ── Buyurtma va to'lov ─────────────────────────────────────────────

  Future<List<Order>> orders() async =>
      _rows(await api.get('/api/orders'), 'orders').map(Order.fromJson).toList();

  Future<List<Map<String, dynamic>>> payments() async =>
      _rows(await api.get('/api/payments'), 'payments');

  /// To'lov usullari yoqilganmi (Payme/Click kalitlari sozlanganmi).
  Future<Map<String, dynamic>> paymentsEnabled() async =>
      _map(await api.get('/api/settings/payments-enabled'));

  /// Jismoniy karta narxlari va yetkazish muddati.
  Future<Map<String, dynamic>> physicalPricing() async =>
      _map(await api.get('/api/settings/physical-nfc-pricing'));

  Future<Map<String, dynamic>> orderPhysicalCard(String code, Map<String, dynamic> body) async =>
      _map(await api.post('/api/records/$code/order-physical-card', body));

  /// ID'ni sovg'a qilish. Qabul qiluvchi tasdiqlagach o'tadi.
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
