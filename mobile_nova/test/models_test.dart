import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore_nova/core/network/api_client.dart';
import 'package:nfcstore_nova/data/models/models.dart';

/// Modellar SERVER JAVOBIGA ishonmasligi kerak.
///
/// Backend bitta maydonni o'zgartirsa yoki `null` yuborsa, ilova
/// qulamasligi va bo'sh ekran ko'rsatmasligi shart. Bu testlar aynan
/// shuni tekshiradi.
void main() {
  group('User', () {
    test('to‘liq javobni o‘qiydi', () {
      final u = User.fromJson({
        'id': 42,
        'email': 'aziz@example.com',
        'name': 'Aziz Karimov',
        'phone': '+998901234567',
        'promoCode': 'NOVA10',
      });
      expect(u.id, 42);
      expect(u.displayName, 'Aziz Karimov');
      expect(u.initials, 'AK');
      expect(u.promoCode, 'NOVA10');
    });

    test('ism bo‘lmasa email’dan nom yasaydi', () {
      final u = User.fromJson({'id': 1, 'email': 'nodira@mail.uz'});
      expect(u.displayName, 'nodira');
      expect(u.initials, 'NO');
    });

    test('id satr bo‘lib kelsa ham songa aylanadi', () {
      expect(User.fromJson({'id': '7', 'email': 'a@b.uz'}).id, 7);
    });

    test('bo‘sh javobda ham qulamaydi', () {
      final u = User.fromJson({});
      expect(u.id, 0);
      expect(u.email, '');
      expect(u.displayName, '');
    });
  });

  group('NfcId', () {
    test('backend maydonlarini to‘g‘ri o‘qiydi', () {
      final id = NfcId.fromJson({
        'code': '48210377',
        'name': 'Aziz',
        'isPrimary': true,
        'taps': 120,
        'views': '450',
        'bgUrl': 'https://x/y.jpg',
      });
      expect(id.code, '48210377');
      expect(id.primary, isTrue);
      expect(id.taps, 120);
      // Satr ko'rinishidagi son ham qabul qilinadi.
      expect(id.views, 450);
      expect(id.coverUrl, 'https://x/y.jpg');
      // `active` berilmasa — faol deb hisoblanadi.
      expect(id.active, isTrue);
    });

    test('biznes turini aniqlaydi', () {
      expect(NfcId.fromJson({'code': 'A', 'type': 'business'}).kind,
          NfcIdKind.business);
      expect(NfcId.fromJson({'code': 'A'}).kind, NfcIdKind.personal);
    });

    test('chipToken bo‘lsa karta ulangan deb hisoblanadi', () {
      expect(NfcId.fromJson({'code': 'A', 'chipToken': 'xyz'}).cardLinked, isTrue);
      expect(NfcId.fromJson({'code': 'A'}).cardLinked, isFalse);
    });

    test('ommaviy manzilni to‘g‘ri yasaydi', () {
      final id = NfcId.fromJson({'code': '48210377'});
      expect(id.publicUrl('https://nfcstore.uz'),
          'https://nfcstore.uz/48210377');
    });
  });

  group('CatalogItem', () {
    test('chegirma narxi asosiy narxdan past bo‘lsa ishlatiladi', () {
      final item =
          CatalogItem.fromJson({'id': 1, 'price': 100000, 'salePrice': 75000});
      expect(item.effectivePrice, 75000);
      expect(item.hasDiscount, isTrue);
    });

    test('chegirma narxi baland bo‘lsa e’tiborga olinmaydi', () {
      final item =
          CatalogItem.fromJson({'id': 1, 'price': 100000, 'salePrice': 120000});
      expect(item.effectivePrice, 100000);
      expect(item.hasDiscount, isFalse);
    });

    test('chegirma narxi nol bo‘lsa e’tiborga olinmaydi', () {
      final item =
          CatalogItem.fromJson({'id': 1, 'price': 50000, 'salePrice': 0});
      expect(item.effectivePrice, 50000);
      expect(item.hasDiscount, isFalse);
    });
  });

  group('Post', () {
    test('media turli shakllarda kelsa ham yig‘iladi', () {
      // Manzillar TO'LIQ bo'lib chiqadi. Ilgari bu sinov xom
      // qiymatni kutardi va shu bilan XATONI MUSTAHKAMLAB qo'ygan
      // edi: backend `/uploads/...` ni domensiz qaytaradi, ilova
      // esa hech qanday domenda turmaydi, ya'ni bunday manzil
      // ochilmaydi. Batafsil — `test/media_url_test.dart`.
      expect(
        Post.fromJson({'id': 1, 'media': ['a.jpg', 'b.jpg']}).mediaUrls,
        ['$kApiBase/a.jpg', '$kApiBase/b.jpg'],
      );
      expect(
        Post.fromJson({'id': 1, 'media': [{'url': 'c.jpg'}]}).mediaUrls,
        ['$kApiBase/c.jpg'],
      );
      expect(
        Post.fromJson({'id': 1, 'imageUrl': 'd.jpg'}).mediaUrls,
        ['$kApiBase/d.jpg'],
      );
      expect(Post.fromJson({'id': 1}).mediaUrls, isEmpty);
    });

    test('video ekanini bir nechta belgidan aniqlaydi', () {
      expect(Post.fromJson({'id': 1, 'type': 'reel'}).isVideo, isTrue);
      expect(Post.fromJson({'id': 1, 'videoUrl': 'v.mp4'}).isVideo, isTrue);
      expect(Post.fromJson({'id': 1}).isVideo, isFalse);
    });

    test('copyWith faqat berilgan maydonni almashtiradi', () {
      final p = Post.fromJson({'id': 1, 'likes': 5, 'text': 'salom'});
      final next = p.copyWith(likes: 6, liked: true);
      expect(next.likes, 6);
      expect(next.liked, isTrue);
      expect(next.text, 'salom');
    });
  });

  group('ActivityEvent', () {
    test('turlarni backend kalitidan tanlaydi', () {
      expect(ActivityEvent.fromJson({'id': 1, 'type': 'like'}).kind,
          ActivityKind.like);
      expect(ActivityEvent.fromJson({'id': 1, 'type': 'tap'}).kind,
          ActivityKind.scan);
      // Noma'lum tur — tizim hodisasi.
      expect(ActivityEvent.fromJson({'id': 1, 'type': 'qandaydir'}).kind,
          ActivityKind.system);
    });
  });

  group('parseList', () {
    test('turli o‘rammalardan ro‘yxat ajratadi', () {
      expect(parseList([{'id': 1}], (j) => j['id']), [1]);
      expect(parseList({'items': [{'id': 2}]}, (j) => j['id']), [2]);
      expect(parseList({'data': [{'id': 3}]}, (j) => j['id']), [3]);
      expect(parseList(null, (j) => j['id']), isEmpty);
      // Ro'yxat ichidagi begona elementlar tashlab ketiladi.
      expect(parseList([1, {'id': 4}, 'x'], (j) => j['id']), [4]);
    });
  });
}
