/// Backend javoblarining Dart ko'rinishi.
///
/// QOIDA: har bir `fromJson` HIMOYALANGAN — maydon yo'q bo'lsa yoki
/// turi kutilganidan boshqa bo'lsa, ilova qulamaydi, standart qiymat
/// oladi. Server bitta maydonni o'zgartirsa butun ekran oq bo'lib
/// qolmasligi uchun.
library;

import '../../core/utils/media_url.dart';
import 'contact_info.dart';

export 'contact_info.dart';

/// `dynamic` dan xavfsiz o'qish yordamchilari.
String _s(dynamic v, [String d = '']) => v == null ? d : '$v';

/// MEDIA MANZILI uchun `_s`.
///
/// Backend yuklangan fayllarni NISBIY yo'l bilan qaytaradi
/// (`/uploads/...`). Saytda bu ishlaydi — u o'sha domenda turadi —
/// ilovada esa yo'q. Shuning uchun har bir manzil maydoni AYNAN shu
/// yordamchidan o'tadi: bitta joyda, modelning chegarasida. Ekran
/// va vidjetlar tayyor, to'liq manzil oladi va hech biri buni
/// o'zi eslab qolishi shart emas.
String _u(dynamic v) => mediaUrl(_s(v));
int _i(dynamic v, [int d = 0]) =>
    v is int ? v : int.tryParse('${v ?? ''}') ?? d;
bool _b(dynamic v, [bool d = false]) =>
    v is bool ? v : (v == 1 || v == '1' || v == 'true' ? true : d);
/// Sana — ISO satr YOKI epoch raqami.
///
/// NIMA UCHUN IKKALASI. Server ikki xil yuboradi: eski
/// endpointlar ISO satr (`2026-09-21T02:46:37Z`), lenta va
/// bildirishnomalar esa RAQAM — `Date.getTime()` natijasi
/// (millisekund).
///
/// Ilgari bu yerda faqat `DateTime.tryParse` turardi va u raqam
/// uchun `null` qaytarardi. Ya'ni `/api/feed` dan kelgan HAR BIR
/// postning vaqti `null` edi. Hozircha bu ko'rinmaydi — lenta
/// kartasida vaqt chizilmaydi — lekin vaqtga TAYANADIGAN har
/// qanday yangi joy (masalan FEATURED slotining "necha kun
/// qoldi" hisobi) jimgina noto'g'ri ishlardi.
///
/// Raqam chegarasi: 1e11 dan katta — millisekund (2020-yil
/// ~1.6e12), 1e9 dan katta — sekund (~1.6e9). Kichik sonlar
/// (masalan `2026`) sana EMAS va `null` qaytariladi — aks holda
/// yil raqami 1970-yilning boshiga aylanib ketardi.
DateTime? _dt(dynamic v) {
  if (v == null) return null;
  final n = v is num ? v : num.tryParse('$v');
  if (n != null) {
    final ms = n.abs() >= 1e11
        ? n.toInt()
        : (n.abs() >= 1e9 ? n.toInt() * 1000 : null);
    if (ms == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(ms);
  }
  return DateTime.tryParse('$v');
}
List<Map<String, dynamic>> _list(dynamic v) => v is List
    ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList()
    : const [];

class User {
  const User({
    required this.id,
    required this.email,
    this.name = '',
    this.phone = '',
    this.avatarUrl = '',
    this.emailVerified = false,
    this.promoCode = '',
    this.premium = false,
    this.premiumUntil,
    this.trialUntil,
  });

  final int id;
  final String email;
  final String name;
  final String phone;
  final String avatarUrl;
  final bool emailVerified;
  final String promoCode;
  final bool premium;

  /// Premium OBUNA tugash sanasi.
  ///
  /// Server `isPremium` ni ikki yo'l bilan hisoblaydi: eski, bir
  /// martalik to'lov qilganlarda `is_premium = 1` (MUDDATSIZ), yangi
  /// obunachilarda esa `premium_expires_at > hozir`. Ikkinchisida
  /// sana bor, birinchisida YO'Q — shuning uchun bu maydon `null`
  /// bo'lishi MUDDATSIZ degani, "premium emas" degani emas.
  ///
  /// Ilgari bu maydon o'qilmasdi: server yuborardi, model tashlab
  /// yuborardi. Natijada obuna qachon tugashini ilova ayta olmasdi.
  final DateTime? premiumUntil;

  /// Sinov muddati tugash sanasi — u ham premium darajasini beradi.
  final DateTime? trialUntil;

  /// Premium HOZIR faolmi.
  bool get premiumActive =>
      premium ||
      (premiumUntil?.isAfter(DateTime.now()) ?? false) ||
      trialActive;

  /// Sinov muddati hozir ketyaptimi.
  bool get trialActive => trialUntil?.isAfter(DateTime.now()) ?? false;

  /// Ism bo'lmasa email'ning `@` gacha qismi ishlatiladi — profil
  /// hech qachon "bo'sh nom" bilan ko'rinmaydi.
  String get displayName =>
      name.trim().isNotEmpty ? name.trim() : email.split('@').first;

  /// Avatar o'rnidagi harflar.
  String get initials {
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2 && parts[1].isNotEmpty) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    final d = displayName.trim();
    return (d.length >= 2 ? d.substring(0, 2) : d).toUpperCase();
  }

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: _i(j['id']),
        email: _s(j['email']),
        name: _s(j['name'] ?? j['fullName'] ?? j['displayName']),
        phone: _s(j['phone']),
        avatarUrl: _u(j['avatarUrl'] ?? j['avatar']),
        emailVerified: _b(j['emailVerified'] ?? j['email_verified']),
        promoCode: _s(j['promoCode'] ?? j['promo_code']),
        premium: _b(j['premium'] ?? j['isPremium']),
        premiumUntil: _dt(j['premiumExpiresAt'] ?? j['premium_expires_at']),
        trialUntil: _dt(j['trialExpiresAt'] ?? j['trial_expires_at']),
      );
}

/// NFC ID — backend'da `record` deb ataladi va `code` uning kalitidir.
///
/// MUHIM: kod formati BACKEND'niki. Ro'yxatdan o'tganda avtomatik
/// 8 xonali kod beriladi, do'kondan qisqaroq (qimmatroq) kodlarni
/// sotib olish mumkin. Ilova formatni O'ZI to'qimaydi va tekshirmaydi.
/// KO'RINISH UCHUN DARAJA — tekin ID bronza EMAS.
///
/// Server 6 belgidan boshqa uzunlikdagi har qanday kodga (ro'yxatdan
/// o'tganda beriladigan 8 raqamli TEKIN ID ham shu) `free` beradi. Pullik
/// eng arzon "Bronza" esa 6 belgili `free` kod. Egasi (2026-09-24): "bu
/// tekin ID bronza emas — oddiy, mavzu bilan bir xil bo'lishi kerak".
/// Shuning uchun tekin ID darajasiz (`''`) o'qiladi: na bronza rang, na
/// "BRONZA" yozuvi. Mantiq (post/istorya ruxsati) serverdan keladi —
/// bu faqat ko'rinish.
String nfcIdVisualTier(String code, String tier) =>
    tier == 'free' && code.trim().length != 6 ? '' : tier;

class NfcId {
  const NfcId({
    required this.code,
    this.name = '',
    this.role = '',
    this.avatarUrl = '',
    this.coverUrl = '',
    this.bio = '',
    this.primary = false,
    this.active = true,
    this.views = 0,
    this.taps = 0,
    this.followers = 0,
    this.following = 0,
    this.posts = 0,
    this.verified = false,
    this.tier = '',
    this.kind = NfcIdKind.personal,
    this.cardLinked = false,
    this.musicUrls = const [],
    this.hiddenFromDirectory = false,
    this.categorySlug = '',
    this.createdAt,
    this.contact = const ContactInfo(),
  });

  final String code;
  final String name;
  final String role;
  final String avatarUrl;
  final String coverUrl;
  final String bio;
  final bool primary;
  final bool active;
  final int views;
  final int taps;
  final int followers;
  final int following;
  final int posts;

  /// HAQIQIY TASDIQLASH — admin qo'yadi (`cards.verified`).
  ///
  /// Ilgari bu maydon ilovada UMUMAN yo'q edi. Profil ekrani esa
  /// avatar ustiga ✓ chizardi — lekin "tasdiqlangan" uchun emas,
  /// ASOSIY ID uchun. Odam uni Instagram'dagi ko'k belgidek
  /// o'qiydi, ya'ni ilova har bir foydalanuvchini tasdiqlangan
  /// deb ko'rsatib turardi.
  ///
  /// Server bu maydonni allaqachon yuboradi (`rowToRecord`da
  /// `verified`), ilova esa o'qimasdi.
  final bool verified;

  /// DARAJA — `free` | `silver` | `gold` | `premium` | `exclusive`.
  ///
  /// Serverda `personalIdTierD1()` hisoblaydi va `rowToRecord`
  /// uni ALLAQACHON yuboradi. Ilova esa o'qimasdi: kod hamma
  /// joyda bir xil kulrang yorliq bo'lib chizilardi.
  ///
  /// Holbuki kod — SOTILADIGAN MAHSULOT. Qisqa va nodir kod
  /// qimmatroq, lekin ekranda buni hech narsa ko'rsatmasdi.
  final String tier;
  final NfcIdKind kind;

  /// Jismoniy karta ulanganmi.
  final bool cardLinked;

  /// Profil musiqasi — backend'da `cards.music_url` ustuni.
  ///
  /// Server uni JSON massiv sifatida saqlaydi (ko'pi bilan 5 ta) va
  /// `musicUrls` bo'lib qaytaradi; eski yozuvlarda bitta `musicUrl`
  /// bo'lishi mumkin. Qiymat tashqi havola YOKI serverga yuklangan
  /// `/uploads/...` fayli.
  ///
  /// MUHIM: backend'da qo'shiq NOMI yoki IJROCHISI uchun maydon
  /// YO'Q — faqat manzil. Shuning uchun ilova ularni o'zidan
  /// to'qimaydi.
  final List<String> musicUrls;

  /// Profil ommaviy katalogdan YASHIRILGANMI.
  ///
  /// Backend'da `cards.hidden_from_directory` ustuni. `true` bo'lsa
  /// yozuv "Tanlov" ro'yxatiga, biznes katalogiga va ommaviy
  /// sovg'alar devoriga TUSHMAYDI (`worker.js` dagi barcha katalog
  /// so'rovlari `hidden_from_directory = 0` bilan filtrlaydi).
  ///
  /// Server buni ANCHADAN BERI qaytarardi va qabul qilardi, lekin
  /// model uni tashlab yuborar edi — shuning uchun Maxfiylik
  /// ekranidagi tugma hech narsaga ulanmagan edi.
  final bool hiddenFromDirectory;

  /// Biznes yo'nalishi — `food`, `retail-clothes`, `beauty`…
  ///
  /// Server buni `/api/records/:code` javobida qaytaradi
  /// (`rowToRecord`), lekin ilova uni o'qimasdi. U KERAK:
  /// katalogning qaysi turi (menyu / mahsulot / xizmat) ochilishi
  /// AYNAN shu maydonga bog'liq (`CatalogKind.forCategory`).
  final String categorySlug;

  final DateTime? createdAt;

  /// Telefon, Telegram, ijtimoiy tarmoqlar va qo'shimcha havolalar —
  /// profilda logoli dumaloq tugmalar bo'lib chiqadi.
  final ContactInfo contact;

  /// Ommaviy profil manzili — QR va "ulashish" uchun.
  String publicUrl(String base) => '$base/${Uri.encodeComponent(code)}';

  factory NfcId.fromJson(Map<String, dynamic> j) => NfcId(
        code: _s(j['code']),
        name: _s(j['name'] ?? j['title']),
        role: _s(j['role']),
        avatarUrl: _u(j['avatarUrl'] ?? j['avatar']),
        coverUrl: _u(j['bgUrl'] ?? j['coverUrl']),
        bio: _s(j['bio'] ?? j['about']),
        primary: _b(j['isPrimary'] ?? j['primary']),
        active: _b(j['active'] ?? j['isActive'], true),
        views: _i(j['views']),
        taps: _i(j['taps'] ?? j['scans']),
        followers: _i(j['followers']),
        following: _i(j['following']),
        posts: _i(j['posts']),
        verified: _b(j['verified']),
        tier: nfcIdVisualTier(_s(j['code']), _s(j['tier'])),
        // TUR — SERVER `profileType` YUBORADI.
        //
        // Ilgari bu yerda faqat `type` va `isCompany` o'qilardi.
        // Karta serializeri (`rowToRecord`) ularning BIRORTASINI
        // yubormaydi — u `profileType: 'personal'|'expert'|'business'`
        // yuboradi. Ya'ni foydalanuvchining biznes turidagi kartasi
        // ham DOIM shaxsiy bo'lib o'qilardi va NFC ro'yxatida
        // noto'g'ri rang/belgi bilan chizilardi.
        //
        // `expert` — shaxsiy profilning bir ko'rinishi, shuning uchun
        // u shaxsiy bo'lib qoladi.
        kind: _s(j['profileType']) == 'business' ||
                _s(j['type']) == 'business' ||
                _b(j['isCompany'])
            ? NfcIdKind.business
            : NfcIdKind.personal,
        cardLinked: _b(j['cardLinked'] ?? j['hasCard']) ||
            _s(j['chipToken']).isNotEmpty,
        musicUrls: _musicUrls(j),
        hiddenFromDirectory: _b(j['hiddenFromDirectory'] ??
            j['hidden_from_directory']),
        categorySlug: _s(j['categorySlug'] ?? j['category_slug']),
        createdAt: _dt(j['createdAt'] ?? j['created_at']),
        contact: ContactInfo.fromRecord(j),
      );
}

/// `musicUrls` ro'yxatini o'qish.
///
/// Server yangi yozuvlarda ro'yxat, eskilarida bitta `musicUrl`
/// qaytaradi — ikkalasi ham qabul qilinadi.
List<String> _musicUrls(Map<String, dynamic> j) {
  final raw = j['musicUrls'];
  if (raw is List) {
    return raw
        .map((e) => e is String ? mediaUrl(e) : '')
        .where((e) => e.isNotEmpty)
        .take(5)
        .toList(growable: false);
  }
  final one = _u(j['musicUrl']);
  return one.isEmpty ? const [] : [one];
}

enum NfcIdKind { personal, business }

/// Jismoniy NFC karta (`/api/my/nfc-devices`).
class NfcDevice {
  const NfcDevice({
    required this.id,
    this.label = '',
    this.code = '',
    this.lastSeen,
    this.active = true,
    this.blockedByOwner = false,
    this.companyId = '',
  });

  final int id;
  final String label;

  /// Qaysi NFC ID'ga bog'langan.
  final String code;

  /// Biznesga ulangan bo'lsa — kompaniya ID (`linkedCompanyId`).
  ///
  /// Ilgari o'qilmasdi: biznesga ulangan stiker ro'yxatda faqat
  /// "•••• XXXX" bo'lib turardi va qaysi kompaniyaniki ekani
  /// ko'rinmasdi (egasi, 2026-09-26).
  final String companyId;

  bool get business => companyId.isNotEmpty;
  final DateTime? lastSeen;
  final bool active;

  /// Egasi kartani vaqtincha o'chirib qo'yganmi.
  ///
  /// Bloklangan karta tegizilganda profil OCHILMAYDI. Bu yo'qolgan
  /// kartani zararsizlantirishning yagona qo'llab-quvvatlanadigan
  /// yo'li — serverda "bog'lanishni uzish" degan amal yo'q.
  final bool blockedByOwner;

  /// Server `listPhysicalCardsByOwner` shaklida qaytaradi:
  ///
  ///     { id, tokenTail, linkedCode, linkedName, active,
  ///       blockedByOwner, status, createdAt }
  ///
  /// `label` uchun avval bog'langan profil NOMI olinadi, u bo'sh
  /// bo'lsa chip tokenining oxirgi 4 belgisi — foydalanuvchi ikki
  /// kartani shundan ajratadi.
  factory NfcDevice.fromJson(Map<String, dynamic> j) {
    final tail = _s(j['tokenTail']);
    final companyName = _s(j['linkedCompanyName']);
    return NfcDevice(
      id: _i(j['id']),
      label: _s(
          j['linkedName'] ??
              (companyName.isNotEmpty ? companyName : null) ??
              j['label'] ??
              j['name'],
          tail.isEmpty ? 'NFC' : '•••• $tail'),
      companyId: _s(j['linkedCompanyId']),
      code: _s(j['linkedCode'] ?? j['code'] ?? j['recordCode']),
      lastSeen: _dt(j['lastSeen'] ?? j['updatedAt'] ?? j['createdAt']),
      active: _b(j['active'], true),
      blockedByOwner: _b(j['blockedByOwner']),
    );
  }
}

/// Biznes hisobi (`/api/companies`).
class Business {
  const Business({
    required this.companyId,
    this.displayName = '',
    this.category = 'other',
    this.subcategory = '',
    this.city = '',
    this.address = '',
    this.description = '',
    this.phone = '',
    this.telegram = '',
    this.whatsapp = '',
    this.website = '',
    this.logoUrl = '',
    this.coverUrl = '',
    this.status = 'draft',
    this.followers = 0,
    this.views = 0,
    this.catalogSchema = 1,
    this.plan = const CompanyPlan(),
    this.contact = const ContactInfo(),
    this.hours = const [],
    this.openNow,
    this.todayOpen = '',
    this.todayClose = '',
    this.ordersEnabled = false,
    this.gallery = const [],
    this.tier = '',
    this.createdAt,
    this.isDemo = false,
  });

  /// `nfcstore.uz/c/<companyId>` — vitrinaning ommaviy manzili.
  final String companyId;
  final String displayName;
  final String category;
  final String subcategory;
  final String city;
  final String address;
  final String description;
  final String phone;
  final String telegram;
  final String whatsapp;
  final String website;
  final String logoUrl;
  final String coverUrl;

  /// `draft` · `pending` · `published`.
  final String status;
  final int followers;
  final int views;

  /// 2 — server listingning qo'shimcha maydonlarini (tur, global
  /// kategoriya, bir nechta rasm, "narx kelishiladi") SAQLAYDI. 1 —
  /// eski server: bu maydonlar yuborilsa jimgina yo'qolardi, shuning
  /// uchun forma ularni ko'rsatmaydi (soxta tanlov bo'lmasin).
  final int catalogSchema;

  /// Tarif holati — serverdagi `companyPlanStateD1` natijasi.
  final CompanyPlan plan;

  /// Aloqa tugmalari (telefon, Telegram, WhatsApp, Instagram,
  /// Facebook, sayt, xarita, qo'shimcha havolalar).
  final ContactInfo contact;

  /// Ish vaqti — 7 kun, 0 = yakshanba (server `normalizeHoursD1`).
  /// Bo'sh — egasi kiritmagan.
  final List<BusinessDay> hours;

  /// "Hozir ochiqmi" — SERVER Toshkent vaqti bo'yicha hisoblaydi.
  /// `null` — ish vaqti kiritilmagan (holat ko'rsatilmaydi).
  final bool? openNow;

  /// Bugungi ish vaqti ("09:00" / "18:00"); bugun dam — bo'sh.
  final String todayOpen;
  final String todayClose;

  /// Katalogdan buyurtma yoqilganmi (`POST /api/companies/:id/orders`).
  final bool ordersEnabled;

  /// Kompaniya galereyasi (sayt vitrinasidagi rasmlar).
  final List<String> gallery;

  /// Business ID darajasi — server nom uzunligidan hisoblaydi
  /// (`free` · `silver` · `gold` · `premium` · `exclusive`).
  final String tier;

  /// Yaratilgan vaqti — Tanlov'da "Yangi" belgisi uchun.
  final DateTime? createdAt;

  bool get hasHours => hours.any((d) => !d.closed);

  /// NAMUNA biznes (serverdagi `demo: true`, 2026-09-25): to'qima
  /// profil — «Namuna» deb ko'rsatiladi, "tasdiqlangan" belgisi yo'q.
  final bool isDemo;

  bool get isPublished => status == 'published' || status == 'active';

  /// Haqiqiy biznesning brendi — Company ID; namunada ko'rgazmali nom.
  String get brandName {
    final id = companyId.trim();
    final name = displayName.trim();
    return isDemo || id.isEmpty
        ? (name.isEmpty ? id : name)
        : id.toUpperCase();
  }

  String get secondaryName {
    final name = displayName.trim();
    return !isDemo &&
            name.isNotEmpty &&
            name.toUpperCase() != brandName.toUpperCase()
        ? name
        : '';
  }

  factory Business.fromJson(Map<String, dynamic> j) => Business(
        companyId: _s(j['companyId'] ?? j['id']),
        displayName: _s(j['displayName'] ?? j['name']),
        category: _s(j['category'], 'other'),
        subcategory: _s(j['subcategory']),
        city: _s(j['city']),
        address: _s(j['address']),
        description: _s(j['description']),
        phone: _s(j['phone']),
        telegram: _s(j['telegram']),
        whatsapp: _s(j['whatsapp']),
        website: _s(j['website']),
        logoUrl: _u(j['logoUrl']),
        coverUrl: _u(j['coverUrl']),
        status: _s(j['status'], 'draft'),
        followers: _i(j['followers']),
        views: _i(j['views']),
        catalogSchema: _i(j['catalogSchema'], 1),
        plan: j['plan'] is Map
            ? CompanyPlan.fromJson((j['plan'] as Map).cast<String, dynamic>())
            : const CompanyPlan(),
        contact: ContactInfo.fromCompany(j),
        hours: j['hours'] is List
            ? [
                for (final d in j['hours'] as List)
                  if (d is Map) BusinessDay.fromJson(d.cast<String, dynamic>())
              ]
            : const [],
        openNow: j['openNow'] is Map ? _b((j['openNow'] as Map)['open']) : null,
        todayOpen: j['openNow'] is Map && (j['openNow'] as Map)['today'] is Map
            ? _s(((j['openNow'] as Map)['today'] as Map)['open'])
            : '',
        todayClose: j['openNow'] is Map && (j['openNow'] as Map)['today'] is Map
            ? _s(((j['openNow'] as Map)['today'] as Map)['close'])
            : '',
        ordersEnabled: _b(j['ordersEnabled']),
        tier: _s(j['tier']),
        createdAt: _dt(j['createdAt']),
        isDemo: _b(j['demo']),
        gallery: j['gallery'] is List
            ? [
                for (final g in j['gallery'] as List)
                  if (_u(g is Map ? (g['url'] ?? g['src']) : g).isNotEmpty)
                    _u(g is Map ? (g['url'] ?? g['src']) : g)
              ]
            : const [],
      );
}

/// Bir kunlik ish vaqti — server `{closed, open, close}` shakli.
class BusinessDay {
  const BusinessDay({this.closed = true, this.open = '', this.close = ''});

  final bool closed;
  final String open;
  final String close;

  factory BusinessDay.fromJson(Map<String, dynamic> j) {
    final open = _s(j['open']);
    final close = _s(j['close']);
    return BusinessDay(
      closed: _b(j['closed']) || open.isEmpty || close.isEmpty,
      open: open,
      close: close,
    );
  }
}

/// Biznes tarifi (egasining qarori, 2026-09):
///
///   * sinov (30 kun) va eski bizneslar — cheklovsiz;
///   * bepul ID — 5 ta tovar, post/istoriya yopiq;
///   * bepul ID + Premium (oylik, sayt orqali) — 25 ta, post/istoriya bor;
///   * sotib olingan nom — cheklovsiz.
///
/// Raqamlar SERVERDAN keladi — ilova ularni o'zi o'ylab topmaydi.
/// Mavjud yozuvlar hech qachon o'chirilmaydi: limit faqat YANGI
/// qo'shishni to'xtatadi.
class CompanyPlan {
  const CompanyPlan({
    this.itemLimit,
    this.premiumItemLimit,
    this.free = false,
    this.premium = false,
    this.trialActive = false,
    this.canPost = true,
    this.trialEndsAt,
  });

  /// `null` — cheklov yo'q.
  final int? itemLimit;

  /// Bepul tarifda: Premium olsa nechta bo'ladi.
  final int? premiumItemLimit;
  final bool free;
  final bool premium;
  final bool trialActive;
  final bool canPost;
  final DateTime? trialEndsAt;

  bool get limited => itemLimit != null;

  bool atLimit(int count) => itemLimit != null && count >= itemLimit!;

  factory CompanyPlan.fromJson(Map<String, dynamic> j) => CompanyPlan(
        itemLimit: j['itemLimit'] == null ? null : _i(j['itemLimit']),
        premiumItemLimit:
            j['premiumItemLimit'] == null ? null : _i(j['premiumItemLimit']),
        free: _b(j['free']),
        premium: _b(j['premium']),
        trialActive: _b(j['trialActive']),
        canPost: _b(j['canPost'], true),
        trialEndsAt: DateTime.tryParse(_s(j['trialEndsAt'])),
      );
}

// ═══════════════════════════════════════════════════════════════════
// UMUMIY KATALOG (2026-09, egasining talabi)
//
// Katalog faqat NFC mahsulotlari EMAS — barcha bizneslarning istalgan
// qonuniy mahsuloti yoki xizmati. Har listingda:
//
//   * [ListingKind]     — mahsulot yoki xizmat;
//   * [MarketCategory]  — global kategoriya (dinamik chiplar);
//   * [NfcProductType]  — FAQAT elektronika ichidagi NFC sub-turi
//                         (NFCSTORE kartalari, stikerlari...);
//   * `section`         — biznesning O'Z bo'limi (erkin matn,
//                         "Ichimliklar"); sayt ham shuni ishlatadi.
//
// Server maydonni yubormasa (eski yozuv yoki eski server) tur va
// kategoriya ANIQLANADI. Qoidalar serverdagi `kindOf` /
// `marketCategoryOf` / `subOf` (hosting/api/catalog-feed.js) bilan
// AYNAN bir xil — `test/listing_parity_test.dart` so'z ro'yxatlarini
// ikkala manbadan o'qib solishtiradi.
// ═══════════════════════════════════════════════════════════════════

String _norm(String v) => v
    .trim()
    .toLowerCase()
    .replaceAll(RegExp('[‘’ʻʼ`´]'), "'");

/// NFC mahsulot turi — elektronika ichidagi sub-kategoriya.
enum NfcProductType {
  card,
  sticker,
  keychain,
  accessory,
  other;

  // parity:nfc-words
  static const words = <NfcProductType, List<String>>{
    NfcProductType.card: ['card', 'karta', 'карта', 'kartochka'],
    NfcProductType.sticker: ['sticker', 'stiker', 'стикер', 'наклейка'],
    NfcProductType.keychain: ['keychain', 'brelok', 'брелок'],
    NfcProductType.accessory: ['accessory', 'aksessuar', 'аксессуар', 'bilaguzuk', 'браслет', 'bracelet'],
  };
  // parity:end

  static NfcProductType fromCategory(String category, [String name = '']) {
    final c = _norm(category);
    for (final t in NfcProductType.values) {
      if (c == t.name) return t;
    }
    final hay = '$c ${_norm(name)}';
    for (final e in words.entries) {
      if (e.value.any(hay.contains)) return e.key;
    }
    return NfcProductType.other;
  }

  static NfcProductType? parse(Object? v) {
    final s = _norm('${v ?? ''}');
    for (final t in NfcProductType.values) {
      if (t != NfcProductType.other && t.name == s) return t;
    }
    return null;
  }

  /// NFC sub-turi faqat elektronika ichida — restoran "karta orqali
  /// to'lov" deb yozsa, u NFC karta bo'lib qolmasin.
  static NfcProductType? subOf(MarketCategory m, String section, String name) {
    if (m != MarketCategory.electronics) return null;
    final t = fromCategory(section, name);
    return t == NfcProductType.other ? null : t;
  }
}

/// Listing turi.
enum ListingKind {
  product,
  service;

  // parity:service-words
  static const serviceWords = <String>['xizmat', 'услуг', 'service', 'kurs', 'курс', "ta'mirlash", 'ремонт', 'konsultatsiya', 'консультац', 'massaj', 'массаж', 'soch olish', 'стрижк', 'yetkazib berish', 'доставк', 'dars', 'урок'];
  // parity:end

  // parity:service-companies
  static const serviceCompanies = <String>{'services', 'clinic', 'education'};
  // parity:end

  static ListingKind? parse(Object? v) => switch (_norm('${v ?? ''}')) {
        'product' => ListingKind.product,
        'service' => ListingKind.service,
        _ => null,
      };

  static ListingKind infer(Object? explicit, String companyCategory,
      [String section = '', String name = '']) {
    final e = parse(explicit);
    if (e != null) return e;
    if (serviceCompanies.contains(_norm(companyCategory))) {
      return ListingKind.service;
    }
    final hay = '${_norm(section)} ${_norm(name)}';
    return serviceWords.any(hay.contains)
        ? ListingKind.service
        : ListingKind.product;
  }
}

/// Global katalog kategoriyasi. Tartib — chiplar tartibi.
enum MarketCategory {
  food,
  fashion,
  electronics,
  beauty,
  education,
  health,
  home,
  auto,
  other;

  // parity:market-words
  static const words = <MarketCategory, List<String>>{
    MarketCategory.food: ['taom', 'ovqat', 'palov', "lag'mon", 'somsa', 'shashlik', 'pizza', 'burger', 'lavash', 'kofe', 'coffee', 'ichimlik', 'shirinlik', 'tort', 'salat', "sho'rva", 'еда', 'блюд', 'напит', 'кофе', 'пицц', 'бургер', 'торт', 'десерт', 'food', 'drink', 'meal'],
    MarketCategory.fashion: ['kiyim', "ko'yla", 'shim', 'poyabzal', 'sumka', 'kurtka', 'futbolka', 'libos', 'одежд', 'обув', 'плать', 'сумк', 'куртк', 'fashion', 'dress', 'shoes', 'clothing'],
    MarketCategory.electronics: ['nfc', 'telefon', 'smartfon', 'noutbuk', 'kompyuter', 'quloqchin', 'planshet', 'televizor', 'elektron', 'телефон', 'смартфон', 'ноутбук', 'компьютер', 'наушник', 'электрон', 'phone', 'laptop', 'headphone', 'gadget'],
    MarketCategory.beauty: ['salon', 'soch', 'manikyur', 'pedikyur', 'kosmetika', 'atir', 'parfyum', "go'zallik", 'massaj', 'kiprik', 'makiyaj', 'салон', 'стрижк', 'маникюр', 'космет', 'парфюм', 'массаж', 'beauty', 'cosmetic', 'perfume', 'nail'],
    MarketCategory.education: ['kurs', 'dars', "ta'lim", "o'quv", 'repetitor', 'trening', 'курс', 'урок', 'обучен', 'репетитор', 'тренинг', 'course', 'lesson', 'training', 'tutor'],
    MarketCategory.health: ['klinika', 'shifokor', 'doktor', 'tish', 'stomatolog', 'dori', 'apteka', 'tahlil', 'vitamin', 'клиник', 'врач', 'стомат', 'аптек', 'лекарств', 'анализ', 'clinic', 'doctor', 'dental', 'pharmacy'],
    MarketCategory.home: ['qurilish', "ta'mirlash", 'remont', 'mebel', 'santexnika', "bo'yoq", 'sement', "g'isht", 'deraza', 'строит', 'ремонт', 'мебел', 'сантех', 'краск', 'furniture', 'construction', 'plumbing'],
    MarketCategory.auto: ['avto', 'mashina', 'shina', 'ehtiyot qism', 'автомоб', 'авто', 'шин', 'запчаст', 'car wash', 'tire'],
  };
  // parity:end

  // parity:company-market
  static const byCompany = <String, MarketCategory>{
    'restaurant': MarketCategory.food,
    'cafe': MarketCategory.food,
    'clinic': MarketCategory.health,
    'pharmacy': MarketCategory.health,
    'education': MarketCategory.education,
    'construction': MarketCategory.home,
  };
  // parity:end

  static MarketCategory? parse(Object? v) {
    final s = _norm('${v ?? ''}');
    for (final m in MarketCategory.values) {
      if (m.name == s) return m;
    }
    return null;
  }

  /// Kompaniya sohasi kalit so'zdan USTUN: restoran menyusidagi
  /// "Uy salati" qurilishga tushib qolmasin.
  static MarketCategory infer(Object? explicit, String companyCategory,
      [String section = '', String name = '']) {
    final e = parse(explicit);
    if (e != null) return e;
    if (NfcProductType.parse(section) != null) return MarketCategory.electronics;
    final c = byCompany[_norm(companyCategory)];
    if (c != null) return c;
    if (NfcProductType.fromCategory(section, name) != NfcProductType.other) {
      return MarketCategory.electronics;
    }
    final hay = '${_norm(section)} ${_norm(name)}';
    for (final m in MarketCategory.values) {
      if ((words[m] ?? const []).any(hay.contains)) return m;
    }
    return MarketCategory.other;
  }
}

List<String> _images(Map<String, dynamic> j, String cover) {
  final out = <String>[];
  for (final u in [cover, ...(j['images'] is List ? j['images'] as List : const [])]) {
    final s = _u(u);
    if (s.isNotEmpty && !out.contains(s)) out.add(s);
  }
  return out;
}

/// Tanlov katalogidagi listing — `GET /api/catalog/feed` elementi.
///
/// Kompaniya katalogidagi [CatalogItem] dan farqi: sotuvchi (kompaniya
/// nomi, Business ID, manzil va aloqa) shu yerning o'zida keladi —
/// ro'yxatdagi har kartochka egasini ko'rsatadi, sahifada esa
/// "qo'ng'iroq qilish / yozish" darhol ishlaydi.
class CatalogProduct {
  const CatalogProduct({
    required this.id,
    required this.companyId,
    this.name = '',
    this.description = '',
    this.imageUrl = '',
    this.images = const [],
    this.price = 0,
    this.promotionPrice,
    this.priceOnRequest = false,
    this.priceSoon = false,
    this.available = true,
    this.kind = ListingKind.product,
    this.marketCategory = MarketCategory.other,
    this.sub,
    this.section = '',
    this.companyName = '',
    this.companyLogo = '',
    this.companyTier = '',
    this.companyCity = '',
    this.companyAddress = '',
    this.companyPhone = '',
    this.companyTelegram = '',
    this.companyWhatsapp = '',
    this.companyWebsite = '',
    this.views = 0,
  });

  /// Necha KISHI ko'rgan (server `views`, butun vaqt). Bir kishi bir
  /// marta sanaladi — Reels'dagi ko'rishlar bilan bir xil ma'no.
  final int views;

  /// Server UUID'si.
  final String id;
  final String companyId;
  final String name;
  final String description;
  final String imageUrl;

  /// Barcha rasmlar, birinchisi — muqova ([imageUrl]).
  final List<String> images;
  final int price;
  final int? promotionPrice;

  /// "Narx kelishiladi" — narx ko'rsatilmaydi.
  final bool priceOnRequest;

  /// "Narxi tez kunda" — narx hali e'lon qilinmagan. Server bunday
  /// tovarda [priceOnRequest] ni ham true yuboradi (eski ilova uchun),
  /// shuning uchun yozuv tanlashda bu BIRINCHI tekshiriladi.
  final bool priceSoon;
  final bool available;
  final ListingKind kind;
  final MarketCategory marketCategory;

  /// NFC sub-turi — faqat elektronika ichida, bo'lmasa `null`.
  final NfcProductType? sub;

  /// Biznesning o'z bo'limi ("Ichimliklar").
  final String section;
  final String companyName;
  final String companyLogo;
  final String companyTier;
  final String companyCity;
  final String companyAddress;
  final String companyPhone;
  final String companyTelegram;
  final String companyWhatsapp;
  final String companyWebsite;

  /// Sevimlilar va marshrut uchun kalit — kompaniya + tovar.
  String get key => '$companyId/$id';

  /// Eski nom — NFC sub-turi (bo'lmasa `other`).
  NfcProductType get nfcType => sub ?? NfcProductType.other;

  bool get isService => kind == ListingKind.service;

  bool get hasContact =>
      companyPhone.isNotEmpty ||
      companyTelegram.isNotEmpty ||
      companyWhatsapp.isNotEmpty;

  int get effectivePrice =>
      (promotionPrice != null && promotionPrice! > 0 && promotionPrice! < price)
          ? promotionPrice!
          : price;

  bool get hasDiscount => !priceOnRequest && effectivePrice < price;

  /// Chegirma foizi, butun songa yaxlitlangan (`-15%`).
  int get discountPercent =>
      hasDiscount && price > 0 ? ((1 - effectivePrice / price) * 100).round() : 0;

  factory CatalogProduct.fromJson(Map<String, dynamic> j) {
    final c = (j['company'] is Map)
        ? (j['company'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    final name = _s(j['name']);
    final section = _s(j['section'] ?? j['category']);
    final companyCategory = _s(c['category']);
    final market = MarketCategory.infer(
        j['marketCategory'], companyCategory, section, name);
    final price = _i(j['price']);
    final cover = _u(j['imageUrl']);
    final images = _images(j, cover);
    return CatalogProduct(
      id: _s(j['id']),
      companyId: _s(c['companyId'] ?? j['companyId']),
      name: name,
      description: _s(j['description']),
      imageUrl: images.isEmpty ? '' : images.first,
      images: images,
      price: price,
      promotionPrice:
          j['promotionPrice'] == null ? null : _i(j['promotionPrice']),
      priceOnRequest: _b(j['priceOnRequest']) || price <= 0,
      priceSoon: _b(j['priceSoon']),
      available: _b(j['available'], true),
      kind: ListingKind.infer(j['kind'], companyCategory, section, name),
      marketCategory: market,
      sub: j.containsKey('sub')
          ? NfcProductType.parse(j['sub'])
          : NfcProductType.subOf(market, section, name),
      section: section,
      companyName: _s(c['displayName']),
      companyLogo: _u(c['logoUrl']),
      companyTier: _s(c['tier']),
      companyCity: _s(c['city']),
      companyAddress: _s(c['address']),
      companyPhone: _s(c['phone']),
      companyTelegram: _s(c['telegram']),
      companyWhatsapp: _s(c['whatsapp']),
      companyWebsite: _s(c['website']),
      views: _i(j['views']),
    );
  }

  /// Kompaniya katalogidagi elementdan (chuqur havola, `extra` yo'q).
  factory CatalogProduct.fromItem(CatalogItem i, Business b) => CatalogProduct(
        id: i.key,
        companyId: b.companyId,
        name: i.name,
        description: i.description,
        imageUrl: i.imageUrl,
        images: i.images,
        price: i.price,
        promotionPrice: i.salePrice,
        priceOnRequest: i.priceOnRequest,
        priceSoon: i.priceSoon,
        available: i.available,
        kind: i.kind,
        marketCategory: i.marketCategory,
        sub: i.sub,
        section: i.category,
        companyName: b.displayName,
        companyLogo: b.logoUrl,
        companyCity: b.city,
        companyAddress: b.address,
        companyPhone: b.phone,
        companyTelegram: b.telegram,
        companyWhatsapp: b.whatsapp,
        companyWebsite: b.website,
        views: i.views,
      );
}

/// Katalog saralash tartibi — server `sort` parametri bilan bir xil.
enum CatalogSort {
  newest('new'),

  /// Oxirgi 30 kunda eng ko'p ko'rilgan (server hisoblaydi).
  popular('popular'),
  priceAsc('price_asc'),
  priceDesc('price_desc');

  const CatalogSort(this.wire);
  final String wire;
}

/// Katalogning bitta sahifasi.
class CatalogFeedPage {
  const CatalogFeedPage({
    this.items = const [],
    this.total = 0,
    this.hasMore = false,
    this.counts = const {},
  });

  final List<CatalogProduct> items;
  final int total;
  final bool hasMore;

  /// `all`, `product`, `service`, [MarketCategory] nomlari va NFC
  /// sub-turlari (`card`...). Faqat qidiruv qo'llangan sonlar —
  /// bo'sh kategoriya chipi ko'rsatilmaydi.
  final Map<String, int> counts;

  factory CatalogFeedPage.fromJson(Map<String, dynamic> j) => CatalogFeedPage(
        items: [
          for (final e in (j['items'] as List? ?? const []))
            if (e is Map) CatalogProduct.fromJson(e.cast<String, dynamic>()),
        ],
        total: _i(j['total']),
        hasMore: _b(j['hasMore']),
        counts: {
          if (j['counts'] is Map)
            for (final e in (j['counts'] as Map).entries)
              if (e.value is num) '${e.key}': _i(e.value),
        },
      );
}

/// Katalog elementi — mahsulot yoki xizmat.
class CatalogItem {
  const CatalogItem({
    required this.id,
    this.ref = '',
    this.category = '',
    this.name = '',
    this.description = '',
    this.imageUrl = '',
    this.images = const [],
    this.price = 0,
    this.salePrice,
    this.currency = 'UZS',
    this.available = true,
    this.categoryId,
    this.kind = ListingKind.product,
    this.marketCategory = MarketCategory.other,
    this.sub,
    this.priceOnRequest = false,
    this.priceSoon = false,
    this.views = 0,
  });

  /// Necha kishi ko'rgan (server `views`).
  final int views;

  final int id;

  /// Serverdagi ASL identifikator — satr ko'rinishida.
  ///
  /// Kompaniya katalogida id UUID (`crypto.randomUUID()`), ya'ni
  /// raqam emas: `id` u yerda 0 bo'lib qolardi va tahrirlash/o'chirish
  /// `.../catalog/0` ga ketardi. Kompaniya amallari [key] dan foydalanadi.
  final String ref;

  /// Biznesning O'Z bo'limi — erkin matn ("Ichimliklar"). Sayt ham
  /// shu maydon bo'yicha o'z sahifasida filtr chiqaradi.
  final String category;

  /// Amallar uchun kalit: asl satr id, bo'lmasa raqam.
  String get key => ref.isNotEmpty ? ref : '$id';

  final String name;
  final String description;
  final String imageUrl;
  final List<String> images;
  final int price;
  final int? salePrice;
  final String currency;
  final bool available;
  final int? categoryId;
  final ListingKind kind;
  final MarketCategory marketCategory;
  final NfcProductType? sub;

  /// "Narx kelishiladi" (xizmatlar).
  final bool priceOnRequest;

  /// "Narxi tez kunda" — [CatalogProduct.priceSoon] bilan bir xil ma'no.
  final bool priceSoon;

  bool get isService => kind == ListingKind.service;

  /// Eski nom — NFC sub-turi (bo'lmasa `other`).
  NfcProductType get nfcType => sub ?? NfcProductType.other;

  /// Chegirma bo'lsa u, bo'lmasa oddiy narx.
  int get effectivePrice =>
      (salePrice != null && salePrice! > 0 && salePrice! < price)
          ? salePrice!
          : price;

  bool get hasDiscount => !priceOnRequest && effectivePrice < price;

  /// [companyCategory] — kompaniya sohasi (`restaurant`...). Server
  /// tur/kategoriyani yubormasa, ular shu soha bo'yicha aniqlanadi.
  factory CatalogItem.fromJson(Map<String, dynamic> j,
      {String companyCategory = ''}) {
    final name = _s(j['name'] ?? j['title']);
    final section = _s(j['section'] ?? j['category']);
    final market = MarketCategory.infer(
        j['marketCategory'], companyCategory, section, name);
    final price = _i(j['price']);
    final cover = _u(j['imageUrl'] ?? j['image'] ?? j['photoUrl']);
    final images = _images(j, cover);
    // `type` / `isService` — NFC ID ostidagi eski katalog shakli.
    final explicitKind = j['kind'] ??
        (_b(j['isService']) ? 'service' : j['type']);
    return CatalogItem(
      id: _i(j['id']),
      ref: _s(j['id']),
      category: section,
      name: name,
      description: _s(j['description'] ?? j['desc']),
      imageUrl: images.isEmpty ? '' : images.first,
      images: images,
      price: price,
      // Kompaniya katalogi chegirmani `promotionPrice` deb yuboradi.
      salePrice: (j['salePrice'] ?? j['promotionPrice']) == null
          ? null
          : _i(j['salePrice'] ?? j['promotionPrice']),
      currency: _s(j['currency'], 'UZS'),
      available: _b(j['available'] ?? j['inStock'], true),
      categoryId: j['categoryId'] == null ? null : _i(j['categoryId']),
      kind: ListingKind.infer(explicitKind, companyCategory, section, name),
      marketCategory: market,
      sub: j.containsKey('sub')
          ? NfcProductType.parse(j['sub'])
          : NfcProductType.subOf(market, section, name),
      // Server qoidasi bilan bir xil: bayroq yoki narx 0.
      priceOnRequest: _b(j['priceOnRequest']) || price <= 0,
      priceSoon: _b(j['priceSoon']),
      views: _i(j['views']),
    );
  }
}

class CatalogCategory {
  const CatalogCategory({required this.id, this.name = '', this.count = 0});

  final int id;
  final String name;
  final int count;

  factory CatalogCategory.fromJson(Map<String, dynamic> j) => CatalogCategory(
        id: _i(j['id']),
        name: _s(j['name'] ?? j['title']),
        count: _i(j['count'] ?? j['itemCount']),
      );
}

/// Do'kon mahsuloti — NFC karta va ID paketlari.
/// Ko'p dona narxi (`/api/settings/physical-nfc-pricing` `tiers`).
class PriceTier {
  const PriceTier({required this.minQty, this.maxQty, required this.pricePerUnit});
  final int minQty;

  /// `null` — yuqori chegara yo'q (`50+`).
  final int? maxQty;
  final int pricePerUnit;

  factory PriceTier.fromJson(Map<String, dynamic> j) => PriceTier(
        minQty: _i(j['minQty']),
        maxQty: j['maxQty'] == null ? null : _i(j['maxQty']),
        pricePerUnit: _i(j['pricePerUnit']),
      );
}

/// Taklif qilish natijasi (`GET /api/referrals/summary`).
class ReferralSummary {
  const ReferralSummary({
    this.code = '',
    this.link = '',
    this.invited = 0,
    this.rewardedDays = 0,
    this.nextRewardDays = 30,
  });

  final String code;

  /// `https://nfcstore.uz/i/<code>` — server beradi.
  final String link;
  final int invited;

  /// Taklif uchun olingan Premium kunlari (jami).
  final int rewardedDays;

  /// Keyingi do'st uchun beriladigan kunlar (hozir 30).
  final int nextRewardDays;

  /// Olingan bonus — oylarda (30 kun = 1 oy), yaxlitlangan.
  int get rewardedMonths => (rewardedDays / 30).round();

  factory ReferralSummary.fromJson(Map<String, dynamic> j) => ReferralSummary(
        code: _s(j['code']),
        link: _s(j['link']),
        invited: _i(j['invited']),
        rewardedDays: _i(j['rewardedDays']),
        nextRewardDays: _i(j['nextRewardDays']) > 0 ? _i(j['nextRewardDays']) : 30,
      );
}

/// NFC ID yig'ma tarixi (`/api/records/:code/analytics`).
class CardAnalytics {
  const CardAnalytics({
    this.days = 30,
    this.totalViews = 0,
    this.uniqueVisitors = 0,
    this.byType = const {},
    this.byDay = const [],
    this.byRef = const [],
  });

  final int days;
  final int totalViews;
  final int uniqueVisitors;

  /// Hodisa turi (`phone_click`, `contact_save`...) -> soni.
  final Map<String, int> byType;

  /// `YYYY-MM-DD` -> profil ko'rishlari (eski kun birinchi).
  final List<({String day, int n})> byDay;

  /// Manba (`ref`) -> soni.
  final List<({String ref, int n})> byRef;

  bool get isEmpty =>
      totalViews == 0 && byType.values.every((n) => n == 0) && byDay.isEmpty;

  factory CardAnalytics.fromJson(Map<String, dynamic> j) {
    final types = <String, int>{};
    final bt = j['byType'];
    if (bt is Map) {
      bt.forEach((k, v) {
        final n = _i(v);
        if (n > 0) types['$k'] = n;
      });
    }
    return CardAnalytics(
      days: _i(j['days']) > 0 ? _i(j['days']) : 30,
      totalViews: _i(j['totalViews']),
      uniqueVisitors: _i(j['uniqueVisitors']),
      byType: types,
      byDay: [
        for (final e in _list(j['byDay']))
          if (_s(e['day']).isNotEmpty) (day: _s(e['day']), n: _i(e['n'])),
      ],
      byRef: [
        for (final e in _list(j['byRef']))
          if (_s(e['ref']).isNotEmpty) (ref: _s(e['ref']), n: _i(e['n'])),
      ],
    );
  }
}

/// Jismoniy NFC karta mahsulotining identifikatori — server alohida
/// mahsulot ro'yxati bermaydi, mahsulot narx javobidan quriladi.
const kPhysicalCardId = 'nfc-card';

class ShopProduct {
  const ShopProduct({
    required this.id,
    this.priceTiers = const [],
    this.deliveryMinDays,
    this.deliveryMaxDays,
    this.name = '',
    this.description = '',
    this.imageUrl = '',
    this.price = 0,
    this.oldPrice,
    this.currency = 'UZS',
    this.category = '',
    this.inStock = true,
    this.tier = '',
  });

  final String id;
  final String name;
  final String description;
  final String imageUrl;
  final int price;
  final int? oldPrice;
  final String currency;
  final String category;
  final bool inStock;

  /// ID uzunligi darajasi (backend `tier`) — narx shundan kelib chiqadi.
  final String tier;

  /// Ko'p dona narxlari (jismoniy karta, kompaniyalar uchun).
  final List<PriceTier> priceTiers;
  final int? deliveryMinDays;
  final int? deliveryMaxDays;

  bool get isPhysicalCard => id == kPhysicalCardId;

  bool get hasDiscount => oldPrice != null && oldPrice! > price;

  factory ShopProduct.fromJson(Map<String, dynamic> j) => ShopProduct(
        id: _s(j['id'] ?? j['code'] ?? j['sku']),
        name: _s(j['name'] ?? j['title']),
        description: _s(j['description']),
        imageUrl: _u(j['imageUrl'] ?? j['image']),
        price: _i(j['price']),
        oldPrice: j['oldPrice'] == null ? null : _i(j['oldPrice']),
        currency: _s(j['currency'], 'UZS'),
        category: _s(j['category']),
        inStock: _b(j['inStock'] ?? j['available'], true),
        tier: _s(j['tier']),
      );
}

class Order {
  const Order({
    required this.id,
    this.status = 'new',
    this.total = 0,
    this.currency = 'UZS',
    this.createdAt,
    this.itemsText = '',
    this.paymentProvider = '',
    this.code = '',
    this.kind = '',
    this.paymeLink = '',
    this.clickLink = '',
  });

  final int id;
  final String status;
  final int total;
  final String currency;
  final DateTime? createdAt;
  final String itemsText;
  final String paymentProvider;

  /// Buyurtma qaysi NFC ID uchun (`web_orders.code`).
  final String code;

  /// `card_purchase` | `auction_payment` | `premium_upgrade` | ...
  final String kind;

  /// Kutilayotgan buyurtmani DAVOM ETTIRISH havolalari. Server ularni
  /// faqat `status == 'pending'` uchun beradi.
  final String paymeLink;
  final String clickLink;

  bool get pending => status == 'pending';

  /// SUMMA `price` MAYDONIDAN.
  ///
  /// Server `GET /api/orders` javobida summani `price` deb yuboradi
  /// (`hosting/worker.js` -> `web_orders`). Bu yerda esa faqat
  /// `total`/`amount` o'qilardi — ya'ni ikkalasi ham yo'q edi va
  /// "To'lovlar" ekrani HAR BIR buyurtma uchun 0 so'm ko'rsatardi.
  /// Kod va tur ham javobda bor edi, lekin tashlab yuborilardi.
  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: _i(j['id']),
        status: _s(j['status'], 'new'),
        total: _i(j['price'] ?? j['total'] ?? j['amount']),
        currency: _s(j['currency'], 'UZS'),
        createdAt: _dt(j['createdAt'] ?? j['created_at']),
        itemsText: _s(j['items'] ?? j['title']),
        paymentProvider: _s(j['provider'] ?? j['paymentProvider']),
        code: _s(j['code']).toUpperCase(),
        kind: _s(j['kind']),
        paymeLink: _s((j['payLinks'] as Map?)?['payme'] ?? j['payLink']),
        clickLink: _s((j['payLinks'] as Map?)?['click']),
      );
}

class Post {
  const Post({
    required this.id,
    this.code = '',
    this.authorName = '',
    this.authorAvatar = '',
    this.text = '',
    this.mediaUrls = const [],
    this.likes = 0,
    this.comments = 0,
    this.liked = false,
    this.saved = false,
    this.createdAt,
    this.isVideo = false,
    this.kind = 'post',
    this.authorKind = 'card',
    this.featured = false,
    this.music,
    this.reel = false,
    this.imageSeconds = 10,
    this.views = 0,
  });

  final int id;

  /// Necha KISHI ko'rgan (server `viewCount`, Instagram'dagi
  /// "ko'rishlar"). Bir odam bir marta sanaladi, egasi sanalmaydi.
  final int views;

  /// Postga qo'yilgan musiqa (NFCSTORE kutubxonasidan) — bo'lmasa `null`.
  final MusicTrack? music;

  /// Rasmli reel: rasm Reels'da ham chiqadi va [imageSeconds] soniya
  /// turadi (egasi: "reelsga rasm ham qo'yilsin, default 10 sekund").
  final bool reel;
  final int imageSeconds;

  /// Reels'da ko'rsatiladimi: video yoki rasmli reel.
  bool get inReels => isVideo || reel;

  /// Muallifning NFC ID kodi — profilga o'tish uchun.
  final String code;
  final String authorName;
  final String authorAvatar;
  final String text;
  final List<String> mediaUrls;
  final int likes;
  final int comments;
  final bool liked;
  final bool saved;
  final DateTime? createdAt;
  final bool isVideo;

  /// `post` yoki `story` — `/api/feed` ikkalasini birga beradi.
  final String kind;

  /// `card` (shaxsiy) yoki `company` (biznes).
  final String authorKind;

  /// NFCSTORE FEATURED — pul evaziga ko'tarilgan kontent.
  ///
  /// Server buni `/api/feed` ning BIRINCHI sahifasida qaytaradi.
  /// Ilova uchun bu faqat BELGI: qator boshqa manbadan kelmaydi,
  /// shakli oddiy qator bilan aynan bir xil. Shuning uchun uni
  /// o'qishga alohida model ham, alohida so'rov ham kerak emas.
  ///
  /// Ko'rsatilishi SHART: to'langan joylashuv belgisiz qolsa, bu
  /// yashirin reklama bo'lardi.
  final bool featured;

  /// Lentadagi `id` lar manbalar bo'yicha ALOHIDA sanaladi:
  /// 5-raqamli shaxsiy post va 5-raqamli kompaniya posti ikki xil
  /// narsa. Shuning uchun tafsilotga o'tishda tur bilinishi shart.
  bool get isStory => kind == 'story';
  bool get isCompany => authorKind == 'company';

  /// Manba turini belgilaydi.
  ///
  /// Kompaniya postlari `/api/companies/:id/posts` dan keladi va u
  /// yerda `authorKind` maydoni YO'Q — lekin tafsilotga o'tishda
  /// shaxsiy postdan ajratish SHART, chunki `id` lar alohida
  /// sanaladi.
  Post copyWithKind({String? kind, String? authorKind}) => Post(
        id: id,
        code: code,
        authorName: authorName,
        authorAvatar: authorAvatar,
        text: text,
        mediaUrls: mediaUrls,
        likes: likes,
        comments: comments,
        liked: liked,
        saved: saved,
        createdAt: createdAt,
        isVideo: isVideo,
        kind: kind ?? this.kind,
        authorKind: authorKind ?? this.authorKind,
        featured: featured,
        music: music,
        reel: reel,
        imageSeconds: imageSeconds,
        views: views,
      );

  Post copyWith({int? likes, bool? liked, bool? saved, int? comments, int? views}) => Post(
        id: id,
        code: code,
        authorName: authorName,
        authorAvatar: authorAvatar,
        text: text,
        mediaUrls: mediaUrls,
        likes: likes ?? this.likes,
        comments: comments ?? this.comments,
        liked: liked ?? this.liked,
        saved: saved ?? this.saved,
        createdAt: createdAt,
        isVideo: isVideo,
        kind: kind,
        authorKind: authorKind,
        // Belgi SAQLANADI: `copyWith` like/izoh sonini yangilaydi,
        // va u yo'qolsa odam like bosgan zahoti "Homiylik" yozuvi
        // o'chib ketardi — ya'ni to'langan joylashuv yashirinardi.
        featured: featured,
        music: music,
        reel: reel,
        imageSeconds: imageSeconds,
        views: views ?? this.views,
      );

  factory Post.fromJson(Map<String, dynamic> j) {
    final media = <String>[];
    final raw = j['media'] ?? j['images'] ?? j['mediaUrls'];
    if (raw is List) {
      for (final e in raw) {
        if (e is String && e.isNotEmpty) media.add(mediaUrl(e));
        if (e is Map && e['url'] != null) media.add(_u(e['url']));
      }
    }
    // BO'SH SATR — `null` EMAS.
    //
    // Server video post uchun `{"imageUrl": "", "videoUrl":
    // "/uploads/cardvid_....mp4"}` qaytaradi. Ilgari bu yerda
    //
    //     j['imageUrl'] ?? j['videoUrl'] ?? j['url']
    //
    // turardi. `??` FAQAT `null` da keyingisiga o'tadi, bo'sh
    // satrda esa o'tmaydi — shuning uchun `videoUrl` ga HECH
    // QACHON yetib borilmasdi va video postda `mediaUrls` bo'sh
    // qolardi.
    //
    // Oqibati ikkita edi va ikkalasi ham telefonda ko'rindi:
    // Reels filtri `isVideo && mediaUrls.isNotEmpty` ga qaraydi,
    // shuning uchun bo'lim "Hozircha reels yo'q" deb turardi; profil
    // panjarasi esa `mediaUrls.isEmpty` shoxiga tushib, video
    // o'rniga MATN katakchasini chizardi.
    //
    // `StoryItem.fromJson` buni allaqachon to'g'ri qilardi — aynan
    // shuning uchun video ISTORYA ishlab, video POST ishlamasdi.
    final single = _u([j['imageUrl'], j['videoUrl'], j['url']]
        .map(_s)
        .firstWhere((e) => e.isNotEmpty, orElse: () => ''));
    if (media.isEmpty && single.isNotEmpty) media.add(single);
    return Post(
      id: _i(j['id']),
      code: _s(j['code'] ?? j['recordCode'] ?? j['authorCode']),
      authorName: _s(j['authorName'] ?? j['name']),
      authorAvatar: _u(j['authorAvatar'] ?? j['avatarUrl']),
      text: _s(j['text'] ?? j['caption'] ?? j['body']),
      mediaUrls: media,
      likes: _i(j['likes'] ?? j['likeCount']),
      comments: _i(j['comments'] ?? j['commentCount']),
      liked: _b(j['liked'] ?? j['isLiked']),
      saved: _b(j['saved'] ?? j['isSaved']),
      createdAt: _dt(j['createdAt'] ?? j['created_at']),
      featured: _b(j['featured']),
      isVideo: _b(j['isVideo']) ||
          _s(j['videoUrl']).isNotEmpty ||
          _s(j['type']) == 'video' ||
          _s(j['type']) == 'reel',
      kind: _s(j['kind'], 'post'),
      authorKind: _s(j['authorKind'], 'card'),
      music: j['music'] is Map
          ? MusicTrack.fromJson((j['music'] as Map).cast<String, dynamic>())
          : null,
      reel: _b(j['reel']),
      imageSeconds: _i(j['imageSeconds'], 10).clamp(3, 60),
      views: _i(j['viewCount'] ?? j['views']),
    );
  }
}

/// NFCSTORE musiqa kutubxonasidagi trek (`GET /api/music`) yoki postga
/// qo'yilgan musiqa (`post.music`, u yerda [start] ham bor).
class MusicTrack {
  const MusicTrack({
    required this.id,
    this.title = '',
    this.artist = '',
    this.genre = '',
    this.durationSec = 0,
    this.audioUrl = '',
    this.clipUrl = '',
    this.start = 0,
    this.uses = 0,
  });

  final int id;
  final String title;
  final String artist;
  final String genre;
  final int durationSec;
  final String audioUrl;

  /// 30 soniyalik eng yaxshi bo'lak — tinglash va postda shu o'ynaydi.
  final String clipUrl;

  /// To'liq trekda boshlanish nuqtasi (soniya).
  final int start;
  final int uses;

  /// Postda o'ynaladigan manba: boshlanish nuqtasi tanlanmagan bo'lsa —
  /// 30 soniyalik eng yaxshi bo'lak, aks holda to'liq trek.
  String get playUrl => start == 0 && clipUrl.isNotEmpty ? clipUrl : audioUrl;

  /// Qaysi joydan boshlanadi ([playUrl] ga nisbatan).
  Duration get playFrom =>
      start == 0 && clipUrl.isNotEmpty ? Duration.zero : Duration(seconds: start);

  String get label => artist.isEmpty ? title : '$title · $artist';

  factory MusicTrack.fromJson(Map<String, dynamic> j) => MusicTrack(
        id: _i(j['id']),
        title: _s(j['title']),
        artist: _s(j['artist']),
        genre: _s(j['genre']),
        durationSec: _i(j['durationSec']),
        audioUrl: _u(j['audioUrl']),
        clipUrl: _u(j['clipUrl']),
        start: _i(j['start']),
        uses: _i(j['uses']),
      );
}

class StoryItem {
  const StoryItem({
    required this.id,
    this.code = '',
    this.authorName = '',
    this.authorAvatar = '',
    this.mediaUrl = '',
    this.isVideo = false,
    this.caption = '',
    this.seen = false,
    this.createdAt,
    this.likes = 0,
    this.liked = false,
    this.viewCount = 0,
  });

  final int id;
  final String code;
  final String authorName;
  final String authorAvatar;
  final String mediaUrl;
  final bool isVideo;

  /// Istorya izohi. Server buni HAR DOIM qaytaradi
  /// (`caption: r.caption || ''`), model esa tashlab yuborardi —
  /// shuning uchun ekranda hech qachon ko'rinmasdi.
  final String caption;
  final bool seen;
  final DateTime? createdAt;

  /// LAYKLAR. Server `listStoriesD1` va `/api/stories/feed` da
  /// `likeCount` va `liked` ni HAR DOIM qaytaradi (yuqoridagi
  /// izohda ham shunday yozilgan), lekin model ularni TASHLAB
  /// YUBORARDI — xuddi `caption` kabi. Natijada istorya ostida
  /// layk soni ko'rsatilmasdi va "men bosganmanmi" degani ham
  /// bilinmasdi.
  final int likes;
  final bool liked;

  /// NECHA MARTA KO'RILGAN. Server `listStoriesD1` da `viewCount` ni
  /// HAR DOIM qaytaradi, model esa tashlab yuborardi — egasi o'z
  /// istoryasini kim ko'rganini bilolmasdi (Instagram'dagi ko'z
  /// belgisi). Faqat EGASIGA ko'rsatiladi; "men ko'rdimmi" (`seen`)
  /// bilan aralashtirilmaydi — pastdagi izohga qarang.
  final int viewCount;

  StoryItem copyWith({int? likes, bool? liked, bool? seen}) => StoryItem(
        id: id,
        code: code,
        authorName: authorName,
        authorAvatar: authorAvatar,
        mediaUrl: mediaUrl,
        isVideo: isVideo,
        caption: caption,
        seen: seen ?? this.seen,
        createdAt: createdAt,
        likes: likes ?? this.likes,
        liked: liked ?? this.liked,
        viewCount: viewCount,
      );

  /// `listStoriesD1` quyidagini qaytaradi:
  ///
  ///     { id, imageUrl, videoUrl, caption, createdAt, expiresAt,
  ///       likeCount, liked, viewCount }
  ///
  /// Ya'ni media IKKI alohida maydonda va qaysi biri to'lganidan
  /// video ekani bilinadi — `type` degan maydon umuman yo'q.
  /// Ilgari bu yerda faqat `mediaUrl`/`url` o'qilardi va video
  /// istoryalar bo'sh chiqardi.
  ///
  /// `seen` — serverda `viewCount` bor, lekin u BARCHA ko'rishlarni
  /// sanaydi, "men ko'rdimmi" degani emas. Shuning uchun ko'rilgan
  /// holati faqat server aniq `seen`/`viewed` bergan joyda
  /// ishonchli; aks holda `false` bo'lib qoladi va halqa "yangi"
  /// ko'rinadi. To'qib chiqarilmaydi.
  factory StoryItem.fromJson(Map<String, dynamic> j) {
    final video = _u(j['videoUrl']);
    final image = _u(j['imageUrl']);
    return StoryItem(
      id: _i(j['id']),
      code: _s(j['code'] ?? j['recordCode'] ?? j['ownerId']),
      authorName: _s(j['authorName'] ?? j['name']),
      authorAvatar: _u(j['authorAvatar'] ?? j['avatarUrl']),
      mediaUrl: video.isNotEmpty
          ? video
          : (image.isNotEmpty ? image : _u(j['mediaUrl'] ?? j['url'])),
      isVideo: video.isNotEmpty ||
          _b(j['isVideo']) ||
          _s(j['type']) == 'video',
      caption: _s(j['caption']),
      seen: _b(j['seen'] ?? j['viewed']),
      // `Post` dagidek ikkala yozuv ham o'qiladi: sarlavhadagi "3 soat
      // oldin" shu sanadan hisoblanadi va u bo'lmasa vaqt chizilmaydi.
      createdAt: _dt(j['createdAt'] ?? j['created_at']),
      likes: _i(j['likeCount'] ?? j['likes']),
      liked: _b(j['liked'] ?? j['isLiked']),
      viewCount: _i(j['viewCount'] ?? j['views']),
    );
  }
}

/// NFC ID sovg'a taklifi — `/api/gift-offers`.
class GiftOffer {
  const GiftOffer({
    required this.id,
    required this.code,
    required this.incoming,
    this.email = '',
    this.createdAt,
  });

  final int id;

  /// Sovg'a qilinayotgan NFC ID.
  final String code;

  /// `true` — menga kelgan, `false` — men yuborgan.
  final bool incoming;

  /// Kelganda yuboruvchining, yuborilganda qabul qiluvchining emaili.
  final String email;

  final DateTime? createdAt;

  factory GiftOffer.fromJson(Map<String, dynamic> j,
          {required bool incoming}) =>
      GiftOffer(
        id: _i(j['id']),
        code: _s(j['code']),
        incoming: incoming,
        email: _s(incoming ? j['fromEmail'] : j['toEmail']),
        createdAt: _dt(j['createdAt']),
      );
}

class Comment {
  const Comment({
    required this.id,
    this.code = '',
    this.authorName = '',
    this.authorAvatar = '',
    this.text = '',
    this.mine = false,
    this.createdAt,
    this.parentId = 0,
    this.likes = 0,
    this.liked = false,
  });

  final int id;

  /// Muallifning NFC kodi — profiliga o'tish uchun.
  final String code;
  final String authorName;
  final String authorAvatar;
  final String text;

  /// O'chirish tugmasi shu bayroqqa qarab ko'rsatiladi. Huquqni
  /// BARIBIR server tekshiradi — bu faqat ko'rinish uchun.
  final bool mine;

  final DateTime? createdAt;

  /// Javob bo'lsa — ota izoh ID'si, aks holda 0. Server bir
  /// qavatdan chuqur javobga ruxsat bermaydi.
  final int parentId;

  /// Izohga qo'yilgan like'lar soni va ko'rayotgan odamning holati.
  final int likes;
  final bool liked;

  bool get isReply => parentId > 0;

  Comment copyWith({int? likes, bool? liked}) => Comment(
        id: id,
        code: code,
        authorName: authorName,
        authorAvatar: authorAvatar,
        text: text,
        mine: mine,
        createdAt: createdAt,
        parentId: parentId,
        likes: likes ?? this.likes,
        liked: liked ?? this.liked,
      );

  factory Comment.fromJson(Map<String, dynamic> j) => Comment(
        id: _i(j['id']),
        code: _s(j['code']),
        authorName: _s(j['authorName'] ?? j['name']),
        authorAvatar: _u(j['authorAvatar'] ?? j['avatarUrl']),
        text: _s(j['text'] ?? j['body']),
        mine: _b(j['mine']),
        createdAt: _dt(j['createdAt']),
        parentId: _i(j['parentId']),
        likes: _i(j['likes']),
        liked: _b(j['liked']),
      );
}

/// `support` — qo'llab-quvvatlash javobi (`support_reply`): yuboruvchi
/// tizim, ya'ni ismi ham avatari ham bo'sh keladi.
enum ActivityKind {
  like,
  follow,
  comment,
  scan,
  order,
  payment,
  system,
  security,
  business,
  support,

  /// Bepul sinov muddati tugashi haqida eslatma (`trial_ending`).
  /// `targetId` — tugash sanasi, `YYYY-MM-DD`.
  trial,

  /// Do'st taklif bilan qo'shildi — +1 oy Premium (`referral_reward`).
  /// Aktyor — do'st (`title` — uning ismi).
  referral,
}

class ActivityEvent {
  const ActivityEvent({
    required this.id,
    required this.kind,
    this.title = '',
    this.subtitle = '',
    this.avatarUrl = '',
    this.read = false,
    this.createdAt,
    this.targetCode = '',
    this.actorCode = '',
    this.targetType = '',
    this.targetId = '',
    this.contentKind = '',
    this.contentId = '',
  });

  final int id;
  final ActivityKind kind;
  final String title;
  final String subtitle;
  final String avatarUrl;
  final bool read;
  final DateTime? createdAt;
  final String targetCode;

  /// Harakatni qilgan odamning NFC kodi — obunada aynan shu profilga
  /// o'tiladi.
  final String actorCode;

  /// Nishon turi va ID'si: `post`, `comment`, `user`. Server bermasa
  /// bo'sh qoladi va ekran hech qayerga o'tmaydi.
  final String targetType;
  final String targetId;

  /// Layk yoki izoh QAYSI kontentga tegishli: `post`, `company_post`,
  /// `story`, `company_story` va uning ID'si. Bildirishnoma bosilganda
  /// aynan o'sha post/Reels ochiladi (egasi, 2026-10-05: "izohni
  /// bossam 'topilmadi', laykni bossam o'z profilimga o'tyapti").
  /// Eski server bermasa bo'sh.
  final String contentKind;
  final String contentId;

  factory ActivityEvent.fromJson(Map<String, dynamic> j) => ActivityEvent(
        id: _i(j['id']),
        kind: switch (_s(j['type'] ?? j['kind'])) {
          'like' => ActivityKind.like,
          'follow' => ActivityKind.follow,
          'comment' => ActivityKind.comment,
          'scan' || 'tap' || 'view' => ActivityKind.scan,
          'order' => ActivityKind.order,
          'payment' => ActivityKind.payment,
          'security' => ActivityKind.security,
          'business' || 'company' => ActivityKind.business,
          'support_reply' => ActivityKind.support,
          'trial_ending' => ActivityKind.trial,
          'referral_reward' => ActivityKind.referral,
          _ => ActivityKind.system,
        },
        title: _s(j['title'] ?? j['text']),
        subtitle: _s(j['subtitle'] ?? j['detail']),
        avatarUrl: _u(j['avatarUrl'] ?? j['avatar']),
        read: _b(j['read'] ?? j['isRead']),
        createdAt: _dt(j['createdAt'] ?? j['created_at']),
        targetCode: _s(j['code'] ?? j['targetCode']),
        actorCode: _s(j['actorCode']),
        targetType: _s(j['targetType']),
        targetId: _s(j['targetId']),
        contentKind: _s(j['contentKind']),
        contentId: _s(j['contentId']),
      );
}

/// BILDIRISHNOMALAR SAHIFASI — `GET /api/notifications` javobi.
///
/// Kursor bilan: `nextCursor` oxirgi ko'rilgan ID. Offset ishlatilmadi
/// — yangi bildirishnoma kelganda offset sahifalarni surib yuborardi
/// va bitta yozuv ikki marta ko'rinardi.
class NotificationPage {
  const NotificationPage({
    this.items = const [],
    this.unreadCount = 0,
    this.nextCursor,
  });

  final List<ActivityEvent> items;
  final int unreadCount;
  final int? nextCursor;

  bool get hasMore => nextCursor != null;

  factory NotificationPage.fromJson(Map<String, dynamic> j) => NotificationPage(
        items: parseList(j['items'], ActivityEvent.fromJson),
        unreadCount: _i(j['unreadCount']),
        nextCursor: (j['nextCursor'] as num?)?.toInt(),
      );
}

/// Murojaat holati — `GET /api/support` dagi `status`.
enum SupportStatus { pending, replied, resolved, planned }

/// QO'LLAB-QUVVATLASHGA MUROJAAT VA UNGA JAVOB.
///
/// Ilgari ilova faqat yuborardi: javob saytdagi admin panelda
/// yozilar, odam esa uni hech qayerda ko'rmasdi. Endi Yordam
/// ekranida o'z murojaatlari va javoblar turadi.
///
/// Noma'lum holat — `pending`: server yangi holat qo'shsa ham ekran
/// yiqilmaydi, faqat "Kutilmoqda" ko'rinadi.
class SupportMessage {
  const SupportMessage({
    required this.id,
    this.message = '',
    this.reply,
    this.status = SupportStatus.pending,
    this.createdAt,
    this.repliedAt,
  });

  final int id;
  final String message;

  /// Javob yo'q bo'lsa `null` (bo'sh satr ham `null` ga aylanadi).
  final String? reply;
  final SupportStatus status;
  final DateTime? createdAt;
  final DateTime? repliedAt;

  bool get hasReply => reply != null;

  factory SupportMessage.fromJson(Map<String, dynamic> j) {
    final reply = _s(j['reply']).trim();
    return SupportMessage(
      id: _i(j['id']),
      message: _s(j['message']),
      reply: reply.isEmpty ? null : reply,
      status: switch (_s(j['status']).toLowerCase()) {
        'replied' => SupportStatus.replied,
        'resolved' => SupportStatus.resolved,
        'planned' => SupportStatus.planned,
        _ => SupportStatus.pending,
      },
      createdAt: _utcDt(j['createdAt'] ?? j['created_at']),
      repliedAt: _utcDt(j['repliedAt'] ?? j['replied_at']),
    );
  }
}

/// SQLite vaqti (`2026-10-06 05:11:00`) — zonasiz, lekin UTC.
///
/// `DateTime.tryParse` zonasiz satrni TELEFON vaqti deb oladi va
/// Toshkentda murojaat "5 soat oldin" yozilgandek ko'rinardi. Shuning
/// uchun zona belgisi bo'lmasa `Z` qo'shiladi. ISO va raqam — [_dt].
DateTime? _utcDt(dynamic v) {
  if (v is String) {
    final t = v.trim();
    final zoned = RegExp(r'(Z|[+-]\d{2}:?\d{2})$').hasMatch(t);
    if (!zoned && RegExp(r'^\d{4}-\d{2}-\d{2}[ T]\d').hasMatch(t)) {
      return DateTime.tryParse('${t.replaceFirst(' ', 'T')}Z');
    }
  }
  return _dt(v);
}

/// `fromJson` uchun ro'yxat yordamchisi — repository'larda takrorlanmasin.
List<T> parseList<T>(dynamic raw, T Function(Map<String, dynamic>) f) =>
    _list(raw is Map ? (raw['items'] ?? raw['data'] ?? raw['rows']) : raw)
        .map(f)
        .toList();

/// NFCSTORE FEATURED — pullik ko'tarilgan slot.
///
/// Ilova bu modelni FAQAT boshqaruv uchun ishlatadi ("mening
/// slotlarim", narx tanlash, holat). Ko'tarilgan KONTENTNING O'ZI
/// oddiy lenta qatori bo'lib keladi (`Post.featured`), ya'ni uni
/// ko'rsatish uchun bu model kerak emas.
class FeaturedSlot {
  const FeaturedSlot({
    required this.id,
    this.targetKind = 'post',
    this.targetId = 0,
    this.code = '',
    this.days = 0,
    this.price = 0,
    this.status = 'pending',
    this.startsAt,
    this.endsAt,
  });

  final int id;
  final String targetKind;
  final int targetId;
  final String code;
  final int days;
  final int price;

  /// `pending` | `active` | `expired` | `cancelled` | `stopped`.
  final String status;
  final DateTime? startsAt;
  final DateTime? endsAt;

  bool get isPending => status == 'pending';
  bool get isActive => status == 'active';

  /// Faol slotdan necha kun qolgani.
  ///
  /// Tugagan bo'lsa 0 — manfiy son ko'rsatilmaydi.
  int get daysLeft {
    final end = endsAt;
    if (end == null) return 0;
    final left = end.difference(DateTime.now()).inHours / 24;
    return left <= 0 ? 0 : left.ceil();
  }

  factory FeaturedSlot.fromJson(Map<String, dynamic> j) => FeaturedSlot(
        id: _i(j['id']),
        targetKind: _s(j['targetKind']),
        targetId: _i(j['targetId']),
        code: _s(j['code']),
        days: _i(j['days']),
        price: _i(j['price']),
        status: _s(j['status']),
        startsAt: _dt(j['startsAt']),
        endsAt: _dt(j['endsAt']),
      );
}

/// Sotuvdagi FEATURED paketi — kun soni va narxi.
///
/// NARX SERVERDAN KELADI va ilova uni HECH QACHON o'zi
/// hisoblamaydi: so'rovda faqat `days` yuboriladi. Aks holda
/// so'rovni qo'lda yuborgan odam 6 kunlik slotni 1 so'mga olardi.
class FeaturedPackage {
  const FeaturedPackage({required this.days, required this.price});

  final int days;
  final int price;

  factory FeaturedPackage.fromJson(Map<String, dynamic> j) =>
      FeaturedPackage(days: _i(j['days']), price: _i(j['price']));
}

// ─────────────────────────────────────────────────────────────────
// SHAXSIY NFC ID XARIDI
//
// Uchala model ham SERVER javobining shakli — ilovada hech qanday
// narx, daraja nomi yoki kod ro'yxati yozilmagan.
// ─────────────────────────────────────────────────────────────────

/// `GET /api/settings/id-pricing` dagi bitta daraja.
class IdTier {
  const IdTier({required this.tier, this.price, this.from = false});

  /// `free` | `silver` | `gold` | `premium` | `exclusive`
  final String tier;

  /// So'mda. `null` — sotuvda emas.
  final int? price;

  /// `true` bo'lsa summa "shundan boshlanadi" (aniq narx kodga bog'liq).
  final bool from;

  factory IdTier.fromJson(Map<String, dynamic> j) => IdTier(
        tier: _s(j['tier']),
        price: j['price'] == null ? null : _i(j['price']),
        from: j['from'] == true,
      );
}

/// `GET /api/records/:code/quote` javobi.
class IdQuote {
  const IdQuote({
    required this.code,
    this.taken = false,
    this.purchasable = false,
    this.reason = '',
    this.tier = '',
    this.amount = 0,
  });

  final String code;

  /// Kodning egasi bor.
  final bool taken;

  /// Hozir sotib olsa bo'ladimi.
  final bool purchasable;

  /// `already_taken` | `reserved_pending_payment` | `not_purchasable` | ''
  final String reason;
  final String tier;
  final int amount;

  /// Boshqa odam band qilib, hali to'lamagan.
  bool get reserved => reason == 'reserved_pending_payment';

  factory IdQuote.fromJson(Map<String, dynamic> j) => IdQuote(
        code: _s(j['code']).toUpperCase(),
        taken: j['taken'] == true,
        purchasable: j['purchasable'] == true,
        reason: _s(j['reason']),
        tier: _s(j['tier']),
        amount: _i(j['amount']),
      );
}

/// `POST /api/records/:code` javobi — yaratilgan kutilayotgan buyurtma.
class IdOrderDraft {
  const IdOrderDraft({
    required this.orderId,
    required this.code,
    required this.price,
    this.paymeLink = '',
    this.clickLink = '',
  });

  final int orderId;
  final String code;

  /// SERVER hisoblagan summa — ekranda aynan shu ko'rsatiladi.
  final int price;
  final String paymeLink;
  final String clickLink;

  factory IdOrderDraft.fromJson(Map<String, dynamic> j) => IdOrderDraft(
        orderId: _i(j['orderId']),
        code: _s(j['code']).toUpperCase(),
        price: _i(j['price']),
        paymeLink: _s((j['payLinks'] as Map?)?['payme'] ?? j['payLink']),
        clickLink: _s((j['payLinks'] as Map?)?['click']),
      );
}

/// Sozlamalar → Analitika (`GET /api/my/analytics`).
///
/// Hammasi foydalanuvchining O'Z kartalari va kompaniyalari bo'yicha.
/// Profil raqamlari oxirgi [days] kun uchun, [profileTotalViews] esa
/// kartalardagi umumiy (butun vaqt) ko'rishlar.
class MyAnalytics {
  const MyAnalytics({
    this.days = 30,
    this.profileViews = 0,
    this.uniqueVisitors = 0,
    this.clicks = 0,
    this.profileTotalViews = 0,
    this.followers = 0,
    this.posts = 0,
    this.contentViews = 0,
    this.likes = 0,
    this.comments = 0,
    this.byDay = const [],
    this.top = const [],
  });

  final int days;
  final int profileViews;
  final int uniqueVisitors;
  final int clicks;
  final int profileTotalViews;
  final int followers;
  final int posts;
  final int contentViews;
  final int likes;
  final int comments;

  /// Kontent ko'rishlari kunlar bo'yicha (`YYYY-MM-DD`, son).
  final List<({String day, int views})> byDay;
  final List<TopContent> top;

  factory MyAnalytics.fromJson(Map<String, dynamic> j) {
    Map<String, dynamic> m(dynamic v) =>
        v is Map ? v.cast<String, dynamic>() : const {};
    final profile = m(j['profile']);
    final content = m(j['content']);
    final days = j['byDay'] is List ? j['byDay'] as List : const [];
    final top = j['top'] is List ? j['top'] as List : const [];
    return MyAnalytics(
      days: _i(j['days'], 30),
      profileViews: _i(profile['views']),
      uniqueVisitors: _i(profile['uniqueVisitors']),
      clicks: _i(profile['clicks']),
      profileTotalViews: _i(profile['totalViews']),
      followers: _i(j['followers']),
      posts: _i(content['posts']),
      contentViews: _i(content['views']),
      likes: _i(content['likes']),
      comments: _i(content['comments']),
      byDay: [
        for (final d in days)
          if (d is Map) (day: _s(d['day']), views: _i(d['views'])),
      ],
      top: [
        for (final t in top)
          if (t is Map) TopContent.fromJson(t.cast<String, dynamic>()),
      ],
    );
  }
}

/// Analitikadagi bitta post/Reels qatori.
class TopContent {
  const TopContent({
    required this.id,
    this.kind = 'post',
    this.code = '',
    this.imageUrl = '',
    this.videoUrl = '',
    this.caption = '',
    this.views = 0,
    this.likes = 0,
    this.comments = 0,
  });

  final int id;
  final String kind;
  final String code;
  final String imageUrl;
  final String videoUrl;
  final String caption;
  final int views;
  final int likes;
  final int comments;

  bool get isVideo => videoUrl.isNotEmpty;

  factory TopContent.fromJson(Map<String, dynamic> j) => TopContent(
        id: _i(j['id']),
        kind: _s(j['kind'], 'post'),
        code: _s(j['code']),
        imageUrl: _u(j['imageUrl']),
        videoUrl: _u(j['videoUrl']),
        caption: _s(j['caption']),
        views: _i(j['views']),
        likes: _i(j['likes']),
        comments: _i(j['comments']),
      );
}
