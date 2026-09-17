// XATO MATRITSASI — HAR BIR HTTP HOLATI ODAM TILIDA.
//
// NIMA UCHUN BU FAYL BOR: auditda aniqlandiki 400, 409 va 422
// hech qayerda qoplanmagan ekan. Ular "oxirgi holat" ga tushib,
// ekranga XOM SERVER KALITINI chiqarardi ("Kutilmagan xato:
// bad_request"). Foydalanuvchi u bilan hech narsa qila olmaydi,
// tarjimasi ham yo'q, va ba'zan u ichki tafsilotni oshkor qiladi.
//
// SHUNING UCHUN QOIDA QULFLANADI: har bir status uchun
//   1. jumla odam tilida bo'ladi,
//   2. ekranda xom kalit KO'RINMAYDI,
//   3. texnik qator esa ALOHIDA `errorDetail()` da qoladi —
//      xatoni surat qilib yuborgan odam bilan tuzatuvchi
//      o'rtasidagi ko'prik yo'qolmasin.
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/api_client.dart';
import 'package:nfcstore/design/components/states.dart';

/// Server javobidan yasalgan xato — ilovadagi bilan aynan bir xil
/// yo'l bilan.
ApiError err(int status, String key) =>
    ApiError(key, status: status, detail: 'HTTP $status · $key');

void main() {
  // Har bir status va o'sha statusda serverdan kelishi mumkin
  // bo'lgan TANILMAGAN kalit. Tanilmagani ataylab: tanilgan kalit
  // (masalan `bad_credentials`) baribir o'z jumlasini topadi,
  // qoplanmagan holat esa AYNAN tanilmagan kalitda ko'rinadi.
  const cases = <int, String>{
    400: 'bad_request',
    401: 'session_expired',
    403: 'forbidden_zone',
    404: 'no_such_route',
    409: 'already_exists',
    422: 'weird_validation',
    429: 'slow_down',
    500: 'kaboom',
    503: 'upstream_down',
  };

  group('xato matritsasi', () {
    for (final e in cases.entries) {
      test('${e.key} — odam tilida, xom kalitsiz', () {
        final msg = humanError(err(e.key, e.value));

        // 1. BO'SH EMAS.
        expect(msg.trim(), isNotEmpty, reason: '${e.key} uchun jumla yo‘q');

        // 2. XOM KALIT EKRANDA YO'Q.
        expect(msg, isNot(contains(e.value)),
            reason: '${e.key}: server kaliti "${e.value}" ekranga chiqdi');
        expect(msg, isNot(contains('HTTP')),
            reason: '${e.key}: texnik qator asosiy jumlaga aralashdi');
        expect(msg, isNot(contains('_')),
            reason: '${e.key}: pastki chiziqli kalit ekranga chiqdi');

        // 3. GAPGA O'XSHASIN — kamida uch so'z.
        expect(msg.trim().split(RegExp(r'\s+')).length, greaterThanOrEqualTo(3),
            reason: '${e.key}: jumla emas, yorliq');
      });
    }

    test('texnik qator ALOHIDA saqlanadi', () {
      // Sabab yo'qolmasligi kerak: u kichik kulrang qatorda
      // qoladi va xatoni surat qilib yuborishga yetadi.
      final detail = errorDetail(err(409, 'already_exists'));
      expect(detail, isNotNull);
      expect(detail, contains('already_exists'));
      expect(detail, contains('409'));
    });

    test('har bir status uchun jumla BOSHQA-BOSHQA', () {
      // Hammasiga bitta "xatolik yuz berdi" yozish — qoplaganday
      // ko'rinadi, lekin odamga hech narsa bermaydi.
      final msgs = <String>{};
      for (final e in cases.entries) {
        msgs.add(humanError(err(e.key, e.value)));
      }
      // 500 va 503 bitta jumlani baham ko'radi (ikkalasi ham
      // "serverda xatolik") — qolganlari alohida.
      expect(msgs.length, greaterThanOrEqualTo(cases.length - 1));
    });

    test('tanilgan kalit STATUSDAN USTUN', () {
      // Server aniq sabab aytgan bo'lsa, umumiy status jumlasi
      // uni bosib ketmasligi kerak.
      expect(humanError(err(422, 'email_taken')),
          contains('allaqachon ro‘yxatdan o‘tgan'));
      expect(humanError(err(403, 'premium_required')), contains('Premium'));
    });

    test('tarmoq xatolari ham odam tilida', () {
      expect(humanError(Exception('SocketException: failed')),
          contains('Internet'));
      expect(humanError(err(408, 'timeout')), isNotEmpty);
    });
  });
}
