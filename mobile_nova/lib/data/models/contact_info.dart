/// ALOQA VA HAVOLALAR — shaxsiy profil (`/api/records/:code`) va biznes
/// (`/api/companies/:id`) uchun BITTA model.
///
/// Server ikki xil kalit ishlatadi (profil `tg`, biznes `telegram`),
/// shuning uchun ikkita konstruktor va ikkita `toJson` bor. Havola
/// yasash qoidalari saytdagi `src/lib/socialLinks.js` bilan AYNAN bir
/// xil: odam Instagram'dan nusxalagan to'liq manzilni qo'ysa ham,
/// `@username` yozsa ham — natija bitta toza havola.
library;

class ExtraLink {
  const ExtraLink({required this.label, required this.url});
  final String label;
  final String url;

  /// Nom bo'sh bo'lsa — manzilning domeni (`instagram.com`). Server
  /// biznes havolasini NOMSIZ bo'lsa jimgina tashlab yuboradi
  /// (`rowCompany` PATCH: `filter(l.label && l.url)`).
  Map<String, dynamic> toJson() => {
        'label': label.isNotEmpty ? label : _hostOf(url),
        'url': url,
      };

  static String _hostOf(String url) {
    final u = Uri.tryParse(
        RegExp(r'^https?://', caseSensitive: false).hasMatch(url) ? url : 'https://$url');
    final h = (u?.host ?? '').replaceFirst(RegExp(r'^www\.'), '');
    return h.isEmpty ? url : h;
  }

  static List<ExtraLink> listFrom(Object? raw) {
    if (raw is! List) return const [];
    return [
      for (final e in raw)
        if (e is Map && '${e['url'] ?? ''}'.trim().isNotEmpty)
          ExtraLink(
            label: '${e['label'] ?? ''}'.trim(),
            url: '${e['url']}'.trim(),
          ),
    ];
  }
}

/// PLASTIK (BANK) KARTA RAQAMI — pul o'tkazish uchun (sayt:
/// `record.cardNumbers`, `{label, number}`; masalan `Humo`).
class CardNumber {
  const CardNumber({this.label = '', required this.number});
  final String label;
  final String number;

  Map<String, dynamic> toJson() => {'label': label, 'number': number};

  static List<CardNumber> listFrom(Object? raw) {
    if (raw is! List) return const [];
    return [
      for (final e in raw)
        if (e is Map && '${e['number'] ?? ''}'.trim().isNotEmpty)
          CardNumber(
            label: '${e['label'] ?? ''}'.trim(),
            number: '${e['number']}'.trim(),
          ),
    ];
  }
}

class ContactInfo {
  const ContactInfo({
    this.phone = '',
    this.hidePhone = false,
    this.telegram = '',
    this.whatsapp = '',
    this.email = '',
    this.instagram = '',
    this.facebook = '',
    this.twitter = '',
    this.linkedin = '',
    this.website = '',
    this.address = '',
    this.latitude,
    this.longitude,
    this.extraLinks = const [],
    this.cardNumber = '',
    this.cardNumbers = const [],
  });

  final String phone;
  final bool hidePhone;
  final String telegram;
  final String whatsapp;
  final String email;
  final String instagram;
  final String facebook;
  final String twitter;
  final String linkedin;
  final String website;
  final String address;
  final double? latitude;
  final double? longitude;
  final List<ExtraLink> extraLinks;

  /// Asosiy karta raqami (`cardNumber`) — profil ham, biznes ham.
  final String cardNumber;

  /// Qo'shimcha kartalar (faqat shaxsiy profil, saytda kiritiladi).
  /// Ilova ularni ko'rsatadi va saqlashda O'ZGARTIRMAY qaytaradi.
  final List<CardNumber> cardNumbers;

  static String _s(Object? v) => v == null ? '' : '$v'.trim();
  static double? _d(Object? v) => v == null ? null : double.tryParse('$v');

  /// Shaxsiy profil (`rowToRecord`).
  factory ContactInfo.fromRecord(Map<String, dynamic> j) => ContactInfo(
        phone: _s(j['phone']),
        hidePhone: j['hidePhone'] == true,
        telegram: _s(j['tg']),
        email: _s(j['email']),
        instagram: _s(j['instagram']),
        facebook: _s(j['facebook']),
        twitter: _s(j['twitter']),
        linkedin: _s(j['linkedin']),
        website: _s(j['website']),
        address: _s(j['address']),
        latitude: _d(j['latitude']),
        longitude: _d(j['longitude']),
        extraLinks: ExtraLink.listFrom(j['extraLinks']),
        cardNumber: _s(j['cardNumber']),
        cardNumbers: CardNumber.listFrom(j['cardNumbers']),
      );

  /// Biznes (`rowCompany`).
  factory ContactInfo.fromCompany(Map<String, dynamic> j) => ContactInfo(
        phone: _s(j['phone']),
        telegram: _s(j['telegram']),
        whatsapp: _s(j['whatsapp']),
        instagram: _s(j['instagram']),
        facebook: _s(j['facebook']),
        website: _s(j['website']),
        address: _s(j['address']),
        latitude: _d(j['latitude']),
        longitude: _d(j['longitude']),
        extraLinks: ExtraLink.listFrom(j['extraLinks']),
        cardNumber: _s(j['cardNumber']),
      );

  /// `PUT /api/records/:code` kalitlari. Server `tg`/`instagram`/...
  /// dan `@` ni o'zi olib tashlaydi; bu yerda ham toza username
  /// yuboriladi (sayt bilan bir xil).
  Map<String, dynamic> toRecordJson() => {
        'phone': phone,
        'hidePhone': hidePhone,
        'tg': socialHandle('tg', telegram),
        'email': email,
        'instagram': socialHandle('ig', instagram),
        'facebook': facebook,
        'twitter': socialHandle('x', twitter),
        'linkedin': linkedin,
        'website': website,
        'address': address,
        'extraLinks': [for (final l in extraLinks) l.toJson()],
        'cardNumber': cardNumber,
        // `cardNumbers` (qo'shimcha kartalar) ATAYLAB yuborilmaydi: ilova
        // ularni tahrirlamaydi, saqlashda esa serverdagi joriy yozuv
        // ustiga yoziladi (`ProfileRepository.update`) — ular o'zgarmay
        // qoladi.
      };

  /// `PATCH /api/companies/:id` kalitlari (server ko'pi bilan 8 ta
  /// qo'shimcha havola saqlaydi).
  Map<String, dynamic> toCompanyJson() => {
        'phone': phone,
        'telegram': socialHandle('tg', telegram),
        'whatsapp': whatsapp,
        'instagram': socialHandle('ig', instagram),
        'facebook': facebook,
        'website': website,
        'address': address,
        'extraLinks': [for (final l in extraLinks.take(8)) l.toJson()],
        'cardNumber': cardNumber,
      };

  ContactInfo copyWith({
    String? phone,
    bool? hidePhone,
    String? telegram,
    String? whatsapp,
    String? email,
    String? instagram,
    String? facebook,
    String? twitter,
    String? linkedin,
    String? website,
    String? address,
    List<ExtraLink>? extraLinks,
    String? cardNumber,
  }) =>
      ContactInfo(
        phone: phone ?? this.phone,
        hidePhone: hidePhone ?? this.hidePhone,
        telegram: telegram ?? this.telegram,
        whatsapp: whatsapp ?? this.whatsapp,
        email: email ?? this.email,
        instagram: instagram ?? this.instagram,
        facebook: facebook ?? this.facebook,
        twitter: twitter ?? this.twitter,
        linkedin: linkedin ?? this.linkedin,
        website: website ?? this.website,
        address: address ?? this.address,
        latitude: latitude,
        longitude: longitude,
        extraLinks: extraLinks ?? this.extraLinks,
        cardNumber: cardNumber ?? this.cardNumber,
        cardNumbers: cardNumbers,
      );

  /// Ekranda ko'rsatiladigan tugmalar — saytdagi tartibda:
  /// telefon, Telegram, WhatsApp, Instagram, Facebook, X, LinkedIn,
  /// email, xarita, veb-sayt, karta raqamlari, qo'shimcha havolalar.
  List<ContactAction> actions() {
    final out = <ContactAction>[];
    void add(ContactKind k, String url, [String label = '']) {
      if (url.isNotEmpty) out.add(ContactAction(kind: k, url: url, label: label));
    }

    if (!hidePhone && phone.isNotEmpty) {
      add(ContactKind.phone, 'tel:${phone.replaceAll(RegExp(r'[^+\d]'), '')}');
    }
    add(ContactKind.telegram, socialUrl('tg', telegram));
    if (whatsapp.isNotEmpty) {
      add(
          ContactKind.whatsapp,
          whatsapp.startsWith('http')
              ? whatsapp
              : 'https://wa.me/${whatsapp.replaceAll(RegExp(r'\D'), '')}');
    }
    add(ContactKind.instagram, socialUrl('ig', instagram));
    add(ContactKind.facebook, socialUrl('fb', facebook));
    add(ContactKind.x, socialUrl('x', twitter));
    add(ContactKind.linkedin, socialUrl('li', linkedin));
    if (email.contains('@')) add(ContactKind.email, 'mailto:$email');
    if (latitude != null && longitude != null) {
      add(ContactKind.map,
          'https://www.google.com/maps/search/?api=1&query=$latitude,$longitude');
    } else if (address.isNotEmpty) {
      add(ContactKind.map,
          'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}');
    }
    add(ContactKind.website, _web(website));
    // Karta: `url` o'rnida RAQAMNING O'ZI (havola emas) — tugma uni
    // ochmaydi, raqam/QR/nusxalash oynasini ko'rsatadi.
    add(ContactKind.card, cardNumber);
    for (final c in cardNumbers) {
      add(ContactKind.card, c.number, c.label);
    }
    for (final l in extraLinks) {
      add(ContactKind.link, _web(l.url), l.label);
    }
    return out;
  }

  static String _web(String v) {
    final s = v.trim();
    if (s.isEmpty) return '';
    return RegExp(r'^https?://', caseSensitive: false).hasMatch(s) ? s : 'https://$s';
  }
}

enum ContactKind {
  phone,
  telegram,
  whatsapp,
  instagram,
  facebook,
  x,
  linkedin,
  email,
  map,
  website,

  /// Plastik (bank) karta — `url` da karta raqami.
  card,
  link,
}

class ContactAction {
  const ContactAction({required this.kind, required this.url, this.label = ''});
  final ContactKind kind;
  final String url;

  /// Faqat qo'shimcha havolalar uchun — egasi yozgan nom.
  final String label;
}

/// BIZNES POSTIDAGI "BOG'LANISH" (server, 2026-10).
///
/// Lenta (`/api/feed`, obunalar va FEATURED ham), Reels "Siz uchun"
/// (`/api/reels`), saqlanganlar va kompaniya postlari
/// (`/api/companies/:id/posts`) FAOL kompaniyaning postiga
/// `contact: {phone, telegram, mapUrl}` qo'shadi — faqat kompaniya o'z
/// ochiq sahifasida allaqachon ko'rsatadigan maydonlar (server
/// `api/post-contact.js`). Yo'q qiymat — `null`. Shaxsiy post va
/// istoriyada maydon umuman yo'q.
///
/// Havolalar profildagi aloqa tugmalari bilan AYNAN bir qoidada
/// yasaladi ([ContactInfo.actions]): telefon — `tel:` (faqat raqam va
/// `+`), Telegram — `@name`, `t.me/...` yoki to'liq havola bir xil
/// toza `https://t.me/...` ga. Xarita — server bergan Google Maps
/// havolasi.
class PostContact {
  const PostContact({this.phone = '', this.telegram = '', this.mapUrl = ''});

  final String phone;
  final String telegram;
  final String mapUrl;

  static String _s(Object? v) => v is String ? v.trim() : '';

  /// `null` — maydon yo'q, shakli noto'g'ri yoki HAMMA qiymat bo'sh.
  static PostContact? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final c = PostContact(
      phone: _s(raw['phone']),
      telegram: _s(raw['telegram']),
      mapUrl: _s(raw['mapUrl']),
    );
    return c.phone.isEmpty && c.telegram.isEmpty && c.mapUrl.isEmpty ? null : c;
  }

  /// Telefon raqamiga o'xshagan Telegram qiymati (`+998 90 123-45-67`)
  /// — `t.me/+998901234567` (Telegram raqam bo'yicha havolasi).
  /// Bo'shliq va chiziqchalar havolani buzardi; `+` siz raqam esa
  /// username deb o'qilardi.
  static String _tg(String v) {
    if (!RegExp(r'^\+?[\d\s\-()]{9,}$').hasMatch(v)) return v;
    final digits = v.replaceAll(RegExp(r'\D'), '');
    return digits.length < 9 ? v : '+$digits';
  }

  /// Ko'rsatiladigan tugmalar: Qo'ng'iroq, Telegram, Xarita (shu
  /// tartibda, ko'pi bilan 3 ta). Faqat `tel:`, `http`, `https` —
  /// boshqa sxema yoki buzuq havola tugmaga aylanmaydi.
  List<ContactAction> actions() => [
        ...ContactInfo(phone: phone, telegram: _tg(telegram)).actions(),
        if (mapUrl.isNotEmpty) ContactAction(kind: ContactKind.map, url: mapUrl),
      ].where((a) => isSafeContactUrl(a.url)).toList();
}

/// Tashqariga ochiladigan havola xavfsizmi: faqat `tel:` (kamida 3
/// raqam), `http` yoki `https` (xost bilan), bo'shliqsiz.
bool isSafeContactUrl(String url) {
  if (url.isEmpty || RegExp(r'\s').hasMatch(url)) return false;
  final u = Uri.tryParse(url);
  if (u == null) return false;
  final scheme = u.scheme.toLowerCase();
  if (scheme == 'tel') {
    return RegExp(r'^\+?\d{3,}$').hasMatch(u.path);
  }
  return (scheme == 'http' || scheme == 'https') && u.host.isNotEmpty;
}

// ── saytdagi `socialLinks.js` ning aynan nusxasi ─────────────────────

const _hosts = {
  'tg': 'https://t.me/',
  'ig': 'https://instagram.com/',
  'x': 'https://x.com/',
  'fb': 'https://facebook.com/',
};

bool _looksLikeUrl(String v) =>
    RegExp(r'^https?://', caseSensitive: false).hasMatch(v) ||
    RegExp(r'^[a-z0-9-]+(\.[a-z0-9-]+)+/', caseSensitive: false).hasMatch(v);

String _pathOf(String v) {
  final withScheme =
      RegExp(r'^https?://', caseSensitive: false).hasMatch(v) ? v : 'https://$v';
  final u = Uri.tryParse(withScheme);
  final p = u?.path ?? '';
  return p.replaceAll(RegExp(r'^/+|/+$'), '');
}

String _bare(String v) => v
    .replaceAll(RegExp(r'^@+'), '')
    .split(RegExp(r'[?#]'))
    .first
    .replaceAll(RegExp(r'^/+|/+$'), '');

/// Kiritilgan qiymatdan toza username (Telegram uchun — to'liq yo'l).
String socialHandle(String kind, String raw) {
  final v = raw.trim();
  if (v.isEmpty) return '';
  if (!_looksLikeUrl(v)) return _bare(v);
  final path = _pathOf(v);
  if (path.isEmpty) return '';
  if (kind == 'tg') return path;
  return _bare(path.split('/').first);
}

/// Bosiladigan to'liq havola. Bo'sh qiymatda — bo'sh satr.
String socialUrl(String kind, String raw) {
  final v = raw.trim();
  if (v.isEmpty) return '';
  final hasScheme = RegExp(r'^https?://', caseSensitive: false).hasMatch(v);
  if ((kind == 'fb' || kind == 'li') && hasScheme) return v;
  if (kind == 'li') return hasScheme ? v : 'https://${v.replaceAll(RegExp(r'^/+'), '')}';
  final handle = socialHandle(kind, v);
  if (handle.isEmpty) return '';
  final host = _hosts[kind];
  return host == null ? '' : host + handle;
}
