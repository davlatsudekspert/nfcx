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
      );

  /// Ekranda ko'rsatiladigan tugmalar — saytdagi tartibda:
  /// telefon, Telegram, WhatsApp, Instagram, Facebook, X, LinkedIn,
  /// email, xarita, veb-sayt, qo'shimcha havolalar.
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
  link,
}

class ContactAction {
  const ContactAction({required this.kind, required this.url, this.label = ''});
  final ContactKind kind;
  final String url;

  /// Faqat qo'shimcha havolalar uchun — egasi yozgan nom.
  final String label;
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
