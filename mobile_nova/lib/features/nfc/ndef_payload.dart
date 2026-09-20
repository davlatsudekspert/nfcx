import 'dart:convert';
import 'dart:typed_data';

/// NDEF YUKLAMALARINI QURISH VA O'QISH — APPARATSIZ.
///
/// Bu fayl ataylab `nfc_manager` ga BOG'LANMAGAN: ichida bitta ham
/// platforma chaqiruvi yo'q, faqat baytlar bilan ishlaydi. Shuning
/// uchun uni oddiy `flutter test` da, telefonsiz, to'liq sinab
/// bo'ladi — NFC mantig'idagi xatolar qurilma qidirib yurmasdan
/// tutiladi.
///
/// Yozish/o'qishning O'ZI (`Ndef.write`, sessiya, teg topish)
/// xizmat qatlamida qoladi va u DEVICE REQUIRED.

/// NDEF URI prefiks jadvali (NFC Forum RTD-URI).
///
/// Birinchi bayt — shu jadvaldagi indeks, qolgani matn. Eng uzun
/// mos prefiks tanlanadi: `https://www.` uchun 0x02 ishlatilsa
/// yuklama `https://` (0x04) ga qaraganda 4 bayt qisqaradi, bu
/// esa kichik teglarda muhim.
const List<String> kUriPrefixes = [
  '', // 0x00 — prefikssiz
  'http://www.', // 0x01
  'https://www.', // 0x02
  'http://', // 0x03
  'https://', // 0x04
  'tel:', // 0x05
  'mailto:', // 0x06
];

/// NDEF yozuv turi — qaysi RTD ekanini bildiradi.
enum NdefKind { uri, text, vcard, unknown }

/// O'qilgan yoki yoziladigan bitta yozuv.
class NdefRecordData {
  const NdefRecordData({
    required this.kind,
    required this.value,
    this.language = 'en',
    this.mimeType = '',
  });

  final NdefKind kind;
  final String value;
  final String language;
  final String mimeType;
}

/// URI yozuvi uchun yuklama baytlari.
///
/// Qaytadigan narsa — AYNAN `payload`, ya'ni `type` (0x55 'U')
/// alohida beriladi.
Uint8List encodeUriPayload(String uri) {
  var best = 0;
  var bestLen = 0;
  for (var i = 1; i < kUriPrefixes.length; i++) {
    final p = kUriPrefixes[i];
    if (uri.startsWith(p) && p.length > bestLen) {
      best = i;
      bestLen = p.length;
    }
  }
  final rest = utf8.encode(uri.substring(bestLen));
  return Uint8List.fromList([best, ...rest]);
}

/// URI yuklamasidan to'liq manzilni tiklaydi.
String decodeUriPayload(List<int> payload) {
  if (payload.isEmpty) return '';
  final code = payload.first;
  final prefix = code < kUriPrefixes.length ? kUriPrefixes[code] : '';
  return prefix + utf8.decode(payload.sublist(1), allowMalformed: true);
}

/// Matn yozuvi uchun yuklama.
///
/// Tuzilishi: [holat bayti][til kodi][UTF-8 matn].
/// Holat baytining quyi 6 biti — til kodining uzunligi; yuqori bit
/// (0x80) UTF-16 ni bildiradi va bu yerda HECH QACHON qo'yilmaydi.
Uint8List encodeTextPayload(String text, {String language = 'en'}) {
  final lang = utf8.encode(language);
  if (lang.length > 63) {
    throw ArgumentError('til kodi 63 baytdan uzun: $language');
  }
  return Uint8List.fromList([lang.length, ...lang, ...utf8.encode(text)]);
}

/// Matn yuklamasidan matnni ajratadi.
String decodeTextPayload(List<int> payload) {
  if (payload.isEmpty) return '';
  final langLen = payload.first & 0x3F;
  if (payload.length < 1 + langLen) return '';
  return utf8.decode(payload.sublist(1 + langLen), allowMalformed: true);
}

/// Matn yozuvidagi til kodi.
String decodeTextLanguage(List<int> payload) {
  if (payload.isEmpty) return '';
  final langLen = payload.first & 0x3F;
  if (payload.length < 1 + langLen) return '';
  return utf8.decode(payload.sublist(1, 1 + langLen), allowMalformed: true);
}

/// Oddiy vCard 3.0 matni.
///
/// KONTAKTLAR RUXSATI KERAK EMAS: ma'lumot foydalanuvchi kiritgan
/// yoki uning o'z NFCSTORE profilidan olinadi. Telefon kitobiga
/// kirish bu funksiya uchun umuman zarur emas.
String buildVCard({
  required String name,
  String phone = '',
  String email = '',
  String url = '',
  String org = '',
  String title = '',
}) {
  // CRLF — vCard standarti aynan shuni talab qiladi; `\n` bilan
  // ba'zi o'quvchilar yozuvni butunlay rad etadi.
  final b = StringBuffer()
    ..write('BEGIN:VCARD\r\n')
    ..write('VERSION:3.0\r\n')
    ..write('FN:${_vcardEscape(name)}\r\n');
  if (org.isNotEmpty) b.write('ORG:${_vcardEscape(org)}\r\n');
  if (title.isNotEmpty) b.write('TITLE:${_vcardEscape(title)}\r\n');
  if (phone.isNotEmpty) b.write('TEL;TYPE=CELL:${_vcardEscape(phone)}\r\n');
  if (email.isNotEmpty) b.write('EMAIL:${_vcardEscape(email)}\r\n');
  if (url.isNotEmpty) b.write('URL:${_vcardEscape(url)}\r\n');
  b.write('END:VCARD\r\n');
  return b.toString();
}

/// vCard maydonidagi maxsus belgilar.
String _vcardEscape(String s) => s
    .replaceAll('\\', r'\\')
    .replaceAll(';', r'\;')
    .replaceAll(',', r'\,')
    .replaceAll('\r\n', r'\n')
    .replaceAll('\n', r'\n');

/// TEGGA YOZISH MUMKINMI — sabab bilan.
enum WriteBlock {
  ok,

  /// Teg NDEF ni umuman qo'llamaydi.
  notNdef,

  /// Teg faqat o'qish uchun qulflangan.
  readOnly,

  /// Yuklama teg sig'imidan katta.
  tooLarge,
}

/// Yozishdan OLDINGI tekshiruv.
///
/// "Yozildi" deb yolg'on ko'rsatmaslik uchun shart oldindan
/// baholanadi: sig'imi yetmasa yoki teg qulflangan bo'lsa,
/// foydalanuvchiga SABABI aytiladi.
///
/// `maxSize` 0 yoki manfiy bo'lsa — platforma sig'imni bermagan.
/// Bunda tekshiruv o'tkazib yuboriladi: taxmin qilib "sig'maydi"
/// deyishdan ko'ra yozib ko'rgan va natijani QAYTA O'QIB
/// tekshirgan afzal.
WriteBlock checkWritable({
  required bool isNdef,
  required bool writable,
  required int maxSize,
  required int payloadSize,
}) {
  if (!isNdef) return WriteBlock.notNdef;
  if (!writable) return WriteBlock.readOnly;
  if (maxSize > 0 && payloadSize > maxSize) return WriteBlock.tooLarge;
  return WriteBlock.ok;
}

/// Tegga yoziladigan manzil XAVFSIZMI.
///
/// Faqat `http`/`https` ga ruxsat. `javascript:`, `file:`,
/// `intent:` kabi sxemalar telefonda o'qilganda xavfli bo'lishi
/// mumkin va NFCSTORE tegiga hech qachon yozilmaydi.
bool isSafeWriteUrl(String raw) {
  final u = Uri.tryParse(raw.trim());
  if (u == null || !u.hasScheme || u.host.isEmpty) return false;
  return u.scheme == 'http' || u.scheme == 'https';
}

/// NFCSTORE profilining OCHIQ manzili.
///
/// Tegga AYNAN shu yoziladi — jismoniy kartaning maxfiy chip
/// tokeni EMAS. Token faqat NFCSTORE kartasining o'zida yashaydi;
/// uni oddiy tegga ko'chirish kartaning xavfsizlik modelini
/// buzardi va tokenni istalgan o'quvchiga ochib qo'yardi.
String profileTagUrl(String base, String code) {
  final b = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
  return '$b/${Uri.encodeComponent(code)}';
}
