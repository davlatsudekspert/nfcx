// TO'LOV TIZIMINI TANLASH: PAYME VA CLICK.
//
// MUAMMO: ekranda ikkala tizim ham ko'rinardi, lekin Click DOIM
// o'chiq edi va bosilganda ham Payme havolasi ochilardi — ya'ni
// tanlov soxta edi. Server tomonda ham barcha `payLink` faqat
// Payme'niki bo'lgan.
//
// Endi server `payLinks: {payme, click}` qaytaradi va ekran
// tanlangan tizimning havolasini ochadi. Qaysi tizim yoqilganini
// FAQAT SERVER aytadi (`/api/settings/payments-enabled`) — ilova
// hech narsani taxmin qilmaydi.
import 'package:flutter_test/flutter_test.dart';
import 'package:nfcstore/data/models.dart';

void main() {
  group('Buyurtma havolalari', () {
    Order parse(Map<String, dynamic> j) => Order.fromJson(j);

    test('ikkala havola ham o‘qiladi', () {
      final o = parse({
        'id': 7,
        'code': 'GLD100',
        'price': 149000,
        'status': 'pending',
        'payLink': 'https://checkout.paycom.uz/abc',
        'payLinks': {
          'payme': 'https://checkout.paycom.uz/abc',
          'click': 'https://my.click.uz/services/pay?x=1',
        },
      });

      expect(o.linkFor('payme'), 'https://checkout.paycom.uz/abc');
      expect(o.linkFor('click'), 'https://my.click.uz/services/pay?x=1');
    });

    test('ESKI SERVER — faqat `payLink` bo‘lsa Payme ishlaydi', () {
      // Server yangilanmagan bo'lsa ham kirish yo'li buzilmasin:
      // Payme eski maydondan olinadi, Click esa yo'q deb qaraladi.
      final o = parse({
        'id': 7,
        'code': 'GLD100',
        'price': 149000,
        'status': 'pending',
        'payLink': 'https://checkout.paycom.uz/abc',
      });

      expect(o.linkFor('payme'), 'https://checkout.paycom.uz/abc');
      expect(o.linkFor('click'), isNull);
    });

    test('CLICK O‘CHIQ BO‘LSA havola umuman bo‘lmaydi', () {
      // Server Click kalitlari yo'qligida `click` maydonini
      // qo'ymaydi — ilova ham uni "bor" deb ko'rsatmasligi kerak.
      final o = parse({
        'id': 7,
        'code': 'GLD100',
        'price': 149000,
        'status': 'pending',
        'payLink': 'https://checkout.paycom.uz/abc',
        'payLinks': {'payme': 'https://checkout.paycom.uz/abc'},
      });

      expect(o.linkFor('click'), isNull);
      expect(o.payLinks.containsKey('click'), isFalse);
    });

    test('bo‘sh qiymat havola deb hisoblanmaydi', () {
      final o = parse({
        'id': 7,
        'code': 'GLD100',
        'price': 149000,
        'status': 'pending',
        'payLinks': {'payme': '', 'click': ''},
      });

      expect(o.linkFor('payme'), isNull);
      expect(o.linkFor('click'), isNull);
    });

    test('buzuq `payLinks` ekranni yiqitmaydi', () {
      final o = parse({
        'id': 7,
        'code': 'GLD100',
        'price': 149000,
        'status': 'pending',
        'payLinks': 'buzuq',
      });

      expect(o.payLinks, isEmpty);
      expect(o.linkFor('payme'), isNull);
    });
  });
}
