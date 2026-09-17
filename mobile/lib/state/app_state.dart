import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../data/api_client.dart';
import '../data/models.dart';
import '../design/tokens.dart';
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

  /// TARIF MATERIALI — karta yuzasi shunga qarab chiziladi.
  ///
  /// Shaxsiy ID'da u kodning o'zidan/narxidan kelib chiqadi, biznes
  /// profilda esa kompaniyaning tarifidan. Ikkalasi bitta karusel
  /// ichida chizilgani uchun bu yerda bir joyga yig'iladi.
  Tier get tier => isBusiness
      ? TierStyle.parse(company?.tier ?? '')
      : (record?.tier ?? Tier.free);

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
    // TOKEN ESKIRSA — ILOVA BUNI SEZADI.
    //
    // Bu ulanish bo'lmaganda 401 hech qayerda o'qilmasdi: eski
    // token har so'rovga qo'shilaverardi va odam "Sessiya tugagan"
    // xabarini ko'raverib, kirish ekraniga chiqa olmasdi.
    this.api.onUnauthorized = () {
      unawaited(sessionExpired());
    };
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
      token = await _storage.read(key: _tokenKey).timeout(_storageTimeout);
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
    } catch (_) {
      // HAR QANDAY BOSHQA XATO HAM TUTILADI.
      //
      // Ilgari bu yerda faqat `ApiError` tutilardi. Server kutilmagan
      // javob qaytarsa (JSON buzilgan, maydon turi boshqacha) istisno
      // shu yerdan CHIQIB ketardi, `boot()` esa `app.dart` da
      // kutilmasdan chaqiriladi — natijada `phase` abadiy `loading`
      // bo'lib qolardi va ILOVA SPLASH EKRANIDA OSILIB qolardi,
      // hech qanday xabarsiz va chiqish yo'lisiz.
      //
      // Tokenni O'CHIRMAYMIZ: muammo tarmoqda yoki javob shaklida
      // bo'lishi mumkin, odamni bekordan chiqarib yuborish xato
      // bo'lardi. Kirish ekrani ochiladi va u qaytadan urinadi.
      phase = AuthPhase.signedOut;
    }
    notifyListeners();
  }

  /// Tokenni qurilmada saqlash uchun eng ko'p kutish.
  ///
  /// `flutter_secure_storage` Android'da Keystore bilan ishlaydi va
  /// ba'zi qurilmalarda BIRINCHI murojaatda javob qaytarmay qolishi
  /// mumkin. Muddat qo'yilmasa, uni kutayotgan oqim abadiy osilib
  /// qoladi.
  static const _storageTimeout = Duration(seconds: 6);

  /// TOKENNI SAQLASH — VA U OSILIB QOLSA HAM DAVOM ETISH.
  ///
  /// ILGARI RO'YXATDAN O'TISH SHU YERDA OSILIB QOLARDI.
  ///
  /// `completeRegistration()` avval shu funksiyani `await` qilardi.
  /// Keystore javob qaytarmasa, `await` hech qachon tugamasdi:
  /// istisno ham chiqmasdi, ya'ni `try/catch` yordam bermasdi.
  /// Ekranda esa "Email tasdiqlandi" va abadiy aylanuvchi belgi
  /// qolardi — aynan qurilmada ko'rilgan holat.
  ///
  /// Muddat tugasa NIMA BO'LADI: token XOTIRADA (`api.token`)
  /// allaqachon turibdi, ya'ni joriy sessiya to'liq ishlaydi. Faqat
  /// ilova qayta ochilganda odam yana kirishi kerak bo'ladi. Bu —
  /// umuman kira olmaslikdan ko'ra ancha yaxshi.
  Future<void> _saveToken(String token) async {
    try {
      await _storage.write(key: _tokenKey, value: token).timeout(_storageTimeout);
    } catch (_) {
      // Muddat tugashi ham, Keystore xatosi ham bir xil: davom etamiz.
    }
  }

  Future<void> _clearToken() async {
    api.token = null;
    try {
      await _storage.delete(key: _tokenKey).timeout(_storageTimeout);
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

  /// SESSIYA TUGAGANIDA ILOVAGA XABAR — navigatsiyani tozalash va
  /// bitta xabar ko'rsatish uchun. Holatni tozalash esa shu yerda.
  void Function()? onSessionExpired;

  /// SESSIYA TUGAGANDA — server so'ralmaydi.
  ///
  /// `signOut()` dan farqi: u serverga `logout` yuboradi, bu yerda
  /// esa token allaqachon yaroqsiz — yuborish befoyda kutish
  /// bo'lardi. Holat esa aynan bir xil tozalanadi, ya'ni ilova
  /// kirish ekraniga qaytadi.
  Future<void> sessionExpired() async {
    if (phase == AuthPhase.signedOut) return;
    await _clearToken();
    user = null;
    cards = const [];
    companies = const [];
    active = null;
    phase = AuthPhase.signedOut;
    notifyListeners();
    onSessionExpired?.call();
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
    // IKKI SO'ROV BIRGA KETADI.
    //
    // Ilgari ular navbatma-navbat edi: avval `me()` tugashi
    // kutilardi, keyingina kompaniyalar so'ralardi. Ikkalasi
    // bir-biriga bog'liq EMAS — ikkalasi ham faqat tokenni talab
    // qiladi. Ketma-ket bo'lgani uchun ilova ochilishi ikki
    // aylanma sayohat (round-trip) kutardi; sekin tarmoqda bu
    // splash ekranida ortiqcha soniya degani.
    //
    // Kompaniyalar xatosi yutiladi: biznes profili yo'q odamda bu
    // so'rov bo'sh qaytishi normal va u butun kirishni to'xtatmasligi
    // kerak.
    final results = await Future.wait([
      repo.me(),
      repo.myCompanies().catchError((_) => <Company>[]),
    ]);
    final res = results[0] as ({AppUser? user, List<Record> cards});
    user = res.user;
    cards = res.cards;
    // Kirmagan odamda kompaniya ro'yxati ma'nosiz — tozalab
    // qo'yamiz (eski sessiyadan qolgan ro'yxat ko'rinib qolmasin).
    companies = user == null ? const [] : results[1] as List<Company>;
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
