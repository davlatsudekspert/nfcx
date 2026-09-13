import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../data/repo.dart';

/// FAOL SHAXS — ilovaning ildiz holati.
///
/// Bitta hisobda bir nechta shaxs bo'ladi: shaxsiy NFC ID'lar va biznes
/// profillar. Handoff buni aniq aytadi: "switching identity is the app's
/// root state change" — Home, NFC va Profile shu tanlovga qarab
/// qayta chiziladi. Shuning uchun bu yerda TIP ham, KOD ham saqlanadi.
class Identity {
  const Identity.personal(this.record)
      : company = null,
        isBusiness = false;
  const Identity.business(this.company)
      : record = null,
        isBusiness = true;

  final Record? record;
  final Company? company;
  final bool isBusiness;

  String get code => isBusiness ? (company?.id ?? '') : (record?.code ?? '');
  String get name => isBusiness ? (company?.name ?? '') : (record?.name ?? '');
  String? get avatarUrl => isBusiness ? company?.logoUrl : record?.avatarUrl;
  bool get verified => isBusiness ? (company?.verified ?? false) : (record?.verified ?? false);

  /// Ommaviy havola — ulashish va QR uchun.
  String get publicUrl => isBusiness
      ? 'https://nfcstore.uz/c/${code.toLowerCase()}'
      : 'https://nfcstore.uz/${code.toLowerCase()}';
}

enum AuthPhase { loading, signedOut, signedIn }

/// Ilova holati.
///
/// `ChangeNotifier` ATAYLAB: bu holat kamdan-kam o'zgaradi (kirish,
/// chiqish, shaxs almashtirish, ro'yxatni yangilash). Har ekran o'z
/// ma'lumotini o'zi yuklaydi va bu yerga qo'shmaydi — aks holda bitta
/// katta "global do'kon" paydo bo'lib, har kichik o'zgarishda butun
/// ilova qayta chizilardi.
class AppState extends ChangeNotifier {
  AppState({Api? api, FlutterSecureStorage? storage})
      : api = api ?? Api(),
        _storage = storage ?? const FlutterSecureStorage() {
    repo = Repo(this.api);
  }

  final Api api;
  final FlutterSecureStorage _storage;
  late final Repo repo;

  static const _tokenKey = 'nfc_session_token';

  AuthPhase phase = AuthPhase.loading;
  AppUser? user;
  List<Record> cards = const [];
  List<Company> companies = const [];
  Identity? active;

  /// Ilova ochilganda: saqlangan tokenni tiklaymiz va sessiyani
  /// tekshiramiz. Token eskirgan bo'lsa jimgina chiqib ketiladi.
  Future<void> boot() async {
    String? token;
    try {
      token = await _storage.read(key: _tokenKey);
    } catch (_) {
      // Ba'zi qurilmalarda Keystore vaqtincha ochilmaydi — bu kirishni
      // butunlay to'xtatmasligi kerak.
      token = null;
    }
    if (token == null || token.isEmpty) {
      phase = AuthPhase.signedOut;
      notifyListeners();
      return;
    }
    api.token = token;
    try {
      await refreshIdentities();
      phase = user == null ? AuthPhase.signedOut : AuthPhase.signedIn;
    } on ApiError catch (e) {
      // Offline bo'lsa sessiyani SAQLAB QOLAMIZ: internet yo'qligi
      // chiqib ketish uchun sabab emas.
      phase = e.isOffline || e.key == 'timeout' ? AuthPhase.signedIn : AuthPhase.signedOut;
      if (phase == AuthPhase.signedOut) await _clearToken();
    }
    notifyListeners();
  }

  Future<void> _saveToken(String token) async {
    try {
      await _storage.write(key: _tokenKey, value: token);
    } catch (_) {}
  }

  Future<void> _clearToken() async {
    api.token = null;
    try {
      await _storage.delete(key: _tokenKey);
    } catch (_) {}
  }

  Future<void> signIn(String login, String password) async {
    final token = await repo.login(login: login, password: password);
    await _saveToken(token);
    await refreshIdentities();
    phase = AuthPhase.signedIn;
    notifyListeners();
  }

  Future<void> completeRegistration(String token) async {
    await _saveToken(token);
    await refreshIdentities();
    phase = AuthPhase.signedIn;
    notifyListeners();
  }

  Future<void> signOut() async {
    await repo.logout().catchError((_) {});
    await _clearToken();
    user = null;
    cards = const [];
    companies = const [];
    active = null;
    phase = AuthPhase.signedOut;
    notifyListeners();
  }

  /// Egalik qilinadigan shaxslarni qayta o'qish.
  ///
  /// Kompaniyalar ALOHIDA so'rov va uning xatosi shaxsiy profillarni
  /// yiqitmaydi: kompaniyasi yo'q odam uchun bu so'rov bo'sh qaytadi
  /// yoki xato berishi mumkin, lekin uning shaxsiy ID'lari baribir
  /// ko'rinishi kerak.
  Future<void> refreshIdentities() async {
    final res = await repo.me();
    user = res.user;
    cards = res.cards;
    if (user != null) {
      try {
        companies = await repo.myCompanies();
      } catch (_) {
        companies = const [];
      }
    }
    _ensureActive();
    notifyListeners();
  }

  /// Faol shaxs hali tanlanmagan yoki yo'qolgan bo'lsa — asosiysini
  /// (`isPrimary`) yoki birinchisini tanlaymiz.
  void _ensureActive() {
    final code = active?.code;
    if (code != null) {
      final r = cards.where((c) => c.code == code);
      if (r.isNotEmpty) {
        active = Identity.personal(r.first);
        return;
      }
      final c = companies.where((c) => c.id == code);
      if (c.isNotEmpty) {
        active = Identity.business(c.first);
        return;
      }
    }
    if (cards.isNotEmpty) {
      final primary = cards.firstWhere((c) => c.isPrimary, orElse: () => cards.first);
      active = Identity.personal(primary);
    } else if (companies.isNotEmpty) {
      active = Identity.business(companies.first);
    } else {
      active = null;
    }
  }

  void switchIdentity(Identity id) {
    active = id;
    notifyListeners();
  }

  /// Egalik tekshiruvi — ommaviy va o'z profil ko'rinishini ajratish uchun.
  ///
  /// Bu FAQAT ko'rinish uchun. Haqiqiy ruxsat SERVERDA tekshiriladi:
  /// mijoz tomonidagi bayroqqa ishonib amal bajarilmaydi.
  bool ownsRecord(String code) => cards.any((c) => c.code == code.toUpperCase());

  bool ownsCompany(String id) => companies.any((c) => c.id == id.toUpperCase());
}

/// Holatga kirish — `AppScope.of(context)`.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
      : super(notifier: state);

  static AppState of(BuildContext context) {
    final s = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(s?.notifier != null, 'AppScope topilmadi — ildizda o‘ralganini tekshiring.');
    return s!.notifier!;
  }

  /// Qayta chizishga OBUNA BO'LMASDAN o'qish — `initState` va tugma
  /// bosilganda ishlatiladi.
  static AppState read(BuildContext context) {
    final s = context.getInheritedWidgetOfExactType<AppScope>();
    assert(s?.notifier != null, 'AppScope topilmadi.');
    return s!.notifier!;
  }
}
