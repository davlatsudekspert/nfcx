import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/errors/app_error.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/core/utils/result.dart';
import 'package:nfcstore_nova/features/profile/profile_repository.dart';

/// PROFILNI SAQLASH MA'LUMOT YO'QOTMASIN.
///
/// `PUT /api/records/:code` yozuvni QISMAN yangilamaydi — u butun
/// yozuvni qayta quradi va natijadagi har bir ustunni yozadi. Ya'ni
/// tanada bo'lmagan maydon BO'SHATILADI.
///
/// Ilgari ilova faqat o'zgargan maydonlarni yuborardi. Natijada odam
/// ismini tahrirlasa, uning musiqasi, hashteglari, havolalari va
/// telefoni jimgina o'chib ketardi.
class _Api extends ApiClient {
  _Api(this.record);

  /// Serverdagi yozuv — GET shuni qaytaradi.
  final Map<String, dynamic> record;

  /// PUT bilan ketgan tana.
  Map<String, dynamic>? sent;

  @override
  Future<Result<T>> get<T>(String path,
          {Map<String, dynamic>? query, bool auth = true}) async =>
      Ok(record as T);

  @override
  Future<Result<T>> put<T>(String path, [Object? body]) async {
    sent = Map<String, dynamic>.from(body! as Map);
    return const Ok(null) as Result<T>;
  }
}

void main() {
  Map<String, dynamic> serverRecord() => {
        'code': 'VIP001',
        'name': 'Muhammad',
        'role': 'Ekspert',
        'avatarUrl': '/uploads/av.jpg',
        'bgUrl': '/uploads/bg.jpg',
        'musicUrls': ['/uploads/file_aaa.mp3'],
        'hashtags': ['nfc', 'biznes'],
        'tg': 'muhammad',
        'phone': '+998901234567',
        'cardNumbers': [
          {'label': 'Karta', 'number': '8600 1234 5678 9012'},
        ],
      };

  group('Saqlash MA’LUMOT YO‘QOTMAYDI', () {
    test('tegilmagan maydonlar SERVERDAGICHA qaytadi', () async {
      final api = _Api(serverRecord());
      await ProfileRepository(api).updateProfile(code: 'VIP001', name: 'Yangi');

      final body = api.sent!;
      expect(body['name'], 'Yangi', reason: 'o‘zgarish qo‘llanmadi');

      // Ilgari bularning HAMMASI o'chib ketardi.
      expect(body['musicUrls'], ['/uploads/file_aaa.mp3'],
          reason: 'musiqa o‘chib ketdi');
      expect(body['hashtags'], ['nfc', 'biznes']);
      expect(body['tg'], 'muhammad');
      expect(body['phone'], '+998901234567');
      expect(body['cardNumbers'], isNotEmpty);
      expect(body['bgUrl'], '/uploads/bg.jpg');
    });

    test('yozuvni o‘qib bo‘lmasa — YOZILMAYDI', () async {
      final api = _ErrApi();
      final res =
          await ProfileRepository(api).updateProfile(code: 'VIP001', name: 'X');

      // Yarim ma'lumot bilan yozish butun yozuvni buzardi.
      expect(res, isA<Err<void>>());
      expect(api.sent, isNull, reason: 'o‘qish yiqilgan holda ham yozildi');
    });
  });

  group('MUSIQA', () {
    test('ro‘yxat NISBIY shaklda saqlanadi', () async {
      final api = _Api(serverRecord());
      await ProfileRepository(api).updateProfile(
        code: 'VIP001',
        musicUrls: [
          'https://nfcstore.uz/uploads/file_aaa.mp3',
          '/uploads/file_bbb.mp3',
        ],
      );

      // Bazada domensiz shakl turishi kerak — aks holda yozuv
      // domenga bog'lanib qoladi va domen o'zgarsa yo'qoladi.
      expect(api.sent!['musicUrls'],
          ['/uploads/file_aaa.mp3', '/uploads/file_bbb.mp3']);
    });

    test('bo‘sh ro‘yxat musiqani O‘CHIRADI', () async {
      final api = _Api(serverRecord());
      await ProfileRepository(api)
          .updateProfile(code: 'VIP001', musicUrls: const []);
      expect(api.sent!['musicUrls'], isEmpty);
    });

    test('bio serverga `about` bo‘lib ketadi (ilgari jimgina yo‘qolardi)',
        () async {
      final api = _Api({...serverRecord(), 'about': 'eski matn'});
      await ProfileRepository(api).updateProfile(code: 'VIP001', bio: 'yangi matn');
      expect(api.sent!['about'], 'yangi matn');
      expect(api.sent!.containsKey('bio'), isFalse);
    });

    test('musiqa berilmasa — tegilmaydi', () async {
      final api = _Api(serverRecord());
      await ProfileRepository(api).updateProfile(code: 'VIP001', bio: 'salom');
      expect(api.sent!['musicUrls'], ['/uploads/file_aaa.mp3']);
    });
  });
}

class _ErrApi extends ApiClient {
  Map<String, dynamic>? sent;

  @override
  Future<Result<T>> get<T>(String path,
          {Map<String, dynamic>? query, bool auth = true}) async =>
      const Err(AppError(AppErrorKind.offline));

  @override
  Future<Result<T>> put<T>(String path, [Object? body]) async {
    sent = Map<String, dynamic>.from(body! as Map);
    return const Ok(null) as Result<T>;
  }
}
