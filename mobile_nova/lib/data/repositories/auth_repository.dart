import '../../core/errors/app_error.dart';
import '../../core/network/api_client.dart';
import '../../core/utils/result.dart';
import '../models/models.dart';

/// Kirish/ro'yxatdan o'tish oqimi.
///
/// ## Backend bilan farq — YASHIRILMAYDI
///
/// Texnik topshiriq EMAIL orqali 6 xonali kod bilan tasdiqlashni talab
/// qiladi. Mavjud `nfcstore.uz` backend'ida esa:
///
/// * `/api/auth/login` — email + PAROL, kodsiz;
/// * `/api/auth/request-register-code` — kodni TELEGRAM BOTI orqali
///   TELEFONGA yuboradi, emailga emas.
///
/// Shuning uchun bu repository ikkala yo'lni ham beradi:
///
/// 1. `loginWithPassword` / `register` — BUGUN ISHLAYDI, real endpointlar.
/// 2. `requestEmailCode` / `verifyEmailCode` — kelishilgan shartnoma
///    bo'yicha chaqiriladi. Backend'da bu yo'llar hali yo'q, shuning
///    uchun javob `AppErrorKind.endpointMissing` bo'ladi va UI
///    "BACKEND ENDPOINT REQUIRED" holatini ko'rsatadi.
///
/// SOXTA MUVAFFAQIYAT QAYTARILMAYDI: kod tekshirilmagan holda
/// foydalanuvchi Home'ga o'tkazilmaydi.
class AuthRepository {
  AuthRepository(this._api);

  final ApiClient _api;

  /// Email + parol — bugungi ishlaydigan yo'l.
  Future<Result<User>> loginWithPassword({
    required String email,
    required String password,
  }) async {
    final res = await _api.postSession('/api/auth/login', {
      'email': email.trim(),
      'password': password,
    });
    return switch (res) {
      Err(:final error) => Err(error),
      Ok(:final value) => await _finishSession(value.body, value.session),
    };
  }

  /// Ro'yxatdan o'tish.
  ///
  /// Backend telefon raqami Telegram boti orqali tasdiqlangan bo'lishini
  /// va o'sha bot yuborgan kodni talab qiladi (`phone_not_verified`,
  /// `bad_code`). Bu shart ilovada YUMSHATILMAYDI — u backend'ning
  /// xavfsizlik qoidasi.
  Future<Result<User>> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String code,
    String? promoCode,
  }) async {
    final res = await _api.postSession('/api/auth/register', {
      'name': name.trim(),
      'email': email.trim(),
      'phone': phone,
      'password': password,
      'code': code,
      'botAck': true,
      'tosAccepted': true,
      if (promoCode != null && promoCode.isNotEmpty) 'promoCode': promoCode,
    });
    return switch (res) {
      Err(:final error) => Err(error),
      Ok(:final value) => await _finishSession(value.body, value.session),
    };
  }

  /// Ro'yxatdan o'tish kodini so'rash (backend: Telegram bot orqali).
  Future<Result<void>> requestRegisterCode(String phone) =>
      _api.post<void>('/api/auth/request-register-code', {'phone': phone});

  /// EMAILGA 6 xonali kod so'rash.
  ///
  /// BACKEND ENDPOINT REQUIRED — `API_GAPS.md` ga qarang.
  Future<Result<void>> requestEmailCode({
    required String email,
    String? phone,
  }) =>
      _api.post<void>('/api/auth/request-email-code', {
        'email': email.trim(),
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      });

  /// Emailga yuborilgan kodni tekshirish.
  ///
  /// BACKEND ENDPOINT REQUIRED — `API_GAPS.md` ga qarang.
  Future<Result<User>> verifyEmailCode({
    required String email,
    required String code,
  }) async {
    final res = await _api.postSession('/api/auth/verify-email-code', {
      'email': email.trim(),
      'code': code,
    });
    return switch (res) {
      Err(:final error) => Err(error),
      Ok(:final value) => await _finishSession(value.body, value.session),
    };
  }

  /// Saqlangan token bilan sessiyani tiklaydi.
  ///
  /// `/api/auth/me` kirmagan foydalanuvchi uchun ham 200 qaytaradi
  /// (`{user: null}`), shuning uchun `user` ning bor-yo'qligi tekshiriladi.
  Future<Result<({User user, List<NfcId> ids})>> restore() async {
    await _api.loadToken();
    if (_api.token == null) {
      return const Err(AppError(AppErrorKind.unauthorized));
    }
    return me();
  }

  Future<Result<({User user, List<NfcId> ids})>> me() async {
    final res = await _api.get<Map<String, dynamic>>('/api/auth/me');
    return switch (res) {
      Err(:final error) => Err(error),
      Ok(:final value) => value['user'] == null
          ? const Err(AppError(AppErrorKind.unauthorized))
          : Ok((
              user: User.fromJson((value['user'] as Map).cast<String, dynamic>()),
              ids: parseList(value['cards'], NfcId.fromJson),
            )),
    };
  }

  /// Chiqish — server sessiyasi ham, qurilmadagi token ham o'chiriladi.
  ///
  /// Server javobi muhim emas: tarmoq yo'q bo'lsa ham lokal token
  /// tozalanishi SHART, aks holda telefonni bergan odam ichkarida qolardi.
  Future<void> logout() async {
    await _api.post<void>('/api/auth/logout');
    await _api.setToken(null);
  }

  Future<Result<User>> _finishSession(
    Map<String, dynamic> body,
    String? session,
  ) async {
    final token = session ?? (body['token'] as String?);
    if (token != null && token.isNotEmpty) await _api.setToken(token);

    final raw = body['user'];
    if (raw is Map) {
      // `/api/auth/login` faqat `{id, email}` qaytaradi. To'liq profil
      // uchun darhol `me()` chaqiriladi: aks holda Home'da ism va avatar
      // bo'sh ko'rinardi.
      final full = await me();
      return full.when(
        ok: (v) => Ok(v.user),
        err: (_) => Ok(User.fromJson(raw.cast<String, dynamic>())),
      );
    }
    return const Err(AppError(AppErrorKind.unknown, detail: 'no user in response'));
  }
}
