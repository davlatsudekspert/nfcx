/// BUZG'UNCHI AMALLAR — QAT'IY TAQIQ.
///
/// Sinov HAQIQIY hisobda ishlaydi. Shuning uchun quyidagi metodlar
/// E2E ichida umuman chaqirilmaydi. Ro'yxat ikki joyda qo'riqlanadi:
///
/// 1. shu yerda — hujjat va sabab bilan;
/// 2. `test/e2e_safety_test.dart` da — oddiy `flutter test` paytida
///    `integration_test/` fayllari matni bo'yicha statik tekshiruv.
///    Ya'ni kimdir kelajakda `deleteId` yozib qo'ysa, E2E ishga
///    tushmasdan OLDIN, oddiy testda yiqiladi.
///
/// Ro'yxat foydalanuvchi bergan "DO NOT PERFORM" bandidan olingan.
library;

/// Chaqirilishi MUMKIN BO'LMAGAN repozitoriy metodlari.
const forbiddenCalls = <String, String>{
  // ── NFC — qaytarib bo'lmaydi ────────────────────────────────
  'deleteId': 'haqiqiy NFC ID ni o\'chiradi',
  'setPrimary': 'asosiy NFC ID ni almashtiradi',
  'unlinkDevice': 'haqiqiy jismoniy kartani uzadi',
  'resolveChip': 'haqiqiy chip tokenini sarflaydi',

  // ── Sovg'a — ID boshqa odamga o'tadi ────────────────────────
  'gift': 'haqiqiy NFC ID ni sovg\'a qiladi',
  'acceptGift': 'haqiqiy sovg\'ani qabul qiladi',
  'rejectGift': 'haqiqiy sovg\'ani rad etadi',
  'cancelGift': 'haqiqiy sovg\'ani bekor qiladi',

  // ── Pul ─────────────────────────────────────────────────────
  'startPayment': 'HAQIQIY TO\'LOV boshlaydi',
  'orderPhysicalCard': 'haqiqiy buyurtma yaratadi',

  // ── Hisob ───────────────────────────────────────────────────
  'changePassword': 'haqiqiy parolni almashtiradi',
  'requestPasswordCode': 'haqiqiy SMS/kod yuboradi',
  'requestPremium': 'adminga haqiqiy so\'rov yuboradi',
  'support': 'qo\'llab-quvvatlashga haqiqiy xabar yuboradi',

  // ── Biznes ──────────────────────────────────────────────────
  'submit': 'biznesni haqiqiy moderatsiyaga yuboradi',
};

/// Sinov yaratadigan har bir obyekt shu belgi bilan nomlanadi.
///
/// Agar tozalash biror sababga ko'ra bajarilmay qolsa, hisobdagi
/// axlatni shu satr bo'yicha topib o'chirish mumkin.
const kTestMarker = 'NOVA E2E TEST — DELETE';

/// Nomga vaqt qo'shadi: bir necha marta ishga tushganda qaysi biri
/// qachon qolib ketgani ko'rinadi.
String testLabel(String what) =>
    '$kTestMarker · $what · ${DateTime.now().toUtc().toIso8601String()}';

/// KIRISH URINISHLARI BUDJETI.
///
/// Backend (`hosting/worker.js`) kirishni hisob bo'yicha 15 daqiqada
/// 5 marta cheklaydi va hisoblagich MUVAFFAQIYATLI kirishda ham
/// oshadi — `rateLimitD1` parol tekshirilishidan OLDIN chaqiriladi.
///
/// Demak sinov behuda kirsa, haqiqiy egasi 15 daqiqa hisobiga kira
/// olmay qoladi. Shuning uchun urinishlar sanaladi va 4 tadan oshsa
/// sinov o'zini to'xtatadi (bittasi egasiga zaxira bo'lib qoladi).
class LoginBudget {
  LoginBudget(this.max);
  final int max;
  int _used = 0;

  int get used => _used;
  bool get exhausted => _used >= max;

  /// Chaqiruvdan OLDIN ishlatiladi.
  void spend(String why) {
    if (exhausted) {
      throw StateError(
        'Kirish budjeti tugadi ($_used/$max). Sabab: $why. '
        'Backend 15 daqiqada 5 urinishga ruxsat beradi va bu chegaraga '
        'yetish haqiqiy foydalanuvchini ham bloklaydi.',
      );
    }
    _used++;
  }
}
