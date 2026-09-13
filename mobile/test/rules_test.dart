import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

/// HANDOFF QOIDALARI — MANBA KODI BO'YICHA TEKSHIRUV.
///
/// Bu testlar widget chizmaydi: ular `lib/` ni o'qib, taqiqlangan
/// narsalar KODDA umuman yo'qligini tekshiradi. Nima uchun shunday:
/// bu qoidalar bitta ekran haqida emas, BUTUN ILOVA haqida. Kimdir
/// keyinroq "shunchaki tez qilib" chat tugmasi yoki maketdan olingan
/// nom qo'shsa — shu yerda ushlanadi.
void main() {
  final files = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .toList();

  /// Izohlarni tashlab, faqat HAQIQIY KODNI qaytaradi.
  ///
  /// Izohlarda taqiqlangan so'zlar ATAYLAB uchraydi ("Auction yo'q",
  /// "messenjer yo'q") — ular tushuntirish, buzilish emas.
  String codeOf(File f) => f
      .readAsStringSync()
      .split('\n')
      .where((l) => !l.trimLeft().startsWith('//'))
      .join('\n');

  List<String> hits(RegExp re) => [
        for (final f in files)
          if (re.hasMatch(codeOf(f))) f.path,
      ];

  glyphTests();

  test('Auksion yo‘q', () {
    // Saytdan olib tashlangan, ilovaga qaytarilmaydi.
    expect(hits(RegExp(r'[Aa]uction|[Aa]uksion|[Bb]id\b')), isEmpty);
  });

  test('Ichki messenjer yo‘q', () {
    // Chat ekrani ham, suhbatlar ro‘yxati ham, profildagi "Xabar"
    // tugmasi ham bo‘lmaydi. Bog‘lanish faqat tashqi ilovalar orqali.
    expect(hits(RegExp(r'[Cc]hat[A-Z_]|[Cc]onversation|Messages[A-Z]?|Xabar yuborish')), isEmpty);
  });

  test('SMS tasdiqlash yo‘q', () {
    // NFCSTORE da SMS shlyuzi yo‘q — odam SMS kod ekranini hech
    // qachon ko‘rmaydi.
    expect(hits(RegExp(r'SMS|sms[A-Z_]|smsCode')), isEmpty);
  });

  test('Tasdiqlangan nishon kodda qattiq yozilmagan', () {
    // Nishon FAQAT backend holatidan chiqadi. `verified: true` yozilgan
    // joy bo‘lsa — bu yolg‘on nishon degani.
    expect(hits(RegExp(r'verified:\s*true')), isEmpty);
  });

  test('Dizayn maketidagi soxta ma‘lumot kodda yo‘q', () {
    // Handoff dagi "Muhammad", "VIP001", "Ali Market" va h.k. faqat
    // MAKET. Ular production kodida bo‘lmasligi kerak.
    //
    // ISTISNO: `onboarding.dart` — tanishtiruv panellari. U yerda
    // ma'lumot emas, ILOVANING O'ZI ko'rsatiladi (hali hisob yo'q,
    // ya'ni ko'rsatadigan haqiqiy ma'lumot ham yo'q) va bu handoff
    // dizaynining aynan o'zi.
    final fake = RegExp(r'VIP001|AAA111|DDD333|BBB222|Aziz Karimov|Ali Market|Dr\. Shahnoza');
    final found = hits(fake).where((p) => !p.endsWith('onboarding.dart')).toList();
    expect(found, isEmpty, reason: 'Maket ma‘lumoti qolib ketgan: $found');
  });

  test('Narx jadvali mijozda qattiq yozilmagan', () {
    // Narx SERVERDAN keladi. Kodga yozib qo‘yilsa, saytda narx
    // o‘zgarganda ilova eski summani ko‘rsatib turardi.
    //
    // Tarif ostonalari (`Record.tier`) — bu narx EMAS, tasniflash
    // chegarasi; u `models.dart` da izoh bilan belgilangan.
    final prices = RegExp(r'\b(49000|99000|149000|199000|490000|1200000|200000)\b');
    final found = hits(prices).where((p) => !p.endsWith('models.dart')).toList();
    expect(found, isEmpty, reason: 'Narx kodga yozilgan: $found');
  });

  test('Baza manzili bitta joyda', () {
    // Ilova va sayt BITTA manbadan o‘qiydi. Manzil bir nechta joyda
    // yozilsa, biri unutilib, ilova ikkiga bo‘linib ketardi.
    final found = hits(RegExp(r'https://nfcstore\.uz'))
        .where((p) => !p.endsWith('api_client.dart') && !p.endsWith('app_state.dart'))
        .toList();
    expect(found, isEmpty, reason: 'Manzil yana yozilgan: $found');
  });
}

/// SHRIFTDA YO'Q BELGILAR — EKRANDA BO'SH TO'RTBURCHAK.
///
/// Manrope va IBM Plex Mono da `⌄ ⌫ ✓ ✕ ← → −` kabi belgilar YO'Q va
/// telefonda ular "▯" bo'lib chiqadi. Vizual audit buni Home
/// ekranidagi ID chipida topgan edi. Barcha shunday belgilar chizilgan
/// ikonkaga (`NIcon`) o'tkazildi; bu test ular qaytib kelmasligini
/// qo'riqlaydi.
void glyphTests() {
  final files = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .toList();

  test('shriftda yo‘q belgilar UI da ishlatilmagan', () {
    // Matn ichidagi belgi emas, `Text('⌄')` kabi YOLG'IZ belgi
    // qidiriladi — o'zbekcha matndagi tire yoki qo'shtirnoq emas.
    final bad = RegExp(r'''Text\(\s*'[⌄⌃⌫✓✕✖←→↑↓−·•]'\s*[,)]''');
    final hits = [
      for (final f in files)
        if (bad.hasMatch(f.readAsStringSync())) f.path,
    ];
    expect(hits, isEmpty, reason: 'Shriftda yo‘q belgi ishlatilgan: $hits');
  });
}
