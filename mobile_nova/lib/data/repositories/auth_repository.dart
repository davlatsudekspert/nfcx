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

  /// Ro'yxatdan o'tish kodini so'rash.
  ///
  /// Server EMAIL yoki TELEFON qabul qiladi va qaysi kanal
  /// ishlatilganini qaytaradi (`hosting/api/auth.js`):
  ///
  ///     POST /api/auth/request-register-code {email}|{phone}
  ///       → {ok:true, channel:'email'|'telegram'|'none'}
  ///
  /// Ilgari bu metod FAQAT telefonni yuborardi va ekran uni umuman
  /// chaqirmasdi — o'rniga mavjud bo'lmagan
  /// `/api/auth/request-email-code` ga borardi.
  /// Kod QAYSI KANAL orqali ketganini ham qaytaradi.
  ///
  /// Ilgari javob tanasi TASHLAB YUBORILARDI (`post<void>`), ekran
  /// esa har doim "kod emailingizga yuborildi" deb yozardi. Server
  /// emaili o'chirilgan bo'lsa (`RESEND_API_KEY` qo'yilmagan) javob
  /// `channel: 'none'` bo'ladi — ya'ni kod HECH QAYERGA
  /// yuborilmagan. Odam esa hech qachon kelmaydigan kodni kutib
  /// o'tirardi.
  Future<Result<String>> requestRegisterCode({
    String email = '',
    String phone = '',
  }) async {
    final res = await _api.post<Map<String, dynamic>>(
        '/api/auth/request-register-code', {
      if (email.trim().isNotEmpty) 'email': email.trim(),
      if (phone.isNotEmpty) 'phone': phone,
    });
    // Eski server `channel` bermasligi mumkin — o'shanda noma'lum
    // deb qaraymiz va yolg'on va'da bermaymiz.
    return res.map((j) => '${j['channel'] ?? ''}'.trim().toLowerCase());
  }

  // `requestEmailCode` / `verifyEmailCode` OLIB TASHLANDI.
  //
  // Ular `/api/auth/request-email-code` va
  // `/api/auth/verify-email-code` ga borardi — serverda bunday
  // yo'llar YO'Q va hech qachon bo'lmagan. Ro'yxatdan o'tish
  // ularni ishlatgani uchun yangi foydalanuvchi umuman kira
  // olmasdi; kirish ekranidagi "kod bilan kirish" esa har safar
  // 404 berardi.
  //
  // Haqiqiy shartnoma — `requestRegisterCode` + `register` (yuqorida).
  // Backend kod bilan KIRISHNI qo'shsa, bu ikkisi qaytariladi.

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
    switch (res) {
      case Err(:final error):
        return Err(error);
      case Ok(:final value):
        if (value['user'] == null) {
          // SESSIYA TUGADI — lekin 401 EMAS.
          //
          // Server eskirgan token uchun ham 200 qaytaradi, tanasida
          // esa bo'sh foydalanuvchi:
          //
          //     const user = await getCurrentUser(request, env);
          //     if (!user) return json({ user: null, cards: [] });
          //
          // Shuning uchun tarmoq qatlamidagi 401 ushlagichi bu
          // holatni KO'RMAYDI. E2E buni "sessionExpired signali
          // ishlamadi" deb ko'rsatgan edi va men avval sababni
          // faqat 401 da deb o'ylagandim — aslida bu yo'l umuman
          // 401 qaytarmaydi.
          //
          // Endi signal shu yerdan beriladi: oqim 401 bilan bir xil
          // bo'ladi — token tozalanadi, router chiqaradi.
          _api.notifySessionExpired();
          return const Err(AppError(AppErrorKind.unauthorized));
        }
        return Ok((
          user: User.fromJson((value['user'] as Map).cast<String, dynamic>()),
          ids: parseList(value['cards'], NfcId.fromJson),
        ));
    }
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
