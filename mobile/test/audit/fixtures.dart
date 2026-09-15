import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// VIZUAL AUDIT UCHUN NAMUNA JAVOBLAR.
///
/// DIQQAT: bu ma'lumot FAQAT shu testlarda ishlatiladi va ilova
/// kodiga umuman kirmaydi (`lib/` da soxta ma'lumot yo'qligini
/// `test/rules_test.dart` alohida tekshiradi). Maqsad — har bir
/// ekranni to'ldirilgan holatda ko'rib, dizaynga mosligini baholash.
/// Bo'sh ekranni ko'rib "chiroylimi?" deb baho berib bo'lmaydi.
/// AUDIT MIJOZINING HOLATLARI.
///
/// `kNormal` — hamma narsa joyida (asosiy kadrlar shu holatda).
/// Qolganlari — SIFAT DARVOZASI uchun: yangi foydalanuvchi, tarmoq
/// yo'q, server xatosi. Bularni ko'rmasdan "ilova tayyor" deb
/// bo'lmaydi: odam ularni kamida bir marta ko'radi.
enum AuditMode { normal, newUser, offline, serverError }

/// Tarmoq uzilishini taqlid qiladi — `Api` buni `offline` deb
/// tarjima qiladi.
MockClient auditClient({AuditMode mode = AuditMode.normal}) => MockClient((req) async {
      if (mode == AuditMode.offline) {
        throw http.ClientException('tarmoq yo‘q', req.url);
      }
      if (mode == AuditMode.serverError) {
        return http.Response('{"error":"server_error"}', 500,
            headers: {'content-type': 'application/json'});
      }
      if (mode == AuditMode.newUser) {
        return _newUserResponse(req.url.path);
      }
      return _normalResponse(req);
    });

/// YANGI FOYDALANUVCHI: hisob bor, lekin hech narsa yo'q.
http.Response _newUserResponse(String p) {
  final body = switch (p) {
    '/api/auth/me' => {
        'user': {'id': 2, 'email': 'yangi@nfcstore.uz'},
        'cards': const [],
      },
    '/api/companies/mine' || '/api/companies' => {'companies': const []},
    '/api/records' => const [],
    '/api/stories/feed' => {'feed': const []},
    '/api/feed' => {'feed': const [], 'hasMore': false},
    '/api/orders' => {'orders': const []},
    '/api/gift-offers' => {'incoming': const [], 'outgoing': const []},
    _ => const <String, dynamic>{},
  };
  return http.Response(jsonEncode(body), 200,
      headers: {'content-type': 'application/json'});
}

Future<http.Response> _normalResponse(http.Request req) async {
  final p = req.url.path;
  dynamic body;

      if (p == '/api/auth/me') {
        body = {
          'user': {'id': 1, 'email': 'egasi@nfcstore.uz', 'phone': '+998901234567'},
          'cards': [_card, _secondCard],
        };
      } else if (p == '/api/companies/mine' || p == '/api/companies') {
        body = {'companies': [_company, _company2]};
      } else if (p == '/api/records') {
        body = [_card, _secondCard, _freeId, _freeId2, _expert];
      } else if (p == '/api/feed') {
        // REELS — shaxsiy va biznes, post va istorya aralash.
        // Aralashtirilgani ataylab: ekran to'rt holatni ham bir
        // kadrda ko'rsatsin (yoqtirilgan, yoqtirilmagan,
        // yoqtirib bo'lmaydigan kompaniya posti, istorya).
        body = {
          'feed': [
            {
              'kind': 'post', 'id': 501, 'code': 'AAA512', 'authorKind': 'card',
              'name': 'Jasur Tolipov', 'avatarUrl': '/uploads/a1.jpg',
              'imageUrl': '/uploads/p1.jpg',
              'caption': 'Yangi karta keldi — qora metall.',
              'createdAt': 1757800000000, 'likeCount': 24, 'liked': true,
              'likeable': true,
            },
            {
              'kind': 'story', 'id': 77, 'code': 'DDD333', 'authorKind': 'company',
              'name': 'NFCSTORE', 'avatarUrl': '/uploads/logo.jpg',
              'imageUrl': '/uploads/s1.jpg',
              'caption': 'Bugun ustaxonada.',
              'createdAt': 1757799000000, 'likeCount': 0, 'liked': false,
              'likeable': false,
            },
            {
              'kind': 'post', 'id': 502, 'code': 'BBB222', 'authorKind': 'company',
              'name': 'Ali Market', 'avatarUrl': '',
              'imageUrl': '/uploads/p2.jpg', 'caption': '',
              'createdAt': 1757798000000, 'likeCount': 0, 'liked': false,
              'likeable': false,
            },
          ],
          'hasMore': false,
        };
      } else if (p == '/api/stories/feed') {
        // HAQIQIY LENTA: obuna bo'lingan odamlarning istoryalari.
        // Bo'sh qoldirilsa, audit bosh ekrandagi story qatorini
        // umuman ko'rmasdi.
        body = {
          'feed': [
            {'code': 'AAA512', 'name': 'Jasur Tolipov', 'stories': [
              {'id': 1, 'imageUrl': '/uploads/s1.jpg'},
            ]},
            {'code': 'EXP318', 'name': 'Dr. Shahnoza', 'stories': [
              {'id': 2, 'imageUrl': '/uploads/s2.jpg'},
              {'id': 3, 'imageUrl': '/uploads/s3.jpg'},
            ]},
            {'code': 'ZZZ100', 'name': 'Karim Rashidov', 'stories': [
              {'id': 4, 'imageUrl': '/uploads/s4.jpg'},
            ]},
          ],
        };
      } else if (p == '/api/records/search') {
        body = {'records': [_card, _expert, _freeId]};
      } else if (p == '/api/companies/search') {
        body = {'companies': [_company]};
      } else if (p.startsWith('/api/records/') && p.endsWith('/posts')) {
        body = {'posts': _posts};
      } else if (p.startsWith('/api/records/') && p.endsWith('/stories')) {
        body = {'stories': _posts};
      } else if (p.startsWith('/api/records/') && p.endsWith('/analytics')) {
        body = {'profileViews': 12480, 'totalViews': 12480};
      } else if (p.startsWith('/api/follow-stats/')) {
        body = {'followers': 1843, 'following': 312, 'isFollowing': false};
      } else if (p.startsWith('/api/follow-list/')) {
        body = {
          'list': [
            {'kind': 'person', 'code': 'AAA512', 'name': 'Jasur Tolipov', 'verified': false},
            {'kind': 'company', 'code': 'DDD333', 'name': 'NFCSTORE', 'verified': true,
             'personCode': 'ZZZ100', 'personName': 'Karim Rashidov'},
          ],
        };
      } else if (p.startsWith('/api/records/')) {
        // SO'RALGAN KOD QAYTARILADI.
        //
        // Ilgari har qanday kodga bitta karta (VIP001) qaytarilardi.
        // Natijada "ommaviy profil" audit kadri aslida EGA
        // ko'rinishini ko'rsatardi (Tahrirlash/Statistika tugmalari
        // bilan) — ya'ni mehmon ko'rinishi umuman tekshirilmasdan
        // qolgan edi.
        final code = p.split('/').last.toUpperCase();
        body = {..._card, 'code': code, if (code != 'VIP001') 'name': 'Jasur Tolipov'};
      } else if (p == '/api/settings/id-pricing') {
        // TARIF NARXLARI — serverdan (ilovada narx jadvali yo'q).
        body = {
          'pricing': {
            'bronze': 49000, 'silver': 99000, 'gold': 149000,
            'premium': 199000, 'exclusiveFrom': 490000,
          },
        };
      } else if (p == '/api/records/check') {
        // BO'SH KOD — bandmi va narxi qancha.
        body = {
          'code': req.url.queryParameters['code'] ?? '',
          'valid': true, 'available': true, 'purchasable': true,
          'tier': 'gold', 'price': 149000,
        };
      } else if (p == '/api/companies/check') {
        // PULLIK BIZNES NOMI — narx SERVERDAN keladi.
        body = {
          'companyId': req.url.queryParameters['id'] ?? '',
          'valid': true,
          'available': true,
          'tier': 'premium',
          'price': 4990000,
        };
      } else if (p.startsWith('/api/companies/') && p.endsWith('/catalog')) {
        body = {'items': _products};
      } else if (p.startsWith('/api/companies/') && p.endsWith('/orders')) {
        body = {'orders': _orders};
      } else if (p.startsWith('/api/companies/') && p.endsWith('/stats')) {
        body = {
          'days': 30, 'views': 12400, 'taps': 842, 'orders': 42,
          'series': List.generate(30, (i) => {
            'day': '2026-09-${(i + 1).toString().padLeft(2, '0')}',
            'views': [12, 48, 30, 71, 22, 55, 90][i % 7],
          }),
          'actions': [
            {'key': 'phone', 'hits': 320},
            {'key': 'telegram', 'hits': 210},
            {'key': 'website', 'hits': 96},
          ],
          'items': [
            {'id': '1', 'name': 'Qora metall karta', 'hits': 180},
            {'id': '2', 'name': 'Tilla nashr', 'hits': 120},
          ],
        };
      } else if (p.startsWith('/api/companies/')) {
        body = {'company': _company};
      } else if (p == '/api/orders') {
        body = {'orders': _webOrders};
      } else if (p == '/api/settings/payments-enabled') {
        body = {'payme': true, 'click': true};
      } else if (p == '/api/settings/physical-nfc-pricing') {
        body = {'physicalCardFee': 200000, 'delivery': {'minDays': 3, 'maxDays': 5},
                'tiers': [{'minQty': 1, 'maxQty': 9, 'pricePerUnit': 120000}]};
      } else if (p == '/api/payments') {
        body = {
          'payments': [
            {'id': 2096, 'kind': 'physical_card_order', 'code': 'VIP001',
             'price': 200000, 'status': 'paid', 'createdAt': '2026-09-10 14:22:00'},
            {'id': 2081, 'kind': 'premium_upgrade', 'code': 'PREMIUM',
             'price': 20000, 'status': 'pending', 'createdAt': '2026-09-08 09:10:00'},
            {'id': 2044, 'kind': 'card_purchase', 'code': 'AAA111',
             'price': 149000, 'status': 'cancelled', 'createdAt': '2026-08-29 18:40:00'},
          ],
          'pendingPayout': 0,
        };
      } else if (p == '/api/support') {
        body = {
          'messages': [
            {'id': 12, 'message': 'Kartam o‘qilmayapti.', 'reply': 'NFC yoqilganini tekshiring.',
             'status': 'answered', 'createdAt': '2026-09-11 10:00:00'},
            {'id': 13, 'message': 'Biznes profilini qanday ochaman?', 'reply': '',
             'status': 'pending', 'createdAt': '2026-09-12 12:30:00'},
          ],
        };
      } else if (p == '/api/telegram/bot') {
        body = {'username': 'nfcstore_bot'};
      } else if (p == '/api/categories') {
        body = {'categories': []};
      } else {
        body = {'ok': true};
      }
  return http.Response(jsonEncode(body), 200,
      headers: {'content-type': 'application/json'});
}

const _card = {
  'code': 'VIP001',
  'name': 'Muhammad Yusuf',
  'role': 'Davlat sud eksperti',
  'about': 'Davlat sud eksperti — ko‘zga ko‘rinmas izlarga til kirituvchi '
      'mutaxassis. Har bir ilmiy xulosamiz ortida adolat turadi.',
  'city': 'Toshkent',
  'phone': '+998901234567',
  'tg': 'muhammad',
  'website': 'nfcstore.uz',
  'profileType': 'personal',
  'verified': true,
  'isPrimary': true,
  'price': 0,
  'views': 12480,
  'tier': 'exclusive',
};

const _secondCard = {
  'code': 'AAA111', 'name': 'Ikkinchi profil', 'profileType': 'personal',
  'price': 99000, 'views': 340, 'tier': 'silver',
};

const _freeId = {'code': 'GLD100', 'name': '', 'price': 149000, 'tier': 'gold'};
const _freeId2 = {'code': 'KTB482', 'name': '', 'price': 49000, 'tier': 'bronze'};

const _expert = {
  'code': 'EXP318', 'name': 'Dr. Shahnoza', 'role': 'Ekspert',
  'city': 'Samarqand', 'profileType': 'expert', 'verified': true,
  'price': 199000, 'views': 48200, 'tier': 'premium',
};

const _company = {
  'companyId': 'DDD333',
  'displayName': 'NFCSTORE',
  'about': 'Premium NFC biznes kartalar va smart teglar. Bir tegish bilan '
      'kontakt, katalog va havolalarni ulashing.',
  'city': 'Toshkent',
  'address': 'Amir Temur 42',
  'phone': '+998901112233',
  'tg': 'nfcstore',
  'status': 'active',
  'tier': 'gold',
  'verified': true,
  'ordersEnabled': true,
  'isOpen': true,
  'hoursLabel': '10:00 – 19:00',
  // ISH VAQTI VA GALEREYA — auditda ko'rinishi uchun. Yakshanba
  // ataylab yopiq: "Dam olish" qatorining ko'rinishi ham
  // tekshirilsin.
  'hours': [
    {'closed': false, 'open': '10:00', 'close': '19:00'},
    {'closed': false, 'open': '10:00', 'close': '19:00'},
    {'closed': false, 'open': '10:00', 'close': '19:00'},
    {'closed': false, 'open': '10:00', 'close': '19:00'},
    {'closed': false, 'open': '10:00', 'close': '19:00'},
    {'closed': false, 'open': '11:00', 'close': '17:00'},
    {'closed': true, 'open': '', 'close': ''},
  ],
  'gallery': [
    '/uploads/gallery-1.jpg',
    '/uploads/gallery-2.jpg',
    '/uploads/gallery-3.jpg',
    '/uploads/gallery-4.jpg',
    '/uploads/gallery-5.jpg',
  ],
  'followers': 1843,
  'views': 12400,
  'itemCount': 36,
};

const _company2 = {
  'companyId': 'BBB222',
  'displayName': 'Ali Market',
  'city': 'Toshkent',
  'status': 'active',
  'isOpen': false,
  'itemCount': 12,
};

const _products = [
  {'id': '1', 'name': 'Qora metall karta', 'price': 1200000,
   'description': 'Lazer bilan ishlangan qora metall karta.'},
  {'id': '2', 'name': 'Tilla nashr', 'price': 1750000, 'promotionPrice': 1487000},
  {'id': '3', 'name': 'Smart teg · kalit', 'price': 290000},
  {'id': '4', 'name': 'Stol standi', 'price': 540000},
];

final _posts = List.generate(9, (i) => {
      'id': '$i',
      'caption': 'Tilla nashr kartalar omborda. Lazer gravyura, 24 oy kafolat.',
      'likes': 248,
      'views': 4120,
      'authorName': 'NFCSTORE',
      'createdAt': '2026-09-13T08:00:00.000Z',
    });

const _orders = [
  {'id': 2096, 'itemName': 'Qora metall karta', 'qty': 1, 'price': 1200000,
   'name': 'Aziz Karimov', 'phone': '+998901112233', 'status': 'new'},
  {'id': 2095, 'itemName': 'Smart teg', 'qty': 2, 'price': 580000,
   'name': 'Karim Rashidov', 'status': 'new'},
];

final _webOrders = [
  {
    'id': 2096, 'code': 'GLD100', 'price': 149000, 'status': 'pending',
    'kind': 'card_purchase', 'payLink': 'https://checkout.paycom.uz/x',
    'expiresAtMs': DateTime.now().add(const Duration(hours: 7)).millisecondsSinceEpoch,
  },
  {'id': 2090, 'code': 'VIP001', 'price': 490000, 'status': 'paid', 'kind': 'card_purchase'},
];
