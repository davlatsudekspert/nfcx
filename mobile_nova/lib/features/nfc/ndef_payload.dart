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

/// NDEF URI prefiks jadvali (NFC Forum RTD-URI, to'liq 36 ta).
///
/// Birinchi bayt — shu jadvaldagi indeks, qolgani matn. Eng uzun
/// mos prefiks tanlanadi: `https://www.` uchun 0x02 ishlatilsa
/// yuklama `https://` (0x04) ga qaraganda 4 bayt qisqaradi, bu
/// esa kichik teglarda muhim.
///
/// JADVAL TO'LIQ BO'LISHI SHART. Avval bu yerda faqat dastlabki 7
/// ta yozuv turardi va `decodeUriPayload` qolgan indekslarni
/// prefikssiz deb o'qirdi. O'z tegimizni o'zimiz yozganda bu
/// sezilmasdi (biz doim `https://` yozamiz), lekin endi ilova
/// BEGONA teglarni ham o'qiydi — ustiga yozishdan oldin ichida
/// nima borligini ko'rsatish uchun. O'sha teg `file://` yoki
/// `ftp://` bilan yozilgan bo'lsa, qisqa jadval manzilni
/// buzib ko'rsatardi.
const List<String> kUriPrefixes = [
  '', // 0x00 — prefikssiz
  'http://www.', // 0x01
  'https://www.', // 0x02
  'http://', // 0x03
  'https://', // 0x04
  'tel:', // 0x05
  'mailto:', // 0x06
  'ftp://anonymous:anonymous@', // 0x07
  'ftp://ftp.', // 0x08
  'ftps://', // 0x09
  'sftp://', // 0x0A
  'smb://', // 0x0B
  'nfs://', // 0x0C
  'ftp://', // 0x0D
  'dav://', // 0x0E
  'news:', // 0x0F
  'telnet://', // 0x10
  'imap:', // 0x11
  'rtsp://', // 0x12
  'urn:', // 0x13
  'pop:', // 0x14
  'sip:', // 0x15
  'sips:', // 0x16
  'tftp:', // 0x17
  'btspp://', // 0x18
  'btl2cap://', // 0x19
  'btgoep://', // 0x1A
  'tcpobex://', // 0x1B
  'irdaobex://', // 0x1C
  'file://', // 0x1D
  'urn:epc:id:', // 0x1E
  'urn:epc:tag:', // 0x1F
  'urn:epc:pat:', // 0x20
  'urn:epc:raw:', // 0x21
  'urn:epc:', // 0x22
  'urn:nfc:', // 0x23
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

// ═══════════════════════════════════════════════════════════════════
// TASHQI (BEGONA) NFC TEGIGA YOZISH
//
// Foydalanuvchi NFCSTORE kartasini sotib olishga MAJBUR EMAS: boshqa
// joydan olingan istalgan qayta yoziladigan NFC teg (NTAG213/215/216
// stiker, oq karta va h.k.) ham profil tegiga aylantirilishi mumkin.
//
// Quyidagilar — o'sha oqimning APPARATSIZ qismi. Sessiya, teg topish
// va `Ndef.write` xizmat qatlamida (DEVICE REQUIRED), bu yerdagi
// mantiq esa oddiy `flutter test` da to'liq tekshiriladi.
// ═══════════════════════════════════════════════════════════════════

/// Tegning apparat identifikatori — o'n oltilik satr sifatida.
///
/// NIMA UCHUN KERAK: yozish IKKI BOSQICHLI. Birinchi tegizishda teg
/// O'QILADI va ichidagi narsa foydalanuvchiga ko'rsatiladi; u
/// rozilik bergach ikkinchi tegizishda YOZILADI. Ikki tegizish
/// orasida boshqa teg tutilib qolsa, rozilik berilmagan begona
/// tegning ustiga yozib yuborilardi. Shuning uchun identifikator
/// solishtiriladi.
///
/// `nfc_manager` umumiy "id" bermaydi — har bir platforma texnologiyasi
/// o'z xaritasida `identifier` saqlaydi. Shuning uchun ma'lum kalitlar
/// ketma-ket qaraladi. Hech biri bo'lmasa (iOS'dagi ba'zi teglar)
/// bo'sh satr qaytadi va CHAQIRUVCHI buni "solishtirib bo'lmaydi" deb
/// qabul qiladi — yo'qlik "boshqa teg" degani EMAS.
String tagIdentity(Map<String, dynamic> data) {
  // Tartib muhim emas — bitta tegda odatda bittasi bo'ladi.
  const keys = [
    'nfca', 'nfcb', 'nfcf', 'nfcv',
    'mifareclassic', 'mifareultralight', 'ndefformatable',
    'iso7816', 'iso15693',
  ];
  for (final k in keys) {
    final raw = data[k];
    if (raw is! Map) continue;
    final id = raw['identifier'];
    if (id is List && id.isNotEmpty) {
      return id
          .map((b) => (b as int).toRadixString(16).padLeft(2, '0'))
          .join();
    }
  }
  return '';
}

/// O'qilgan XOM yozuvni tanib olish.
///
/// `typeNameFormat` NFC Forum qiymati: 1 — "well known" (RTD).
/// 2 — MIME turi (vCard shu yerdan keladi).
const int kTnfWellKnown = 1;
const int kTnfMime = 2;

/// Bitta xom NDEF yozuvini o'qiladigan ko'rinishga keltiradi.
///
/// `nfc_manager` ning sinflariga BOG'LANMAGAN: faqat baytlar kiradi,
/// shuning uchun telefonsiz sinaladi.
NdefRecordData classifyRecord({
  required int typeNameFormat,
  required List<int> type,
  required List<int> payload,
}) {
  if (typeNameFormat == kTnfWellKnown && type.isNotEmpty) {
    // 0x55 = 'U' (URI), 0x54 = 'T' (Text).
    if (type.first == 0x55) {
      return NdefRecordData(kind: NdefKind.uri, value: decodeUriPayload(payload));
    }
    if (type.first == 0x54) {
      return NdefRecordData(
        kind: NdefKind.text,
        value: decodeTextPayload(payload),
        language: decodeTextLanguage(payload),
      );
    }
  }
  if (typeNameFormat == kTnfMime) {
    final mime = utf8.decode(type, allowMalformed: true).toLowerCase();
    if (mime.contains('vcard') || mime.contains('x-vcard')) {
      return NdefRecordData(
        kind: NdefKind.vcard,
        value: utf8.decode(payload, allowMalformed: true),
        mimeType: mime,
      );
    }
    return NdefRecordData(
      kind: NdefKind.unknown,
      value: utf8.decode(payload, allowMalformed: true),
      mimeType: mime,
    );
  }
  return const NdefRecordData(kind: NdefKind.unknown, value: '');
}

/// YOZILGANNI QAYTA O'QIB TASDIQLASH.
///
/// "Yozildi" degan yozuv FAQAT shu tekshiruvdan keyin chiqadi.
/// Teg to'lib qolsa yoki yozish yarim yo'lda uzilsa, `Ndef.write`
/// ba'zan xato BERMAYDI — tegda esa eski yoki buzuq ma'lumot qoladi.
/// Yagona ishonchli dalil — qaytadan o'qish.
///
/// Solishtirish MAYDA FARQLARGA kechirimli: teg URI ni prefiks
/// jadvali orqali saqlaydi, shuning uchun `https://www.` va
/// `https://` bir xil manzilga olib boradi; oxiridagi `/` ham
/// ahamiyatsiz. Lekin HOST va YO'L aynan mos kelishi shart.
bool sameWrittenUrl(String expected, String actual) {
  final a = Uri.tryParse(expected.trim());
  final b = Uri.tryParse(actual.trim());
  if (a == null || b == null) return false;
  if (a.scheme.toLowerCase() != b.scheme.toLowerCase()) return false;

  String host(Uri u) {
    final h = u.host.toLowerCase();
    return h.startsWith('www.') ? h.substring(4) : h;
  }

  String path(Uri u) {
    final p = u.path;
    return p.endsWith('/') && p.length > 1 ? p.substring(0, p.length - 1) : p;
  }

  return host(a) == host(b) && path(a) == path(b) && a.query == b.query;
}
